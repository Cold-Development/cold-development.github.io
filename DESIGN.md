# DESIGN.md

The visual system of cold-development.github.io: a frozen window.

## Idea

The page is a pane of frosted glass in front of cracked lake ice. The content sits on the glass; one slab of clear ice holds the links. Frost forms from the window frame inward on load, the visitor's cursor (or tap) wipes it clear to show the sharp ice behind, and it slowly freezes back over. The headline does the same in type: it freezes from melted to solid on load.

Glass and blur have one job here (a window you can see through once you wipe it), not decoration. Don't add more glass panes; one slab is the point.

## Layers (back to front)

1. `.ice-scene` canvas: lake ice. Voronoi slabs shaded from `--scene-deep` to `--scene-mid`, main cracks plus a net of hairline fractures in `--scene-crack`, a few air bubbles. Rendered once per size/theme.
2. `.ice-frost` canvas: frost. A blurred copy of the scene, tinted with `--frost-tint` (thicker toward the frame), a grain tile, and fern crystals in `--frost-crystal`. The wipe map erases it; it refreezes at about 30% per second.
3. Content: headline and lede directly on the frost; the link slab is glass (`backdrop-filter: blur(22px) saturate(160%)`).

## Tokens

| Role | Light (glacier at noon) | Dark (polar night) |
|---|---|---|
| `--ink` text | `#062438` | `#e9f8ff` |
| `--body` secondary text | `#24485f` | `#b3d6e8` |
| `--mute` labels, meta | `#4d6e82` | `#7fa3b7` |
| `--accent` meltwater, hover/focus/copied | `#0a6f9c` | `#86dcff` |
| `--glass` slab fill | `rgba(236,248,255,.5)` | `rgba(6,28,44,.46)` |
| `--scene-deep` / `--scene-mid` | `#4f9fcb` / `#a6d8f0` | `#020a12` / `#0e3b59` |

One accent only. Shadows are tinted with the scene hue and always have a y-offset; no black or zero-offset glows.

## Type

- **Display:** Climate Crisis (self-hosted, `assets/font/climate-crisis.woff2`). Its `YEAR` axis comes from Arctic sea-ice data: 1979 is solid, 2050 is melted. The headline animates `YEAR` 2050 → 1979 once on load (`@keyframes freeze`). Max size 6rem, tracking -0.035em, lowercase. The "zzz" inside "free…ing" is three text z's in the accent colour, rising in size and height and bobbing in turn (`@keyframes snore`).
- **Body / UI:** Geist variable (`assets/font/geist.woff2`). Row names 550 weight, meta 14px with tabular numerals.
- No monospace, no all-caps labels, no eyebrow above the headline.

## Shape and motion

- Radii: slab 22px, rows 12px (inner tighter than outer).
- Rows are separated by etched 1px lines (`--etch`), not cards.
- Icons: Phosphor (regular) arrow-up-right, copy, check, inlined as SVG with `fill: currentColor`.
- Motion: the one authored moment is the load (frost forming + headline freezing, ~2.5s, ease-out). Everything else answers the visitor: the wipe, row hover, the copy confirmation. All of it turns off under `prefers-reduced-motion` (static frost, solid headline).
- `prefers-reduced-transparency` or no `backdrop-filter` support: the slab becomes solid `--glass-solid`.
