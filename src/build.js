/**
 * Turns a stock script list into a themed one. This is the single place that decides what
 * gets rewritten, what is left alone, and what extra scripts get appended. Shared by the
 * apply engine and the tests so they can never disagree.
 */

import { ARCHETYPES, getSpec } from './specs.js';
import { getStock } from './stock.js';
import {
    DEFAULT_OPTIONS, buildCleanupFindRegex, buildExtraCleanupScript,
    buildMeterScript, buildReplaceString, ownedScriptId,
} from './render/index.js';
import { OWNED_SCRIPT_PREFIX } from './constants.js';

/** True for scripts this extension appended rather than themed in place. */
export function isOwnedScript(script) {
    return String(script?.id ?? '').startsWith(OWNED_SCRIPT_PREFIX);
}

/**
 * @typedef {object} BuildResult
 * @property {object[]} scripts The themed script list, in apply order.
 * @property {string[]} themed Ids whose replaceString was rewritten.
 * @property {string[]} added Ids of scripts this extension appended.
 * @property {string[]} skipped Ids left untouched, with the reason appended.
 */

/**
 * @param {string} templateId
 * @param {object[]} stockScripts The agent's current `regexScripts`.
 * @param {object} theme
 * @param {object} [options]
 * @param {string} [agentId] Namespaces the ids of appended scripts.
 * @returns {BuildResult}
 */
export function buildAgentScripts(templateId, stockScripts, theme, options = {}, agentId = 'agent') {
    const merged = { ...DEFAULT_OPTIONS, ...options };
    const themed = [];
    const added = [];
    const skipped = [];
    const scripts = [];
    const slotSpecs = [];
    let wantsMeter = false;

    for (const script of stockScripts) {
        // Scripts we appended on a previous apply are rebuilt from scratch below.
        if (isOwnedScript(script)) {
            continue;
        }

        const spec = getSpec(templateId, script.id);
        if (!spec) {
            scripts.push({ ...script });
            skipped.push(`${script.id}: no spec`);
            continue;
        }

        // A pattern that faces model output must match the shipped one byte for byte, or
        // the capture groups this spec maps may have been renumbered upstream.
        const stock = getStock(templateId, script.id);
        if (stock && !spec.regenerateFindRegex && script.findRegex !== stock.findRegex) {
            scripts.push({ ...script });
            skipped.push(`${script.id}: findRegex differs from baseline`);
            continue;
        }

        if (spec.archetype === ARCHETYPES.PASSTHROUGH) {
            scripts.push({ ...script });
            continue;
        }

        if (spec.archetype === ARCHETYPES.CLEANUP) {
            const target = getSpec(templateId, spec.cleanupFor);
            const findRegex = target ? buildCleanupFindRegex(target, theme, merged) : null;
            scripts.push(findRegex ? { ...script, findRegex, replaceString: '' } : { ...script });
            if (findRegex) {
                themed.push(script.id);
            }
            continue;
        }

        const replaceString = buildReplaceString(spec, theme, merged);
        scripts.push({ ...script, replaceString });
        themed.push(script.id);

        if (spec.archetype === ARCHETYPES.SLOTS && spec.key !== 'choices') {
            // The CYOA agent ships its own cleanup script; the direction menu and parallel
            // tracker do not, so they need one appended.
            slotSpecs.push(spec);
        }
        if (spec.archetype === ARCHETYPES.STATCARD && merged.meters) {
            wantsMeter = true;
        }
    }

    if (merged.cleanupScripts !== false) {
        for (const spec of slotSpecs) {
            const cleanup = buildExtraCleanupScript(agentId, spec, theme, merged);
            if (cleanup) {
                scripts.push(cleanup);
                added.push(cleanup.id);
            }
        }
    }

    if (wantsMeter) {
        const meter = buildMeterScript(agentId, theme, merged);
        scripts.push(meter);
        added.push(meter.id);
    }

    return { scripts, themed, added, skipped };
}

/**
 * Restores a script list to the shipped baseline, dropping everything this extension
 * appended. `overrides` supplies text captured from genuine hand edits.
 */
export function revertAgentScripts(templateId, currentScripts, overrides = {}) {
    const scripts = [];
    for (const script of currentScripts) {
        if (isOwnedScript(script)) {
            continue;
        }
        const stock = getStock(templateId, script.id);
        const override = overrides[script.id];
        if (override) {
            scripts.push({ ...script, ...override });
        } else if (stock) {
            scripts.push({ ...script, findRegex: stock.findRegex, replaceString: stock.replaceString });
        } else {
            scripts.push({ ...script });
        }
    }
    return scripts;
}

export { ownedScriptId };
