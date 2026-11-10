import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  QslError, activateForm, addCriteriaToForm, assignScope, attachEvidence, checkEligibility, completePreReview, createCriteria, createDraft, decide, deleteCriteria, extendValidity, findQsl, getDetail,
  getQslSummary, getSheet, getSnapshot, getStore, listCapabilities, listCriteriaRows, listDirectory, listEligibility, listHistory, listManagement, listMonitoring, listQslActivity, prefillReassessment, saveAssessedRatings,
  publishToQsl, qslReport, qualificationSections, reactivateQualification, recordSample, requestMoreInfo, resetStore, saveAnswers, saveEvaluations, saveSelfRatings, seedMasterData, setClock, staff, submitAnswers,
  submitRequest, submitAssessment, supplierActor, suspendQualification, updateCriteria, updateForm, updateSettings, validateForSubmit, withdrawFromQsl,
} from './index.ts';
import type { Actor, Level, QslErrorCode } from './index.ts';

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const rejects = (code: QslErrorCode, fn: () => unknown) =>
  assert.throws(fn, (error: unknown) => error instanceof QslError && error.code === code, `expected ${code}`);

const { coordinator, assessor, assessor2, approver, approver2, buyer, admin } = staff;
const SUPPLIER = 'SUP-0067'; // default category: Raw material
const supplier = supplierActor(SUPPLIER);

beforeEach(() => { resetStore(); setClock(null); seedMasterData(); setClock(null); });
afterEach(() => { setClock(null); });

const formFor = (category: string) => getStore().forms.find(form => form.versions[0].data.categories.includes(category))!.id;

const request = (overrides: Record<string, unknown> = {}) => createDraft(coordinator, {
  supplierId: SUPPLIER, formId: formFor('Raw material'), dueDate: inDays(14), assessorId: assessor.id, approverId: approver.id, reason: 'Annual qualification',
  scopeType: 'Site / plant', scopeDetail: 'Main plant', ...overrides,
});

const submitted = (overrides: Record<string, unknown> = {}) => {
  const draft = request(overrides);
  submitRequest(coordinator, draft.id);
  return draft.id;
};

function supplierSubmits(id: string, who: Actor = supplier) {
  const snapshot = getSnapshot(findQsl(id));
  saveAnswers(who, id, snapshot.criteria.filter(item => item.data.answerType !== 'File').map(item => ({
    criteriaId: item.id, value: item.data.answerType === 'Number' ? 5 : item.data.answerType === 'Date' ? '2026-01-01' : item.data.answerType === 'Choice' ? item.data.options![0] : 'text',
  })));
  snapshot.criteria.filter(item => item.data.evidenceRequired).forEach(item => attachEvidence(who, id, item.id, 'proof.pdf'));
  saveSelfRatings(who, id, snapshot.skills.map(skill => ({ skillId: skill.id, level: 3 as Level })));
  submitAnswers(who, id);
}

const proceed = (id: string) => completePreReview(coordinator, id, { infoChecked: true, documentsChecked: true, decision: 'Proceed', comment: '' });

function assessed(id: string, level: Level = 2) {
  const snapshot = getSnapshot(findQsl(id));
  saveEvaluations(assessor, id, snapshot.criteria.map(item => ({ criteriaId: item.id, verdict: 'Compliant' as const, comment: 'ok' })));
  saveAssessedRatings(assessor, id, snapshot.skills.map(skill => ({ skillId: skill.id, level })));
  submitAssessment(assessor, id, { recommended: 'Pass', summary: 'Summary', internalNote: 'Internal only' });
}

function approved(effectiveDate = today(), publish = true) {
  const id = submitted();
  supplierSubmits(id);
  proceed(id);
  assessed(id);
  decide(approver, id, { decision: 'Approve', reason: 'Meets criteria', effectiveDate });
  if (publish) publishToQsl(approver, id);
  return id;
}

