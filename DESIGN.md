# Bad(yet) design system

Chosen direction: **Night Emerald** (docs/mockups/v9-gallery.html, design 1). Finance-app feel: deep midnight surfaces, emerald accent, gradient hero, Pip the coin mascot, charts. Dark is the primary theme; a light theme is required too (Daylight palette from docs/mockups/v8-gallery.html design 2). Reference mockups are visual references only, not code to copy.

## Fonts
- Headings and big numbers: Plus Jakarta Sans 800, tracking -0.025em.
- Body and figures: Manrope 500/600/700, `font-variant-numeric: tabular-nums` on every money value.
- Load through `next/font` (self-hosted), no runtime Google request.

## Color tokens
| Token | Dark (default) | Light |
|---|---|---|
| bg | #0A1320 | #F2F5F9 |
| surface | #101C2E | #FFFFFF |
| soft | #17263B | #E8EEF5 |
| ink | #E8EEF7 | #0E1B2E |
| muted | #93A5BD | #556579 |
| line | #223349 | #E1E8F0 |
| accent (buttons, progress) | #34D399, text on it #04281C | #087A5A, text on it #FFFFFF |
| accent text | #5EE6B4 | #087A5A |
| accent tint | #0F3A33 | #DDF5EC |
| second accent | #7FA8FF | #2F5BD7 |
| rail | #0C1726 | #FFFFFF |
| bucket Essentials / Wants / Savings | #34D399 / #7FA8FF / #F6C453 | #087A5A / #2F5BD7 / #C9871A |
| wallet text colors Gcash / Maya / BPI / Vybe | #7FA8FF / #34D399 / #FF8A8A / #C4A0FF | #2F5BD7 / #087A5A / #C23A3A / #7A3FB8 |
| wallet card fills (both themes) | #2F5BD7 / #087A5A / #B03030 / #7A3FB8, darkened gradient to 55% | same |
| hero gradient | 135deg #10294A to #0B5A4E, teal glow top right | 135deg #0F2A4A to #0B6B5C |

Contrast: body text 4.5:1 minimum (WCAG AA). Success is emerald, warning gold, error #FF8A8A (dark) / #C23A3A (light).

## Shape and depth
- **Contrast of roundness (user decision at Gate 1):** structure is nearly square, controls and marks are fully round. Cards 10px, hero 14px, wallet cards 10px, rail items 8px, chart bars 3px, inputs 8px. Buttons, pills, progress bars, avatars, the ring and Pip are fully round (999px / 50%). Tokens: `--radius-card: 10px; --radius-hero: 14px; --radius-ctl: 999px; --radius-sm: 8px`. Never mix mid values (16 to 24px) on cards.
- Dark: 1px borders, no shadows. Light: `0 6px 20px rgba(14,27,46,.05)`.

## Signature components
- **Hero:** gradient card, greeting, "Left to send" as a large figure (52px, tabular), thin progress bar, "sent so far" pill, primary action "Mark all sent", Pip on the right.
- **Wallet cards:** bank-card tiles with chip, wallet name, total, "n of m sent".
- **13th month ring:** SVG progress ring with day count, estimate and allocation items.
- **Charts:** area forecast with cap line, donut for budget split, stacked bars per cutoff, wallet bars. Hand-built SVG or Recharts; animate once on load.
- **Transaction rows:** avatar with wallet initial, name, "To wallet · bucket", amount, Sent/Pending pill.
- **Pip:** gold coin mascot with sprout; smiles on completion. Used in the hero and empty/done states only.

## Motion
One authored moment per screen: hero figure rise, bars grow, lines draw, rows pop in (about 0.45s, ease-out). Confetti when all transfers are sent. Everything off under `prefers-reduced-motion`.

## Layout
Desktop: left rail (208px) + main column. Phone (under 760px): rail becomes a bottom tab bar (Home, Cutoff, Budget, Savings, More), single column, hero figure 40px.

## Rules
Money is shown as PHP with two decimals and tabular numbers, stored as integer centavos. Copy is playful and personal ("Good evening. 7 transfers left."), never jargon. Do not reuse the travel-planner look (flip tiles, boarding passes, coral/amber).
