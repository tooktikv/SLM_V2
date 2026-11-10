import type { Actor, AnswerValue, CriteriaData, Evaluation, Level, ProcessStatus, Qsl, RatingDecision, ScopeType, SkillRating, Snapshot, Verdict, Verification } from '../types.ts';
import { SCOPE_TYPES } from '../types.ts';
import { addHistory, audit, clone, deepFreeze, getStore, nextId, now, nowIso, supplierCategory, todayIso } from '../store.ts';
import { assertCan, assertView } from '../rbac.ts';
import { fail, requireValid } from '../errors.ts';
import { findOrFail, getVersion, publishedVersion } from '../versioning.ts';
import { addMonthsIso, buddhistYear, isIsoDate } from '../dates.ts';
import { validityMonthsFor } from '../settings.ts';
import { suppliers } from '../../data/suppliers.ts';

export const findSupplier = (id: string) => suppliers.find(item => item.id === id) ?? fail('NOT_FOUND', `Supplier ${id} not found`);
export const findQsl = (id: string): Qsl => findOrFail(getStore().qsls, id, 'QSL record');
export const getSnapshot = (qsl: Qsl): Snapshot => findOrFail(getStore().snapshots, qsl.snapshotId ?? '', 'Snapshot');
export const userName = (id: string) => getStore().users.find(user => user.id === id)?.name ?? id;

export type RequestInput = {
  supplierId: string;
  category?: string;
  formId?: string;
  assessmentType?: 'First' | 'Re';
  previousQslId?: string;
  sampleRequired?: boolean;
  scopeType?: ScopeType;
  scopeDetail?: string;
  dueDate?: string;
  coordinatorId?: string;
  assessorId?: string;
  approverId?: string;
  reason?: string;
  documents?: string[];
};

export const isOpen = (qsl: Qsl) => qsl.status !== 'Draft' && qsl.status !== 'Completed';
export const isSuspended = (qsl: Qsl) => qsl.suspensions.some(item => !item.reactivatedAt);

// Every stage change is written to the status history.
function move(actor: Actor, qsl: Qsl, to: ProcessStatus, action: string, note?: string, internal = false): void {
  const from = qsl.status;
  qsl.status = to;
  audit(actor, { action: `Status: ${action}`, recordType: 'Qsl', recordRef: qsl.qslNo, previous: { status: from }, next: { status: to }, remarks: note });
  addHistory(actor, qsl.id, action, note, internal, 'status');
}

function closeAsFail(actor: Actor, qsl: Qsl, reason: string, action: string): void {
  qsl.decision = { result: 'Fail', reason, effectiveDate: todayIso(), by: actor.id, byName: actor.name, at: nowIso() };
  qsl.result = 'Fail';
  move(actor, qsl, 'Completed', action, reason);
}

// ---------------------------------------------------------------- Qualification Request (Coordinator / Admin)

export function createDraft(actor: Actor, input: RequestInput): Qsl {
  assertCan(actor, 'qsl.create');
  const store = getStore();
  findSupplier(input.supplierId);
  const qsl: Qsl = {
    id: nextId('QSL'), qslNo: '', supplierId: input.supplierId, category: input.category ?? supplierCategory(input.supplierId) ?? '', formId: input.formId ?? '',
    assessmentType: input.assessmentType ?? 'First', previousQslId: input.previousQslId, round: 1, status: 'Draft', result: 'None', sampleRequired: input.sampleRequired ?? false,
    scopeType: input.scopeType ?? 'Site / plant', scopeDetail: input.scopeDetail ?? '',
    coordinatorId: input.coordinatorId ?? (actor.role === 'Coordinator' ? actor.id : store.settings.coordinatorIds[0]),
    assessorId: input.assessorId ?? '', approverId: input.approverId ?? '', dueDate: input.dueDate, reason: input.reason ?? '', documents: [...(input.documents ?? [])],
    createdAt: nowIso(), createdBy: actor.id, answers: [], evidence: [], corrections: [], submissions: [], evaluations: [], selfRatings: [], proposedRatings: [], verifications: [],
    evaluationSummary: '', internalNote: '', approvals: [], suspensions: [], extensions: [],
  };
  qsl.qslNo = `DRAFT-${qsl.id}`;
  store.qsls.push(qsl);
  audit(actor, { action: 'QSL draft created', recordType: 'Qsl', recordRef: qsl.id, next: qsl });
  addHistory(actor, qsl.id, 'Saved draft assessment request', undefined, false, 'status');
  return clone(qsl);
}

export function updateDraft(actor: Actor, id: string, patch: Partial<RequestInput>): Qsl {
  assertCan(actor, 'qsl.create');
  const qsl = findQsl(id);
  if (qsl.status !== 'Draft') fail('INVALID_TRANSITION', 'Only drafts can be edited');
  const before = clone(qsl);
  const { supplierId, ...rest } = patch;
  if (supplierId) { findSupplier(supplierId); qsl.supplierId = supplierId; }
  Object.assign(qsl, Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)));
  audit(actor, { action: 'QSL draft saved', recordType: 'Qsl', recordRef: qsl.id, previous: before, next: qsl });
  return clone(qsl);
}

