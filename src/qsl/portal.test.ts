import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  QslError, buildPortalRequest, completePreReview, createDraft, findQsl, getDetail, getFormSkills, getSnapshot, getStore, portalCriteria, portalStatusOf, prefillReassessment, resetStore,
  seedMasterData, setClock, staff, submitAnswers, submitRateCard, submitRequest, supplierActor, updateDraft, validateForSubmit, validatePortalRequest, defaultPortalRequest, attachEvidence, saveAnswers,
} from './index.ts';
import type { RateCardInput } from './index.ts';
import type { QslErrorCode } from './index.ts';

const { coordinator, assessor, approver } = staff;
const supplier = supplierActor('SUP-0067');
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const rejects = (fn: () => unknown, pattern: RegExp, code: QslErrorCode = 'VALIDATION') =>
  assert.throws(fn, (error: unknown) => error instanceof QslError && error.code === code && pattern.test([error.message, ...error.details].join(' ')));

beforeEach(() => { resetStore(); setClock(null); seedMasterData(); setClock(null); });

const formFor = (category: string) => getStore().forms.find(form => form.versions[0].data.categories.includes(category))!.id;
const draft = (overrides: Record<string, unknown> = {}) => createDraft(coordinator, {
  supplierId: 'SUP-0067', formId: formFor('Raw material'), dueDate: inDays(14), assessorId: assessor.id, approverId: approver.id, reason: 'Annual qualification', scopeType: 'Site / plant', scopeDetail: 'Main plant', ...overrides,
});
const sent = () => { const created = draft(); submitRequest(coordinator, created.id); return created.id; };

// What the Supplier Portal sends back: every requested skill offered, with the required documents attached.
function rateCard(id: string, change: (input: RateCardInput) => void = () => undefined): RateCardInput {
  const qsl = findQsl(id);
  const criteria = portalCriteria(getSnapshot(qsl));
  const link = (targetId: string) => ({ targetId, docId: `DOC-${targetId}`, docName: 'Certificate', docType: 'Quality Certification', version: 1, expiry: '2099-12-31' });
  const input: RateCardInput = {
    version: 1, submittedBy: 'Maya Chen', role: 'Supplier Admin',
    terms: { currency: 'THB', rateBasis: 'Daily', effectiveFrom: '2026-11-01', validUntil: '2027-10-31', leadTimeDays: '14', paymentTermsDays: '45', escalationPct: '3', overtimeWeekday: '1.5', overtimeHoliday: '2' },
    skills: Object.fromEntries(criteria.map(item => [item.id, { offered: 'Yes' as const, selfRating: '3', comment: '', lines: [{ level: '2', headcount: '6', avgYears: '4', rate: '1800' }, { level: '3', headcount: '3', avgYears: '8', rate: '2600' }] }])),
    evidence: [...criteria.filter(item => item.evidenceRequired).map(item => link(item.id)), ...qsl.portal.requiredEvidence.filter(item => item.mandatory).map(item => link(item.id))],
    declaration: true,
  };
  change(input);
  return input;
}

describe('Qualification request for the Supplier Portal', () => {
  it('starts with sensible defaults, validates them and numbers the request on submit', () => {
    const created = draft();
    assert.equal(created.portal.currencies.join(), 'THB,USD');
    assert.ok(created.portal.requiredEvidence.length > 0);
    assert.match(created.portal.buyer, /Anong Sriwan/);
    assert.deepEqual(validatePortalRequest(defaultPortalRequest('Buyer')), []);
    assert.ok(validatePortalRequest({ ...created.portal, buyer: '', currencies: [], rateBases: [] }).length >= 3);

    updateDraft(coordinator, created.id, { portal: { buyer: '' } });
    assert.ok(validateForSubmit(findQsl(created.id)).some(message => /requesting buyer/.test(message)));
    updateDraft(coordinator, created.id, { portal: { buyer: 'Olivia Martin · Northstar Procurement', currencies: ['THB'], rateBases: ['Daily'] } });
    submitRequest(coordinator, created.id);
    const qsl = findQsl(created.id);
    assert.equal(qsl.portal.requestId, qsl.qslNo.replace('QSL-', 'QR-'));
    assert.equal(portalStatusOf(qsl), 'Requested');
  });

  it('builds the payload the Portal expects', () => {
    const payload = buildPortalRequest(findQsl(sent()));
    assert.match(payload.id, /^QR-/);
    assert.deepEqual(payload.currencies, ['THB', 'USD']);
    assert.equal(payload.status, 'Requested');
    assert.deepEqual(payload.ratingScale.map(item => item.level), [1, 2, 3]);
    assert.ok(payload.criteria.length > 0 && payload.criteria.every(item => ['Central Standard', 'Buyer Custom'].includes(item.source) && typeof item.mandatory === 'boolean'));
    assert.ok(payload.requiredEvidence.every(item => item.docTypes.length > 0));
    assert.equal(payload.history[0].status, 'Requested');
  });

  it('previews the skills of the selected form and carries the Portal settings into a renewal', () => {
    const skills = getFormSkills(coordinator, formFor('Raw material'));
    assert.ok(skills.length > 0 && skills.every(item => item.group && item.name));
    const first = draft({ portal: { instructions: 'Custom instructions', currencies: ['USD'] } });
    assert.equal(first.portal.instructions, 'Custom instructions');
    assert.equal(first.portal.rateBases.length, 3);
    // prefill copies the settings without the old request number.
    const previousId = sent();
    getStore().qsls.find(item => item.id === previousId)!.status = 'Completed';
    const prefill = prefillReassessment(coordinator, previousId);
    assert.equal(prefill.portal?.requestId, '');
    assert.equal(prefill.portal?.currencies?.length, 2);
  });
});

