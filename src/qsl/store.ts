import type {
  Actor, AssessmentForm, AuditEntry, Criteria, CriteriaGroup, HistoryEntry, HistoryKind, ProcessSettings, Qsl, QslUser, SettingsChange, Snapshot,
} from './types.ts';

const QSL_CATEGORIES = ['Food', 'Ingredient', 'Raw material'];

type Store = {
  categories: { name: string; active: boolean }[];
  users: QslUser[];
  settings: ProcessSettings;
  settingsHistory: SettingsChange[];
  criteriaGroups: CriteriaGroup[];
  criteria: Criteria[];
  forms: AssessmentForm[];
  qsls: Qsl[];
  snapshots: Snapshot[];
  history: HistoryEntry[];
  audit: AuditEntry[];
  counters: Record<string, number>;
};

// MOCK: users, default category per supplier and ASL status stand in for systems that are not connected yet.
const users: QslUser[] = [
  { id: 'USR-C1', name: 'Anong Sriwan', role: 'Coordinator' },
  { id: 'USR-C2', name: 'Marcus Patel', role: 'Coordinator' },
  { id: 'USR-A1', name: 'Daniel Okoye', role: 'Assessor' },
  { id: 'USR-A2', name: 'Mei Tanaka', role: 'Assessor' },
  { id: 'USR-V1', name: 'Elena Fischer', role: 'Verifier' },
  { id: 'USR-P1', name: 'Sofia Alvarez', role: 'Approver' },
  { id: 'USR-P2', name: 'Henrik Larsen', role: 'Approver' },
];

// PENDING CPF confirmation: defaults marked as default pending CPF confirmation in the spec.
const defaultSettings = (): ProcessSettings => ({
  coordinatorIds: ['USR-C1', 'USR-C2'],
  assessorIds: ['USR-A1', 'USR-A2'],
  approverIds: ['USR-P1', 'USR-P2'],
  separateAssessorApprover: true,
  decisionMethod: 'PassFail',
  useSkillLevel: true,
  validityMonthsByCategory: { Food: 12, Ingredient: 12, 'Raw material': 12 },
  reminderDays: 60,
  reassessmentTriggers: { 'Onboarding completed': false, 'Result near expiry': true, 'Risk level increased': false },
});

const supplierDefaultCategory: Record<string, string> = {
  'SUP-0012': 'Raw material', 'SUP-0034': 'Ingredient', 'SUP-0051': 'Food', 'SUP-0067': 'Raw material', 'SUP-0089': 'Ingredient', 'SUP-0103': 'Food', 'SUP-0118': 'Ingredient',
};

export const supplierCategory = (supplierId: string): string | undefined => supplierDefaultCategory[supplierId];

function createStore(): Store {
  return {
    categories: QSL_CATEGORIES.map(name => ({ name, active: true })),
    users: structuredClone(users), settings: defaultSettings(), settingsHistory: [],
    criteriaGroups: [], criteria: [], forms: [], qsls: [], snapshots: [], history: [], audit: [], counters: {},
  };
}

let state: Store = createStore();
let revision = 0;
const listeners = new Set<() => void>();

export const getStore = () => state;
export const getRevision = () => revision;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(): void {
  revision += 1;
  listeners.forEach(listener => listener());
}

export function resetStore(): void {
  state = createStore();
  notify();
}

// The clock is injectable so history can be replayed and expiry can be tested.
let clock: (() => Date) | null = null;
export const setClock = (fn: (() => Date) | null) => { clock = fn; };
// Without a fake clock, timestamps still strictly increase so ordering comparisons never tie.
let lastMs = 0;
export const now = (): Date => {
  if (clock) return clock();
  lastMs = Math.max(Date.now(), lastMs + 1);
  return new Date(lastMs);
};
export const nowIso = (): string => now().toISOString();
export const todayIso = (): string => nowIso().slice(0, 10);

export function nextId(prefix: string): string {
  const next = (state.counters[prefix] ?? 0) + 1;
  state.counters[prefix] = next;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

export const clone = <T>(value: T): T => structuredClone(value);

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

export function audit(actor: Actor, entry: { action: string; recordType: string; recordRef: string; previous?: unknown; next?: unknown; remarks?: string }): void {
  state.audit.push(deepFreeze({
    id: nextId('AUD'), action: entry.action, recordType: entry.recordType, recordRef: entry.recordRef,
    previousValue: entry.previous === undefined ? null : clone(entry.previous), newValue: entry.next === undefined ? null : clone(entry.next),
    performedBy: actor.id, performedByRole: actor.role, performedAt: nowIso(), remarks: entry.remarks,
  }));
  notify();
}

// Timeline entry. Internal entries are hidden from supplier users; kind separates status changes and approvals for the history tab.
export function addHistory(actor: Actor, qslId: string, action: string, note?: string, internal = false, kind: HistoryKind = 'event'): void {
  state.history.push(deepFreeze({ id: nextId('HIS'), at: nowIso(), by: actor.id, byName: actor.name, role: actor.role, qslId, kind, action, note, internal }));
  notify();
}
