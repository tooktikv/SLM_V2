import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sampleRequests } from '../data/samples.ts';
import { listTransactions, resetIntegration, updateSystem } from '../integration/index.ts';
import { resetConfig, updateConfig } from '../config/index.ts';
import {
  SampleError, closeSample, createSampleRequest, currentBuyer, findSample, getSampleSummary, receiveSample, resendSampleRequest, sendSampleRequest, sharedSampleStatus, simulateSampleResponse,
  startEvaluation, submitEvaluation,
} from './index.ts';

const rejects = (code: string, fn: () => unknown) => assert.throws(fn, (error: unknown) => error instanceof SampleError && error.code === code, `expected ${code}`);
const original = structuredClone(sampleRequests);

beforeEach(() => { resetIntegration(); resetConfig(); });
afterEach(() => { Object.keys(sampleRequests).forEach(key => delete sampleRequests[key]); Object.assign(sampleRequests, structuredClone(original)); });

const create = (overrides = {}) => createSampleRequest(currentBuyer, { supplierId: 'SUP-0034', typeId: 'st-approval', product: 'Control board', purpose: 'New product', qty: '5 units', ...overrides });
const findLast = () => Object.values(sampleRequests).flat().filter(item => item.portal).sort((a, b) => b.id.localeCompare(a.id))[0].id;
const scoresAt = (value: number) => ['sc-1', 'sc-2', 'sc-3'].map(criterionId => ({ criterionId, score: value }));

describe('Creating and sending sample requests', () => {
  it('validates input, creates a draft with the configured requirements and sends it once', () => {
    rejects('FORBIDDEN', () => createSampleRequest({ name: 'Supplier', role: 'Supplier' }, { supplierId: 'SUP-0034', typeId: 'st-approval', product: 'x', purpose: 'New product', qty: '1' }));
    rejects('VALIDATION', () => create({ typeId: 'missing' }));
    rejects('VALIDATION', () => create({ product: ' ' }));
    rejects('VALIDATION', () => create({ requiredDate: '2020-01-01' }));
    const sample = create();
    assert.equal(sharedSampleStatus(sample), 'Draft');
    assert.ok(sample.requirements!.some(item => /Certificate of analysis/.test(item)));
    assert.equal(sample.requested, sample.events![0].date);
    const sent = sendSampleRequest(currentBuyer, sample.id);
    assert.equal(sent.portal?.sync, 'Sent');
    assert.equal(sharedSampleStatus(sent), 'Requested');
    assert.equal(listTransactions({ entityType: 'SampleRequest' }).length, 1);
    rejects('INVALID_TRANSITION', () => sendSampleRequest(currentBuyer, sample.id));
  });

  it('keeps the request failed when delivery fails and lets the buyer resend', () => {
    const sample = create();
    updateSystem('SupplierPortal', { failNext: 1 });
    assert.equal(sendSampleRequest(currentBuyer, sample.id).portal?.sync, 'Failed');
    assert.equal(getSampleSummary().portalFailures, 1);
    assert.equal(resendSampleRequest(currentBuyer, sample.id).portal?.sync, 'Sent');
  });
});

