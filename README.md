# SillyBunny Regex Agent Themes

Changes how SillyBunny's bundled trackers look. 45 themes to pick from.

Scene, time, items, events, status, secrets, reputation, achievements, the relationship meter,
NPC profiles, CYOA choices, the direction menu, the chatroom, the phone inbox and the terminal
panels all render as the same dark purple card. This lets you swap that, globally or per tracker.

Changing a theme also updates trackers already in your chat. Your chat files are not touched.

## Requirements

SillyBunny with the In-Chat Agents extension enabled, and at least one tracker agent installed.

No server plugin, so nothing to add to `config.yaml`.

## Install

Paste this into the extension installer:

```
https://github.com/platberlitz/SillyBunny-Regex-Agent-Themes
```

Then open Extensions, and expand "Regex Agent Themes".

To work on it instead, symlink the checkout:

```bash
ln -s "$PWD" /path/to/SillyBunny/data/default-user/extensions/SillyBunny-Regex-Agent-Themes
```

If that symlink ever breaks, every third party extension stops loading, not just this one. Worth
checking first if your extensions disappear after moving things around.

## Using it

Pick a theme from the dropdown at the top, grouped by family. It applies everywhere immediately
and the preview below shows what you just got.

The Preview dropdown switches which card the preview shows, so you can check how a theme handles
NPC profiles or the chatroom before settling on it.

The table at the bottom sets a theme per tracker. Leave a row blank to use the global theme.

"Revert all" puts everything back to stock. Disabling the extension does not revert, because the
themes get saved into your agent files.

## Themes

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

Most themes bring their own colours. The three Adaptive ones use your active SillyBunny theme's
colours instead, so trackers match the rest of your UI. Those are also the ones to use on a light
theme, which the stock trackers handle badly.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Density | normal | Scales padding and text size in every theme. |
| Panels | theme | Whether cards start open or closed. |
| Use SillyBunny theme colours | off | Keeps a theme's shapes and accents but takes surfaces and text from your active theme. |
| Relationship meter bars | off | Turns the relationship tracker's `7/10` values into progress bars. Values that are not numbers stay as text. |
| Restyle bold text | off | Also themes bold text. Off by default because it affects all your prose, not just trackers. |
| Plain glyphs | off | Drops decorative characters. |
| Re-apply after template updates | on | See below. |

## Commands

| Command | What it does |
| --- | --- |
| `/rat-theme [slug]` | Show or set the global theme. |
| `/rat-theme-tracker tracker=… theme=…` | Set or clear one tracker's theme. |
| `/rat-apply` | Re-apply the current theme. |
| `/rat-revert` | Put every tracker back to stock. |
| `/rat-status` | List each tracker's theme and state. |

## Template updates

The In-Chat Agents update buttons rebuild an agent from its template, which wipes the theme.
Themed agents are marked so those buttons skip them. If it happens anyway, the theme comes back
the next time SillyBunny starts.

That only works when the tracker's HTML still matches stock. If you have edited a tracker's HTML
yourself, the extension leaves it alone and marks the row "edited by hand". Use Force if you do
want it overwritten.

## Problems

**Nothing changed.** Check that In-Chat Agents is enabled and tracker agents are installed. If
the panel says it cannot load In-Chat Agents, previews still work but applying will not.

**Trackers show raw HTML as text.** Turn off "Show tags in chat as plain text" in User Settings.
It breaks the stock trackers too.

**One tracker will not update.** Look at its row in the table. "edited by hand" means the
extension found HTML it did not write. "pattern changed upstream" means SillyBunny changed that
tracker and this extension needs an update.

## Development

```bash
npm test
npm run test:pure
npm run generate:stock [path-to-SillyBunny]
```

`npm test` renders every theme through SillyBunny's own regex engine, so it needs a checkout. Set
`RAT_ST_ROOT` if yours is not at `/home/platinum/SillyBunny`. Those tests skip if it is missing.
`npm run test:pure` is the subset that needs neither.

## License

AGPL-3.0.
