/**
 * Keeps GALLERY.md, the committed screenshots and the theme registry in step.
 *
 * The document is a pure function of THEMES and FAMILIES, so asserting the committed file
 * equals that function is the same discipline the host-contract job applies to src/stock.js
 * — except it runs in the pure job, with no browser and no SillyBunny checkout.
 *
 * The images themselves are deliberately not diffed. They are lossy captures whose bytes
 * move with the Chrome build and the fonts on the machine that made them; what matters is
 * that every theme has one, that nothing is orphaned, and that the set stays small enough
 * to ship to every install.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { FAMILIES, THEMES } from '../src/themes/index.js';
import { galleryMarkdown } from '../scripts/generate-gallery.mjs';

const gallery = readFileSync(new URL('../GALLERY.md', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const assetsDir = new URL('../assets/themes/', import.meta.url);
const assets = readdirSync(assetsDir).filter(name => !name.startsWith('.'));

/** Adaptive themes are shot twice, once per host backdrop. */
const EXPECTED_IMAGES = THEMES.length + THEMES.filter(theme => theme.mode === 'adaptive').length;
const SIZE_CEILING = 3.5 * 1024 * 1024;

test('GALLERY.md is exactly what the generator produces', () => {
    assert.equal(gallery, galleryMarkdown());
});

test('every theme has a heading and every heading has a theme', () => {
    const headings = [...gallery.matchAll(/^### (.+)$/gmu)].map(match => match[1]);
    assert.deepEqual(headings, FAMILIES.flatMap(
        family => THEMES.filter(theme => theme.family === family.id).map(theme => theme.name),
    ));

    for (const theme of THEMES) {
        assert.ok(gallery.includes(`\`${theme.slug}\``), `${theme.slug}: slug missing from the gallery`);
    }
});

test('family sections are linked by anchors GitHub will actually resolve', () => {
    for (const family of FAMILIES) {
        // GitHub deletes punctuation rather than replacing it, so "Cute & Soft" is
        // `cute--soft`. A single hyphen here would be a link to nowhere.
        const expected = family.label.trim().toLowerCase()
            .replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~\\]/gu, '')
            .replace(/ /gu, '-');
        assert.ok(
            gallery.includes(`- [${family.label}](#${expected})`),
            `${family.label}: table-of-contents anchor is not #${expected}`,
        );
        assert.ok(gallery.includes(`## ${family.label}`), `${family.label}: section missing`);
    }
});

test('every referenced image exists and every committed image is referenced', () => {
    const referenced = new Set(
        [...gallery.matchAll(/\(assets\/themes\/([^)]+)\)/gu)].map(match => match[1]),
    );
    assert.equal(referenced.size, EXPECTED_IMAGES);

    for (const name of referenced) {
        assert.ok(assets.includes(name), `${name}: referenced by GALLERY.md but not committed`);
    }
    for (const name of assets) {
        assert.match(name, /\.webp$/u, `${name}: only .webp belongs in assets/themes`);
        assert.ok(referenced.has(name), `${name}: committed but never referenced`);
    }
});

test('the gallery stays small enough to ship to every install', () => {
    const total = assets.reduce(
        (sum, name) => sum + statSync(fileURLToPath(new URL(name, assetsDir))).size,
        0,
    );
    assert.ok(total < SIZE_CEILING, `assets/themes is ${(total / 1024 / 1024).toFixed(2)} MiB`);
});

test('the README points at the gallery instead of listing themes itself', () => {
    assert.match(readme, /\]\(GALLERY\.md\)/u);
    assert.doesNotMatch(readme, /\| Family \| Themes \|/u);
    assert.match(readme, /78 themes/u);
});
