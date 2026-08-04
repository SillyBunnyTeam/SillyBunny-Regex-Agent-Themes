/**
 * Regenerates GALLERY.md and assets/themes/*.webp — one composite screenshot per theme.
 *
 * Usage: node scripts/generate-gallery.mjs [--only <slug>] [--keep-png]
 *
 * Each shot stacks the same three cards, so themes stay comparable: the scene tracker
 * (panel), the major NPC profile (profile) and the CYOA choice menu (slots). They are
 * rendered from the real generated markup over the real sample marker blocks, the same
 * pairing `src/preview.js` uses for the in-app gallery.
 *
 * The markup is host-free by design — every fragment carries complete inline styles and
 * `data-rat-*` hooks — so this runs without SillyBunny. Only `style.css` has to come along,
 * for empty-row collapse, disclosure chrome and the animated themes' keyframes.
 *
 * Requires headless Chrome (see resolveChrome) plus `cwebp` and `magick` on PATH. This is a
 * maintainer script; the extension itself needs none of them.
 *
 * Type falls back to whatever the capture machine has installed, so a theme naming a font
 * nobody ships renders in its generic fallback. That is what most users see too, but it does
 * mean a regeneration on a different machine can rewrite every image: regenerate all 81 in
 * one place, and treat a full-set diff as a red flag rather than routine churn.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ARCHETYPES, SPECS } from '../src/specs.js';
import { SAMPLES, sampleFor } from '../src/samples.js';
import { applyList } from '../src/interpolate.js';
import { buildAgentScripts } from '../src/build.js';
import { PREVIEW_KEYS, stockScriptsFor } from '../src/preview.js';
import { FAMILIES, THEMES } from '../src/themes/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const assets = join(repo, 'assets/themes');

/** The three archetypes every composite shows, top to bottom. */
const COMPOSITE = [ARCHETYPES.PANEL, ARCHETYPES.PROFILE, ARCHETYPES.SLOTS];

/**
 * `all-open` is the one deviation from install defaults: the NPC profile ships collapsed,
 * and a screenshot of a closed disclosure shows nothing worth comparing. It only sets the
 * `open` attribute — no colour, spacing or type differs from what a fresh install renders.
 */
const RENDER_OPTIONS = Object.freeze({ openDefaults: 'all-open' });

const WIDTH = 560;
const MAX_HEIGHT = 2600;
const PADDING = 22;
const SCALE = 1.5;
const WEBP_QUALITY = 68;

/** Every image is pinned to this width, so the gallery page cannot render ragged. */
const SHOT_WIDTH = (WIDTH + PADDING * 2) * SCALE;

/**
 * Chat backdrops, copied from the presets SillyBunny ships in
 * `default/content/themes/`, so the surface behind a card is one a user really has.
 * Light themes are shot on the light preset and dark ones on the dark preset; the adaptive
 * themes are shot on both, because both are the point.
 */
const BACKDROPS = Object.freeze({
    light: {
        label: 'Nord Light',
        body: 'rgba(94, 129, 172, 1)',
        em: 'rgba(94, 129, 172, 0.6)',
        quote: 'rgba(163, 190, 140, 1)',
        tint: 'rgba(236, 239, 244, 1)',
        shadow: 'rgba(94, 129, 172, 0.3)',
    },
    dark: {
        label: 'Dracula',
        body: 'rgba(225, 215, 239, 0.74)',
        em: 'rgba(189, 147, 249, 0.5)',
        quote: 'rgba(139, 233, 253, 1)',
        tint: 'rgba(40, 42, 54, 1)',
        shadow: 'rgba(189, 147, 249, 0.4)',
    },
});

const STYLESHEET = readFileSync(join(repo, 'style.css'), 'utf8');

/* ----------------------------------------------------------------------- rendering */

