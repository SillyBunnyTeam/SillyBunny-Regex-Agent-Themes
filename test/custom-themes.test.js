import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CUSTOM_THEME_FORMAT,
    CUSTOM_THEME_LIMITS,
    CUSTOM_THEME_VERSION,
    createCustomThemeExport,
    parseCustomThemeImport,
    prepareCustomThemeImport,
    validateCustomTheme,
    validateCustomThemeMap,
} from '../src/custom-themes.js';
import { ARCHETYPES, SPECS } from '../src/specs.js';
import { buildReplaceString } from '../src/render/index.js';
import { HOST, mix } from '../src/tokens.js';

const RICH_THEME = {
    name: 'Quiet Harbor',
    mode: 'light',
    surface: {
        headFrom: '#234567', headTo: '#345678', bodyFrom: '#f5f7fa', bodyTo: '#eef1f4',
        row: 'rgba(35,69,103,0.08)', chip: '#dce6ef',
    },
    ink: {
        head: '#f7fbff', body: '#18242f', label: '#234567', muted: '#526574',
        strong: '#101820', warm: '#8a4f20', cool: '#1f6673',
    },
    line: { head: '#345678', body: '#a8b6c2', row: 'transparent', width: '1px', edge: '3px' },
    shadow: { head: '0 6px 18px rgba(20,40,60,0.24)', body: 'none' },
    accents: ['#345678', '#287080', '#846228', '#8a4f20', '#31704a', '#4d6090', '#7b4778'],
    radius: { head: '10px', body: '10px', row: '7px', slot: '6px', pill: '999px' },
    space: { bodyPad: '4px 10px 12px', gap: '8px', rowGap: '4px' },
    type: {
        family: '"Inter", system-ui, sans-serif', bodyFamily: 'inherit', headSize: '12px',
        bodySize: '12px', lineHeight: '1.5', headWeight: '700', headCase: 'uppercase',
        headTracking: '0.08em',
    },
    glyph: { section: '◆', sectionAlt: '◇', bullet: '·', sep: '•', chevron: '▾' },
    frame: 'brackets',
    scan: { color: 'rgba(35,69,103,0.05)', size: '6px' },
    speakerHue: false,
};

test('partial and rich custom themes are canonicalized without unsafe escape hatches', () => {
    assert.deepEqual(validateCustomTheme('my-theme', { name: 'My Theme' }), {
        ok: true,
        theme: {
            slug: 'my-theme', name: 'My Theme', family: 'custom', mode: 'dark',
        },
    });

    const rich = validateCustomTheme('quiet-harbor', RICH_THEME);
    assert.equal(rich.ok, true, rich.reason);
    assert.equal(rich.theme.family, 'custom');
    assert.equal(rich.theme.accents.length, 7);
    assert.equal(rich.theme.space.bodyPad, '4px 10px 12px');
    assert.equal(Object.hasOwn(rich.theme, 'css'), false);
});

