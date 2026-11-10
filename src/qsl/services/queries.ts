import type { Actor, CertifiedSkillView, Level, ProcessStatus, Qsl, QslResult, Snapshot } from '../types.ts';
import { clone, getStore, supplierCategory, todayIso } from '../store.ts';
import { assertCan, assertView, canViewQsl } from '../rbac.ts';
import { addDaysIso, daysBetween } from '../dates.ts';
import { latestVersion, publishedVersion } from '../versioning.ts';
import { validityMonthsFor } from '../settings.ts';
import { criteriaUsage } from './criteria.ts';
import { findQsl, findSupplier, getSnapshot, isAnswered, isOpen, isSuspended, missingForApproval, missingSupplierInput, userName } from './assessments.ts';
import { resultLabel, statusLabel, supplierStatusLabel, typeLabel, validityLabel } from '../labels.ts';
import { suppliers } from '../../data/suppliers.ts';
import { complianceCompanies } from '../../data/compliance.ts';

export type Validity = keyof typeof validityLabel;
export type Standing = 'Published' | 'Expiring' | 'Expired' | 'Suspended' | 'Withdrawn';
export type NextAction = 'fill' | 'prereview' | 'sample' | 'assess' | 'verify' | 'approve' | 'edit' | null;

export const visibleQsls = (actor: Actor) => getStore().qsls.filter(qsl => canViewQsl(actor, qsl));
// A round is on the QSL once it has been published (enrollment exists); a withdrawn listing keeps its record.
export const isEnrolled = (qsl: Qsl) => qsl.status === 'Completed' && qsl.result === 'Pass' && !!qsl.enrollment;
export const isApproved = (qsl: Qsl) => qsl.status === 'Completed' && qsl.result === 'Pass';

// The QSL listing carries its own validity once published; before that the qualification validity applies.
export const expiryOf = (qsl: Qsl): string | undefined => (qsl.enrollment ? qsl.enrollment.expiryDate : qsl.decision?.expiryDate);

function validityFor(expiry?: string): Validity {
  if (!expiry) return 'Unspecified';
  const today = todayIso();
  if (expiry < today) return 'Expired';
  return expiry <= addDaysIso(today, getStore().settings.reminderDays) ? 'Expiring' : 'Valid';
}

export const validityOf = (qsl: Qsl): Validity | undefined => (isApproved(qsl) ? validityFor(expiryOf(qsl)) : undefined);
const qualificationValidityOf = (qsl: Qsl): Validity | undefined => (isApproved(qsl) ? validityFor(qsl.decision?.expiryDate) : undefined);

// Withdrawal and suspension override validity in the register.
function standingOf(qsl: Qsl): Standing | undefined {
  if (!isEnrolled(qsl)) return undefined;
  if (qsl.enrollment!.withdrawal) return 'Withdrawn';
  const validity = validityOf(qsl);
  if (isSuspended(qsl)) return 'Suspended';
  return validity === 'Expired' ? 'Expired' : validity === 'Expiring' ? 'Expiring' : 'Published';
}

export const scopeLabel = (type: string, detail: string) => [type, detail].filter(Boolean).join(' · ');

export const keyOf = (qsl: Qsl) => [qsl.supplierId, qsl.category, qsl.enrollment?.scopeType ?? qsl.scopeType, (qsl.enrollment?.scopeDetail ?? qsl.scopeDetail).toLowerCase()].join('|');

// Newest decided round per supplier + category + scope. A later rejection replaces an earlier approval.
export function latestPerKey(qsls: Qsl[]): Map<string, Qsl> {
  const latest = new Map<string, Qsl>();
  qsls.filter(qsl => qsl.status === 'Completed').forEach(qsl => {
    const current = latest.get(keyOf(qsl));
    if (!current || (qsl.decision?.at ?? '') > (current.decision?.at ?? '')) latest.set(keyOf(qsl), qsl);
  });
  return latest;
}

