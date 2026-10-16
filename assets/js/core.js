/* =============================================================
   core.js — tiny shared helpers. No framework, no polyfills.
   Every comment and log line here is English/Roman-Urdu safe.
   ============================================================= */

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Safe HTML escape — repo names and descriptions come from the wire. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The subset font (SpaceGrotesk.woff2) only carries U+0020-00FF plus a
 * short list of punctuation. Descriptions come off the GitHub wire and
 * routinely contain arrows and bullets that would render as tofu boxes,
 * so every string that reaches the DOM goes through this first.
 */
const GLYPH_FIXUPS = [
  [/\u2194|\u21C4|\u21C6/g, "to"],
  [/\u2192|\u27F6/g, "to"],
  [/\u2190|\u27F5/g, "to"],
  [/\u2713|\u2714/g, ""],
  [/\u25B8|\u25AA|\u25CF|\u25E6|\u2022|\u2023/g, ""],
  [/\u203A|\u00BB/g, ">"],
  [/\u2039|\u00AB/g, "<"],
  [/\u2605|\u2606/g, ""],
  [/\u200B|\u200C|\u200D|\uFEFF/g, ""],
];

export function sanitizeText(value) {
  let out = String(value ?? "");
  for (const [re, to] of GLYPH_FIXUPS) out = out.replace(re, to);
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * GSAP + ScrollTrigger ko tab tak wait karte hain.
 * Agar dono kabhi na milen to null return hota hai aur caller
 * [data-motion] hata kar page ko finished state mein chhod deta hai.
 */
export function gsapReady(timeoutMs = 3500) {
  return new Promise((resolve) => {
    const ok = () => Boolean(window.gsap && window.ScrollTrigger);
    if (ok()) return resolve(window);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(ok() ? window : null);
    };

    window.addEventListener("load", () => setTimeout(finish, 60), { once: true });
    setTimeout(finish, timeoutMs);
  });
}

/** Log helper — one place, English only. */
export function log(scope, message, extra) {
  if (typeof console === "undefined") return;
  const line = `[${scope}] ${message}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

export function warn(scope, message, err) {
  if (typeof console === "undefined") return;
  console.warn(`[${scope}] ${message}`, err ?? "");
}

/** Run an init function without letting one broken feature kill the page. */
export function safe(scope, fn) {
  try {
    const out = fn();
    if (out && typeof out.catch === "function") {
      out.catch((err) => warn(scope, "async init failed", err));
    }
    return out;
  } catch (err) {
    warn(scope, "init failed", err);
    return null;
  }
}
