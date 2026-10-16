#!/usr/bin/env node
/**
 * build.mjs — static build for GitHub Pages.
 *
 *   node scripts/build.mjs            splice snapshot + bundle into dist/
 *   node scripts/build.mjs --no-splice  skip the project-marker splice
 *
 * Design rule: output filenames are IDENTICAL to source filenames, so
 * the HTML never needs rewriting. The only transform is minification.
 */

import { cp, mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

import { renderBlock, START, END } from "./render_projects.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const splice = !process.argv.includes("--no-splice");

/** Directories copied verbatim. */
const COPY_DIRS = ["assets/fonts", "assets/vendor", "assets/images", "assets/data"];

/** Root-level static files. */
const COPY_FILES = [
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "icon.svg",
  "favicon.ico",
  "apple-touch-icon.png",
  "blog.html",
  "404.html",
];

async function copyDir(rel) {
  const src = join(ROOT, rel);
  if (!existsSync(src)) return 0;
  const dst = join(DIST, rel);
  await mkdir(dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true });
  let n = 0;
  for (const entry of await readdir(src, { recursive: true })) {
    const p = join(src, entry);
    try {
      const stat = await import("node:fs").then((fs) => fs.promises.stat(p));
      if (stat.isFile()) n += 1;
    } catch {
      /* ignore transient entries */
    }
  }
  return n;
}

async function spliceProjects(html) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    console.log("[build] project markers not found — index.html passed through unchanged");
    return html;
  }
  const data = JSON.parse(await readFile(join(ROOT, "assets/data/repos.json"), "utf8"));
  const block = renderBlock(data.repos);
  return html.slice(0, start) + block + html.slice(end + END.length);
}

async function main() {
  const t0 = Date.now();
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  /* 1 · HTML (project block refreshed from the snapshot) */
  let index = await readFile(join(ROOT, "index.html"), "utf8");
  if (splice) index = await spliceProjects(index);
  await writeFile(join(DIST, "index.html"), index, "utf8");
  console.log("[build] index.html written" + (splice ? " (project block spliced)" : ""));

  /* 2 · CSS bundle — same filename, minified */
  await esbuild({
    entryPoints: [join(ROOT, "assets/css/site.css")],
    outfile: join(DIST, "assets/css/site.css"),
    bundle: true,
    minify: true,
    target: ["es2020"],
    legalComments: "none",
  });
  console.log("[build] assets/css/site.css bundled");

  /* 3 · JS bundle — one ESM request, same filename */
  await esbuild({
    entryPoints: [join(ROOT, "assets/js/site.js")],
    outfile: join(DIST, "assets/js/site.js"),
    bundle: true,
    format: "esm",
    minify: true,
    target: ["es2020"],
    legalComments: "none",
  });
  console.log("[build] assets/js/site.js bundled");

  /* 4 · static assets */
  for (const dir of COPY_DIRS) await copyDir(dir);
  for (const file of COPY_FILES) {
    const src = join(ROOT, file);
    if (existsSync(src)) await cp(src, join(DIST, file));
    else console.log(`[build] missing (skipped): ${file}`);
  }

  /* 5 · GitHub Pages must not run Jekyll over this */
  await writeFile(join(DIST, ".nojekyll"), "", "utf8");

  console.log(`[build] done in ${Date.now() - t0}ms -> dist/`);
}

main().catch((err) => {
  console.error("[build] FAILED:", err);
  process.exitCode = 1;
});
