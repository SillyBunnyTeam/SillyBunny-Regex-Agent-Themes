import test from 'node:test';
import assert from 'node:assert/strict';

import {
    drawerIconClass,
    summarizeApplyResult,
    summarizeRefreshResult,
    summarizeTemplateReports,
} from '../src/ui.js';

test('drawer icons opt out of host keyboard interaction', () => {
    for (const open of [false, true]) {
        const classes = drawerIconClass(open).split(/\s+/);
        assert.ok(classes.includes('inline-drawer-icon'));
        assert.ok(classes.includes('not_focusable'));
    }
});

test('duplicate-agent status uses the worst report rather than the first report', () => {
    assert.equal(summarizeTemplateReports([
        { status: 'stock' },
        { status: 'foreign' },
        { status: 'pristine' },
    ]), 'foreign');
});

test('apply feedback names blocked and failed trackers', () => {
    const summary = summarizeApplyResult({
        ok: true,
        applied: 2,
        reverted: 0,
        unchanged: 1,
        blocked: [{ agentName: 'Scene copy' }],
        failed: [{ agentName: 'Relationship', reason: 'offline' }],
    });

    assert.equal(summary.tone, 'error');
    assert.match(summary.text, /2 themed/);
    assert.match(summary.text, /Scene copy/);
    assert.match(summary.text, /Relationship/);
});

test('empty successful apply feedback is explicit', () => {
    assert.deepEqual(summarizeApplyResult({ ok: true }), {
        tone: 'success',
        text: 'No installed trackers needed changes.',
    });
});

test('refresh feedback distinguishes matching and absent tracker cards', () => {
    assert.deepEqual(summarizeRefreshResult({ ok: true, matched: 2, repainted: 2, failed: 0 }), {
        tone: 'success',
        text: 'Refreshed 2 matching tracker cards.',
    });
    assert.deepEqual(summarizeRefreshResult({ ok: true, matched: 0, repainted: 0, failed: 0 }), {
        tone: 'neutral',
        text: 'No matching tracker cards are loaded in this chat.',
    });
});
