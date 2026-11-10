import { suppliers } from '../data/suppliers.ts';
import { getState, nowIso, notify, systemOf } from './store.ts';
import { INBOUND_ENTITIES, OUTBOUND_ENTITIES } from './types.ts';
import type { Direction, EntityType, RetryConfig, SupplierLink, SyncSettings, SystemConfig, SystemId, Transaction, TxStatus } from './types.ts';

export type IntegrationErrorCode = 'VALIDATION' | 'DUPLICATE' | 'MASTER_OWNED' | 'NOT_FOUND';

export class IntegrationError extends Error {
  code: IntegrationErrorCode;
  constructor(code: IntegrationErrorCode, message: string) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
  }
}

function fail(code: IntegrationErrorCode, message: string): never {
  throw new IntegrationError(code, message);
}

// ---------------------------------------------------------------- External Supplier ID references

// Mock rule: EXT-1 + the numeric part of the SLM id. A live adapter replaces this with the master's own identifier.
const mockExternalId = (supplierId: string) => `EXT-1${supplierId.replace(/\D/g, '').padStart(5, '0')}`;

function ensureLinks(): SupplierLink[] {
  const state = getState();
  if (!state.links.length) {
    state.links = suppliers.map(item => ({
      supplierId: item.id, externalSupplierId: mockExternalId(item.id), syncStatus: item.status === 'Draft' ? 'Pending' : 'Synced', lastSyncedAt: item.status === 'Draft' ? undefined : nowIso(),
    }));
  }
  return state.links;
}

export const getSupplierLink = (supplierId: string): SupplierLink | undefined => ensureLinks().find(item => item.supplierId === supplierId);
export const getExternalSupplierId = (supplierId: string): string | undefined => getSupplierLink(supplierId)?.externalSupplierId;
export const resolveSupplierId = (externalSupplierId: string): string | undefined => ensureLinks().find(item => item.externalSupplierId === externalSupplierId)?.supplierId;

export function guardMasterWrite(field: string): void {
  const owned = getState().mappings.find(item => item.slmField === field && item.owner === 'External Supplier Master');
  if (owned) fail('MASTER_OWNED', `"${field}" is owned by the External Supplier Master and cannot be overwritten by SLM`);
}

// ---------------------------------------------------------------- Transactions

const nextTransactionId = () => {
  const state = getState();
  state.counter += 1;
  return `TX-${String(state.counter).padStart(6, '0')}`;
};

const keyOf = (entityType: EntityType, supplierId: string, internalRef?: string, revision?: string) => [entityType, supplierId, internalRef ?? '', revision ?? ''].join('|');

// Mock adapter: no network call is made. A live adapter would replace this function.
function deliver(tx: Transaction, target: SystemConfig): void {
  const state = getState();
  tx.attempts += 1;
  tx.lastUpdatedAt = nowIso();
  target.lastActivityAt = tx.lastUpdatedAt;
  if (!target.enabled) { tx.status = 'Failed'; tx.error = `${target.name} is disabled`; }
  else if (target.mode === 'live') { tx.status = 'Failed'; tx.error = 'Live adapter is not implemented in this prototype'; }
  else if (target.failNext > 0) { target.failNext -= 1; tx.status = 'Failed'; tx.error = `Simulated timeout from ${target.name}`; }
  else { tx.status = 'Processed'; tx.error = undefined; }
  if (state.retry.autoRetry && tx.status === 'Failed' && tx.attempts < state.retry.maxAttempts) tx.status = 'Retrying';
  notify();
}

const defaultTarget = (entityType: EntityType): SystemId => (entityType === 'SigningRequest' ? 'ESignature' : entityType === 'Notification' ? 'NotificationService' : 'SupplierPortal');

export type DispatchInput = { entityType: EntityType; supplierId: string; internalRef?: string; revision?: string; payload?: Record<string, unknown>; target?: SystemId };

// SLM -> external system. The same entity + reference + revision is never sent twice.
export function dispatch(input: DispatchInput): Transaction {
  const state = getState();
  if (!OUTBOUND_ENTITIES.includes(input.entityType)) fail('VALIDATION', `${input.entityType} is not an outbound entity`);
  const externalSupplierId = getExternalSupplierId(input.supplierId) ?? fail('NOT_FOUND', `No External Supplier ID for ${input.supplierId}`);
  const key = keyOf(input.entityType, input.supplierId, input.internalRef, input.revision);
  const existing = state.transactions.find(item => item.idempotencyKey === key && item.direction === 'Outbound');
  if (existing) {
    state.duplicatesBlocked += 1;
    notify();
    if (existing.status === 'Failed') return retryTransaction(existing.transactionId);
    return existing;
  }
  const target = systemOf(input.target ?? defaultTarget(input.entityType));
  const now = nowIso();
  const tx: Transaction = {
    transactionId: nextTransactionId(), direction: 'Outbound', entityType: input.entityType, sourceSystem: 'SLM', targetSystem: target.id, externalSupplierId, internalRef: input.internalRef,
    revision: input.revision, submittedAt: now, lastUpdatedAt: now, status: 'Pending', attempts: 0, idempotencyKey: key, payload: input.payload ?? {},
  };
  state.transactions.push(tx);
  deliver(tx, target);
  return tx;
}

