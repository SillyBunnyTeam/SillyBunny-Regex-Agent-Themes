import test from 'node:test';
import assert from 'node:assert/strict';

import {
    drawerIconClass,
    summarizeApplyResult,
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