// The published listing per key: the newest published round, unless a later rejection replaced it.
function latestListings(qsls: Qsl[]): Qsl[] {
  const decided = new Map<string, Qsl[]>();
  qsls.filter(qsl => qsl.status === 'Completed').forEach(qsl => decided.set(keyOf(qsl), [...(decided.get(keyOf(qsl)) ?? []), qsl]));
  return [...decided.values()].flatMap(list => {
    const sorted = [...list].sort((a, b) => (b.decision?.at ?? '').localeCompare(a.decision?.at ?? ''));
    const listed = sorted[0].result === 'Fail' ? undefined : sorted.find(isEnrolled);
    return listed ? [listed] : [];
  });
}

export function ownerOf(qsl: Qsl): string {
  switch (qsl.status) {
    case 'Draft': case 'PreQualReview': case 'SampleEvaluation': return userName(qsl.coordinatorId);
    case 'WaitingSupplier': return findSupplier(qsl.supplierId).name;
    case 'InfoRequested': return qsl.infoReturnTo === 'PreQualReview' || qsl.corrections.some(item => !item.resolvedAt) ? findSupplier(qsl.supplierId).name : userName(qsl.assessorId);
    case 'WaitingAssessment': return userName(qsl.assessorId);
    case 'WaitingVerification': return 'Central Verifier';
    case 'WaitingApproval': return userName(qsl.approverId);
    default: return '—';
  }
}

function nextActionFor(actor: Actor, qsl: Qsl): NextAction {
  switch (qsl.status) {
    case 'Draft': return actor.role === 'Coordinator' || actor.role === 'Admin' ? 'edit' : null;
    case 'WaitingSupplier': case 'InfoRequested': return actor.role === 'Supplier' || actor.role === 'Admin' ? 'fill' : null;
    case 'PreQualReview': return actor.role === 'Coordinator' || actor.role === 'Admin' ? 'prereview' : null;
    case 'SampleEvaluation': return actor.role === 'Coordinator' || actor.role === 'Admin' ? 'sample' : null;
    case 'WaitingAssessment': return actor.role === 'Admin' || (actor.role === 'Assessor' && qsl.assessorId === actor.id) ? 'assess' : null;
    case 'WaitingVerification': return actor.role === 'Verifier' || actor.role === 'Admin' ? 'verify' : null;
    case 'WaitingApproval': return actor.role === 'Admin' || (actor.role === 'Approver' && qsl.approverId === actor.id) ? 'approve' : null;
    default: return null;
  }
}

const isOverdue = (qsl: Qsl) => (qsl.status === 'WaitingSupplier' || qsl.status === 'InfoRequested') && !!qsl.dueDate && qsl.dueDate < todayIso();

const roundLabelOf = (qsl: Qsl) => {
  if (qsl.assessmentType === 'First') return typeLabel.First;
  const previous = getStore().qsls.find(item => item.id === qsl.previousQslId);
  return `${typeLabel.Re} · Ref ${previous?.qslNo ?? '—'}`;
};

const formLabelOf = (qsl: Qsl) => {
  const store = getStore();
  const snapshot = store.snapshots.find(item => item.id === qsl.snapshotId);
  if (snapshot) return `${snapshot.form.data.name} v${snapshot.form.version}`;
  const form = store.forms.find(item => item.id === qsl.formId);
  const version = form && (publishedVersion(form) ?? latestVersion(form));
  return version ? `${version.data.name} v${version.version}` : '—';
};

export const skillNames = (qsl: Qsl): Map<string, string> => new Map((getStore().snapshots.find(item => item.id === qsl.snapshotId)?.skills ?? []).map(skill => [skill.id, skill.name]));

// ---------------------------------------------------------------- Qualification Management

export type QslRow = {
  id: string;
  qslNo: string;
  supplierId: string;
  supplierName: string;
  category: string;
  scope: string;
  formLabel: string;
  roundLabel: string;
  status: ProcessStatus;
  statusLabel: string;
  result: QslResult;
  dueDate?: string;
  overdue: boolean;
  owner: string;
  nextAction: NextAction;
};

