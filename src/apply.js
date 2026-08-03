/**
 * Applying, reverting and reconciling themes against the live agent store.
 *
 * The write path mirrors what In-Chat Agents does itself: mutate the agent, `saveAgent`
 * (which refreshes the live regex cache and POSTs), then refresh message snapshots. Because
 * messages store only `{agentId, scriptId}` refs and resolve them against that live cache,
 * changing a `replaceString` re-skins existing chat history without touching any message.
 */

import { ENGINE_VERSION, STOCK_THEME } from './constants.js';
import { buildAgentScripts, isOwnedScript, revertAgentScripts } from './build.js';
import { STATUS, classifyScript, isAutoApplicable, summarizeStatuses } from './drift.js';
import { buildReplaceString, DEFAULT_OPTIONS } from './render/index.js';
import { getSpec } from './specs.js';
import { getStock } from './stock.js';
import { getTheme } from './themes/index.js';
import { getSettings, resolveThemeSlug, updateSettings } from './settings.js';
import { loadHost, loadRefresher } from './host.js';

/** Agents that carry at least one script this extension has a spec for. */
export function themableAgents(agents) {
    return agents.filter(agent => {
        const templateId = agent.sourceTemplateId ?? '';
        return (agent.regexScripts ?? []).some(script => getSpec(templateId, script.id));
    });
}

function agentVersion(agent) {
    return Number(agent?.version) || 0;
}

/**
 * Inspects one agent without writing anything.
 * @returns {{agentId: string, templateId: string, themeSlug: string, status: string,
 *            perScript: Array<{scriptId: string, status: string}>}}
 */
export function inspectAgent(agent, settings = getSettings()) {
    const templateId = agent.sourceTemplateId ?? '';
    const themeSlug = resolveThemeSlug(templateId, settings);
    const theme = getTheme(themeSlug, settings.customThemes);
    const ledger = settings.ledger[agent.id];
    const perScript = [];

    for (const script of agent.regexScripts ?? []) {
        if (isOwnedScript(script)) {
            continue;
        }
        const spec = getSpec(templateId, script.id);
        if (!spec || spec.passthrough) {
            continue;
        }
        const expected = theme
            ? buildReplaceString(spec, theme, { ...DEFAULT_OPTIONS, ...settings.options })
            : null;
        perScript.push({
            scriptId: script.id,
            scriptName: script.scriptName,
            status: classifyScript({
                script,
                spec,
                expected,
                ledgerEntry: ledger?.scripts?.[script.id],
            }),
        });
    }

    return {
        agentId: agent.id,
        agentName: agent.name,
        templateId,
        themeSlug,
        status: summarizeStatuses(perScript.map(entry => entry.status)),
        perScript,
    };
}

/**
 * Writes one agent's themed scripts.
 * @param {object} agent The live agent object from the store.
 * @param {object} options `{ force }` overwrites hand edits; `{ templateVersion }` raises
 *   the agent version so the destructive template-update path stops offering itself.
 */
export async function applyToAgent(agent, { force = false, templateVersion = 0 } = {}) {
    const host = await loadHost();
    if (!host.ok) {
        return { ok: false, reason: host.reason };
    }

    const settings = getSettings();
    const templateId = agent.sourceTemplateId ?? '';
    const themeSlug = resolveThemeSlug(templateId, settings);

    if (themeSlug === STOCK_THEME) {
        return revertAgent(agent);
    }

    const theme = getTheme(themeSlug, settings.customThemes);
    if (!theme) {
        return { ok: false, reason: `Unknown theme "${themeSlug}"` };
    }

    const report = inspectAgent(agent, settings);
    const blocked = report.perScript.filter(entry => !isAutoApplicable(entry.status)
        && entry.status !== STATUS.PRISTINE);

    if (!force && blocked.length > 0) {
        return {
            ok: false,
            reason: 'changed outside this extension',
            blocked: blocked.map(entry => ({ ...entry })),
        };
    }

    // Capture genuine hand edits once, so revert can restore exactly what was there.
    const previous = settings.ledger[agent.id];
    const originals = { ...(previous?.originals ?? {}) };
    for (const entry of report.perScript) {
        if (entry.status !== STATUS.FOREIGN || originals[entry.scriptId]) {
            continue;
        }
        const script = agent.regexScripts.find(item => item.id === entry.scriptId);
        if (script) {
            originals[entry.scriptId] = {
                replaceString: script.replaceString,
                findRegex: script.findRegex,
            };
        }
    }

    const built = buildAgentScripts(
        templateId,
        agent.regexScripts ?? [],
        theme,
        settings.options,
        agent.id,
    );

    const versionBefore = previous?.versionBefore ?? agentVersion(agent);
    const phaseLockedBefore = previous?.phaseLockedBefore ?? Boolean(agent.phaseLocked);

    agent.regexScripts = built.scripts.map(script => host.scripts.normalizeRegexScript(script));
    // phaseLocked keeps the boot-time bundled migrations from restoring stock markup, and
    // raising the version removes this agent from the version pill and "Update All".
    agent.phaseLocked = true;
    if (templateVersion > agentVersion(agent)) {
        agent.version = templateVersion;
    }

    await host.store.saveAgent(agent);

    const scriptLedger = {};
    for (const script of agent.regexScripts) {
        if (isOwnedScript(script)) {
            continue;
        }
        scriptLedger[script.id] = { applied: script.replaceString };
    }

    updateSettings({
        ledger: {
            ...settings.ledger,
            [agent.id]: {
                agentId: agent.id,
                templateId,
                theme: themeSlug,
                engine: ENGINE_VERSION,
                appliedAt: 0,
                versionBefore,
                phaseLockedBefore,
                scripts: scriptLedger,
                originals,
                added: built.added,
            },
        },
    });

    const refreshed = await refreshAgent(agent.id);
    return {
        ok: true,
        themed: built.themed.length,
        added: built.added.length,
        skipped: built.skipped,
        refreshed,
    };
}

