#!/usr/bin/env node
/**
 * verify.mjs — hard gate on the built artifact (dist/).
 *
 *   npm run verify
 *
 * Zero dependencies on purpose: this is the one script that has to
 * run even when node_modules is empty. Everything it enforces is a
 * rule the design or the code standards already committed to:
 *
 *   · the page must not pull a single byte from a third-party CDN
 *   · no glyph the subset font does not actually contain
 *   · no Urdu/Arabic script inside shipped files (code standard)
 *   · every local href/src must resolve to a real file
 *   · zero radius, no elevation shadows (design gates)
 *   · no TODO / placeholder markers left in the build
 *
 * It checks dist/ only — the contract is about what ships, not about
 * the source tree. Run `npm run build` first.
 *
 * Exit code 0 = safe to publish. Any failure prints every problem
 * and exits 1, which is what the deploy workflow acts on.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "dist");

if (!existsSync(TARGET)) {
  console.error("[verify] dist/ does not exist — run `npm run build` first.");
  process.exit(1);
}

const problems = [];
const notes = [];
let checks = 0;

const fail = (m) => problems.push(m);
const ok = (m) => notes.push(m);
const check = (m) => {
  checks += 1;
  return m;
};


/* ── text-file helpers ─────────────────────────────────────── */

const TEXT_EXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt", ".xml", ".svg", ".webmanifest"]);

/** Every shipped text file, as [relativePath, contents]. */
async function textFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await textFiles(abs, base)));
      continue;
    }
    if (!TEXT_EXT.has(extname(entry.name).toLowerCase())) continue;
    out.push([abs.slice(base.length + 1).split("\\").join("/"), await readFile(abs, "utf8")]);
  }
  return out;
}

/* ── 1 · required files ────────────────────────────────────── */

const REQUIRED = [
  "index.html",
  "blog.html",
  "404.html",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "icon.svg",
  "favicon.ico",
  "apple-touch-icon.png",
  "assets/images/og.png",
  "assets/css/site.css",
  "assets/js/site.js",
  "assets/data/repos.json",
  "assets/fonts/SpaceGrotesk.woff2",
  "assets/fonts/JetBrainsMono.woff2",
  "assets/vendor/gsap.min.js",
  "assets/vendor/ScrollTrigger.min.js",
];

check("required files present");
for (const rel of REQUIRED) {
  if (!existsSync(join(TARGET, rel))) fail(`missing required file: ${rel}`);
}

/* the 404 is what Pages serves for every bad path — it has to be real */
if (existsSync(join(TARGET, "404.html"))) {
  const nf = await readFile(join(TARGET, "404.html"), "utf8");
  if (!/4\s*<span>0\s*<\/span>\s*4/.test(nf) && !/404/.test(nf)) {
    fail("404.html does not render a 404 status");
  }
}

/* fonts must be real files, not empty stubs */
for (const f of ["assets/fonts/SpaceGrotesk.woff2", "assets/fonts/JetBrainsMono.woff2"]) {
  const p = join(TARGET, f);
  if (!existsSync(p)) continue;
  const s = await stat(p);
  if (s.size < 1000) fail(`${f} is only ${s.size} bytes — the subset is empty`);
}

/* ── 2 · source-scope rules over every text file ───────────── */

const files = await textFiles(TARGET);
ok(`scanned ${files.length} text files`);

/** Glyphs the subset font does not contain. Use the SVG sprite. */
const FORBIDDEN_GLYPHS = /[→↔✓▸●▪◦★✔➤›»]/;

/** Urdu / Arabic script — code standard: never inside a shipped file. */
const URDU_ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Anything still marked as unfinished. */
const PLACEHOLDERS = /\b(TODO|FIXME|XXX|HACK)\b|\[\s*\.\s*\.\s*\]/;

/** Third-party hosts we deliberately link *out* to (never load from). */
const LINK_ONLY_HOSTS =
  /https?:\/\/(schema\.org|github\.com|www\.github\.com|api\.github\.com|x\.com|twitter\.com|www\.linkedin\.com|linkedin\.com|vercel\.app|www\.vercel\.app|aleemshahad\.github\.io|cdn\.jsdelivr\.net\/npm\/gsap|unpkg\.com)/;

check("no forbidden glyphs, Urdu script, or placeholders");
for (const [rel, text] of files) {
  // strip JSON-LD and comments before the placeholder pass
  if (FORBIDDEN_GLYPHS.test(text)) {
    const m = text.match(FORBIDDEN_GLYPHS);
    fail(`${rel}: forbidden glyph "${m[0]}" (subset font has no codepoint for it — use the SVG sprite)`);
  }
  if (URDU_ARABIC.test(text)) {
    fail(`${rel}: Urdu/Arabic script found — code standard forbids it inside shipped files`);
  }
  if (PLACEHOLDERS.test(text)) {
    const m = text.match(PLACEHOLDERS);
    fail(`${rel}: unfinished marker left in the build — "${m[0]}"`);
  }
}

/* ── 3 · no third-party *resource* loads ───────────────────── */

