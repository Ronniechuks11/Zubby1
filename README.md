# Valora Digital — Flask preview

Flask version of the Valora Digital agency site (animated intro, Meta Ads section, process, work, contact).

## Run it

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

Handy URL flags: `/?nointro` skips the opening animation. The intro also has a "Skip intro" button.

## Structure

```
app.py                      Flask app (routes, contact endpoint, config)
requirements.txt
.env.example                Settings you can override (all optional)
templates/
  base.html                 <head>, Meta Pixel (optional), scripts
  index.html                Home page sections
  404.html                  Branded not-found page
  partials/                 _loader, _nav, _footer
static/
  css/style.css             All styles
  js/main.js                Intro, scroll motion, cursor, form handling
  img/favicon.svg
instance/enquiries.jsonl    Created on first enquiry (one JSON object per line)
```

## Settings (environment variables)

| Variable | Purpose | Default |
|---|---|---|
| `CONTACT_EMAIL` | "Email Valora" button | `hello@valoradigital.example` |
| `WHATSAPP_NUMBER` | WhatsApp button, digits with country code | `000000000000` |
| `META_PIXEL_ID` | Turns on the Meta Pixel (PageView, Contact on WhatsApp click, Lead on form submit) | off |
| `ALLOW_INDEXING` | `1` lets search engines index the site | `0` (noindex + `Disallow: /`) |
| `HOST` / `PORT` | Dev server address | `127.0.0.1` / `5000` |
| `FLASK_DEBUG` | `0` turns off debug when using `python app.py` | `1` |
| `TRUST_PROXY` | `1` when behind nginx or a platform proxy | `0` |

Example: `WHATSAPP_NUMBER=2348012345678 META_PIXEL_ID=1234567890 python app.py`
(Windows PowerShell: `$env:WHATSAPP_NUMBER="2348012345678"; python app.py`)

## Contact form

`POST /api/contact` validates the fields, blocks bots with a honeypot, limits each IP to 5 enquiries per 10 minutes, and
appends the enquiry (plus any `utm_*` / `fbclid` from the ad click) to `instance/enquiries.jsonl`.
Read them with `cat instance/enquiries.jsonl`. To get enquiries by email or into a CRM, send the `entry` dict
from `contact()` in `app.py` to your provider before it is written.

## Still placeholders (replace before launch)

- Work cards and the three stats (ROAS, cost per lead, reach) are illustrative; they're labelled PLACEHOLDER on the page.
- Phone mockup numbers (reach, cost per lead) are illustrative.
- Social links in the footer (`templates/partials/_footer.html`).
- WhatsApp number and email (see settings above).

## Deploying

```bash
pip install gunicorn
TRUST_PROXY=1 ALLOW_INDEXING=1 gunicorn -w 2 -b 0.0.0.0:8000 app:app
```

On Windows use `pip install waitress` then `waitress-serve --port=8000 app:app`.