describe('Rate card received from the Supplier Portal', () => {
  it('stores a valid rate card with parsed numbers and keeps the self-rating per skill', () => {
    const id = sent();
    const saved = submitRateCard(supplier, id, rateCard(id));
    const card = saved.rateCards[0];
    assert.deepEqual([card.version, card.kind, card.terms.leadTimeDays, card.terms.escalationPct], [1, 'Initial', 14, 3]);
    assert.match(card.ref, /^QS-.*-V1$/);
    assert.equal(typeof card.skills[0].lines[0].rate, 'number');
    assert.ok(saved.selfRatings.length > 0 && saved.selfRatings.every(item => item.level === 3));
    const detail = getDetail(staff.admin, id).portal;
    assert.equal(detail.rateCards[0].skills[0].selfRatingName, 'Advanced');
    assert.equal(detail.portalStatus, 'Requested');
  });

  it('follows the status the Portal shows through the review flow', () => {
    const id = sent();
    submitRateCard(supplier, id, rateCard(id));
    const snapshot = getSnapshot(findQsl(id));
    saveAnswers(supplier, id, snapshot.criteria.filter(item => item.data.answerType !== 'File').map(item => ({ criteriaId: item.id, value: item.data.answerType === 'Number' ? 5 : item.data.answerType === 'Date' ? '2026-01-01' : item.data.answerType === 'Choice' ? item.data.options![0] : 'text' })));
    snapshot.criteria.filter(item => item.data.evidenceRequired).forEach(item => attachEvidence(supplier, id, item.id, 'proof.pdf'));
    submitAnswers(supplier, id);
    assert.equal(portalStatusOf(findQsl(id)), 'Submitted');
    completePreReview(coordinator, id, { infoChecked: true, documentsChecked: true, decision: 'Proceed', comment: '' });
    assert.equal(portalStatusOf(findQsl(id)), 'Assessment In Progress');
  });

  it('rejects what the Portal field spec forbids', () => {
    const id = sent();
    const bad = (change: (input: RateCardInput) => void, pattern: RegExp) => rejects(() => submitRateCard(supplier, id, rateCard(id, change)), pattern);
    bad(input => { input.terms.currency = 'EUR'; }, /currency is not one of/i);
    bad(input => { input.terms.rateBasis = 'Weekly'; }, /rate basis is not one of/i);
    bad(input => { input.terms.validUntil = '2026-10-01'; }, /cannot be before/i);
    bad(input => { input.terms.overtimeWeekday = '9'; }, /1 to 5/);
    bad(input => { input.version = 2; }, /version must be 1/i);
    bad(input => { input.role = 'Supplier Viewer'; }, /viewer cannot submit/i);
    bad(input => { input.declaration = false; }, /declaration/i);
    bad(input => { const skill = Object.values(input.skills)[0]; skill.lines = [skill.lines[0], { ...skill.lines[0] }]; }, /listed twice/);
    bad(input => { Object.values(input.skills)[0].lines[0].rate = '0'; }, /rate must be greater than 0/i);
    bad(input => { Object.values(input.skills)[0].selfRating = '5'; }, /self-rating must be a level/i);
    bad(input => { input.evidence = []; }, /not attached/);
    bad(input => { input.evidence[0].expiry = '2000-01-01'; }, /has expired/);
    bad(input => { input.skills['unknown'] = Object.values(input.skills)[0]; }, /not part of this request/);
  });

  it('refuses a skill declined when mandatory, a second copy of a version and a round that is not waiting for the supplier', () => {
    const id = sent();
    const mandatory = portalCriteria(getSnapshot(findQsl(id))).find(item => item.mandatory)!;
    rejects(() => submitRateCard(supplier, id, rateCard(id, input => { input.skills[mandatory.id] = { offered: 'No', selfRating: '', lines: [] }; })), /mandatory/);
    submitRateCard(supplier, id, rateCard(id));
    rejects(() => submitRateCard(supplier, id, rateCard(id)), /version must be 2/i);
    getStore().qsls.find(item => item.id === id)!.status = 'WaitingAssessment';
    rejects(() => submitRateCard(supplier, id, rateCard(id, input => { input.version = 2; })), /only while waiting for the supplier/, 'INVALID_TRANSITION');
  });
});
