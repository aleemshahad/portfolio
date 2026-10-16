/* =============================================================
   site.js — entry point.

   Boot order matters: chrome and content first (they must work
   even if GSAP never arrives), choreography last. Every stage is
   isolated so one broken feature can never blank the page.
   ============================================================= */

import { qs, safe, warn } from "./core.js";
import { initNav } from "./nav.js";
import { initNodes } from "./nodes.js";
import { initRoles } from "./hero.js";
import { initCounters } from "./counters.js";
import { initMachines } from "./machines.js";
import { initTerminal } from "./terminal.js";
import { initProjects } from "./projects.js";
import { initMotion } from "./motion.js";

async function boot() {
  // ── 1 · chrome + content (GSAP-independent) ───────────────
  safe("nav", initNav);
  safe("nodes", () => initNodes(qs("[data-nodes]")));
  safe("roles", initRoles);
  safe("counters", initCounters);
  safe("machines", initMachines);
  safe("terminal", initTerminal);

  // ── 2 · choreography ──────────────────────────────────────
  try {
    await initMotion();
  } catch (err) {
    warn("motion", "choreography failed — forcing the finished state", err);
    document.documentElement.removeAttribute("data-motion");
  }

  // ── 3 · live project registry (needs ScrollTrigger for its reveal)
  try {
    await initProjects();
  } catch (err) {
    warn("projects", "registry refresh failed — snapshot stays on the page", err);
  }

  // Only now is the document provably alive: until this line runs the
  // <head> failsafe is still free to strip [data-motion] and unhide
  // anything a half-finished boot left behind.
  window.__NEXUS_BOOTED = true;
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
  } else {
    void boot();
  }
} catch (err) {
  warn("site", "boot did not start — page stays in its finished state", err);
  document.documentElement.removeAttribute("data-motion");
  window.__NEXUS_BOOTED = true;
}
