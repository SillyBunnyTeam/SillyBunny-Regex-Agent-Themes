import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const mockExports = Number.parseInt(process.versions.node, 10) >= 24 ? 'exports' : 'namedExports';

test('deactivation cancels pending boot work and tears down commands and listeners', async () => {
    const calls = {
        mount: 0,
        remove: 0,
        register: 0,
        unregister: 0,
        prune: 0,
        reconcile: 0,
        refresh: 0,
    };
    const listeners = new Map();
    const context = {
        eventTypes: {
            APP_READY: 'app-ready',
            SETTINGS_UPDATED: 'settings-updated',
            CHAT_CHANGED: 'chat-changed',
        },
        eventSource: {
            on(type, handler) {
                listeners.set(type, handler);
                if (type === 'app-ready') handler();
            },
            removeListener(type, handler) {
                if (listeners.get(type) === handler) listeners.delete(type);
            },
        },
    };
    let finishWait;
    const waiting = new Promise(resolve => { finishWait = resolve; });

    const url = relative => new URL(relative, import.meta.url).href;
    mock.module(url('../src/ui.js'), {
        [mockExports]: {
            mountSettings: () => {
                calls.mount++;
                return () => { calls.refresh++; };
            },
            removeSettings: () => { calls.remove++; },
        },
    });
    mock.module(url('../src/commands.js'), {
        [mockExports]: {
            registerCommands: () => { calls.register++; },
            unregisterCommands: () => { calls.unregister++; },
        },
    });
    mock.module(url('../src/settings.js'), {
        [mockExports]: {
            getSettings: () => ({}),
            pruneLedger: () => { calls.prune++; },
        },
    });
    mock.module(url('../src/apply.js'), {
        [mockExports]: {
            reconcile: async () => {
                calls.reconcile++;
                return { ok: true, repaired: 0, reverted: 0, needsAttention: [], failed: [] };
            },
        },
    });
    mock.module(url('../src/host.js'), {
        [mockExports]: {
            getContext: () => context,
            waitForAgents: () => waiting,
        },
    });

    const entry = await import(`${url('../index.js')}?lifecycle-test`);
    entry.init();
    assert.equal(calls.mount, 1);
    assert.equal(calls.register, 1);

    entry.deactivate();
    finishWait({ ok: true, ready: true, store: { getAgents: () => [{ id: 'late' }] } });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(calls.unregister, 1);
    assert.equal(calls.remove, 1);
    assert.equal(calls.prune, 0);
    assert.equal(calls.reconcile, 0);
    assert.equal(listeners.size, 0);
});
