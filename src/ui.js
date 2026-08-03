/**
 * The settings drawer: a theme gallery with live previews, per-tracker overrides, options,
 * and the apply/revert actions.
 *
 * Mount notes: SillyBunny watches both settings columns with a MutationObserver and removes
 * any drawer whose dedupe key collides with an existing one
 * (public/scripts/extensions.js:936). The container therefore carries both a unique id and
 * `data-extension-name`, the header text is distinctive, and every inner id is `rat_`-prefixed.
 */

import { DRAWER_ID, MODULE_NAME, STOCK_THEME } from './constants.js';
import { ARCHETYPES, THEMABLE_TEMPLATE_IDS } from './specs.js';
import { FAMILIES, THEMES, getTheme } from './themes/index.js';
import { DENSITIES, OPEN_DEFAULTS, getSettings, resolveThemeSlug, updateSettings } from './settings.js';
import { PREVIEW_KEYS, detectEncodedTags, mountPreview } from './preview.js';
import { applyAll, applyToAgent, inspectAgent, revertAgent, themableAgents } from './apply.js';
import { getContext, loadHost } from './host.js';

const ARCHETYPE_LABELS = Object.freeze({
    [ARCHETYPES.PANEL]: 'Tracker panel',
    [ARCHETYPES.PROFILE]: 'NPC profile',
    [ARCHETYPES.SLOTS]: 'Choice menu',
    [ARCHETYPES.STATCARD]: 'Relationship meter',
    [ARCHETYPES.CHIP]: 'Inline chip',
    [ARCHETYPES.TERMINAL]: 'Terminal panel',
    [ARCHETYPES.STREAM]: 'Chatroom stream',
    [ARCHETYPES.TRANSCRIPT]: 'Transcript row',
});

const TEMPLATE_LABELS = Object.freeze({
    'tpl-scene-tracker': 'Scene',
    'tpl-time-tracker': 'Time',
    'tpl-item-tracker': 'Items',
    'tpl-event-tracker': 'Pending events',
    'tpl-world-detail': 'World detail',
    'tpl-status-tracker': 'Status & conditions',
    'tpl-secrets-tracker': 'Secrets',
    'tpl-reputation-tracker': 'Reputation',
    'tpl-achievements-tracker': 'Achievements',
    'tpl-relationship-tracker': 'Relationship meter',
    'tpl-parallel-tracker': 'Parallel threads',
    'tpl-npc-profiles': 'NPC profiles',
    'tpl-cyoa-choices': 'CYOA choices',
    'tpl-direction-menu': 'Direction menu',
    'tpl-chatroom-companion': 'Chatroom',
    'tpl-message-inbox-companion': 'Message inbox',
    'tpl-chat-only-companion': 'Chat-only transcript',
    'tpl-level-up-companion': 'Level up',
    'tpl-user-based-stats-generator': 'User stats',
    'tpl-cyoa-choices-skill-checks': 'CYOA skill checks',
});

const STATUS_LABELS = Object.freeze({
    pristine: 'themed',
    stock: 'not themed',
    outdated: 'needs re-apply',
    foreign: 'edited by hand',
    missing: 'script missing',
    'upstream-changed': 'changed upstream',
});

let previewArchetype = ARCHETYPES.PANEL;

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') {
            node.className = value;
        } else if (key === 'text') {
            node.textContent = value;
        } else if (value !== null && value !== undefined) {
            node.setAttribute(key, String(value));
        }
    }
    for (const child of [].concat(children)) {
        if (child) {
            node.append(child);
        }
    }
    return node;
}

function toast(type, message) {
    globalThis.toastr?.[type]?.(message);
}

function optionRow(label, control) {
    return el('label', {}, [control, document.createTextNode(` ${label}`)]);
}

function select(id, options, value, onChange) {
    const node = el('select', { id, class: 'text_pole' });
    for (const option of options) {
        node.append(el('option', { value: option.value, text: option.label }));
    }
    node.value = value;
    node.addEventListener('change', () => onChange(node.value));
    return node;
}