function renderArchetype(archetype, theme) {
    const key = PREVIEW_KEYS[archetype];
    const spec = SPECS.find(item => item.key === key);
    if (!spec || !SAMPLES[key]) {
        throw new Error(`No sample for archetype "${archetype}"`);
    }
    const { scripts } = buildAgentScripts(
        spec.templateId, stockScriptsFor(spec.templateId), theme, RENDER_OPTIONS, 'gallery',
    );
    return applyList(sampleFor(spec), scripts, value => String(value).replaceAll('{{user}}', 'You'));
}

/**
 * Animated themes only move a decorative root glow, over cycles ranging from 5s to 46s. A
 * fixed delay would land each theme on a different phase, so the duration is normalised
 * first and the delay set to half of it: every theme is then paused on its glow peak, which
 * is where each keyframe list puts its 50% stop. Pausing also keeps successive runs
 * byte-identical.
 *
 * Emulating `prefers-reduced-motion` would be the wrong lever — style.css answers it with
 * `animation: none`, which would show all 13 animated themes at rest.
 */
const FREEZE = `
.mes_text [data-rat-motion][data-rat-part='root'] {
    animation-duration: 2s !important;
    animation-delay: -1s !important;
    animation-play-state: paused !important;
}
`;

function capturePage(theme, backdrop) {
    const fragments = COMPOSITE.map(archetype => renderArchetype(archetype, theme)).join('\n');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${theme.name}</title><style>
:root {
    --SmartThemeBodyColor: ${backdrop.body};
    --SmartThemeEmColor: ${backdrop.em};
    --SmartThemeQuoteColor: ${backdrop.quote};
    --SmartThemeBlurTintColor: ${backdrop.tint};
    --SmartThemeShadowColor: ${backdrop.shadow};
    --mainFontFamily: 'Noto Sans', system-ui, sans-serif;
}
html { font-size: 16px; }
body {
    margin: 0;
    padding: ${PADDING}px;
    width: ${WIDTH}px;
    background: ${backdrop.tint};
    color: var(--SmartThemeBodyColor);
    font-family: var(--mainFontFamily);
    font-size: 15px;
    line-height: 1.5;
}
/* The generated fragments lead and trail with their own margin; trim it at the edges. */
.mes_text > :first-child { margin-top: 0; }
.mes_text > :last-child { margin-bottom: 0; }
${STYLESHEET}
${FREEZE}
</style></head>
<body><div class="mes_text">${fragments}</div></body></html>
`;
}

/* ------------------------------------------------------------------------ capturing */

let chromePath = null;

/** Resolved on first capture, so `--doc-only` runs on a machine with no browser at all. */
function chrome() {
    chromePath ??= resolveChrome();
    return chromePath;
}

function resolveChrome() {
    if (process.env.CHROME_PATH) {
        return process.env.CHROME_PATH;
    }
    const cache = join(process.env.HOME ?? '', '.cache/ms-playwright');
    if (existsSync(cache)) {
        const builds = readdirSync(cache)
            .filter(name => /^chromium-\d+$/.test(name))
            .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
        for (const build of builds) {
            const binary = join(cache, build, 'chrome-linux64/chrome');
            if (existsSync(binary)) {
                return binary;
            }
        }
    }
    for (const name of ['google-chrome-stable', 'google-chrome', 'chromium']) {
        const found = which(name);
        if (found) {
            return found;
        }
    }
    throw new Error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.');
}

function which(name) {
    try {
        return execFileSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

function requireTool(name) {
    if (!which(name)) {
        throw new Error(`Required tool "${name}" is not on PATH.`);
    }
}

function shoot(html, slug, variant, scratch) {
    const stem = variant ? `${slug}-${variant}` : slug;
    const tint = backdropOf(slug, variant).tint;
    const htmlPath = join(scratch, `${stem}.html`);
    const rawPath = join(scratch, `${stem}.raw.png`);
    const pngPath = join(keepPng ? assets : scratch, `${stem}.png`);
    const webpPath = join(assets, `${stem}.webp`);

    writeFileSync(htmlPath, html, 'utf8');
    execFileSync(chrome(), [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        '--force-color-profile=srgb',
        '--disable-lcd-text',
        `--force-device-scale-factor=${SCALE}`,
        `--window-size=${WIDTH + PADDING * 2},${MAX_HEIGHT}`,
        `--screenshot=${rawPath}`,
        `file://${htmlPath}`,
    ], { stdio: 'pipe' });

    // The window is deliberately taller than any card stack, so trimming the uniform backdrop
    // back to the content bounds fixes the height without a second measuring pass. Vertical
    // padding is then restored with a border, but horizontal padding is restored with
    // `-extent` instead: a theme whose glow reaches the page edge trims wider than one whose
    // shadow stays contained, and adding a fixed border to both produced twenty different
    // widths across the set. Since a trim can only ever narrow the capture, extending to the
    // original width re-pads without cropping anything.
    execFileSync('magick', [
        rawPath,
        '-fuzz', '0%',
        '-trim', '+repage',
        '-bordercolor', tint,
        '-border', `0x${PADDING * SCALE}`,
        '-background', tint,
        '-gravity', 'center',
        '-extent', `${SHOT_WIDTH}x`,
        pngPath,
    ], { stdio: 'pipe' });

    const [width, height] = execFileSync('magick', ['identify', '-format', '%w %h', pngPath], { encoding: 'utf8' })
        .split(' ').map(Number);
    if (height >= MAX_HEIGHT * SCALE) {
        throw new Error(`${stem}: content hit the ${MAX_HEIGHT}px capture ceiling and was clipped.`);
    }
    if (width !== SHOT_WIDTH) {
        throw new Error(`${stem}: width ${width} is not the pinned ${SHOT_WIDTH}.`);
    }

    execFileSync('cwebp', [
        '-quiet', '-q', String(WEBP_QUALITY), '-metadata', 'none', pngPath, '-o', webpPath,
    ], { stdio: 'pipe' });

    return webpPath;
}