export const validateScope = (scopeType: string, scopeDetail: string): string[] => {
  const errors: string[] = [];
  if (!SCOPE_TYPES.includes(scopeType as ScopeType)) errors.push('Please select a qualification scope');
  else if (scopeType !== 'Company-wide' && !scopeDetail?.trim()) errors.push('Please enter scope details, e.g. plant name or product line');
  return errors;
};

// Returns error messages; empty means the draft can be submitted.
export function validateForSubmit(qsl: Qsl): string[] {
  const store = getStore();
  const errors: string[] = [];
  if (!qsl.category || !store.categories.some(item => item.name === qsl.category && item.active)) errors.push('Please select a category');
  errors.push(...validateScope(qsl.scopeType, qsl.scopeDetail));
  const form = store.forms.find(item => item.id === qsl.formId);
  const published = form && publishedVersion(form);
  if (!form || !form.active || !published) errors.push('Please select an active assessment form');
  else if (!published.data.categories.includes(qsl.category)) errors.push('Assessment form does not match the category');
  if (qsl.assessmentType === 'Re') {
    const previous = store.qsls.find(item => item.id === qsl.previousQslId);
    if (!previous || previous.status !== 'Completed' || previous.supplierId !== qsl.supplierId || previous.category !== qsl.category) errors.push('Please select a completed previous round for this supplier and category');
  }
  if (!qsl.dueDate) errors.push('Please enter a due date');
  else if (!isIsoDate(qsl.dueDate) || qsl.dueDate < todayIso()) errors.push('Due date must not be in the past');
  if (!store.settings.assessorIds.includes(qsl.assessorId)) errors.push('Please select an assessor');
  if (!store.settings.approverIds.includes(qsl.approverId)) errors.push('Please select an approver');
  if (store.settings.separateAssessorApprover && qsl.assessorId && qsl.assessorId === qsl.approverId) errors.push('Approver must be a different person from the assessor, per settings');
  if (!store.settings.coordinatorIds.includes(qsl.coordinatorId)) errors.push('Please select a coordinator');
  if (!qsl.reason.trim()) errors.push('Please enter the reason for the assessment');
  return errors;
}

export function submitRequest(actor: Actor, id: string): Qsl {
  assertCan(actor, 'qsl.create');
  const store = getStore();
  const qsl = findQsl(id);
  if (qsl.status !== 'Draft') fail('INVALID_TRANSITION', 'Only drafts can be submitted');
  requireValid(validateForSubmit(qsl), 'Cannot submit request');
  // One open round per supplier + category.
  if (store.qsls.some(item => item.id !== qsl.id && item.supplierId === qsl.supplierId && item.category === qsl.category && isOpen(item))) {
    fail('DUPLICATE', 'This supplier and category already have an open assessment round');
  }
  const form = findOrFail(store.forms, qsl.formId, 'Assessment form');
  const version = publishedVersion(form)!;
  const supplier = findSupplier(qsl.supplierId);
  const groupName = (groupId: string) => store.criteriaGroups.find(group => group.id === groupId)?.name ?? groupId;
  const criteria = version.data.sections.flatMap(section => section.items).map(item => {
    const entity = findOrFail(store.criteria, item.criteriaId, 'Criteria');
    const pinned = getVersion(entity, item.criteriaVersion)!;
    return { id: entity.id, kind: entity.kind, version: pinned.version, data: pinned.data, groupName: groupName(pinned.data.groupId) };
  });
  const skills = [...new Map(criteria.map(item => [item.data.groupId, { id: item.data.groupId, name: item.groupName }])).values()];
  const snapshot: Snapshot = deepFreeze(clone({
    id: nextId('SNP'), qslId: qsl.id, createdAt: nowIso(), supplier: { id: supplier.id, name: supplier.name, country: supplier.country, taxId: supplier.taxId },
    form: { id: form.id, version: version.version, data: version.data }, criteria, skills, useSkillLevel: store.settings.useSkillLevel,
  }));
  store.snapshots.push(snapshot);
  const previous = qsl.previousQslId ? findQsl(qsl.previousQslId) : undefined;
  qsl.qslNo = nextId(`QSL-${buddhistYear(now())}`);
  qsl.round = previous ? previous.round + 1 : 1;
  qsl.snapshotId = snapshot.id;
  qsl.submittedAt = nowIso();
  audit(actor, { action: 'QSL request submitted', recordType: 'AssessmentSnapshot', recordRef: snapshot.id, next: { qsl: qsl.qslNo, formVersion: version.version } });
  move(actor, qsl, 'WaitingSupplier', qsl.assessmentType === 'Re' ? 'Submitted reassessment request' : 'Submitted assessment request', qsl.reason);
  return clone(qsl);
}

