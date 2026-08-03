/**
 * Classifies what happened to a script since this extension last wrote it.
 *
 * This is the safety layer around the one thing that will definitely happen in normal use:
 * In-Chat Agents' version pill and "Update All" button rebuild an agent from its template
 * (in-chat-agents/index.js:1288), discarding `regexScripts` entirely. The recovery rule is
 * deliberately narrow — re-apply only when the current text is byte-identical to something
 * we recognise as stock, never when it might be a hand edit.
 *
 * Pure functions only, so the whole table is unit-testable without a DOM.
 */

import { STOCK_REPLACE_STRINGS, getStock } from './stock.js';

export const STATUS = Object.freeze({
    PRISTINE: 'pristine',
    OUTDATED: 'outdated',
    STOCK: 'stock',
    FOREIGN: 'foreign',
    MISSING: 'missing',
    UPSTREAM_CHANGED: 'upstream-changed',
});

/** Statuses that may be rewritten without asking. */
export const AUTO_APPLY = Object.freeze([STATUS.STOCK, STATUS.OUTDATED]);

/**
 * @param {object} params
 * @param {object|null} params.script The agent's current script, or null if absent.
 * @param {object} params.spec Its spec.
 * @param {string|null} params.expected What the current theme and options would produce.
 * @param {object} [params.ledgerEntry] What we recorded when we last wrote it.
 * @returns {string} A STATUS value.
 */
export function classifyScript({ script, spec, expected, ledgerEntry }) {
    if (!script) {
        return STATUS.MISSING;
    }

    const stock = getStock(spec.templateId, spec.scriptId);

    // A pattern that faces model output must match the shipped one, or the capture groups
    // this spec maps may have been renumbered upstream.
    if (stock && !spec.regenerateFindRegex && script.findRegex !== stock.findRegex) {
        return STATUS.UPSTREAM_CHANGED;
    }

    const current = script.replaceString ?? '';

    if (expected !== null && current === expected) {
        return STATUS.PRISTINE;
    }

    if (stock && current === stock.replaceString) {
        return STATUS.STOCK;
    }

    // Any stock string from any template also counts as stock — templates share markup.
    if (STOCK_REPLACE_STRINGS.has(current)) {
        return STATUS.STOCK;
    }

    // We wrote this before, under a different theme, engine version or option set.
    if (ledgerEntry?.applied && ledgerEntry.applied === current) {
        return STATUS.OUTDATED;
    }

    if (ledgerEntry?.generated?.includes(current)) {
        return STATUS.OUTDATED;
    }

    return STATUS.FOREIGN;
}

/**
 * Rolls per-script statuses into one verdict for an agent, worst-first, so the UI can show
 * a single badge per row.
 */
export function summarizeStatuses(statuses) {
    const order = [
        STATUS.UPSTREAM_CHANGED,
        STATUS.FOREIGN,
        STATUS.MISSING,
        STATUS.OUTDATED,
        STATUS.STOCK,
        STATUS.PRISTINE,
    ];
    for (const status of order) {
        if (statuses.includes(status)) {
            return status;
        }
    }
    return STATUS.PRISTINE;
}

export function isAutoApplicable(status) {
    return AUTO_APPLY.includes(status);
}
