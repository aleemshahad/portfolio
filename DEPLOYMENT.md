# Deployment

The site publishes itself. Push to `main` and
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and
deploys. There is nothing to run by hand.

---

## One-time setup

1. **Enable Pages from Actions.**
   Repository → **Settings → Pages → Build and deployment → Source: GitHub
   Actions**. Pages stays off until this is set; the workflow will fail at the
   `configure-pages` step otherwise.

2. **Push to `main`.**
   The workflow runs on every push, on a daily schedule (`17 6 * * *`), and on
   manual dispatch.

3. **Confirm.**
   The `deploy` job prints a `page_url` in its environment summary:
   <https://aleemshahad.github.io/portfolio/>

---

## What the workflow does

| Step | Command | Why |
| --- | --- | --- |
| Install | `npm ci` | reproducible from `package-lock.json` |
| Sync | `node scripts/fetch_repos.mjs` | refreshes `assets/data/repos.json` from the GitHub API |
| Build | `npm run build` | splices the snapshot into `index.html`, bundles CSS and JS into `dist/` |
| Verify | `npm run verify` | refuses to publish a non-compliant artifact |
| Publish | `actions/upload-pages-artifact` → `deploy-pages` | pushes `dist/` to Pages |

The sync step is `continue-on-error`. If the API is rate-limited or down, the
snapshot committed in the repo is a valid fallback and the deploy still
happens. That is the whole point of committing `repos.json`.

`verify` is the opposite: it is a hard gate. Any failure blocks the deploy.

---

## Why the project list stays fresh without a bot commit

The previous workflow (`update-portfolio.yml`) generated the projects block,
committed it back to the repo, and pushed — a second commit every day, and a
merge conflict waiting to happen.

That is gone. `index.html` keeps the `PROJECTS:START` / `PROJECTS:END`
markers, the build splices fresh HTML between them at deploy time, and the
client re-renders from the live API on load with the built snapshot as the
offline fallback. The committed file never needs touching.

---

## Serving from a project subpath

The site lives at `/portfolio/`, not at the domain root. Every asset
reference in the HTML is therefore relative (`assets/css/site.css`, never
`/assets/css/site.css`). `verify` fails the build on any root-absolute
reference.

---

## Local parity

```bash
npm ci
npm run sync      # optional; needs network
npm run build
npm run serve:dist
npm run verify
```

`serve.mjs` also exposes the review harness, used by `scripts/shot.mjs`:

- `POST /_diag` — receives the page's error and metric reports
- `GET /__delay/N` — held open so a headless `load` wait outlasts the intro
- `?harness=1` — injects `scroll-behavior: auto` and the reporter (never shipped)
- `?flat=1` — collapses the viewport-height shells for a full-page capture (never shipped)

---

## If a deploy fails

| Failure | Fix |
| --- | --- |
| `configure-pages` errors | Pages source is not set to **GitHub Actions** |
| `verify` fails | Read the listed problems — they are the contract, not a suggestion |
| `sync` warns but deploy succeeds | Rate-limited; the committed snapshot was used. Normal |
| Fonts render as boxes | A glyph outside the subset was added. Use the SVG sprite |
