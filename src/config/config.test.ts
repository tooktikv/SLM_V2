import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, getConfig, listChanges, resetConfig, updateConfig } from './index.ts';

const rejects = (fn: () => unknown, pattern: RegExp) => assert.throws(fn, (error: unknown) => error instanceof ConfigError && pattern.test(error.details.join(' | ')), `expected ${pattern}`);

beforeEach(() => { resetConfig(); });

describe('Master data', () => {
  it('keeps names unique and protects system statuses', () => {
    updateConfig('lists', draft => { draft.supplierTypes.push({ id: 'x', name: 'Trader', active: true }); }, 'Added supplier type');
    assert.equal(getConfig('lists').supplierTypes.length, 5);
    rejects(() => updateConfig('lists', draft => { draft.supplierTypes.push({ id: 'y', name: 'trader', active: true }); }, 'dup'), /unique/);
    rejects(() => updateConfig('lists', draft => { draft.supplierStatuses = draft.supplierStatuses.filter(item => item.name !== 'Active'); }, 'remove'), /system value/);
    assert.equal(listChanges().length, 1, 'rejected changes are not logged');
  });
});

describe('Task configuration', () => {
  it('lets each task type have its own review workflow', () => {
    const types = getConfig('taskTypes');
    assert.deepEqual(new Set(types.map(item => item.reviewWorkflow)), new Set(['Single reviewer', 'Two-step review', 'Auto-accept']));
    rejects(() => updateConfig('taskTypes', draft => { draft[0].reviewerRole = ''; }, 'x'), /reviewer is required/);
    rejects(() => updateConfig('taskTypes', draft => { draft[4].secondReviewerRole = draft[4].reviewerRole; }, 'x'), /second, different reviewer/);
    rejects(() => updateConfig('taskTypes', draft => { draft[2].allowReturn = true; }, 'x'), /auto-accepted/);
    rejects(() => updateConfig('taskTypes', draft => { draft.splice(0, 1); }, 'x'), /cannot be removed/);
    rejects(() => updateConfig('taskTemplates', draft => { draft[0].taskTypeId = 'missing'; }, 'x'), /active task type/);
  });
});

describe('Approval configuration', () => {
  it('requires Central Approver for qualification and both Central Authority and Buyer for capability', () => {
    rejects(() => updateConfig('qualificationApproval', draft => { draft.steps = []; }, 'x'), /at least one/);
    rejects(() => updateConfig('qualificationApproval', draft => { draft.steps[0].role = 'Buyer'; }, 'x'), /Central Approver approval is mandatory/);
    rejects(() => updateConfig('capabilityApproval', draft => { draft.steps = draft.steps.filter(item => item.role !== 'Buyer'); }, 'x'), /Buyer approval is mandatory/);
    updateConfig('capabilityApproval', draft => { draft.mode = 'Sequential'; draft.steps.reverse(); }, 'Buyer first');
    assert.deepEqual(getConfig('capabilityApproval').steps.map(item => item.role), ['Buyer', 'Central Authority']);
    rejects(() => updateConfig('capabilityApproval', draft => { draft.delegation.maxDays = 200; }, 'x'), /delegation/);
  });
});

describe('Samples, risk, notifications and access', () => {
  it('validates results, weights, reminders and admin access', () => {
    rejects(() => updateConfig('samples', draft => { draft.resultOptions = draft.resultOptions.filter(item => item.outcome !== 'Fail'); }, 'x'), /Accept and one Fail/);
    rejects(() => updateConfig('risk', draft => { draft.categories[0].weight = 30; }, 'x'), /total 100/);
    rejects(() => updateConfig('risk', draft => { draft.levels[1].min = 0; }, 'x'), /thresholds/);
    rejects(() => updateConfig('triggers', draft => { draft[0].reminderDays = [30, 60]; }, 'x'), /descending/);
    rejects(() => updateConfig('templates', draft => { draft[0].triggerId = 'tg-sample'; }, 'x'), /Email channel/);
    rejects(() => updateConfig('access', draft => { draft.Admin.actions.Configure = false; }, 'x'), /Admin must keep/);
    updateConfig('access', draft => { draft['Read Only'].menus.Risk = true; }, 'Menu access');
    assert.equal(getConfig('access')['Read Only'].menus.Risk, true);
  });
});
