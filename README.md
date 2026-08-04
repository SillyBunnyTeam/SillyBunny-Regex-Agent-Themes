# SillyBunny Regex Agent Themes

Changes the presentation of SillyBunny's bundled tracker and companion panels without changing
their prompts or model output. Choose from 78 themes, use the original SillyBunny style, or import
a validated custom theme.

Theme changes repaint compatible tracker cards already visible in the current chat. Agent scripts
are updated, but chat messages and chat metadata are not rewritten.

If a card needs another redraw, use **Refresh all tracker cards** in Overview or **Refresh cards**
for one tracker under Tracker overrides. These actions only re-render matching cards in the current
chat; they do not save agents or rewrite chat data.

## Requirements

- SillyBunny 1.7.0 or newer.
- The bundled In-Chat Agents extension enabled.
- At least one compatible tracker or companion agent installed.

No server plugin or `config.yaml` change is required.

## Install

Paste this URL into the SillyBunny extension installer:

```text
https://github.com/platberlitz/SillyBunny-Regex-Agent-Themes
```

Then open Extensions and expand **Regex Agent Themes**.

For development, symlink the checkout into the user extension directory:

```bash
ln -s "$PWD" /path/to/SillyBunny/data/default-user/extensions/SillyBunny-Regex-Agent-Themes
```

## Using It

The settings panel follows SillyBunny's native controls and has five sections:

- **Overview** shows dependency status, installed compatible agents, overrides, drift, and the
  default theme. Changing the default applies it to compatible agents unless an override exists;
  it also offers a refresh action for all current-chat tracker cards.
- **Browse themes** filters by name, family, and color mode. It includes Original SillyBunny style,
  one interactive preview, and lightweight comparison thumbnails.
- **Options** controls density, initial panel state, adaptive colors, meters, bold styling, glyphs,
  and automatic repair. Visual option changes show an explicit action before installed cards change.
- **Tracker overrides** assigns a theme to one template, refreshes that template's current-chat
  cards on demand, and shows every installed duplicate agent with its own state.
- **Maintenance** re-applies themes, imports or exports custom themes, and contains the separate
  restore area.

Disabling the extension stops its UI, commands, and background work. It does not silently rewrite
agents back to stock.

## Preservation Policy

Automatic apply and restore operations only change scripts the extension owns or recognizes as
stock. If a script was edited after a theme was applied, the operation is blocked and names the
affected agent.

Using **Force** requires confirmation. The current replacement and pattern are saved before the
write, so **Restore original styles** can recover that exact edit. A restore without an ownership
record performs no write unless the user confirms a named baseline reset.

Save failures are isolated per agent. The extension restores the local agent cache, reports the
failure, and continues a batch without claiming success for the failed agent.

## Themes

All 78 themes are pictured in [GALLERY.md](GALLERY.md), one screenshot each, showing the same scene
tracker, NPC profile, and choice menu so they can be compared directly. They are grouped into ten
families: Cute & Soft, Flowery & Botanical, Cyber & Tech, Terminal & Retro Computing, Retro-Futurist
& Neon, Print & Editorial, Fantasy & Arcane, Bold & Material, Animated, and Adaptive.

Adaptive themes use allowlisted SillyBunny theme variables. Generated text colors and local safety
surfaces are derived to preserve readable contrast. Compact density reduces spacing without
shrinking text below the extension's readability floor.

Animated themes add low-amplitude decorative ambience only. They never move content or layout and
automatically stop when the operating system requests reduced motion.

## Options

| Setting | Default | What it does |
| --- | --- | --- |
| Density | Normal | Adjusts spacing and typography while retaining readable minimum sizes. |
| Panels | Theme default | Uses the theme's open state, opens all panels, or closes all panels. |
| Use SillyBunny theme colors | Off | Adapts surfaces to the active host theme while preserving the selected structure. |
| Relationship meter bars | Off | Adds an accessible progress bar while keeping the visible `n/m` value. |
| Restyle bold text | Off | Adds a themed underline to bold prose without changing its semantic element or text color. |
| Plain glyphs | Off | Removes decorative icons, ornaments, separators, and terminal chrome. |
| Re-apply after template updates | On | Repairs extension-owned or stock output when SillyBunny starts. |

## Custom Themes

Maintenance can import and export the versioned JSON custom-theme format. Import is limited to
256 KiB, 64 themes, and 8 KiB per canonical theme. A preflight lists accepted themes, replacements,
and rejected entries before settings change.

Custom themes support validated palette, surface, line, shadow, radius, spacing, typography, glyph,
frame, scan, and terminal tokens. Raw HTML, raw CSS, URLs, macros, replacement placeholders,
prototype keys, unknown fields, and reserved or bundled slugs are rejected.

## Commands

| Command | What it does |
| --- | --- |
| `/rat-theme [slug]` | Shows or sets the default theme, including validated custom themes. |
| `/rat-theme-tracker tracker=... theme=...` | Sets or clears one tracker template override. |
| `/rat-apply` | Re-applies the current effective themes and reports partial failures. |
| `/rat-revert` | Restores extension-owned agents to their recorded originals. |
| `/rat-status` | Lists each compatible agent's theme and friendly drift state. |

Commands are removed when the extension is disabled. A command parsed before teardown is also
gated and cannot write after deactivation.

## Template Updates

In-Chat Agents template update buttons rebuild agent scripts and can remove a theme. With automatic
repair enabled, the extension restores recognized stock or older extension output on the next
startup. It does not overwrite a hand edit, a changed upstream pattern, or a missing bundled script.
Those states remain visible under Tracker overrides and require review.

## Troubleshooting

**Nothing changed.** Check Overview for the In-Chat Agents connection and compatible agent count.
Previews remain available when the dependency cannot be loaded, but apply actions are disabled.

**Trackers show HTML as text.** Turn off **Show tags in chat as plain text** in User Settings. The
Overview section warns when this setting is detected.

**One tracker will not update.** Open Tracker overrides. Edited output, changed upstream patterns,
missing bundled scripts, and save failures are reported by agent name rather than silently reset.

**A newly added meter or cleanup is absent from an old message.** Existing message references can
repaint scripts that kept their IDs. A script ID that did not exist when the message was generated
cannot be added without rewriting chat metadata, which this extension intentionally avoids.

## Development

Node 22.3.0 or newer is required. Install the declared dependency from the lockfile:

```bash
npm ci
```

Run tests with:

```bash
npm run test:pure
RAT_ST_ROOT=/path/to/SillyBunny npm run test:host
npm test
npm run generate:stock -- /path/to/SillyBunny
```

Regenerate the theme gallery with `npm run generate:gallery`. It needs headless Chrome plus `cwebp`
and `magick`, and rewrites `GALLERY.md` and every image under `assets/themes`. Pass `--doc-only` to
rebuild just the page, or `--only <slug>` for one theme. Fonts come from the machine that runs it, so
a full regeneration belongs on one machine and a whole-set image diff is worth a second look.

`npm run test:pure` needs no SillyBunny checkout. `npm run test:host` and `npm test` require one and
fail if it is unavailable, so host coverage cannot be skipped in release checks. CI runs pure tests
on Node 22 and 24, checks out current SillyBunny for host contracts, and verifies the generated stock
baseline remains synchronized.

## License

AGPL-3.0.