// Pre-fills a renewal / reassessment request from a completed round.
export function prefillReassessment(actor: Actor, previousQslId: string): RequestInput {
  assertCan(actor, 'qsl.create');
  const previous = findQsl(previousQslId);
  if (previous.status !== 'Completed') fail('INVALID_TRANSITION', 'Reassessment can start only after the previous round is completed');
  const form = getStore().forms.find(item => item.active && publishedVersion(item)?.data.categories.includes(previous.category));
  return {
    supplierId: previous.supplierId, category: previous.category, formId: form?.id ?? previous.formId, assessmentType: 'Re', previousQslId: previous.id, sampleRequired: previous.sampleRequired,
    scopeType: previous.enrollment?.scopeType ?? previous.scopeType, scopeDetail: previous.enrollment?.scopeDetail ?? previous.scopeDetail, assessorId: previous.assessorId, approverId: previous.approverId,
    coordinatorId: actor.role === 'Coordinator' ? actor.id : previous.coordinatorId, reason: '',
  };
}

// ---------------------------------------------------------------- Supplier information and self-rating

const supplierEditable: ProcessStatus[] = ['WaitingSupplier', 'InfoRequested'];

function loadForSupplier(actor: Actor, id: string): { qsl: Qsl; snapshot: Snapshot } {
  assertCan(actor, 'qsl.fill');
  const qsl = findQsl(id);
  assertView(actor, qsl);
  if (!supplierEditable.includes(qsl.status)) fail('INVALID_TRANSITION', 'Editing is allowed only while waiting for supplier or when info is requested');
  return { qsl, snapshot: getSnapshot(qsl) };
}

function checkAnswer(criteria: CriteriaData, value: AnswerValue): string | null {
  switch (criteria.answerType) {
    case 'ShortText': case 'LongText': return typeof value === 'string' && value.trim() ? null : 'Please enter text';
    case 'Choice': return typeof value === 'string' && (criteria.options ?? []).includes(value) ? null : 'Please select an option';
    case 'Number': return typeof value === 'number' && Number.isFinite(value) ? null : 'Please enter a number';
    case 'Date': return typeof value === 'string' && isIsoDate(value) ? null : 'Please enter a date (YYYY-MM-DD)';
    case 'File': return typeof value === 'string' && value.trim() ? null : 'Please enter a file name';
  }
}

export function saveAnswers(actor: Actor, id: string, answers: { criteriaId: string; value: AnswerValue }[]): Qsl {
  const { qsl, snapshot } = loadForSupplier(actor, id);
  const errors = answers.flatMap(answer => {
    const criteria = snapshot.criteria.find(item => item.id === answer.criteriaId);
    if (!criteria) return [`Criteria ${answer.criteriaId} not found`];
    const problem = checkAnswer(criteria.data, answer.value);
    return problem ? [`${criteria.data.name}: ${problem}`] : [];
  });
  requireValid(errors);
  answers.forEach(answer => {
    qsl.answers = [...qsl.answers.filter(item => item.criteriaId !== answer.criteriaId), { criteriaId: answer.criteriaId, value: answer.value, updatedAt: nowIso() }];
  });
  audit(actor, { action: 'Supplier answers saved', recordType: 'Qsl', recordRef: qsl.qslNo, next: { answers: qsl.answers.length } });
  return clone(qsl);
}

const isLevel = (value: unknown): value is Level => value === 1 || value === 2 || value === 3;

// Rating Submission (supplier side): a declared value that is never the verified rating.
export function saveSelfRatings(actor: Actor, id: string, ratings: SkillRating[]): Qsl {
  const { qsl, snapshot } = loadForSupplier(actor, id);
  if (!snapshot.useSkillLevel) fail('VALIDATION', 'Skill / Level is not enabled');
  const errors = ratings.flatMap(rating => (!snapshot.skills.some(skill => skill.id === rating.skillId) ? [`Skill ${rating.skillId} not found`] : isLevel(rating.level) ? [] : ['Level must be 1-3']));
  requireValid(errors);
  ratings.forEach(rating => { qsl.selfRatings = [...qsl.selfRatings.filter(item => item.skillId !== rating.skillId), { skillId: rating.skillId, level: rating.level, comment: rating.comment }]; });
  audit(actor, { action: 'Supplier self-rating saved', recordType: 'Qsl', recordRef: qsl.qslNo, next: qsl.selfRatings });
  return clone(qsl);
}

