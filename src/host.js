/**
 * The entire deep-import surface into SillyBunny's bundled In-Chat Agents extension.
 *
 * Everything else in this extension goes through `SillyTavern.getContext()`, which is the
 * fork's supported API. The agent store is not on it, so these three modules have to be
 * imported by path, and that coupling is kept here on purpose.
 *
 * Four rules make that survivable:
 *  1. Absolute URL specifiers, so moving a file inside this extension cannot break them.
 *  2. Dynamic import inside try/catch. A static import of a moved file is an unrecoverable
 *     module-graph failure that would take the whole extension down with it.
 *  3. Every named export is feature-detected before the adapter reports ready.
 *  4. Nothing throws. Callers branch on `ok`.
 */

const STORE_URL = '/scripts/extensions/in-chat-agents/agent-store.js';
const SCRIPTS_URL = '/scripts/extensions/in-chat-agents/regex-scripts.js';
const RUNNER_URL = '/scripts/extensions/in-chat-agents/agent-runner.js';

const REQUIRED_STORE = ['getAgents', 'getAgentById', 'getAgentRegexScripts', 'saveAgent'];
const REQUIRED_SCRIPTS = ['normalizeRegexScript', 'applyRegexScriptList', 'AGENT_REGEX_PLACEMENT'];

let state = null;

function missingExports(module, names) {
    return names.filter(name => module?.[name] === undefined);
}

/**
 * Resolves the adapter once and caches the result.
 * @returns {Promise<{ok: boolean, reason?: string, store?: object, scripts?: object}>}
 */
export async function loadHost() {
    if (state) {
        return state;
    }

    try {
        const [store, scripts] = await Promise.all([import(STORE_URL), import(SCRIPTS_URL)]);

        const missing = [
            ...missingExports(store, REQUIRED_STORE),
            ...missingExports(scripts, REQUIRED_SCRIPTS),
        ];
        if (missing.length) {
            state = { ok: false, reason: `In-Chat Agents is missing: ${missing.join(', ')}` };
            return state;
        }

        state = { ok: true, store, scripts };
    } catch (error) {
        state = { ok: false, reason: `Could not load In-Chat Agents (${error?.message ?? error})` };
    }

    return state;
}

/**
 * The snapshot refresher lives in a much larger module, so it loads separately. If it is
 * unavailable, applying a theme still works, the user just has to switch chats to see
 * already-rendered messages update.
 */
export async function loadRefresher() {
    try {
        const runner = await import(RUNNER_URL);
        return typeof runner.refreshRegexSnapshotsForAgent === 'function'
            ? runner.refreshRegexSnapshotsForAgent
            : null;
    } catch {
        return null;
    }
}

export function getContext() {
    return globalThis.SillyTavern?.getContext?.() ?? null;
}

/**
 * Waits until the agent store has actually loaded its agents. The extension's own boot
 * order does not guarantee In-Chat Agents has finished reading settings.
 */
export async function waitForAgents({ attempts = 20, delayMs = 250 } = {}) {
    const host = await loadHost();
    if (!host.ok) {
        return host;
    }

    for (let attempt = 0; attempt < attempts; attempt++) {
        const agents = host.store.getAgents();
        if (Array.isArray(agents) && agents.length > 0) {
            return host;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // An empty list is a legitimate state (a user may have deleted every agent), so this
    // is not an error, callers just find nothing to theme.
    return host;
}

/** Test seam: lets the apply tests inject a fake store without touching the DOM. */
export function __setHostForTests(fake) {
    state = fake;
}
