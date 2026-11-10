import { suppliers } from '../data/suppliers.ts';
import { getConfig } from '../config/store.ts';
import { dispatch, getExternalSupplierId, receive, registerInboundHandler, retryTransaction } from '../integration/index.ts';
import type { ReviewDecision, Task, TaskActor, TaskFilter, TaskStatus } from './types.ts';

export type TaskErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'INVALID_TRANSITION' | 'NOT_FOUND';

export class TaskError extends Error {
  code: TaskErrorCode;
  constructor(code: TaskErrorCode, message: string) {
    super(message);
    this.name = 'TaskError';
    this.code = code;
  }
}

function fail(code: TaskErrorCode, message: string): never {
  throw new TaskError(code, message);
}

let tasks: Task[] = [];
let counter = 0;
let revision = 0;
const listeners = new Set<() => void>();

export const getRevision = () => revision;
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };

export function resetTasks(): void {
  tasks = [];
  counter = 0;
  notify();
}

const nowIso = () => new Date().toISOString();
const todayIso = () => nowIso().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const findTask = (id: string): Task => tasks.find(item => item.id === id) ?? fail('NOT_FOUND', `Task ${id} not found`);
const log = (task: Task, by: string, action: string, note?: string) => { task.updatedAt = nowIso(); task.history.push({ at: task.updatedAt, by, action, note: note || undefined }); };

// Overdue is derived from the due date while the supplier still owes a response.
export function statusOf(task: Task): TaskStatus {
  if ((task.status === 'Assigned' || task.status === 'In Progress' || task.status === 'Returned') && task.dueDate < todayIso()) return 'Overdue';
  return task.status;
}

export const currentReviewerRole = (task: Task): string | undefined => {
  if (task.workflow.type === 'Auto-accept') return undefined;
  return task.reviewStep === 2 ? task.workflow.secondReviewerRole : task.workflow.reviewerRole;
};

const supplierOf = (supplierId: string) => suppliers.find(item => item.id === supplierId) ?? fail('NOT_FOUND', `Supplier ${supplierId} not found`);

// ---------------------------------------------------------------- Create and assign (SLM -> Supplier Portal)

export type CreateTaskInput = { supplierId: string; taskTypeId?: string; templateId?: string; title?: string; instructions?: string; dueDate?: string; owner?: string };

export function createTask(actor: TaskActor, input: CreateTaskInput): Task {
  const supplier = supplierOf(input.supplierId);
  const template = input.templateId ? getConfig('taskTemplates').find(item => item.id === input.templateId) : undefined;
  if (input.templateId && !template) fail('VALIDATION', 'Task template not found');
  const type = getConfig('taskTypes').find(item => item.id === (template?.taskTypeId ?? input.taskTypeId));
  if (!type || !type.active) fail('VALIDATION', 'Choose an active task type');
  const title = (input.title ?? template?.name ?? '').trim();
  if (!title) fail('VALIDATION', 'Task title is required');
  const dueDate = input.dueDate ?? addDays(type.dueDays);
  if (dueDate < todayIso()) fail('VALIDATION', 'Due date must not be in the past');
  counter += 1;
  const now = nowIso();
  const task: Task = {
    id: `TASK-${String(counter).padStart(4, '0')}`, supplierId: supplier.id, taskTypeId: type.id, taskTypeName: type.name, templateId: template?.id, title,
    instructions: (input.instructions ?? template?.instructions ?? '').trim(), requiredForms: template?.requiredForms ?? '', requiredDocuments: template?.requiredDocuments ?? '',
    owner: input.owner ?? supplier.owner, dueDate, status: 'Draft', workflow: { type: type.reviewWorkflow, reviewerRole: type.reviewerRole, secondReviewerRole: type.secondReviewerRole, allowReturn: type.allowReturn },
    reviewStep: 1, submissions: [], reviews: [], history: [], assignRevision: 0, createdAt: now, updatedAt: now,
  };
  log(task, actor.name, 'Task created');
  tasks.push(task);
  notify();
  return structuredClone(task);
}

function sendAssignment(task: Task) {
  const tx = dispatch({
    entityType: 'TaskAssignment', supplierId: task.supplierId, internalRef: task.id, revision: String(task.assignRevision),
    payload: { title: task.title, type: task.taskTypeName, instructions: task.instructions, dueDate: task.dueDate, requiredForms: task.requiredForms, requiredDocuments: task.requiredDocuments },
  });
  task.assignTransactionId = tx.transactionId;
  task.portalSync = tx.status === 'Processed' ? 'Sent' : 'Failed';
}

export function assignTask(actor: TaskActor, id: string): Task {
  const task = findTask(id);
  if (task.status !== 'Draft') fail('INVALID_TRANSITION', 'Only draft tasks can be assigned');
  task.assignRevision = 1;
  task.status = 'Assigned';
  sendAssignment(task);
  log(task, actor.name, 'Assigned to supplier', task.portalSync === 'Sent' ? 'Sent to Supplier Portal' : 'Supplier Portal delivery failed, resend from the task');
  notify();
  return structuredClone(task);
}

