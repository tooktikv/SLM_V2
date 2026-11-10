import { suppliers } from '../data/suppliers.ts';
import { sampleRequests } from '../data/samples.ts';
import type { SampleRequest, SamplePurpose } from '../data/samples.ts';
import { getConfig } from '../config/store.ts';
import { dispatch, getExternalSupplierId, receive, registerInboundHandler, retryTransaction } from '../integration/index.ts';

export type SampleErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'INVALID_TRANSITION' | 'NOT_FOUND';

export class SampleError extends Error {
  code: SampleErrorCode;
  constructor(code: SampleErrorCode, message: string) {
    super(message);
    this.name = 'SampleError';
    this.code = code;
  }
}

function fail(code: SampleErrorCode, message: string): never {
  throw new SampleError(code, message);
}

export type SampleActor = { name: string; role: string; department?: string };
// The signed-in SLM user acts as Buyer / requester.
export const currentBuyer: SampleActor = { name: 'James Kim', role: 'Buyer', department: 'Procurement' };

// Shared sample statuses (prompt section 8). The existing statuses are kept and mapped, never replaced.
export type SharedSampleStatus = 'Draft' | 'Requested' | 'Supplier Responding' | 'Submitted' | 'Under Evaluation' | 'Accepted' | 'Failed' | 'Completed';

export function sharedSampleStatus(sample: SampleRequest): SharedSampleStatus {
  if (sample.portal?.sync === 'Draft') return 'Draft';
  if (sample.closedAt) return 'Completed';
  switch (sample.status) {
    case 'Requested': return sample.delivery?.confirmedAt ? 'Supplier Responding' : 'Requested';
    case 'In transit': case 'Received': return 'Submitted';
    case 'Under testing': return 'Under Evaluation';
    case 'Approved': case 'Conditional': return 'Accepted';
    case 'Rejected': return 'Failed';
  }
}

let revision = 0;
const listeners = new Set<() => void>();
export const getRevision = () => revision;
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const display = (iso: string) => { const [year, month, day] = iso.split('-').map(Number); return `${MONTHS[month - 1]} ${day}, ${year}`; };
const daysUntil = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86_400_000);

export const sampleListFor = (supplierId: string): SampleRequest[] => (sampleRequests[supplierId] ??= []);

export function findSample(id: string): { sample: SampleRequest; supplierId: string } {
  for (const [supplierId, list] of Object.entries(sampleRequests)) {
    const sample = list.find(item => item.id === id);
    if (sample) return { sample, supplierId };
  }
  return fail('NOT_FOUND', `Sample request ${id} not found`);
}

const addEvent = (sample: SampleRequest, event: string) => { (sample.events ??= []).push({ date: display(todayIso()), event }); };
const assertBuyer = (actor: SampleActor) => { if (actor.role !== 'Buyer') fail('FORBIDDEN', 'Sample evaluation is done by the Buyer / requester'); };

