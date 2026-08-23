/**
 * Loads the real in-chat-agents regex engine out of a SillyBunny checkout, so tests render
 * against the same code the browser runs rather than a reimplementation.
 *
 * `public/scripts/utils.js` cannot be imported in Node, because it uses root-absolute
 * specifiers like '/scripts/i18n.js', so it is mocked with the two functions the engine actually
 * needs. This requires `--experimental-test-module-mocks`.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const mockExports = Number.parseInt(process.versions.node, 10) >= 24 ? 'exports' : 'namedExports';
const CANDIDATES = [
    process.env.RAT_ST_ROOT,
    '/home/platinum/SillyBunny',
    resolve(dirname(new URL(import.meta.url).pathname), '../../../../SillyBunny'),
].filter(Boolean);

export function findSillyBunnyRoot() {
    for (const candidate of CANDIDATES) {
        if (existsSync(join(candidate, 'public/scripts/extensions/in-chat-agents/regex-scripts.js'))) {
            return candidate;
        }
    }
    if (process.env.RAT_REQUIRE_HOST === '1') {
        throw new Error('RAT_REQUIRE_HOST=1 but no SillyBunny checkout was found. Set RAT_ST_ROOT.');
    }
    return null;
}

function regexFromString(input) {
    try {
        const m = String(input ?? '').match(/(\/?)(.+)\1([a-z]*)/i);
        if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
            return new RegExp(input);
        }
        return new RegExp(m[2], m[3]);
    } catch {
        return null;
    }
}

let cached = null;

/**
 * @param {import('node:test').mock} mock The test runner's mock object.
 * @returns {Promise<{applyRegexScriptList: Function, AGENT_REGEX_PLACEMENT: object}|null>}
 */
export async function loadRegexEngine(mock) {
    if (cached) {
        return cached;
    }
    const root = findSillyBunnyRoot();
    if (!root || typeof mock?.module !== 'function') {
        return null;
    }

    let counter = 0;
    mock.module(pathToFileURL(join(root, 'public/scripts/utils.js')).href, {
        [mockExports]: {
            regexFromString,
            uuidv4: () => `test-uuid-${++counter}`,
        },
    });

    cached = await import(pathToFileURL(join(root, 'public/scripts/extensions/in-chat-agents/regex-scripts.js')).href);
    return cached;
}

/** Runs a themed script list over sample text exactly as the display pipeline would. */
export function renderWith(engine, scripts, text) {
    return engine.applyRegexScriptList(text, scripts, engine.AGENT_REGEX_PLACEMENT.AI_OUTPUT, {
        isMarkdown: true,
        substituteParamsFn: value => String(value).replaceAll('{{user}}', 'You'),
        substituteParamsExtendedFn: value => String(value),
    });
}
