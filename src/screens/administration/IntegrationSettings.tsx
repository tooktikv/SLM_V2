import { useState } from 'react';
import {
  IntegrationError, getIntegrationSummary, getMappings, getRetryConfig, getSyncSettings, getSystems, listTransactions, retryTransaction, testConnection, updateRetryConfig, updateSyncSettings, updateSystem,
} from '../../integration';
import type { Direction, SystemConfig, SystemId, TxStatus } from '../../integration';
import { useIntegrationRevision } from '../../integration/useIntegration';
import { Badge, Button, Callout, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, HeadRow, Input, KpiCard, KpiGrid, SearchInput, SegmentedControl, Select, Table, TableContainer, Td, Toolbar, Tr, type Tone } from '../../components/ui';

type View = 'connections' | 'mapping' | 'sync' | 'logs';
const when = (value: string) => new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const statusTone: Record<TxStatus, Tone> = { Pending: 'info', Processed: 'success', Failed: 'danger', Retrying: 'warning', Rejected: 'danger' };
const message = (error: unknown) => (error instanceof IntegrationError || error instanceof Error ? error.message : 'Something went wrong');

function Connection({ system, onNotice }: { system: SystemConfig; onNotice: (text: string | null, tone?: 'danger' | 'success') => void }) {
  const [baseUrl, setBaseUrl] = useState(system.baseUrl);
  const run = (action: () => void, success: string) => { try { action(); onNotice(success, 'success'); } catch (error) { onNotice(message(error), 'danger'); } };
  const patch = (change: Parameters<typeof updateSystem>[1]) => run(() => { updateSystem(system.id as SystemId, change); }, `${system.name} updated`);
  return (
    <Card>
      <CardHeader title={system.name} description={system.purpose} actions={<Badge small tone={system.mode === 'mock' ? 'warning' : 'success'}>{system.mode === 'mock' ? 'Mock integration' : 'Live'}</Badge>} />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mode"><Select value={system.mode} onChange={event => patch({ mode: event.target.value as 'mock' | 'live' })}><option value="mock">Mock adapter</option><option value="live">Live API</option></Select></Field>
          <Field label="Authentication"><Select value={system.authMethod} onChange={event => patch({ authMethod: event.target.value as SystemConfig['authMethod'] })}>{['None', 'API key', 'OAuth 2.0', 'Mutual TLS'].map(item => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Base URL" hint="Not hardcoded. Defaults come from the environment." className="sm:col-span-2">
            <Input value={baseUrl} placeholder="https://" onChange={event => setBaseUrl(event.target.value)} onBlur={() => { if (baseUrl !== system.baseUrl) patch({ baseUrl }); }} />
          </Field>
          {system.mode === 'mock' && <Field label="Simulate next failures" hint="Mock only. Used to test retry and error logs."><Input type="number" min={0} value={system.failNext} onChange={event => patch({ failNext: Number(event.target.value) })} /></Field>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3">
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={system.enabled} onChange={event => patch({ enabled: event.target.checked })} />Enabled</label>
          <div className="flex items-center gap-3">
            {system.lastActivityAt && <span className="text-caption text-ink-muted">Last activity {when(system.lastActivityAt)}</span>}
            <Button onClick={() => { const result = testConnection(system.id as SystemId); onNotice(`${system.name}: ${result.message}`, result.ok ? 'success' : 'danger'); }}>Test connection</Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function SyncAndRetry({ onNotice }: { onNotice: (text: string | null, tone?: 'danger' | 'success') => void }) {
  const sync = getSyncSettings();
  const retry = getRetryConfig();
  const [master, setMaster] = useState(String(sync.supplierMasterIntervalMinutes));
  const [portal, setPortal] = useState(String(sync.portalPollIntervalMinutes));
  const [attempts, setAttempts] = useState(String(retry.maxAttempts));
  const [backoff, setBackoff] = useState(String(retry.backoffSeconds));
  const [auto, setAuto] = useState(retry.autoRetry);
  const save = () => {
    try {
      updateSyncSettings({ supplierMasterIntervalMinutes: Number(master), portalPollIntervalMinutes: Number(portal) });
      updateRetryConfig({ maxAttempts: Number(attempts), backoffSeconds: Number(backoff), autoRetry: auto });
      onNotice('Synchronization and retry settings saved', 'success');
    } catch (error) { onNotice(message(error), 'danger'); }
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Synchronization" description="How often SLM refreshes data from other systems" />
        <CardBody className="space-y-4">
          <Field label="Supplier Master refresh (minutes)"><Input type="number" min={1} value={master} onChange={event => setMaster(event.target.value)} /></Field>
          <Field label="Supplier Portal poll (minutes)"><Input type="number" min={1} value={portal} onChange={event => setPortal(event.target.value)} /></Field>
          <Field label="Conflict rule" hint="SLM never overwrites fields owned by the external Supplier Master."><Input value={sync.conflictRule} disabled /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Retry" description="Applies to outbound transactions that fail" />
        <CardBody className="space-y-4">
          <Field label="Maximum attempts"><Input type="number" min={1} max={10} value={attempts} onChange={event => setAttempts(event.target.value)} /></Field>
          <Field label="Backoff (seconds)"><Input type="number" min={0} value={backoff} onChange={event => setBackoff(event.target.value)} /></Field>
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={auto} onChange={event => setAuto(event.target.checked)} />Retry automatically (otherwise retry from the logs)</label>
        </CardBody>
      </Card>
      <div className="lg:col-span-2"><Button variant="primary" onClick={save}>Save settings</Button></div>
    </div>
  );
}

function Logs({ onNotice }: { onNotice: (text: string | null, tone?: 'danger' | 'success') => void }) {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<Direction | ''>('');
  const [status, setStatus] = useState<TxStatus | ''>('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const summary = getIntegrationSummary();
  const rows = listTransactions({ search, direction: direction || undefined, status: status || undefined, errorsOnly });
  const retry = (id: string) => { try { const tx = retryTransaction(id); onNotice(`${id}: ${tx.status}`, tx.status === 'Processed' ? 'success' : 'danger'); } catch (error) { onNotice(message(error), 'danger'); } };
  return (
    <div className="space-y-4">
      <KpiGrid cols={5}>
        <KpiCard size="md" label="Transactions" value={summary.total} />
        <KpiCard size="md" label="Processed" value={summary.processed} tone="success" />
        <KpiCard size="md" label="Failed / retrying" value={summary.failed} tone={summary.failed ? 'danger' : 'neutral'} />
        <KpiCard size="md" label="Rejected" value={summary.rejected} tone={summary.rejected ? 'danger' : 'neutral'} />
        <KpiCard size="md" label="Duplicates blocked" value={summary.duplicatesBlocked} />
      </KpiGrid>
      <Toolbar title="Integration logs">
        <SearchInput placeholder="Search transaction, supplier, entity, error" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search integration logs" />
        <Select aria-label="Direction" value={direction} onChange={event => setDirection(event.target.value as Direction | '')}><option value="">All directions</option><option value="Outbound">SLM → external</option><option value="Inbound">External → SLM</option></Select>
        <Select aria-label="Status" value={status} onChange={event => setStatus(event.target.value as TxStatus | '')}><option value="">All statuses</option>{(['Pending', 'Processed', 'Failed', 'Retrying', 'Rejected'] as TxStatus[]).map(item => <option key={item}>{item}</option>)}</Select>
        <label className="flex items-center gap-2 text-caption text-ink-soft"><Checkbox checked={errorsOnly} onChange={event => setErrorsOnly(event.target.checked)} />Error log only</label>
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={1100}>
            <HeadRow columns={['Transaction', 'Entity', 'Source → target', 'External Supplier ID', 'Internal ref / rev.', 'Submitted', 'Updated', 'Status', 'Attempts', 'Error', '']} />
            <tbody>{rows.map(tx => (
              <Tr key={tx.transactionId}>
                <Td className="font-mono text-caption">{tx.transactionId}</Td>
                <Td>{tx.entityType}</Td>
                <Td className="text-caption">{tx.sourceSystem} → {tx.targetSystem}</Td>
                <Td className="font-mono text-caption">{tx.externalSupplierId}</Td>
                <Td className="text-caption">{tx.internalRef ?? '—'}{tx.revision ? ` · r${tx.revision}` : ''}</Td>
                <Td className="text-caption">{when(tx.submittedAt)}</Td>
                <Td className="text-caption">{when(tx.lastUpdatedAt)}</Td>
                <Td><Badge small dot tone={statusTone[tx.status]}>{tx.status}</Badge></Td>
                <Td>{tx.attempts}</Td>
                <Td className="max-w-56 text-caption text-danger-700">{tx.error ?? '—'}</Td>
                <Td>{tx.direction === 'Outbound' && (tx.status === 'Failed' || tx.status === 'Retrying') && <Button size="xs" onClick={() => retry(tx.transactionId)}>Retry</Button>}</Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState title="No transactions match" />}
      </Card>
    </div>
  );
}

// Integration settings for the Supplier Portal, External Supplier Master, E-signature and Notification service. All adapters are mocks.
export default function IntegrationSettings() {
  useIntegrationRevision();
  const [view, setView] = useState<View>('connections');
  const [notice, setNotice] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null);
  const onNotice = (text: string | null, tone: 'danger' | 'success' = 'success') => setNotice(text ? { text, tone } : null);

  return (
    <div className="space-y-4">
      <SegmentedControl<View> label="Integration settings" value={view} onChange={next => { setView(next); setNotice(null); }} items={[
        { value: 'connections', label: 'Connections' }, { value: 'mapping', label: 'Data mapping' }, { value: 'sync', label: 'Sync & retry' }, { value: 'logs', label: 'Logs' },
      ]} />
      <Callout tone="info" compact>These integrations run on a mock adapter inside this prototype. No data leaves the browser until a live adapter is connected.</Callout>
      {notice && <Callout tone={notice.tone} title={notice.text} />}
      {view === 'connections' && <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{getSystems().map(system => <Connection key={`${system.id}-${system.baseUrl}`} system={system} onNotice={onNotice} />)}</div>}
      {view === 'mapping' && (
        <Card className="overflow-hidden">
          <CardHeader title="Data mapping" description="Fields owned by the External Supplier Master are read-only in SLM" />
          <TableContainer>
            <Table minWidth={760}>
              <HeadRow columns={['Entity', 'SLM field', 'External field', 'Direction', 'Owner', 'SLM can overwrite']} />
              <tbody>{getMappings().map(item => (
                <Tr key={`${item.entity}-${item.slmField}`}>
                  <Td>{item.entity}</Td><Td className="font-mono text-caption">{item.slmField}</Td><Td className="font-mono text-caption">{item.externalField}</Td><Td>{item.direction}</Td>
                  <Td><Badge small tone={item.owner === 'External Supplier Master' ? 'warning' : 'neutral'}>{item.owner}</Badge></Td><Td>{item.owner === 'External Supplier Master' ? 'No' : 'Yes'}</Td>
                </Tr>
              ))}</tbody>
            </Table>
          </TableContainer>
        </Card>
      )}
      {view === 'sync' && <SyncAndRetry key={String(getRetryConfig().maxAttempts)} onNotice={onNotice} />}
      {view === 'logs' && <Logs onNotice={onNotice} />}
    </div>
  );
}
