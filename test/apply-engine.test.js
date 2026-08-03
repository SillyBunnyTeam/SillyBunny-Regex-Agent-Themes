import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyAll,
    applyToAgent,
    inspectAgent,
    reconcile,
    revertAgent,
    themableAgents,
} from '../src/apply.js';
import { SETTINGS_KEY } from '../src/constants.js';
import { __setHostForTests } from '../src/host.js';
import { getSettings, updateSettings } from '../src/settings.js';
import { STOCK } from '../src/stock.js';

function templateAgent(templateId, id = 'agent1') {
    const regexScripts = STOCK.filter(entry => entry.templateId === templateId).map(entry => ({
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
    return {
        id,
        name: `${templateId} ${id}`,
        sourceTemplateId: templateId,
        version: 1,
        phaseLocked: false,
        regexScripts,
    };
}

function sceneAgent(id = 'agent1') {
    return templateAgent('tpl-scene-tracker', id);
}

function installContext() {
    const context = {
        extensionSettings: { [SETTINGS_KEY]: {} },
        saveSettingsDebounced() {},
    };
    globalThis.SillyTavern = { getContext: () => context };
    return context;
}

function installHost(seed, { fail = false, failIds = [], delayMs = 0 } = {}) {
    let agents = structuredClone(Array.isArray(seed) ? seed : [seed]);
    let saves = 0;
    let active = 0;
    let maxActive = 0;
    const store = {
        getAgents: () => [...agents],
        getAgentById: id => agents.find(agent => agent.id === id),
        loadAgents: next => { agents = structuredClone(next); },
        async saveAgent(next) {
            saves++;
            active++;
            maxActive = Math.max(maxActive, active);
            const index = agents.findIndex(agent => agent.id === next.id);
            agents[index] = structuredClone(next);
            if (delayMs) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            active--;
            if (fail || failIds.includes(next.id)) {
                throw new Error('save rejected');
            }
        },
    };
    const host = {
        ok: true,
        store,
        scripts: { normalizeRegexScript: script => structuredClone(script) },
    };
    __setHostForTests(host);
    return {
        host,
        get saves() { return saves; },
        get maxActive() { return maxActive; },
    };
}

test('forced apply persists a hand edit and revert restores it byte-for-byte', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const original = sceneAgent();
    original.regexScripts[0].replaceString = '<strong>my scene card</strong>';
    const fake = installHost(original);
    const agent = fake.host.store.getAgentById(original.id);

    const applied = await applyToAgent(agent, { force: true });
    assert.equal(applied.ok, true);
    assert.equal(
        getSettings().ledger[agent.id].originals[agent.regexScripts[0].id].replaceString,
        '<strong>my scene card</strong>',
    );

    const reverted = await revertAgent(agent);
    assert.equal(reverted.ok, true);
    assert.equal(agent.regexScripts[0].replaceString, '<strong>my scene card</strong>');
    assert.equal(getSettings().ledger[agent.id], undefined);
});

test('revert without a ledger performs no write and preserves foreign markup', async () => {
    installContext();
    const original = sceneAgent();
    original.regexScripts[0].replaceString = '<strong>foreign</strong>';
    const fake = installHost(original);
    const agent = fake.host.store.getAgentById(original.id);

    const result = await revertAgent(agent);
    assert.equal(result.ok, true);
    assert.equal(result.unchanged, true);
    assert.equal(fake.saves, 0);
    assert.equal(agent.regexScripts[0].replaceString, '<strong>foreign</strong>');
});

test('revert blocks a script edited after this extension applied it', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const fake = installHost(sceneAgent());
    const agent = fake.host.store.getAgentById('agent1');
    assert.equal((await applyToAgent(agent)).ok, true);

    const current = fake.host.store.getAgentById('agent1');
    current.regexScripts[0].replaceString = '<strong>edited later</strong>';
    const savesBefore = fake.saves;
    const result = await revertAgent(current);
    assert.equal(result.ok, false);
    assert.equal(result.blocked.length, 1);
    assert.equal(fake.saves, savesBefore);
    assert.equal(current.regexScripts[0].replaceString, '<strong>edited later</strong>');
});

test('save rejection restores the host cache and does not create a ledger entry', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const original = sceneAgent();
    const fake = installHost(original, { fail: true });
    const agent = fake.host.store.getAgentById(original.id);

    const result = await applyToAgent(agent);
    assert.equal(result.ok, false);
    assert.equal(result.rolledBack, true);
    assert.deepEqual(agent, original);
    assert.deepEqual(fake.host.store.getAgentById(original.id), original);
    assert.equal(getSettings().ledger[original.id], undefined);
});

