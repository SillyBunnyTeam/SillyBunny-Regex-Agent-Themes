import assert from 'node:assert/strict';
import test from 'node:test';

import { SETTINGS_KEY } from '../src/constants.js';
import { getSettings, updateSettings } from '../src/settings.js';

function installContext(raw = {}) {
    const context = {
        extensionSettings: { [SETTINGS_KEY]: raw },
        saveSettingsDebounced() {},
    };
    globalThis.SillyTavern = { getContext: () => context };
    return context;
}

test('ledger backups and owned script ids survive a settings round trip', () => {
    installContext();
    updateSettings({
        ledger: {
            agent1: {
                agentId: 'agent1',
                templateId: 'tpl-scene-tracker',
                theme: 'neon-grid',
                engine: 1,
                appliedAt: 42,
                versionBefore: 3,
                phaseLockedBefore: false,
                scripts: {
                    script1: { applied: '', findRegex: '/scene/g', generated: ['', '<div>old</div>'] },
                },
                originals: {
                    script1: { replaceString: '<b>mine</b>', findRegex: '/scene/g' },
                },
                added: ['rat:meter:agent1', 'rat:meter:agent1'],
            },
        },
    });

    const entry = getSettings().ledger.agent1;
    assert.deepEqual(entry.scripts.script1, {
        applied: '',
        findRegex: '/scene/g',
        generated: ['', '<div>old</div>'],
    });
    assert.deepEqual(entry.originals.script1, {
        replaceString: '<b>mine</b>',
        findRegex: '/scene/g',
    });
    assert.deepEqual(entry.added, ['rat:meter:agent1']);
});

test('density survives settings updates and invalid values fall back to normal', () => {
    const context = installContext({ options: { density: 'compact', meters: true } });
    assert.equal(getSettings().options.density, 'compact');

    updateSettings({ options: { density: 'roomy' } });
    assert.equal(context.extensionSettings[SETTINGS_KEY].options.density, 'roomy');
    assert.equal(getSettings().options.meters, true);

    context.extensionSettings[SETTINGS_KEY].options.density = 'extra-roomy';
    assert.equal(getSettings().options.density, 'normal');
});

test('malformed ledger backup values are rejected rather than coerced', () => {
    installContext({
        ledger: {
            agent1: {
                scripts: { good: { applied: '<div></div>' }, bad: { applied: 4 } },
                originals: {
                    good: { replaceString: '', findRegex: '/x/g' },
                    bad: { replaceString: '<b>x</b>' },
                },
                added: ['rat:cleanup:a', null, 3],
            },
        },
    });

    const entry = getSettings().ledger.agent1;
    assert.deepEqual(entry.scripts, { good: { applied: '<div></div>' } });
    assert.deepEqual(entry.originals, { good: { replaceString: '', findRegex: '/x/g' } });
    assert.deepEqual(entry.added, ['rat:cleanup:a']);
});

test('custom themes use the strict schema on every settings read', () => {
    installContext({
        theme: 'safe-theme',
        customThemes: {
            'safe-theme': {
                name: 'Safe Theme',
                mode: 'light',
                surface: { row: '#f5f5f5' },
                glyph: { section: '◆' },
            },
            stock: { name: 'Shadow stock' },
            hostile: { ornament: { rootBefore: '<img src=x onerror=alert(1)>' } },
        },
    });

    const settings = getSettings();
    assert.deepEqual(Object.keys(settings.customThemes), ['safe-theme']);
    assert.equal(settings.customThemes['safe-theme'].family, 'custom');
    assert.equal(settings.customThemes['safe-theme'].surface.row, '#f5f5f5');
    assert.equal(settings.theme, 'safe-theme');
});