export function resendToPortal(actor: TaskActor, id: string): Task {
  const task = findTask(id);
  if (task.portalSync !== 'Failed' || !task.assignTransactionId) fail('INVALID_TRANSITION', 'Nothing to resend');
  const tx = retryTransaction(task.assignTransactionId);
  task.portalSync = tx.status === 'Processed' ? 'Sent' : 'Failed';
  log(task, actor.name, task.portalSync === 'Sent' ? 'Resent to Supplier Portal' : 'Resend failed', tx.error);
  notify();
  return structuredClone(task);
}

// ---------------------------------------------------------------- Supplier Portal responses (inbound)

type PortalEvent = { event?: 'started' | 'submitted'; answers?: Record<string, string>; files?: string[]; note?: string };

registerInboundHandler('TaskResponse', tx => {
  const task = tasks.find(item => item.id === tx.internalRef) ?? fail('NOT_FOUND', `Unknown task ${tx.internalRef ?? ''}`);
  if (getExternalSupplierId(task.supplierId) !== tx.externalSupplierId) fail('VALIDATION', 'The response does not belong to this task\'s supplier');
  const payload = tx.payload as PortalEvent;
  if (payload.event === 'started') {
    if (task.status !== 'Assigned') fail('INVALID_TRANSITION', 'Only an assigned task can be started');
    task.status = 'In Progress';
    log(task, 'Supplier Portal', 'Supplier started the task');
    return;
  }
  if (task.status !== 'Assigned' && task.status !== 'In Progress' && task.status !== 'Returned') fail('INVALID_TRANSITION', `A response cannot be accepted while the task is ${task.status}`);
  task.submissions.push({ revision: task.submissions.length + 1, submittedAt: tx.submittedAt, transactionId: tx.transactionId, answers: payload.answers ?? {}, files: payload.files ?? [], note: payload.note ?? '' });
  task.reviewStep = 1;
  if (task.workflow.type === 'Auto-accept') {
    task.status = 'Completed';
    log(task, 'Supplier Portal', 'Response submitted', 'Auto-accepted, no review required');
    dispatch({ entityType: 'ReviewResult', supplierId: task.supplierId, internalRef: task.id, revision: `${task.submissions.length}-Approved`, payload: { decision: 'Approved', automatic: true } });
  } else {
    task.status = 'Submitted';
    log(task, 'Supplier Portal', `Response submitted (revision ${task.submissions.length})`);
  }
  notify();
});

// Mock only: stands in for the Supplier Portal calling SLM.
export function simulatePortalResponse(id: string, payload: PortalEvent): Task {
  const task = findTask(id);
  const externalSupplierId = getExternalSupplierId(task.supplierId) ?? fail('NOT_FOUND', 'No External Supplier ID');
  const tx = receive({ entityType: 'TaskResponse', externalSupplierId, internalRef: task.id, revision: String(task.submissions.length + 1), payload: payload as Record<string, unknown> });
  if (tx.status !== 'Processed') fail('VALIDATION', tx.error ?? 'The response was not accepted');
  return structuredClone(findTask(id));
}

// ---------------------------------------------------------------- Review (SLM)

export type ReviewInput = { decision: ReviewDecision; comment?: string };

export function startReview(actor: TaskActor, id: string): Task {
  const task = findTask(id);
  assertReviewer(actor, task);
  if (task.status !== 'Submitted') fail('INVALID_TRANSITION', 'Only a submitted task can be taken into review');
  task.status = 'Under Review';
  log(task, actor.name, 'Review started', actor.role);
  notify();
  return structuredClone(task);
}

function assertReviewer(actor: TaskActor, task: Task) {
  const required = currentReviewerRole(task);
  if (!required) fail('INVALID_TRANSITION', 'This task type does not require a review');
  if (actor.role !== required) fail('FORBIDDEN', `Review step ${task.reviewStep} must be done by ${required}`);
}