export function attachEvidence(actor: Actor, id: string, criteriaId: string, fileName: string): Qsl {
  const { qsl, snapshot } = loadForSupplier(actor, id);
  if (!snapshot.criteria.some(item => item.id === criteriaId)) fail('VALIDATION', 'Criteria not found');
  if (!fileName?.trim()) fail('VALIDATION', 'Please enter a file name');
  qsl.evidence.push(deepFreeze({ id: nextId('EVD'), criteriaId, fileName: fileName.trim(), addedAt: nowIso(), addedBy: actor.id }));
  audit(actor, { action: 'Supplier evidence attached', recordType: 'Qsl', recordRef: qsl.qslNo, next: { criteriaId, fileName } });
  return clone(qsl);
}

export const isAnswered = (qsl: Qsl, criteria: { id: string; data: CriteriaData }) =>
  qsl.answers.some(item => item.criteriaId === criteria.id) || (criteria.data.answerType === 'File' && qsl.evidence.some(item => item.criteriaId === criteria.id));

export type MissingItem = { criteriaId: string; name: string; kind: 'Answer' | 'Evidence'; message: string };

// Required answers and mandatory evidence.
export function missingSupplierInput(qsl: Qsl, snapshot: Snapshot): MissingItem[] {
  const required = new Map(snapshot.form.data.sections.flatMap(section => section.items).map(item => [item.criteriaId, item.required]));
  return snapshot.criteria.flatMap((criteria): MissingItem[] => {
    const missing: MissingItem[] = [];
    if (required.get(criteria.id) && !isAnswered(qsl, criteria)) missing.push({ criteriaId: criteria.id, name: criteria.data.name, kind: 'Answer', message: 'Not answered' });
    if (criteria.data.evidenceRequired && !qsl.evidence.some(item => item.criteriaId === criteria.id)) missing.push({ criteriaId: criteria.id, name: criteria.data.name, kind: 'Evidence', message: 'Evidence not attached' });
    return missing;
  });
}

export function checkBeforeSubmit(actor: Actor, id: string): MissingItem[] {
  assertCan(actor, 'qsl.fill');
  const qsl = findQsl(id);
  assertView(actor, qsl);
  return missingSupplierInput(qsl, getSnapshot(qsl));
}

export function submitAnswers(actor: Actor, id: string, note = ''): Qsl {
  const { qsl, snapshot } = loadForSupplier(actor, id);
  const missing = missingSupplierInput(qsl, snapshot);
  if (missing.length) fail('VALIDATION', `Cannot submit: ${missing[0].name} ${missing[0].message}`, missing.map(item => `${item.name}: ${item.message}`));
  const backToPreReview = qsl.status === 'InfoRequested' && qsl.infoReturnTo === 'PreQualReview';
  if (backToPreReview && !note.trim()) fail('VALIDATION', 'Please explain your response to the info request');
  const unresolved = qsl.corrections.filter(item => !item.resolvedAt && !(
    qsl.answers.some(answer => answer.criteriaId === item.criteriaId && answer.updatedAt > item.requestedAt) ||
    qsl.evidence.some(evidence => evidence.criteriaId === item.criteriaId && evidence.addedAt > item.requestedAt)
  ));
  if (unresolved.length) fail('VALIDATION', 'Items requested by CPF have not been fixed', unresolved.map(item => item.criteriaId));
  const at = nowIso();
  qsl.corrections.forEach(item => { if (!item.resolvedAt) item.resolvedAt = at; });
  qsl.evaluations.forEach(item => { item.requestCorrection = false; });
  if (qsl.infoRequest && !qsl.infoRequest.resolvedAt) qsl.infoRequest.resolvedAt = at;
  qsl.submissions.push(deepFreeze({ round: qsl.submissions.length + 1, submittedAt: at, submittedBy: actor.id, answers: clone(qsl.answers), evidenceIds: qsl.evidence.map(item => item.id), note }));
  const first = qsl.status === 'WaitingSupplier';
  const to: ProcessStatus = first || backToPreReview ? 'PreQualReview' : 'WaitingAssessment';
  audit(actor, { action: 'Supplier information submitted', recordType: 'Qsl', recordRef: qsl.qslNo, next: { selfRatings: qsl.selfRatings } });
  move(actor, qsl, to, first ? 'Supplier submitted information and assessment form' : 'Supplier submitted additional information', note || undefined);
  return clone(qsl);
}

// ---------------------------------------------------------------- Pre-Qualification Review and Sample Evaluation (Coordinator)

export type PreReviewInput = { infoChecked: boolean; documentsChecked: boolean; decision: 'Proceed' | 'RequestInfo' | 'Reject'; comment: string };