describe('Supplier responses and evaluation by the buyer', () => {
  it('tracks supplier confirmation and delivery, then the buyer receives and evaluates against the configured criteria', () => {
    const sample = create();
    rejects('VALIDATION', () => simulateSampleResponse(sample.id, { event: 'confirmed' }));
    sendSampleRequest(currentBuyer, sample.id);
    simulateSampleResponse(sample.id, { event: 'confirmed' });
    assert.equal(sharedSampleStatus(findSample(sample.id).sample), 'Supplier Responding');
    rejects('VALIDATION', () => simulateSampleResponse(sample.id, { event: 'shipped' }));
    simulateSampleResponse(sample.id, { event: 'shipped', carrier: 'DHL', trackingNo: '884213', expectedAt: '2030-01-01' });
    const shipped = findSample(sample.id).sample;
    assert.deepEqual([shipped.status, shipped.delivery?.carrier, sharedSampleStatus(shipped)], ['In transit', 'DHL', 'Submitted']);
    rejects('FORBIDDEN', () => receiveSample({ name: 'Portal', role: 'Supplier' }, sample.id));
    receiveSample(currentBuyer, sample.id);
    startEvaluation(currentBuyer, sample.id);
    assert.equal(sharedSampleStatus(findSample(sample.id).sample), 'Under Evaluation');
    rejects('VALIDATION', () => submitEvaluation(currentBuyer, sample.id, { scores: scoresAt(90).slice(0, 2), result: 'Accepted' }));
    rejects('VALIDATION', () => submitEvaluation(currentBuyer, sample.id, { scores: scoresAt(150), result: 'Accepted' }));
    rejects('VALIDATION', () => submitEvaluation(currentBuyer, sample.id, { scores: scoresAt(90), result: 'Unknown' }));
    rejects('FORBIDDEN', () => submitEvaluation({ name: 'Portal', role: 'Supplier' }, sample.id, { scores: scoresAt(90), result: 'Accepted' }));
    const done = submitEvaluation(currentBuyer, sample.id, { scores: scoresAt(95), result: 'Accepted' });
    assert.deepEqual([done.status, sharedSampleStatus(done), done.evaluation?.by], ['Approved', 'Accepted', 'James Kim']);
    assert.equal(listTransactions({ entityType: 'ReviewResult' }).length, 1);
    assert.equal(closeSample(currentBuyer, sample.id).closedAt !== undefined, true);
    assert.equal(sharedSampleStatus(findSample(sample.id).sample), 'Completed');
    rejects('INVALID_TRANSITION', () => closeSample(currentBuyer, sample.id));
  });

  it('accepts with deviations only with a comment, fails samples and asks for a retest', () => {
    const run = (result: string, scores: ReturnType<typeof scoresAt>, comment?: string) => {
      const sample = create();
      sendSampleRequest(currentBuyer, sample.id);
      simulateSampleResponse(sample.id, { event: 'shipped', carrier: 'UPS', trackingNo: '1' });
      receiveSample(currentBuyer, sample.id);
      startEvaluation(currentBuyer, sample.id);
      return () => submitEvaluation(currentBuyer, sample.id, { scores, result, comment });
    };
    const lowLab = [...scoresAt(95).slice(0, 2), { criterionId: 'sc-3', score: 60 }];
    const deviation = run('Accepted', lowLab);
    rejects('VALIDATION', deviation);
    assert.equal(submitEvaluation(currentBuyer, findLast(), { scores: lowLab, result: 'Accepted', comment: 'Within customer tolerance' }).status, 'Conditional');
    const failed = run('Failed', scoresAt(40));
    rejects('VALIDATION', failed);
    assert.equal(failed.length, 0);
    const retest = run('Retest required', scoresAt(70), 'Seal damaged in transit');
    const result = retest();
    assert.deepEqual([result.status, result.retests, result.delivery, result.portal?.sync], ['Requested', 1, undefined, 'Sent']);
    assert.equal(listTransactions({ entityType: 'SampleRequest' }).length >= 2, true, 'a retest is sent again with a new revision');
  });

  it('follows the evaluation result options from Administration', () => {
    updateConfig('samples', draft => { draft.resultOptions.push({ id: 'x', label: 'Approved for trial', outcome: 'Accept' }); }, 'Added');
    const sample = create();
    sendSampleRequest(currentBuyer, sample.id);
    simulateSampleResponse(sample.id, { event: 'shipped', carrier: 'DHL', trackingNo: '2' });
    receiveSample(currentBuyer, sample.id);
    startEvaluation(currentBuyer, sample.id);
    assert.equal(submitEvaluation(currentBuyer, sample.id, { scores: scoresAt(99), result: 'Approved for trial' }).evaluation?.result, 'Approved for trial');
  });
});

describe('Existing sample data', () => {
  it('maps the existing statuses to the shared statuses without changing the records', () => {
    const all = Object.values(sampleRequests).flat();
    const mapped = new Set(all.map(item => `${item.status}>${sharedSampleStatus(item)}`));
    assert.deepEqual([...mapped].sort(), ['Approved>Accepted', 'Conditional>Accepted', 'In transit>Submitted', 'Received>Submitted', 'Rejected>Failed', 'Requested>Requested', 'Under testing>Under Evaluation']);
    assert.equal(getSampleSummary().total, all.length);
  });
});