describe('Qualification Request', () => {
  it('saves a draft with a supplier only, validates the rest on submit and numbers the round', () => {
    const draft = createDraft(coordinator, { supplierId: SUPPLIER });
    assert.equal(draft.category, 'Raw material');
    assert.ok(validateForSubmit(findQsl(draft.id)).length > 3);
    rejects('FORBIDDEN', () => createDraft(assessor, { supplierId: SUPPLIER }));
    const id = request({ dueDate: inDays(-1), approverId: assessor.id, scopeDetail: '', formId: formFor('Food') }).id;
    const messages = validateForSubmit(findQsl(id)).join(' | ');
    assert.match(messages, /Due date must not be in the past/);
    assert.match(messages, /Assessment form does not match the category/);
    assert.match(messages, /scope details/);
    assert.match(messages, /approver/);
    const ok = submitted();
    assert.match(findQsl(ok).qslNo, /^QSL-\d{4}-\d{4}$/);
    assert.equal(findQsl(ok).status, 'WaitingSupplier');
    rejects('DUPLICATE', () => submitRequest(coordinator, request().id));
  });

  it('freezes the form and criteria at submission', () => {
    const id = submitted();
    const snapshot = getStore().snapshots.find(item => item.qslId === id)!;
    assert.equal(Object.isFrozen(snapshot), true);
    const criteria = getStore().criteria.find(item => item.id === snapshot.criteria[0].id)!;
    updateCriteria(admin, criteria.id, { name: 'Renamed' });
    updateForm(admin, snapshot.form.id, { code: 'FRM-RAW', name: 'v2', categories: ['Raw material'], sections: [{ title: 'Only', items: [{ criteriaId: criteria.id, required: true }] }] });
    activateForm(admin, snapshot.form.id);
    assert.equal(snapshot.form.version, 1);
    assert.notEqual(snapshot.criteria[0].data.name, 'Renamed');
  });
});

describe('Pre-Qualification Review and Sample Evaluation', () => {
  it('moves supplier submission to pre-qualification review and handles info requests', () => {
    const id = submitted();
    supplierSubmits(id);
    assert.equal(findQsl(id).status, 'PreQualReview');
    rejects('FORBIDDEN', () => completePreReview(assessor, id, { infoChecked: true, documentsChecked: true, decision: 'Proceed', comment: '' }));
    rejects('VALIDATION', () => completePreReview(coordinator, id, { infoChecked: true, documentsChecked: false, decision: 'Proceed', comment: '' }));
    rejects('VALIDATION', () => completePreReview(coordinator, id, { infoChecked: true, documentsChecked: true, decision: 'RequestInfo', comment: ' ' }));
    completePreReview(coordinator, id, { infoChecked: true, documentsChecked: false, decision: 'RequestInfo', comment: 'Tax certificate is missing' });
    assert.equal(findQsl(id).status, 'InfoRequested');
    rejects('VALIDATION', () => submitAnswers(supplier, id, ''));
    submitAnswers(supplier, id, 'Certificate attached');
    assert.equal(findQsl(id).status, 'PreQualReview');
    proceed(id);
    assert.equal(findQsl(id).status, 'WaitingAssessment');
  });

  it('adds a sample evaluation step when required and ends the round if the sample fails', () => {
    const id = submitted({ sampleRequired: true });
    supplierSubmits(id);
    proceed(id);
    assert.equal(findQsl(id).status, 'SampleEvaluation');
    rejects('VALIDATION', () => recordSample(coordinator, id, { reference: '', result: 'Pass', comment: '' }));
    rejects('VALIDATION', () => recordSample(coordinator, id, { reference: 'SR-1', result: 'Fail', comment: '' }));
    recordSample(coordinator, id, { reference: 'SR-1', result: 'Fail', comment: 'Off-spec' });
    assert.equal(findQsl(id).status, 'Completed');
    assert.equal(findQsl(id).result, 'Fail');
    assert.equal(listDirectory(admin).rows.length, 0);
  });

  it('can reject at pre-qualification review', () => {
    const id = submitted();
    supplierSubmits(id);
    completePreReview(coordinator, id, { infoChecked: true, documentsChecked: true, decision: 'Reject', comment: 'Sanctioned entity' });
    assert.equal(findQsl(id).result, 'Fail');
  });
});

