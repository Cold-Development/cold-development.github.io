# DESIGN.md: Cold Development

## World
An ice core laid out on a light table in a freezer lab. The page is the room (dim, cold slate) and the table (bright, diffused). Each link is one broken segment of the core, labelled by hand in marker. The meta text underneath and the tape ruler are the table's measuring gear.

- The newest layer is the surface. The "top of the core" label carries the last deploy hash.
- On narrow screens the core stands upright, as it was drilled. Layers then run across each segment.
- Real details only: annual layers, trapped air bubbles, red/black orientation lines, fractured ends. They are drawn per segment by `site.js` from a fixed seed.

## Tokens
| Name | Hex | Role |
|---|---|---|
| room | `#1e2b34` | page background |
| frost | `#e2edf2` | text on the room |
| frost-dim | `#a9bdc8` | secondary text on the room |
| table | `#eef5f8` | light table surface |
| ice / ice-deep | `#cfe2ea` / `#a9c8d6` | core |
| ink | `#14233a` | marker and text on the table |
| marker-red | `#c8283a` | orientation line, focus ring, selection |

## Type
- Geologica (variable 100–900): everything set. Headline 780, max 6rem, tracking -0.04em.
- Permanent Marker: only what is written on the ice (segment names).
- Numbers in readouts use tabular figures.

## Motion
- Load: the table's tubes flicker on once (760ms), then the core extrudes from the left (1300ms, expo-out). Upright on mobile, from the top.
- Hover on a segment: backlight brightens (220ms). Press: `scale(0.985)`.
- Copy Discord: copy icon to check, opacity + scale + blur (180ms). The hint text below confirms.
- Reduced motion: no load moment, transitions instant.

## Don't
Eyebrow labels, gradient text, glass, identical cards, unicode arrows as icons, pulsing or looping motion.
