# SillyBunny Regex Agent Themes

Swappable HTML themes for SillyBunny's bundled In-Chat Agent trackers and companion panels.

SillyBunny ships around twenty trackers that turn marker blocks the model emits — things like
`[SCENE|Rooftop garden|Dusk|Overcast]` — into styled cards at display time. They all share one
hardcoded look: a dark purple chip over a dark gradient body, 11px monospace. There is no
setting for it, and because the palette is hardcoded dark, the cards look wrong on light
SillyBunny themes.

This extension makes that look swappable. Pick one of 45 themes, apply it globally or per
tracker, and preview any of them against real sample data before committing.

Switching themes also re-skins tracker output **already in your chat history**, because
SillyBunny resolves a message's regex scripts from the live agent rather than from a copy
stored on the message. Nothing in your chat files is rewritten.

## Requirements

- SillyBunny with the bundled **In-Chat Agents** extension enabled
- At least one bundled tracker or companion agent installed

Client-only — there is no server plugin, so no `enableServerPlugins` and no second symlink.

## Installation

Install from the extensions panel using this repository's URL:

```
https://github.com/platberlitz/SillyBunny-Regex-Agent-Themes
```

Then open **Extensions → Regex Agent Themes**.

For development, symlink the checkout into your user extensions directory instead:

```bash
ln -s "$PWD" /path/to/SillyBunny/data/default-user/extensions/SillyBunny-Regex-Agent-Themes
```

A dangling symlink in that directory makes `/api/extensions/discover` return 500, which
silently disables *every* third-party extension — so if extensions stop loading after you
move this checkout, check the link first.

## Usage

**Global theme.** Pick one from the dropdown at the top of the drawer. It applies to every
tracker immediately.

**Per tracker.** The table at the bottom of the drawer lets each tracker use a different
theme, or stay on the stock look. Blank means "follow the global theme".

**Preview gallery.** The gallery renders each theme against real sample marker blocks, run
through SillyBunny's own message formatter — so what you see is what chat will show. The
**Preview** dropdown switches which shape you are looking at: tracker panel, NPC profile,
choice menu, relationship meter, inline chip, terminal panel, chatroom stream, or transcript
row.

**Revert.** "Revert all" restores the bundled markup everywhere and removes everything this
extension added. Disabling the extension does *not* revert — applied themes live in your
agent files, so silently un-theming on disable would be a destructive surprise.

## The 45 themes

| Family | Themes |
| --- | --- |
| Cute & Soft | Marshmallow, Strawberry Milk, Bubble Tea, Plushie Felt, Sticker Book |
| Flowery & Botanical | Wildflower Press, Sakura Drift, Herbarium, Rose Gold Bloom, Cottagecore Linen |
| Cyber & Tech | Neon Grid, Chrome HUD, Glitchwave, Circuitry, Datastream |
| Terminal & Retro Computing | Phosphor Green, Terminal Amber, Game Boy DMG, Teletext, Chrome 98 |
| Retro-Futurist & Neon | Vaporwave Sunset, Synthwave Drive, Arcade Cabinet, Miami Deco, Candy Gloss |
| Print & Editorial | Paper Minimal, Newsprint, Ink & Vellum, Editorial Hairline, Blueprint, Nordic Frost |
| Fantasy & Arcane | Grimoire, Dungeon Slate, Elven Gilt, Eldritch Deep, Steampunk Brass, Celestial Chart |
| Bold & Material | Neo-Brutalist, Comic Panel, Monochrome Slate, Glass Frost, Ember Hearth |
| Adaptive | Adaptive Native, Adaptive Accent, Adaptive Ink |

The three **Adaptive** themes take their palette from your active SillyBunny theme instead of
hardcoding one, so trackers blend into whatever UI theme you run — including light themes.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Density | normal | Scales padding and type across every theme (compact / normal / roomy). |
| Panels | theme | Whether cards start open, closed, or as the stock look intended. |
| Follow host theme colours | off | Repaints any theme's surfaces and text onto your active SillyBunny theme while keeping its accents, geometry and type. |
| Relationship meter bars | off | Turns the relationship tracker's `7/10` values into real progress bars. Adds one extra regex script per agent; non-numeric values stay as plain text. |
| Restyle bold text | off | Also themes the shared bold-markdown helper. Off by default because it affects all prose in the message, not just tracker output. |
| Plain glyphs | off | Drops decorative glyphs for a plainer, more screen-reader-friendly look. |
| Re-apply after template updates | on | See below. |