describe('Qualification Assessment and Skill Rating', () => {
  it('assesses criteria and skill ratings in one step, keeps the self-rating separate and goes straight to approval', () => {
    const id = submitted();
    supplierSubmits(id);
    proceed(id);
    const snapshot = getSnapshot(findQsl(id));
    rejects('FORBIDDEN', () => saveEvaluations(assessor2, id, []));
    rejects('VALIDATION', () => submitAssessment(assessor, id, { recommended: 'Pass', summary: 'x' }));
    saveEvaluations(assessor, id, snapshot.criteria.map(item => ({ criteriaId: item.id, verdict: 'Compliant' as const })));
    rejects('VALIDATION', () => submitAssessment(assessor, id, { recommended: 'Pass', summary: 'x' }));
    rejects('VALIDATION', () => saveAssessedRatings(assessor, id, [{ skillId: snapshot.skills[0].id, level: 5 as Level }]));
    saveAssessedRatings(assessor, id, snapshot.skills.map(skill => ({ skillId: skill.id, level: 2 as Level })));
    rejects('VALIDATION', () => submitAssessment(assessor, id, { recommended: 'Pass', summary: ' ' }));
    submitAssessment(assessor, id, { recommended: 'Pass', summary: 'Good' });
    const qsl = findQsl(id);
    assert.equal(qsl.status, 'WaitingApproval');
    assert.equal(qsl.selfRatings[0].level, 3);
    assert.equal(qsl.assessedRatings[0].level, 2, 'the assessor rating differs from the supplier self-rating');
    rejects('FORBIDDEN', () => decide(coordinator, id, { decision: 'Approve', reason: 'x' }));
  });

  it('returns requests for information to the supplier and back to the assessor', () => {
    const id = submitted();
    supplierSubmits(id);
    proceed(id);
    const snapshot = getSnapshot(findQsl(id));
    saveEvaluations(assessor, id, [{ criteriaId: snapshot.criteria[0].id, verdict: 'NeedsFix', messageToSupplier: 'Attach audit report' }]);
    requestMoreInfo(assessor, id);
    assert.equal(findQsl(id).status, 'InfoRequested');
    rejects('VALIDATION', () => submitAnswers(supplier, id));
    attachEvidence(supplier, id, snapshot.criteria[0].id, 'audit.pdf');
    submitAnswers(supplier, id);
    assert.equal(findQsl(id).status, 'WaitingAssessment');
  });
});

