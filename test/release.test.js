import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FAMILIES, THEMES } from '../src/themes/index.js';

function readJson(relativePath) {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

const pkg = readJson('../package.json');
const lock = readJson('../package-lock.json');
const manifest = readJson('../manifest.json');
const design = readJson('../DESIGN.json');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

function normalizeTheme(theme) {
    return {
        slug: theme.slug,
        name: theme.name,
        family: theme.family,
        mode: theme.mode,
        frame: theme.frame ?? null,
        scan: Boolean(theme.scan),
        ...(theme.motion ? { motion: theme.motion } : {}),
    };
}

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
    assert.equal(THEMES.length, 78);
    assert.match(readme, /78 themes/u);
    assert.deepEqual(
        design.families,
        FAMILIES.map(({ id, label }) => ({
            id,
            label,
            themes: THEMES.filter(theme => theme.family === id).map(theme => theme.slug),
        })),
    );
    assert.deepEqual(design.themes, THEMES.map(normalizeTheme));
    assert.equal(design.styleHooks.motion, 'data-rat-motion');
});
