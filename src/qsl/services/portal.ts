import type { Actor, CommercialTerms, EvidenceLink, Level, PortalRole, Qsl, RateBasis, RateCardSubmission, RateLine, SkillOffer, Snapshot } from '../types.ts';
import { audit, clone, deepFreeze, getStore, nextId, nowIso, todayIso } from '../store.ts';
import { assertCan, assertView } from '../rbac.ts';
import { fail, requireValid } from '../errors.ts';
import { isIsoDate } from '../dates.ts';
import { getConfig } from '../../config/store.ts';
import { findQsl, getSnapshot } from './assessments.ts';
import { EVIDENCE_DOC_TYPES, MAX_RATE, portalStatusOf, type PortalStatus } from './portalModel.ts';

const scopeText = (qsl: Qsl) => [qsl.scopeType, qsl.scopeDetail].filter(Boolean).join(' · ');

// Skills the supplier is asked to rate, as the Portal receives them.
export function portalCriteria(snapshot: Snapshot) {
  const required = new Map(snapshot.form.data.sections.flatMap(section => section.items).map(item => [item.criteriaId, item.required]));
  return snapshot.criteria.map(item => ({
    id: item.id, source: item.kind === 'Standard' ? 'Central Standard' as const : 'Buyer Custom' as const, group: item.groupName, name: item.data.name, description: item.data.description,
    instructions: '', mandatory: required.get(item.id) ?? false, evidenceRequired: item.data.evidenceRequired, evidenceTypes: [] as string[],
  }));
}

export const ratingScaleOf = () => getConfig('qsl').ratingScale.map(item => ({ level: item.level, name: item.label, description: item.description }));

// IN payload: SLM -> Supplier Portal.
export function buildPortalRequest(qsl: Qsl) {
  const store = getStore();
  const snapshot = getSnapshot(qsl);
  const last = store.history.filter(item => item.qslId === qsl.id && !item.internal && item.kind === 'status').at(-1);
  const status = portalStatusOf(qsl) ?? 'Requested';
  const history: { status: PortalStatus; at: string; by: string; note?: string }[] = [{ status: 'Requested', at: qsl.submittedAt ?? qsl.createdAt, by: 'SLM' }];
  qsl.rateCards.forEach(card => history.push({ status: 'Submitted', at: card.submittedAt, by: card.submittedBy }));
  if (qsl.preReview) history.push({ status: 'Under Review', at: qsl.preReview.at, by: 'SLM' });
  if (!['Requested', 'Submitted', 'Under Review'].includes(status)) history.push({ status, at: last?.at ?? nowIso(), by: 'SLM' });
  return {
    id: qsl.portal.requestId, supplierId: qsl.supplierId, buyer: qsl.portal.buyer, productCategory: qsl.category, scope: scopeText(qsl),
    requestedAt: (qsl.submittedAt ?? qsl.createdAt).slice(0, 10), dueDate: qsl.dueDate ?? '', instructions: qsl.portal.instructions, currencies: qsl.portal.currencies, rateBases: qsl.portal.rateBases,
    ratingScale: ratingScaleOf(), criteria: portalCriteria(snapshot), requiredEvidence: qsl.portal.requiredEvidence, status, updated: (last?.at ?? qsl.submittedAt ?? qsl.createdAt).slice(0, 10), history,
  };
}

// ---------------------------------------------------------------- Rate card from the Supplier Portal (OUT: Portal -> SLM). Numbers arrive as strings.

export type RateCardInput = {
  ref?: string;
  version: number;
  infoRequestId?: string;
  submittedBy: string;
  role: PortalRole;
  terms: { currency: string; rateBasis: string; effectiveFrom: string; validUntil: string; leadTimeDays?: string; paymentTermsDays?: string; escalationPct?: string; overtimeWeekday?: string; overtimeHoliday?: string; notes?: string };
  skills: Record<string, { offered: 'Yes' | 'No' | ''; selfRating: string; comment?: string; lines: { id?: string; level: string; headcount: string; avgYears: string; rate: string }[] }>;
  evidence: { id?: string; targetId: string; docId: string; docName: string; docType: string; version: number; issue?: string; expiry?: string; fileNames?: string[]; note?: string }[];
  replies?: Record<string, string>;
  declaration: boolean;
};