const nextId = () => {
  const numbers = Object.values(sampleRequests).flat().map(item => Number(item.id.split('-').pop())).filter(Number.isFinite);
  return `SR-${new Date().getFullYear()}-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
};

// ---------------------------------------------------------------- Create and send (SLM -> Supplier Portal)

export type CreateSampleInput = { supplierId: string; typeId: string; product: string; spec?: string; purpose: SamplePurpose; qty: string; requiredDate?: string };

export function createSampleRequest(actor: SampleActor, input: CreateSampleInput): SampleRequest {
  assertBuyer(actor);
  if (!suppliers.some(item => item.id === input.supplierId)) fail('NOT_FOUND', `Supplier ${input.supplierId} not found`);
  const type = getConfig('samples').requestTypes.find(item => item.id === input.typeId);
  if (!type || !type.active) fail('VALIDATION', 'Choose an active sample request type');
  if (!input.product.trim()) fail('VALIDATION', 'Product is required');
  if (!input.qty.trim()) fail('VALIDATION', 'Quantity is required');
  const requiredIso = input.requiredDate || addDays(type.defaultDueDays);
  if (requiredIso < todayIso()) fail('VALIDATION', 'Required-by date must not be in the past');
  const requirements = getConfig('samples').requirements.filter(item => item.requestTypeId === type.id).map(item => `${item.name}${item.mandatory ? ' (mandatory)' : ''}`);
  const sample: SampleRequest = {
    id: nextId(), product: input.product.trim(), spec: input.spec?.trim() || '—', purpose: input.purpose, requester: actor.name, department: actor.department ?? 'Procurement', qty: input.qty.trim(),
    requested: display(todayIso()), required: display(requiredIso), daysLeft: daysUntil(requiredIso), status: 'Requested', note: 'Draft, not yet sent to the supplier', typeId: type.id, requirements,
    portal: { sync: 'Draft' }, requiredIso, events: [{ date: display(todayIso()), event: 'Sample request created as draft' }],
  };
  sampleListFor(input.supplierId).unshift(sample);
  notify();
  return sample;
}

function sendToPortal(sample: SampleRequest, supplierId: string): 'Sent' | 'Failed' {
  const type = getConfig('samples').requestTypes.find(item => item.id === sample.typeId);
  const tx = dispatch({
    entityType: 'SampleRequest', supplierId, internalRef: sample.id, revision: String((sample.retests ?? 0) + 1),
    payload: { product: sample.product, spec: sample.spec, qty: sample.qty, requiredBy: sample.requiredIso ?? sample.required, type: type?.name, requirements: sample.requirements ?? [] },
  });
  const sync = tx.status === 'Processed' ? 'Sent' : 'Failed';
  sample.portal = { sync, transactionId: tx.transactionId };
  return sync;
}

export function sendSampleRequest(actor: SampleActor, id: string): SampleRequest {
  assertBuyer(actor);
  const { sample, supplierId } = findSample(id);
  if (sample.portal?.sync !== 'Draft') fail('INVALID_TRANSITION', 'Only a draft request can be sent');
  const sync = sendToPortal(sample, supplierId);
  sample.note = sync === 'Sent' ? 'Awaiting supplier confirmation' : 'Supplier Portal delivery failed, resend from the request';
  addEvent(sample, sync === 'Sent' ? 'Sample request sent to the supplier' : 'Sending to the Supplier Portal failed');
  notify();
  return sample;
}

export function resendSampleRequest(actor: SampleActor, id: string): SampleRequest {
  assertBuyer(actor);
  const { sample } = findSample(id);
  if (sample.portal?.sync !== 'Failed' || !sample.portal.transactionId) fail('INVALID_TRANSITION', 'Nothing to resend');
  const tx = retryTransaction(sample.portal.transactionId);
  sample.portal = { sync: tx.status === 'Processed' ? 'Sent' : 'Failed', transactionId: tx.transactionId };
  if (sample.portal.sync === 'Sent') { sample.note = 'Awaiting supplier confirmation'; addEvent(sample, 'Sample request sent to the supplier'); }
  notify();
  return sample;
}

// ---------------------------------------------------------------- Supplier Portal responses (inbound)

type PortalEvent = { event?: 'confirmed' | 'shipped'; carrier?: string; trackingNo?: string; expectedAt?: string };

registerInboundHandler('SampleResponse', tx => {
  const { sample, supplierId } = findSample(tx.internalRef ?? '');
  if (getExternalSupplierId(supplierId) !== tx.externalSupplierId) fail('VALIDATION', 'The response does not belong to this sample request\'s supplier');
  if (sample.portal?.sync === 'Draft') fail('INVALID_TRANSITION', 'The request has not been sent to the supplier yet');
  const payload = tx.payload as PortalEvent;
  const delivery = (sample.delivery ??= {});
  if (payload.event === 'confirmed') {
    if (sample.status !== 'Requested') fail('INVALID_TRANSITION', 'Only a requested sample can be confirmed');
    delivery.confirmedAt = display(todayIso());
    sample.note = 'Supplier confirmed, preparing the sample';
    addEvent(sample, 'Supplier confirmed the request');
  } else if (payload.event === 'shipped') {
    if (sample.status !== 'Requested') fail('INVALID_TRANSITION', 'Only a requested sample can be shipped');
    if (!payload.carrier?.trim() || !payload.trackingNo?.trim()) fail('VALIDATION', 'Carrier and tracking number are required');
    Object.assign(delivery, { carrier: payload.carrier.trim(), trackingNo: payload.trackingNo.trim(), shippedAt: display(todayIso()), expectedAt: payload.expectedAt ? display(payload.expectedAt) : undefined });
    sample.status = 'In transit';
    sample.note = `Shipped ${display(todayIso())} · ${delivery.carrier} ${delivery.trackingNo}`;
    addEvent(sample, 'Shipped, tracking number issued');
  } else fail('VALIDATION', 'Unknown sample response event');
  notify();
});

// Mock only: stands in for the Supplier Portal calling SLM.
export function simulateSampleResponse(id: string, payload: PortalEvent): SampleRequest {
  const { sample, supplierId } = findSample(id);
  const externalSupplierId = getExternalSupplierId(supplierId) ?? fail('NOT_FOUND', 'No External Supplier ID');
  const tx = receive({ entityType: 'SampleResponse', externalSupplierId, internalRef: sample.id, revision: `${(sample.retests ?? 0) + 1}-${payload.event}`, payload: payload as Record<string, unknown> });
  if (tx.status !== 'Processed') fail('VALIDATION', tx.error ?? 'The response was not accepted');
  return sample;
}

// ---------------------------------------------------------------- Receipt and evaluation (Buyer / requester)

export function receiveSample(actor: SampleActor, id: string): SampleRequest {
  assertBuyer(actor);
  const { sample } = findSample(id);
  if (sample.status !== 'In transit') fail('INVALID_TRANSITION', 'Only a shipped sample can be received');
  (sample.delivery ??= {}).receivedAt = display(todayIso());
  sample.status = 'Received';
  sample.note = `Received ${display(todayIso())} · waiting for evaluation`;
  addEvent(sample, 'Received at plant');
  notify();
  return sample;
}

export function startEvaluation(actor: SampleActor, id: string): SampleRequest {
  assertBuyer(actor);
  const { sample } = findSample(id);
  if (sample.status !== 'Received') fail('INVALID_TRANSITION', 'Only a received sample can be evaluated');
  sample.status = 'Under testing';
  sample.evaluator = actor.name;
  sample.note = 'Evaluation in progress';
  addEvent(sample, 'Evaluation started');
  notify();
  return sample;
}

export type EvaluationInput = { scores: { criterionId: string; score: number; comment?: string }[]; result: string; comment?: string };

export function submitEvaluation(actor: SampleActor, id: string, input: EvaluationInput): SampleRequest {
  assertBuyer(actor);
  const { sample, supplierId } = findSample(id);
  if (sample.status !== 'Under testing') fail('INVALID_TRANSITION', 'Start the evaluation before recording a result');
  const settings = getConfig('samples');
  const criteria = settings.criteria.filter(item => item.active);
  const scores = criteria.map(criterion => {
    const entry = input.scores.find(item => item.criterionId === criterion.id) ?? fail('VALIDATION', `Score for "${criterion.name}" is required`);
    if (Number.isNaN(entry.score)) fail('VALIDATION', `Score for "${criterion.name}" is required`);
    if (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > 100) fail('VALIDATION', `Score for "${criterion.name}" must be between 0 and 100`);
    return { criterionId: criterion.id, name: criterion.name, passMark: criterion.passMark, score: entry.score, comment: (entry.comment ?? '').trim() };
  });
  const option = settings.resultOptions.find(item => item.label === input.result) ?? fail('VALIDATION', 'Choose a result option');
  const comment = (input.comment ?? '').trim();
  const belowMark = scores.filter(item => item.score < item.passMark);
  if (option.outcome === 'Accept' && belowMark.length && !comment) fail('VALIDATION', `A comment is required to accept with deviations: ${belowMark.map(item => item.name).join(', ')}`);
  if (option.outcome !== 'Accept' && !comment) fail('VALIDATION', 'A comment is required for this result');
  sample.evaluation = { scores, result: option.label, outcome: option.outcome, comment, by: actor.name, at: new Date().toISOString() };
  if (option.outcome === 'Accept') {
    sample.status = belowMark.length ? 'Conditional' : 'Approved';
    sample.note = `${option.label}${belowMark.length ? ` with deviations: ${belowMark.map(item => item.name).join(', ')}` : ''}`;
    sample.daysLeft = null;
  } else if (option.outcome === 'Fail') {
    sample.status = 'Rejected';
    sample.note = `${option.label}: ${comment}`;
    sample.daysLeft = null;
  } else {
    sample.status = 'Requested';
    sample.retests = (sample.retests ?? 0) + 1;
    sample.delivery = undefined;
    sample.note = `${option.label}: ${comment}`;
  }
  addEvent(sample, `Evaluation result: ${option.label}`);
  dispatch({ entityType: 'ReviewResult', supplierId, internalRef: sample.id, revision: `sample-${sample.retests ?? 0}-${option.outcome}`, payload: { entity: 'SampleRequest', result: option.label, outcome: option.outcome, comment } });
  if (option.outcome === 'Retest') sendToPortal(sample, supplierId);
  notify();
  return sample;
}

export function closeSample(actor: SampleActor, id: string): SampleRequest {
  assertBuyer(actor);
  const { sample } = findSample(id);
  if (sample.status !== 'Approved' && sample.status !== 'Conditional' && sample.status !== 'Rejected') fail('INVALID_TRANSITION', 'Only a decided request can be closed');
  if (sample.closedAt) fail('INVALID_TRANSITION', 'The request is already closed');
  sample.closedAt = new Date().toISOString();
  addEvent(sample, 'Request closed');
  notify();
  return sample;
}

// ---------------------------------------------------------------- Queries

export function getSampleSummary() {
  const all = Object.values(sampleRequests).flat();
  const count = (...states: SharedSampleStatus[]) => all.filter(item => states.includes(sharedSampleStatus(item))).length;
  return {
    total: all.length, draft: count('Draft'), withSupplier: count('Requested', 'Supplier Responding'), submitted: count('Submitted'), underEvaluation: count('Under Evaluation'),
    accepted: all.filter(item => item.status === 'Approved' || item.status === 'Conditional').length, failed: all.filter(item => item.status === 'Rejected').length,
    portalFailures: all.filter(item => item.portal?.sync === 'Failed').length,
  };
}
