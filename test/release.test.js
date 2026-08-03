import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { THEMES } from '../src/themes/index.js';

function readJson(relativePath) {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

const pkg = readJson('../package.json');
const lock = readJson('../package-lock.json');
const manifest = readJson('../manifest.json');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('release metadata stays synchronized and declares its runtime contract', () => {
    assert.equal(manifest.version, pkg.version);
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[''].version, pkg.version);
    assert.deepEqual(manifest.dependencies, ['in-chat-agents']);
    assert.equal(manifest.minimum_client_version, '1.7.0');
    assert.equal(manifest.hooks.enable, 'init');
    assert.equal(pkg.engines.node, '>=22.3.0');
    assert.equal(pkg.devDependencies['@adobe/css-tools'], '4.4.4');
});

test('published theme count matches the registry', () => {
    assert.equal(THEMES.length, 45);
    assert.match(readme, /45 themes/u);
});