test('validated custom themes render across every markup archetype', () => {
    const { theme } = validateCustomTheme('quiet-harbor', RICH_THEME);
    let generated = 0;
    for (const spec of SPECS) {
        if ([ARCHETYPES.PASSTHROUGH, ARCHETYPES.CLEANUP].includes(spec.archetype)) continue;
        const output = buildReplaceString(spec, theme, {
            meters: true,
            restyleBold: true,
            adaptiveNeutrals: true,
        });
        assert.equal(typeof output, 'string', spec.key);
        assert.ok(output.length < 16000, `${spec.key}: ${output.length}`);
        assert.ok(!/<script|\son[a-z]+\s*=|javascript:|url\s*\(/iu.test(output), spec.key);
        assert.ok(!output.replaceAll('{{user}}', '').includes('{{'), spec.key);
        generated++;
    }
    assert.equal(generated, 32);
});

test('adaptive themes accept only the documented host colors with literal fallbacks', () => {
    const adaptive = validateCustomTheme('host-quiet', {
        mode: 'adaptive',
        surface: { row: mix(HOST.body, 'transparent', 8) },
        ink: { body: HOST.body },
        shadow: { head: `0 8px 20px ${mix(HOST.shadow, 'transparent', 24)}` },
        type: { family: HOST.font },
    });
    assert.equal(adaptive.ok, true, adaptive.reason);

    assert.equal(validateCustomTheme('host-wrong-mode', {
        mode: 'light', surface: { row: HOST.body },
    }).ok, false);
    assert.equal(validateCustomTheme('host-unknown-var', {
        mode: 'adaptive', surface: { row: 'var(--private-token, #fff)' },
    }).ok, false);
    assert.equal(validateCustomTheme('host-bad-mix', {
        mode: 'adaptive', surface: { row: 'color-mix(in display-p3, #fff 50%, #000)' },
    }).ok, false);
});

test('HTML, raw CSS, URLs, macros, placeholders, controls, and unknown keys are rejected', () => {
    const attacks = [
        { glyph: { section: '<img src=x>' } },
        { surface: { row: '#fff;position:fixed' } },
        { surface: { row: 'url(https://example.invalid/a)' } },
        { glyph: { section: '{{user}}' } },
        { glyph: { section: '$1' } },
        { name: 'bad\u0000name' },
        { css: '[data-rat]{display:none}' },
        { extra: { body: 'display:none' } },
        { ornament: { headerBefore: '<b>unsafe</b>' } },
        { surface: { row: '#fff', surprise: '#000' } },
        { type: { family: 'url(https://example.invalid/font)' } },
        { name: '<b>Theme</b>' },
    ];
    for (const [index, attack] of attacks.entries()) {
        const result = validateCustomTheme(`attack-${index}`, attack);
        assert.equal(result.ok, false, `attack ${index} was accepted`);
    }
});

test('reserved slugs, prototype keys, malformed ramps, and partial terminal palettes are rejected', () => {
    for (const slug of ['stock', 'constructor', 'neon-grid', '-leading', 'trailing-', 'two--hyphens']) {
        assert.equal(validateCustomTheme(slug, {}).ok, false, slug);
    }
    assert.equal(validateCustomTheme('bad-ramp', { accents: Array(6).fill('#123456') }).ok, false);
    assert.equal(validateCustomTheme('bad-term', { term: { bg: '#000000' } }).ok, false);
    assert.equal(validateCustomTheme('bad-tree', JSON.parse('{"constructor":{"x":1}}')).ok, false);

    const map = validateCustomThemeMap(JSON.parse('{"__proto__":{"name":"Bad"},"safe-theme":{"name":"Safe"}}'));
    assert.deepEqual(map.accepted, ['safe-theme']);
    assert.equal(map.rejected.length, 1);
});

test('the versioned import reports overwrites and rejected themes before mutation', () => {
    const payload = {
        format: CUSTOM_THEME_FORMAT,
        version: CUSTOM_THEME_VERSION,
        themes: {
            existing: { name: 'Replacement', surface: { row: '#123456' } },
            fresh: { name: 'Fresh', mode: 'light' },
            unsafe: { css: 'body{display:none}' },
        },
    };
    const plan = prepareCustomThemeImport(payload, { existing: { name: 'Original' } });
    assert.equal(plan.ok, true);
    assert.deepEqual(plan.accepted, ['existing', 'fresh']);
    assert.deepEqual(plan.overwritten, ['existing']);
    assert.deepEqual(plan.rejected.map(item => item.slug), ['unsafe']);
    assert.equal(plan.themes.existing.name, 'Replacement');
    assert.equal(plan.themes.fresh.family, 'custom');

    const exportPayload = createCustomThemeExport(plan.themes);
    assert.equal(exportPayload.format, CUSTOM_THEME_FORMAT);
    assert.equal(exportPayload.version, CUSTOM_THEME_VERSION);
    assert.deepEqual(Object.keys(exportPayload.themes), ['existing', 'fresh']);
});

test('wrong formats, malformed JSON, oversized files, and excess theme counts are rejected', () => {
    assert.equal(prepareCustomThemeImport({ format: 'other', version: 1, themes: {} }).ok, false);
    assert.equal(prepareCustomThemeImport({
        format: CUSTOM_THEME_FORMAT, version: 2, themes: {}, extra: true,
    }).ok, false);
    assert.equal(parseCustomThemeImport('{bad json').ok, false);
    assert.equal(parseCustomThemeImport('x'.repeat(CUSTOM_THEME_LIMITS.fileBytes + 1)).ok, false);

    const themes = {};
    for (let index = 0; index < CUSTOM_THEME_LIMITS.themes + 1; index++) {
        themes[`theme-${index}`] = { name: `Theme ${index}` };
    }
    const result = validateCustomThemeMap(themes);
    assert.equal(result.accepted.length, CUSTOM_THEME_LIMITS.themes);
    assert.equal(result.rejected.length, 1);
});