## Slash commands

| Command | What it does |
| --- | --- |
| `/rat-theme [slug]` | Show or set the global theme, then apply it. |
| `/rat-theme-tracker tracker=… theme=…` | Override one tracker, or clear the override. |
| `/rat-apply` | Re-apply the current theme everywhere. |
| `/rat-revert` | Restore the bundled markup everywhere. |
| `/rat-status` | Report which trackers are themed, stale, or edited by hand. |

## Template updates

In-Chat Agents' version pill and its "Update All" button rebuild an agent from its bundled
template, which discards the agent's regex scripts — and therefore your theme. Two things
guard against that:

- Themed agents are marked so those buttons stop offering the destructive update.
- If it happens anyway, the next time SillyBunny starts this extension notices the markup is
  back to stock and quietly restores your theme.

That recovery is deliberately narrow. It only fires when the markup is byte-identical to
something recognisably stock. If you edit a tracker's HTML yourself in the agent editor, the
extension leaves it alone and shows it as "edited by hand" in the per-tracker table, with a
**Force** button if you do want to overwrite it.

## Troubleshooting

**Nothing changed after applying a theme.** Check that the In-Chat Agents extension is
enabled and that the tracker agents are actually installed. If the drawer shows "Could not
load In-Chat Agents", themes can still be previewed but not applied.

**Trackers show raw HTML like `<details ...>` as text.** The "Show tags in chat as plain
text" user setting is on. It breaks the stock trackers too. The drawer warns about this when
it detects it.

**A tracker is stuck on the old look.** Look at its row in the per-tracker table. "edited by
hand" means the extension found markup it did not write and refused to overwrite it — use
**Force**. "pattern changed upstream" means SillyBunny changed that tracker's matching
pattern, so theming it could mis-render; the fix is a new release of this extension.

**A theme looks wrong in one specific tracker.** Use the Preview dropdown to inspect that
shape in that theme, then set a per-tracker override for it.

## Development

```bash
npm test          # full suite, including rendering through the real SillyBunny regex engine
npm run test:pure # the DOM-free and checkout-free subset
npm run generate:stock [path-to-SillyBunny]   # refresh the stock baseline after an upstream sync
```

The test suite renders all 45 themes against all 38 markup scripts and checks the results
against the things SillyBunny's render pipeline will silently mangle: stray `$1`-style
sequences (eaten by the regex interpolator), `{{macros}}` (expanded by `substituteParams`),
double quotes inside style attributes, unbalanced tags, and `<style>` selectors that would
stop matching after the sanitizer rewrites them. It also tripwires the upstream behaviour the
extension depends on, so an upstream sync that changes it fails a test instead of producing a
silent visual bug.

`npm test` needs `--experimental-test-module-mocks` (already in the script) and a SillyBunny
checkout; set `RAT_ST_ROOT` if it is not at `/home/platinum/SillyBunny`. Tests that need it
skip cleanly when it is absent.

## How it works

Each theme is a set of design tokens — surfaces, an accent ramp, geometry, type, glyphs — and
each of SillyBunny's 38 markup-bearing regex scripts is described by a spec saying which of
nine markup archetypes renders it and how its capture groups map onto that archetype's slots.
Tokens plus spec produce the HTML, so 45 themes cover every tracker without anyone
hand-writing 1,710 strings.

Applying a theme rewrites the `replaceString` of the agent's regex scripts and never their
matching patterns, so the text the model is asked to emit does not change. Generated fragments
carry complete inline styles, which means they keep working if this extension is disabled or
uninstalled; the bundled stylesheet only adds what inline styles cannot express, such as
disclosure rotation and empty-row collapse.

## License

AGPL-3.0, matching SillyBunny.
