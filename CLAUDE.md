# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The static landing page for Cold Development / padrewin, served at https://cold-development.github.io. Plain HTML, CSS and vanilla JS: no package manager, no build step, no tests. Everything lives in `index.html` and `assets/`.

## Running it locally

```sh
python3 -m http.server 8765   # then open http://localhost:8765/
```

Serve over HTTP rather than opening the file directly: fonts load via relative `url()` and the clipboard API needs a real origin. To check a change visually, screenshot it with Playwright in both `colorScheme: 'light'` and `'dark'`, at desktop (1440px) and phone (390px) widths, and confirm `document.documentElement.scrollWidth` equals the viewport width (no sideways scroll).

## Deploy pipeline (read before touching `index.html` markup or asset links)

- The live site is served from the **`gh-pages`** branch, not `master`. `.github/workflows/deploy.yml` runs on every push to `master` (or by hand via `workflow_dispatch`) and publishes the repo root to `gh-pages` with `peaceiris/actions-gh-pages`, authenticated by the `WEBSITE_AUTH` secret. `.github/`, `.claude/`, `CLAUDE.md` and `DESIGN.md` are excluded from the published files (add any other repo-only file to `exclude_assets`).
- Before publishing, the workflow rewrites `index.html` with `sed`:
  - The literal text `@loading...` (inside `<span id="commit-hash">`) is replaced with a link to the deployed commit. Keep that exact string, three ASCII dots included, and keep it inside a `<span>`, not an `<a>`, or the output gets nested anchors.
  - Every `?v=<anything>` on an asset URL is replaced with the short commit hash, which is how caches get busted. Any new CSS/JS reference needs a `?v=` suffix to get this; the local values (`?v=3.3` and so on) don't matter.
- The workflow deliberately has no `schedule:` trigger. GitHub auto-disables workflows that have one after 60 days of repo inactivity, and that also silently stopped the push deploy. Don't add one back.

## Architecture

The visual system (the "frozen window" idea, tokens, type, motion rules) is documented in `DESIGN.md`; read it before changing the look.

- **`assets/backend/style.css`**: all styling. Design tokens are custom properties on `:root`; dark mode overrides them inside `@media (prefers-color-scheme: dark)`. Add new colours as tokens with values for both themes, never as one-off literals. The `--scene-*` and `--frost-*` tokens are read by `ice.js`, so canvas colours are changed in CSS too. `:root` declares `color-scheme: light dark`, and `index.html` has `darkreader-lock` / `supported-color-schemes` meta tags: these keep Dark Reader and Noir from forcing their own dark mode, so keep them. The `cdicon`/`pwicon` logos are white-on-transparent and get recoloured by CSS in light mode.
- **`assets/backend/ice.js`**: the single fixed background canvas `.ice`, drawn once per size/colour scheme and never animated. It renders the lake ice offscreen as vectors (exact Voronoi cells by bisector clipping, hairlines, cracks, bubbles), then paints only a heavily blurred copy of it plus a frost veil, grain and a few corner crystals. It does not listen to the pointer; that is deliberate (see `DESIGN.md`).
- **`assets/backend/script.js`**: the console greeting, the Bucharest clock in the top bar (`Intl.DateTimeFormat`, `Europe/Bucharest`), and copy-to-clipboard buttons. Any element with `data-copy="text"` copies that text and gets a `.copied` class for 1.4s (CSS swaps the copy icon for a check), while an optional `.copy-label` child shows "copied!". It falls back to `execCommand('copy')` outside secure contexts (the same behaviour as padre.colddev.dev).
- **Fonts**: self-hosted in `assets/font/`. `geist.woff2` (variable weight) is the only typeface in use. `coldfont.woff2` is the old brand font and is currently unused.

## Design skills

Project skills for design work are installed in `.claude/skills/`: `frontend-design` (Anthropic), `impeccable` (pbakaus/impeccable), `taste-skill` and `redesign-skill` (Leonxlnx/taste-skill), and `web-design-guidelines` (Vercel). Impeccable's `scripts/impeccable` launcher downloads a binary on first run; it has not been run in this repo, and its "launcher unavailable" path (read the project context directly) works without it.

## Conventions

- Keep it quiet: no pointer-driven effects on the background or headline, and motion limited to the load settle-in and control feedback. Animate only `transform` and `opacity`; no `filter: blur()` on full-viewport layers.
- Every animation and transition must switch off under `prefers-reduced-motion` (the global rule at the end of `style.css` handles CSS; JS-driven motion would need its own check).
- Link rows are `<a class="row">`; actions such as copying use `<button class="row row--copy">` with the same styling. Icons are inline Phosphor SVGs with `aria-hidden="true"`; don't use Unicode glyphs as icons. Images keep explicit `width`/`height`.