describe('Qualification Approval and QSL publishing', () => {
  it('approval makes the supplier eligible; publishing registers scope, validity and level, and logs both', () => {
    const id = approved(today(), false);
    const qsl = findQsl(id);
    assert.equal(qsl.status, 'Completed');
    assert.equal(qsl.enrollment, undefined, 'approval alone does not publish');
    assert.equal(listDirectory(admin).rows.length, 0);
    assert.equal(listEligibility(admin).rows[0].state, 'Eligible');
    publishToQsl(approver, id);
    assert.equal(findQsl(id).enrollment!.scopeDetail, 'Main plant');
    assert.equal(findQsl(id).enrollment!.level, 2);
    assert.ok(qsl.decision!.expiryDate! > today());
    assert.deepEqual(qsl.approvals.map(item => item.decision), ['Approve']);
    const row = listDirectory(admin).rows[0];
    assert.equal(row.standing, 'Published');
    assert.match(row.listingNo, /^QSL-L-\d{4}$/);
    assert.equal(row.skills.length, 3);
    assert.ok(listHistory(admin, 'status').some(entry => entry.action.includes('Approve')));
    assert.deepEqual(listQslActivity(admin, 'publication').map(entry => entry.action), ['Published to QSL']);
    assert.equal(getQslSummary(admin).published, 1);
  });

  it('requires a reason, separates duties and supports return and reject', () => {
    const id = submitted();
    supplierSubmits(id);
    proceed(id);
    assessed(id);
    assert.deepEqual(listManagement(approver, 'approval').rows.map(row => row.nextAction), ['approve']);
    assert.deepEqual(listManagement(approver2, 'approval').rows, []);
    rejects('FORBIDDEN', () => decide(approver2, id, { decision: 'Approve', reason: 'x' }));
    rejects('FORBIDDEN', () => decide(coordinator, id, { decision: 'Approve', reason: 'x' }));
    rejects('VALIDATION', () => decide(approver, id, { decision: 'Approve', reason: ' ' }));
    decide(approver, id, { decision: 'Return', reason: 'Re-check traceability' });
    assert.equal(findQsl(id).status, 'WaitingAssessment');
    assert.equal(findQsl(id).recommended, undefined);
    rejects('INVALID_TRANSITION', () => decide(approver, id, { decision: 'Approve', reason: 'x' }));
    submitAssessment(assessor, id, { recommended: 'Pass', summary: 'Rechecked' });
    decide(approver, id, { decision: 'Reject', reason: 'Not acceptable' });
    assert.equal(findQsl(id).result, 'Fail');
    assert.deepEqual(findQsl(id).approvals.map(item => item.decision), ['Return', 'Reject']);
    assert.equal(listDirectory(admin).rows.length, 0, 'rejected suppliers are not enrolled');
  });

  it('validates scope and validity when approving', () => {
    const id = submitted();
    supplierSubmits(id);
    proceed(id);
    assessed(id);
    rejects('VALIDATION', () => decide(approver, id, { decision: 'Approve', reason: 'ok', scopeType: 'Site / plant', scopeDetail: '' }));
    rejects('VALIDATION', () => decide(approver, id, { decision: 'Approve', reason: 'ok', validityMonths: 99 }));
    const done = decide(approver, id, { decision: 'Approve', reason: 'ok', scopeType: 'Company-wide', scopeDetail: '', validityMonths: 24 });
    assert.equal(done.scopeType, 'Company-wide');
    assert.equal(done.decision!.expiryDate! > inDays(700), true);
  });

  it('checks eligibility, validates publish dates and supports withdrawal and republishing', () => {
    const id = approved(today(), false);
    assert.equal(checkEligibility(findQsl(id)).eligible, true);
    rejects('FORBIDDEN', () => publishToQsl(buyer, id));
    rejects('VALIDATION', () => publishToQsl(approver, id, { effectiveDate: inDays(-5000) }));
    rejects('VALIDATION', () => publishToQsl(approver, id, { expiryDate: inDays(5000) }));
    rejects('VALIDATION', () => publishToQsl(approver, id, { scopeType: 'Product line', scopeDetail: '' }));
    publishToQsl(approver, id, { scopeType: 'Product line', scopeDetail: 'Flour', expiryDate: inDays(200) });
    rejects('DUPLICATE', () => publishToQsl(approver, id));
    assert.equal(findQsl(id).enrollment!.expiryDate, inDays(200));
    rejects('FORBIDDEN', () => withdrawFromQsl(coordinator, id, 'x'));
    rejects('VALIDATION', () => withdrawFromQsl(approver, id, ' '));
    withdrawFromQsl(approver, id, 'No longer supplies');
    assert.equal(listDirectory(admin).rows[0].standing, 'Withdrawn');
    rejects('INVALID_TRANSITION', () => suspendQualification(approver, id, 'x'));
    assert.equal(listEligibility(admin).rows[0].withdrawn, true);
    publishToQsl(approver, id);
    assert.equal(listDirectory(admin).rows[0].standing, 'Published');
    assert.deepEqual(listQslActivity(admin, 'status').map(entry => entry.action.split(' ')[0]), ['Published', 'Withdrew', 'Published']);
  });

  it('blocks suppliers whose qualification is rejected or expired and reports pending rounds', () => {
    const expired = approved(inDays(-400), false);
    const row = listEligibility(admin).rows.find(item => item.id === expired)!;
    assert.equal(row.state, 'NotEligible');
    assert.equal(row.checks.validity, false);
    rejects('VALIDATION', () => publishToQsl(approver, expired));
    const open = submitted({ supplierId: 'SUP-0103', formId: formFor('Food') });
    assert.deepEqual(listEligibility(admin).pending.map(item => item.id), [open]);
  });

  it('builds QSL reports and the capability register from approved ratings', () => {
    const id = approved();
    assert.equal(qslReport(admin, 'published').rows.length, 1);
    assert.equal(qslReport(admin, 'capability').rows.length, 3);
    assert.equal(qslReport(admin, 'status').rows[0][1], '1');
    const capability = listCapabilities(admin).rows[0];
    assert.equal(capability.id, id);
    assert.equal(capability.status, 'Approved');
    assert.deepEqual(capability.skills.map(skill => skill.assessed), [2, 2, 2]);
    rejects('FORBIDDEN', () => listCapabilities(supplier));
  });

  it('lets coordinators reassign the scope and keeps the scope history', () => {
    const id = approved();
    rejects('FORBIDDEN', () => assignScope(buyer, id, { scopeType: 'Product line', scopeDetail: 'Flour' }));
    rejects('VALIDATION', () => assignScope(coordinator, id, { scopeType: 'Product line', scopeDetail: '' }));
    assignScope(coordinator, id, { scopeType: 'Product line', scopeDetail: 'Flour' });
    assert.equal(findQsl(id).enrollment!.scopeHistory.length, 2);
    assert.equal(listDirectory(admin).rows[0].scopeDetail, 'Flour');
  });
});

