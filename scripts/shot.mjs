#!/usr/bin/env node
/**
 * shot.mjs — headless screenshot + page-error capture.
 *
 * Chromium SIGTRAPs on this host (proot syscall interception), so the
 * harness drives Firefox ESR directly — no Playwright, no Puppeteer:
 *
 *   node scripts/shot.mjs <route> <outfile> [width] [height] [full|reduce]
 *
 *   route    e.g. /index.html (served from the repo root, or dist/ with --dist)
 *   full     two passes: learn document scrollHeight, then re-shoot at that height
 *   reduce   launches Firefox with ui.prefersReducedMotion=1
 *
 * The page reports JS errors and its scroll height to POST /_diag, and
 * holds its own `load` event open until the intro has finished, so the
 * capture is of the settled page rather than frame one.
 *
 * Exit code 1 when the page logged an error or threw.
 */

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat as fs_stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer, listen } from "./serve.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIREFOX = process.env.FIREFOX_PATH || "/usr/bin/firefox-esr";

const args = process.argv.slice(2);
const useDist = args.includes("--dist");
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));

const route = positional[0] || "/index.html";
const outFile = positional[1];
const width = Number(positional[2]) || 1440;
const heightArg = Number(positional[3]) || 900;
const mode = positional[4] || "";
const full = mode === "full";
const reduce = mode === "reduce";

if (!outFile) {
  console.error("usage: node scripts/shot.mjs <route> <outfile> [w] [h] [full|reduce]");
  process.exit(2);
}

const problems = [];
let scrollHeight = 0;
let sawReady = false;
let sawHarness = false;
const metrics = new Map();

const server = createServer({
  base: useDist ? join(ROOT, "dist") : ROOT,
  onDiag: (line) => {
    if (/^(ERROR|REJECTION|CONSOLE)\b/.test(line)) problems.push(line);
    else if (line === "READY") sawReady = true;
    else if (line === "HARNESS") sawHarness = true;
    else {
      const m = line.match(/^METRIC ([^=]+)=(.*)$/);
      if (m) {
        metrics.set(m[1], m[2]);
        if (m[1] === "scrollHeight") scrollHeight = Number(m[2]);
      }
    }
  },
});
const port = await listen(server, 0);

async function makeProfile(withReducedMotion) {
  const dir = await mkdtemp(join(tmpdir(), "ff-profile-"));
  if (withReducedMotion) {
    await writeFile(
      join(dir, "user.js"),
      'user_pref("ui.prefersReducedMotion", 1);\nuser_pref("browser.shell.checkDefaultBrowser", false);\n',
      "utf8",
    );
  } else {
    await writeFile(
      join(dir, "user.js"),
      'user_pref("browser.shell.checkDefaultBrowser", false);\n',
      "utf8",
    );
  }
  return dir;
}

/**
 * The query string MUST be spliced in before any #fragment, otherwise the
 * browser treats `?diag=1` as part of the fragment and the page never sees
 * the flag — which silently kills every diagnostic report.
 */
function buildUrl() {
  const hash = route.indexOf("#");
  const path = hash === -1 ? route : route.slice(0, hash);
  const frag = hash === -1 ? "" : route.slice(hash);
  const params = ["diag=1", "harness=1"];
  /* a tall window would otherwise stretch `100svh` shells to fill it */
  if (full) params.push("flat=1");
  const qs = path.includes("?") ? "&" : "?";
  return `http://127.0.0.1:${port}${path}${qs}${params.join("&")}${frag}`;
}

/** Firefox can exit a beat before its final POST lands — give it time. */
const settle = () => new Promise((r) => setTimeout(r, 700));

function runFirefox(profileDir, targetHeight, dest) {
  return new Promise((res) => {
    const chromeLog = [];
    const proc = spawn(
      FIREFOX,
      [
        "--headless",
        "-no-remote",
        "-new-instance",
        `-profile`,
        profileDir,
        `--window-size=${width},${targetHeight}`,
        `--screenshot=${dest}`,
        buildUrl(),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    proc.stdout.on("data", (d) => chromeLog.push(d.toString()));
    proc.stderr.on("data", (d) => chromeLog.push(d.toString()));
    proc.on("close", (code) => res({ code, log: chromeLog.join("") }));
  });
}

try {
  const profile = await makeProfile(reduce);
  await mkdir(dirname(resolve(outFile)), { recursive: true });

  const first = await runFirefox(profile, heightArg, resolve(outFile));
  await settle();
  const firstShot = await fs_stat(resolve(outFile)).catch(() => null);
  if (!firstShot) {
    problems.push(`FIREFOX produced no screenshot (exit ${first.code}): ${first.log.split("\n").slice(-4).join(" | ")}`);
  }

  let shotHeight = heightArg;
  if (full && scrollHeight > 0) {
    /* +160px: scrollHeight is sampled at `load` and the GitHub project
       cards can still reflow a line once everything settles — a tight
       window would clip the footer. */
    shotHeight = Math.min(Math.max(scrollHeight + 160, heightArg), 30000);
    if (shotHeight !== heightArg) {
      const second = await runFirefox(profile, shotHeight, resolve(outFile));
      await settle();
      if (second.code !== 0) problems.push(`FIREFOX pass 2 exited ${second.code}`);
    }
  }

  await rm(profile, { recursive: true, force: true }).catch(() => {});

  const label = reduce ? ", reduced-motion" : full ? ", full page" : "";
  console.log(`OK ${outFile} (${width}x${shotHeight}${label})`);
  console.log(
    `diag: ${problems.length ? "reported" : "clean"} · harness=${sawHarness} · ready=${sawReady} · scrollHeight=${scrollHeight || "unknown"}`,
  );
  if (metrics.size) {
    const extra = [...metrics].map(([k, v]) => `${k}=${v}`).join(" · ");
    console.log(`metrics: ${extra}`);
  }

  if (!sawHarness) problems.push("page never reported the diag flag — harness did not run (check ?diag=1 reached the page)");

  const unique = [...new Set(problems.map((p) => p.trim()))];
  if (unique.length) {
    console.log("PROBLEMS:");
    for (const p of unique) console.log("  - " + p.slice(0, 400));
    process.exitCode = 1;
  } else {
    console.log("PROBLEMS: none");
  }
} catch (err) {
  console.error("SHOT FAILED:", err.message);
  process.exitCode = 1;
} finally {
  server.close();
}
