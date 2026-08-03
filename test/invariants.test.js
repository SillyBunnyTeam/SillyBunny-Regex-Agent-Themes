/**
 * The full theme x spec matrix, checked against the things SillyBunny's render pipeline
 * will silently mangle. Each assertion here corresponds to a real failure mode:
 *
 *  - `$` + digit is consumed by the regex interpolator (regex-scripts.js:235) before the
 *    string ever reaches the DOM, so a stray one deletes part of the CSS.
 *  - `{{…}}` is expanded by substituteParams.
 *  - A double quote inside a style attribute ends the attribute early.
 *  - Inline <style> selectors are rewritten `.foo` -> `.custom-foo` by decodeStyleTags
 *    while class attributes are rewritten the same way by a DOMPurify hook, so the two
 *    must be unprefixed on both sides to still match.
 *  - A blank line risks the markdown pass wrapping fragments in <p>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import css from '@adobe/css-tools';

import { ARCHETYPES, SPECS } from '../src/specs.js';
import { THEMES } from '../src/themes/index.js';
import { MULTILINE_ARCHETYPES, buildReplaceString } from '../src/render/index.js';
import { resolveTheme } from '../src/tokens.js';

const OPTION_SETS = [
    {},
    { meters: true, restyleBold: true },
    { density: 'compact', glyphs: 'none' },
    { density: 'roomy', adaptiveNeutrals: true, openDefaults: 'all-open' },
];

function eachGenerated(callback) {
    for (const theme of THEMES) {
        for (const spec of SPECS) {
            for (const options of OPTION_SETS) {
                const output = buildReplaceString(spec, theme, options);
                if (output !== null) {
                    callback(output, spec, theme, options);
                }
            }
        }
    }
}

test('the matrix is complete', () => {
    let generated = 0;
    eachGenerated(() => {
        generated++;
    });
    const markupSpecs = SPECS.filter(spec => spec.archetype !== ARCHETYPES.PASSTHROUGH
        && spec.archetype !== ARCHETYPES.CLEANUP).length;
    assert.equal(markupSpecs, 38);
    assert.equal(generated, THEMES.length * markupSpecs * OPTION_SETS.length);
});

test('no generated string contains an unintended group placeholder', () => {
    eachGenerated((output, spec, theme) => {
        const used = [...output.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
        for (const group of used) {
            assert.ok(
                group >= 1 && group <= spec.groups,
                `${theme.slug}/${spec.key}: uses $${group}, pattern has ${spec.groups} groups`,
            );
        }
        assert.ok(!/\$</.test(output), `${theme.slug}/${spec.key}: contains $<`);
    });
});

test('the only macro emitted is the user name', () => {
    eachGenerated((output, spec, theme) => {
        const stripped = output.replaceAll('{{user}}', '');
        assert.ok(!stripped.includes('{{'), `${theme.slug}/${spec.key}: unexpected macro`);
    });
});

test('style attributes never contain a double quote', () => {
    eachGenerated((output, spec, theme) => {
        for (const match of output.matchAll(/style="([^"]*)"/g)) {
            assert.ok(
                !match[1].includes('"'),
                `${theme.slug}/${spec.key}: quote inside a style attribute`,
            );
        }
        // A stray quote would leave an odd count.
        const quotes = (output.match(/"/g) ?? []).length;
        assert.equal(quotes % 2, 0, `${theme.slug}/${spec.key}: unbalanced quotes`);
    });
});

test('only the terminal archetype spans multiple lines', () => {
    eachGenerated((output, spec, theme) => {
        if (MULTILINE_ARCHETYPES.includes(spec.archetype)) {
            return;
        }
        assert.ok(!output.includes('\n'), `${theme.slug}/${spec.key}: contains a newline`);
    });
});

test('tags are balanced', () => {
    const VOID = new Set(['br', 'hr', 'img', 'input']);
    eachGenerated((output, spec, theme) => {
        // Stream shells open elements that their matching close script finishes, so they are
        // unbalanced by design; test/integration.test.js checks those as a set instead.
        if (spec.archetype === ARCHETYPES.STREAM) {
            return;
        }
        const body = output.replace(/<style>[\s\S]*?<\/style>/g, '');
        const stack = [];
        for (const match of body.matchAll(/<(\/?)([a-z]+)\b[^>]*?(\/?)>/g)) {
            const [, closing, tag, selfClosing] = match;
            if (VOID.has(tag) || selfClosing) {
                continue;
            }
            if (closing) {
                assert.equal(stack.pop(), tag, `${theme.slug}/${spec.key}: mismatched </${tag}>`);
            } else {
                stack.push(tag);
            }
        }
        assert.equal(stack.length, 0, `${theme.slug}/${spec.key}: unclosed ${stack.join(', ')}`);
    });
});

test('every emitted style block parses and keeps its selectors matchable', () => {
    eachGenerated((output, spec, theme) => {
        const blocks = [...output.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]);
        if (spec.archetype !== ARCHETYPES.TERMINAL) {
            assert.equal(blocks.length, 0, `${theme.slug}/${spec.key}: unexpected style block`);
            return;
        }
        assert.equal(blocks.length, 1);

        // decodeStyleTags runs the block through this same parser; a parse error would put
        // the literal text "CSS ERROR:" in the user's chat.
        const ast = css.parse(blocks[0]);
        assert.ok(ast.stylesheet.rules.length > 0);

        // Selectors must not be pre-prefixed, or the rewrite makes them custom-custom-*.
        assert.ok(!blocks[0].includes('.custom-'), `${theme.slug}/${spec.key}: pre-prefixed selector`);
        assert.ok(!blocks[0].includes('@import'), 'CSS @import is stripped by the sanitizer');
        assert.ok(!blocks[0].includes('://'), 'declarations containing :// are stripped');

        // Every class the markup uses must have a rule, and vice versa.
        const markupClasses = new Set(
            [...output.matchAll(/class="([^"]+)"/g)]
                .flatMap(match => match[1].split(/\s+/))
                .filter(name => name.startsWith('rat-tw')),
        );
        assert.ok(markupClasses.size > 0);
        for (const name of markupClasses) {
            assert.ok(blocks[0].includes(`.${name}`), `${theme.slug}: no rule for .${name}`);
        }
    });
});

test('backdrop-filter always ships its webkit companion', () => {
    eachGenerated((output, spec, theme) => {
        const plain = (output.match(/(?<!-webkit-)backdrop-filter/g) ?? []).length;
        const prefixed = (output.match(/-webkit-backdrop-filter/g) ?? []).length;
        assert.ok(
            plain <= prefixed,
            `${theme.slug}/${spec.key}: ${plain} backdrop-filter vs ${prefixed} prefixed`,
        );
    });
});

test('no generated string carries a script or event handler', () => {
    eachGenerated((output, spec, theme) => {
        assert.ok(!/<script/i.test(output), `${theme.slug}/${spec.key}: script tag`);
        assert.ok(!/\son[a-z]+\s*=/i.test(output), `${theme.slug}/${spec.key}: inline handler`);
        assert.ok(!/javascript:/i.test(output), `${theme.slug}/${spec.key}: javascript: URL`);
    });
});

test('generated strings stay within a sane size', () => {
    eachGenerated((output, spec, theme) => {
        assert.ok(output.length < 16000, `${theme.slug}/${spec.key}: ${output.length} bytes`);
    });
});

test('every theme resolves to a complete token set', () => {
    for (const theme of THEMES) {
        const tokens = resolveTheme(theme, {});
        assert.ok(tokens.accents.length >= 7, `${theme.slug}: needs at least 7 accents`);
        assert.ok(tokens.term, `${theme.slug}: no terminal palette derived`);

        for (const group of ['surface', 'ink', 'line', 'radius', 'space', 'type', 'glyph']) {
            assert.ok(tokens[group] && typeof tokens[group] === 'object', `${theme.slug}: missing ${group}`);
        }
        for (const [key, value] of Object.entries(tokens.ink)) {
            assert.ok(typeof value === 'string' && value.length > 0, `${theme.slug}: ink.${key} empty`);
        }
        assert.ok(theme.name, `${theme.slug}: no display name`);
        assert.ok(theme.family, `${theme.slug}: no family`);
        assert.match(theme.slug, /^[a-z0-9-]+$/, `${theme.slug}: bad slug`);
    }
});

test('only adaptive themes reach for host theme variables', () => {
    for (const theme of THEMES) {
        const serialized = JSON.stringify(theme);
        const usesHost = serialized.includes('var(--SmartTheme') || serialized.includes('color-mix(');
        if (theme.mode === 'adaptive') {
            assert.ok(usesHost, `${theme.slug}: adaptive but hardcodes its palette`);
        } else {
            assert.ok(!usesHost, `${theme.slug}: self-contained themes must not depend on host vars`);
        }
    }
});

test('adaptive colour functions always carry a literal fallback', () => {
    for (const theme of THEMES.filter(item => item.mode === 'adaptive')) {
        for (const match of JSON.stringify(theme).matchAll(/var\(--[A-Za-z-]+([^)]*)\)/g)) {
            assert.match(match[1], /,\s*[^)]+/, `${theme.slug}: var() without a fallback`);
        }
    }
});

test('theme slugs and names are unique', () => {
    const slugs = THEMES.map(theme => theme.slug);
    const names = THEMES.map(theme => theme.name);
    assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
    assert.equal(new Set(names).size, names.length, 'duplicate name');
    assert.ok(THEMES.length >= 30, `only ${THEMES.length} themes`);
});

test('generation is deterministic', () => {
    for (const spec of SPECS.slice(0, 8)) {
        for (const theme of THEMES.slice(0, 8)) {
            const first = buildReplaceString(spec, theme, { meters: true });
            const second = buildReplaceString(spec, theme, { meters: true });
            assert.equal(first, second);
        }
    }
});