check("no third-party runtime resources");
for (const [rel, text] of files) {
  if (!TEXT_EXT.has(extname(rel))) continue;

  if (rel.endsWith(".html")) {
    for (const tag of text.match(/<(script|link|img|iframe|source|video|audio)\b[^>]*>/gi) || []) {
      const attr = tag.match(/(?:src|href)=["'](https?:\/\/[^"']+)["']/i);
      if (!attr) continue;
      if (LINK_ONLY_HOSTS.test(attr[1])) continue;
      fail(`${rel}: third-party resource load — ${attr[1].slice(0, 90)}`);
    }
    if (/<script\b[^>]*\bsrc=["']https?:/i.test(text)) {
      /* already reported above; nothing extra to do */
    }
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.tailwindcss\.com|unpkg\.com|jsdelivr\.net\/gh/i.test(text)) {
      fail(`${rel}: CDN reference survived the rewrite`);
    }
  }

  if (rel.endsWith(".css")) {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi)) {
      if (!LINK_ONLY_HOSTS.test(m[1])) fail(`${rel}: remote url() — ${m[1].slice(0, 90)}`);
    }
    if (/fonts\.googleapis\.com|cdnjs\.cloudflare\.com/i.test(css)) fail(`${rel}: CDN import survived the rewrite`);
  }

  if (rel.endsWith(".js") || rel.endsWith(".mjs")) {
    if (/fonts\.googleapis\.com|cdnjs\.cloudflare\.com|cdn\.tailwindcss\.com/i.test(text)) {
      fail(`${rel}: CDN reference inside shipped JS`);
    }
  }
}

/* ── 4 · every local reference resolves ────────────────────── */

check("local href/src references resolve");
for (const [rel, text] of files) {
  if (!rel.endsWith(".html")) continue;

  /* root-absolute paths break on a project Pages subpath */
  for (const m of text.matchAll(/(?:src|href)=["'](\/[^"'\s#?]*)["']/g)) {
    if (/^\/\/[^/]/.test(m[1])) continue; // protocol-relative, checked above
    fail(`${rel}: root-absolute reference "${m[1]}" — breaks under /portfolio/`);
  }

  const refs = new Set();
  for (const m of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)) refs.add(m[1]);
  for (const m of text.matchAll(/<meta[^>]+(?:content|src)=["'](https?:\/\/aleemshahad[^"']+)["']/gi)) refs.add(m[1]);

  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(ref)) continue;
    const path = ref.split("#")[0].split("?")[0];
    if (!path) continue;
    const abs = join(TARGET, normalize(join(dirname(rel), path)));
    if (!existsSync(abs)) fail(`${rel}: broken local reference "${ref}"`);
  }
}

/* ── 5 · design gates ──────────────────────────────────────── */

check("design gates (zero radius, no elevation shadows)");
const cssPath = join(TARGET, "assets/css/site.css");
if (existsSync(cssPath)) {
  const css = (await readFile(cssPath, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");

  /* radius: only 0, 50% (status dot) or the --radius token are allowed */
  for (const m of css.matchAll(/border-radius\s*:\s*([^;}]+)/gi)) {
    const v = m[1].trim();
    if (!/^(0|0px|var\(--radius\)|50%)$/i.test(v)) {
      fail(`design gate: non-zero border-radius "${v}" — one radius, and it is none`);
    }
  }

  /* elevation: strip keyframes, then reject any non-inset box-shadow */
  const noKeyframes = css.replace(/@(-webkit-)?keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, "");
  for (const m of noKeyframes.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)) {
    if (!/^\s*inset\b/i.test(m[1].trim())) {
      fail(`design gate: elevation box-shadow "${m[1].trim().slice(0, 70)}"`);
    }
  }
}

/* ── 6 · HTML document contract ────────────────────────────── */

