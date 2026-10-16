/* =============================================================
   nodes.js — the hero's interactive node field.
   Canvas 2D, one rAF loop, transform-free drawing (it is a canvas),
   DPR capped at 2, stops entirely when off-screen or tab-hidden.
   ============================================================= */

import { clamp, reduceMotion, warn } from "./core.js";

const MAX_NODES = 110;
const LINK_DIST = 132;
const POINTER_RADIUS = 170;

export function initNodes(canvas) {
  if (!canvas || !canvas.getContext) return null;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    warn("nodes", "2d context unavailable — canvas stays decorative");
    return null;
  }

  const counterNodes = document.querySelector("[data-node-count]");
  const counterLinks = document.querySelector("[data-link-count]");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let nodes = [];
  let links = 0;
  let rafId = 0;
  let running = false;
  let visible = true;
  const pointer = { x: -9999, y: -9999, active: false };
  const still = reduceMotion();

  function build() {
    const area = width * height;
    const count = Math.round(clamp(area / 15000, 26, MAX_NODES));
    nodes = Array.from({ length: count }, () => {
      const accent = Math.random() < 0.16;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: accent ? 2.1 : 1.35 + Math.random() * 0.9,
        accent,
      };
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!nodes.length || Math.abs(nodes.length - Math.round(clamp((width * height) / 15000, 26, MAX_NODES))) > 18) {
      build();
    }
    draw();
  }

  function step(dt) {
    const push = 0.055;
    for (const n of nodes) {
      if (!still) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
      }

      if (pointer.active) {
        const dx = n.x - pointer.x;
        const dy = n.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < POINTER_RADIUS * POINTER_RADIUS && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / POINTER_RADIUS) * push * dt;
          n.x += (dx / d) * force * 26;
          n.y += (dy / d) * force * 26;
        }
      }

      if (n.x < -12) n.x = width + 12;
      else if (n.x > width + 12) n.x = -12;
      if (n.y < -12) n.y = height + 12;
      else if (n.y > height + 12) n.y = -12;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // links first — one path, one stroke call
    links = 0;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK_DIST * LINK_DIST) continue;
        links++;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.strokeStyle = "rgba(92, 104, 117, 0.30)";
    ctx.stroke();

    // pointer ring — the field acknowledges the cursor
    if (pointer.active) {
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, POINTER_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(47, 224, 138, 0.16)";
      ctx.stroke();
    }

    // nodes
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.accent ? "rgba(47, 224, 138, 0.85)" : "rgba(138, 149, 163, 0.55)";
      ctx.fill();
    }

    if (counterNodes) counterNodes.textContent = String(nodes.length);
    if (counterLinks) counterLinks.textContent = String(links);
    if (canvas.dataset.ready !== "true") canvas.dataset.ready = "true";
  }

  let last = 0;
  function loop(now) {
    if (!running) return;
    const dt = clamp((now - last) / 16.67, 0, 3);
    last = now;
    step(dt || 1);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || still || document.hidden || !visible) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ── events ────────────────────────────────────────────────
  const onPointer = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = pointer.x > -40 && pointer.x < width + 40;
    if (still) draw();
  };
  const onLeave = () => {
    pointer.active = false;
    if (still) draw();
  };

  const hero = canvas.closest(".hero") || canvas.parentElement;
  const ro = "ResizeObserver" in window ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(hero);
  else window.addEventListener("resize", resize);

  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? true;
          if (visible) start();
          else stop();
        },
        { rootMargin: "80px" },
      )
    : null;
  if (io) io.observe(canvas);

  if (!still) {
    hero.addEventListener("pointermove", onPointer, { passive: true });
    hero.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  }

  resize();
  draw();
  start();

  return {
    destroy() {
      stop();
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      hero.removeEventListener("pointermove", onPointer);
      hero.removeEventListener("pointerleave", onLeave);
    },
  };
}
