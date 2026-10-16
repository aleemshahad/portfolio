/* =============================================================
   motion.js — the BUILD LOG choreography.

   Order of operations:
     1. wait for the vendored GSAP + ScrollTrigger
     2. if they never arrive, drop [data-motion] and the page is
        simply a finished static document
     3. scroll-linked indicators (rail fill, top progress) always
        run — they report position, they do not perform
     4. entrance + reveal choreography only when motion is on
   ============================================================= */

import { qsa, gsapReady, warn } from "./core.js";

const EXPO = "expo.out";

function scrollIndicators(gsap, ScrollTrigger) {
  const fill = document.querySelector(".rail__fill");
  const bar = document.querySelector("[data-progress]");

  if (fill) {
    gsap.to(fill, {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.35 },
    });
  }
  if (bar) {
    gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
    gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.25 },
    });
  }

  // rail stage highlighting — mirrors what the nav already announces
  const stages = qsa(".rail li[data-rail]");
  const marks = new Map();
  for (const li of stages) {
    const section = document.getElementById(li.dataset.rail);
    if (!section) continue;
    const st = ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => marks.set(li, self.isActive),
    });
    if (st) marks.set(li, st.isActive);
  }
  const sync = () => {
    let best = null;
    for (const [li, active] of marks) if (active) best = li;
    stages.forEach((li) => (li.dataset.active = li === best ? "true" : "false"));
    if (!best && stages[0]) stages[0].dataset.active = "true";
  };
  sync();
}

function intro(gsap) {
  const tl = gsap.timeline({ defaults: { ease: EXPO, duration: 0.7 } });

  tl.to(".site-header .brand", { opacity: 1, y: 0, duration: 0.6 }, 0)
    .to(".site-header .site-nav li", { opacity: 1, y: 0, stagger: 0.05, duration: 0.55 }, 0.08)
    .to(".site-header .header__end", { opacity: 1, y: 0, duration: 0.55 }, 0.22)
    .to(".hero__title .line__in", { y: 0, duration: 1.0, stagger: 0.1 }, 0.05)
    .to(".hero__lead", { opacity: 1, y: 0, duration: 0.7 }, 0.38)
    .to(".hero__roles", { opacity: 1, y: 0, duration: 0.6 }, 0.5)
    .to(".hero__actions", { opacity: 1, y: 0, duration: 0.6 }, 0.6)
    .to(".hero__side > *", { opacity: 1, x: 0, stagger: 0.08, duration: 0.7 }, 0.32)
    .to(".rail", { opacity: 1, duration: 0.6 }, 0.55)
    .to(".scroll-progress", { opacity: 1, duration: 0.6 }, 0.55);

  return tl;
}

function reveals(gsap, ScrollTrigger) {
  // section heads — eyebrow, then title, then lede
  for (const head of qsa(".sec-head")) {
    gsap.to(head.children, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.09,
      ease: EXPO,
      overwrite: true,
      scrollTrigger: { trigger: head, start: "top 86%", once: true },
    });
  }

  const batchTargets = qsa(".rise, .metric").filter((el) => !el.closest("[data-projects]"));
  if (batchTargets.length) {
    ScrollTrigger.batch(batchTargets, {
      start: "top 90%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: EXPO, overwrite: true }),
    });
  }
}

export async function initMotion() {
  const win = await gsapReady();
  if (!win || !win.gsap || !win.ScrollTrigger) {
    document.documentElement.removeAttribute("data-motion");
    warn("motion", "GSAP unavailable — page falls back to its finished static state");
    return null;
  }

  const gsap = win.gsap;
  const ScrollTrigger = win.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  scrollIndicators(gsap, ScrollTrigger);

  const motionOn = document.documentElement.getAttribute("data-motion") === "on";
  if (motionOn) {
    intro(gsap);
    reveals(gsap, ScrollTrigger);
  }

  // late layout (fonts, images, injected cards) must be re-measured
  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh).catch(() => {});
  window.addEventListener("load", refresh, { once: true });

  return {
    gsap,
    ScrollTrigger,
    refresh,
    destroy() {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    },
  };
}
