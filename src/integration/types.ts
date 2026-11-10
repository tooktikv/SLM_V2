// Shared integration contract between SLM and the Supplier Portal / external systems.
export type SystemId = 'SLM' | 'SupplierPortal' | 'SupplierMaster' | 'ESignature' | 'NotificationService';
export type Direction = 'Outbound' | 'Inbound';

export type EntityType =
  | 'SupplierRegistration' | 'SupplierProfile' | 'TaskAssignment' | 'TaskResponse' | 'ReviewResult' | 'SampleRequest' | 'SampleResponse'
  | 'CapabilitySubmission' | 'CapabilityResult' | 'QuestionnaireResponse' | 'DocumentSubmission' | 'ConsentRecord' | 'ElearningCompletion'
  | 'QualificationResult' | 'QslPublished' | 'Notification' | 'SigningRequest' | 'SigningStatus' | 'SupplierMasterSync';

export const OUTBOUND_ENTITIES: EntityType[] = ['TaskAssignment', 'ReviewResult', 'SampleRequest', 'CapabilityResult', 'QualificationResult', 'QslPublished', 'Notification', 'SigningRequest'];
export const INBOUND_ENTITIES: EntityType[] = [
  'SupplierRegistration', 'SupplierProfile', 'TaskResponse', 'SampleResponse', 'CapabilitySubmission', 'QuestionnaireResponse', 'DocumentSubmission',
  'ConsentRecord', 'ElearningCompletion', 'SigningStatus', 'SupplierMasterSync',
];

export type TxStatus = 'Pending' | 'Processed' | 'Failed' | 'Retrying' | 'Rejected';

// Every transaction carries the fields required by the integration contract.
export type Transaction = {
  transactionId: string;
  direction: Direction;
  entityType: EntityType;
  sourceSystem: SystemId;
  targetSystem: SystemId;
  externalSupplierId: string;
  internalRef?: string;
  revision?: string;
  submittedAt: string;
  lastUpdatedAt: string;
  status: TxStatus;
  attempts: number;
  idempotencyKey: string;
  error?: string;
  payload: Record<string, unknown>;
};

export type SystemConfig = {
  id: SystemId;
  name: string;
  purpose: string;
  mode: 'mock' | 'live';
  enabled: boolean;
  baseUrl: string;
  authMethod: 'None' | 'API key' | 'OAuth 2.0' | 'Mutual TLS';
  lastActivityAt?: string;
  failNext: number;
};

export type RetryConfig = { maxAttempts: number; backoffSeconds: number; autoRetry: boolean };
export type SyncSettings = { supplierMasterIntervalMinutes: number; portalPollIntervalMinutes: number; conflictRule: 'External master wins' };

// SLM may reference but never overwrite fields owned by the external Supplier Master.
export type FieldMapping = { entity: string; slmField: string; externalField: string; direction: 'Inbound' | 'Outbound' | 'Both'; owner: 'External Supplier Master' | 'Supplier Portal' | 'SLM' };

export type SupplierLink = { supplierId: string; externalSupplierId: string; syncStatus: 'Synced' | 'Pending' | 'Error'; lastSyncedAt?: string; error?: string };
