/**
 * Renders themed scripts through the real in-chat-agents regex engine.
 *
 * Run with: node --experimental-test-module-mocks --test test/integration.test.js
 * Skips cleanly when no SillyBunny checkout is reachable.
 */

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { buildAgentScripts } from '../src/build.js';
import { SPECS, ARCHETYPES } from '../src/specs.js';
import { STOCK } from '../src/stock.js';
import { SAMPLES, sampleFor } from '../src/samples.js';
import { THEMES, THEME_BY_SLUG } from '../src/themes/index.js';
import { loadRegexEngine, renderWith, findSillyBunnyRoot } from './helpers/st.mjs';

const available = Boolean(findSillyBunnyRoot()) && typeof mock.module === 'function';
const skip = available ? false : 'needs a SillyBunny checkout and --experimental-test-module-mocks';

/** The stock scripts belonging to one template, in shipped order. */
function stockFor(templateId) {
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

function renderTemplate(engine, templateId, themeSlug, text, options = {}) {
    const theme = THEME_BY_SLUG.get(themeSlug);
    const { scripts } = buildAgentScripts(templateId, stockFor(templateId), theme, options, 'test-agent');
    // Prompt-side trim scripts must not touch display output.
    const display = scripts.filter(script => !script.promptOnly);
    return renderWith(engine, display, text);
}

test('every markup spec consumes its sample block and leaves no placeholders', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const renderable = SPECS.filter(spec => ![
        ARCHETYPES.PASSTHROUGH, ARCHETYPES.CLEANUP, ARCHETYPES.BOLD,
    ].includes(spec.archetype));

    const seen = new Set();
    for (const spec of renderable) {
        if (seen.has(spec.templateId)) {
            continue;
        }
        seen.add(spec.templateId);
    }

    for (const templateId of seen) {
        const specsHere = renderable.filter(spec => spec.templateId === templateId);
        for (const spec of specsHere) {
            const sample = sampleFor(spec);
            if (!sample) {
                assert.fail(`no sample for ${spec.key}`);
            }
            const out = renderTemplate(engine, templateId, 'neon-grid', sample);

            assert.ok(!/\$\d/.test(out), `${spec.key}: leaked a group placeholder`);
            assert.ok(out.includes('data-rat'), `${spec.key}: no themed element emitted`);
            assert.notEqual(out, sample, `${spec.key}: nothing was replaced`);

            // Chips flow inside prose, so only block archetypes start with their own tag.
            if (spec.archetype !== ARCHETYPES.CHIP) {
                assert.match(out.trimStart(), /^<(?:article|details|div|span|style)/, `${spec.key}: unexpected start`);
            }
        }
    }
});

test('tracker markers are fully replaced, not left in the output', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const cases = [
        ['tpl-scene-tracker', 'scene', '[SCENE|'],
        ['tpl-status-tracker', 'status', '[STATUS|'],
        ['tpl-relationship-tracker', 'relationship', '[METER|'],
        ['tpl-npc-profiles', 'npc-major', '[NPC:MAJOR|'],
        ['tpl-world-detail', 'world', '[WORLD|'],
    ];

    for (const [templateId, key, marker] of cases) {
        const spec = SPECS.find(item => item.key === key);
        const out = renderTemplate(engine, templateId, 'grimoire', sampleFor(spec));
        assert.ok(!out.includes(marker), `${key}: marker survived`);
        assert.ok(out.includes('data-rat='), `${key}: missing theme marker`);
    }
});

test('sample field values reach the rendered output', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const spec = SPECS.find(item => item.key === 'scene');
    const out = renderTemplate(engine, 'tpl-scene-tracker', 'paper-minimal', sampleFor(spec));

    assert.ok(out.includes('Rooftop garden'));
    assert.ok(out.includes('Dusk'));
    assert.ok(out.includes('Overcast, wind rising'));
    assert.ok(out.includes('The city hums below.'));
});

test('the parallel tracker keeps separators inside surviving rows', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const spec = SPECS.find(item => item.key === 'parallel');

    const full = renderTemplate(engine, 'tpl-parallel-tracker', 'nordic-frost', SAMPLES.parallel.full);
    assert.equal((full.match(/data-rat-part="pair"/g) ?? []).length, 3);
    assert.ok(full.includes('data-rat-part="pair-separator"'), 'durable pair separator missing');

    const partial = renderTemplate(engine, 'tpl-parallel-tracker', 'nordic-frost', SAMPLES.parallel.partial);
    assert.equal((partial.match(/data-rat-part="pair"/g) ?? []).length, 1, 'empty pair rows survived');
    assert.equal((partial.match(/data-rat-part="pair-separator"/g) ?? []).length, 1,
        'separator survived outside a populated pair row');
});

test('empty choice and direction slots are removed', { skip }, async () => {
    const engine = await loadRegexEngine(mock);

    const choices = renderTemplate(engine, 'tpl-cyoa-choices', 'marshmallow', SAMPLES.choices.partial);
    assert.equal((choices.match(/data-rat-part="slot"/g) ?? []).length, 2, 'empty choice slots survived');

    const directions = renderTemplate(engine, 'tpl-direction-menu', 'marshmallow', SAMPLES.directions.partial);
    assert.equal((directions.match(/data-rat-part="slot"/g) ?? []).length, 2, 'empty direction slots survived');

    const full = renderTemplate(engine, 'tpl-cyoa-choices', 'marshmallow', SAMPLES.choices.full);
    assert.equal((full.match(/data-rat-part="slot"/g) ?? []).length, 4);
});