function toRow(actor: Actor, qsl: Qsl): QslRow {
  return {
    id: qsl.id, qslNo: qsl.qslNo, supplierId: qsl.supplierId, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category,
    scope: [qsl.scopeType, qsl.scopeDetail].filter(Boolean).join(' · '), formLabel: formLabelOf(qsl), roundLabel: roundLabelOf(qsl), status: qsl.status,
    statusLabel: actor.role === 'Supplier' ? supplierStatusLabel[qsl.status] : statusLabel[qsl.status], result: qsl.result, dueDate: qsl.dueDate, overdue: isOverdue(qsl),
    owner: ownerOf(qsl), nextAction: nextActionFor(actor, qsl),
  };
}

const matchesSearch = (row: QslRow, search?: string) => {
  const text = [row.qslNo, row.supplierName, row.supplierId, row.category, row.scope, row.formLabel, row.roundLabel, row.statusLabel, resultLabel[row.result], row.owner, row.dueDate ?? ''].join(' ').toLowerCase();
  return (search ?? '').toLowerCase().split(/\s+/).filter(Boolean).every(token => text.includes(token));
};

export type ManagementStage = 'request' | 'sample' | 'assessment' | 'verification' | 'approval';
export type ManagementView = 'all' | 'open' | ManagementStage;
const stageOf = (qsl: Qsl): ManagementStage => {
  switch (qsl.status) {
    case 'SampleEvaluation': return 'sample';
    case 'WaitingAssessment': return 'assessment';
    case 'WaitingVerification': return 'verification';
    case 'WaitingApproval': return 'approval';
    case 'InfoRequested': return qsl.infoReturnTo === 'WaitingAssessment' ? 'assessment' : 'request';
    default: return 'request';
  }
};

// One pipeline: request/pre-qualification -> sample -> assessment -> central verification -> approval. 'open' = every round in progress.
export function listManagement(actor: Actor, view: ManagementView, search?: string) {
  const visible = visibleQsls(actor);
  const counts: Record<ManagementStage, number> = { request: 0, sample: 0, assessment: 0, verification: 0, approval: 0 };
  const inProgress = visible.filter(qsl => qsl.status !== 'Completed');
  inProgress.forEach(qsl => { counts[stageOf(qsl)] += 1; });
  const rows = visible
    .filter(qsl => (view === 'all' ? true : qsl.status !== 'Completed' && (view === 'open' || stageOf(qsl) === view)))
    .map(qsl => toRow(actor, qsl))
    .filter(row => matchesSearch(row, search))
    // Overdue first, then the nearest due date; rows without a due date go last.
    .sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  return { rows, counts, open: inProgress.length, visibleTotal: visible.length };
}

// ---------------------------------------------------------------- QSL Directory

export type DirectoryRow = {
  id: string;
  qslNo: string;
  listingNo: string;
  supplierId: string;
  supplierName: string;
  country: string;
  category: string;
  scopeType: string;
  scopeDetail: string;
  level?: Level;
  skills: CertifiedSkillView[];
  effectiveDate?: string;
  expiryDate?: string;
  publishedAt: string;
  publishedBy: string;
  standing: Standing;
  validity: Validity;
  validityMonths: number;
  scopeChanges: number;
  extensions: number;
  daysLeft?: number;
};

export function verifiedSkills(qsl: Qsl): CertifiedSkillView[] {
  const names = skillNames(qsl);
  const verification = qsl.verifications[qsl.verifications.length - 1];
  return (verification?.decisions ?? []).map(item => ({ skillId: item.skillId, name: names.get(item.skillId) ?? item.skillId, level: item.verifiedLevel }));
}

export function toDirectory(qsl: Qsl): DirectoryRow {
  const supplier = findSupplier(qsl.supplierId);
  const listing = qsl.enrollment!;
  return {
    id: qsl.id, qslNo: qsl.qslNo, listingNo: listing.listingNo, supplierId: supplier.id, supplierName: supplier.name, country: supplier.country, category: qsl.category,
    scopeType: listing.scopeType, scopeDetail: listing.scopeDetail, level: listing.level, skills: verifiedSkills(qsl),
    effectiveDate: listing.effectiveDate, expiryDate: listing.expiryDate, publishedAt: listing.enrolledAt, publishedBy: listing.publishedBy, standing: standingOf(qsl)!, validity: validityOf(qsl)!,
    validityMonths: validityMonthsFor(qsl.category, getSnapshot(qsl).form.data.validityMonths), scopeChanges: listing.scopeHistory.length - 1, extensions: qsl.extensions.length,
    daysLeft: listing.expiryDate ? daysBetween(todayIso(), listing.expiryDate) : undefined,
  };
}

