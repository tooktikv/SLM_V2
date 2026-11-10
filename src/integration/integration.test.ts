import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IntegrationError, dispatch, getExternalSupplierId, getIntegrationSummary, getSupplierLink, guardMasterWrite, listTransactions, receive, registerInboundHandler, resetIntegration,
  resolveSupplierId, retryTransaction, testConnection, updateRetryConfig, updateSystem,
} from './index.ts';

const rejects = (code: string, fn: () => unknown) => assert.throws(fn, (error: unknown) => error instanceof IntegrationError && error.code === code, `expected ${code}`);

beforeEach(() => { resetIntegration(); });

describe('External Supplier ID reference', () => {
  it('maps SLM ids to external ids both ways and never overwrites master-owned fields', () => {
    const external = getExternalSupplierId('SUP-0012')!;
    assert.match(external, /^EXT-/);
    assert.equal(resolveSupplierId(external), 'SUP-0012');
    assert.equal(getSupplierLink('SUP-0012')?.syncStatus, 'Synced');
    rejects('MASTER_OWNED', () => guardMasterWrite('taxId'));
    assert.doesNotThrow(() => guardMasterWrite('taskAssignment'));
  });
});

describe('Outbound transactions', () => {
  it('carries the contract fields and blocks duplicate submissions', () => {
    const tx = dispatch({ entityType: 'TaskAssignment', supplierId: 'SUP-0012', internalRef: 'TASK-1', revision: '1' });
    assert.equal(tx.status, 'Processed');
    assert.deepEqual([tx.sourceSystem, tx.targetSystem, tx.externalSupplierId, tx.internalRef, tx.revision], ['SLM', 'SupplierPortal', getExternalSupplierId('SUP-0012'), 'TASK-1', '1']);
    assert.match(tx.transactionId, /^TX-\d{6}$/);
    assert.ok(tx.submittedAt && tx.lastUpdatedAt);
    const again = dispatch({ entityType: 'TaskAssignment', supplierId: 'SUP-0012', internalRef: 'TASK-1', revision: '1' });
    assert.equal(again.transactionId, tx.transactionId);
    assert.equal(listTransactions().length, 1);
    assert.equal(getIntegrationSummary().duplicatesBlocked, 1);
    dispatch({ entityType: 'TaskAssignment', supplierId: 'SUP-0012', internalRef: 'TASK-1', revision: '2' });
    assert.equal(listTransactions().length, 2, 'a new revision is a new transaction');
  });

  it('logs failures, retries up to the limit and routes e-signature and notifications to their systems', () => {
    updateSystem('SupplierPortal', { failNext: 2 });
    updateRetryConfig({ maxAttempts: 2 });
    const tx = dispatch({ entityType: 'QualificationResult', supplierId: 'SUP-0034', internalRef: 'QSL-1' });
    assert.equal(tx.status, 'Failed');
    assert.match(tx.error!, /timeout/);
    assert.equal(retryTransaction(tx.transactionId).status, 'Failed');
    rejects('VALIDATION', () => retryTransaction(tx.transactionId));
    updateRetryConfig({ maxAttempts: 3 });
    assert.equal(retryTransaction(tx.transactionId).status, 'Processed');
    assert.equal(dispatch({ entityType: 'SigningRequest', supplierId: 'SUP-0034', internalRef: 'DOC-1' }).targetSystem, 'ESignature');
    assert.equal(dispatch({ entityType: 'Notification', supplierId: 'SUP-0034', internalRef: 'N-1' }).targetSystem, 'NotificationService');
    rejects('VALIDATION', () => dispatch({ entityType: 'TaskResponse', supplierId: 'SUP-0034' }));
    rejects('NOT_FOUND', () => dispatch({ entityType: 'QslPublished', supplierId: 'SUP-9999' }));
  });

  it('fails clearly when a system is disabled or set to live without an adapter', () => {
    updateSystem('SupplierPortal', { enabled: false });
    assert.match(dispatch({ entityType: 'SampleRequest', supplierId: 'SUP-0012', internalRef: 'S-1' }).error!, /disabled/);
    updateSystem('SupplierPortal', { enabled: true, mode: 'live' });
    assert.equal(testConnection('SupplierPortal').ok, false);
    rejects('VALIDATION', () => updateSystem('SupplierPortal', { baseUrl: 'ftp://x' }));
  });
});

describe('Inbound transactions', () => {
  it('resolves the supplier, runs handlers, ignores repeated transaction ids and rejects unknown suppliers', () => {
    const seen: string[] = [];
    registerInboundHandler('TaskResponse', tx => { seen.push(tx.internalRef ?? ''); });
    const tx = receive({ entityType: 'TaskResponse', externalSupplierId: getExternalSupplierId('SUP-0051')!, transactionId: 'PORTAL-77', payload: { done: true } });
    assert.equal(tx.status, 'Processed');
    assert.deepEqual(seen, ['SUP-0051']);
    receive({ entityType: 'TaskResponse', externalSupplierId: getExternalSupplierId('SUP-0051')!, transactionId: 'PORTAL-77' });
    assert.equal(listTransactions({ direction: 'Inbound' }).length, 1);
    assert.equal(receive({ entityType: 'SupplierProfile', externalSupplierId: 'EXT-000000' }).status, 'Rejected');
    registerInboundHandler('ConsentRecord', () => { throw new Error('Schema mismatch'); });
    const failed = receive({ entityType: 'ConsentRecord', externalSupplierId: getExternalSupplierId('SUP-0051')! });
    assert.deepEqual([failed.status, failed.error], ['Failed', 'Schema mismatch']);
    assert.equal(listTransactions({ errorsOnly: true }).length, 2);
    rejects('VALIDATION', () => receive({ entityType: 'TaskAssignment', externalSupplierId: 'EXT-1' }));
    rejects('VALIDATION', () => receive({ entityType: 'TaskResponse', externalSupplierId: ' ' }));
  });
});
