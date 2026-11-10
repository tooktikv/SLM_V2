import type { Actor, CertifiedSkillView, Level, ProcessStatus, Qsl } from '../types.ts';
import { clone, getStore, todayIso } from '../store.ts';
import { assertCan } from '../rbac.ts';
import { daysBetween } from '../dates.ts';
import { statusLabel } from '../labels.ts';
import { findSupplier, isOpen } from './assessments.ts';
import { checkEligibility, type EligibilityChecks } from './publishing.ts';
import { expiryOf, isApproved, isEnrolled, keyOf, latestEnrolled, latestPerKey, ownerOf, scopeLabel as scopeText, skillNames, toDirectory, validityOf, verifiedSkills, visibleQsls, type Standing } from './queries.ts';

// ---------------------------------------------------------------- 5.2 Eligibility

export type EligibilityState = 'Eligible' | 'NotEligible' | 'Published';
export type EligibilityRow = {
  id: string;
  qslNo: string;
  supplierId: string;
  supplierName: string;
  category: string;
  scopeType: string;
  scopeDetail: string;
  state: EligibilityState;
  withdrawn: boolean;
  checks: EligibilityChecks;
  reasons: string[];
  level?: Level;
  skills: CertifiedSkillView[];
  qualificationExpiry?: string;
  qualificationEffective?: string;
};

// One row per supplier + category + scope, judged on the newest decided round.
export function listEligibility(actor: Actor) {
  assertCan(actor, 'directory.view');
  const visible = visibleQsls(actor);
  const rows: EligibilityRow[] = [...latestPerKey(visible).values()].map(qsl => {
    const result = checkEligibility(qsl);
    const published = isEnrolled(qsl) && !qsl.enrollment!.withdrawal;
    return {
      id: qsl.id, qslNo: qsl.qslNo, supplierId: qsl.supplierId, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category,
      scopeType: qsl.enrollment?.scopeType ?? qsl.scopeType, scopeDetail: qsl.enrollment?.scopeDetail ?? qsl.scopeDetail,
      state: published ? 'Published' : result.eligible ? 'Eligible' : 'NotEligible', withdrawn: !!qsl.enrollment?.withdrawal, checks: result.checks, reasons: result.reasons,
      level: qsl.enrollment?.level, skills: verifiedSkills(qsl), qualificationExpiry: qsl.decision?.expiryDate, qualificationEffective: qsl.decision?.effectiveDate,
    };
  });
  const order: Record<EligibilityState, number> = { Eligible: 0, NotEligible: 1, Published: 2 };
  rows.sort((a, b) => order[a.state] - order[b.state] || a.supplierName.localeCompare(b.supplierName));
  const pending = visible.filter(isOpen).map(qsl => ({
    id: qsl.id, qslNo: qsl.qslNo, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category, scope: scopeText(qsl.scopeType, qsl.scopeDetail),
    waitingFor: qsl.status === 'WaitingVerification' ? 'Capability' as const : 'Qualification' as const, statusLabel: statusLabel[qsl.status], owner: ownerOf(qsl),
  }));
  const counts = { eligible: 0, notEligible: 0, published: 0, pending: pending.length };
  rows.forEach(row => { counts[row.state === 'Eligible' ? 'eligible' : row.state === 'NotEligible' ? 'notEligible' : 'published'] += 1; });
  return clone({ rows, pending, counts });
}

// ---------------------------------------------------------------- Overview for the QSL dashboard and the main Dashboard