const isInt = (value: string | undefined, min: number, max: number) => /^\d+$/.test((value ?? '').trim()) && Number(value) >= min && Number(value) <= max;
const isNumber = (value: string | undefined, min: number, max: number) => /^\d+(\.\d{1,2})?$/.test((value ?? '').trim()) && Number(value) >= min && Number(value) <= max;
const isMoney = (value: string | undefined) => isNumber(value, 0.01, MAX_RATE);
const optional = (value: string | undefined) => (value?.trim() ? Number(value) : undefined);

function validateRateCard(qsl: Qsl, snapshot: Snapshot, input: RateCardInput): string[] {
  const errors: string[] = [];
  const scale = ratingScaleOf().map(item => item.level as number);
  const criteria = portalCriteria(snapshot);
  const terms = input.terms;
  if (input.role === 'Supplier Viewer') errors.push('A viewer cannot submit a rate card');
  if (input.version !== qsl.rateCards.length + 1) errors.push(`Submission version must be ${qsl.rateCards.length + 1}; version ${input.version} was already received or skips ahead`);
  if (!qsl.portal.currencies.includes(terms.currency)) errors.push('Currency is not one of the currencies requested');
  if (!qsl.portal.rateBases.includes(terms.rateBasis as RateBasis)) errors.push('Rate basis is not one of the rate bases requested');
  if (!isIsoDate(terms.effectiveFrom)) errors.push('Rates effective from must be a date (YYYY-MM-DD)');
  if (!isIsoDate(terms.validUntil)) errors.push('Rates valid until must be a date (YYYY-MM-DD)');
  else if (isIsoDate(terms.effectiveFrom) && terms.validUntil < terms.effectiveFrom) errors.push('Rates valid until cannot be before the effective date');
  if (terms.leadTimeDays && !isInt(terms.leadTimeDays, 0, 365)) errors.push('Mobilisation lead time must be a whole number from 0 to 365');
  if (terms.paymentTermsDays && !isInt(terms.paymentTermsDays, 0, 365)) errors.push('Payment terms must be a whole number from 0 to 365');
  if (terms.escalationPct && !isNumber(terms.escalationPct, 0, 100)) errors.push('Annual rate escalation must be 0 to 100');
  for (const [label, value] of [['Overtime multiplier (working day)', terms.overtimeWeekday], ['Overtime multiplier (holiday)', terms.overtimeHoliday]] as const) {
    if (value && !isNumber(value, 1, 5)) errors.push(`${label} must be 1 to 5`);
  }
  if ((terms.notes ?? '').length > 5000) errors.push('Other terms and conditions are limited to 5000 characters');

  Object.keys(input.skills).forEach(id => { if (!criteria.some(item => item.id === id)) errors.push(`Skill ${id} is not part of this request`); });
  for (const item of criteria) {
    const skill = input.skills[item.id];
    if (!skill || !skill.offered) { errors.push(`${item.name}: select Yes or No`); continue; }
    if ((skill.comment ?? '').length > 2000) errors.push(`${item.name}: comment is limited to 2000 characters`);
    if (skill.offered === 'No') { if (item.mandatory) errors.push(`${item.name}: this skill is mandatory for this request`); continue; }
    if (!/^\d+$/.test(skill.selfRating) || !scale.includes(Number(skill.selfRating))) errors.push(`${item.name}: self-rating must be a level of the rating scale`);
    if (!skill.lines.length) errors.push(`${item.name}: add at least one rate line`);
    const seen = new Set<string>();
    for (const line of skill.lines) {
      if (!/^\d+$/.test(line.level) || !scale.includes(Number(line.level))) errors.push(`${item.name}: rate line level must be a level of the rating scale`);
      else if (seen.has(line.level)) errors.push(`${item.name}: level ${line.level} is listed twice`);
      seen.add(line.level);
      if (!isInt(line.headcount, 1, 100000)) errors.push(`${item.name}: headcount must be a whole number of 1 or more`);
      if (!isNumber(line.avgYears, 0, 60)) errors.push(`${item.name}: average years must be 0 to 60`);
      if (!isMoney(line.rate)) errors.push(`${item.name}: rate must be greater than 0 and at most ${MAX_RATE.toLocaleString('en-US')}`);
    }
    if (item.evidenceRequired && !input.evidence.some(ref => ref.targetId === item.id)) errors.push(`${item.name}: required evidence is not attached`);
  }
  for (const requirement of qsl.portal.requiredEvidence) {
    if (requirement.mandatory && !input.evidence.some(ref => ref.targetId === requirement.id)) errors.push(`${requirement.title}: required document is not attached`);
  }
  for (const ref of input.evidence) {
    if (!criteria.some(item => item.id === ref.targetId) && !qsl.portal.requiredEvidence.some(item => item.id === ref.targetId)) errors.push(`Evidence ${ref.docName} points to an unknown requirement`);
    if (!EVIDENCE_DOC_TYPES.includes(ref.docType)) errors.push(`Evidence ${ref.docName} has an unknown document type`);
    if (ref.expiry && ref.expiry < todayIso()) errors.push(`Evidence ${ref.docName} has expired`);
  }
  if (qsl.status === 'InfoRequested') {
    if (!input.infoRequestId || !Object.values(input.replies ?? {}).some(text => text.trim())) errors.push('Reply to the additional information request');
  }
  if (!input.declaration) errors.push('The supplier declaration must be confirmed');
  return errors;
}

