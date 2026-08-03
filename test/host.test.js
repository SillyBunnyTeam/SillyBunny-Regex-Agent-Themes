import assert from 'node:assert/strict';
import test from 'node:test';

import {
    __setHostForTests,
    repaintMessagesForAgents,
    waitForAgents,
} from '../src/host.js';

function installContext(chat, updateMessageBlock) {
    globalThis.SillyTavern = {
        getContext: () => ({ chat, updateMessageBlock }),
    };
}

test('message repainting updates only matching assistant refs and does not mutate chat data', async () => {
    const chat = [
        { is_user: true, extra: { inChatAgents: { regexScriptRefs: [{ agentId: 'a1', scriptId: 's1' }] } } },
        { mes: 'match', extra: { inChatAgents: { regexScriptRefs: [{ agentId: 'a1', scriptId: 's1' }] } } },
        { mes: 'other script', extra: { inChatAgents: { regexScriptRefs: [{ agentId: 'a1', scriptId: 's2' }] } } },
        { mes: 'other agent', extra: { inChatAgents: { regexScriptRefs: [{ agentId: 'a2', scriptId: 's1' }] } } },
    ];
    const before = structuredClone(chat);
    const updated = [];
    installContext(chat, async index => { updated.push(index); });

    const result = await repaintMessagesForAgents([{ agentId: 'a1', scriptIds: ['s1'] }]);
    assert.deepEqual(updated, [1]);
    assert.deepEqual(chat, before);
    assert.deepEqual(result, { ok: true, matched: 1, repainted: 1, failed: 0 });
});

test('an empty agent store times out as non-authoritative', async () => {
    __setHostForTests({
        ok: true,
        store: { getAgents: () => [] },
        scripts: { normalizeRegexScript: value => value },
    });

    const result = await waitForAgents({ attempts: 1, delayMs: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.ready, false);
    assert.equal(result.timedOut, true);
});

test('agent polling can be cancelled', async () => {
    __setHostForTests({
        ok: true,
        store: { getAgents: () => [] },
        scripts: { normalizeRegexScript: value => value },
    });
    const controller = new AbortController();
    const pending = waitForAgents({ attempts: 10, delayMs: 100, signal: controller.signal });
    controller.abort();

    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.cancelled, true);
});