/** Restores the shipped markup and removes every script this extension appended. */
export async function revertAgent(agent) {
    const host = await loadHost();
    if (!host.ok) {
        return { ok: false, reason: host.reason };
    }

    const settings = getSettings();
    const templateId = agent.sourceTemplateId ?? '';
    const entry = settings.ledger[agent.id];

    const restored = revertAgentScripts(
        templateId,
        agent.regexScripts ?? [],
        entry?.originals ?? {},
    );

    agent.regexScripts = restored.map(script => host.scripts.normalizeRegexScript(script));
    if (entry) {
        agent.phaseLocked = entry.phaseLockedBefore;
        if (entry.versionBefore) {
            agent.version = entry.versionBefore;
        }
    }

    await host.store.saveAgent(agent);

    const ledger = { ...settings.ledger };
    delete ledger[agent.id];
    updateSettings({ ledger });

    const refreshed = await refreshAgent(agent.id);
    return { ok: true, reverted: restored.length, refreshed };
}

/**
 * Re-renders messages that already carry this agent's output. Optional: without it the
 * change still lands, it just shows on the next chat load.
 */
async function refreshAgent(agentId) {
    const refresh = await loadRefresher();
    if (!refresh) {
        return false;
    }
    try {
        refresh(agentId);
        return true;
    } catch {
        return false;
    }
}

/** Applies the current settings to every themable agent. */
export async function applyAll({ force = false } = {}) {
    const host = await loadHost();
    if (!host.ok) {
        return { ok: false, reason: host.reason };
    }

    const agents = themableAgents(host.store.getAgents() ?? []);
    const results = { applied: 0, reverted: 0, blocked: [], failed: [] };

    for (const agent of agents) {
        const settings = getSettings();
        const themeSlug = resolveThemeSlug(agent.sourceTemplateId ?? '', settings);
        const result = themeSlug === STOCK_THEME
            ? await revertAgent(agent)
            : await applyToAgent(agent, { force });

        if (result.ok) {
            if (themeSlug === STOCK_THEME) {
                results.reverted++;
            } else {
                results.applied++;
            }
        } else if (result.blocked) {
            results.blocked.push({ agentId: agent.id, agentName: agent.name, blocked: result.blocked });
        } else {
            results.failed.push({ agentId: agent.id, reason: result.reason });
        }
    }

    return { ok: true, ...results };
}

/**
 * The boot pass. Only touches agents whose markup we recognise as stock (so a template
 * update silently restores the theme) or as our own older output. Hand edits are reported,
 * never overwritten, and an unchanged boot issues no writes at all.
 */
export async function reconcile() {
    const settings = getSettings();
    if (!settings.autoReapply || settings.theme === STOCK_THEME) {
        return { ok: true, repaired: 0, needsAttention: [] };
    }

    const host = await loadHost();
    if (!host.ok) {
        return { ok: false, reason: host.reason };
    }

    const agents = themableAgents(host.store.getAgents() ?? []);
    const needsAttention = [];
    let repaired = 0;

    for (const agent of agents) {
        const report = inspectAgent(agent);
        const drifted = report.perScript.filter(entry => isAutoApplicable(entry.status));
        const stuck = report.perScript.filter(entry => entry.status === STATUS.FOREIGN
            || entry.status === STATUS.UPSTREAM_CHANGED);

        if (stuck.length > 0) {
            needsAttention.push({ agentId: agent.id, agentName: agent.name, entries: stuck });
            continue;
        }
        if (drifted.length === 0) {
            continue;
        }

        const result = await applyToAgent(agent);
        if (result.ok) {
            repaired++;
        }
    }

    return { ok: true, repaired, needsAttention };
}

export { STATUS };
