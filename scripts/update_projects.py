#!/usr/bin/env python3
"""Auto-update the Projects section of index.html from the owner's public GitHub repos.

Reads the owner's public repositories via the GitHub REST API and regenerates
the grid between the PROJECTS:START / PROJECTS:END markers in index.html.

Runs as a GitHub Action (see .github/workflows/update-portfolio.yml) or locally.
"""

import html
import json
import os
import sys
import urllib.request

REPO_URL = "https://api.github.com/users/{user}/repos?per_page=100&sort=updated"
START = "<!-- PROJECTS:START -->"
END = "<!-- PROJECTS:END -->"
RECENT_START = "<!-- RECENT:START -->"
RECENT_END = "<!-- RECENT:END -->"

ICONS = {
    "python": "fa-robot",
    "javascript": "fa-bolt",
    "typescript": "fa-cubes",
    "html": "fa-code",
    "css": "fa-palette",
    "shell": "fa-terminal",
    "c++": "fa-cogs",
    "java": "fa-coffee",
    "go": "fa-rocket",
    "rust": "fa-crab",
}

DEFAULT_ICON = "fa-code"


def fetch_repos(user, token=None):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "portfolio-updater"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(REPO_URL.format(user=user), headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def pick_icon(language):
    if not language:
        return DEFAULT_ICON
    return ICONS.get(language.lower(), DEFAULT_ICON)


def card(repo):
    name = html.escape(repo["name"])
    desc = (repo.get("description") or "").strip()
    if not desc:
        desc = "Open-source project by Aleem Shahzad."
    if len(desc) > 150:
        desc = desc[:147].rstrip() + "..."
    desc = html.escape(desc)
    lang = html.escape(repo.get("language") or "Git")
    url = repo["html_url"]
    live = repo.get("homepage")
    live_html = (
        f'\n            <a class="btn-sm-outline" href="{html.escape(live)}" target="_blank" rel="noopener">Live</a>'
        if live
        else ""
    )
    icon = pick_icon(repo.get("language"))
    return (
        "        <article class=\"project-card\">\n"
        "          <div class=\"project-media bg-muted/30 w-full h-28 rounded-md flex items-center justify-center\">\n"
        f'            <i class="fas {icon} text-3xl text-accent" aria-hidden="true"></i>\n'
        "          </div>\n"
        f"          <h3 class=\"mt-3 font-semibold\">{name}</h3>\n"
        f"          <p class=\"text-sm text-muted mt-1\">{desc}</p>\n"
        "          <div class=\"mt-3 flex gap-2\">\n"
        f"            <span class=\"chip\">{lang}</span>\n"
        "          </div>\n"
        "          <div class=\"mt-3 flex gap-2\">\n"
        f'            <a class="btn-sm" href="{url}" target="_blank" rel="noopener">Code</a>{live_html}\n'
        "          </div>\n"
        "        </article>"
    )


def generate_block(repos):
    lines = [START, '      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">']
    lines.extend(card(r) for r in repos)
    lines.append("      </div>")
    lines.append(END)
    return "\n".join(lines)


def generate_recent(repos):
    lines = [RECENT_START, '          <ul class="mt-3 space-y-3 text-sm text-muted">']
    for repo in repos:
        name = html.escape(repo["name"])
        desc = (repo.get("description") or "").strip()
        if len(desc) > 60:
            desc = desc[:57].rstrip() + "..."
        desc = html.escape(desc) if desc else "Open-source project by Aleem Shahzad."
        lines.append(
            f'            <li><a class="link-primary" href="{repo["html_url"]}" target="_blank" rel="noopener">{name}</a> — {desc}</li>'
        )
    lines.append("          </ul>")
    lines.append(RECENT_END)
    return "\n".join(lines)


def main():
    user = os.environ.get("GH_USER") or "aleemshahad"
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    the_path = os.environ.get("THE_PATH", "index.html")

    repos = fetch_repos(user, token)
    repos = [r for r in repos if r["name"] != "portfolio" and not r["fork"]]
    repos.sort(key=lambda r: (r["stargazers_count"], r["pushed_at"]), reverse=True)
    repos = repos[:9]

    new_block = generate_block(repos)
    with open(the_path, encoding="utf-8") as fh:
        content = fh.read()

    def splice(content, s, e, new):
        start = content.index(s)
        end = content.index(e) + len(e)
        return content[:start] + new + content[end:]

    updated = splice(content, START, END, new_block)

    if RECENT_START in updated:
        updated = splice(updated, RECENT_START, RECENT_END, generate_recent(repos[:4]))

    if updated != content:
        with open(the_path, "w", encoding="utf-8") as fh:
            fh.write(updated)
        print(f"Updated index.html with {len(repos)} projects from {user}")
        return 0
    print("No changes needed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())