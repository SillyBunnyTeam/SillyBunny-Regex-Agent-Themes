---
name: Regex Agent Themes
description: Design notes for the theme pack and its settings panel.
typography:
  body:
    fontFamily: "inherit"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "inherit"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "5px"
  md: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "16px"
---

# Design: Regex Agent Themes

There are two separate design jobs here and they pull in opposite directions.

The **settings panel** is a tool. It inherits the active SillyBunny theme, uses the host's own
controls, and has no look of its own. Anything it asserted visually would fight the 48 looks it
exists to show.

The **themes** are the product. Each one is allowed to be loud, quiet, ugly on purpose, or period
accurate. What it cannot be is hard to read, or another theme with the hue moved.

## Colours

### Settings panel

The host theme owns the palette. The panel only adds colour for state:

- Host accent (`--SmartThemeQuoteColor`) for the applied theme card and keyboard focus.
- Warning (`--warning`, falling back to amber) for drift that needs a decision: "edited by hand"
  and "needs re-apply".
- Error (`--fullred`) for the one state you cannot fix from here, "pattern changed upstream".

### Themes

A theme declares its palette in four parts and the renderers read nothing else:

- **Surfaces**: a header gradient pair, a body gradient pair, a row wash, an alternate row wash,
  an inset, a chip background.
- **Ink**: head, body, label, muted, strong, warm, cool.
- **Lines**: header border colour, body border colour, width, style, and the width of the accent
  rule on rows.
- **Seven accents.** Trackers index into the ramp, so a shorter one makes different trackers
  collide.

Colours are literal values. `color-mix()` and `var(--SmartTheme*)` only appear in the three
adaptive themes, where reading the host is the point, and every `var()` there has a literal
fallback. Renderers derive semantic foregrounds from the authored palette. When a transparent,
adaptive, or low-contrast surface cannot prove AA contrast, it receives a local safety layer.

Body text has to clear WCAG AA against its own background. That includes the themes whose whole
idea is low contrast.

## Type

Themes pick a display family for headers and a reading family for bodies, from system font stacks
only. No `@font-face`, no CDN. The app runs locally and a missing font should fall back, not hang.

The scale is head, body, label, value, chip and line height. Density primarily changes spacing;
compact mode does not shrink type, and every role has a readable floor. A theme may re-case a
label. It may not re-word one, because those strings are SillyBunny's own copy.

## Shapes

Eight shipped archetypes, and the archetype decides the shape, not the theme:

| Archetype | Shape |
| --- | --- |
| Panel | header chip, one or two rows |
| Profile | header chip, stack of labelled sections |
| Slots | header chip, fixed number of list rows |
| Statcard | header chip, stat grid, pill, note |
| Chip | inline pill that flows inside prose |
| Stream | open/row/close triple around message rows |
| Transcript | speaker pill above a message block |
| Bold | the shared bold-markdown helper |

Themes customise those through tokens. When tokens are not enough there are four escape hatches,
and you use the smallest one that works: `frame` (corner brackets, rivets, ruler ticks, halftone,
die-cut, bevel), `scan` (a scanline or grid layer), `ornament` (raw HTML at eight named anchors),
`extra` (a verbatim declaration appendix per part). Most themes never leave tokens. Imported custom
themes cannot use the trusted raw HTML or declaration escape hatches.

## Motion

Themes are static by default. Dedicated animated themes may add low-amplitude decorative ambience,
such as a soft root glow. Text, controls, and layout never move. `prefers-reduced-motion` disables
every theme animation, and cards remain complete and readable when the optional stylesheet is absent.

## Rules

- Inline styles are the contract. Every fragment carries its full style, so uninstalling leaves
  readable cards. The stylesheet only adds what inline styles cannot do.
- Style hooks are `data-rat-*` attributes, never class names. SillyBunny rewrites every class in
  message HTML to `custom-<name>`, so a `.rat-row` rule would never match.
- Never emit `{{`, and never emit `$` followed by a digit. Both get eaten before the HTML reaches
  the page.
- One line per fragment. A blank line invites the markdown pass to wrap things in `<p>`.
- Decorative characters are `aria-hidden`. Meaning always exists as text too.
- Nothing forces sideways scrolling at 360px. Grids use `auto-fit` with a minimum, grid children
  get `min-width: 0`, values get `overflow-wrap: anywhere`.

## Do

- Show the card, in the theme, with real data, before anyone commits.
- Keep a theme's decision visible in all eight shapes.
- Put the consequence of a destructive action in the same row as the button.
- Let a quiet theme be quiet.

## Don't

- Ship two themes that only differ in hue.
- Let decoration cut the contrast of tracker text.
- Overwrite HTML the extension did not write without an explicit action.
- Revert on disable.
- Rely on the stylesheet for anything that looks broken without it.