export function retryTransaction(transactionId: string): Transaction {
  const state = getState();
  const tx = state.transactions.find(item => item.transactionId === transactionId) ?? fail('NOT_FOUND', `Transaction ${transactionId} not found`);
  if (tx.direction !== 'Outbound') fail('VALIDATION', 'Only outbound transactions can be retried');
  if (tx.status !== 'Failed' && tx.status !== 'Retrying') fail('VALIDATION', 'Only failed transactions can be retried');
  if (tx.attempts >= state.retry.maxAttempts) fail('VALIDATION', `Maximum attempts (${state.retry.maxAttempts}) reached`);
  tx.status = 'Retrying';
  deliver(tx, systemOf(tx.targetSystem));
  return tx;
}

export type InboundHandler = (tx: Transaction) => void;
const handlers = new Map<EntityType, InboundHandler>();
export const registerInboundHandler = (entityType: EntityType, handler: InboundHandler) => { handlers.set(entityType, handler); };

export type ReceiveInput = { entityType: EntityType; externalSupplierId: string; transactionId?: string; internalRef?: string; revision?: string; payload?: Record<string, unknown>; sourceSystem?: SystemId };

// External system -> SLM. Unknown suppliers are rejected and logged; repeated transaction ids are ignored.
export function receive(input: ReceiveInput): Transaction {
  const state = getState();
  if (!INBOUND_ENTITIES.includes(input.entityType)) fail('VALIDATION', `${input.entityType} is not an inbound entity`);
  if (!input.externalSupplierId?.trim()) fail('VALIDATION', 'External Supplier ID is required');
  const duplicate = state.transactions.find(item => item.direction === 'Inbound' && (input.transactionId ? item.transactionId === input.transactionId : false));
  if (duplicate) { state.duplicatesBlocked += 1; notify(); return duplicate; }
  const supplierId = resolveSupplierId(input.externalSupplierId);
  const now = nowIso();
  const source = input.sourceSystem ?? (input.entityType === 'SupplierMasterSync' ? 'SupplierMaster' : input.entityType === 'SigningStatus' ? 'ESignature' : 'SupplierPortal');
  const tx: Transaction = {
    transactionId: input.transactionId ?? nextTransactionId(), direction: 'Inbound', entityType: input.entityType, sourceSystem: source, targetSystem: 'SLM', externalSupplierId: input.externalSupplierId,
    internalRef: input.internalRef ?? supplierId, revision: input.revision, submittedAt: now, lastUpdatedAt: now, status: 'Pending', attempts: 1,
    idempotencyKey: keyOf(input.entityType, supplierId ?? input.externalSupplierId, input.internalRef, input.revision), payload: input.payload ?? {},
  };
  state.transactions.push(tx);
  systemOf(source).lastActivityAt = now;
  if (!supplierId) { tx.status = 'Rejected'; tx.error = `Unknown External Supplier ID ${input.externalSupplierId}`; notify(); return tx; }
  try {
    handlers.get(input.entityType)?.(tx);
    tx.status = 'Processed';
  } catch (error) {
    tx.status = 'Failed';
    tx.error = error instanceof Error ? error.message : 'Handler error';
  }
  tx.lastUpdatedAt = nowIso();
  notify();
  return tx;
}

export type TransactionFilter = { direction?: Direction; status?: TxStatus; entityType?: EntityType; supplierId?: string; search?: string; errorsOnly?: boolean };

export function listTransactions(filter: TransactionFilter = {}): Transaction[] {
  const tokens = (filter.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const externalId = filter.supplierId ? getExternalSupplierId(filter.supplierId) : undefined;
  return getState().transactions
    .filter(tx => !filter.direction || tx.direction === filter.direction)
    .filter(tx => !filter.status || tx.status === filter.status)
    .filter(tx => !filter.entityType || tx.entityType === filter.entityType)
    .filter(tx => !filter.supplierId || tx.externalSupplierId === externalId)
    .filter(tx => !filter.errorsOnly || tx.status === 'Failed' || tx.status === 'Rejected' || tx.status === 'Retrying')
    .filter(tx => { const text = [tx.transactionId, tx.entityType, tx.externalSupplierId, tx.internalRef, tx.sourceSystem, tx.targetSystem, tx.error].join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); })
    .map(tx => ({ ...tx, payload: { ...tx.payload } }))
    .sort((a, b) => b.transactionId.localeCompare(a.transactionId));
}