describe('Monitoring and Requalification', () => {
  it('suspends and reactivates, with the directory reflecting the status', () => {
    const id = approved();
    rejects('FORBIDDEN', () => suspendQualification(coordinator, id, 'x'));
    rejects('VALIDATION', () => suspendQualification(approver, id, ' '));
    suspendQualification(approver, id, 'Open CAR');
    assert.equal(listDirectory(admin, { status: 'Suspended' }).rows.length, 1);
    rejects('INVALID_TRANSITION', () => suspendQualification(approver, id, 'again'));
    rejects('VALIDATION', () => reactivateQualification(approver, id, ''));
    reactivateQualification(approver, id, 'CAR closed');
    assert.equal(listDirectory(admin, { status: 'Published' }).rows.length, 1);
    assert.deepEqual(listHistory(admin, 'status').slice(0, 2).map(entry => entry.action.split(' ')[0]), ['Reactivated', 'Suspended']);
  });

  it('raises expiry alerts and extends validity with a reason', () => {
    const id = approved(inDays(-340));
    assert.equal(listMonitoring(admin).due.length, 1);
    rejects('VALIDATION', () => extendValidity(approver, id, { newExpiry: inDays(-10), reason: 'x' }));
    rejects('VALIDATION', () => extendValidity(approver, id, { newExpiry: inDays(100), reason: '' }));
    rejects('FORBIDDEN', () => extendValidity(coordinator, id, { newExpiry: inDays(100), reason: 'x' }));
    extendValidity(approver, id, { newExpiry: inDays(100), reason: 'Audit scheduled' });
    assert.equal(listMonitoring(admin).due.length, 0);
    assert.equal(findQsl(id).extensions.length, 1);
  });

  it('lists renewals due and moves them to reassessment once started', () => {
    // Approved and published 400 days ago, so the listing has since expired.
    let tick = 0;
    setClock(() => new Date(Date.now() - 400 * 86_400_000 + tick++));
    const id = approved(inDays(-400));
    setClock(null);
    assert.equal(listMonitoring(coordinator).due.filter(row => !row.reassessing).length, 1);
    const draft = createDraft(coordinator, { ...prefillReassessment(coordinator, id), dueDate: inDays(7), reason: 'Expired result' });
    submitRequest(coordinator, draft.id);
    const after = listMonitoring(coordinator);
    assert.equal(after.due.filter(row => !row.reassessing).length, 0);
    assert.equal(after.reassessment.length, 1);
    assert.equal(findQsl(draft.id).round, 2);
    assert.equal(getDetail(coordinator, draft.id).otherRounds[0].id, id);
  });
});

