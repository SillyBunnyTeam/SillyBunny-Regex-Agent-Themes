import assert from 'node:assert/strict';
import test from 'node:test';

import { registerCommands, unregisterCommands } from '../src/commands.js';
import { SETTINGS_KEY } from '../src/constants.js';
import { __setHostForTests } from '../src/host.js';
import { getSettings, updateSettings } from '../src/settings.js';

class Factory {
    static fromProps(props) {
        return { ...props };
    }
}

class EnumValue {
    constructor(value) {
        this.value = value;
    }
}

function install() {
    const parser = {
        commands: {},
        addCommandObject(command) {
            this.commands[command.name] = command;
        },
    };
    const context = {
        extensionSettings: { [SETTINGS_KEY]: {} },
        saveSettingsDebounced() {},
        SlashCommandParser: parser,
        SlashCommand: Factory,
        SlashCommandArgument: Factory,
        SlashCommandNamedArgument: Factory,
        SlashCommandEnumValue: EnumValue,
        ARGUMENT_TYPE: { STRING: 'string' },
    };
    globalThis.SillyTavern = { getContext: () => context };
    __setHostForTests({
        ok: true,
        store: { getAgents: () => [] },
        scripts: { normalizeRegexScript: value => value },
    });
    return { context, parser };
}

test('commands unregister by identity and retained callbacks are disabled', async () => {
    const { parser } = install();
    assert.equal(registerCommands(), true);
    const retained = parser.commands['rat-status'];
    assert.ok(retained);

    unregisterCommands();
    assert.equal(parser.commands['rat-status'], undefined);
    assert.equal(await retained.callback(), 'Regex Agent Themes is disabled.');

    assert.equal(registerCommands(), true);
    assert.ok(parser.commands['rat-status']);
    unregisterCommands();
});

test('tracker command rejects unknown themes and accepts validated custom themes', async () => {
    const { parser } = install();
    updateSettings({ customThemes: { 'my-theme': { name: 'My Theme' } } });
    registerCommands();
    const command = parser.commands['rat-theme-tracker'];

    assert.equal(
        await command.callback({ tracker: 'tpl-scene-tracker', theme: 'not-real' }),
        'unknown theme: not-real',
    );
    assert.deepEqual(getSettings().overrides, {});

    const result = await command.callback({ tracker: 'tpl-scene-tracker', theme: 'my-theme' });
    assert.match(result, /^my-theme;/);
    assert.equal(getSettings().overrides['tpl-scene-tracker'], 'my-theme');
    unregisterCommands();
});