export function completePreReview(actor: Actor, id: string, input: PreReviewInput): Qsl {
  assertCan(actor, 'qsl.prereview');
  const qsl = findQsl(id);
  assertView(actor, qsl);
  if (qsl.status !== 'PreQualReview') fail('INVALID_TRANSITION', 'Review is allowed only in Pre-Qualification Review');
  if (input.decision === 'Proceed' && !(input.infoChecked && input.documentsChecked)) fail('VALIDATION', 'Check all supplier information and documents before proceeding');
  if (input.decision !== 'Proceed' && !input.comment?.trim()) fail('VALIDATION', 'Please enter a comment');
  qsl.preReview = deepFreeze({ ...input, by: actor.id, byName: actor.name, at: nowIso() });
  if (input.decision === 'Reject') return (closeAsFail(actor, qsl, input.comment, 'Failed Pre-Qualification Review'), clone(qsl));
  if (input.decision === 'RequestInfo') {
    qsl.infoRequest = { message: input.comment, from: 'PreQualReview', requestedAt: nowIso() };
    qsl.infoReturnTo = 'PreQualReview';
    move(actor, qsl, 'InfoRequested', 'Requested more information from supplier', input.comment);
    return clone(qsl);
  }
  move(actor, qsl, qsl.sampleRequired ? 'SampleEvaluation' : 'WaitingAssessment', 'Passed Pre-Qualification Review', input.comment || undefined);
  return clone(qsl);
}

export function recordSample(actor: Actor, id: string, input: { reference: string; result: 'Pass' | 'Fail'; comment: string }): Qsl {
  assertCan(actor, 'qsl.prereview');
  const qsl = findQsl(id);
  assertView(actor, qsl);
  if (qsl.status !== 'SampleEvaluation') fail('INVALID_TRANSITION', 'Sample results can be recorded only in Sample Evaluation');
  if (!input.reference?.trim()) fail('VALIDATION', 'Please enter the sample number or sample request');
  if (input.result === 'Fail' && !input.comment?.trim()) fail('VALIDATION', 'Please enter the reason the sample failed');
  qsl.sample = deepFreeze({ ...input, by: actor.id, byName: actor.name, at: nowIso() });
  if (input.result === 'Fail') return (closeAsFail(actor, qsl, input.comment, 'Sample failed assessment'), clone(qsl));
  move(actor, qsl, 'WaitingAssessment', 'Sample passed assessment', input.comment || undefined);
  return clone(qsl);
}

// ---------------------------------------------------------------- Qualification Assessment (Assessor)

function loadForAssessor(actor: Actor, id: string): { qsl: Qsl; snapshot: Snapshot } {
  assertCan(actor, 'qsl.assess');
  const qsl = findQsl(id);
  assertView(actor, qsl);
  if (qsl.status !== 'WaitingAssessment') fail('INVALID_TRANSITION', 'Results can be saved only while waiting for assessment');
  return { qsl, snapshot: getSnapshot(qsl) };
}

export type EvaluationInput = { criteriaId: string; verdict?: Verdict; comment?: string; requestCorrection?: boolean; messageToSupplier?: string };

export function saveEvaluations(actor: Actor, id: string, inputs: EvaluationInput[]): Qsl {
  const { qsl, snapshot } = loadForAssessor(actor, id);
  const errors: string[] = [];
  const next: Evaluation[] = inputs.map(input => {
    if (!snapshot.criteria.some(item => item.id === input.criteriaId)) errors.push(`Criteria ${input.criteriaId} not found`);
    const previous = qsl.evaluations.find(item => item.criteriaId === input.criteriaId);
    const verdict = input.verdict ?? previous?.verdict ?? 'Compliant';
    if (!['Compliant', 'NonCompliant', 'NeedsFix'].includes(verdict)) errors.push('Invalid assessment result');
    return {
      criteriaId: input.criteriaId, verdict, comment: input.comment ?? previous?.comment ?? '',
      // Needs-fix automatically asks the supplier to correct the item.
      requestCorrection: verdict === 'NeedsFix' ? true : (input.requestCorrection ?? previous?.requestCorrection ?? false),
      messageToSupplier: input.messageToSupplier ?? previous?.messageToSupplier ?? '', evaluatedBy: actor.id, evaluatedAt: nowIso(),
    };
  });
  requireValid(errors);
  next.forEach(item => { qsl.evaluations = [...qsl.evaluations.filter(existing => existing.criteriaId !== item.criteriaId), item]; });
  audit(actor, { action: 'Assessor evaluation saved', recordType: 'Qsl', recordRef: qsl.qslNo, next: { evaluated: qsl.evaluations.length } });
  return clone(qsl);
}

// Rating Submission (assessor side): the buyer proposes a rating; it is not final until centrally verified.
export function proposeRatings(actor: Actor, id: string, ratings: SkillRating[]): Qsl {
  const { qsl, snapshot } = loadForAssessor(actor, id);
  if (!snapshot.useSkillLevel) fail('VALIDATION', 'Skill / Level is not enabled');
  const errors = ratings.flatMap(rating => (!snapshot.skills.some(skill => skill.id === rating.skillId) ? [`Skill ${rating.skillId} not found`] : isLevel(rating.level) ? [] : ['Level must be 1-3']));
  requireValid(errors);
  ratings.forEach(rating => { qsl.proposedRatings = [...qsl.proposedRatings.filter(item => item.skillId !== rating.skillId), { skillId: rating.skillId, level: rating.level, comment: rating.comment }]; });
  audit(actor, { action: 'Proposed skill rating saved', recordType: 'Qsl', recordRef: qsl.qslNo, next: qsl.proposedRatings });
  return clone(qsl);
}

