# Cold Development (cold-development.github.io)

Pagina personală a lui padrewin / Cold Development: un hub cu link-uri spre proiecte (GitHub, SpigotMC, BuiltByBit, Maven repo, Jenkins) și username-ul de Discord. Vizitatorul trebuie să ajungă rapid la unul dintre ele.

## Stack
- HTML + CSS + JS simplu, fără build. `index.html`, `assets/css/site.css`, `assets/js/site.js`.
- Font self-hosted în `assets/fonts/` (Onest).
- Lista de proiecte vine live din GitHub API (`/orgs/Cold-Development/repos`).
- Dev: `python3 -m http.server 8000` (fonturile nu se încarcă din `file://`).
- Deploy: `.github/workflows/deploy.yml` publică pe `gh-pages` la push pe `master` și înlocuiește `@loading...` cu hash-ul commit-ului. Placeholder-ul trebuie să rămână în HTML.

## Direcție vizuală
Vezi `DESIGN.md`. Pe scurt: site de studio curat, navy închis și lumină rece, cu un fulg de nea procedural în hero. Nu se schimbă fără să ceri.

## Motion
- Un singur moment orchestrat: fulgul se desenează din centru. Restul e feedback la acțiuni.
- Animă doar `transform`, `opacity`, `filter`, `clip-path`. Hover 150–220ms, press `scale(0.97–0.985)`.
- Respectă `prefers-reduced-motion`.

## Workflow
1. După orice schimbare vizuală: screenshot cu Playwright pe desktop (1440px) și mobil (390px).
2. Înainte de livrare: `/impeccable critique`, `/impeccable polish`, apoi audit de motion (design-motion-principles, modul Audit).
