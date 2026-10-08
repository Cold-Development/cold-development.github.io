# DESIGN.md

The visual system of cold-development.github.io: a frozen window, kept quiet and professional.

## Idea

The page sits on a pane of frosted glass over cracked lake ice. The ice shows only as soft, diffused shapes through the frost; a few fine crystals grow in from the corners. One pane of clearer glass holds the links. Nothing reacts to the pointer except the controls themselves.

Earlier versions had pointer-driven effects (wiping the frost, cracking the ice on click, melting letters, a tilting slab). They were removed on purpose because they read as playful rather than professional; don't bring them back without asking.

## Layers (back to front)

1. `.ice` canvas (`ice.js`): the lake ice is drawn offscreen as vectors (Voronoi slabs, hairlines, cracks, bubbles in the `--scene-*` colours), then shown only as a heavily blurred copy under an even `--frost-tint` veil (thicker toward the frame), fine grain, and sparse fern crystals at the four corners in `--frost-crystal`. Drawn once per size and colour scheme.
2. Content: headline and lede directly on the frost; the link slab is glass (`backdrop-filter: blur(20px) saturate(150%)`), with a fixed light on its upper-left edge.

## Tokens

| Role | Light (glacier at noon) | Dark (polar night) |
|---|---|---|
| `--ink` text | `#062438` | `#e9f8ff` |
| `--body` secondary text | `#24485f` | `#b3d6e8` |
| `--mute` labels, meta | `#4d6e82` | `#7fa3b7` |
| `--accent` hover/focus/copied, the z's | `#0a6f9c` | `#86dcff` |
| `--glass` slab fill | `rgba(240,249,255,.55)` | `rgba(6,28,44,.5)` |
| `--scene-deep` / `--scene-mid` | `#4f9fcb` / `#a6d8f0` | `#020a12` / `#0e3b59` |

One accent only. Shadows are tinted with the scene hue and always have a y-offset.

## Type

- Geist variable (`assets/font/geist.woff2`) is the only typeface.
- Headline: 600 weight, up to 5.25rem, tracking -0.04em, lowercase. The "zzz" inside "free…ing" is three small static z's in the accent colour, rising in size and height like the 💤 emoji.
- Row names 550 weight; meta 14px with tabular numerals. No monospace, no all-caps labels, no eyebrow above the headline.

## Shape and motion

- Radii: slab 20px, rows 10px (inner tighter than outer). Rows are separated by etched 1px lines (`--etch`), not cards.
- Icons: Phosphor (regular) arrow-up-right, copy, check, inlined as SVG with `fill: currentColor`.
- Motion is limited to: one gentle settle-in on load (`@keyframes settle`), the row hover tint with a 2px arrow nudge, and the copy icon/label swap. All of it is off under `prefers-reduced-motion`.
- `prefers-reduced-transparency` or no `backdrop-filter` support: the slab becomes solid `--glass-solid`.