/** Same as select(), but with <optgroup> headings so 45 themes stay scannable. */
function groupedSelect(id, groups, value, onChange) {
    const node = el('select', { id, class: 'text_pole' });
    for (const group of groups) {
        if (!group.options.length) {
            continue;
        }
        if (!group.label) {
            for (const option of group.options) {
                node.append(el('option', { value: option.value, text: option.label }));
            }
            continue;
        }
        const optgroup = el('optgroup', { label: group.label });
        for (const option of group.options) {
            optgroup.append(el('option', { value: option.value, text: option.label }));
        }
        node.append(optgroup);
    }
    node.value = value;
    node.addEventListener('change', () => onChange(node.value));
    return node;
}

function checkbox(id, checked, onChange) {
    const node = el('input', { id, type: 'checkbox' });
    node.checked = checked;
    node.addEventListener('change', () => onChange(node.checked));
    return node;
}

function themeGroups(settings, { includeInherit = false } = {}) {
    const first = includeInherit
        ? [{ value: '', label: 'Use global theme' }, { value: STOCK_THEME, label: 'Stock' }]
        : [{ value: STOCK_THEME, label: 'Stock (leave unthemed)' }];

    const groups = [{ label: '', options: first }];
    for (const family of FAMILIES) {
        groups.push({
            label: family.label,
            options: THEMES
                .filter(theme => theme.family === family.id)
                .map(theme => ({ value: theme.slug, label: theme.name })),
        });
    }
    groups.push({
        label: 'Custom',
        options: Object.values(settings.customThemes)
            .map(theme => ({ value: theme.slug, label: theme.name ?? theme.slug })),
    });
    return groups;
}

function buildPreview(settings) {
    const wrapper = el('div', { id: 'rat_preview_wrap' });
    const theme = getTheme(settings.theme, settings.customThemes);

    if (!theme) {
        wrapper.append(el('div', {
            class: 'rat-note',
            text: 'Trackers are on the stock look. Pick a theme above to see it here.',
        }));
        return wrapper;
    }

    wrapper.append(el('div', { class: 'rat-preview-head' }, [
        el('span', { class: 'rat-card-name', text: theme.name }),
        el('span', { class: 'rat-card-mode', text: theme.mode }),
    ]));

    const preview = el('div', { class: 'rat-preview' });
    wrapper.append(preview);
    mountPreview(preview, previewArchetype, theme, settings.options);
    return wrapper;
}

function reportApply(result) {
    if (!result.ok) {
        toast('error', result.reason ?? 'Could not apply the theme.');
        return;
    }
    const parts = [];
    if (result.applied) {
        parts.push(`${result.applied} themed`);
    }
    if (result.reverted) {
        parts.push(`${result.reverted} reverted`);
    }
    if (result.blocked?.length) {
        parts.push(`${result.blocked.length} skipped, edited by hand`);
    }
    if (result.failed?.length) {
        parts.push(`${result.failed.length} failed`);
    }
    toast(result.blocked?.length || result.failed?.length ? 'warning' : 'success',
        parts.length ? parts.join(', ') : 'Nothing to change.');
}