export const latestEnrolled = (actor: Actor): Qsl[] => latestListings(visibleQsls(actor));

export function listDirectory(actor: Actor, filter: { search?: string; category?: string; status?: Standing } = {}) {
  assertCan(actor, 'directory.view');
  const search = (filter.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const all = latestEnrolled(actor).map(toDirectory);
  const rows = all
    .filter(row => !filter.category || row.category === filter.category)
    .filter(row => !filter.status || row.standing === filter.status)
    .filter(row => {
      const text = [row.supplierName, row.supplierId, row.qslNo, row.listingNo, row.category, row.scopeType, row.scopeDetail, ...row.skills.map(skill => skill.name)].join(' ').toLowerCase();
      return search.every(token => text.includes(token));
    })
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  const counts: Record<Standing, number> = { Published: 0, Expiring: 0, Expired: 0, Suspended: 0, Withdrawn: 0 };
  all.forEach(row => { counts[row.standing] += 1; });
  return { rows, counts, total: all.length };
}

// ---------------------------------------------------------------- Dashboard

// Counts for the list header. Portfolio-wide figures live on the main Dashboard overview.
export function getMiniDashboard(actor: Actor) {
  const visible = visibleQsls(actor);
  const enrolled = latestEnrolled(actor).map(toDirectory);
  return clone({
    counts: {
      inProcess: visible.filter(isOpen).length,
      expiring: enrolled.filter(row => row.standing !== 'Withdrawn' && (row.validity === 'Expiring' || row.validity === 'Expired')).length,
      suspended: enrolled.filter(row => row.standing === 'Suspended').length,
    },
  });
}

// ---------------------------------------------------------------- Expiry and requalification

// due = enrolled results at or past the reminder window; reassessing flags rows that already have an open renewal round.
export function listMonitoring(actor: Actor) {
  const store = getStore();
  const reassessing = new Set(store.qsls.filter(qsl => qsl.assessmentType === 'Re' && qsl.status !== 'Completed').map(keyOf));
  const due = latestEnrolled(actor).filter(qsl => !qsl.enrollment!.withdrawal && (validityOf(qsl) === 'Expiring' || validityOf(qsl) === 'Expired'))
    .sort((a, b) => (expiryOf(a) ?? '').localeCompare(expiryOf(b) ?? ''))
    .map(qsl => ({ ...toDirectory(qsl), reassessing: reassessing.has(keyOf(qsl)) }));
  const reassessment = visibleQsls(actor).filter(qsl => qsl.assessmentType === 'Re' && qsl.status !== 'Completed').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(qsl => ({
    ...toRow(actor, qsl), previousNo: store.qsls.find(item => item.id === qsl.previousQslId)?.qslNo ?? '—', reason: qsl.reason,
  }));
  return clone({ due, reassessment, reminderDays: store.settings.reminderDays });
}

// Qualification-level renewals: approved rounds near or past the qualification expiry, whether or not they are on the QSL.
export function listRequalification(actor: Actor) {
  const store = getStore();
  const reassessing = new Set(store.qsls.filter(qsl => qsl.assessmentType === 'Re' && qsl.status !== 'Completed').map(keyOf));
  const due = [...latestPerKey(visibleQsls(actor)).values()]
    .filter(qsl => qualificationValidityOf(qsl) === 'Expiring' || qualificationValidityOf(qsl) === 'Expired')
    .sort((a, b) => (a.decision!.expiryDate ?? '').localeCompare(b.decision!.expiryDate ?? ''))
    .map(qsl => ({
      id: qsl.id, qslNo: qsl.qslNo, supplierId: qsl.supplierId, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category, scope: scopeLabel(qsl.scopeType, qsl.scopeDetail),
      expiryDate: qsl.decision!.expiryDate, daysLeft: qsl.decision!.expiryDate ? daysBetween(todayIso(), qsl.decision!.expiryDate) : undefined, validity: qualificationValidityOf(qsl)!,
      reassessing: reassessing.has(keyOf(qsl)),
    }));
  return clone({ due, reassessment: listMonitoring(actor).reassessment, reminderDays: store.settings.reminderDays });
}

// ---------------------------------------------------------------- History

const historyContext = (actor: Actor, search?: string) => {
  const tokens = (search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (...parts: (string | undefined)[]) => { const text = parts.join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); };
  return { store: getStore(), staff: actor.role !== 'Supplier', visible: visibleQsls(actor), hit };
};

function qualificationHistory(actor: Actor, search?: string) {
  const { staff, visible, hit } = historyContext(actor, search);
  return clone(visible.filter(qsl => qsl.status !== 'Draft' || staff).map(qsl => ({
    id: qsl.id, qslNo: qsl.qslNo, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category, round: qsl.round, type: typeLabel[qsl.assessmentType], statusLabel: statusLabel[qsl.status],
    result: qsl.result, effectiveDate: qsl.decision?.effectiveDate, expiryDate: qsl.decision?.expiryDate, standing: standingOf(qsl), createdAt: qsl.createdAt,
  })).filter(row => hit(row.qslNo, row.supplierName, row.category, row.statusLabel, resultLabel[row.result])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

function statusHistory(actor: Actor, search?: string) {
  const { store, staff, visible, hit } = historyContext(actor, search);
  const ids = new Set(visible.map(qsl => qsl.id));
  return clone(store.history.filter(entry => entry.kind === 'status' && ids.has(entry.qslId) && (staff || !entry.internal)).map(entry => {
    const qsl = store.qsls.find(item => item.id === entry.qslId)!;
    return { ...entry, qslNo: qsl.qslNo, supplierName: findSupplier(qsl.supplierId).name };
  }).filter(row => hit(row.qslNo, row.supplierName, row.action, row.note, row.byName)).sort((a, b) => b.at.localeCompare(a.at)));
}

export function listHistory(actor: Actor, view: 'qualification', search?: string): ReturnType<typeof qualificationHistory>;
export function listHistory(actor: Actor, view: 'status', search?: string): ReturnType<typeof statusHistory>;
export function listHistory(actor: Actor, view: 'qualification' | 'status', search?: string) {
  return view === 'qualification' ? qualificationHistory(actor, search) : statusHistory(actor, search);
}

// ---------------------------------------------------------------- Assessment sheet and detail

export type SheetItem = {
  criteriaId: string;
  code: string;
  name: string;
  kind: 'Standard' | 'BuyerCustom';
  description: string;
  groupName: string;
  answerType: string;
  options?: string[];
  unit?: string;
  required: boolean;
  evidenceRequired: boolean;
  answer?: string | number;
  evidence: { id: string; fileName: string }[];
  correction?: string;
  evaluation?: { verdict: string; comment: string; requestCorrection: boolean; messageToSupplier: string };
  missing: string[];
};

export function getSheet(actor: Actor, id: string) {
  const qsl = findQsl(id);
  assertView(actor, qsl);
  const snapshot: Snapshot = getSnapshot(qsl);
  const staff = actor.role !== 'Supplier';
  const supplierMissing = missingSupplierInput(qsl, snapshot);
  const sections = snapshot.form.data.sections.map(section => ({
    title: section.title,
    items: section.items.map((formItem): SheetItem => {
      const criteria = snapshot.criteria.find(item => item.id === formItem.criteriaId)!;
      const evaluation = qsl.evaluations.find(item => item.criteriaId === criteria.id);
      const correction = qsl.corrections.find(item => item.criteriaId === criteria.id && !item.resolvedAt);
      return {
        criteriaId: criteria.id, code: criteria.data.code, name: criteria.data.name, kind: criteria.kind, description: criteria.data.description, groupName: criteria.groupName, answerType: criteria.data.answerType,
        options: criteria.data.options, unit: criteria.data.unit, required: formItem.required, evidenceRequired: criteria.data.evidenceRequired, answer: qsl.answers.find(item => item.criteriaId === criteria.id)?.value,
        evidence: qsl.evidence.filter(item => item.criteriaId === criteria.id).map(item => ({ id: item.id, fileName: item.fileName })), correction: correction?.message,
        evaluation: staff && evaluation ? { verdict: evaluation.verdict, comment: evaluation.comment, requestCorrection: evaluation.requestCorrection, messageToSupplier: evaluation.messageToSupplier } : undefined,
        missing: supplierMissing.filter(item => item.criteriaId === criteria.id).map(item => item.message),
      };
    }),
  }));
  const items = sections.flatMap(section => section.items);
  const answered = snapshot.criteria.filter(criteria => isAnswered(qsl, criteria)).length;
  const verification = qsl.verifications[qsl.verifications.length - 1];
  const skills = snapshot.skills.map(skill => {
    const decision = verification?.decisions.find(item => item.skillId === skill.id);
    return {
      id: skill.id, name: skill.name, self: qsl.selfRatings.find(item => item.skillId === skill.id)?.level, selfComment: qsl.selfRatings.find(item => item.skillId === skill.id)?.comment,
      proposed: staff ? qsl.proposedRatings.find(item => item.skillId === skill.id)?.level : undefined, proposedComment: staff ? qsl.proposedRatings.find(item => item.skillId === skill.id)?.comment : undefined,
      verified: staff ? decision?.verifiedLevel : undefined, action: staff ? decision?.action : undefined, verifierComment: staff ? decision?.comment : undefined,
    };
  });
  return clone({
    id: qsl.id, qslNo: qsl.qslNo, status: qsl.status, result: qsl.result, round: qsl.round, roundLabel: roundLabelOf(qsl), category: qsl.category, formLabel: formLabelOf(qsl), dueDate: qsl.dueDate,
    scope: { type: qsl.scopeType, detail: qsl.scopeDetail }, sampleRequired: qsl.sampleRequired, supplier: snapshot.supplier, supplierProfile: staff ? supplierProfile(qsl.supplierId) : undefined, sections, skills, useSkillLevel: snapshot.useSkillLevel,
    progress: { answered, total: items.length, percent: items.length ? Math.round((answered / items.length) * 100) : 0 },
    corrections: qsl.corrections.filter(item => !item.resolvedAt).map(item => ({ criteriaId: item.criteriaId, message: item.message })),
    infoRequest: qsl.infoRequest && !qsl.infoRequest.resolvedAt ? qsl.infoRequest.message : undefined,
    preReview: staff ? qsl.preReview : undefined, sample: staff ? qsl.sample : undefined, documents: qsl.documents,
    recommended: staff ? qsl.recommended : undefined, evaluationSummary: staff ? qsl.evaluationSummary : '', internalNote: staff ? qsl.internalNote : '',
    verificationComments: staff ? verification?.comments ?? '' : '', verifierName: staff ? verification?.verifierName : undefined,
    missingForApproval: staff ? missingForApproval(qsl, snapshot) : [], nextAction: nextActionFor(actor, qsl), approver: userName(qsl.approverId), assessor: userName(qsl.assessorId),
    separateRule: getStore().settings.separateAssessorApprover, assessedByCurrentUser: qsl.assessedBy === actor.id && actor.role !== 'Admin',
    validityMonths: validityMonthsFor(qsl.category, snapshot.form.data.validityMonths),
  });
}

// Shared supplier profile reused for the pre-qualification check (read-only, never copied per buyer).
function supplierProfile(supplierId: string) {
  const supplier = findSupplier(supplierId);
  return { id: supplier.id, name: supplier.name, country: supplier.country, taxId: supplier.taxId, materialGroup: supplier.materialGroup, productTypes: supplier.productTypes ?? [] };
}

export function getDetail(actor: Actor, id: string) {
  const qsl = findQsl(id);
  assertView(actor, qsl);
  const store = getStore();
  const staff = actor.role !== 'Supplier';
  const supplier = findSupplier(qsl.supplierId);
  const row = toRow(actor, qsl);
  const snapshot = store.snapshots.find(item => item.id === qsl.snapshotId);
  const names = new Map((snapshot?.criteria ?? []).map(item => [item.id, item.data.name]));
  const history = store.history.filter(item => item.qslId === qsl.id && (staff || !item.internal)).sort((a, b) => a.at.localeCompare(b.at));
  const otherRounds = store.qsls.filter(item => item.id !== qsl.id && item.supplierId === qsl.supplierId && item.category === qsl.category && canViewQsl(actor, item))
    .sort((a, b) => b.round - a.round).map(item => ({ id: item.id, qslNo: item.qslNo, round: item.round, statusLabel: statusLabel[item.status], result: item.result, validity: validityOf(item) }));
  const verification = qsl.verifications[qsl.verifications.length - 1];
  const sk = snapshot?.skills ?? [];
  return clone({
    row, supplier: { id: supplier.id, name: supplier.name, taxId: supplier.taxId, country: supplier.country }, category: qsl.category, round: qsl.round, previousNo: store.qsls.find(item => item.id === qsl.previousQslId)?.qslNo,
    standing: standingOf(qsl), validity: validityOf(qsl), level: qsl.enrollment?.level, enrollment: qsl.enrollment,
    decision: qsl.decision ? { ...qsl.decision, reason: staff ? qsl.decision.reason : '' } : undefined,
    dates: { createdAt: qsl.createdAt, submittedAt: qsl.submittedAt, assessedAt: qsl.assessedAt, approvedAt: qsl.decision?.at, effectiveDate: qsl.decision?.effectiveDate, expiryDate: qsl.decision?.expiryDate },
    people: { coordinator: userName(qsl.coordinatorId), assessor: userName(qsl.assessorId), approver: userName(qsl.approverId) },
    ratings: staff ? sk.map(skill => ({ name: skill.name, self: qsl.selfRatings.find(item => item.skillId === skill.id)?.level, proposed: qsl.proposedRatings.find(item => item.skillId === skill.id)?.level, verified: verification?.decisions.find(item => item.skillId === skill.id)?.verifiedLevel })) : [],
    verifiedSkills: verifiedSkills(qsl), useSkillLevel: snapshot?.useSkillLevel ?? false,
    criteriaResults: staff ? qsl.evaluations.map(item => ({ name: names.get(item.criteriaId) ?? item.criteriaId, verdict: item.verdict, comment: item.comment })) : [],
    evaluationSummary: staff ? qsl.evaluationSummary : '', internalNote: staff ? qsl.internalNote : '', preReview: staff ? qsl.preReview : undefined, sample: staff ? qsl.sample : undefined,
    approvals: staff ? qsl.approvals : [], suspensions: staff ? qsl.suspensions : [], extensions: staff ? qsl.extensions : [],
    cpfMessages: qsl.corrections.map(item => ({ name: names.get(item.criteriaId) ?? item.criteriaId, message: item.message, resolved: !!item.resolvedAt })),
    documents: qsl.documents, evidence: staff ? qsl.evidence.map(item => ({ criteria: names.get(item.criteriaId) ?? item.criteriaId, fileName: item.fileName })) : [],
    history: history.map(item => ({ at: item.at, action: item.action, by: item.byName, role: item.role, note: item.note })), otherRounds, suspended: isSuspended(qsl),
    nextAction: nextActionFor(actor, qsl), canReassess: (actor.role === 'Coordinator' || actor.role === 'Admin') && isApproved(qsl),
  });
}

// ---------------------------------------------------------------- Criteria Management

export function listCriteriaRows(kind: 'Standard' | 'BuyerCustom') {
  const store = getStore();
  const groupName = (id: string) => store.criteriaGroups.find(group => group.id === id)?.name ?? id;
  return clone(store.criteria.filter(item => item.kind === kind).map(item => {
    const version = publishedVersion(item) ?? latestVersion(item);
    return {
      id: item.id, kind: item.kind, code: version.data.code, name: version.data.name, skill: groupName(version.data.groupId), groupId: version.data.groupId, answerType: version.data.answerType, description: version.data.description,
      options: version.data.options, unit: version.data.unit, evidenceRequired: version.data.evidenceRequired, levels: version.data.levels, version: version.version, active: item.active, usage: criteriaUsage(item.id),
      forms: store.forms.filter(form => form.versions.some(v => v.data.sections.some(section => section.items.some(entry => entry.criteriaId === item.id)))).map(form => latestVersion(form).data.name),
    };
  }));
}

export function criteriaFormOptions() {
  const store = getStore();
  return clone({
    skills: store.criteriaGroups.filter(group => group.active).map(group => ({ id: group.id, name: group.name })),
    forms: store.forms.filter(form => form.active).map(form => ({ id: form.id, name: (publishedVersion(form) ?? latestVersion(form)).data.name, sections: (publishedVersion(form) ?? latestVersion(form)).data.sections.map(section => section.title) })),
  });
}

// ---------------------------------------------------------------- Lookups

export function categoriesFor(): string[] { return getStore().categories.filter(item => item.active).map(item => item.name); }

export function getRequestOptions(actor: Actor) {
  assertCan(actor, 'qsl.create');
  const store = getStore();
  const forms = store.forms.filter(form => form.active && publishedVersion(form)).map(form => {
    const version = publishedVersion(form)!;
    return { id: form.id, label: `${version.data.name} v${version.version}`, categories: version.data.categories };
  });
  return clone({
    suppliers: suppliers.filter(item => supplierCategory(item.id)).map(item => ({ id: item.id, name: item.name, category: supplierCategory(item.id) })),
    categories: categoriesFor(), forms,
    coordinators: store.users.filter(user => store.settings.coordinatorIds.includes(user.id)),
    assessors: store.users.filter(user => store.settings.assessorIds.includes(user.id)),
    approvers: store.users.filter(user => store.settings.approverIds.includes(user.id)),
    completed: store.qsls.filter(qsl => qsl.status === 'Completed').map(qsl => ({ id: qsl.id, qslNo: qsl.qslNo, supplierId: qsl.supplierId, category: qsl.category, result: qsl.result, expiryDate: qsl.decision?.expiryDate })),
    separateRule: store.settings.separateAssessorApprover,
  });
}

export function getRequestDraft(actor: Actor, id: string) {
  assertCan(actor, 'qsl.create');
  return clone(findQsl(id));
}

// Documents already held in the shared supplier profile (Compliance module), referenced for the pre-qualification check.
export function getSupplierDocuments(actor: Actor, supplierId: string) {
  assertCan(actor, 'qsl.prereview');
  const company = complianceCompanies.find(item => item.id === supplierId);
  return clone((company?.items ?? []).filter(item => item.group === 'Documents').map(item => ({ name: item.name, type: item.type, expiry: item.expiry, status: item.status })));
}

// Current standing per category for one supplier, used on the Supplier 360 page.
export function getSupplierQualification(actor: Actor, supplierId: string) {
  const mine = visibleQsls(actor).filter(qsl => qsl.supplierId === supplierId);
  const items = [...latestPerKey(mine).values()].map(qsl => ({
    id: qsl.id, qslNo: qsl.qslNo, category: qsl.category, scope: [qsl.enrollment?.scopeType ?? qsl.scopeType, qsl.enrollment?.scopeDetail ?? qsl.scopeDetail].filter(Boolean).join(' · '),
    result: qsl.result, standing: standingOf(qsl), validity: validityOf(qsl), listed: isEnrolled(qsl), effectiveDate: qsl.decision?.effectiveDate, expiryDate: qsl.decision?.expiryDate, level: qsl.enrollment?.level, skills: verifiedSkills(qsl),
  }));
  return clone({ items, open: mine.filter(isOpen).length });
}
