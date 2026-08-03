/**
 * Entry point. Wiring only — every decision lives in src/.
 *
 * `deactivate` deliberately does not revert. Applied themes live in the user's agent JSON,
 * not in this extension, so silently un-theming on disable would be a destructive surprise.
 * Use "Revert all" in the drawer, or /rat-revert.
 */

import { mountSettings, removeSettings } from './src/ui.js';
import { registerCommands } from './src/commands.js';
import { getSettings, pruneLedger } from './src/settings.js';
import { reconcile } from './src/apply.js';
import { getContext, waitForAgents } from './src/host.js';

let booted = false;
let refresh = () => {};
const subscriptions = [];

function subscribe(eventType, handler) {
    if (!eventType) {
        return;
    }
    const context = getContext();
    if (!context?.eventSource) {
        return;
    }
    context.eventSource.on(eventType, handler);
    subscriptions.push({ eventType, handler });
}

/**
 * The boot pass runs once. In-Chat Agents loads its agents from settings asynchronously, so
 * this waits for the store rather than assuming it is populated.
 */
async function reconcileOnce() {
    const host = await waitForAgents();
    if (!host.ok) {
        return;
    }

    pruneLedger((host.store.getAgents() ?? []).map(agent => agent.id));

    const result = await reconcile();
    if (!result.ok) {
        return;
    }

    if (result.repaired > 0) {
        globalThis.toastr?.info?.(
            `Regex Agent Themes: restored your theme on ${result.repaired} tracker(s) after a template update.`,
        );
    }
    if (result.needsAttention.length > 0) {
        const names = result.needsAttention.map(item => item.agentName).join(', ');
        globalThis.toastr?.warning?.(
            `Regex Agent Themes: left ${result.needsAttention.length} tracker(s) alone because they were edited outside the extension (${names}).`,
        );
    }
    refresh();
}

export function init() {
    if (booted) {
        return;
    }
    booted = true;

    getSettings();
    refresh = mountSettings() ?? (() => {});
    registerCommands(() => refresh());

    const context = getContext();
    const events = context?.eventTypes;
    if (!events) {
        return;
    }

    // APP_READY is sticky in SillyBunny's emitter, so subscribing after it has already
    // fired still runs the handler.
    subscribe(events.APP_READY, reconcileOnce);
    subscribe(events.SETTINGS_UPDATED, () => refresh());
    subscribe(events.CHAT_CHANGED, () => refresh());
}

export function deactivate() {
    removeSettings();

    const context = getContext();
    while (subscriptions.length) {
        const { eventType, handler } = subscriptions.pop();
        context?.eventSource?.removeListener?.(eventType, handler);
    }

    refresh = () => {};
    booted = false;
}
