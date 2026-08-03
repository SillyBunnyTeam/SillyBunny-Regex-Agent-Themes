/**
 * The spec table has to agree with what SillyBunny actually ships. If an upstream sync
 * renumbers a capture group or renames a script, this is where it surfaces.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ARCHETYPES, SPECS, SPEC_BY_KEY, specKey } from '../src/specs.js';
import { STOCK, STOCK_BY_KEY } from '../src/stock.js';
import { SAMPLES } from '../src/samples.js';

test('every shipped script has exactly one spec', () => {
    assert.equal(STOCK.length, 42, 'baseline size changed — regenerate src/stock.js');
    assert.equal(SPECS.length, STOCK.length);

    for (const entry of STOCK) {
        const spec = SPEC_BY_KEY.get(specKey(entry.templateId, entry.scriptId));
        assert.ok(spec, `no spec for ${entry.templateId}/${entry.scriptName}`);
        assert.equal(spec.scriptName, entry.scriptName);
    }
});

test('spec ids are unique', () => {
    const keys = SPECS.map(spec => specKey(spec.templateId, spec.scriptId));
    assert.equal(new Set(keys).size, keys.length);
});

test('declared group counts match the shipped patterns', () => {
    for (const spec of SPECS) {
        const stock = STOCK_BY_KEY.get(specKey(spec.templateId, spec.scriptId));
        assert.equal(
            spec.groups, stock.groups,
            `${spec.scriptName}: spec says ${spec.groups} groups, pattern has ${stock.groups}`,
        );
    }
});

test('every referenced capture group exists in its pattern', () => {
    const collect = (spec) => {
        const refs = [];
        const push = (value) => {
            if (typeof value?.g === 'number') {
                refs.push(value.g);
            }
            if (typeof value?.k === 'number') {
                refs.push(value.k);
            }
            if (typeof value?.v === 'number') {
                refs.push(value.v);
            }
        };
        [...spec.head, ...spec.rows, ...spec.sections, ...spec.slots, ...spec.stats, ...spec.fields]
            .forEach(push);
        [spec.pill, spec.body, spec.speaker, spec.meta, spec.hue, spec.title].forEach(push);
        return refs;
    };

    for (const spec of SPECS) {
        for (const group of collect(spec)) {
            assert.ok(
                group >= 1 && group <= spec.groups,
                `${spec.scriptName}: references $${group} but only has ${spec.groups} groups`,
            );
        }
    }
});

test('the empty-replaceString utilities are marked pass-through', () => {
    const empties = STOCK.filter(entry => entry.replaceString === '');
    assert.equal(empties.length, 4);

    for (const entry of empties) {
        const spec = SPEC_BY_KEY.get(specKey(entry.templateId, entry.scriptId));
        const expected = entry.scriptName === 'Remove Empty Choice Rows'
            ? ARCHETYPES.CLEANUP
            : ARCHETYPES.PASSTHROUGH;
        assert.equal(spec.archetype, expected, `${entry.scriptName} has the wrong archetype`);
    }
});

test('the CYOA cleanup script points at a real target spec', () => {
    const cleanup = SPECS.find(spec => spec.archetype === ARCHETYPES.CLEANUP);
    assert.ok(cleanup.cleanupFor);
    const target = SPEC_BY_KEY.get(specKey(cleanup.templateId, cleanup.cleanupFor));
    assert.ok(target, 'cleanupFor does not resolve');
    assert.equal(target.archetype, ARCHETYPES.SLOTS);
});

test('the flagless menu patterns are preserved verbatim', () => {
    // These four are stored without /…/ delimiters, so they compile with no flags and match
    // only once. Re-serialising them through a regex round-trip would silently add /g.
    const flagless = STOCK.filter(entry => !entry.delimited);
    assert.deepEqual(
        flagless.map(entry => entry.scriptName).sort(),
        ['Replace Choices', 'Replace Directions', 'Trim Choices', 'Trim Directions'],
    );
    for (const entry of flagless) {
        assert.equal(entry.flags, '', `${entry.scriptName} unexpectedly has flags`);
    }
});

test('every renderable spec has sample text', () => {
    const skip = [ARCHETYPES.PASSTHROUGH, ARCHETYPES.CLEANUP];
    for (const spec of SPECS) {
        if (skip.includes(spec.archetype)) {
            continue;
        }
        assert.ok(SAMPLES[spec.key], `no sample block for "${spec.key}"`);
    }
});

test('stream sets declare a balanced open and close depth', () => {
    const streams = SPECS.filter(spec => spec.archetype === ARCHETYPES.STREAM);
    const bySet = new Map();
    for (const spec of streams) {
        if (!bySet.has(spec.set)) {
            bySet.set(spec.set, {});
        }
        if (spec.role === 'open' || spec.role === 'close') {
            bySet.get(spec.set)[spec.role] = spec.depth;
        }
    }
    for (const [set, roles] of bySet) {
        assert.equal(roles.open, roles.close, `${set}: open depth ${roles.open} vs close ${roles.close}`);
    }
});