export function getQslSummary(actor: Actor) {
  const rows = latestEnrolled(actor).map(toDirectory);
  const eligible = listEligibility(actor);
  const categories = new Map<string, number>();
  rows.filter(row => row.standing === 'Published' || row.standing === 'Expiring').forEach(row => categories.set(row.category, (categories.get(row.category) ?? 0) + 1));
  const count = (standing: Standing) => rows.filter(row => row.standing === standing).length;
  return clone({
    eligible: eligible.counts.eligible, published: count('Published') + count('Expiring'), expiring: count('Expiring'), suspended: count('Suspended'), expired: count('Expired'), withdrawn: count('Withdrawn'),
    pending: eligible.counts.pending, total: rows.length, byCategory: [...categories.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
  });
}

// ---------------------------------------------------------------- Activity (eligibility, publication and status history)

export type QslActivityKind = 'eligibility' | 'publication' | 'status';
const activityPrefixes: Record<QslActivityKind, string[]> = {
  eligibility: ['Approved', 'Rejected', 'Failed', 'Published to QSL'],
  publication: ['Published to QSL', 'Assigned qualification scope', 'Extended validity'],
  status: ['Published to QSL', 'Suspended', 'Reactivated', 'Withdrew from QSL'],
};

export function listQslActivity(actor: Actor, kind: QslActivityKind) {
  assertCan(actor, 'directory.view');
  const store = getStore();
  const visible = new Map(visibleQsls(actor).map(qsl => [qsl.id, qsl]));
  return clone(store.history
    .filter(entry => entry.kind === 'status' && visible.has(entry.qslId) && activityPrefixes[kind].some(prefix => entry.action.startsWith(prefix)))
    .map(entry => {
      const qsl = visible.get(entry.qslId)!;
      return { at: entry.at, qslId: qsl.id, qslNo: qsl.qslNo, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category, action: entry.action, note: entry.note, byName: entry.byName };
    })
    .sort((a, b) => b.at.localeCompare(a.at)));
}

// ---------------------------------------------------------------- 5.5 Reports

export type ReportKind = 'published' | 'category' | 'capability' | 'expiry' | 'status';
export type Report = { title: string; description: string; columns: string[]; rows: string[][] };

export function qslReport(actor: Actor, kind: ReportKind): Report {
  assertCan(actor, 'directory.view');
  const rows = latestEnrolled(actor).map(toDirectory);
  const scope = (row: { scopeType: string; scopeDetail: string }) => scopeText(row.scopeType, row.scopeDetail);
  switch (kind) {
    case 'published':
      return {
        title: 'Published supplier report', description: 'Suppliers currently on the Qualified Supplier List',
        columns: ['QSL ID', 'Supplier', 'Category', 'Scope', 'Level', 'Effective', 'Expiry', 'Status'],
        rows: rows.filter(row => row.standing === 'Published' || row.standing === 'Expiring').map(row => [row.listingNo, row.supplierName, row.category, scope(row), row.level ? `Level ${row.level}` : '—', row.effectiveDate ?? '—', row.expiryDate ?? '—', row.standing]),
      };
    case 'category': {
      const byCategory = new Map<string, string[]>();
      rows.filter(row => row.standing === 'Published' || row.standing === 'Expiring').forEach(row => byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row.supplierName]));
      return { title: 'Supplier by product category', description: 'Published suppliers grouped by product category', columns: ['Category', 'Suppliers', 'Supplier names'], rows: [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, names]) => [category, String(names.length), names.join(', ')]) };
    }
    case 'capability':
      return {
        title: 'Supplier by capability', description: 'Approved (centrally verified) skill ratings of published suppliers',
        columns: ['Capability / skill', 'Supplier', 'Category', 'Verified level'],
        rows: rows.filter(row => row.standing !== 'Withdrawn').flatMap(row => row.skills.map(skill => [skill.name, row.supplierName, row.category, `Level ${skill.level}`])).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
      };
    case 'expiry':
      return {
        title: 'QSL expiry report', description: 'Listings expiring within the reminder window or already expired',
        columns: ['Supplier', 'Category', 'Scope', 'Expiry', 'Days left', 'Status'],
        rows: rows.filter(row => row.standing === 'Expiring' || row.standing === 'Expired').sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')).map(row => [row.supplierName, row.category, scope(row), row.expiryDate ?? '—', row.daysLeft === undefined ? '—' : String(row.daysLeft), row.standing]),
      };
    case 'status': {
      const order: Standing[] = ['Published', 'Expiring', 'Suspended', 'Expired', 'Withdrawn'];
      return {
        title: 'QSL status report', description: 'Suppliers by QSL status',
        columns: ['Status', 'Suppliers', 'Supplier names'],
        rows: order.map(status => { const names = rows.filter(row => row.standing === status).map(row => `${row.supplierName} (${row.category})`); return [status, String(names.length), names.join(', ') || '—']; }),
      };
    }
  }
}

// ---------------------------------------------------------------- 13.7 Audit logs

export const listAuditLog = (actor: Actor) => {
  assertCan(actor, 'audit.view');
  return clone([...getStore().audit].sort((a, b) => b.performedAt.localeCompare(a.performedAt)));
};

export function listApprovalLog(actor: Actor) {
  assertCan(actor, 'audit.view');
  return clone(getStore().qsls.flatMap(qsl => qsl.approvals.map(entry => ({ ...entry, qslNo: qsl.qslNo, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category }))).sort((a, b) => b.at.localeCompare(a.at)));
}

export const listProcessSettingsHistory = (actor: Actor) => {
  assertCan(actor, 'audit.view');
  return clone([...getStore().settingsHistory].sort((a, b) => b.at.localeCompare(a.at)));
};

// ---------------------------------------------------------------- 4.2 Capability register

export type CapabilityStatus = 'Approved' | 'Expired' | 'Rejected' | 'Revision requested' | 'Pending central verification' | 'Pending buyer approval' | 'In assessment';
export type CapabilitySkill = { skillId: string; name: string; self?: Level; proposed?: Level; verified?: Level; action?: 'Confirmed' | 'Adjusted' };

const capabilityStatusOf = (qsl: Qsl): CapabilityStatus => {
  const status: ProcessStatus = qsl.status;
  if (status === 'Completed') return qsl.result === 'Fail' ? 'Rejected' : validityOf(qsl) === 'Expired' ? 'Expired' : 'Approved';
  if (status === 'InfoRequested') return 'Revision requested';
  if (status === 'WaitingVerification') return 'Pending central verification';
  if (status === 'WaitingApproval') return 'Pending buyer approval';
  return 'In assessment';
};

