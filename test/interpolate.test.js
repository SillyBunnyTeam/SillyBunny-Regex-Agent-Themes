/**
 * The preview gallery renders with src/interpolate.js instead of importing the host engine,
 * so it must agree with the host engine exactly. This test proves it does, across the whole
 * matrix, and pins the individual semantics that are easy to get wrong.
 */

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { applyList, applyOne, regexFromString } from '../src/interpolate.js';
import { buildAgentScripts } from '../src/build.js';
import { ARCHETYPES, SPECS } from '../src/specs.js';
import { STOCK } from '../src/stock.js';
import { SAMPLES, sampleFor } from '../src/samples.js';
import { THEMES } from '../src/themes/index.js';
import { findSillyBunnyRoot, loadRegexEngine, renderWith } from './helpers/st.mjs';

test('an unmatched group interpolates to an empty string, not "undefined"', () => {
    const out = applyOne('a-b', '/(a)-(b)-?(c)?/', '[$1|$3]');
    assert.equal(out, '[a|]');
});

test('{{match}} becomes the whole match', () => {
    assert.equal(applyOne('hello', '/hello/', '<b>{{match}}</b>'), '<b>hello</b>');
});

test('named groups are supported', () => {
    assert.equal(applyOne('x=1', '/(?<key>\\w+)=(?<value>\\d+)/', '$<key>:$<value>'), 'x:1');
});

test('a pattern without delimiters compiles flagless, so it matches once', () => {
    const compiled = regexFromString('\\[X\\]');
    assert.equal(compiled.flags, '');
    assert.equal(applyOne('[X] [X]', '\\[X\\]', 'y'), 'y [X]');
});

test('a delimited pattern keeps its flags', () => {
    assert.equal(regexFromString('/a/g').flags, 'g');
    assert.equal(applyOne('aa', '/a/g', 'b'), 'bb');
});

test('prompt-only scripts are skipped when rendering for display', () => {
    const scripts = [
        { findRegex: '/a/g', replaceString: 'X', promptOnly: true },
        { findRegex: '/b/g', replaceString: 'Y' },
    ];
    assert.equal(applyList('ab', scripts), 'aY');
});

test('disabled scripts are skipped', () => {
    assert.equal(applyList('a', [{ findRegex: '/a/g', replaceString: 'X', disabled: true }]), 'a');
});

const parity = findSillyBunnyRoot() && typeof mock.module === 'function'
    ? false
    : 'needs a SillyBunny checkout and --experimental-test-module-mocks';

test('matches the host engine for every theme and template', { skip: parity }, async () => {
    const engine = await loadRegexEngine(mock);

    function stockScriptsFor(templateId) {
        return STOCK.filter(entry => entry.templateId === templateId).map(entry => ({
            id: entry.scriptId,
            scriptName: entry.scriptName,
            findRegex: entry.findRegex,
            replaceString: entry.replaceString,
            trimStrings: [],
            placement: entry.placement,
            disabled: false,
            markdownOnly: entry.markdownOnly,
            promptOnly: entry.promptOnly,
            runOnEdit: true,
            substituteRegex: 0,
            minDepth: entry.minDepth,
            maxDepth: entry.maxDepth,
        }));
    }

    const substitute = value => String(value).replaceAll('{{user}}', 'You');
    const templates = [...new Set(SPECS
        .filter(spec => spec.archetype !== ARCHETYPES.PASSTHROUGH && SAMPLES[spec.key])
        .map(spec => spec.templateId))];

    for (const theme of THEMES) {
        for (const templateId of templates) {
            const spec = SPECS.find(item => item.templateId === templateId && SAMPLES[item.key]);
            const { scripts } = buildAgentScripts(
                templateId, stockScriptsFor(templateId), theme, { meters: true }, 'parity',
            );
            const display = scripts.filter(script => !script.promptOnly);
            const sample = sampleFor(spec);

            assert.equal(
                applyList(sample, display, substitute),
                renderWith(engine, display, sample),
                `${theme.slug}/${templateId}: preview and host engine disagree`,
            );
        }
    }
});