describe('Criteria Management', () => {
  it('keeps standard criteria central and buyer custom criteria separate', () => {
    const skill = getStore().criteriaGroups[0].id;
    const data = { code: 'ZZ-01', name: 'Spare', groupId: skill, description: 'd', answerType: 'ShortText' as const, evidenceRequired: false, levels: ['a', 'b', 'c'] as [string, string, string] };
    rejects('FORBIDDEN', () => createCriteria(coordinator, data, 'Standard'));
    rejects('FORBIDDEN', () => createCriteria(assessor, data, 'BuyerCustom'));
    const custom = createCriteria(coordinator, data, 'BuyerCustom');
    assert.equal(listCriteriaRows('Standard').some(row => row.id === custom.id), false);
    assert.equal(listCriteriaRows('BuyerCustom').some(row => row.id === custom.id), true);
    rejects('FORBIDDEN', () => updateCriteria(coordinator, getStore().criteria.find(item => item.kind === 'Standard')!.id, { name: 'x' }));
    rejects('VALIDATION', () => createCriteria(coordinator, data, 'BuyerCustom'));
    addCriteriaToForm(coordinator, formFor('Raw material'), custom.id, { section: 'Extra', required: true });
    const id = submitted();
    assert.ok(getSnapshot(findQsl(id)).criteria.some(item => item.kind === 'BuyerCustom'));
    rejects('VALIDATION', () => deleteCriteria(coordinator, custom.id));
    const unused = createCriteria(admin, { ...data, code: 'ZZ-02' }, 'Standard');
    deleteCriteria(admin, unused.id);
  });
});

describe('Visibility, roles and history', () => {
  it('applies role visibility and tab access', () => {
    const draftId = request().id;
    const done = approved();
    const open = submitted({ supplierId: 'SUP-0103', formId: formFor('Food') });
    const ids = (actor: Actor, view: 'all' = 'all') => listManagement(actor, view).rows.map(row => row.id);
    assert.ok(ids(coordinator).includes(draftId));
    assert.equal(ids(supplier).includes(draftId), false, 'suppliers never see drafts');
    assert.deepEqual(ids(supplier), [done]);
    assert.deepEqual(ids(buyer), [done], 'buyers see completed rounds only');
    assert.equal(ids(assessor2).length, 0);
    assert.ok(!ids(approver).includes(open));
    assert.deepEqual(qualificationSections('Supplier'), ['pending', 'qualified']);
    assert.ok(qualificationSections('Admin').includes('requalification') && !qualificationSections('Assessor').includes('requalification'));
    rejects('FORBIDDEN', () => getDetail(buyer, open));
    rejects('FORBIDDEN', () => getDetail(supplierActor('SUP-0034'), done));
  });

  it('hides assessments and internal notes from suppliers', () => {
    const id = approved();
    assert.ok(getDetail(coordinator, id).criteriaResults.length > 0);
    assert.equal(getDetail(supplier, id).criteriaResults.length, 0);
    assert.equal(getDetail(supplier, id).approvals.length, 0);
    assert.equal(getSheet(supplier, id).sections.flatMap(section => section.items).every(item => item.evaluation === undefined), true);
    assert.equal(getSheet(supplier, id).skills.every(skill => skill.assessed === undefined), true);
  });

  it('records qualification, approval and status history', () => {
    approved();
    assert.equal(listHistory(admin, 'qualification').length, 1);
    assert.ok(listHistory(admin, 'status').length >= 6);
    updateSettings(admin, { reminderDays: 30 });
    assert.equal(getStore().audit.some(entry => entry.action === 'QSL request submitted'), true);
  });
});
