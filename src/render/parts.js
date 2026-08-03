/**
 * Shared markup builders. Every renderer composes these, so geometry and hook naming stay
 * consistent across all nine archetypes.
 *
 * Two hard rules, both enforced by test/invariants.test.js:
 *  1. Output is a single line. A blank line inside a replaceString risks the markdown
 *     converter wrapping fragments in <p>. The terminal archetype is the one exception and
 *     confines its newlines to a pre-wrap region.
 *  2. Styling hooks are `data-rat-*` attributes, never class names. A DOMPurify hook
 *     (public/scripts/chats.js:1916) rewrites every class in message HTML to
 *     `custom-<name>`, so a `.rat-*` selector in style.css would be dead. Classes are
 *     still emitted for users who want to write their own CSS — against `.custom-rat-*`.
 */

import { ENGINE_VERSION } from '../constants.js';
import { accentAt, alpha, toneColor } from '../tokens.js';

/**
 * Style attributes are emitted double-quoted, so a double quote inside a value would end
 * the attribute early. Font stacks are the usual offender (`font-family:"Inter", …`), so
 * every value is normalized to single quotes here rather than in each theme.
 */
export function safeValue(value) {
    return String(value).replace(/"/g, '\'');
}

/** Serializes a declaration map into a style attribute, dropping empty values. */
export function decl(map) {
    const parts = [];
    for (const [property, value] of Object.entries(map)) {
        if (value === null || value === undefined || value === '' || value === false) {
            continue;
        }
        parts.push(`${property}:${safeValue(value)}`);
    }
    return parts.length ? ` style="${parts.join(';')}"` : '';
}

/** Root element attributes: the theme marker, the archetype, and the tracker key. */
export function rootAttrs(spec, tokens) {
    const classes = ['rat', `rat-${spec.archetype}`, `rat-k-${spec.key}`, `rat-tm-${tokens.slug}`];
    return ` data-rat="${tokens.slug}@${ENGINE_VERSION}" data-rat-arch="${spec.archetype}"`
        + ` data-rat-key="${spec.key}" class="${classes.join(' ')}"`;
}

export function part(name) {
    return ` data-rat-part="${name}"`;
}

function ornament(tokens, anchor) {
    return tokens.ornament?.[anchor] ?? '';
}

function extra(tokens, name) {
    return tokens.extra?.[name] ?? '';
}

/** Appends a theme's verbatim declaration appendix to a serialized style attribute. */
function withExtra(styleAttr, tokens, name) {
    const appendix = safeValue(extra(tokens, name) ?? '');
    if (!appendix) {
        return styleAttr;
    }
    if (!styleAttr) {
        return ` style="${appendix}"`;
    }
    return styleAttr.replace(/"$/, `;${appendix}"`);
}

/** The background stack for a surface, with the theme's optional scan layer on top. */
function surfaceBackground(tokens, from, to, angle = '180deg') {
    const base = from === to ? from : `linear-gradient(${angle},${from},${to})`;
    if (!tokens.scan) {
        return base;
    }
    const { color, size } = tokens.scan;
    return `repeating-linear-gradient(0deg,${color} 0,${color} 1px,transparent 1px,transparent ${size}),${base}`;
}

function borderValue(tokens, color) {
    return `${tokens.line.width} ${tokens.line.style} ${color}`;
}

/** Corner brackets, rivets, ticks and friends. Returns HTML for the root's before-anchor. */
export function frameDecoration(tokens, accent) {
    switch (tokens.frame) {
        case 'brackets': {
            const style = (corners) => decl({
                position: 'absolute', width: '9px', height: '9px', ...corners,
                'pointer-events': 'none',
            });
            const line = `2px solid ${accent}`;
            return `<span aria-hidden="true"${style({ top: '-1px', left: '-1px', 'border-top': line, 'border-left': line })}></span>`
                + `<span aria-hidden="true"${style({ top: '-1px', right: '-1px', 'border-top': line, 'border-right': line })}></span>`
                + `<span aria-hidden="true"${style({ bottom: '-1px', left: '-1px', 'border-bottom': line, 'border-left': line })}></span>`
                + `<span aria-hidden="true"${style({ bottom: '-1px', right: '-1px', 'border-bottom': line, 'border-right': line })}></span>`;
        }
        case 'rivets': {
            const dot = `radial-gradient(circle,${alpha(accent, 0.9)} 0 42%,${alpha(accent, 0.15)} 45%,transparent 60%)`;
            return `<span aria-hidden="true"${decl({
                position: 'absolute', inset: '3px', 'pointer-events': 'none',
                background: `${dot},${dot},${dot},${dot}`,
                'background-size': '8px 8px',
                'background-position': 'left top,right top,left bottom,right bottom',
                'background-repeat': 'no-repeat',
            })}></span>`;
        }
        case 'ticks': {
            return `<span aria-hidden="true"${decl({
                position: 'absolute', left: '0', right: '0', top: '0', height: '4px',
                'pointer-events': 'none',
                background: `repeating-linear-gradient(90deg,${alpha(accent, 0.7)} 0 1px,transparent 1px,transparent 7px)`,
            })}></span>`;
        }
        case 'halftone': {
            return `<span aria-hidden="true"${decl({
                position: 'absolute', inset: '0', 'pointer-events': 'none', opacity: '0.5',
                background: `radial-gradient(${alpha(accent, 0.35)} 22%,transparent 23%)`,
                'background-size': '5px 5px',
            })}></span>`;
        }
        default:
            return '';
    }
}

function needsPositioning(tokens) {
    return ['brackets', 'rivets', 'ticks', 'halftone'].includes(tokens.frame);
}

/**
 * Renders one header field: an optional icon, an optional label, then the value.
 * `glue` overrides the separator that follows this field.
 */
function headField(field, tokens) {
    const pieces = [];
    if (field.icon) {
        pieces.push(`<span aria-hidden="true">${field.icon}</span> `);
    }
    if (field.label) {
        pieces.push(`<span${decl({ opacity: '0.72' })}>${field.label}:</span> `);
    }
    if (field.text) {
        pieces.push(field.text);
    } else if (field.arrow) {
        pieces.push(`<span aria-hidden="true"${decl({ opacity: '0.72' })}>${tokens.glyph.arrow}</span> $${field.g}`);
    } else {
        pieces.push(`$${field.g}`);
    }
    return pieces.join('');
}

/** Joins header fields with the theme separator, honouring per-field `glue`. */
export function headContent(spec, tokens) {
    const separator = tokens.glyph.sep
        ? `<span aria-hidden="true"${decl({ opacity: '0.55' })}> ${tokens.glyph.sep} </span>`
        : ' ';
    const out = [];
    spec.head.forEach((field, index) => {
        if (index > 0) {
            out.push(spec.head[index - 1].glue ?? separator);
        }
        out.push(headField(field, tokens));
    });
    return out.join('');
}

/** The chevron a collapsible header shows, when the theme uses one. */
export function chevron(tokens) {
    if (!tokens.glyph.chevron) {
        return '';
    }
    return `<span aria-hidden="true"${part('chevron')}${decl({
        'margin-left': '6px', opacity: '0.6', display: 'inline-block',
    })}>${tokens.glyph.chevron}</span>`;
}

/** The `<summary>` of a collapsible panel: a header chip welded to the body below it. */
export function headerChip(spec, tokens, { welded = true, showChevron = true } = {}) {
    const accent = accentAt(tokens, spec.accent);
    const radius = welded
        ? `${tokens.radius.head} ${tokens.radius.head} 0 0`
        : tokens.radius.head;

    const style = withExtra(decl({
        display: 'block',
        padding: `${tokens.space.headPadY} ${tokens.space.headPadX}`,
        background: surfaceBackground(tokens, tokens.surface.headFrom, tokens.surface.headTo, '135deg'),
        'border-radius': radius,
        border: borderValue(tokens, tokens.line.head),
        'box-shadow': tokens.shadow.head,
        color: tokens.ink.head,
        'font-family': tokens.type.family,
        'font-size': tokens.type.headSize,
        'font-weight': tokens.type.headWeight,
        'text-transform': tokens.type.headCase === 'none' ? '' : tokens.type.headCase,
        'letter-spacing': tokens.type.headTracking === 'normal' ? '' : tokens.type.headTracking,
        cursor: 'pointer',
        position: needsPositioning(tokens) ? 'relative' : '',
        'list-style': 'none',
    }), tokens, 'header');

    const icon = spec.icon ? `<span aria-hidden="true">${spec.icon}</span> ` : '';
    const inner = ornament(tokens, 'headerBefore')
        + icon + headContent(spec, tokens)
        + (showChevron ? chevron(tokens) : '')
        + ornament(tokens, 'headerAfter');

    return `<summary${part('header')}${style}>${inner}</summary>`;
}

/** The body panel under a header chip. Caller supplies the already-rendered children. */
export function bodyPanel(tokens, children, { welded = true } = {}) {
    const style = withExtra(decl({
        padding: tokens.space.bodyPad,
        background: surfaceBackground(tokens, tokens.surface.bodyFrom, tokens.surface.bodyTo),
        'border-radius': welded ? `0 0 ${tokens.radius.body} ${tokens.radius.body}` : tokens.radius.body,
        border: borderValue(tokens, tokens.line.body),
        'border-top': welded ? 'none' : '',
        'box-shadow': tokens.shadow.body === 'none' ? '' : tokens.shadow.body,
        color: tokens.ink.body,
        'font-family': tokens.type.bodyFamily,
        'font-size': tokens.type.bodySize,
        'line-height': tokens.type.lineHeight,
        position: needsPositioning(tokens) ? 'relative' : '',
    }), tokens, 'body');

    return `<div${part('body')}${style}>`
        + ornament(tokens, 'bodyBefore') + children + ornament(tokens, 'bodyAfter')
        + '</div>';
}

/** Accent rule declarations for a row, honouring the theme's edge side and width. */
function edgeDeclarations(tokens, accent) {
    if (tokens.line.edge === '0' || tokens.line.edgeSide === 'none') {
        return {};
    }
    const property = tokens.line.edgeSide === 'top' ? 'border-top' : 'border-left';
    return { [property]: `${tokens.line.edge} ${tokens.line.style} ${accent}` };
}

/**
 * One body row. `label` renders a leading glyph+label; `pre` preserves the model's line
 * breaks; `tint` washes the row in its accent instead of the neutral row colour.
 */
export function row(rowSpec, tokens, accentIndex, index = 0) {
    const accent = accentAt(tokens, accentIndex);
    const background = rowSpec.tint ? alpha(accent, 0.12) : tokens.surface.row;

    const style = withExtra(decl({
        padding: `${tokens.space.rowPadY} ${tokens.space.rowPadX}`,
        background,
        ...edgeDeclarations(tokens, accent),
        border: tokens.line.row === 'transparent' ? '' : borderValue(tokens, tokens.line.row),
        'border-radius': tokens.radius.row,
        'margin-top': index > 0 ? tokens.space.rowGap : '',
        'white-space': rowSpec.pre ? 'pre-line' : '',
        'overflow-wrap': 'anywhere',
    }), tokens, rowSpec.tint ? 'rowAlt' : 'row');

    const label = rowSpec.label
        ? `<span${part('row-label')}${decl({
            color: tokens.ink.label,
            'font-size': tokens.type.labelSize,
            'font-weight': tokens.type.labelWeight,
            'text-transform': tokens.type.labelCase === 'none' ? '' : tokens.type.labelCase,
        })}>${tokens.glyph.section ? `${tokens.glyph.section} ` : ''}${rowSpec.label}:</span> `
        : '';

    return `<div${part('row')}${style}>`
        + ornament(tokens, 'rowBefore')
        + label
        + `<span${part('row-value')}>$${rowSpec.g}</span>`
        + ornament(tokens, 'rowAfter')
        + '</div>';
}

/** A section block in the profile archetype: coloured label over its prose. */
export function section(sectionSpec, tokens, { tier, index }) {
    const accent = accentAt(tokens, sectionSpec.accent);
    const wash = tier === 'support' ? 0.07 : 0.1;
    const glyph = tier === 'support' || tier === 'upgrade' ? tokens.glyph.sectionAlt : tokens.glyph.section;

    const style = withExtra(decl({
        padding: `${tokens.space.rowPadY} ${tokens.space.rowPadX}`,
        background: alpha(accent, wash),
        ...edgeDeclarations(tokens, accent),
        'border-radius': tokens.radius.row,
        'margin-top': index > 0 ? tokens.space.gap : '',
        'overflow-wrap': 'anywhere',
    }), tokens, 'row');

    const label = sectionSpec.label
        ? `<b${part('section-label')}${decl({
            color: accent,
            'font-size': tokens.type.labelSize,
            'font-weight': tokens.type.labelWeight,
            'text-transform': tokens.type.labelCase === 'none' ? '' : tokens.type.labelCase,
        })}>${glyph ? `${glyph} ` : ''}${sectionSpec.label}</b><br>`
        : '';

    return `<div${part('section')}${style}>${label}`
        + `<span${part('section-value')}>$${sectionSpec.g}</span></div>`;
}

/**
 * A fixed slot in the list archetype. Slots may be empty when the model emits fewer
 * items than the pattern allows; an empty slot renders a genuinely childless element so
 * the `:empty` rule in style.css and the generated cleanup regex can both remove it.
 */
export function slot(slotSpec, tokens, accentIndex, index) {
    const accent = accentAt(tokens, accentIndex);
    const style = withExtra(decl({
        padding: `${tokens.space.slotPadY} ${tokens.space.slotPadX}`,
        background: tokens.surface.row,
        ...edgeDeclarations(tokens, accent),
        'border-radius': tokens.radius.slot,
        margin: `${tokens.space.rowGap} 0`,
        'overflow-wrap': 'anywhere',
    }), tokens, 'row');

    return `<div${part('slot')}${style}>$${slotSpec.g}</div>`;
}

/**
 * A label/value slot. The colon lives in ::after (style.css) rather than in the markup,
 * so an unmatched label cannot leave the bare `<b>:</b>` the stock parallel tracker shows.
 */
export function pairSlot(slotSpec, tokens, accentIndex, index) {
    const accent = accentAt(tokens, accentIndex);
    const style = withExtra(decl({
        padding: `${tokens.space.slotPadY} ${tokens.space.slotPadX}`,
        background: tokens.surface.row,
        ...edgeDeclarations(tokens, accent),
        'border-radius': tokens.radius.slot,
        margin: `${tokens.space.rowGap} 0`,
        'overflow-wrap': 'anywhere',
    }), tokens, 'row');

    return `<div${part('pair')}${style}>`
        + `<b${part('pair-label')}${decl({ color: tokens.ink.label, 'font-weight': tokens.type.labelWeight })}>$${slotSpec.k}</b>`
        + `<span${part('pair-value')}> $${slotSpec.v}</span></div>`;
}

/** A rounded pill, used for the relationship condition and inline chips. */
export function pill(text, tokens, accent) {
    return `<span${part('pill')}${decl({
        display: 'inline-block',
        padding: '3px 8px',
        'margin-top': '4px',
        'border-radius': tokens.radius.pill,
        border: borderValue(tokens, alpha(accent, 0.26)),
        background: alpha(accent, 0.18),
        color: tokens.ink.strong,
    })}>${text}</span>`;
}

/**
 * A stat tile. When `meter` is on, the value is wrapped in a marker span that the chained
 * meter script can rewrite into a bar; if the value is not `n/m` the span stays as text.
 */
export function statTile(statSpec, tokens, { meters }) {
    const accent = accentAt(tokens, statSpec.accent);
    const value = meters && statSpec.meter
        ? `<span${part('meter')} data-v="$${statSpec.g}"${decl({ 'font-weight': tokens.type.valueWeight })}>$${statSpec.g}</span>`
        : `$${statSpec.g}`;

    return `<div${part('stat')}${decl({
        padding: `${tokens.space.rowPadY} ${tokens.space.rowPadX}`,
        background: alpha(accent, 0.12),
        border: borderValue(tokens, alpha(accent, 0.22)),
        'border-radius': tokens.radius.row,
        'min-width': '0',
    })}>`
        + `<div${part('stat-label')}${decl({
            color: accent,
            'font-size': tokens.type.labelSize,
            'margin-bottom': '4px',
            'text-transform': tokens.type.labelCase === 'none' ? '' : tokens.type.labelCase,
        })}>${statSpec.glyph ? `${statSpec.glyph} ` : ''}${statSpec.label}</div>`
        + `<div${part('stat-value')}${decl({
            color: tokens.ink.strong,
            'font-weight': tokens.type.valueWeight,
            'font-size': tokens.type.valueSize,
            'overflow-wrap': 'anywhere',
        })}>${value}</div>`
        + '</div>';
}

/** An inline chip that flows inside prose. */
export function chip(spec, tokens, { tag = 'span' } = {}) {
    const accent = accentAt(tokens, spec.accent);
    const separator = tokens.glyph.chipSep
        ? `<span aria-hidden="true"${decl({ color: tokens.ink.muted })}> ${tokens.glyph.chipSep} </span>`
        : ' ';

    const fields = spec.fields.map((field, index) => {
        const color = toneColor(tokens, field.tone, spec.accent);
        const text = `$${field.g}${field.suffix ?? ''}`;
        return (index > 0 ? separator : '')
            + `<span${part('chip-field')}${decl({ color })}>${text}</span>`;
    }).join('');

    const style = withExtra(decl({
        display: 'inline-block',
        padding: '4px 9px',
        margin: '2px 4px 2px 0',
        background: `linear-gradient(90deg,${tokens.surface.chip},${alpha(accent, 0.1)})`,
        'border-radius': tokens.radius.chip,
        border: borderValue(tokens, alpha(accent, 0.28)),
        'box-shadow': tokens.shadow.chip === 'none' ? '' : tokens.shadow.chip,
        color: tokens.ink.body,
        'font-family': tokens.type.family,
        'font-size': tokens.type.chipSize,
        'overflow-wrap': 'anywhere',
    }), tokens, 'chip');

    const icon = spec.icon ? `<span aria-hidden="true"${decl({ color: accent })}>${spec.icon}</span> ` : '';
    return `<${tag}${rootAttrs(spec, tokens)}${part('root')}${style}>${icon}${fields}</${tag}>`;
}

/** Wraps a collapsible panel, applying the theme's root ornaments and frame. */
export function collapsible(spec, tokens, children, { open }) {
    const accent = accentAt(tokens, spec.accent);
    const style = withExtra(decl({
        margin: `${tokens.space.outer} 0`,
        position: needsPositioning(tokens) ? 'relative' : '',
        'container-type': 'inline-size',
    }), tokens, 'root');

    return `<details${rootAttrs(spec, tokens)}${part('root')}${style}${open ? ' open' : ''}>`
        + frameDecoration(tokens, accent)
        + ornament(tokens, 'rootBefore')
        + children
        + ornament(tokens, 'rootAfter')
        + '</details>';
}

export { surfaceBackground, borderValue, withExtra, ornament, needsPositioning };
