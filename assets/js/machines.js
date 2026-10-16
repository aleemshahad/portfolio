/* =============================================================
   machines.js — the five bento widgets.

   Division of labour: JS only flips data-attributes / inline
   custom delays, CSS owns every transition. GSAP is never
   involved here, so there is exactly one writer per property.
   ============================================================= */

import { qsa, reduceMotion, safe, warn } from "./core.js";

const MACHINE_SELECTOR = "[data-machine]";
const TERM_STEP = 110;
const QUEUE_STEP = 130;
const TIMELINE_MS = 2400;
const STACK_STEP = 850;

/* ── terminal ────────────────────────────────────────────── */
function initTerm(el) {
  const lines = qsa(".m-term__line", el);
  const arm = (on) => {
    lines.forEach((line, i) => {
      line.style.transitionDelay = on ? `${i * TERM_STEP}ms` : "0ms";
    });
    el.dataset.armed = on ? "true" : "false";
  };
  arm(reduceMotion());
  return { arm, mode: "toggle" };
}

/* ── authority graph ─────────────────────────────────────── */
function initGraph(el) {
  const curve = el.querySelector(".g-curve");
  const dot = el.querySelector(".g-dot");
  let length = 0;

  if (curve && typeof curve.getTotalLength === "function") {
    try {
      length = curve.getTotalLength();
    } catch {
      length = 0;
    }
  }

  const arm = (on) => {
    if (curve && length) {
      curve.style.strokeDasharray = `${length}`;
      curve.style.strokeDashoffset = on ? "0" : `${length}`;
    }
    if (dot) dot.style.opacity = on ? "1" : "0";
    el.dataset.armed = on ? "true" : "false";
  };
  arm(reduceMotion());
  return { arm, mode: "toggle" };
}

/* ── schedule queue ──────────────────────────────────────── */
function initQueue(el) {
  const rows = qsa(".m-queue__row", el);
  const arm = (on) => {
    rows.forEach((row, i) => {
      row.style.transitionDelay = on ? `${i * QUEUE_STEP}ms` : "0ms";
      row.dataset.in = on ? "true" : "false";
    });
    el.dataset.armed = on ? "true" : "false";
  };
  arm(reduceMotion());
  return { arm, mode: "toggle" };
}

/* ── stack layers: a live one-hot sweep ──────────────────── */
function initStack(el) {
  const rows = qsa(".m-stack__row", el);
  let timer = 0;
  let index = 0;

  const paint = () => {
    rows.forEach((row, i) => {
      row.dataset.on = i === index ? "true" : "false";
    });
  };

  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const start = () => {
    stop();
    if (reduceMotion() || rows.length < 2) return;
    timer = window.setInterval(() => {
      index = (index + 1) % rows.length;
      paint();
    }, STACK_STEP);
  };

  const arm = (on) => {
    el.dataset.armed = on ? "true" : "false";
    if (on) start();
    else {
      stop();
      index = 0;
      paint();
    }
  };

  if (reduceMotion()) {
    index = 0;
    paint();
    el.dataset.armed = "true";
  }

  return { arm, mode: "sweep" };
}

/* ── edit timeline: playhead + active clip ───────────────── */
function initTimeline(el) {
  const track = el.querySelector(".m-timeline__track");
  const head = el.querySelector("[data-playhead]");
  const clips = qsa(".m-timeline__clip", el);
  let timers = [];

  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };

  const arm = (on) => {
    clearTimers();
    el.dataset.armed = on ? "true" : "false";

    if (!on) {
      if (head) head.style.transform = "translate3d(0,0,0)";
      clips.forEach((c, i) => (c.dataset.on = i === 0 ? "true" : "false"));
      return;
    }

    if (head && track) {
      const travel = Math.max(0, track.clientWidth - head.offsetWidth);
      head.style.transform = `translate3d(${travel}px,0,0)`;
    }

    clips.forEach((clip) => (clip.dataset.on = "false"));
    clips.forEach((clip, i) => {
      const at = (i / Math.max(1, clips.length)) * TIMELINE_MS;
      timers.push(
        window.setTimeout(() => {
          clip.dataset.on = "true";
        }, at),
      );
    });
  };

  if (reduceMotion()) {
    if (head && track) {
      const travel = Math.max(0, track.clientWidth - head.offsetWidth);
      head.style.transform = `translate3d(${travel}px,0,0)`;
    }
    clips.forEach((c) => (c.dataset.on = "true"));
    el.dataset.armed = "true";
  }

  return { arm, mode: "toggle" };
}

const INIT = {
  term: initTerm,
  graph: initGraph,
  queue: initQueue,
  stack: initStack,
  timeline: initTimeline,
};

/* ── wiring ──────────────────────────────────────────────── */
export function initMachines() {
  const machines = qsa(MACHINE_SELECTOR).map((el) => ({ el, kind: el.dataset.machine }));
  if (!machines.length) return null;

  const instances = [];
  for (const { el, kind } of machines) {
    const factory = INIT[kind];
    if (!factory) {
      warn("machines", `unknown machine kind "${kind}" — skipped`);
      continue;
    }
    const inst = safe("machines", () => factory(el));
    if (inst) instances.push({ el, ...inst });
  }

  // Reduced motion: every widget sits in its finished state and the
  // replay buttons never become interactive (nothing to replay).
  if (reduceMotion()) return { instances };

  // Replay buttons only exist once JS can actually drive them.
  // They are siblings of the panel (above its top-right corner), not
  // children of it, so the lookup starts from the owning card.
  for (const { el } of instances) {
    const scope = el.closest(".bento-card") || el.parentElement;
    const btn = scope && scope.querySelector("[data-replay]");
    if (btn) {
      btn.hidden = false;
      btn.addEventListener("click", () => {
        const inst = instances.find((i) => i.el === el);
        if (!inst) return;
        inst.arm(false);
        // force a reflow so the "off" state is committed before re-arming
        void el.offsetWidth;
        window.setTimeout(() => inst.arm(true), 40);
      });
    }
  }

  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const inst = instances.find((i) => i.el === entry.target);
          if (!inst) continue;
          if (entry.isIntersecting) {
            if (inst.el.dataset.armed !== "true") inst.arm(true);
            if (inst.mode === "sweep") inst.arm(true);
          } else if (inst.mode === "sweep") {
            inst.arm(false);
          }
        }
      },
      { threshold: 0.35 },
    );
    instances.forEach(({ el }) => io.observe(el));
  } else {
    instances.forEach(({ el, arm }) => arm(true));
  }

  // Hard guarantee: even if the observer never fires (odd browser,
  // zero-height layout), no widget is allowed to stay blank.
  const failsafe = window.setTimeout(() => {
    instances.forEach(({ el, arm, mode }) => {
      if (mode !== "sweep" && el.dataset.armed !== "true") arm(true);
    });
  }, 4200);

  return {
    instances,
    destroy() {
      window.clearTimeout(failsafe);
      if (io) io.disconnect();
      instances.forEach(({ arm }) => arm(false));
    },
  };
}
