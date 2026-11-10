import { suppliers } from '../data/suppliers.ts';
import { sourcingStages } from './types.ts';
import type { ActivityFilter, SourcingActivity, SourcingActor, SourcingFilter, SourcingRecord, SourcingStage, SourcingSummary } from './types.ts';

export type SourcingErrorCode = 'VALIDATION' | 'DUPLICATE' | 'NOT_FOUND' | 'INVALID_TRANSITION';

export class SourcingError extends Error {
  code: SourcingErrorCode;
  constructor(code: SourcingErrorCode, message: string) {
    super(message);
    this.name = 'SourcingError';
    this.code = code;
  }
}

function fail(code: SourcingErrorCode, message: string): never {
  throw new SourcingError(code, message);
}

// MOCK identity: the project has no authentication yet.
export const currentSourcingUser: SourcingActor = { name: 'James Kim' };

export const sourcingTeam: string[] = [...new Set(suppliers.map(item => item.owner))].sort();

let records: SourcingRecord[] = [];
let activities: SourcingActivity[] = [];
let counter = 0;
let seeded = false;
let revision = 0;
const listeners = new Set<() => void>();

export const getRevision = () => revision;
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };

export function resetSourcing(): void {
  records = [];
  activities = [];
  counter = 0;
  seeded = true;
  notify();
}

const nowIso = () => new Date().toISOString();
const supplierOf = (supplierId: string) => suppliers.find(item => item.id === supplierId) ?? fail('NOT_FOUND', `Supplier ${supplierId} not found`);
const findRecord = (supplierId: string) => records.find(item => item.supplierId === supplierId) ?? fail('NOT_FOUND', 'This supplier is not in sourcing');

// Selected and Not Selected are the two outcomes of the same step.
const rank = (stage: SourcingStage) => (stage === 'Not Selected' ? sourcingStages.indexOf('Selected') : sourcingStages.indexOf(stage));

const isBackward = (from: SourcingStage, to: SourcingStage) => rank(to) < rank(from);
export const requiresReason = (from: SourcingStage, to: SourcingStage) => to === 'Not Selected' || isBackward(from, to);
const isInProgress = (stage: SourcingStage) => stage === 'Interested' || stage === 'Shortlisted' || stage === 'Under Review';

function log(entry: Omit<SourcingActivity, 'id' | 'at'>, at = nowIso()): SourcingActivity {
  counter += 1;
  const activity: SourcingActivity = { id: `SRC-${String(counter).padStart(4, '0')}`, at, ...entry, note: entry.note || undefined };
  activities.push(activity);
  return activity;
}

// ---------------------------------------------------------------- Commands

export type MarkInterestedInput = { assignee?: string; note?: string };

export function markInterested(actor: SourcingActor, supplierId: string, input: MarkInterestedInput = {}): SourcingRecord {
  const supplier = supplierOf(supplierId);
  if (records.some(item => item.supplierId === supplierId)) fail('DUPLICATE', 'This supplier is already in sourcing');
  const assignee = (input.assignee ?? supplier.owner).trim();
  if (!assignee) fail('VALIDATION', 'Choose who is responsible for this supplier');
  const activity = log({ supplierId, by: actor.name, action: 'Marked as interested', to: 'Interested', assignee, note: input.note?.trim() });
  const record: SourcingRecord = { supplierId, stage: 'Interested', assignee, interestedBy: actor.name, interestedAt: activity.at, updatedAt: activity.at };
  records.push(record);
  notify();
  return structuredClone(record);
}

export function changeStage(actor: SourcingActor, supplierId: string, to: SourcingStage, input: { reason?: string } = {}): SourcingRecord {
  const record = findRecord(supplierId);
  if (!sourcingStages.includes(to)) fail('VALIDATION', 'Unknown sourcing stage');
  if (record.stage === to) fail('INVALID_TRANSITION', `The supplier is already ${to}`);
  const reason = (input.reason ?? '').trim();
  if (requiresReason(record.stage, to) && !reason) fail('VALIDATION', to === 'Not Selected' ? 'A reason is required to mark a supplier as Not Selected' : 'A reason is required to move a supplier back');
  const activity = log({ supplierId, by: actor.name, action: 'Stage changed', from: record.stage, to, note: reason });
  record.stage = to;
  record.updatedAt = activity.at;
  notify();
  return structuredClone(record);
}

export function assignSourcing(actor: SourcingActor, supplierId: string, assignee: string): SourcingRecord {
  const record = findRecord(supplierId);
  const next = assignee.trim();
  if (!next) fail('VALIDATION', 'Choose who is responsible for this supplier');
  if (record.assignee === next) fail('INVALID_TRANSITION', 'This person is already responsible for the supplier');
  const activity = log({ supplierId, by: actor.name, action: 'Assigned', assignee: next, note: `Previously ${record.assignee}` });
  record.assignee = next;
  record.updatedAt = activity.at;
  notify();
  return structuredClone(record);
}

// The activity history is kept, so the supplier can still be recognised as handled before.
export function removeFromSourcing(actor: SourcingActor, supplierId: string, reason: string): void {
  const record = findRecord(supplierId);
  if (!reason.trim()) fail('VALIDATION', 'A reason is required to remove a supplier from sourcing');
  log({ supplierId, by: actor.name, action: 'Removed from sourcing', from: record.stage, note: reason.trim() });
  records = records.filter(item => item !== record);
  notify();
}

// ---------------------------------------------------------------- Queries

export function getSourcing(supplierId: string): SourcingRecord | undefined {
  const record = records.find(item => item.supplierId === supplierId);
  return record && structuredClone(record);
}

