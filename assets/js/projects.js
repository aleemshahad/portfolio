/* =============================================================
   projects.js — live GitHub project registry.

   Three layers, in order of preference:
     1. GitHub REST API (what the section promises)
     2. assets/data/repos.json written by the build
     3. the static snapshot already in index.html
   The grid is never blanked — it is replaced only after the data
   is real, so a slow or blocked API costs nothing.
   ============================================================= */

import { qs, qsa, esc, sanitizeText, warn } from "./core.js";

const API =
  "https://api.github.com/users/aleemshahad/repos?per_page=100&sort=updated&type=owner";
const LOCAL = "assets/data/repos.json";
const SITE_REPO = "portfolio";
const OWNER = "aleemshahad";
const LIMIT = 9;
const TIMEOUT_MS = 7000;

const STAR_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m8 2.5 1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.2 4.6 13l.7-3.8L2.5 6.5l3.8-.5z"/></svg>';
const ARROW_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 11 11 5M6 5h5v5"/></svg>';

const isProject = (r) =>
  !r.fork &&
  !r.private &&
  r.name !== SITE_REPO &&
  r.name !== OWNER &&
  Boolean(r.language || (r.description || "").trim());

function normalise(r) {
  // the wire description can carry glyphs the subset font cannot draw
  const raw = sanitizeText(r.description);
  return {
    name: sanitizeText(r.name),
    description: raw && raw.toLowerCase() !== sanitizeText(r.name).toLowerCase() ? raw : null,
    language: sanitizeText(r.language),
    stars: r.stargazers_count || 0,
    url: r.html_url,
    homepage: r.homepage || null,
    updated: r.pushed_at || r.updated_at || null,
  };
}

function pick(list) {
  return list
    .filter(isProject)
    .sort((a, b) => new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at))
    .slice(0, LIMIT)
    .map(normalise);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function card(repo, index) {
  const featured = index === 0 ? " project--featured" : "";
  const langText = repo.language || "";
  /* No description -> say so plainly, and make the line specific to the
     repo so three description-less cards never read as copy-paste. */
  const desc = esc(
    repo.description ||
      (langText
        ? `No description yet. ${langText} code, README and issues live on GitHub.`
        : `No description yet. Source, README and issues live on GitHub.`),
  );
  const lang = langText
    ? `<span class="project__lang">${esc(langText)}</span>`
    : "";
  const date = fmtDate(repo.updated);
  const live = repo.homepage
    ? `<a class="project__live" href="${esc(repo.homepage)}" target="_blank" rel="noopener nofollow">Live<span class="vh"> demo of ${esc(repo.name)}</span></a>`
    : "";

  return `<article class="project rise${featured}" data-repo="${esc(repo.name)}">
          <div class="project__top">
            ${lang}
            <span class="project__arrow" aria-hidden="true">${ARROW_SVG}</span>
          </div>
          <h3 class="project__name"><a href="${esc(repo.url)}" target="_blank" rel="noopener">${esc(repo.name)}<span class="vh"> on GitHub</span></a></h3>
          <p class="project__desc">${desc}</p>
          <div class="project__foot">
            <span class="project__meta"><span class="project__stars">${STAR_SVG}${Number(repo.stars) || 0}</span>${
              date ? `<span class="project__dot" aria-hidden="true">&middot;</span><span>upd ${date}</span>` : ""
            }</span>
            <span class="project__links">${live}</span>
          </div>
        </article>`;
}

function setStatus(state, primary, secondary) {
  const host = qs("[data-projects-status]");
  if (!host) return;
  const [left, right] = qsa("span", host);
  if (left) {
    left.dataset.status = state;
    left.innerHTML = primary;
  }
  if (right) right.innerHTML = secondary;
}

const allReposLink =
  '<a href="https://github.com/aleemshahad?tab=repositories" target="_blank" rel="noopener">all repositories</a>';

async function getJSON(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function initProjects() {
  const host = qs("[data-projects]");
  if (!host) return null;

  setStatus("sync", "syncing with github&hellip;", `checking the public repositories &middot; ${allReposLink}`);

  let list = null;
  let source = "api";

  try {
    const payload = await getJSON(API, TIMEOUT_MS);
    if (!Array.isArray(payload) || !payload.length) throw new Error("empty payload");
    list = pick(payload);
    if (!list.length) throw new Error("no usable repos");
  } catch (apiErr) {
    warn("projects", "live API unavailable, trying the build snapshot", apiErr);
    try {
      const local = await getJSON(LOCAL, 4000);
      const repos = Array.isArray(local) ? local : local?.repos;
      if (!Array.isArray(repos) || !repos.length) throw new Error("empty snapshot");
      list = repos.slice(0, LIMIT);
      source = "snapshot";
    } catch (snapErr) {
      warn("projects", "snapshot unavailable — keeping the HTML already on the page", snapErr);
      setStatus(
        "error",
        "github unreachable",
        `showing the static snapshot &middot; ${allReposLink}`,
      );
      return { source: "html", count: qsa("[data-repo]", host).length };
    }
  }

  const markup = list.map(card).join("\n");
  host.innerHTML = markup;
  const cards = qsa("[data-repo]", host);

  const stamped = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (source === "api") {
    setStatus(
      "live",
      `live &middot; synced ${stamped}`,
      `${cards.length} repositories &middot; ${allReposLink}`,
    );
  } else {
    setStatus(
      "sync",
      "snapshot &middot; api rate limited",
      `${cards.length} repositories &middot; ${allReposLink}`,
    );
  }

  reveal(cards, host);
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();

  return { source, count: cards.length };
}

/* Only animate when motion is actually on and GSAP is present; in
   every other state the cards are already in their finished CSS. */
function reveal(cards, host) {
  const motionOn = document.documentElement.getAttribute("data-motion") === "on";
  const gsap = window.gsap;
  if (!motionOn || !gsap || !cards.length) return;

  gsap.to(cards, {
    opacity: 1,
    y: 0,
    duration: 0.55,
    ease: "power3.out",
    stagger: 0.05,
    overwrite: true,
    scrollTrigger: { trigger: host, start: "top 88%", once: true },
  });
}