test('agent writes are serialized across simultaneous calls', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const fake = installHost([sceneAgent('agent1'), sceneAgent('agent2')], { delayMs: 10 });

    const first = applyToAgent(fake.host.store.getAgentById('agent1'));
    const second = applyToAgent(fake.host.store.getAgentById('agent2'));
    const results = await Promise.all([first, second]);

    assert.ok(results.every(result => result.ok));
    assert.equal(fake.maxActive, 1);
});

test('known templates remain visible when every expected script is missing', () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const agent = sceneAgent();
    agent.regexScripts = [];

    assert.deepEqual(themableAgents([agent]), [agent]);
    const report = inspectAgent(agent);
    assert.equal(report.status, 'missing');
    assert.ok(report.perScript.every(entry => entry.status === 'missing' && !entry.owned));
});

test('reconcile applies a themed override while the global theme is stock', async () => {
    installContext();
    updateSettings({
        theme: 'stock',
        overrides: { 'tpl-scene-tracker': 'neon-grid' },
    });
    const fake = installHost(sceneAgent());

    const result = await reconcile();
    assert.equal(result.ok, true);
    assert.equal(result.repaired, 1);
    assert.equal(fake.saves, 1);
});

test('reconcile leaves a stock override untouched when it has no ownership ledger', async () => {
    installContext();
    updateSettings({
        theme: 'neon-grid',
        overrides: { 'tpl-scene-tracker': 'stock' },
    });
    const original = sceneAgent();
    const fake = installHost(original);

    const result = await reconcile();
    assert.equal(result.ok, true);
    assert.equal(result.repaired, 0);
    assert.equal(result.reverted, 0);
    assert.equal(fake.saves, 0);
    assert.deepEqual(fake.host.store.getAgentById(original.id), original);
});

test('reconcile safely restores a ledger-owned agent whose override changed to stock', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const original = sceneAgent();
    const fake = installHost(original);
    const agent = fake.host.store.getAgentById(original.id);
    assert.equal((await applyToAgent(agent)).ok, true);
    const savesBefore = fake.saves;

    updateSettings({ overrides: { 'tpl-scene-tracker': 'stock' } });
    const result = await reconcile();
    assert.equal(result.ok, true);
    assert.equal(result.reverted, 1);
    assert.equal(fake.saves, savesBefore + 1);
    assert.deepEqual(fake.host.store.getAgentById(original.id).regexScripts, original.regexScripts);
});

test('reconcile repairs a missing extension-owned script', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid', options: { meters: true } });
    const fake = installHost(templateAgent('tpl-relationship-tracker'));
    assert.equal((await applyToAgent(fake.host.store.getAgentById('agent1'))).ok, true);

    const current = fake.host.store.getAgentById('agent1');
    current.regexScripts = current.regexScripts.filter(script => !script.id.startsWith('rat:meter:'));
    const report = inspectAgent(current);
    assert.ok(report.perScript.some(entry => entry.owned && entry.status === 'missing'));
    const savesBefore = fake.saves;

    const result = await reconcile();
    assert.equal(result.repaired, 1);
    assert.equal(fake.saves, savesBefore + 1);
    assert.ok(fake.host.store.getAgentById('agent1').regexScripts
        .some(script => script.id.startsWith('rat:meter:')));
});

test('reconcile reports a missing bundled script without writing', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const agent = sceneAgent();
    agent.regexScripts = [];
    const fake = installHost(agent);

    const result = await reconcile();
    assert.equal(result.repaired, 0);
    assert.equal(result.needsAttention.length, 1);
    assert.equal(result.needsAttention[0].entries[0].status, 'missing');
    assert.equal(fake.saves, 0);
});

test('apply-all continues after one agent save fails', async () => {
    installContext();
    updateSettings({ theme: 'neon-grid' });
    const fake = installHost([sceneAgent('bad'), sceneAgent('good')], { failIds: ['bad'] });

    const result = await applyAll();
    assert.equal(result.ok, true);
    assert.equal(result.applied, 1);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].agentId, 'bad');
    assert.equal(fake.saves, 2);
});
