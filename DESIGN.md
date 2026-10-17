# DESIGN.md: Cold Development

## Direction
A calm, precise studio site for a plugin developer. Deep winter-night navy, icy light, clean type. The one memorable element is the hero snowflake: grown procedurally from a random seed, a new one on every click.

## Tokens
| Name | Value | Role |
|---|---|---|
| bg | `#0a1220` | page |
| bg-raise | `#0f1a2c` | hover rows, skeletons |
| line | `rgba(160,196,235,.13)` | section and row rules |
| text | `#eaf2fb` | primary text |
| muted | `#93a7bf` | secondary text |
| ice | `#9fd8ff` | links, focus, snowflake |
| ice-deep | `#4fa9f5` | snowflake gradient end, background light |

## Type
Onest (variable, self-hosted). Headline 720, max 6rem, tracking -0.045em. Section titles 660. Body 380. Numbers tabular.

## Structure
Nav, hero (copy + snowflake), What I make (three rows), Recently updated (live from the GitHub API, 6 newest non-fork repos, cached per session), Find me (link rows + Discord copy), footer with the 88x31 badges and deploy hash.

## Motion
- Load: the snowflake draws itself from the center out (stroke-dashoffset, 900ms expo-out, delay by distance). The only unprompted motion.
- Click on the snowflake: the old one blurs out (220ms), a new one draws.
- Hover: row background 150ms, arrow nudges 2px. Press: `scale(0.97)` on buttons.
- Discord copy: copy icon to check with opacity + scale + blur (180ms).
- Reduced motion: the snowflake appears drawn, transitions instant.

## Don't
Eyebrow labels, gradient text, glass, coloured glows, identical cards, unicode arrows as icons, looping motion.