// Stores a supplier rate card sent by the Portal. Self-ratings are kept as declared and never mixed with the verified rating.
export function submitRateCard(actor: Actor, id: string, input: RateCardInput): Qsl {
  assertCan(actor, 'qsl.fill');
  const qsl = findQsl(id);
  assertView(actor, qsl);
  if (qsl.status !== 'WaitingSupplier' && qsl.status !== 'InfoRequested') fail('INVALID_TRANSITION', 'A rate card can be received only while waiting for the supplier or when more information is requested');
  const snapshot = getSnapshot(qsl);
  requireValid(validateRateCard(qsl, snapshot, input), 'Rate card was not accepted');

  const parseLevel = (value: string) => Number(value) as Level;
  const terms: CommercialTerms = {
    currency: input.terms.currency, rateBasis: input.terms.rateBasis as RateBasis, effectiveFrom: input.terms.effectiveFrom, validUntil: input.terms.validUntil,
    leadTimeDays: optional(input.terms.leadTimeDays), paymentTermsDays: optional(input.terms.paymentTermsDays), escalationPct: optional(input.terms.escalationPct),
    overtimeWeekday: optional(input.terms.overtimeWeekday), overtimeHoliday: optional(input.terms.overtimeHoliday), notes: input.terms.notes?.trim() ?? '',
  };
  const skills: SkillOffer[] = Object.entries(input.skills).map(([criteriaId, skill]) => ({
    criteriaId, offered: skill.offered === 'Yes', selfRating: skill.offered === 'Yes' ? parseLevel(skill.selfRating) : undefined, comment: skill.comment?.trim() ?? '',
    lines: skill.offered === 'Yes' ? skill.lines.map((line): RateLine => ({ level: parseLevel(line.level), headcount: Number(line.headcount), avgYears: Number(line.avgYears), rate: Number(line.rate) })) : [],
  }));
  const evidence: EvidenceLink[] = input.evidence.map(ref => ({ id: ref.id ?? nextId('EVL'), targetId: ref.targetId, docId: ref.docId, docName: ref.docName, docType: ref.docType, version: ref.version, issue: ref.issue, expiry: ref.expiry, fileNames: ref.fileNames ?? [], note: ref.note ?? '' }));
  const version = qsl.rateCards.length + 1;
  const card: RateCardSubmission = {
    ref: input.ref ?? `QS-${qsl.portal.requestId.replace(/^QR-/, '')}-V${version}`, version, kind: version === 1 ? 'Initial' : 'Revision', revisesVersion: version > 1 ? version - 1 : undefined, infoRequestId: input.infoRequestId,
    submittedAt: nowIso(), submittedBy: input.submittedBy, role: input.role, terms, skills, evidence, replies: input.replies ?? {}, declaration: true,
  };
  qsl.rateCards.push(deepFreeze(card));

  // The round keeps one self-rating per skill group: the highest the supplier declared for any criteria in it.
  const groupOf = new Map(snapshot.criteria.map(item => [item.id, item.data.groupId]));
  const byGroup = new Map<string, Level>();
  skills.forEach(skill => {
    const group = groupOf.get(skill.criteriaId);
    if (group && skill.selfRating && skill.selfRating > (byGroup.get(group) ?? 0)) byGroup.set(group, skill.selfRating);
  });
  if (snapshot.useSkillLevel) byGroup.forEach((level, skillId) => { qsl.selfRatings = [...qsl.selfRatings.filter(item => item.skillId !== skillId), { skillId, level }]; });
  audit(actor, { action: 'Rate card received from Supplier Portal', recordType: 'Qsl', recordRef: qsl.qslNo, next: { ref: card.ref, version } });
  return clone(qsl);
}

