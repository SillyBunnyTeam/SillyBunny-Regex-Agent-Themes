/**
 * Tripwires on the SillyBunny behaviour this extension depends on, plus a lint of our own
 * stylesheet. All of it is read as text so nothing has to be importable in Node.
 *
 * If an upstream sync changes one of these, the failure explains what to re-check rather
 * than leaving a silent visual bug.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { STOCK } from '../src/stock.js';
import { findSillyBunnyRoot } from './helpers/st.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = findSillyBunnyRoot();
const skip = root ? false : 'needs a SillyBunny checkout';

function read(relativePath) {
    return readFileSync(join(root, relativePath), 'utf8');
}

test('style.css never targets a rat- class in message content', () => {
    const stylesheet = readFileSync(join(here, '../style.css'), 'utf8');
    const withoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');

    // A DOMPurify hook renames every class in message HTML to custom-*, so a `.rat-` rule
    // aimed at message content would be dead. Panel rules are scoped by #rat_drawer.
    for (const line of withoutComments.split('\n')) {
        if (!line.includes('.rat-')) {
            continue;
        }
        assert.ok(
            line.includes('#rat_drawer'),
            `style.css targets a rat- class outside the settings panel: ${line.trim()}`,
        );
    }
});

test('style.css hooks message content on data-rat attributes', () => {
    const stylesheet = readFileSync(join(here, '../style.css'), 'utf8');
    assert.ok(stylesheet.includes('[data-rat-part='), 'no attribute hooks found');
    assert.ok(stylesheet.includes('.mes_text [data-rat]'), 'message-content rules are unscoped');
});

test('the class-renaming DOMPurify hook still exists', { skip }, () => {
    const chats = read('public/scripts/chats.js');
    assert.ok(chats.includes('addDOMPurifyHooks'), 'addDOMPurifyHooks is gone');
    assert.match(
        chats,
        /return 'custom-' \+ v;/,
        'the class rename hook changed — re-check the styling strategy in style.css',
    );
});

test('inline style blocks are still selector-rewritten and mes_text-prefixed', { skip }, () => {
    const chats = read('public/scripts/chats.js');
    assert.ok(chats.includes('encodeStyleTags'), 'encodeStyleTags is gone');
    assert.ok(chats.includes('decodeStyleTags'), 'decodeStyleTags is gone');
    assert.match(chats, /prefix \+ sanitizeSelector\(selector\)/, 'selector prefixing changed');
    assert.match(chats, /custom-\$\{className\}/, 'the style-block class rewrite changed');
    assert.match(
        chats,
        /<style>\(\.\+\?\)<\\\/style>/,
        'encodeStyleTags no longer matches a bare <style> tag',
    );
});

test('the interpolation semantics the generator relies on are unchanged', { skip }, () => {
    const engine = read('public/scripts/extensions/in-chat-agents/regex-scripts.js');

    // $n and $<name> are consumed anywhere in the string, which is why no generated CSS may
    // contain a stray `$` followed by a digit.
    assert.match(engine, /\\\$\(\\d\+\)\|\\\$<\(\[\^>\]\+\)>/, 'the interpolation pattern changed');
    // A falsy group becomes '', which is what empty-slot collapse depends on.
    assert.match(engine, /if \(!replacement\) \{\s*return '';/, 'empty-group handling changed');
    // Scripts run in array order, which is what the chained meter and cleanup rely on.
    assert.match(engine, /for \(const rawScript of scripts\)/, 'script ordering changed');
    // Output passes through substituteParams, which is why {{ must never be emitted.
    assert.match(engine, /substituteParamsFn\(interpolated\)/, 'macro expansion changed');
});

test('the destructive template-update path still behaves as assumed', { skip }, () => {
    const index = read('public/scripts/extensions/in-chat-agents/index.js');
    assert.ok(
        index.includes('function buildUpdatedAgentFromTemplate'),
        'buildUpdatedAgentFromTemplate is gone — re-check the drift recovery design',
    );
    assert.ok(
        index.includes('shouldSkipBundledTemplateMigrations'),
        'the phaseLocked migration gate is gone',
    );
});

test('the agent store still exports what the host adapter needs', { skip }, () => {
    const store = read('public/scripts/extensions/in-chat-agents/agent-store.js');
    for (const name of ['getAgents', 'getAgentById', 'getAgentRegexScripts', 'saveAgent']) {
        assert.ok(
            new RegExp(`export (?:async )?function ${name}\\b`).test(store),
            `agent-store.js no longer exports ${name}`,
        );
    }

    const runner = read('public/scripts/extensions/in-chat-agents/agent-runner.js');
    assert.ok(
        runner.includes('export function refreshRegexSnapshotsForAgent'),
        'agent-runner.js no longer exports refreshRegexSnapshotsForAgent',
    );
});

test('message snapshots still resolve scripts by live reference', { skip }, () => {
    const snapshots = read('public/scripts/extensions/in-chat-agents/regex-snapshot-store.js');
    assert.ok(
        snapshots.includes('export function resolveRegexScriptsForSnapshot'),
        'snapshot resolution is gone',
    );
    // Refs carry ids, not copies of the markup. That is what makes a theme change re-skin
    // existing chat history without rewriting any message.
    assert.ok(snapshots.includes('regexScriptRefs'), 'snapshots no longer use refs');
});

test('the shipped baseline still matches the fork', { skip }, () => {
    const bundles = JSON.parse(read('public/scripts/extensions/in-chat-agents/templates/regex-bundles.json'));

    for (const entry of STOCK.filter(item => item.source === 'regex-bundles.json')) {
        const live = (bundles[entry.templateId] ?? []).find(script => script.id === entry.scriptId);
        assert.ok(live, `${entry.scriptName} is no longer in regex-bundles.json`);
        assert.equal(
            live.findRegex, entry.findRegex,
            `${entry.scriptName}: pattern changed upstream — run npm run generate:stock and re-check the spec`,
        );
        assert.equal(
            live.replaceString ?? '', entry.replaceString,
            `${entry.scriptName}: stock markup changed upstream — run npm run generate:stock`,
        );
    }
});

test('the companion templates still ship the scripts we have specs for', { skip }, () => {
    const companions = [...new Set(STOCK.filter(item => item.source !== 'regex-bundles.json')
        .map(item => item.source))];

    for (const file of companions) {
        const template = JSON.parse(read(`public/scripts/extensions/in-chat-agents/templates/${file}`));
        const shipped = new Map((template.regexScripts ?? []).map(script => [script.id, script]));

        for (const entry of STOCK.filter(item => item.source === file)) {
            const live = shipped.get(entry.scriptId);
            assert.ok(live, `${file}: ${entry.scriptName} is gone`);
            assert.equal(live.findRegex, entry.findRegex, `${file}/${entry.scriptName}: pattern changed`);
        }
    }
});
