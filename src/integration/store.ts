import type { FieldMapping, RetryConfig, SupplierLink, SyncSettings, SystemConfig, SystemId, Transaction } from './types.ts';

// Endpoints are never hardcoded; live URLs come from the environment (VITE_*_URL) when a live adapter exists.
const envUrl = (key: string): string => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[key] ?? '';
};

const initialSystems = (): SystemConfig[] => [
  { id: 'SupplierMaster', name: 'External Supplier Master', purpose: 'Source of truth for supplier master data', mode: 'mock', enabled: true, baseUrl: envUrl('VITE_SUPPLIER_MASTER_URL'), authMethod: 'OAuth 2.0', failNext: 0 },
  { id: 'SupplierPortal', name: 'Supplier Portal', purpose: 'Supplier registration, task execution, sample and capability submissions', mode: 'mock', enabled: true, baseUrl: envUrl('VITE_SUPPLIER_PORTAL_URL'), authMethod: 'API key', failNext: 0 },
  { id: 'ESignature', name: 'E-signature system (existing)', purpose: 'Signing requests and signed document references; no signing engine in SLM', mode: 'mock', enabled: true, baseUrl: envUrl('VITE_ESIGNATURE_URL'), authMethod: 'OAuth 2.0', failNext: 0 },
  { id: 'NotificationService', name: 'Notification service', purpose: 'Event-driven email and in-app notifications', mode: 'mock', enabled: true, baseUrl: envUrl('VITE_NOTIFICATION_URL'), authMethod: 'API key', failNext: 0 },
];

const initialMappings = (): FieldMapping[] => [
  { entity: 'Supplier', slmField: 'externalSupplierId', externalField: 'supplier_id', direction: 'Inbound', owner: 'External Supplier Master' },
  { entity: 'Supplier', slmField: 'legalName', externalField: 'legal_name', direction: 'Inbound', owner: 'External Supplier Master' },
  { entity: 'Supplier', slmField: 'taxId', externalField: 'tax_id', direction: 'Inbound', owner: 'External Supplier Master' },
  { entity: 'Supplier', slmField: 'country', externalField: 'country_code', direction: 'Inbound', owner: 'External Supplier Master' },
  { entity: 'Supplier', slmField: 'status', externalField: 'vendor_status', direction: 'Both', owner: 'External Supplier Master' },
  { entity: 'Registration', slmField: 'registrationData', externalField: 'registration', direction: 'Inbound', owner: 'Supplier Portal' },
  { entity: 'Task', slmField: 'taskAssignment', externalField: 'task', direction: 'Outbound', owner: 'SLM' },
  { entity: 'Task', slmField: 'taskResponse', externalField: 'task_response', direction: 'Inbound', owner: 'Supplier Portal' },
  { entity: 'Sample', slmField: 'sampleRequest', externalField: 'sample_request', direction: 'Outbound', owner: 'SLM' },
  { entity: 'Sample', slmField: 'sampleResponse', externalField: 'sample_response', direction: 'Inbound', owner: 'Supplier Portal' },
  { entity: 'Capability', slmField: 'capabilitySubmission', externalField: 'capability', direction: 'Inbound', owner: 'Supplier Portal' },
  { entity: 'Capability', slmField: 'capabilityResult', externalField: 'capability_result', direction: 'Outbound', owner: 'SLM' },
  { entity: 'Qualification', slmField: 'qualificationResult', externalField: 'qualification_result', direction: 'Outbound', owner: 'SLM' },
  { entity: 'QSL', slmField: 'qslPublished', externalField: 'qsl_status', direction: 'Outbound', owner: 'SLM' },
];

export type IntegrationState = {
  systems: SystemConfig[];
  retry: RetryConfig;
  sync: SyncSettings;
  mappings: FieldMapping[];
  links: SupplierLink[];
  transactions: Transaction[];
  counter: number;
  duplicatesBlocked: number;
};

const freshState = (): IntegrationState => ({
  systems: initialSystems(),
  retry: { maxAttempts: 3, backoffSeconds: 60, autoRetry: false },
  sync: { supplierMasterIntervalMinutes: 60, portalPollIntervalMinutes: 5, conflictRule: 'External master wins' },
  mappings: initialMappings(),
  links: [],
  transactions: [],
  counter: 0,
  duplicatesBlocked: 0,
});

let state = freshState();
let revision = 0;
const listeners = new Set<() => void>();

export const getState = (): IntegrationState => state;
export const getRevision = () => revision;
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function notify(): void {
  revision += 1;
  listeners.forEach(listener => listener());
}
export function resetIntegration(): void {
  state = freshState();
  notify();
}
export const nowIso = () => new Date().toISOString();
export const systemOf = (id: SystemId): SystemConfig => state.systems.find(item => item.id === id)!;
