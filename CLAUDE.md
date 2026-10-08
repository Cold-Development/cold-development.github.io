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

- The live site is served from the **`gh-pages`** branch, not `master`. `.github/workflows/deploy.yml` runs on every push to `master` (or by hand via `workflow_dispatch`) and publishes the repo root to `gh-pages` with `peaceiris/actions-gh-pages`, authenticated by the `WEBSITE_AUTH` secret. `.github/` and `CLAUDE.md` are excluded from the published files (add any other repo-only file to `exclude_assets`).
- Before publishing, the workflow rewrites `index.html` with `sed`:
  - The literal text `@loading...` (inside `<span id="commit-hash">`) is replaced with a link to the deployed commit. Keep that exact string, three ASCII dots included, and keep it inside a `<span>`, not an `<a>`, or the output gets nested anchors.
  - Every `?v=<anything>` on an asset URL is replaced with the short commit hash, which is how caches get busted. Any new CSS/JS reference needs a `?v=` suffix to get this; the local values (`?v=3.3` and so on) don't matter.
- The workflow deliberately has no `schedule:` trigger. GitHub auto-disables workflows that have one after 60 days of repo inactivity, and that also silently stopped the push deploy. Don't add one back.

## Architecture

- **`assets/backend/style.css`**: all styling. Design tokens are custom properties on `:root`; dark mode overrides them inside `@media (prefers-color-scheme: dark)`. Add new colours as tokens with values for both themes, never as one-off literals. `:root` declares `color-scheme: light dark`, and `index.html` has `darkreader-lock` / `supported-color-schemes` meta tags: these keep Dark Reader and Noir from forcing their own dark mode, so keep them. The `cdicon`/`pwicon` logos are white-on-transparent and get inverted by CSS in light mode.
- **`assets/backend/frost.js`**: the freezing/thawing window-frost background. It draws ice crystals on the fixed `.frost-canvas` in a loop (freeze → hold → thaw → rest; timings are constants at the top) and drives the `.frost-fog` edge haze's opacity. The line colour comes from the CSS token `--frost-line` and is re-read when the colour scheme changes. Under `prefers-reduced-motion` it draws one static frame instead. The background layers (`.frost` blooms, `.frost-fog`, `.frost-canvas`) sit at `z-index: -1` behind `.page`.
- **`assets/backend/script.js`**: the console greeting, the Bucharest clock in the top bar (`Intl.DateTimeFormat`, `Europe/Bucharest`), and copy-to-clipboard buttons. Any element with `data-copy="text"` copies that text; optional `.copy-label` / `.copy-icon` children swap to "copied!" / ✓ for 1.4s. It falls back to `execCommand('copy')` outside secure contexts (the same behaviour as padre.colddev.dev).
- **Fonts**: both self-hosted in `assets/font/`. `geist.woff2` (Geist, variable weight) is the display/body sans-serif; `coldfont.woff2` (`CustomFont`) is the brand mono, used for small labels.

## Conventions

- Performance: don't put `filter: blur()` on animated or full-viewport layers. A blurred background was the main per-frame cost (it dropped the page to about 25fps); soft edges come from radial gradients fading to `transparent`. Animate only `transform` and `opacity`.
- Every animation and transition must switch off under `prefers-reduced-motion` (the global rule at the end of `style.css` handles CSS; JS effects need their own check, as in `frost.js`).
- Link rows are `<a class="link">`; actions such as copying use `<button class="link link--copy">` with the same row styling. Decorative glyphs get `aria-hidden="true"`, and images keep explicit `width`/`height`.