export function requestMoreInfo(actor: Actor, id: string): Qsl {
  const { qsl } = loadForAssessor(actor, id);
  const requested = qsl.evaluations.filter(item => item.requestCorrection);
  if (!requested.length) fail('VALIDATION', 'Select at least 1 item');
  const noMessage = requested.filter(item => !item.messageToSupplier.trim());
  if (noMessage.length) fail('VALIDATION', 'Please add a message to the supplier for every selected item', noMessage.map(item => item.criteriaId));
  const at = nowIso();
  requested.forEach(item => {
    qsl.corrections = qsl.corrections.filter(existing => existing.criteriaId !== item.criteriaId || existing.resolvedAt);
    qsl.corrections.push({ criteriaId: item.criteriaId, message: item.messageToSupplier, requestedAt: at });
  });
  qsl.infoReturnTo = 'WaitingAssessment';
  move(actor, qsl, 'InfoRequested', 'Requested more information', `${requested.length} items`);
  return clone(qsl);
}

const latestVerification = (qsl: Qsl): Verification | undefined => qsl.verifications[qsl.verifications.length - 1];

// What still blocks the step after the assessor.
function missingForVerification(qsl: Qsl, snapshot: Snapshot): string[] {
  const missing = missingSupplierInput(qsl, snapshot).map(item => `${item.name}: ${item.message}`);
  snapshot.criteria.forEach(criteria => {
    const evaluation = qsl.evaluations.find(item => item.criteriaId === criteria.id);
    if (!evaluation) missing.push(`${criteria.data.name}: Not assessed`);
    else if (evaluation.verdict === 'NeedsFix') missing.push(`${criteria.data.name}: Needs fix`);
    else if (evaluation.requestCorrection) missing.push(`${criteria.data.name}: Correction request pending`);
  });
  if (snapshot.useSkillLevel) snapshot.skills.filter(skill => !qsl.proposedRatings.some(item => item.skillId === skill.id)).forEach(skill => missing.push(`Skill ${skill.name}: Assessor has not proposed a rating`));
  if (qsl.corrections.some(item => !item.resolvedAt)) missing.push('Correction requests awaiting supplier response');
  if (!qsl.recommended) missing.push('Assessor has not proposed an overall result');
  return missing;
}

export function missingForApproval(qsl: Qsl, snapshot: Snapshot): string[] {
  const missing = missingForVerification(qsl, snapshot);
  const verification = latestVerification(qsl);
  if (snapshot.useSkillLevel && (!verification || verification.at <= (qsl.assessedAt ?? ''))) missing.push('Central Verification not completed');
  return missing;
}

export function submitToVerification(actor: Actor, id: string, input: { recommended: 'Pass' | 'Fail'; summary: string; internalNote?: string }): Qsl {
  const { qsl, snapshot } = loadForAssessor(actor, id);
  if (!input.recommended) fail('VALIDATION', 'Please select the overall recommended result');
  if (!input.summary?.trim()) fail('VALIDATION', 'Please enter the assessment summary');
  qsl.recommended = input.recommended;
  const missing = missingForVerification(qsl, snapshot);
  if (missing.length) { qsl.recommended = undefined; fail('VALIDATION', `Cannot submit result: ${missing[0]}`, missing); }
  qsl.evaluationSummary = input.summary;
  qsl.internalNote = input.internalNote ?? qsl.internalNote;
  qsl.assessedBy = actor.id;
  qsl.assessedAt = nowIso();
  move(actor, qsl, 'WaitingVerification', 'Assessor submitted result to Central Verification', `Recommendation: ${input.recommended === 'Pass' ? 'Pass' : 'Fail'}`);
  return clone(qsl);
}

// ---------------------------------------------------------------- Skill Rating Verification (Central)

