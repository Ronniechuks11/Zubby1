"""Valora Digital — Flask application.

Run locally:   python app.py          (http://127.0.0.1:5000)
Production:    gunicorn app:app       (or waitress-serve app:app on Windows)
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, Response, jsonify, redirect, render_template, request, url_for

# Must match what the contact form offers. The template renders its <select> from this list.
BUDGET_OPTIONS = (
    "Under ₦100,000",
    "₦100,000 – ₦300,000",
    "₦300,000 – ₦750,000",
    "₦750,000 – ₦1,500,000",
    "₦1,500,000+",
    "Let's discuss",
)

FIELD_LIMITS = {"name": 100, "contact": 150, "message": 2000}
RATE_LIMIT_MAX = 5          # enquiries ...
RATE_LIMIT_WINDOW = 600     # ... per IP per 10 minutes


def _env_flag(name: str, default: bool = False) -> bool:
    return os.environ.get(name, "1" if default else "0").strip().lower() in {"1", "true", "yes", "on"}


def create_app(debug: bool = False) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.debug = debug
    # Static files are fingerprinted with ?v=<mtime>, so they can be cached for a long time in production.
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0 if debug else 60 * 60 * 24 * 365
    app.json.ensure_ascii = False

    if _env_flag("TRUST_PROXY"):
        # Set TRUST_PROXY=1 when running behind nginx / a platform proxy so client IPs are correct.
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    whatsapp_digits = re.sub(r"\D", "", os.environ.get("WHATSAPP_NUMBER", "000000000000"))
    site = {
        "name": "Valora Digital",
        "tagline": "Make Your Brand Remembered",
        "description": (
            "Valora Digital is a digital marketing and media agency helping brands get remembered "
            "through strategy, content and performance-driven Meta advertising."
        ),
        "parent": "Defcom Global Holdings",
        "email": os.environ.get("CONTACT_EMAIL", "hello@valoradigital.example"),
        "whatsapp_url": f"https://wa.me/{whatsapp_digits}",
        "meta_pixel_id": os.environ.get("META_PIXEL_ID", "").strip(),
        # Preview builds stay out of search engines until the client approves them.
        "allow_indexing": _env_flag("ALLOW_INDEXING"),
    }

    enquiries_file = Path(app.instance_path) / "enquiries.jsonl"
    write_lock = threading.Lock()
    hits: dict[str, deque] = defaultdict(deque)
    hits_lock = threading.Lock()

    # ------------------------------------------------------------------ helpers
    @app.context_processor
    def inject_globals():
        def asset_url(filename: str) -> str:
            """url_for('static') plus a cache-busting version taken from the file's mtime."""
            path = Path(app.static_folder) / filename
            version = int(path.stat().st_mtime) if path.exists() else 0
            return url_for("static", filename=filename, v=version)

        return {
            "site": site,
            "year": datetime.now().year,
            "budgets": BUDGET_OPTIONS,
            "asset_url": asset_url,
            # Nav/footer anchors: "#services" on the home page, "/#services" everywhere else.
            "anchor_base": "" if request.endpoint == "home" else url_for("home"),
        }

    def rate_limited(ip: str) -> bool:
        now = time.monotonic()
        with hits_lock:
            q = hits[ip]
            while q and now - q[0] > RATE_LIMIT_WINDOW:
                q.popleft()
            if len(q) >= RATE_LIMIT_MAX:
                return True
            q.append(now)
            return False

    def clean(value, limit: int) -> str:
        text = str(value or "").replace("\x00", "").strip()
        return re.sub(r"[ \t]+", " ", text)[:limit] if limit else text

    # ------------------------------------------------------------------- routes
    @app.get("/")
    def home():
        return render_template("index.html", sent=request.args.get("sent") == "1")

    @app.post("/api/contact")
    def contact():
        wants_json = request.is_json or "application/json" in request.headers.get("Accept", "")
        data = request.get_json(silent=True) if request.is_json else request.form
        data = data or {}

        def fail(status: int, message: str, errors: dict | None = None):
            if wants_json:
                return jsonify(ok=False, message=message, errors=errors or {}), status
            return redirect(url_for("home") + "#contact")

        # Honeypot: real visitors never see this field. Pretend success so bots don't retry.
        if clean(data.get("company_website"), 200):
            return jsonify(ok=True) if wants_json else redirect(url_for("home", sent=1) + "#contact")

        entry = {
            "name": clean(data.get("name"), FIELD_LIMITS["name"]),
            "contact": clean(data.get("contact"), FIELD_LIMITS["contact"]),
            "budget": clean(data.get("budget"), 60),
            "message": clean(data.get("message"), FIELD_LIMITS["message"]),
        }
        errors = {}
        if not entry["name"]:
            errors["name"] = "Please tell us your name."
        if not entry["contact"]:
            errors["contact"] = "Please share an email or WhatsApp number."
        if entry["budget"] not in BUDGET_OPTIONS:
            errors["budget"] = "Please choose a budget range."
        if not entry["message"]:
            errors["message"] = "Tell us a little about what you're looking to achieve."
        if errors:
            return fail(400, "Please check the highlighted details and try again.", errors)

        if rate_limited(request.remote_addr or "unknown"):
            return fail(429, "Too many enquiries from this connection. Please try again in a few minutes.")

        utm = data.get("utm") if isinstance(data.get("utm"), dict) else {}
        entry["utm"] = {
            k: clean(v, 150) for k, v in utm.items()
            if isinstance(k, str) and (k.startswith("utm_") or k == "fbclid")
        }
        entry["received_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

        try:
            enquiries_file.parent.mkdir(parents=True, exist_ok=True)
            with write_lock, enquiries_file.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError:
            app.logger.exception("Could not save enquiry")
            return fail(500, "We couldn't save your message. Please message us on WhatsApp instead.")

        app.logger.info("New enquiry from %s", entry["name"])
        return jsonify(ok=True) if wants_json else redirect(url_for("home", sent=1) + "#contact")

    @app.get("/robots.txt")
    def robots():
        body = "User-agent: *\nAllow: /\n" if site["allow_indexing"] else "User-agent: *\nDisallow: /\n"
        return Response(body, mimetype="text/plain")

    @app.get("/healthz")
    def healthz():
        return jsonify(status="ok")

    # ------------------------------------------------------------ errors/headers
    @app.errorhandler(404)
    def not_found(_error):
        return render_template("404.html"), 404

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response

    return app


# `python app.py` is the dev entry point (debug on by default); importing `app` (gunicorn) is production.
DEBUG = _env_flag("FLASK_DEBUG", default=(__name__ == "__main__"))
app = create_app(debug=DEBUG)

if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
        debug=DEBUG,
    )
