import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourcingError, assignSourcing, changeStage, getSourcing, getSourcingSummary, listActivity, listSourcing, markInterested, removeFromSourcing, resetSourcing } from './index.ts';

const actor = { name: 'James Kim' };
const rejects = (code: string, fn: () => unknown) => assert.throws(fn, (error: unknown) => error instanceof SourcingError && error.code === code, `expected ${code}`);

beforeEach(() => resetSourcing());

describe('Marking a supplier as interested', () => {
  it('records the supplier with its owner as default assignee and blocks duplicates', () => {
    const record = markInterested(actor, 'SUP-0034', { note: 'Looks promising' });
    assert.deepEqual([record.stage, record.assignee, record.interestedBy], ['Interested', 'M. Patel', 'James Kim']);
    assert.equal(getSourcing('SUP-0034')?.stage, 'Interested');
    assert.equal(getSourcing('SUP-0012'), undefined);
    rejects('DUPLICATE', () => markInterested(actor, 'SUP-0034'));
    rejects('NOT_FOUND', () => markInterested(actor, 'SUP-9999'));
    rejects('VALIDATION', () => markInterested(actor, 'SUP-0051', { assignee: '  ' }));
  });
});

describe('Moving between stages', () => {
  it('moves forward freely and requires a reason for Not Selected and for moving back', () => {
    markInterested(actor, 'SUP-0034');
    assert.equal(changeStage(actor, 'SUP-0034', 'Shortlisted').stage, 'Shortlisted');
    assert.equal(changeStage(actor, 'SUP-0034', 'Selected').stage, 'Selected', 'stages can be skipped');
    rejects('VALIDATION', () => changeStage(actor, 'SUP-0034', 'Not Selected'));
    rejects('VALIDATION', () => changeStage(actor, 'SUP-0034', 'Under Review', { reason: ' ' }));
    assert.equal(changeStage(actor, 'SUP-0034', 'Under Review', { reason: 'Needs another check' }).stage, 'Under Review');
    assert.equal(changeStage(actor, 'SUP-0034', 'Not Selected', { reason: 'Failed the audit' }).stage, 'Not Selected');
    assert.equal(changeStage(actor, 'SUP-0034', 'Selected').stage, 'Selected', 'the two outcomes are the same step, so no reason is needed');
    rejects('INVALID_TRANSITION', () => changeStage(actor, 'SUP-0034', 'Selected'));
    rejects('NOT_FOUND', () => changeStage(actor, 'SUP-0051', 'Shortlisted'));
  });
});

describe('Assignment, summary and history', () => {
  it('reassigns the responsible person and keeps every action in the history', () => {
    markInterested(actor, 'SUP-0034');
    markInterested(actor, 'SUP-0051');
    markInterested(actor, 'SUP-0067');
    changeStage(actor, 'SUP-0051', 'Shortlisted');
    changeStage(actor, 'SUP-0067', 'Under Review');
    assignSourcing(actor, 'SUP-0034', 'S. Chen');
    rejects('INVALID_TRANSITION', () => assignSourcing(actor, 'SUP-0034', 'S. Chen'));
    rejects('VALIDATION', () => assignSourcing(actor, 'SUP-0034', ''));

    const summary = getSourcingSummary();
    assert.deepEqual([summary.total, summary.inProgress], [3, 3]);
    assert.deepEqual(Object.values(summary.byStage), [1, 1, 1, 0, 0]);
    assert.deepEqual(listSourcing({ assignee: 'S. Chen' }).map(item => item.supplierId), ['SUP-0034']);
    assert.deepEqual(listSourcing({ stage: 'Shortlisted' }).map(item => item.supplierId), ['SUP-0051']);
    assert.deepEqual(listSourcing({ search: 'packaging' }).map(item => item.supplierId), ['SUP-0051']);

    const history = listActivity({ supplierId: 'SUP-0034' });
    assert.deepEqual(history.map(item => item.action), ['Assigned', 'Marked as interested']);
    assert.equal(history[0].assignee, 'S. Chen');
  });

  it('keeps the history after a supplier is removed from sourcing', () => {
    markInterested(actor, 'SUP-0034');
    rejects('VALIDATION', () => removeFromSourcing(actor, 'SUP-0034', ' '));
    removeFromSourcing(actor, 'SUP-0034', 'Added by mistake');
    assert.equal(getSourcing('SUP-0034'), undefined);
    assert.deepEqual(listActivity({ supplierId: 'SUP-0034' }).map(item => item.action), ['Removed from sourcing', 'Marked as interested']);
    assert.equal(markInterested(actor, 'SUP-0034').stage, 'Interested', 'a removed supplier can be marked again');
  });
});
