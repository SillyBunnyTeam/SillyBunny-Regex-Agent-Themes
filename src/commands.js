/**
 * Slash commands. Registered once per session; the argument enums are generated from the
 * theme registry and the spec table so autocomplete stays accurate.
 */

import { STOCK_THEME } from './constants.js';
import { THEMABLE_TEMPLATE_IDS } from './specs.js';
import { THEMES } from './themes/index.js';
import { getSettings, updateSettings } from './settings.js';
import { applyAll, inspectAgent, themableAgents } from './apply.js';
import { getContext, loadHost } from './host.js';
import { TEMPLATE_LABELS } from './ui.js';

let registered = false;

function themeSlugs() {
    return [STOCK_THEME, ...THEMES.map(theme => theme.slug)];
}

export function registerCommands(onChange = () => {}) {
    if (registered) {
        return;
    }
    const context = getContext();
    const parser = context?.SlashCommandParser;
    const SlashCommand = context?.SlashCommand;
    const SlashCommandArgument = context?.SlashCommandArgument;
    const SlashCommandNamedArgument = context?.SlashCommandNamedArgument;
    const ARGUMENT_TYPE = context?.ARGUMENT_TYPE;

    if (!parser || !SlashCommand || !SlashCommandArgument || !ARGUMENT_TYPE) {
        return;
    }

    parser.addCommandObject(SlashCommand.fromProps({
        name: 'rat-theme',
        helpString: 'Show or set the global tracker theme.',
        returns: 'the active theme slug',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'theme slug, or "stock"',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: themeSlugs(),
            }),
        ],
        callback: async (_named, unnamed) => {
            const slug = String(unnamed ?? '').trim();
            if (!slug) {
                return getSettings().theme;
            }
            if (!themeSlugs().includes(slug)) {
                return `unknown theme: ${slug}`;
            }
            updateSettings({ theme: slug });
            const result = await applyAll();
            onChange();
            return result.ok ? slug : String(result.reason ?? 'failed');
        },
    }));

    parser.addCommandObject(SlashCommand.fromProps({
        name: 'rat-theme-tracker',
        helpString: 'Set or clear one tracker\'s theme.',
        returns: 'the theme now set for that tracker',
        namedArgumentList: SlashCommandNamedArgument
            ? [
                SlashCommandNamedArgument.fromProps({
                    name: 'tracker',
                    description: 'which tracker',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumList: THEMABLE_TEMPLATE_IDS,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'theme',
                    description: 'theme slug, or empty to use the global theme',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                    enumList: themeSlugs(),
                }),
            ]
            : [],
        callback: async (named) => {
            const templateId = String(named?.tracker ?? '');
            if (!THEMABLE_TEMPLATE_IDS.includes(templateId)) {
                return `unknown tracker: ${templateId}`;
            }
            const slug = String(named?.theme ?? '').trim();
            const settings = getSettings();
            const overrides = { ...settings.overrides };
            if (slug) {
                overrides[templateId] = slug;
            } else {
                delete overrides[templateId];
            }
            updateSettings({ overrides });
            await applyAll();
            onChange();
            return slug || 'inherit';
        },
    }));

    parser.addCommandObject(SlashCommand.fromProps({
        name: 'rat-apply',
        helpString: 'Re-apply the current theme to every tracker.',
        returns: 'how many trackers changed',
        callback: async () => {
            const result = await applyAll();
            onChange();
            return result.ok ? `${result.applied} themed, ${result.reverted} reverted` : String(result.reason);
        },
    }));

    parser.addCommandObject(SlashCommand.fromProps({
        name: 'rat-revert',
        helpString: 'Put every tracker back to stock.',
        returns: 'how many trackers were reverted',
        callback: async () => {
            updateSettings({ theme: STOCK_THEME, overrides: {} });
            const result = await applyAll();
            onChange();
            return result.ok ? `${result.reverted} reverted` : String(result.reason);
        },
    }));

    parser.addCommandObject(SlashCommand.fromProps({
        name: 'rat-status',
        helpString: "List each tracker's theme and state.",
        returns: 'one line per tracker',
        callback: async () => {
            const host = await loadHost();
            if (!host.ok) {
                return host.reason;
            }
            const settings = getSettings();
            const lines = themableAgents(host.store.getAgents() ?? []).map(agent => {
                const report = inspectAgent(agent, settings);
                const label = TEMPLATE_LABELS[report.templateId] ?? report.templateId;
                return `${label}: ${report.themeSlug} (${report.status})`;
            });
            return lines.length ? lines.join('\n') : 'no themable agents installed';
        },
    }));

    registered = true;
}
