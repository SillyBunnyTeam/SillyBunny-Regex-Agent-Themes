---
name: Regex Agent Themes
description: A theme pack for SillyBunny's in-chat trackers, plus a native-feeling picker for it.
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

# Design System: Regex Agent Themes

## Overview

**Creative North Star: "The Swatch Book"**

Two different design problems live in this project and they must not be confused.

The **settings panel** is a tool. It inherits the active SillyBunny theme, uses the host's own
controls, and stays out of the way. It has no visual identity of its own, because anything it
asserted would compete with the 45 identities it is there to display.

The **themes** are the product. Each one is a complete visual position — palette, geometry,
typography and ornament moving together — and it is allowed to be loud, quiet, ugly-on-purpose,
or period-accurate. What it is not allowed to be is illegible, or a hue rotation of another
theme.

**Key characteristics:**

- The panel is native; the themes are opinionated
- Previews are the real rendered component, never an approximation
- Every theme is one decision applied consistently across nine markup shapes
- Content legibility outranks ornament in every theme

## Colours

### The settings panel

The host theme owns the palette. The panel adds colour only for state:

- **Host accent** (`--SmartThemeQuoteColor`) marks the applied theme card and keyboard focus.
- **Warning** (`--warning`, falling back to amber) marks drift that needs a decision:
  "edited by hand" and "needs re-apply".
- **Error** (`--fullred`) marks the one unrecoverable state, "pattern changed upstream".

### The themes

Each theme declares a palette in four parts, and the renderers only ever read these:

- **Surfaces** — a header gradient pair and a body gradient pair, plus a row wash, an
  alternate row wash, an inset, and a chip background.
- **Ink** — head, body, label, muted, strong, warm, cool.
- **Lines** — a header border colour, a body border colour, a width, a style, and the width
  of the accent rule on rows.
- **An accent ramp of exactly seven.** Trackers index into it, so a short ramp would make
  different trackers collide.

Colour values are literal. `color-mix()` and `var(--SmartTheme*)` appear only in the three
adaptive themes, where deriving from the host is the entire point — and there every `var()`
carries a literal fallback so a host theme missing a variable still renders.

Contrast floor: body text must reach WCAG AA against its own surface in every theme, including
the ones whose signature effect is low contrast.

## Typography

Themes choose a display family for headers and a reading family for bodies, from system font
stacks only — no `@font-face`, no CDN, because the app runs locally and a missing font must
degrade to a sane fallback rather than a download that never arrives.

The type scale is six sizes (head, body, label, value, chip, plus line height) and is scaled as
a group by the density setting. Themes may re-case a label; they may never re-word one, because
those strings are SillyBunny's product copy.

## Structure

Every generated fragment is one of nine archetypes, and the archetype — not the theme — decides
the shape:

| Archetype | Shape |
| --- | --- |
| Panel | header chip, one or two body rows |
| Profile | header chip, a stack of labelled sections |
| Slots | header chip, a fixed number of list rows |
| Statcard | header chip, a responsive stat grid, a pill, a note |
| Chip | an inline pill that flows inside prose |
| Terminal | a framed window with a title bar and a pre-wrap body |
| Stream | an open/row/close triple bracketing message rows |
| Transcript | a speaker pill above a message block |
| Bold | the shared bold-markdown helper |

A theme customises an archetype through tokens; when it needs structure tokens cannot express
it uses `frame` (corner brackets, rivets, ruler ticks, halftone, bevel), `scan` (a scanline or
grid layer), `ornament` (raw HTML at eight named anchors), or `extra` (a verbatim declaration
appendix per part). Escalate only as far as needed — most themes are tokens alone.

## Motion

Almost none. The only transition is the disclosure chevron rotating on open, at 180ms, and it
is disabled under `prefers-reduced-motion`. Tracker cards appear mid-conversation and animation
there reads as noise.

## Rules

- **Inline styles are the contract.** Every fragment carries its complete computed style, so
  uninstalling the extension leaves readable cards. The stylesheet only adds what inline styles
  cannot express.
- **Style hooks are `data-rat-*` attributes, never class names.** A DOMPurify hook rewrites
  every class in message HTML to `custom-<name>`; a `.rat-row` rule would be dead code.
- **Never emit `{{`, and never emit `$` followed by a digit.** Both are consumed before the
  string reaches the DOM — the first by macro expansion, the second by the regex interpolator.
- **One line per fragment.** A blank line invites the markdown pass to wrap fragments in `<p>`.
  Only the terminal archetype spans lines, and it confines them to a pre-wrap region.
- **Decorative glyphs are `aria-hidden`.** Meaning always exists as text as well.
- **Nothing may force horizontal scroll at 360px.** Grids use `auto-fit` with a minimum, grid
  children get `min-width: 0`, and values get `overflow-wrap: anywhere`.

## Do

- Show the component, in the theme, with real data, before the user commits
- Keep each theme's decision visible in all nine archetypes
- State the consequence of a destructive action in the button's own row
- Let a theme be quiet if quiet is the point

## Don't

- Ship two themes that differ only in hue
- Let ornament reduce the contrast of tracker content
- Overwrite markup the extension did not write, without an explicit action
- Revert on disable
- Depend on the stylesheet for anything that would look broken without it
