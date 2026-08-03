# Product

## Register

product

## Users

People already running SillyBunny's bundled trackers who want them to look different. Mainly two
cases: someone on a light or heavily customised SillyBunny theme, where the stock dark purple
cards look out of place, and someone who cares how their roleplay transcripts read and wants the
cards to match the tone of what they are playing.

A new user should be able to change how their trackers look in under a minute without knowing
what a regex script is. An experienced user needs per-tracker control, and needs their own edits
to survive.

## Product Purpose

Make the look of the bundled trackers a setting instead of something hardcoded, without changing
what the model is asked to write.

It works if someone can browse the themes, see what each one actually looks like, apply one, and
go back to stock later with nothing left behind. Existing chat history updates too. Their own
edits to tracker HTML stay.

Not in scope: changing tracker prompts, adding trackers, or changing what the model emits.

## Brand Personality

Plain and visual. The gallery does the explaining, so the writing stays short and says what
things do. When something is destructive or hard to undo, say so once and move on.

## Anti-references

- Theme names and descriptions that sell instead of describe. Someone should be able to guess what
  "Newsprint" looks like.
- Colour swatches standing in for a preview. Show the actual card.
- Overwriting a user's own edits, or reverting when the extension is disabled.
- Settings that need you to understand regex scripts or capture groups.
- Forty-five dark themes with the hue shifted. Each one should be a different decision.
- Decoration that makes the tracker's own text harder to read.

## Design Principles

- Show the real card, in the real theme, with real data.
- Colour, shape, type and ornament move together. A hue swap is not a theme.
- The tracker's text is what people are reading. Decoration frames it and never competes with it.
- Never overwrite HTML the extension did not write without being told to.
- Uninstalling should leave plain readable cards, not broken ones.
- Every setting takes effect in the preview straight away.

## Accessibility & Inclusion

WCAG 2.2 AA for the settings panel: real controls, full keyboard use, visible focus, labels that
screen readers can reach, and a layout that still works narrow.

For the generated tracker cards: body text meets AA against its own background in every theme,
state is never colour-only (labels are text), decorative characters are `aria-hidden`, there is a
plain glyphs option, motion respects `prefers-reduced-motion`, and nothing forces sideways
scrolling at 360px. Themes built on low contrast, like the glass and slate ones, still have to
clear the body text floor.