export function reviewTask(actor: TaskActor, id: string, input: ReviewInput): Task {
  const task = findTask(id);
  if (task.status !== 'Submitted' && task.status !== 'Under Review') fail('INVALID_TRANSITION', 'There is no submission to review');
  assertReviewer(actor, task);
  const comment = (input.comment ?? '').trim();
  if (input.decision !== 'Approved' && !comment) fail('VALIDATION', 'A comment is required to return or reject');
  if (input.decision === 'Returned' && !task.workflow.allowReturn) fail('VALIDATION', 'This task type cannot be returned for correction');
  const revisionNumber = task.submissions.length;
  task.reviews.push({ step: task.reviewStep, role: actor.role, decision: input.decision, comment, by: actor.name, at: nowIso(), revision: revisionNumber });
  if (input.decision === 'Approved' && task.workflow.type === 'Two-step review' && task.reviewStep === 1) {
    task.reviewStep = 2;
    task.status = 'Under Review';
    log(task, actor.name, 'Step 1 approved', `Next: ${task.workflow.secondReviewerRole}`);
    notify();
    return structuredClone(task);
  }
  task.status = input.decision === 'Approved' ? 'Approved' : input.decision === 'Returned' ? 'Returned' : 'Rejected';
  if (input.decision === 'Returned') task.reviewStep = 1;
  log(task, actor.name, input.decision === 'Returned' ? 'Returned for correction' : input.decision === 'Approved' ? 'Approved' : 'Rejected', comment);
  dispatch({ entityType: 'ReviewResult', supplierId: task.supplierId, internalRef: task.id, revision: `${revisionNumber}-${input.decision}`, payload: { decision: input.decision, comment } });
  notify();
  return structuredClone(task);
}

export function completeTask(actor: TaskActor, id: string): Task {
  const task = findTask(id);
  if (task.status !== 'Approved') fail('INVALID_TRANSITION', 'Only an approved task can be completed');
  task.status = 'Completed';
  log(task, actor.name, 'Task completed');
  notify();
  return structuredClone(task);
}

// ---------------------------------------------------------------- Queries

export function listTasks(filter: TaskFilter = {}): Task[] {
  const tokens = (filter.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return tasks
    .filter(task => !filter.status || statusOf(task) === filter.status)
    .filter(task => !filter.supplierId || task.supplierId === filter.supplierId)
    .filter(task => !filter.taskTypeId || task.taskTypeId === filter.taskTypeId)
    .filter(task => !filter.reviewerRole || ((task.status === 'Submitted' || task.status === 'Under Review') && currentReviewerRole(task) === filter.reviewerRole))
    .filter(task => { const text = [task.id, task.title, task.taskTypeName, task.supplierId, supplierOf(task.supplierId).name, task.owner].join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); })
    .map(task => structuredClone(task))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export const getTask = (id: string): Task => structuredClone(findTask(id));

export function getTaskSummary() {
  const count = (...states: TaskStatus[]) => tasks.filter(task => states.includes(statusOf(task))).length;
  return {
    draft: count('Draft'), open: count('Assigned', 'In Progress'), awaitingReview: count('Submitted', 'Under Review'), returned: count('Returned'), overdue: count('Overdue'),
    completed: count('Approved', 'Completed'), rejected: count('Rejected'), portalFailures: tasks.filter(task => task.portalSync === 'Failed').length, total: tasks.length,
  };
}

// ---------------------------------------------------------------- Demo data

let seeded = false;
export function ensureTaskDemo(): void {
  if (seeded) return;
  seeded = true;
  const buyer: TaskActor = { name: 'James Kim', role: 'Buyer' };
  const make = (supplierId: string, templateId: string | undefined, typeId: string | undefined, title: string, due: number) => createTask(buyer, { supplierId, templateId, taskTypeId: typeId, title, dueDate: addDays(due) });
  const assign = (task: Task) => assignTask(buyer, task.id);
  const respond = (id: string, payload: PortalEvent) => simulatePortalResponse(id, payload);

  assign(make('SUP-0051', undefined, 'tt-doc', 'Upload updated insurance certificate', 5));
  const profile = assign(make('SUP-0034', 'tm-1', undefined, 'Company profile update', 3));
  respond(profile.id, { event: 'started' });
  respond(profile.id, { event: 'submitted', answers: { 'Registered address': 'No. 1 Science Park Rd, Hsinchu', 'Employees': '1,240' }, note: 'Updated headcount.' });
  const capability = assign(make('SUP-0067', undefined, 'tt-cap', 'Capability information: fasteners', 10));
  respond(capability.id, { event: 'submitted', answers: { Products: 'M8 bolts, bearings' }, files: ['capability-statement.pdf'] });
  reviewTask({ name: 'Central Authority', role: 'Central Authority' }, capability.id, { decision: 'Approved' });
  const iso = assign(make('SUP-0012', 'tm-2', undefined, 'ISO certificate renewal', 20));
  respond(iso.id, { event: 'submitted', files: ['iso9001-expired.pdf'] });
  reviewTask({ name: 'Marcus Patel', role: 'Quality Analyst' }, iso.id, { decision: 'Returned', comment: 'The uploaded certificate has expired.' });
  const done = assign(make('SUP-0103', 'tm-3', undefined, 'Code of conduct acknowledgement', 7));
  respond(done.id, { event: 'submitted', note: 'Accepted' });
  make('SUP-0089', 'tm-1', undefined, 'Company profile update', 14);
  // Back-date the returned task so it shows as overdue.
  tasks.find(item => item.id === iso.id)!.dueDate = addDays(-2);
  notify();
}