async function buildScopeTable(settings, refresh) {
    const host = await loadHost();
    const wrapper = el('div');

    if (!host.ok) {
        wrapper.append(el('div', {
            class: 'rat-warning',
            text: `${host.reason}. You can still preview themes, but not apply them.`,
        }));
        return wrapper;
    }

    const agents = themableAgents(host.store.getAgents() ?? []);
    const byTemplate = new Map();
    for (const agent of agents) {
        const templateId = agent.sourceTemplateId ?? '';
        if (!byTemplate.has(templateId)) {
            byTemplate.set(templateId, []);
        }
        byTemplate.get(templateId).push(agent);
    }

    if (!agents.length) {
        wrapper.append(el('div', {
            class: 'rat-note',
            text: 'No tracker agents installed yet.',
        }));
        return wrapper;
    }

    const table = el('table', { class: 'rat-scope-table' });
    table.append(el('thead', {}, el('tr', {}, [
        el('th', { text: 'Tracker' }),
        el('th', { text: 'Theme' }),
        el('th', { text: 'State' }),
        el('th', { text: '' }),
    ])));

    const body = el('tbody');
    for (const templateId of THEMABLE_TEMPLATE_IDS) {
        const templateAgents = byTemplate.get(templateId) ?? [];
        if (!templateAgents.length) {
            continue;
        }

        const reports = templateAgents.map(agent => inspectAgent(agent, settings));
        const worst = reports.find(report => report.status !== 'pristine') ?? reports[0];

        const themeSelect = groupedSelect(
            `rat_scope_${templateId}`,
            themeGroups(settings, { includeInherit: true }),
            settings.overrides[templateId] ?? '',
            async value => {
                const overrides = { ...settings.overrides };
                if (value) {
                    overrides[templateId] = value;
                } else {
                    delete overrides[templateId];
                }
                updateSettings({ overrides });
                for (const agent of templateAgents) {
                    const result = value === STOCK_THEME
                        ? await revertAgent(agent)
                        : await applyToAgent(agent);
                    if (!result.ok && !result.blocked) {
                        toast('error', result.reason);
                    }
                }
                refresh();
            },
        );

        const forceButton = el('div', { class: 'menu_button', text: 'Force' });
        forceButton.addEventListener('click', async () => {
            for (const agent of templateAgents) {
                await applyToAgent(agent, { force: true });
            }
            toast('success', 'Applied over your edits.');
            refresh();
        });

        const revertButton = el('div', { class: 'menu_button', text: 'Revert' });
        revertButton.addEventListener('click', async () => {
            for (const agent of templateAgents) {
                await revertAgent(agent);
            }
            toast('success', 'Back to stock.');
            refresh();
        });

        const actions = el('div', { class: 'flex-container' }, [
            worst.status === 'foreign' ? forceButton : null,
            revertButton,
        ]);

        body.append(el('tr', {}, [
            el('td', { text: TEMPLATE_LABELS[templateId] ?? templateId }),
            el('td', {}, themeSelect),
            el('td', {}, el('span', {
                class: 'rat-status',
                'data-status': worst.status,
                text: STATUS_LABELS[worst.status] ?? worst.status,
            })),
            el('td', {}, actions),
        ]));
    }

    table.append(body);
    wrapper.append(table);
    return wrapper;
}

function buildOptions(settings, refresh) {
    const options = settings.options;
    const wrapper = el('div', { class: 'rat-toolbar' });

    wrapper.append(optionRow('Density', select(
        'rat_density',
        DENSITIES.map(value => ({ value, label: value })),
        options.density,
        value => {
            updateSettings({ options: { density: value } });
            refresh();
        },
    )));

    wrapper.append(optionRow('Panels', select(
        'rat_open_defaults',
        OPEN_DEFAULTS.map(value => ({ value, label: value.replace('-', ' ') })),
        options.openDefaults,
        value => {
            updateSettings({ options: { openDefaults: value } });
            refresh();
        },
    )));

    wrapper.append(optionRow('Use SillyBunny theme colours', checkbox(
        'rat_adaptive', options.adaptiveNeutrals,
        value => {
            updateSettings({ options: { adaptiveNeutrals: value } });
            refresh();
        },
    )));

    wrapper.append(optionRow('Relationship meter bars', checkbox(
        'rat_meters', options.meters,
        value => {
            updateSettings({ options: { meters: value } });
            refresh();
        },
    )));

    wrapper.append(optionRow('Restyle bold text', checkbox(
        'rat_bold', options.restyleBold,
        value => {
            updateSettings({ options: { restyleBold: value } });
            refresh();
        },
    )));

    wrapper.append(optionRow('Plain glyphs', checkbox(
        'rat_glyphs', options.glyphs === 'none',
        value => {
            updateSettings({ options: { glyphs: value ? 'none' : 'theme' } });
            refresh();
        },
    )));

    wrapper.append(optionRow('Re-apply after template updates', checkbox(
        'rat_auto', settings.autoReapply,
        value => updateSettings({ autoReapply: value }),
    )));

    return wrapper;
}