export function verifyRatings(actor: Actor, id: string, input: { decisions: { skillId: string; verifiedLevel: Level; comment?: string }[]; comments?: string }): Qsl {
  assertCan(actor, 'rating.verify');
  const qsl = findQsl(id);
  assertView(actor, qsl);
  if (qsl.status !== 'WaitingVerification') fail('INVALID_TRANSITION', 'Verification is allowed only while waiting for Central Verification');
  const snapshot = getSnapshot(qsl);
  const errors: string[] = [];
  const baseline = new Map<string, { self?: Level; proposed?: Level }>();
  qsl.selfRatings.forEach(item => baseline.set(item.skillId, { ...baseline.get(item.skillId), self: item.level }));
  qsl.proposedRatings.forEach(item => baseline.set(item.skillId, { ...baseline.get(item.skillId), proposed: item.level }));
  const given = input.decisions.map(item => item.skillId);
  if (new Set(given).size !== given.length) errors.push('Each skill can be verified only once');
  [...baseline.keys()].filter(skillId => !given.includes(skillId)).forEach(skillId => errors.push(`Rating must be verified for ${snapshot.skills.find(skill => skill.id === skillId)?.name ?? skillId}`));
  const decisions: RatingDecision[] = input.decisions.map(item => {
    const known = baseline.get(item.skillId);
    if (!known) errors.push(`No rating found to verify for ${item.skillId}`);
    if (!isLevel(item.verifiedLevel)) errors.push('Level must be 1-3');
    const reference = known?.proposed ?? known?.self;
    const action = item.verifiedLevel === reference ? 'Confirmed' : 'Adjusted';
    if (action === 'Adjusted' && !item.comment?.trim()) errors.push(`A reason is required when adjusting the rating for ${snapshot.skills.find(skill => skill.id === item.skillId)?.name ?? item.skillId}`);
    return { skillId: item.skillId, selfRating: known?.self, proposedRating: known?.proposed, verifiedLevel: item.verifiedLevel, action, comment: item.comment };
  });
  requireValid(errors, 'Verification is incomplete');
  const verification: Verification = deepFreeze({ id: nextId('VER'), round: qsl.verifications.length + 1, verifierId: actor.id, verifierName: actor.name, at: nowIso(), decisions, comments: input.comments ?? '' });
  qsl.verifications.push(verification);
  audit(actor, { action: 'Skill rating verified', recordType: 'Verification', recordRef: verification.id, next: verification, remarks: verification.comments });
  move(actor, qsl, 'WaitingApproval', 'Central Verification completed', `${decisions.filter(item => item.action === 'Adjusted').length} of ${decisions.length} skills adjusted`);
  return clone(qsl);
}

export const qualificationLevelOf = (qsl: Qsl): Level | undefined => {
  const levels = latestVerification(qsl)?.decisions.map(item => item.verifiedLevel) ?? [];
  return levels.length ? (Math.min(...levels) as Level) : undefined;
};

// ---------------------------------------------------------------- Qualification Approval (Approver)

export type DecisionInput = { decision: 'Approve' | 'Reject' | 'Return'; reason: string; effectiveDate?: string; scopeType?: ScopeType; scopeDetail?: string; validityMonths?: number };

export function decide(actor: Actor, id: string, input: DecisionInput): Qsl {
  assertCan(actor, 'qsl.approve');
  const store = getStore();
  const qsl = findQsl(id);
  assertView(actor, qsl);
  if (qsl.status !== 'WaitingApproval') fail('INVALID_TRANSITION', 'Decision is allowed only while waiting for approval');
  if (store.settings.separateAssessorApprover && actor.role !== 'Admin' && qsl.assessedBy === actor.id) fail('FORBIDDEN', 'Assessors cannot approve their own assessment');
  if (!input.reason?.trim()) fail('VALIDATION', 'A reason is required for every decision or return');
  const snapshot = getSnapshot(qsl);
  const log = (): void => {
    qsl.approvals.push(deepFreeze({ id: nextId('APR'), decision: input.decision, reason: input.reason, by: actor.id, byName: actor.name, at: nowIso() }));
    audit(actor, { action: `Qualification ${input.decision}`, recordType: 'Qsl', recordRef: qsl.qslNo, next: { decision: input.decision }, remarks: input.reason });
  };
  if (input.decision === 'Return') {
    log();
    qsl.recommended = undefined;
    move(actor, qsl, 'WaitingAssessment', 'Approver returned to assessor', input.reason, false);
    return clone(qsl);
  }
  if (input.decision === 'Reject') {
    log();
    closeAsFail(actor, qsl, input.reason, 'Rejected');
    return clone(qsl);
  }
  const missing = missingForApproval(qsl, snapshot);
  if (missing.length) fail('VALIDATION', `Cannot approve, information incomplete: ${missing[0]}`, missing);
  const effectiveDate = input.effectiveDate ?? todayIso();
  if (!isIsoDate(effectiveDate)) fail('VALIDATION', 'Invalid effective date');
  const scopeType = input.scopeType ?? qsl.scopeType;
  const scopeDetail = input.scopeDetail ?? qsl.scopeDetail;
  requireValid(validateScope(scopeType, scopeDetail));
  const months = input.validityMonths ?? validityMonthsFor(qsl.category, snapshot.form.data.validityMonths);
  if (!Number.isInteger(months) || months < 1 || months > 60) fail('VALIDATION', 'Validity must be between 1 and 60 months');
  log();
  qsl.decision = { result: 'Pass', reason: input.reason, effectiveDate, expiryDate: addMonthsIso(effectiveDate, months), by: actor.id, byName: actor.name, at: nowIso() };
  qsl.result = 'Pass';
  qsl.scopeType = scopeType;
  qsl.scopeDetail = scopeDetail;
  move(actor, qsl, 'Completed', 'Approved (eligible for QSL)', input.reason);
  return clone(qsl);
}

