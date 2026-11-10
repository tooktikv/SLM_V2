import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resetIntegration, listTransactions, updateSystem } from '../integration/index.ts';
import { resetConfig, updateConfig } from '../config/index.ts';
import { TaskError, assignTask, completeTask, createTask, getTask, getTaskSummary, listTasks, resendToPortal, resetTasks, reviewTask, simulatePortalResponse, startReview, statusOf } from './index.ts';

const buyer = { name: 'Buyer', role: 'Buyer' };
const rejects = (code: string, fn: () => unknown) => assert.throws(fn, (error: unknown) => error instanceof TaskError && error.code === code, `expected ${code}`);

beforeEach(() => { resetTasks(); resetIntegration(); resetConfig(); });

describe('Task creation and assignment', () => {
  it('builds a task from a template, snapshots the workflow and sends it to the Supplier Portal once', () => {
    const task = createTask(buyer, { supplierId: 'SUP-0034', templateId: 'tm-2' });
    assert.equal(task.status, 'Draft');
    assert.equal(task.title, 'ISO certificate renewal');
    assert.deepEqual([task.workflow.type, task.workflow.reviewerRole], ['Single reviewer', 'Quality Analyst']);
    updateConfig('taskTypes', draft => { draft.find(item => item.id === 'tt-doc')!.reviewerRole = 'Risk Manager'; }, 'change');
    assert.equal(getTask(task.id).workflow.reviewerRole, 'Quality Analyst', 'later settings changes do not alter existing tasks');
    const assigned = assignTask(buyer, task.id);
    assert.deepEqual([assigned.status, assigned.portalSync], ['Assigned', 'Sent']);
    assert.equal(listTransactions({ entityType: 'TaskAssignment' }).length, 1);
    rejects('INVALID_TRANSITION', () => assignTask(buyer, task.id));
    rejects('VALIDATION', () => createTask(buyer, { supplierId: 'SUP-0034' }));
    rejects('VALIDATION', () => createTask(buyer, { supplierId: 'SUP-0034', templateId: 'tm-2', dueDate: '2020-01-01' }));
    rejects('NOT_FOUND', () => createTask(buyer, { supplierId: 'SUP-9999', templateId: 'tm-2' }));
  });

  it('keeps the task assigned when delivery fails and allows a resend', () => {
    updateSystem('SupplierPortal', { failNext: 1 });
    const task = assignTask(buyer, createTask(buyer, { supplierId: 'SUP-0034', templateId: 'tm-1' }).id);
    assert.equal(task.portalSync, 'Failed');
    assert.equal(getTaskSummary().portalFailures, 1);
    assert.equal(resendToPortal(buyer, task.id).portalSync, 'Sent');
    rejects('INVALID_TRANSITION', () => resendToPortal(buyer, task.id));
  });
});

describe('Review workflow per task type', () => {
  it('single reviewer: only the mapped role reviews; returning needs a comment and a resubmission restarts review', () => {
    const task = assignTask(buyer, createTask(buyer, { supplierId: 'SUP-0034', templateId: 'tm-2', dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) }).id);
    simulatePortalResponse(task.id, { event: 'started' });
    assert.equal(getTask(task.id).status, 'In Progress');
    simulatePortalResponse(task.id, { event: 'submitted', files: ['a.pdf'] });
    assert.equal(getTask(task.id).status, 'Submitted');
    rejects('FORBIDDEN', () => reviewTask(buyer, task.id, { decision: 'Approved' }));
    const reviewer = { name: 'QA', role: 'Quality Analyst' };
    assert.equal(startReview(reviewer, task.id).status, 'Under Review');
    rejects('VALIDATION', () => reviewTask(reviewer, task.id, { decision: 'Returned' }));
    assert.equal(reviewTask(reviewer, task.id, { decision: 'Returned', comment: 'Expired' }).status, 'Returned');
    assert.equal(listTransactions({ entityType: 'ReviewResult' }).length, 1);
    simulatePortalResponse(task.id, { event: 'submitted', files: ['b.pdf'] });
    assert.equal(getTask(task.id).submissions.length, 2);
    assert.equal(reviewTask(reviewer, task.id, { decision: 'Approved' }).status, 'Approved');
    assert.equal(completeTask(buyer, task.id).status, 'Completed');
    rejects('INVALID_TRANSITION', () => reviewTask(reviewer, task.id, { decision: 'Approved' }));
  });

  it('two-step: both reviewers must approve in order; auto-accept needs no reviewer', () => {
    const cap = assignTask(buyer, createTask(buyer, { supplierId: 'SUP-0067', taskTypeId: 'tt-cap', title: 'Capability' }).id);
    simulatePortalResponse(cap.id, { event: 'submitted' });
    rejects('FORBIDDEN', () => reviewTask({ name: 'B', role: 'Buyer' }, cap.id, { decision: 'Approved' }));
    assert.equal(reviewTask({ name: 'CA', role: 'Central Authority' }, cap.id, { decision: 'Approved' }).status, 'Under Review');
    rejects('FORBIDDEN', () => reviewTask({ name: 'CA', role: 'Central Authority' }, cap.id, { decision: 'Approved' }));
    assert.equal(reviewTask({ name: 'B', role: 'Buyer' }, cap.id, { decision: 'Approved' }).status, 'Approved');
    const learn = assignTask(buyer, createTask(buyer, { supplierId: 'SUP-0067', taskTypeId: 'tt-learn', title: 'E-learning' }).id);
    simulatePortalResponse(learn.id, { event: 'submitted' });
    assert.equal(getTask(learn.id).status, 'Completed');
    rejects('INVALID_TRANSITION', () => startReview(buyer, learn.id));
  });

  it('rejects responses for the wrong supplier or state and derives overdue', () => {
    const task = assignTask(buyer, createTask(buyer, { supplierId: 'SUP-0034', templateId: 'tm-1' }).id);
    simulatePortalResponse(task.id, { event: 'submitted' });
    rejects('VALIDATION', () => simulatePortalResponse(task.id, { event: 'submitted' }));
    assert.equal(listTransactions({ errorsOnly: true }).length, 1);
    const late = assignTask(buyer, createTask(buyer, { supplierId: 'SUP-0034', templateId: 'tm-1' }).id);
    assert.equal(statusOf({ ...getTask(late.id), dueDate: '2020-01-01' }), 'Overdue');
    assert.equal(listTasks({ search: 'sup-0034' }).length, 2);
  });
});
