# Product

## Register

product

## Users

Regex Agent Themes is for SillyBunny users who already run the bundled In-Chat Agent trackers
and want them to look like part of their setup rather than one fixed dark purple style. Two
groups matter most: users on a light or strongly-branded SillyBunny theme, for whom the stock
tracker palette is actively wrong; and users who care about the look of their roleplay
transcripts and want the cards to match the tone of what they are playing.

A new user needs to change how their trackers look in under a minute, without learning what a
regex script is. An experienced user needs per-tracker control, a way to keep their own hand
edits, and confidence that a template update will not quietly undo their work.

## Product Purpose

Make the visual style of SillyBunny's bundled trackers and companion panels a setting instead
of a hardcoded fact, and do it without changing what the model is asked to produce.

Success means a user can browse themes, see accurately what each one will look like, apply one
globally or to a single tracker, and revert to the bundled look at any time with nothing left
behind. Their existing chat history re-skins along with new messages. Their own edits to
tracker markup survive.

Explicitly out of scope: changing tracker prompts, adding trackers, or altering what the model
emits. This extension only changes how existing output is drawn.

## Brand Personality

Direct and visual. The product's job is to show, not describe — the gallery does the
explaining. Copy stays short, names the consequence, and avoids design vocabulary the user did
not ask for. When something is risky or irreversible it says so plainly, once.

## Anti-references

- Theme names and descriptions that are marketing rather than description. A user should be
  able to guess what "Newsprint" looks like.
- A gallery of colour swatches that does not show the actual component. Previews must be the
  real generated markup, not an approximation.
- Silent destructive behaviour: overwriting a user's hand-edited markup, or reverting on
  disable.
- Settings that require understanding regex scripts, capture groups, or the render pipeline.
- Forty-five near-identical dark themes. Every theme in the pack should be recognisably a
  different decision, not a hue rotation.
- Decorative flourishes that hurt legibility of the tracker's actual content.

## Design Principles

- **Show the real thing.** Previews render the same string chat renders, through the same
  formatter. A preview that lies is worse than no preview.
- **Every theme is a whole decision.** Colour, geometry, type and ornament move together. A
  theme that only changes hue does not earn a slot.
- **The content outranks the frame.** Tracker text is what the user is reading. Ornament may
  frame it and must never compete with it.
- **Never overwrite what you did not write.** Recognisably-stock markup can be replaced
  freely; anything else needs explicit confirmation.
- **Degrade to plain, never to broken.** Fragments carry their own styles so uninstalling the
  extension leaves readable cards, not wreckage.
- **One setting, visible consequence.** Each option states what it changes and takes effect in
  the preview immediately.

## Accessibility & Inclusion

Target WCAG 2.2 AA for the settings panel: semantic controls, full keyboard operation, visible
focus, programmatic labels, and usable layout at narrow widths.

For generated tracker markup: keep body text contrast at AA against its own surface in every
theme, never encode meaning in colour alone (labels stay as text), mark purely decorative
glyphs `aria-hidden`, offer a "plain glyphs" option for users who find decorative characters
noisy in a screen reader, honour `prefers-reduced-motion`, and keep cards from forcing
horizontal scroll at 360px. Themes whose signature effect is low contrast — glassmorphism,
low-contrast slate — must still meet the body-text floor.
