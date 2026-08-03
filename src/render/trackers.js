/**
 * Renderers for the five tracker archetypes: panel, profile, slots, statcard, chip.
 * Each takes a spec plus resolved tokens and returns a single-line `replaceString`.
 */

import { accentAt, alpha } from '../tokens.js';
import {
    bodyPanel, chip, collapsible, decl, headerChip, pairSlot, part, pill,
    row, section, slot, statTile,
} from './parts.js';

/** Archetypes A and B: a header chip over one or two body rows. */
export function renderPanel(spec, tokens, options) {
    const rows = spec.rows
        .map((rowSpec, index) => row(rowSpec, tokens, spec.accent, index))
        .join('');
    const open = resolveOpen(spec, options);
    return collapsible(spec, tokens, headerChip(spec, tokens) + bodyPanel(tokens, rows), { open });
}

/** Archetype C: a header chip over a stack of labelled sections. */
export function renderProfile(spec, tokens, options) {
    const open = resolveOpen(spec, options);

    if (spec.tier === 'minor') {
        // The minor tier is degenerate in stock: one compact row with bullet-separated
        // fragments rather than a section per field.
        const bullet = tokens.glyph.bullet ? `${tokens.glyph.bullet} ` : '';
        const inner = spec.sections
            .map((sectionSpec, index) => (index === 0
                ? `<span${part('section-value')}>$${sectionSpec.g}</span>`
                : `<br><span${part('section-value')}${decl({ color: tokens.ink.muted })}>${bullet}$${sectionSpec.g}</span>`))
            .join('');
        const compact = `<div${part('row')}${decl({
            padding: `${tokens.space.rowPadY} ${tokens.space.rowPadX}`,
            background: tokens.surface.row,
            'border-radius': tokens.radius.row,
            'overflow-wrap': 'anywhere',
        })}>${inner}</div>`;
        return collapsible(spec, tokens, headerChip(spec, tokens) + bodyPanel(tokens, compact), { open });
    }

    const sections = spec.sections
        .map((sectionSpec, index) => section(sectionSpec, tokens, { tier: spec.tier, index }))
        .join('');
    return collapsible(spec, tokens, headerChip(spec, tokens) + bodyPanel(tokens, sections), { open });
}

/**
 * Archetype D: a header chip over a fixed number of slots. Unmatched groups interpolate
 * to an empty string, so unused slots must render as removable empty elements.
 */
export function renderSlots(spec, tokens, options) {
    const open = resolveOpen(spec, options);
    const slots = spec.slots.map((slotSpec, index) => {
        const accentIndex = spec.rainbow ? spec.accent + index : spec.accent;
        return spec.kv
            ? pairSlot(slotSpec, tokens, accentIndex, index)
            : slot(slotSpec, tokens, accentIndex, index);
    }).join('');

    return collapsible(spec, tokens, headerChip(spec, tokens) + bodyPanel(tokens, slots), { open });
}

/** Archetype E: a responsive stat grid, a condition pill, and a change row. */
export function renderStatcard(spec, tokens, options) {
    const open = resolveOpen(spec, options);

    const grid = `<div${part('grid')}${decl({
        display: 'grid',
        'grid-template-columns': 'repeat(auto-fit,minmax(120px,1fr))',
        gap: tokens.space.gap,
        'margin-bottom': tokens.space.gap,
    })}>${spec.stats.map(statSpec => statTile(statSpec, tokens, options)).join('')}</div>`;

    const accent = accentAt(tokens, spec.accent);
    const conditionRow = spec.pill
        ? `<div${part('row')}${decl({
            padding: `${tokens.space.rowPadY} ${tokens.space.rowPadX}`,
            background: tokens.surface.row,
            'border-left': tokens.line.edgeSide === 'none' ? '' : `${tokens.line.edge} ${tokens.line.style} ${accent}`,
            'border-radius': tokens.radius.row,
            'margin-bottom': tokens.space.rowGap,
        })}>`
            + `<span${part('row-label')}${decl({ color: tokens.ink.label, 'font-size': tokens.type.labelSize })}>`
            + `${tokens.glyph.section ? `${tokens.glyph.section} ` : ''}${spec.pill.label}:</span> `
            + pill(`$${spec.pill.g}`, tokens, accent)
            + '</div>'
        : '';

    const rows = spec.rows.map(rowSpec => row(rowSpec, tokens, spec.accent, 0)).join('');

    return collapsible(
        spec,
        tokens,
        headerChip(spec, tokens) + bodyPanel(tokens, grid + conditionRow + rows),
        { open },
    );
}

/** Archetype F: an inline chip. Stock uses a span for references and a div for changes. */
export function renderChip(spec, tokens) {
    return chip(spec, tokens, { tag: spec.key === 'npc-rel' ? 'div' : 'span' });
}

/**
 * `openDefaults` lets a user override every panel's initial state; 'theme' keeps whatever
 * the spec inherited from stock.
 */
function resolveOpen(spec, options = {}) {
    switch (options.openDefaults) {
        case 'all-open': return true;
        case 'all-closed': return false;
        default: return Boolean(spec.open);
    }
}

export { resolveOpen };