export function getIntegrationSummary() {
  const state = getState();
  const count = (status: TxStatus) => state.transactions.filter(tx => tx.status === status).length;
  return { total: state.transactions.length, processed: count('Processed'), failed: count('Failed') + count('Retrying'), rejected: count('Rejected'), duplicatesBlocked: state.duplicatesBlocked, mockSystems: state.systems.filter(item => item.mode === 'mock').length, systems: state.systems.length };
}

// ---------------------------------------------------------------- Configuration

export const getSystems = (): SystemConfig[] => getState().systems.map(item => ({ ...item }));
export const getRetryConfig = (): RetryConfig => ({ ...getState().retry });
export const getSyncSettings = (): SyncSettings => ({ ...getState().sync });
export const getMappings = () => getState().mappings.map(item => ({ ...item }));

export function updateSystem(id: SystemId, patch: Partial<Pick<SystemConfig, 'mode' | 'enabled' | 'baseUrl' | 'authMethod' | 'failNext'>>): SystemConfig {
  const system = systemOf(id);
  if (patch.baseUrl !== undefined && patch.baseUrl.trim() && !/^https?:\/\//i.test(patch.baseUrl.trim())) fail('VALIDATION', 'Base URL must start with http:// or https://');
  if (patch.failNext !== undefined && (!Number.isInteger(patch.failNext) || patch.failNext < 0)) fail('VALIDATION', 'Simulated failures must be 0 or more');
  Object.assign(system, patch);
  notify();
  return { ...system };
}

export function updateRetryConfig(patch: Partial<RetryConfig>): RetryConfig {
  const next = { ...getState().retry, ...patch };
  if (!Number.isInteger(next.maxAttempts) || next.maxAttempts < 1 || next.maxAttempts > 10) fail('VALIDATION', 'Maximum attempts must be between 1 and 10');
  if (!Number.isFinite(next.backoffSeconds) || next.backoffSeconds < 0) fail('VALIDATION', 'Backoff must be 0 or more seconds');
  getState().retry = next;
  notify();
  return { ...next };
}

export function updateSyncSettings(patch: Partial<Pick<SyncSettings, 'supplierMasterIntervalMinutes' | 'portalPollIntervalMinutes'>>): SyncSettings {
  const next = { ...getState().sync, ...patch };
  if (!(next.supplierMasterIntervalMinutes >= 1) || !(next.portalPollIntervalMinutes >= 1)) fail('VALIDATION', 'Intervals must be at least 1 minute');
  getState().sync = next;
  notify();
  return { ...next };
}

export function testConnection(id: SystemId): { ok: boolean; mode: 'mock' | 'live'; message: string } {
  const system = systemOf(id);
  if (!system.enabled) return { ok: false, mode: system.mode, message: `${system.name} is disabled` };
  if (system.mode === 'live') return { ok: false, mode: 'live', message: system.baseUrl ? 'Live adapter is not implemented in this prototype' : 'No base URL configured' };
  return { ok: true, mode: 'mock', message: 'Mock adapter responded. No network call was made.' };
}

// ---------------------------------------------------------------- Demo data

let seeded = false;
export function ensureIntegrationDemo(): void {
  if (seeded) return;
  seeded = true;
  ensureLinks();
  const portal = systemOf('SupplierPortal');
  receive({ entityType: 'SupplierRegistration', externalSupplierId: mockExternalId('SUP-0089'), payload: { company: 'Vertex Systems', source: 'Supplier Portal registration' } });
  receive({ entityType: 'DocumentSubmission', externalSupplierId: mockExternalId('SUP-0034'), internalRef: 'DOC-ISO9001', revision: '2', payload: { type: 'ISO 9001 Certificate' } });
  receive({ entityType: 'SampleResponse', externalSupplierId: mockExternalId('SUP-0067'), internalRef: 'SMP-2026-004', payload: { delivery: 'Shipped, ETA 3 days' } });
  dispatch({ entityType: 'SampleRequest', supplierId: 'SUP-0034', internalRef: 'SMP-2026-007', payload: { product: 'Control board sample' } });
  portal.failNext = 1;
  dispatch({ entityType: 'QualificationResult', supplierId: 'SUP-0012', internalRef: 'QSL-2026-0004', revision: '1', payload: { result: 'Approved' } });
  receive({ entityType: 'SupplierProfile', externalSupplierId: 'EXT-199999', payload: { note: 'Profile update for an unknown supplier' } });
  notify();
}