// ---------------------------------------------------------------- QSL scope, suspension and validity extension (publishing lives in publishing.ts)

function enrolled(id: string): Qsl {
  const qsl = findQsl(id);
  if (qsl.status !== 'Completed' || qsl.result !== 'Pass' || !qsl.enrollment || qsl.enrollment.withdrawal) fail('INVALID_TRANSITION', 'Only suppliers published on the QSL can be used');
  return qsl;
}

export function assignScope(actor: Actor, id: string, input: { scopeType: ScopeType; scopeDetail: string }): Qsl {
  assertCan(actor, 'enrollment.manage');
  const qsl = enrolled(id);
  requireValid(validateScope(input.scopeType, input.scopeDetail));
  const before = clone(qsl.enrollment);
  qsl.enrollment!.scopeType = input.scopeType;
  qsl.enrollment!.scopeDetail = input.scopeDetail;
  qsl.enrollment!.scopeHistory.push({ at: nowIso(), by: actor.name, scopeType: input.scopeType, scopeDetail: input.scopeDetail });
  qsl.scopeType = input.scopeType;
  qsl.scopeDetail = input.scopeDetail;
  audit(actor, { action: 'QSL scope assigned', recordType: 'Qsl', recordRef: qsl.qslNo, previous: before, next: qsl.enrollment });
  addHistory(actor, qsl.id, 'Assigned qualification scope', `${input.scopeType}: ${input.scopeDetail || '—'}`, false, 'status');
  return clone(qsl);
}

export function suspendQualification(actor: Actor, id: string, reason: string): Qsl {
  assertCan(actor, 'monitoring.manage');
  const qsl = enrolled(id);
  if (isSuspended(qsl)) fail('INVALID_TRANSITION', 'This QSL is already suspended');
  if (!reason?.trim()) fail('VALIDATION', 'Please enter the reason for suspension');
  qsl.suspensions.push({ reason, suspendedBy: actor.name, suspendedAt: nowIso() });
  audit(actor, { action: 'Qualification suspended', recordType: 'Qsl', recordRef: qsl.qslNo, next: { suspended: true }, remarks: reason });
  addHistory(actor, qsl.id, 'Suspended QSL (Suspension)', reason, false, 'status');
  return clone(qsl);
}

export function reactivateQualification(actor: Actor, id: string, note: string): Qsl {
  assertCan(actor, 'monitoring.manage');
  const qsl = enrolled(id);
  const active = qsl.suspensions.find(item => !item.reactivatedAt);
  if (!active) fail('INVALID_TRANSITION', 'This QSL is not suspended');
  if (!note?.trim()) fail('VALIDATION', 'Please enter the reason for reactivation');
  active!.reactivatedAt = nowIso();
  active!.reactivatedBy = actor.name;
  active!.reactivationNote = note;
  audit(actor, { action: 'Qualification reactivated', recordType: 'Qsl', recordRef: qsl.qslNo, next: { suspended: false }, remarks: note });
  addHistory(actor, qsl.id, 'Reactivated QSL (Reactivation)', note, false, 'status');
  return clone(qsl);
}

export function extendValidity(actor: Actor, id: string, input: { newExpiry: string; reason: string }): Qsl {
  assertCan(actor, 'monitoring.manage');
  const qsl = enrolled(id);
  const current = qsl.decision?.expiryDate;
  if (!current) fail('VALIDATION', 'This QSL has no expiry date to extend');
  if (!isIsoDate(input.newExpiry)) fail('VALIDATION', 'Invalid new expiry date');
  if (input.newExpiry <= current!) fail('VALIDATION', 'New expiry date must be after the current expiry date');
  if (input.newExpiry > addMonthsIso(qsl.decision!.effectiveDate, 60)) fail('VALIDATION', 'Total validity must not exceed 60 months from the effective date');
  if (!input.reason?.trim()) fail('VALIDATION', 'Please enter the reason for extension');
  qsl.extensions.push({ previousExpiry: current!, newExpiry: input.newExpiry, reason: input.reason, by: actor.name, at: nowIso() });
  qsl.decision!.expiryDate = input.newExpiry;
  if (qsl.enrollment) qsl.enrollment.expiryDate = input.newExpiry;
  audit(actor, { action: 'Validity extended', recordType: 'Qsl', recordRef: qsl.qslNo, previous: { expiryDate: current }, next: { expiryDate: input.newExpiry }, remarks: input.reason });
  addHistory(actor, qsl.id, 'Extended validity (Validity Extension)', `${current} → ${input.newExpiry}: ${input.reason}`, false, 'status');
  return clone(qsl);
}
