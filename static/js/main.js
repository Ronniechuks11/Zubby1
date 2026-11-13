(() => {
  "use strict";
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loader = $("#loader");
  const skip = $("#skipIntro");
  let introDone = false;
  let lenis = null;
  let lastY = window.scrollY;
  let scrollTick = false;

  function unlockPage() {
    if (introDone) return;
    introDone = true;
    document.body.classList.remove("is-locked");
    if (loader) {
      loader.style.transition = "opacity .5s ease";
      loader.style.opacity = "0";
      window.setTimeout(() => loader.remove(), 550);
    }
    initPageMotion();
  }

  function runIntro() {
    if (!loader) { unlockPage(); return; }
    if (reduceMotion || new URLSearchParams(location.search).has("nointro") || !window.gsap) {
      unlockPage();
      return;
    }
    const gsap = window.gsap;
    const path = $("#loaderPath");
    const count = $("#loaderCount");
    const wine = $("#loaderWine");
    const center = $("#loaderCenter");
    if (path) {
      const length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
    }
    let counter = { value: 0 };
    const tl = gsap.timeline({ onComplete: unlockPage });
    tl.to(counter, { value: 100, duration: 3.1, ease: "none", onUpdate: () => {
      if (count) count.textContent = String(Math.round(counter.value)).padStart(3, "0");
    } }, 0);
    if (path) tl.to(path, { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, .2);
    tl.to(path, { fill: "#F5EFEA", stroke: "rgba(245,239,234,0)", duration: .45 }, 1.1);
    tl.fromTo($$(".loader-name strong"), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .65, ease: "expo.out" }, 1.4);
    tl.fromTo($$(".loader-name span"), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .65, ease: "expo.out" }, 1.58);
    tl.to(".loader-tag", { letterSpacing: ".2em", duration: .5 }, 1.65);
    tl.to(center, { scale: .92, opacity: 0, duration: .5, ease: "power2.in" }, 2.48);
    tl.to(wine, { yPercent: -100, duration: .85, ease: "expo.inOut" }, 2.55);
    tl.to(loader, { yPercent: -100, duration: .85, ease: "expo.inOut" }, 2.68);
    window.setTimeout(unlockPage, 6000);
  }

  function initSmoothScroll() {
    if (reduceMotion || window.innerWidth < 900 || !window.Lenis) return;
    try {
      lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: .9 });
      lenis.on("scroll", () => {
        if (window.ScrollTrigger) window.ScrollTrigger.update();
      });
      if (window.gsap) {
        window.gsap.ticker.add((time) => lenis.raf(time * 1000));
        window.gsap.ticker.lagSmoothing(0);
      } else {
        const raf = (time) => { if (lenis) lenis.raf(time); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    } catch (e) { lenis = null; }
  }

  function initScrollUI() {
    const nav = $("#nav");
    const progress = $("#progressBar");
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
      if (nav) {
        nav.classList.toggle("scrolled", y > 30);
        if (y > 180 && y > lastY + 4) nav.classList.add("hidden");
        else if (y < lastY - 4) nav.classList.remove("hidden");
      }
      lastY = y;
      if (!scrollTick) {
        scrollTick = true;
        requestAnimationFrame(() => { scrollTick = false; });
      }
    }, { passive: true });
  }

  function initMenu() {
    const toggle = $("#menuToggle");
    const menu = $("#mobileMenu");
    if (!toggle || !menu) return;
    const close = () => {
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      menu.classList.remove("open");
      document.body.classList.remove("is-locked");
    };
    toggle.addEventListener("click", () => {
      const open = !menu.classList.contains("open");
      toggle.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("open", open);
      document.body.classList.toggle("is-locked", open);
    });
    $$("a", menu).forEach(a => a.addEventListener("click", close));
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  }

  function initInteractions() {
    $$(".service-card").forEach(card => {
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
    if (window.matchMedia("(pointer:fine)").matches) {
      const dot = $(".cursor-dot"), ring = $(".cursor-ring");
      let mx = 0, my = 0, rx = 0, ry = 0;
      document.body.classList.add("cursor-ready");
      window.addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; dot.style.left = `${mx}px`; dot.style.top = `${my}px`; });
      const moveRing = () => {
        rx += (mx - rx) * .18; ry += (my - ry) * .18;
        ring.style.left = `${rx}px`; ring.style.top = `${ry}px`;
        requestAnimationFrame(moveRing);
      };
      moveRing();
      $$("a,button,.work-card").forEach(el => {
        el.addEventListener("pointerenter", () => document.body.classList.add("cursor-hover"));
        el.addEventListener("pointerleave", () => document.body.classList.remove("cursor-hover"));
      });
    }
    $$(".magnetic").forEach(el => {
      if (reduceMotion || !window.matchMedia("(pointer:fine)").matches) return;
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * .12;
        const y = (e.clientY - r.top - r.height / 2) * .12;
        el.style.transform = `translate(${x}px,${y}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
    // Meta Pixel: a WhatsApp click counts as a "Contact" event (no-op when the pixel is off).
    $$('a[href^="https://wa.me"]').forEach(a => a.addEventListener("click", () => {
      if (window.fbq) window.fbq("track", "Contact");
    }));
    const form = $("#contactForm");
    if (form) form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const success = $("#formSuccess");
      const error = $("#formError");
      const submit = $(".form-submit", form);
      const label = submit ? submit.innerHTML : "";
      if (error) { error.classList.remove("show"); error.textContent = ""; }
      if (success) success.classList.remove("show");
      if (submit) { submit.disabled = true; submit.innerHTML = "Sending…"; }
      const data = Object.fromEntries(new FormData(form).entries());
      // Keep ad attribution (utm_* and fbclid) with the lead.
      data.utm = {};
      new URLSearchParams(location.search).forEach((value, key) => {
        if (key.startsWith("utm_") || key === "fbclid") data.utm[key] = value;
      });
      try {
        const res = await fetch(form.dataset.endpoint || form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(data)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.message || "Something went wrong. Please try again or message us on WhatsApp.");
        form.reset();
        if (success) success.classList.add("show");
        if (submit) submit.innerHTML = "Enquiry sent ✓";
        if (window.fbq) window.fbq("track", "Lead");
      } catch (err) {
        if (error) { error.textContent = err.message || "Network error. Please try again."; error.classList.add("show"); }
        if (submit) { submit.disabled = false; submit.innerHTML = label; }
      }
    });
  }

  function initPageMotion() {
    initSmoothScroll();
    initScrollUI();
    initMenu();
    initInteractions();
    const gsap = window.gsap;
    if (!gsap || reduceMotion) {
      $$(".manifesto-text span").forEach(s => s.style.color = "var(--cream)");
      $$(".hero h1 .accent").forEach(a => a.style.setProperty("--u", "1"));
      return;
    }
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    gsap.from(".nav-inner", { y: -25, opacity: 0, duration: .8, ease: "power3.out", delay: .1 });
    gsap.from(".hero .eyebrow", { y: 20, opacity: 0, duration: .7, ease: "power3.out" });
    gsap.from(".hero h1 .line span", { yPercent: 110, rotate: 2, opacity: 0, duration: 1, stagger: .1, ease: "expo.out", delay: .1 });
    gsap.from(".hero-copy", { y: 20, opacity: 0, duration: .8, delay: .55 });
    gsap.from(".hero-actions .btn", { y: 18, scale: .94, opacity: 0, duration: .65, stagger: .12, delay: .65 });
    gsap.from(".hero-bottom", { opacity: 0, y: 12, duration: .8, delay: .85 });
    // Pseudo-elements can't be targeted directly, so the underline is driven by a CSS variable.
    gsap.to(".hero h1 .accent", { "--u": 1, duration: .8, ease: "power2.out", delay: 1 });
    if (window.ScrollTrigger) {
      gsap.utils.toArray(".section-head").forEach(head => {
        gsap.from(head.children, { y: 35, opacity: 0, duration: .8, stagger: .12, ease: "power3.out", scrollTrigger: { trigger: head, start: "top 82%" } });
      });
      gsap.utils.toArray(".service-card").forEach((card, i) => {
        gsap.from(card, { y: 35, opacity: 0, duration: .7, delay: (i % 2) * .08, scrollTrigger: { trigger: card, start: "top 88%" } });
      });
      gsap.utils.toArray(".work-card").forEach((card, i) => {
        gsap.from(card, { y: 45, opacity: 0, duration: .8, delay: i * .08, scrollTrigger: { trigger: card, start: "top 85%" } });
      });
      const manifesto = $("#manifestoText");
      if (manifesto) {
        const words = manifesto.textContent.trim().split(/\s+/);
        manifesto.innerHTML = words.map(word => `<span>${word.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join(" ");
        const spans = $$("span", manifesto);
        gsap.to(spans, { color: "rgba(245,239,234,1)", stagger: .12, ease: "none", scrollTrigger: { trigger: manifesto, start: "top 75%", end: "bottom 35%", scrub: true } });
      }
      gsap.to("#processProgress", { height: "100%", ease: "none", scrollTrigger: { trigger: ".process-wrap", start: "top 65%", end: "bottom 75%", scrub: true } });
      $$(".process-card").forEach((card, i) => {
        if (i < 3) gsap.to(card, { scale: .94 - i * .015, opacity: .7, scrollTrigger: { trigger: card, start: "top 115px", end: "bottom top", scrub: true } });
      });
      $$(".stat strong").forEach(el => {
        const target = parseFloat(el.dataset.count || "0");
        const suffix = el.dataset.suffix || "";
        const counter = { value: 0 };
        gsap.to(counter, { value: target, duration: 1.8, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 90%", once: true }, onUpdate: () => {
          const digits = Number.isInteger(target) ? Math.round(counter.value) : counter.value.toFixed(1);
          el.textContent = `${digits}${suffix}`;
        }});
      });
      gsap.from(".contact-form", { y: 40, opacity: 0, duration: .9, scrollTrigger: { trigger: ".contact-form", start: "top 85%" } });
      gsap.to("#footerWordmark", { backgroundSize: "100% 100%", scrollTrigger: { trigger: "#footerWordmark", start: "top 90%", end: "bottom 55%", scrub: true } });
    }
    if (window.innerWidth > 900) {
      const hero = $(".hero");
      const echoes = $$(".echo");
      hero.addEventListener("pointermove", e => {
        const x = (e.clientX / window.innerWidth - .5) * 14;
        const y = (e.clientY / window.innerHeight - .5) * 14;
        echoes.forEach((el, i) => { el.style.marginLeft = `${x * (i + 1) * .12}px`; el.style.marginTop = `${y * (i + 1) * .12}px`; });
      });
    }
  }

  if (skip) skip.addEventListener("click", unlockPage);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runIntro, { once: true });
  else runIntro();
})();
