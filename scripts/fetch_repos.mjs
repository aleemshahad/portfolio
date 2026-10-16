#!/usr/bin/env node
/**
 * fetch_repos.mjs — pull the owner's public repositories and write
 * assets/data/repos.json (the offline / rate-limit fallback for the
 * client-side renderer, and the source the build splices into HTML).
 *
 * Run by CI before `npm run build`. Locally optional.
 * Env: GH_USER (default aleemshahad), GITHUB_TOKEN (optional).
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets/data/repos.json");

const USER = process.env.GH_USER || "aleemshahad";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const SITE_REPO = "portfolio"; // the site you are looking at is not a project card
const LIMIT = 9;

/**
 * The subset font (SpaceGrotesk.woff2) only carries U+0020-00FF plus a
 * short list of punctuation. GitHub descriptions routinely contain
 * arrows and bullets that would render as tofu boxes, so every string
 * is normalised on the way in. Mirrors sanitizeText() in assets/js/core.js.
 */
const GLYPH_FIXUPS = [
  [/\u2194|\u21C4|\u21C6/g, "to"],
  [/\u2192|\u27F6/g, "to"],
  [/\u2190|\u27F5/g, "to"],
  [/[\u2713\u2714]/g, ""],
  [/\u25B8|\u25AA|\u25CF|\u25E6|\u2022|\u2023/g, ""],
  [/\u203A|\u00BB/g, ">"],
  [/\u2039|\u00AB/g, "<"],
  [/\u2605|\u2606/g, ""],
  [/\u200B|\u200C|\u200D|\uFEFF/g, ""],
];

function sanitizeText(value) {
  let out = String(value ?? "");
  for (const [re, to] of GLYPH_FIXUPS) out = out.replace(re, to);
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** Repo fields the client renderer is allowed to depend on. */
function normalise(r) {
  // a description that just repeats the repo name is not a description
  const name = sanitizeText(r.name);
  const desc = sanitizeText(r.description);
  const description = desc && desc.toLowerCase() !== name.toLowerCase() ? desc : null;
  return {
    name,
    description,
    language: sanitizeText(r.language) || null,
    stars: r.stargazers_count || 0,
    url: r.html_url,
    homepage: r.homepage || null,
    updated: r.pushed_at || r.updated_at || null,
    topics: Array.isArray(r.topics) ? r.topics.slice(0, 4).map(sanitizeText).filter(Boolean) : [],
  };
}

/** Drop shells that would render as an empty card. */
function isProject(r) {
  if (r.fork || r.private) return false;
  if (r.name === SITE_REPO) return false;   // the site you are on
  if (r.name === USER) return false;        // profile README, not a project
  return Boolean(r.language || (r.description || "").trim());
}

async function main() {
  const url = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&type=owner`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "nexus-portfolio-build",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  let raw;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    raw = await res.json();
  } catch (err) {
    console.error(`[fetch_repos] FAILED: ${err.message}`);
    console.error("[fetch_repos] Keeping the existing snapshot if one exists.");
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(raw)) {
    console.error("[fetch_repos] Unexpected payload from GitHub API.");
    process.exitCode = 1;
    return;
  }

  const repos = raw
    .filter(isProject)
    .sort((a, b) => new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at))
    .slice(0, LIMIT)
    .map(normalise);

  if (repos.length === 0) {
    console.error("[fetch_repos] Zero usable repos returned — refusing to overwrite the snapshot.");
    process.exitCode = 1;
    return;
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ user: USER, fetchedAt: new Date().toISOString(), count: repos.length, repos }, null, 2) + "\n",
    "utf8",
  );
  console.log(`[fetch_repos] wrote ${repos.length} repos -> ${OUT}`);
  for (const r of repos) console.log(`  - ${r.name} (${r.language || "-"}, ${r.stars}*)`);
}

await main();