test('optional NPC support sections collapse when the model omits them', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const full = renderTemplate(engine, 'tpl-npc-profiles', 'herbarium', SAMPLES['npc-support'].full);
    assert.equal((full.match(/data-rat-part="section"/g) ?? []).length, 5);

    const partial = renderTemplate(engine, 'tpl-npc-profiles', 'herbarium', SAMPLES['npc-support'].partial);
    assert.ok(partial.includes('Ezra Kolt'), 'basics section lost');
    assert.equal((partial.match(/data-rat-part="section"/g) ?? []).length, 1,
        'empty optional sections survived');
});

test('the meter chain turns n/m into a bar and leaves prose alone', { skip }, async () => {
    const engine = await loadRegexEngine(mock);

    const numeric = renderTemplate(
        engine, 'tpl-relationship-tracker', 'candy-gloss',
        SAMPLES.relationship.full, { meters: true },
    );
    assert.ok(numeric.includes('data-rat-part="meterbar"'), 'no bar rendered');
    assert.ok(numeric.includes('role="progressbar"'), 'meter lacks progress semantics');
    assert.ok(numeric.includes('aria-valuenow="7"'), 'meter value was not exposed');
    assert.ok(numeric.includes('calc(100% * 7 / 10)'), 'affection width not interpolated');
    assert.ok(numeric.includes('calc(100% * 5 / 10)'), 'trust width not interpolated');

    const prose = renderTemplate(
        engine, 'tpl-relationship-tracker', 'candy-gloss',
        SAMPLES.relationship.nonNumeric, { meters: true },
    );
    assert.ok(!prose.includes('meterbar'), 'non-numeric value was turned into a bar');
    assert.ok(prose.includes('High'), 'non-numeric value lost');
});

test('meters stay off unless requested', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const out = renderTemplate(engine, 'tpl-relationship-tracker', 'candy-gloss', SAMPLES.relationship.full);
    assert.ok(!out.includes('meterbar'));
});

test('stream shells stay tag-balanced across open, rows and close', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    for (const [templateId, sampleKey] of [
        ['tpl-chatroom-companion', 'chatroom'],
        ['tpl-message-inbox-companion', 'inbox-phone'],
        ['tpl-message-inbox-companion', 'inbox-letter'],
    ]) {
        const out = renderTemplate(engine, templateId, 'synthwave-drive', SAMPLES[sampleKey].full);
        const opens = (out.match(/<div\b/g) ?? []).length;
        const closes = (out.match(/<\/div>/g) ?? []).length;
        assert.equal(opens, closes, `${sampleKey}: ${opens} <div> vs ${closes} </div>`);
        assert.ok(!out.includes('CHATROOM|'), `${sampleKey}: marker survived`);
    }
});

test('the chatroom hue capture reaches oklch as a literal number', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const out = renderTemplate(engine, 'tpl-chatroom-companion', 'eldritch-deep', SAMPLES.chatroom.full);
    assert.match(out, /oklch\(66% \.15 28 \/ \.32\)/, 'per-speaker hue not interpolated');
    assert.ok(out.includes('implying the guild will notice'), 'greentext row lost');
});

test('monochrome themes opt out of the per-speaker hue', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const out = renderTemplate(engine, 'tpl-chatroom-companion', 'monochrome-slate', SAMPLES.chatroom.full);
    assert.ok(!out.includes('oklch('), 'hue leaked into a monochrome theme');
});

test('terminal panels emit style selectors that survive the sanitizer rewrite', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const out = renderTemplate(engine, 'tpl-level-up-companion', 'phosphor-green', SAMPLES['level-up'].full);

    assert.ok(out.startsWith('<style>'), 'style block missing');
    assert.match(out, /class="[^"]*\brat-tw\b[^"]*"/, 'root class missing');
    assert.ok(out.includes('.rat-tw-levelup-phosphor-green'), 'terminal scope missing');
    // decodeStyleTags rewrites `.rat-tw` to `.custom-rat-tw`, and the DOMPurify hook
    // rewrites class="rat-tw" the same way, so the pair must be unprefixed on both sides.
    assert.ok(!out.includes('.custom-rat-tw'), 'selector was pre-prefixed and will not match');
    assert.ok(out.includes('New perk: Steady Hand'), 'panel body lost');
    assert.ok(out.includes('You@st:~$'), 'user macro not substituted');
});

test('every theme renders every template without leaking placeholders', { skip }, async () => {
    const engine = await loadRegexEngine(mock);
    const templates = [...new Set(SPECS
        .filter(spec => SAMPLES[spec.key])
        .map(spec => spec.templateId))];

    for (const theme of THEMES) {
        for (const templateId of templates) {
            const spec = SPECS.find(item => item.templateId === templateId && SAMPLES[item.key]);
            const out = renderTemplate(engine, templateId, theme.slug, sampleFor(spec), { meters: true });
            assert.ok(!/\$\d/.test(out), `${theme.slug}/${templateId}: leaked a group placeholder`);
            assert.ok(!out.includes('{{'), `${theme.slug}/${templateId}: leaked a macro`);
        }
    }
});