const matches = (supplierId: string, search?: string, extra = '') => {
  const tokens = (search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const supplier = suppliers.find(item => item.id === supplierId);
  const text = [supplierId, supplier?.name, supplier?.category, extra].join(' ').toLowerCase();
  return tokens.every(token => text.includes(token));
};

export function listSourcing(filter: SourcingFilter = {}): SourcingRecord[] {
  return records
    .filter(item => (!filter.stage || item.stage === filter.stage) && (!filter.assignee || item.assignee === filter.assignee) && matches(item.supplierId, filter.search, item.assignee))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(item => structuredClone(item));
}

export function getSourcingSummary(): SourcingSummary {
  const byStage = Object.fromEntries(sourcingStages.map(stage => [stage, records.filter(item => item.stage === stage).length])) as Record<SourcingStage, number>;
  return { total: records.length, inProgress: records.filter(item => isInProgress(item.stage)).length, byStage };
}

export function listActivity(filter: ActivityFilter = {}): SourcingActivity[] {
  return activities
    .filter(item => (!filter.supplierId || item.supplierId === filter.supplierId) && (!filter.action || item.action === filter.action) && matches(item.supplierId, filter.search, `${item.by} ${item.note ?? ''}`))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    .map(item => structuredClone(item));
}

// ---------------------------------------------------------------- Demo data

type Step = { daysAgo: number; by: string; to: SourcingStage; note?: string };

function seed(supplierId: string, assignee: string, steps: Step[]) {
  let current: SourcingStage | undefined;
  let first: SourcingActivity | undefined;
  let last: SourcingActivity | undefined;
  steps.forEach((step, index) => {
    const at = new Date(Date.now() - step.daysAgo * 86_400_000 - index * 60_000).toISOString();
    last = index === 0
      ? log({ supplierId, by: step.by, action: 'Marked as interested', to: 'Interested', assignee, note: step.note }, at)
      : log({ supplierId, by: step.by, action: 'Stage changed', from: current, to: step.to, note: step.note }, at);
    first ??= last;
    current = step.to;
  });
  if (first && last && current) records.push({ supplierId, stage: current, assignee, interestedBy: first.by, interestedAt: first.at, updatedAt: last.at });
}

export function ensureSourcingDemo(): void {
  if (seeded) return;
  seeded = true;
  seed('SUP-0012', 'S. Chen', [
    { daysAgo: 20, by: 'S. Chen', to: 'Interested' }, { daysAgo: 17, by: 'S. Chen', to: 'Shortlisted', note: 'Meets the alloy specification' },
    { daysAgo: 12, by: 'James Kim', to: 'Under Review' }, { daysAgo: 8, by: 'James Kim', to: 'Shortlisted', note: 'Waiting for an updated ISO certificate' },
    { daysAgo: 3, by: 'S. Chen', to: 'Under Review', note: 'Certificate received' },
  ]);
  seed('SUP-0034', 'M. Patel', [{ daysAgo: 9, by: 'M. Patel', to: 'Interested' }, { daysAgo: 5, by: 'M. Patel', to: 'Shortlisted', note: 'Strong sensor portfolio' }]);
  seed('SUP-0051', 'L. Torres', [{ daysAgo: 2, by: 'L. Torres', to: 'Interested', note: 'Packaging film alternative' }]);
  seed('SUP-0067', 'J. Kim', [
    { daysAgo: 40, by: 'J. Kim', to: 'Interested' }, { daysAgo: 36, by: 'J. Kim', to: 'Shortlisted' }, { daysAgo: 30, by: 'J. Kim', to: 'Under Review' },
    { daysAgo: 24, by: 'James Kim', to: 'Selected', note: 'Best price and quality record' },
  ]);
  seed('SUP-0103', 'K. Hansen', [
    { daysAgo: 33, by: 'K. Hansen', to: 'Interested' }, { daysAgo: 28, by: 'K. Hansen', to: 'Shortlisted' }, { daysAgo: 21, by: 'K. Hansen', to: 'Under Review' },
    { daysAgo: 14, by: 'James Kim', to: 'Selected', note: 'Qualification passed' },
  ]);
  seed('SUP-0118', 'R. Okafor', [
    { daysAgo: 26, by: 'R. Okafor', to: 'Interested' }, { daysAgo: 22, by: 'R. Okafor', to: 'Shortlisted' }, { daysAgo: 15, by: 'R. Okafor', to: 'Under Review' },
    { daysAgo: 10, by: 'James Kim', to: 'Not Selected', note: 'Compliance score below the threshold' },
  ]);
  seed('SUP-0124', 'S. Chen', [{ daysAgo: 14, by: 'S. Chen', to: 'Interested' }, { daysAgo: 11, by: 'S. Chen', to: 'Shortlisted' }, { daysAgo: 4, by: 'S. Chen', to: 'Under Review' }]);
  seed('SUP-0139', 'M. Patel', [{ daysAgo: 7, by: 'M. Patel', to: 'Interested' }, { daysAgo: 3, by: 'M. Patel', to: 'Shortlisted' }]);
  seed('SUP-0142', 'L. Torres', [
    { daysAgo: 35, by: 'L. Torres', to: 'Interested' }, { daysAgo: 30, by: 'L. Torres', to: 'Shortlisted' }, { daysAgo: 20, by: 'L. Torres', to: 'Under Review' },
    { daysAgo: 16, by: 'James Kim', to: 'Not Selected', note: 'Rejected at onboarding, high risk' },
  ]);
  notify();
}
