/* =============================================================
   hero.js — the role typewriter.
   Decorative only: the static roster in the side panel is the
   accessible source of truth, this line is aria-hidden.
   ============================================================= */

import { reduceMotion, qs } from "./core.js";

const ROLES = [
  "Full Stack Developer",
  "Python Automation Specialist",
  "Tech-Driven SEO & Backlink Expert",
  "Video Editor",
];

const TYPE_MS = 52;
const DELETE_MS = 26;
const HOLD_MS = 1750;
const GAP_MS = 340;

export function initRoles() {
  const out = qs("[data-roles-text]");
  if (!out) return null;

  const full = ROLES[0];
  if (reduceMotion()) {
    out.textContent = full;
    return null;
  }

  let index = 0;
  let timer = 0;
  let alive = true;
  let inView = true;
  out.textContent = "";

  const set = (text) => {
    out.textContent = text;
  };

  function typeFrom(text, done) {
    let i = 0;
    (function tick() {
      if (!alive) return;
      if (!inView) {
        timer = window.setTimeout(tick, 400);
        return;
      }
      i += 1;
      set(text.slice(0, i));
      if (i < text.length) timer = window.setTimeout(tick, TYPE_MS);
      else timer = window.setTimeout(done, HOLD_MS);
    })();
  }

  function deleteTo(len, done) {
    let i = out.textContent.length;
    (function tick() {
      if (!alive) return;
      if (!inView) {
        timer = window.setTimeout(tick, 400);
        return;
      }
      i -= 1;
      set(out.textContent.slice(0, Math.max(0, i)));
      if (i > len) timer = window.setTimeout(tick, DELETE_MS);
      else timer = window.setTimeout(done, GAP_MS);
    })();
  }

  function cycle() {
    const text = ROLES[index % ROLES.length];
    typeFrom(text, () => {
      deleteTo(0, () => {
        index += 1;
        cycle();
      });
    });
  }

  cycle();

  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 },
    );
    const host = out.closest(".hero");
    if (host) io.observe(host);
  }

  document.addEventListener("visibilitychange", () => {
    inView = !document.hidden && (io ? true : true);
  });

  return () => {
    alive = false;
    if (timer) window.clearTimeout(timer);
    if (io) io.disconnect();
    set(full);
  };
}