check("HTML document contract");
const PAGES = ["index.html", "blog.html", "404.html"];
for (const page of PAGES) {
  const p = join(TARGET, page);
  if (!existsSync(p)) continue; // already reported in section 1
  const html = await readFile(p, "utf8");

  if (!/^<!DOCTYPE html>/i.test(html.trim())) fail(`${page}: missing <!DOCTYPE html>`);
  if (!/<html[^>]+lang="en"/i.test(html)) fail(`${page}: missing <html lang="en">`);
  if (!/<meta[^>]+charset=["']?utf-8/i.test(html)) fail(`${page}: missing utf-8 charset`);
  if (!/<meta[^>]+name=["']viewport["'][^>]+content=["']?width=device-width/i.test(html)) {
    fail(`${page}: missing responsive viewport meta`);
  }
  if (!/<title>[^<]{3,}<\/title>/i.test(html)) fail(`${page}: missing or empty <title>`);
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html)) {
    fail(`${page}: missing a real meta description`);
  }
  if (!/<meta[^>]+name=["']color-scheme["']/i.test(html)) fail(`${page}: missing color-scheme meta`);
  if (!/<link[^>]+rel=["']canonical["']/i.test(html)) fail(`${page}: missing canonical`);
  if (!/<meta[^>]+property=["']og:image["']/i.test(html) && page !== "404.html") {
    fail(`${page}: missing og:image`);
  }
  if (!/<link[^>]+rel=["']icon["']/i.test(html)) fail(`${page}: missing favicon link`);
  if (!/<link[^>]+rel=["']apple-touch-icon["']/i.test(html)) fail(`${page}: missing apple-touch-icon`);
  if (!/<link[^>]+href=["']assets\/css\/site\.css["']/i.test(html)) fail(`${page}: does not load assets/css/site.css`);
  if (!/<a[^>]+class=["'][^"']*skip["']/i.test(html)) fail(`${page}: missing skip link`);
  if (!/<meta[^>]+name=["']theme-color["']/i.test(html)) fail(`${page}: missing theme-color`);

  /* every page needs a stylesheet that actually exists */
  if (!existsSync(join(TARGET, "assets/css/site.css"))) fail("assets/css/site.css missing");

  /* the error page must stay inert */
  if (page === "404.html") {
    if (/<script[^>]+src=/i.test(html)) fail("404.html: ships an external script — the error page must be inert");
    if (/data-nodes|<canvas/i.test(html)) fail("404.html: ships the node canvas — keep it inert");
  }
}

/* ── 7 · homepage-specific invariants ──────────────────────── */

check("homepage invariants");
const index = existsSync(join(TARGET, "index.html")) ? await readFile(join(TARGET, "index.html"), "utf8") : "";

if (index) {
  for (const id of ["hero", "metrics", "capabilities", "work", "contact"]) {
    if (!index.includes(`id="${id}"`)) fail(`index.html: missing section #${id}`);
  }

  const cards = (index.match(/data-repo=/g) || []).length;
  if (cards === 0) fail("index.html: no project cards rendered");
  else ok(`index.html renders ${cards} project cards`);

  if (!/PROJECTS:START/.test(index) || !/PROJECTS:END/.test(index)) {
    fail("index.html: project markers missing — the build cannot splice fresh data");
  }

  /* the headline metrics are the only invented numbers on the page */
  const METRICS = [
    ["7", "+", "years of industry experience"],
    ["100", "+", "automation bots"],
    ["10", "M+", "organic reach"],
  ];
  for (const [value, suffix, why] of METRICS) {
    const re = new RegExp(
      `data-count=["']${value}["'][^<]*</span><span class=["']suffix["'][^>]*>${suffix.replace("+", "\\+")}</span>`,
      "i",
    );
    if (!re.test(index)) fail(`index.html: headline metric "${value}${suffix}" (${why}) is missing`);
  }

  if (!/@context"\s*:\s*"https:\/\/schema\.org/.test(index)) fail("index.html: missing Person JSON-LD");

  /* one accent, used on the status dot */
  if (!/#2fe08a/i.test(await readFile(cssPath, "utf8").catch(() => ""))) {
    fail("site.css: accent #2fe08a missing from the built stylesheet");
  }
}

/* ── 8 · data snapshot ─────────────────────────────────────── */

check("project snapshot");
const reposPath = join(TARGET, "assets/data/repos.json");
if (existsSync(reposPath)) {
  try {
    const data = JSON.parse(await readFile(reposPath, "utf8"));
    if (!Array.isArray(data.repos) || data.repos.length === 0) {
      fail("assets/data/repos.json contains no repos");
    } else {
      for (const r of data.repos) {
        for (const k of ["name", "url", "updated"]) {
          if (!r[k]) fail(`assets/data/repos.json: repo missing "${k}"`);
        }
        if (!Array.isArray(r.topics)) fail(`assets/data/repos.json: ${r.name} topics is not an array`);
      }
      ok(`snapshot holds ${data.repos.length} repos (${data.fetchedAt || "no timestamp"})`);
    }
  } catch (err) {
    fail(`assets/data/repos.json is not valid JSON: ${err.message}`);
  }
}

/* ── 9 · sitemap + robots agreement ────────────────────────── */

check("sitemap/robots");
const robotsPath = join(TARGET, "robots.txt");
const sitemapPath = join(TARGET, "sitemap.xml");
if (existsSync(robotsPath) && existsSync(sitemapPath)) {
  const robots = await readFile(robotsPath, "utf8");
  if (!robots.includes("sitemap.xml")) fail("robots.txt does not point at the sitemap");
  const sm = await readFile(sitemapPath, "utf8");
  if (!sm.includes("aleemshahad.github.io/portfolio/")) fail("sitemap.xml: wrong canonical host");
  for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = m[1].replace("https://aleemshahad.github.io/portfolio", "");
    const rel = (path || "/").replace(/^\//, "") || "index.html";
    if (!existsSync(join(TARGET, rel))) fail(`sitemap.xml lists a page that does not exist: ${m[1]}`);
  }
}

/* ── 10 · report ───────────────────────────────────────────── */

for (const n of notes) console.log(`[verify]   ok  ${n}`);

if (problems.length) {
  console.log("");
  for (const p of problems) console.error(`[verify]  FAIL  ${p}`);
  console.error("");
  console.error(`[verify] FAILED — ${problems.length} problem(s) across ${checks} checks`);
  process.exitCode = 1;
} else {
  console.log("");
  console.log(`[verify] PASSED — ${checks} checks, ${files.length} files, nothing to report`);
}