function capabilitySkills(qsl: Qsl): CapabilitySkill[] {
  const names = skillNames(qsl);
  const verification = qsl.verifications[qsl.verifications.length - 1];
  return [...names.entries()].map(([skillId, name]) => {
    const decision = verification?.decisions.find(item => item.skillId === skillId);
    return {
      skillId, name, self: qsl.selfRatings.find(item => item.skillId === skillId)?.level, proposed: qsl.proposedRatings.find(item => item.skillId === skillId)?.level,
      verified: decision?.verifiedLevel, action: decision?.action,
    };
  });
}

export type CapabilityRow = {
  id: string;
  qslNo: string;
  supplierId: string;
  supplierName: string;
  category: string;
  scope: string;
  round: number;
  status: CapabilityStatus;
  skills: CapabilitySkill[];
  validFrom?: string;
  validUntil?: string;
  daysLeft?: number;
  centralReview?: { by: string; at: string; adjusted: number };
  buyerApproval?: { by: string; at: string; decision: string };
};

function toCapability(qsl: Qsl): CapabilityRow {
  const verification = qsl.verifications[qsl.verifications.length - 1];
  const approval = qsl.approvals[qsl.approvals.length - 1];
  const expiry = qsl.decision?.expiryDate;
  return {
    id: qsl.id, qslNo: qsl.qslNo, supplierId: qsl.supplierId, supplierName: findSupplier(qsl.supplierId).name, category: qsl.category, scope: scopeText(qsl.scopeType, qsl.scopeDetail), round: qsl.round,
    status: capabilityStatusOf(qsl), skills: capabilitySkills(qsl), validFrom: isApproved(qsl) ? qsl.decision?.effectiveDate : undefined, validUntil: isApproved(qsl) ? expiryOf(qsl) ?? expiry : undefined,
    daysLeft: isApproved(qsl) && (expiryOf(qsl) ?? expiry) ? daysBetween(todayIso(), (expiryOf(qsl) ?? expiry)!) : undefined,
    centralReview: verification ? { by: verification.verifierName, at: verification.at, adjusted: verification.decisions.filter(item => item.action === 'Adjusted').length } : undefined,
    buyerApproval: approval && qsl.status === 'Completed' ? { by: approval.byName, at: approval.at, decision: approval.decision } : undefined,
  };
}

// The newest round (in progress or decided) per supplier + category + scope.
export function listCapabilities(actor: Actor, filter: { search?: string; category?: string; status?: CapabilityStatus } = {}) {
  assertCan(actor, 'directory.view');
  const newest = new Map<string, Qsl>();
  visibleQsls(actor).filter(qsl => qsl.status !== 'Draft' && qsl.status !== 'WaitingSupplier').forEach(qsl => {
    const current = newest.get(keyOf(qsl));
    if (!current || qsl.round > current.round || (qsl.round === current.round && qsl.createdAt > current.createdAt)) newest.set(keyOf(qsl), qsl);
  });
  const tokens = (filter.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const all = [...newest.values()].map(toCapability);
  const rows = all
    .filter(row => !filter.category || row.category === filter.category)
    .filter(row => !filter.status || row.status === filter.status)
    .filter(row => { const text = [row.supplierName, row.supplierId, row.category, row.scope, row.qslNo, ...row.skills.map(skill => skill.name)].join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); })
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  const counts: Partial<Record<CapabilityStatus, number>> = {};
  all.forEach(row => { counts[row.status] = (counts[row.status] ?? 0) + 1; });
  return clone({ rows, counts, total: all.length });
}

// Verified ratings of every round for the same supplier and category, newest first, with the change against the previous round.
export function getCapabilityHistory(actor: Actor, id: string) {
  assertCan(actor, 'directory.view');
  const base = visibleQsls(actor).find(qsl => qsl.id === id);
  if (!base) return clone([]);
  const rounds = visibleQsls(actor).filter(qsl => qsl.supplierId === base.supplierId && qsl.category === base.category && qsl.verifications.length > 0).sort((a, b) => a.round - b.round);
  const entries = rounds.map((qsl, index) => {
    const skills = capabilitySkills(qsl);
    const before = index > 0 ? capabilitySkills(rounds[index - 1]) : [];
    return {
      id: qsl.id, qslNo: qsl.qslNo, round: qsl.round, at: qsl.verifications[qsl.verifications.length - 1].at, status: capabilityStatusOf(qsl),
      skills: skills.map(skill => ({ ...skill, change: before.length && skill.verified !== undefined ? skill.verified - (before.find(item => item.skillId === skill.skillId)?.verified ?? skill.verified) : 0 })),
    };
  });
  return clone(entries.reverse());
}