/** Backdrop for a shot, by the variant when one is forced and the theme's mode otherwise. */
function backdropOf(slug, variant) {
    if (variant) {
        return BACKDROPS[variant];
    }
    const theme = THEMES.find(item => item.slug === slug);
    return BACKDROPS[theme.mode === 'light' ? 'light' : 'dark'];
}

/* -------------------------------------------------------------------------- the doc */

/**
 * Notes for the two families whose stills need a caveat. Animated themes cannot show motion
 * in a screenshot, and adaptive themes look darker than their host because the safety scrim
 * (`src/tokens.js:333`) guarantees contrast against a palette that is unknown until runtime.
 */
const FAMILY_NOTES = Object.freeze({
    animated: [
        'Captured mid-cycle. In chat the glow drifts slowly around the card and stops entirely when',
        'the operating system asks for reduced motion. Nothing else moves.',
    ],
    adaptive: [
        'These borrow the active SillyBunny theme\'s tint and accent colours, which is why each is',
        'shown twice. A local safety surface keeps text readable against a palette the theme cannot',
        'know in advance, so the card stays dark even on a light host theme.',
    ],
});

function modeLabel(theme) {
    return { light: 'Light', dark: 'Dark', adaptive: 'Adaptive' }[theme.mode] ?? theme.mode;
}

function traits(theme) {
    const out = [`\`${theme.slug}\``, modeLabel(theme)];
    if (theme.motion) {
        out.push('Animated');
    }
    if (theme.frame) {
        out.push(`${theme.frame} frame`);
    }
    if (theme.scan) {
        out.push('scan layer');
    }
    return out.join(' · ');
}

/**
 * GitHub's heading slugger deletes punctuation without replacing it, so "Cute & Soft"
 * becomes `cute--soft` — two hyphens, from the spaces either side of the removed `&`.
 * Collapsing to one hyphen produces a link that silently goes nowhere.
 */
function anchor(label) {
    return label.trim().toLowerCase()
        .replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~\\]/g, '')
        .replace(/ /g, '-');
}

