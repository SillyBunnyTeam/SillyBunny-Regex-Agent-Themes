import assert from 'node:assert/strict';
import test from 'node:test';

import { contrastRatio, parseColor } from '../src/color.js';
import { validateCustomTheme } from '../src/custom-themes.js';
import { THEMES } from '../src/themes/index.js';
import { alpha, resolveTheme } from '../src/tokens.js';

const OPTION_SETS = [
    {},
    { density: 'compact' },
    { density: 'roomy' },
    { adaptiveNeutrals: true },
];

function minimumContrast(foreground, backgrounds) {
    const parsed = parseColor(foreground);
    assert.ok(parsed, `unparseable semantic foreground: ${foreground}`);
    assert.equal(parsed.a, 1, `semantic foreground is translucent: ${foreground}`);
    return Math.min(...backgrounds.map(background => {
        assert.equal(background.a, 1, 'contrast surface is not opaque');
        return contrastRatio(parsed, background);
    }));
}

function remSize(value) {
    const match = /^(\d*\.?\d+)(px|rem|em)$/.exec(value);
    assert.ok(match, `unparseable type size: ${value}`);
    return match[2] === 'px' ? Number(match[1]) / 16 : Number(match[1]);
}

test('every semantic foreground passes its contrast gate across all themes and densities', () => {
    assert.equal(THEMES.length, 48);
    for (const theme of THEMES) {
        for (const options of OPTION_SETS) {
            const tokens = resolveTheme(theme, options);
            for (const check of tokens.a11y.checks) {
                const ratio = minimumContrast(check.foreground, check.backgrounds);
                assert.ok(
                    ratio + 1e-9 >= check.minimum,
                    `${theme.slug}/${JSON.stringify(options)}/${check.role}: ${ratio} < ${check.minimum}`,
                );
            }
        }
    }
});

test('a hostile same-colour custom palette receives a bounded readable surface', () => {
    const result = validateCustomTheme('same-colour', {
        slug: 'same-colour',
        name: 'Same Colour',
        mode: 'dark',
        surface: {
            headFrom: '#777777', headTo: '#777777', bodyFrom: '#777777',
            bodyTo: '#777777', row: '#777777', rowAlt: '#777777', chip: '#777777',
        },
        ink: {
            head: '#777777', body: '#777777', label: '#777777', muted: '#777777',
            strong: '#777777', warm: '#777777', cool: '#777777',
        },
        accents: Array(7).fill('#777777'),
    });
    assert.equal(result.ok, true, result.reason);

    const tokens = resolveTheme(result.theme, {});
    assert.ok(tokens.a11y.scrim, 'unsafe palette did not activate its safety layer');
    for (const check of tokens.a11y.checks) {
        assert.ok(minimumContrast(check.foreground, check.backgrounds) >= check.minimum);
    }
});

test('literal and dynamic alpha values preserve the requested opacity', () => {
    assert.equal(alpha('rgba(10,20,30,0.5)', 0.2), 'rgba(10,20,30,0.1)');
    assert.equal(alpha('#33669980', 0.5), 'rgba(51,102,153,0.251)');
    assert.match(alpha('oklch(60% .1 120 / .5)', 0.5), /^rgba\(.+,0\.25\)$/);
    assert.equal(
        alpha('var(--SmartThemeQuoteColor, #bd93f9)', 0.2),
        'color-mix(in srgb, var(--SmartThemeQuoteColor, #bd93f9) 20%, transparent)',
    );
    assert.equal(
        alpha('color-mix(in srgb, #fff 50%, #000)', 0.25),
        'color-mix(in srgb, color-mix(in srgb, #fff 50%, #000) 25%, transparent)',
    );
});

test('compact density preserves readable type floors', () => {
    for (const theme of THEMES) {
        const type = resolveTheme(theme, { density: 'compact' }).type;
        assert.ok(remSize(type.headSize) >= 0.8, `${theme.slug}: head ${type.headSize}`);
        assert.ok(remSize(type.bodySize) >= 0.8, `${theme.slug}: body ${type.bodySize}`);
        assert.ok(remSize(type.valueSize) >= 0.8, `${theme.slug}: value ${type.valueSize}`);
        assert.ok(remSize(type.labelSize) >= 0.75, `${theme.slug}: label ${type.labelSize}`);
        assert.ok(remSize(type.chipSize) >= 0.75, `${theme.slug}: chip ${type.chipSize}`);
    }
});
