#!/usr/bin/env node
/**
 * render_projects.mjs — turn assets/data/repos.json into the static
 * HTML block that lives between PROJECTS:START / PROJECTS:END markers
 * in index.html. The build splices this so the no-JS render and the
 * offline fallback are never stale.
 *
 * The live page re-renders the same markup from the GitHub API at
 * runtime (assets/js/projects.js) — same shape, one source of truth.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const START = "<!-- PROJECTS:START -->";
export const END = "<!-- PROJECTS:END -->";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FALLBACK_DESC = "Public repository. Source, README and issues live on GitHub.";

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function renderCard(repo, index) {
  const featured = index === 0 ? " project--featured" : "";
  const desc = repo.description || FALLBACK_DESC;
  const lang = repo.language || "Git";
  const date = fmtDate(repo.updated);
  const live = repo.homepage
    ? `\n            <a class="project__live" href="${esc(repo.homepage)}" target="_blank" rel="noopener nofollow">Live<span class="vh"> demo of ${esc(repo.name)}</span></a>`
    : "";

  return `        <article class="project${featured}" data-repo="${esc(repo.name)}">
          <div class="project__top">
            <span class="project__lang">${esc(lang)}</span>
            <span class="project__arrow" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 11 11 5M6 5h5v5"/></svg>
            </span>
          </div>
          <h3 class="project__name"><a href="${esc(repo.url)}" target="_blank" rel="noopener">${esc(repo.name)}<span class="vh"> on GitHub</span></a></h3>
          <p class="project__desc">${esc(desc)}</p>
          <div class="project__foot">
            <span class="project__meta"><span class="project__stars"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m8 2.5 1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.2 4.6 13l.7-3.8L2.5 6.5l3.8-.5z"/></svg>${repo.stars}</span>${date ? `<span class="project__dot" aria-hidden="true">·</span><span>upd ${date}</span>` : ""}</span>
            <span class="project__links">${live}</span>
          </div>
        </article>`;
}

export function renderBlock(repos) {
  return [START, '      <div class="projects" data-projects>', ...repos.map(renderCard), "      </div>", END].join("\n");
}

async function main() {
  const raw = await readFile(resolve(ROOT, "assets/data/repos.json"), "utf8");
  const data = JSON.parse(raw);
  process.stdout.write(renderBlock(data.repos));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