export function galleryMarkdown() {
    const lines = [
        '# Theme Gallery',
        '',
        `Every one of the ${THEMES.length} themes, rendered from its own generated markup over the`,
        'extension\'s sample tracker data. Each shot stacks the same three cards — a scene tracker, a',
        'major NPC profile, and a choice menu — so themes can be compared directly.',
        '',
        'Cards are shown expanded; the NPC profile ships collapsed and opens on click. Light themes are',
        `shot on the ${BACKDROPS.light.label} chat backdrop and dark themes on ${BACKDROPS.dark.label}.`,
        'A self-contained theme carries its own colours and looks the same on any SillyBunny theme; the',
        'adaptive ones are shown on both backdrops, because following the host theme is the point.',
        '',
        'Type falls back to whatever fonts the reader\'s machine has, so a theme naming a display face',
        'nobody ships renders in its generic serif, sans or monospace fallback here and in chat alike.',
        '',
        `Apply one with \`/rat-theme <slug>\`, or pick it in **Browse themes**. Regenerate this page with`,
        '`npm run generate:gallery`.',
        '',
    ];

    lines.push(...FAMILIES.map(family => `- [${family.label}](#${anchor(family.label)})`), '');

    for (const family of FAMILIES) {
        const themes = THEMES.filter(theme => theme.family === family.id);
        lines.push(`## ${family.label}`, '');
        if (FAMILY_NOTES[family.id]) {
            lines.push(...FAMILY_NOTES[family.id], '');
        }
        for (const theme of themes) {
            lines.push(`### ${theme.name}`, '', traits(theme), '');
            if (theme.mode === 'adaptive') {
                lines.push(
                    `| On a light SillyBunny theme (${BACKDROPS.light.label}) | On a dark one (${BACKDROPS.dark.label}) |`,
                    '| --- | --- |',
                    `| ![${theme.name} on a light theme](assets/themes/${theme.slug}-light.webp)`
                    + ` | ![${theme.name} on a dark theme](assets/themes/${theme.slug}-dark.webp) |`,
                    '',
                );
            } else {
                lines.push(`![${theme.name} tracker panel, NPC profile and choice menu](assets/themes/${theme.slug}.webp)`, '');
            }
        }
    }

    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/* --------------------------------------------------------------------------- driver */

const args = process.argv.slice(2);
const keepPng = args.includes('--keep-png');

function main() {
    const docOnly = args.includes('--doc-only');
    const onlyIndex = args.indexOf('--only');
    const only = onlyIndex === -1 ? null : args[onlyIndex + 1];

    const targets = only ? THEMES.filter(theme => theme.slug === only) : THEMES;
    if (only && targets.length === 0) {
        throw new Error(`No theme with slug "${only}".`);
    }
    const expected = targets.reduce((total, theme) => total + (theme.mode === 'adaptive' ? 2 : 1), 0);

    let shots = 0;
    if (!docOnly) {
        requireTool('magick');
        requireTool('cwebp');
        mkdirSync(assets, { recursive: true });

        // Scratch lives outside the repo so an interrupted run cannot leave intermediates
        // sitting in a tracked directory.
        const scratch = mkdtempSync(join(tmpdir(), 'rat-gallery-'));
        try {
            for (const theme of targets) {
                const variants = theme.mode === 'adaptive' ? ['light', 'dark'] : [null];
                for (const variant of variants) {
                    shoot(capturePage(theme, backdropOf(theme.slug, variant)), theme.slug, variant, scratch);
                    shots++;
                }
                process.stdout.write(`${String(shots).padStart(3)}/${expected} ${theme.slug}\n`);
            }
        } finally {
            rmSync(scratch, { recursive: true, force: true });
        }
    }

    if (only) {
        console.log(`${shots} image(s) for ${only}; GALLERY.md left alone (--only)`);
        return;
    }
    writeFileSync(join(repo, 'GALLERY.md'), galleryMarkdown(), 'utf8');
    console.log(`GALLERY.md: ${THEMES.length} themes, ${docOnly ? 'images untouched' : `${shots} images`}`);
}

// Guarded so the gallery test can import `galleryMarkdown` without launching a browser.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
