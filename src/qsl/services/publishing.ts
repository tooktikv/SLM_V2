import type { Actor, Qsl, ScopeType } from '../types.ts';
import { addHistory, audit, clone, getStore, nextId, nowIso, todayIso } from '../store.ts';
import { assertCan } from '../rbac.ts';
import { fail, requireValid } from '../errors.ts';
import { isIsoDate } from '../dates.ts';
import { getConfig } from '../../config/store.ts';
import { findQsl, isOpen, qualificationLevelOf, validateScope } from './assessments.ts';
import { isApproved } from './queries.ts';

export type EligibilityChecks = { qualification: boolean; capability: boolean; validity: boolean; noPendingCapability: boolean };
export type Eligibility = { checks: EligibilityChecks; eligible: boolean; reasons: string[] };

// QSL eligibility: Qualification Approved + relevant Capability Approved (+ still valid) for this supplier, category and scope.
export function checkEligibility(qsl: Qsl): Eligibility {
  const store = getStore();
  const reasons: string[] = [];
  const qualification = isApproved(qsl);
  if (!qualification) reasons.push(qsl.result === 'Fail' ? 'Qualification was rejected' : 'Qualification is not approved yet');
  const snapshot = store.snapshots.find(item => item.id === qsl.snapshotId);
  const needsRatings = !!snapshot?.useSkillLevel && snapshot.skills.length > 0;
  const capability = qualification && (!needsRatings || snapshot!.skills.every(skill => qsl.assessedRatings.some(item => item.skillId === skill.id)));
  if (qualification && !capability) reasons.push('Capability (skill rating) is not assessed and approved');
  const expiry = qsl.decision?.expiryDate;
  const validity = qualification && (!expiry || expiry >= todayIso());
  if (qualification && !validity) reasons.push('Qualification has expired; requalification is required');
  const blockedByPending = getConfig('qsl').pendingCapabilityInvalidatesApproved
    && store.qsls.some(other => other.id !== qsl.id && other.supplierId === qsl.supplierId && other.category === qsl.category && isOpen(other));
  if (blockedByPending) reasons.push('A new capability for this category is pending approval');
  const checks = { qualification, capability, validity, noPendingCapability: !blockedByPending };
  return { checks, eligible: qualification && capability && validity && !blockedByPending, reasons };
}

export type PublishInput = { scopeType?: ScopeType; scopeDetail?: string; effectiveDate?: string; expiryDate?: string };

// Everything that would stop this round from being published with the given input (eligibility and field checks).
export function validatePublish(id: string, input: PublishInput = {}): string[] {
  const qsl = findQsl(id);
  if (!isApproved(qsl)) return ['Only approved qualifications can be published'];
  if (qsl.enrollment && !qsl.enrollment.withdrawal) return ['This supplier is already published on the QSL'];
  const errors = [...checkEligibility(qsl).reasons];
  const scopeType = input.scopeType ?? qsl.scopeType;
  const scopeDetail = input.scopeDetail ?? qsl.scopeDetail;
  const effectiveDate = input.effectiveDate ?? qsl.decision!.effectiveDate;
  const expiryDate = input.expiryDate ?? qsl.decision!.expiryDate;
  errors.push(...validateScope(scopeType, scopeDetail));
  if (!isIsoDate(effectiveDate)) errors.push('Invalid effective date');
  else if (effectiveDate < qsl.decision!.effectiveDate) errors.push('QSL effective date cannot be before the qualification effective date');
  if (expiryDate && !isIsoDate(expiryDate)) errors.push('Invalid expiry date');
  else if (expiryDate && expiryDate <= effectiveDate) errors.push('QSL expiry date must be after the effective date');
  else if (expiryDate && qsl.decision!.expiryDate && expiryDate > qsl.decision!.expiryDate) errors.push('QSL expiry date cannot be after the qualification expiry date');
  return errors;
}

// Publishes an eligible approved round to the Qualified Supplier List (also used to republish after a withdrawal).
export function publishToQsl(actor: Actor, id: string, input: PublishInput = {}): Qsl {
  assertCan(actor, 'qsl.publish');
  const qsl = findQsl(id);
  if (!isApproved(qsl)) fail('INVALID_TRANSITION', 'Only approved qualifications can be published');
  if (qsl.enrollment && !qsl.enrollment.withdrawal) fail('DUPLICATE', 'This supplier is already published on the QSL');
  const errors = validatePublish(id, input);
  const eligibility = checkEligibility(qsl);
  if (!eligibility.eligible) fail('VALIDATION', `Not eligible for QSL: ${eligibility.reasons[0]}`, eligibility.reasons);
  requireValid(errors);
  const scopeType = input.scopeType ?? qsl.scopeType;
  const scopeDetail = input.scopeDetail ?? qsl.scopeDetail;
  const effectiveDate = input.effectiveDate ?? qsl.decision!.effectiveDate;
  const expiryDate = input.expiryDate ?? qsl.decision!.expiryDate;
  const previous = clone(qsl.enrollment);
  const at = nowIso();
  qsl.scopeType = scopeType;
  qsl.scopeDetail = scopeDetail;
  qsl.enrollment = {
    listingNo: nextId('QSL-L'), productCategory: qsl.category, scopeType, scopeDetail, level: qualificationLevelOf(qsl), enrolledAt: at, publishedBy: actor.name,
    effectiveDate, expiryDate, scopeHistory: [{ at, by: actor.name, scopeType, scopeDetail }],
  };
  audit(actor, { action: 'Published to QSL', recordType: 'Qsl', recordRef: qsl.qslNo, previous, next: qsl.enrollment });
  const portal = getConfig('qsl').publishToPortal ? ' · Supplier Portal notified' : '';
  addHistory(actor, qsl.id, 'Published to QSL', `${qsl.enrollment.listingNo} · ${scopeType}${scopeDetail ? `: ${scopeDetail}` : ''}${portal}`, false, 'status');
  return clone(qsl);
}

// Used after approval when the QSL rules say eligible suppliers are published without a separate step.
export function autoPublishIfConfigured(actor: Actor, id: string): Qsl | undefined {
  if (!getConfig('qsl').autoPublish) return undefined;
  const qsl = findQsl(id);
  return checkEligibility(qsl).eligible && !qsl.enrollment ? publishToQsl(actor, id) : undefined;
}

export function withdrawFromQsl(actor: Actor, id: string, reason: string): Qsl {
  assertCan(actor, 'monitoring.manage');
  const qsl = findQsl(id);
  if (!qsl.enrollment || qsl.enrollment.withdrawal) fail('INVALID_TRANSITION', 'This supplier is not published on the QSL');
  if (!reason?.trim()) fail('VALIDATION', 'Please enter the reason for withdrawal');
  qsl.enrollment!.withdrawal = { reason, by: actor.name, at: nowIso() };
  audit(actor, { action: 'Withdrawn from QSL', recordType: 'Qsl', recordRef: qsl.qslNo, next: { withdrawn: true }, remarks: reason });
  addHistory(actor, qsl.id, 'Withdrew from QSL', reason, false, 'status');
  return clone(qsl);
}
