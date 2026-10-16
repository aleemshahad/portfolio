/* =============================================================
   counters.js — metric numerals count 0 -> target once.
   The final value is already in the HTML, so no-JS and reduced
   motion both render the finished number with zero work.
   ============================================================= */

import { qsa, reduceMotion, warn } from "./core.js";

const DURATION = 1150;

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function initCounters() {
  const targets = qsa("[data-count]");
  if (!targets.length) return null;

  if (reduceMotion() || typeof IntersectionObserver === "undefined") {
    // finished state is already in the markup — nothing to do
    return null;
  }

  const run = (el) => {
    const end = Number.parseInt(el.dataset.count, 10);
    if (!Number.isFinite(end)) return;
    const start = performance.now();
    el.textContent = "0";

    const tick = (now) => {
      const p = Math.min(1, (now - start) / DURATION);
      const value = Math.round(easeOutExpo(p) * end);
      el.textContent = String(value);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = String(end);
    };
    requestAnimationFrame(tick);
  };

  const host = document.getElementById("metrics");
  if (!host) {
    warn("counters", "#metrics missing — counters left untouched");
    return null;
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      // small stagger so the three numerals do not land in lockstep
      targets.forEach((el, i) => window.setTimeout(() => run(el), i * 130));
    },
    { threshold: 0.35 },
  );
  io.observe(host);

  return () => io.disconnect();
}
