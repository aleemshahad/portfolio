/* =============================================================
   nav.js — page chrome: stuck header, full-screen mobile sheet,
   current-section highlighting, footer year.
   ============================================================= */

import { qs, qsa, safe } from "./core.js";

const STUCK_AT = 12;

export function initChrome() {
  const header = qs("[data-header]");
  const toggle = qs("[data-menu-toggle]");
  const sheet = qs("[data-sheet]");
  const closer = qs("[data-menu-close]");

  /* ── stuck header ───────────────────────────────────────── */
  let ticking = false;
  const syncHeader = () => {
    ticking = false;
    if (!header) return;
    header.dataset.stuck = window.scrollY > STUCK_AT ? "true" : "false";
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(syncHeader);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  syncHeader();

  /* ── mobile sheet ───────────────────────────────────────── */
  let open = false;
  let lastFocus = null;

  const focusables = () =>
    sheet ? qsa('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', sheet) : [];

  const setOpen = (next) => {
    if (!sheet || !toggle || open === next) return;
    open = next;
    sheet.dataset.open = next ? "true" : "false";
    toggle.setAttribute("aria-expanded", next ? "true" : "false");
    toggle.setAttribute("aria-label", next ? "Close menu" : "Open menu");
    document.documentElement.style.overflow = next ? "hidden" : "";

    if (next) {
      lastFocus = document.activeElement;
      const [first] = focusables();
      if (first) first.focus({ preventScroll: true });
    } else if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  };

  if (toggle) toggle.addEventListener("click", () => setOpen(!open));
  if (closer) closer.addEventListener("click", () => setOpen(false));

  if (sheet) {
    sheet.addEventListener("click", (e) => {
      const link = e.target.closest("a[href^='#']");
      if (link) setOpen(false);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 960 && open) setOpen(false);
  });

  /* ── current section -> nav aria-current ────────────────── */
  const linkFor = (id) => qsa(`.site-nav a[href="#${id}"]`).filter(Boolean);

  let current = "";
  const mark = (id) => {
    if (!id || id === current) return;
    current = id;
    qsa(".site-nav a").forEach((a) => a.removeAttribute("aria-current"));
    linkFor(id).forEach((a) => a.setAttribute("aria-current", "true"));
  };

  const sections = qsa("main section[id]");
  if (sections.length && "IntersectionObserver" in window) {
    const seen = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.intersectionRatio);
        let best = null;
        let bestRatio = 0;
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }
        if (best) mark(best);
      },
      { threshold: [0, 0.15, 0.35, 0.6, 0.9], rootMargin: "-64px 0px -40% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    mark(sections[0].id);
  }

  /* ── footer year ────────────────────────────────────────── */
  const year = qs("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  return { setOpen, markCurrent: mark, destroy() {} };
}

/** Header gets the intro tween only when motion is on. */
export function headerTargets() {
  return [
    ...qsa(".site-header .brand"),
    ...qsa(".site-header .site-nav li"),
    ...qsa(".site-header .header__end"),
  ];
}

export function initNav() {
  return safe("nav", initChrome);
}
