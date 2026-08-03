/**
 * The build/revert half of the apply engine, against a synthetic agent. The rules being
 * checked here are the ones that protect the user's data:
 *   - script ids never change, because message snapshot refs are keyed on them
 *   - frozen prompt-side patterns are never touched
 *   - revert restores the shipped bytes exactly and removes what we appended
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAgentScripts, isOwnedScript, planRevertAgentScripts } from '../src/build.js';
import { STOCK } from '../src/stock.js';
import { THEME_BY_SLUG } from '../src/themes/index.js';
import { ARCHETYPES, SPECS, getSpec } from '../src/specs.js';
import { STATUS, classifyScript, isAutoApplicable, summarizeStatuses } from '../src/drift.js';
import { buildCleanupFindRegex, buildReplaceString } from '../src/render/index.js';

const THEME = THEME_BY_SLUG.get('neon-grid');

function agentFor(templateId) {
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

test('every markup script is themed and every id is preserved', () => {
    for (const templateId of [...new Set(STOCK.map(entry => entry.templateId))]) {
        const stock = agentFor(templateId);
        const { scripts, themed } = buildAgentScripts(templateId, stock, THEME, {}, 'a1');

        const originalIds = stock.map(script => script.id);
        const keptIds = scripts.filter(script => !isOwnedScript(script)).map(script => script.id);
        assert.deepEqual(keptIds, originalIds, `${templateId}: ids or order changed`);

        const expected = stock.filter(script => {
            const spec = getSpec(templateId, script.id);
            return spec && spec.archetype !== ARCHETYPES.PASSTHROUGH;
        }).length;
        assert.equal(themed.length, expected, `${templateId}: themed ${themed.length}, expected ${expected}`);
    }
});

test('frozen prompt-side scripts keep their pattern and stay empty', () => {
    const frozen = ['Trim Choices', 'Trim Directions'];
    for (const templateId of ['tpl-cyoa-choices', 'tpl-direction-menu', 'tpl-cyoa-choices-skill-checks']) {
        const stock = agentFor(templateId);
        const { scripts } = buildAgentScripts(templateId, stock, THEME, {}, 'a1');

        for (const name of frozen) {
            const before = stock.find(script => script.scriptName === name);
            const after = scripts.find(script => script.scriptName === name);
            if (!before) {
                continue;
            }
            assert.equal(after.findRegex, before.findRegex, `${name}: pattern changed`);
            assert.equal(after.replaceString, '', `${name}: gained a replacement`);
        }
    }
});

test('the CYOA cleanup pattern is regenerated to match the new markup', () => {
    const stock = agentFor('tpl-cyoa-choices');
    const { scripts } = buildAgentScripts('tpl-cyoa-choices', stock, THEME, {}, 'a1');

    const before = stock.find(script => script.scriptName === 'Remove Empty Choice Rows');
    const after = scripts.find(script => script.id === before.id);

    assert.notEqual(after.findRegex, before.findRegex, 'cleanup pattern was left stale');
    assert.equal(after.replaceString, '');
    assert.ok(after.findRegex.includes('data-rat-part'), 'cleanup does not target our markup');

    // It must match an empty generated slot and not a populated one.
    const slots = SPECS.find(spec => spec.key === 'choices');
    const markup = scripts.find(script => script.id === slots.scriptId).replaceString;
    const emptied = markup.replace(/\$\d+/g, '');
    const pattern = new RegExp(after.findRegex.slice(1, after.findRegex.lastIndexOf('/')), 'g');
    assert.ok(pattern.test(emptied), 'cleanup does not match an empty slot');

    const filled = markup.replace(/\$\d+/g, 'text');
    assert.ok(!new RegExp(pattern.source).test(filled), 'cleanup would delete a populated slot');
});

test('cleanup scripts are appended for the menus that ship without one', () => {
    for (const [templateId, expected] of [['tpl-direction-menu', 1], ['tpl-parallel-tracker', 1]]) {
        const { added } = buildAgentScripts(templateId, agentFor(templateId), THEME, {}, 'a1');
        assert.equal(added.length, expected, `${templateId}: appended ${added.length}`);
        assert.ok(added.every(id => id.startsWith('rat:')), 'appended ids are not namespaced');
    }
});

test('optional profile sections receive an unconditional cleanup script', () => {
    const templateId = 'tpl-npc-profiles';
    const built = buildAgentScripts(templateId, agentFor(templateId), THEME, {
        cleanupScripts: false,
    }, 'a1');
    assert.ok(built.added.includes('rat:cleanup-npc-support:a1'));

    const support = SPECS.find(spec => spec.key === 'npc-support');
    const markup = built.scripts.find(script => script.id === support.scriptId).replaceString;
    const cleanup = built.scripts.find(script => script.id === 'rat:cleanup-npc-support:a1');
    const source = cleanup.findRegex.slice(1, cleanup.findRegex.lastIndexOf('/'));
    const partial = markup
        .replace('$1', 'Dock foreman')
        .replace('$2', 'Ezra Kolt')
        .replace(/\$[3-6]/g, '')
        .replace(new RegExp(source, 'g'), '');

    assert.equal((partial.match(/data-rat-part="section"/g) ?? []).length, 1);
    assert.ok(partial.includes('Ezra Kolt'));
});

test('the meter script is only appended when meters are on', () => {
    const off = buildAgentScripts('tpl-relationship-tracker', agentFor('tpl-relationship-tracker'), THEME, {}, 'a1');
    assert.equal(off.added.length, 0);

    const on = buildAgentScripts(
        'tpl-relationship-tracker', agentFor('tpl-relationship-tracker'), THEME, { meters: true }, 'a1',
    );
    assert.equal(on.added.length, 1);
    assert.equal(on.added[0], 'rat:meter:a1');
    const meter = on.scripts.at(-1);
    assert.ok(meter.findRegex.includes('data-rat-part="meter"'), meter.findRegex);
    assert.ok(meter.replaceString.includes('calc(100% * $1 / $2)'), 'no calc-based bar width');
    assert.equal(meter.markdownOnly, true, 'the meter script must be display-only');
});

test('re-applying does not stack appended scripts', () => {
    const first = buildAgentScripts(
        'tpl-relationship-tracker', agentFor('tpl-relationship-tracker'), THEME, { meters: true }, 'a1',
    );
    const second = buildAgentScripts('tpl-relationship-tracker', first.scripts, THEME, { meters: true }, 'a1');
    assert.equal(second.scripts.length, first.scripts.length);
    assert.equal(second.added.length, 1);
});

test('a pattern that no longer matches the baseline is left alone', () => {
    const stock = agentFor('tpl-scene-tracker');
    const tampered = stock.map(script => ({ ...script, findRegex: '/\\[SCENE\\|(.*)\\]/g' }));
    const { themed, skipped } = buildAgentScripts('tpl-scene-tracker', tampered, THEME, {}, 'a1');

    assert.equal(themed.length, 0, 'themed a script whose pattern drifted');
    assert.equal(skipped.length, 1);
    assert.match(skipped[0], /findRegex differs/);
});

test('a confirmed reset restores shipped bytes and drops appended scripts', () => {
    const templateId = 'tpl-cyoa-choices';
    const stock = agentFor(templateId);
    const { scripts } = buildAgentScripts(templateId, stock, THEME, { meters: true }, 'a1');
    const plan = planRevertAgentScripts(templateId, scripts, null, { force: true });
    const reverted = plan.scripts;

    assert.equal(reverted.length, stock.length);
    for (const [index, script] of reverted.entries()) {
        assert.equal(script.id, stock[index].id);
        assert.equal(script.replaceString, stock[index].replaceString, `${script.scriptName}: markup differs`);
        assert.equal(script.findRegex, stock[index].findRegex, `${script.scriptName}: pattern differs`);
    }
    assert.equal(reverted.filter(isOwnedScript).length, 0);
});

test('owned revert prefers a captured hand edit over shipped bytes', () => {
    const templateId = 'tpl-scene-tracker';
    const stock = agentFor(templateId);
    const { scripts } = buildAgentScripts(templateId, stock, THEME, {}, 'a1');

    const entry = {
        scripts: {
            [stock[0].id]: {
                applied: scripts[0].replaceString,
                findRegex: scripts[0].findRegex,
            },
        },
        originals: {
            [stock[0].id]: {
                replaceString: '<b>my own</b>',
                findRegex: stock[0].findRegex,
            },
        },
        added: [],
    };
    const plan = planRevertAgentScripts(templateId, scripts, entry);
    assert.equal(plan.blocked.length, 0);
    assert.equal(plan.scripts[0].replaceString, '<b>my own</b>');
});

test('automatic revert is a no-op without ownership ledger', () => {
    const templateId = 'tpl-scene-tracker';
    const scripts = agentFor(templateId);
    scripts[0].replaceString = '<b>hand edited</b>';

    const plan = planRevertAgentScripts(templateId, scripts, null);
    assert.equal(plan.changed, 0);
    assert.deepEqual(plan.scripts, scripts);
});

test('owned revert blocks a script changed after apply', () => {
    const templateId = 'tpl-scene-tracker';
    const stock = agentFor(templateId);
    const { scripts } = buildAgentScripts(templateId, stock, THEME, {}, 'a1');
    const applied = scripts[0].replaceString;
    scripts[0].replaceString = '<b>edited later</b>';

    const plan = planRevertAgentScripts(templateId, scripts, {
        scripts: { [scripts[0].id]: { applied, findRegex: scripts[0].findRegex } },
        originals: {},
        added: [],
    });
    assert.equal(plan.changed, 0);
    assert.deepEqual(plan.blocked.map(entry => entry.scriptId), [scripts[0].id]);
    assert.equal(plan.scripts[0].replaceString, '<b>edited later</b>');
});

test('drift statuses roll up worst-first', () => {
    assert.equal(summarizeStatuses([STATUS.PRISTINE, STATUS.FOREIGN]), STATUS.FOREIGN);
    assert.equal(summarizeStatuses([STATUS.STOCK, STATUS.OUTDATED]), STATUS.OUTDATED);
    assert.equal(summarizeStatuses([STATUS.UPSTREAM_CHANGED, STATUS.FOREIGN]), STATUS.UPSTREAM_CHANGED);
    assert.equal(summarizeStatuses([]), STATUS.PRISTINE);
});

test('only stock and outdated are auto-applicable', () => {
    assert.ok(isAutoApplicable(STATUS.STOCK));
    assert.ok(isAutoApplicable(STATUS.OUTDATED));
    assert.ok(!isAutoApplicable(STATUS.FOREIGN), 'hand edits must never be overwritten silently');
    assert.ok(!isAutoApplicable(STATUS.UPSTREAM_CHANGED));
    assert.ok(!isAutoApplicable(STATUS.MISSING));
});

test('a themed script reads as pristine and a clobbered one as stock', () => {
    const templateId = 'tpl-scene-tracker';
    const stock = agentFor(templateId);
    const spec = getSpec(templateId, stock[0].id);
    const { scripts } = buildAgentScripts(templateId, stock, THEME, {}, 'a1');
    const themedScript = scripts[0];

    assert.equal(
        classifyScript({ script: themedScript, spec, expected: themedScript.replaceString }),
        STATUS.PRISTINE,
    );
    // This is what a template update leaves behind.
    assert.equal(
        classifyScript({ script: stock[0], spec, expected: themedScript.replaceString }),
        STATUS.STOCK,
    );
});

test('a themed CYOA agent reports as themed, not as stock', () => {
    // The cleanup script's replaceString is always empty, so comparing it against the
    // baseline used to classify every themed CYOA agent as unthemed and drag the whole
    // row's status down with it. Its pattern is the part that carries the theme.
    const templateId = 'tpl-cyoa-choices';
    const stock = agentFor(templateId);
    const { scripts } = buildAgentScripts(templateId, stock, THEME, {}, 'a1');

    const statuses = scripts.map((script) => {
        const spec = getSpec(templateId, script.id);
        if (!spec || spec.passthrough) {
            return null;
        }
        const target = spec.regenerateFindRegex ? getSpec(templateId, spec.cleanupFor) : null;
        return classifyScript({
            script,
            spec,
            expected: spec.regenerateFindRegex ? null : buildReplaceString(spec, THEME, {}),
            expectedFindRegex: target ? buildCleanupFindRegex(target, THEME, {}) : null,
        });
    }).filter(Boolean);

    assert.deepEqual(statuses, [STATUS.PRISTINE, STATUS.PRISTINE]);
    assert.equal(summarizeStatuses(statuses), STATUS.PRISTINE);
});

test('an unthemed CYOA agent still reports as stock', () => {
    const templateId = 'tpl-cyoa-choices';
    const stock = agentFor(templateId);

    const statuses = stock.map((script) => {
        const spec = getSpec(templateId, script.id);
        if (!spec || spec.passthrough) {
            return null;
        }
        const target = spec.regenerateFindRegex ? getSpec(templateId, spec.cleanupFor) : null;
        return classifyScript({
            script,
            spec,
            expected: spec.regenerateFindRegex ? null : buildReplaceString(spec, THEME, {}),
            expectedFindRegex: target ? buildCleanupFindRegex(target, THEME, {}) : null,
        });
    }).filter(Boolean);

    assert.deepEqual(statuses, [STATUS.STOCK, STATUS.STOCK]);
    assert.equal(summarizeStatuses(statuses), STATUS.STOCK);
});

test('the cleanup pattern does not change between themes', () => {
    // It wildcards the style attribute, so switching theme leaves it alone. That keeps a
    // theme change from needlessly rewriting the script and churning its snapshot refs.
    const target = SPECS.find(spec => spec.key === 'choices');
    const patterns = ['neon-grid', 'marshmallow', 'grimoire', 'adaptive-ink']
        .map(slug => buildCleanupFindRegex(target, THEME_BY_SLUG.get(slug), {}));

    assert.equal(new Set(patterns).size, 1, 'cleanup pattern differs by theme');
});

test('a cleanup script carrying an unrecognised pattern is protected without a ledger', () => {
    const templateId = 'tpl-cyoa-choices';
    const spec = SPECS.find(item => item.templateId === templateId && item.regenerateFindRegex);
    const target = getSpec(templateId, spec.cleanupFor);

    assert.equal(
        classifyScript({
            script: { id: spec.scriptId, findRegex: '/<div class="pura-choice"><\\/div>/g', replaceString: '' },
            spec,
            expected: null,
            expectedFindRegex: buildCleanupFindRegex(target, THEME, {}),
        }),
        STATUS.FOREIGN,
    );
});

test('a cleanup script matching its ledger reads as outdated', () => {
    const templateId = 'tpl-cyoa-choices';
    const spec = SPECS.find(item => item.templateId === templateId && item.regenerateFindRegex);
    const target = getSpec(templateId, spec.cleanupFor);
    const oldPattern = '/<div data-rat-part="old-slot"><\\/div>/g';

    assert.equal(
        classifyScript({
            script: { id: spec.scriptId, findRegex: oldPattern, replaceString: '' },
            spec,
            expected: null,
            expectedFindRegex: buildCleanupFindRegex(target, THEME, {}),
            ledgerEntry: { applied: '', findRegex: oldPattern },
        }),
        STATUS.OUTDATED,
    );
});

test('an unrelated empty replacement is foreign, not stock', () => {
    const templateId = 'tpl-scene-tracker';
    const stock = agentFor(templateId)[0];
    const spec = getSpec(templateId, stock.id);
    const expected = buildReplaceString(spec, THEME, {});

    assert.equal(
        classifyScript({ script: { ...stock, replaceString: '' }, spec, expected }),
        STATUS.FOREIGN,
    );
});

test('a generated ownership marker survives ledger loss', () => {
    const templateId = 'tpl-scene-tracker';
    const stock = agentFor(templateId);
    const spec = getSpec(templateId, stock[0].id);
    const old = buildAgentScripts(templateId, stock, THEME, {}, 'a1').scripts[0];
    const expected = buildReplaceString(spec, THEME_BY_SLUG.get('marshmallow'), {});

    assert.equal(classifyScript({ script: old, spec, expected }), STATUS.OUTDATED);
});