// Requests for more information as the supplier sees them: the pre-review message and the assessor's corrections.
function portalInfoRequests(qsl: Qsl, names: [string, string][]) {
  const nameOf = new Map(names);
  const list: { id: string; requestedAt: string; from: string; message: string; items: { target: string; text: string }[]; status: 'Open' | 'Responded'; respondedAt?: string }[] = [];
  if (qsl.infoRequest) list.push({ id: 'info-review', requestedAt: qsl.infoRequest.requestedAt, from: 'Pre-qualification review', message: qsl.infoRequest.message, items: [{ target: 'General', text: qsl.infoRequest.message }], status: qsl.infoRequest.resolvedAt ? 'Responded' : 'Open', respondedAt: qsl.infoRequest.resolvedAt });
  if (qsl.corrections.length) {
    const resolved = qsl.corrections.every(item => item.resolvedAt);
    list.push({
      id: 'info-assessor', requestedAt: qsl.corrections.map(item => item.requestedAt).sort()[0], from: 'Buyer assessor', message: 'Corrections requested on the submitted answers',
      items: qsl.corrections.map(item => ({ target: nameOf.get(item.criteriaId) ?? item.criteriaId, text: item.message })), status: resolved ? 'Responded' : 'Open',
      respondedAt: resolved ? qsl.corrections.map(item => item.resolvedAt!).sort().at(-1) : undefined,
    });
  }
  return list;
}

// Everything the detail page needs about the Portal exchange, with names resolved.
export function portalView(qsl: Qsl, snapshot: Snapshot | undefined) {
  const criteria = snapshot ? portalCriteria(snapshot) : [];
  const nameOf = (targetId: string) => criteria.find(item => item.id === targetId)?.name ?? qsl.portal.requiredEvidence.find(item => item.id === targetId)?.title ?? 'General';
  const scale = ratingScaleOf();
  const levelName = (level?: number) => scale.find(item => item.level === level)?.name ?? '—';
  return {
    requestId: qsl.portal.requestId, buyer: qsl.portal.buyer, instructions: qsl.portal.instructions, currencies: qsl.portal.currencies, rateBases: qsl.portal.rateBases,
    portalStatus: portalStatusOf(qsl), requestedAt: qsl.submittedAt ?? qsl.createdAt, criteria, requiredEvidence: qsl.portal.requiredEvidence, ratingScale: scale,
    infoRequests: portalInfoRequests(qsl, criteria.map(item => [item.id, item.name])),
    rateCards: qsl.rateCards.map(card => ({
      ...card,
      skills: card.skills.map(skill => ({ ...skill, name: nameOf(skill.criteriaId), selfRatingName: levelName(skill.selfRating), lines: skill.lines.map(line => ({ ...line, levelName: levelName(line.level) })) })),
      evidence: card.evidence.map(ref => ({ ...ref, target: nameOf(ref.targetId) })),
      replyList: Object.entries(card.replies).map(([key, text]) => ({ key, text })),
    })),
  };
}
