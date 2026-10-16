#!/usr/bin/env node
/**
 * serve.mjs — zero-dependency static server for local review + CI.
 *
 *   node scripts/serve.mjs [port] [--dist]     CLI (default 4173)
 *
 * Also exports createServer() so scripts/shot.mjs can spin up its own
 * instance. Two extra routes exist only for the review harness:
 *   POST /_diag      <- the page's error reporter (printed, collected)
 *   GET  /__delay/N  <- held open N ms so a headless `load` wait is long
 *                       enough for the intro animation to finish
 */

import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Harness-only stylesheets, injected by THIS server when the request
 * carries the flags. Nothing in production ever sees them — they are
 * spliced into the outgoing response only, never shipped in dist/.
 *
 *  harness=1  always sent by shot.mjs:
 *    - kill `scroll-behavior: smooth` so a `#section` fragment jump is
 *      instant instead of animating out from under the screenshot
 *  flat=1     sent by shot.mjs in full-page mode:
 *    - collapse the viewport-height shells so a 5600px window doesn't
 *      inflate the hero to 5600px
 */
const HARNESS_CSS = `<style data-harness="1">
  html { scroll-behavior: auto !important; }
</style>`;
const FLAT_CSS = `<style data-harness="flat">
  .hero, .notfound { min-block-size: 0 !important; }
  /* ScrollTrigger reveals fire at "top 88% of the viewport". In a flat
     capture the viewport IS the document, so the last 12% of the page
     can never cross that line and would stay at opacity 0 — a capture
     artifact, not a page bug. Force the finished state for layout review. */
  [data-motion="on"] .rise,
  [data-motion="on"] .metric,
  [data-motion="on"] .sec-head > * { opacity: 1 !important; transform: none !important; }
</style>`;

/**
 * Same reporter index.html ships inline, injected here for the pages
 * that do not (blog.html, 404.html) so the shot tool gets the same
 * error/height signal from every route. Guarded by a call to
 * send("HARNESS") in the page itself, so it is never double-registered.
 */
const HARNESS_JS = `<script data-harness="diag">
(function () {
  if (window.__NEXUS_DIAG__) return;
  window.__NEXUS_DIAG__ = true;
  if (!/[?&]diag=1/.test(location.search)) return;
  /* Hold the load event so a headless browser screenshots the settled
     page rather than frame one — same trick index.html uses inline. */
  var hold = document.createElement("img");
  hold.src = "/__delay/3000";
  hold.alt = "";
  hold.setAttribute("aria-hidden", "true");
  (document.head || document.documentElement).appendChild(hold);
  var send = function (line) {
    try {
      fetch("/_diag", { method: "POST", keepalive: true, headers: { "content-type": "text/plain" }, body: String(line) });
    } catch (e) { /* diagnostics are best effort */ }
  };
  send("HARNESS");
  window.addEventListener("error", function (e) {
    send("ERROR " + (e.message || "unknown") + " @ " + (e.filename || "") + ":" + (e.lineno || 0));
  });
  window.addEventListener("unhandledrejection", function (e) {
    send("REJECTION " + String(e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  var nativeError = console.error;
  console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    send("CONSOLE " + args.map(String).join(" "));
    return nativeError.apply(console, args);
  };
  var reported = false;
  var report = function () {
    if (reported) return;
    reported = true;
    var d = document.documentElement;
    send("METRIC scrollHeight=" + d.scrollHeight);
    send("METRIC motion=" + (d.getAttribute("data-motion") || "off"));
    send("METRIC projects=" + document.querySelectorAll("[data-projects] [data-repo]").length);
    send("READY");
  };
  window.addEventListener("load", report);
  window.setTimeout(report, 5000);
})();
</script>`;

/**
 * @param {{ base?: string, onDiag?: (line: string) => void }} opts
 */
export function createServer(opts = {}) {
  const base = resolve(opts.base || ROOT);
  const onDiag = opts.onDiag || (() => {});

  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      const harness = url.searchParams.get("harness") === "1";
      const flat = url.searchParams.get("flat") === "1";

      /* ── review harness routes ───────────────────────────── */
      if (req.method === "POST" && url.pathname === "/_diag") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const text = Buffer.concat(chunks).toString("utf8").trim();
        if (text) onDiag(text);
        res.writeHead(204).end();
        return;
      }
      const delay = url.pathname.match(/^\/__delay\/(\d{1,6})$/);
      if (delay) {
        await sleep(Number(delay[1]));
        res.writeHead(204).end();
        return;
      }

      /* ── static files ────────────────────────────────────── */
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const target = join(base, normalize(pathname));
      if (!target.startsWith(base)) {
        res.writeHead(403).end("forbidden");
        return;
      }

      const info = await stat(target).catch(() => null);
      if (!info || !info.isFile()) {
        const notFound = join(base, "404.html");
        const nf = await stat(notFound).catch(() => null);
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        if (nf) createReadStream(notFound).pipe(res);
        else res.end("<h1>404</h1>");
        return;
      }

      const type = TYPES[extname(target).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });

      /* splice the harness rules into HTML on the way out */
      if ((harness || flat) && type.startsWith("text/html")) {
        let html = await readFile(target, "utf8");
        const parts = [];
        if (harness) parts.push(HARNESS_CSS);
        if (flat) parts.push(FLAT_CSS);
        /* index.html carries its own reporter; every other page borrows this one */
        if (harness && !/send\("HARNESS"\)/.test(html)) parts.push(HARNESS_JS);
        if (parts.length) html = html.replace("</head>", `${parts.join("")}</head>`);
        res.end(html);
        return;
      }

      createReadStream(target).pipe(res);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
}

/** Bind to a port; 0 picks a free one. Resolves with the real port. */
export function listen(server, port = 0) {
  return new Promise((res, rej) => {
    server.once("error", rej);
    server.listen(port, "127.0.0.1", () => res(server.address().port));
  });
}

/* ── CLI ──────────────────────────────────────────────────── */
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const useDist = args.includes("--dist");
  const portArg = args.find((a) => /^\d+$/.test(a));
  const server = createServer({
    base: useDist ? join(ROOT, "dist") : ROOT,
    onDiag: (line) => console.log(`[diag] ${line}`),
  });
  const port = await listen(server, portArg ? Number(portArg) : 4173);
  console.log(`[serve] ${useDist ? "dist" : "source"} -> http://127.0.0.1:${port}/`);
}