function buildToolbar(settings, refresh) {
    const toolbar = el('div', { class: 'rat-toolbar' });

    toolbar.append(optionRow('Preview', select(
        'rat_preview_archetype',
        Object.keys(PREVIEW_KEYS).map(value => ({ value, label: ARCHETYPE_LABELS[value] ?? value })),
        previewArchetype,
        value => {
            previewArchetype = value;
            refresh();
        },
    )));

    const applyButton = el('div', { class: 'menu_button', text: 'Re-apply' });
    applyButton.addEventListener('click', async () => {
        reportApply(await applyAll());
        refresh();
    });

    const revertButton = el('div', { class: 'menu_button', text: 'Revert all' });
    revertButton.addEventListener('click', async () => {
        updateSettings({ theme: STOCK_THEME, overrides: {} });
        reportApply(await applyAll());
        refresh();
    });

    const exportButton = el('div', { class: 'menu_button', text: 'Export' });
    exportButton.addEventListener('click', () => exportThemes(settings));

    const importButton = el('div', { class: 'menu_button', text: 'Import' });
    importButton.addEventListener('click', () => importThemes(refresh));

    toolbar.append(applyButton, revertButton, exportButton, importButton);
    return toolbar;
}

function exportThemes(settings) {
    const payload = {
        format: 'sillybunny-regex-agent-themes',
        version: 1,
        themes: settings.customThemes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 4)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'regex-agent-themes.json';
    link.click();
    URL.revokeObjectURL(link.href);
}

function importThemes(refresh) {
    const input = el('input', { type: 'file', accept: '.json' });
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        try {
            const payload = JSON.parse(await file.text());
            if (payload.format !== 'sillybunny-regex-agent-themes') {
                toast('error', 'That file is not a Regex Agent Themes export.');
                return;
            }
            const settings = getSettings();
            updateSettings({ customThemes: { ...settings.customThemes, ...payload.themes } });
            toast('success', `Imported ${Object.keys(payload.themes ?? {}).length} theme(s).`);
            refresh();
        } catch (error) {
            toast('error', `Could not read that file: ${error.message}`);
        }
    });
    input.click();
}

async function renderContent(content) {
    const settings = getSettings();
    content.textContent = '';

    content.append(el('div', {
        class: 'rat-note',
        text: 'Changes how the bundled trackers and companion panels look. '
            + 'Also updates trackers already in your chat.',
    }));

    if (detectEncodedTags()) {
        content.append(el('div', {
            class: 'rat-warning',
            text: '"Show tags in chat as plain text" is on, so tracker HTML shows up as text. '
                + 'Turn it off in User Settings. It breaks the stock trackers too.',
        }));
    }

    content.append(el('h4', { text: 'Theme' }));
    content.append(groupedSelect('rat_theme', themeGroups(settings), settings.theme, async value => {
        updateSettings({ theme: value });
        reportApply(await applyAll());
        refresh(content);
    }));

    content.append(buildToolbar(settings, () => refresh(content)));
    content.append(buildPreview(settings));

    content.append(el('h4', { text: 'Options' }));
    content.append(buildOptions(settings, () => refresh(content)));

    content.append(el('h4', { text: 'Per-tracker' }));
    content.append(await buildScopeTable(settings, () => refresh(content)));
}

let refreshHandle = null;

function refresh(content) {
    clearTimeout(refreshHandle);
    refreshHandle = setTimeout(() => renderContent(content), 0);
}

/** Mounts the drawer. Idempotent, so a re-activation cannot duplicate it. */
export function mountSettings() {
    if (document.getElementById(DRAWER_ID)) {
        return () => refresh(document.querySelector(`#${DRAWER_ID} .inline-drawer-content`));
    }

    const host = document.getElementById('extensions_settings2')
        ?? document.getElementById('extensions_settings');
    if (!host) {
        return () => {};
    }

    const content = el('div', { class: 'inline-drawer-content' });
    content.style.display = 'none';

    const toggle = el('div', { class: 'inline-drawer-toggle inline-drawer-header' }, [
        el('b', { text: 'Regex Agent Themes' }),
        el('div', { class: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' }),
    ]);

    const container = el('div', {
        class: 'extension_container',
        id: DRAWER_ID,
        'data-extension-name': MODULE_NAME,
    }, el('div', { class: 'inline-drawer' }, [toggle, content]));

    host.append(container);
    renderContent(content);
    return () => refresh(content);
}

export function removeSettings() {
    document.getElementById(DRAWER_ID)?.remove();
}

export { TEMPLATE_LABELS, STATUS_LABELS, ARCHETYPE_LABELS };
