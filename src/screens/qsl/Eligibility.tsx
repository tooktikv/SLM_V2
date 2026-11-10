import { useState } from 'react';
import type { Actor } from '../../qsl/types';
import { can } from '../../qsl/rbac';
import { listEligibility, listQslActivity, type EligibilityRow } from '../../qsl/services/qslRegister';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Callout, Card, EmptyState, HeadRow, KpiCard, KpiGrid, SearchInput, SegmentedControl, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { EligibilityBadge, formatDate } from '../qualification/shared';

type View = 'check' | 'pending' | 'history';
const stamp = (value: string) => `${formatDate(value)} ${new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <span role="img" aria-label={`${label}: ${ok ? 'passed' : 'not met'}`} className={ok ? 'font-semibold text-success-700' : 'font-semibold text-danger-700'}>{ok ? '✓' : '✕'}</span>
);

function CheckTable({ rows, canPublish, onGo }: { rows: EligibilityRow[]; canPublish: boolean; onGo: (section: string) => void }) {
  return (
    <TableContainer>
      <Table minWidth={980}>
        <HeadRow columns={['Supplier', 'Category / Scope', 'Qualification approved', 'Capability approved', 'Valid', 'Result', 'Pending requirements', '']} />
        <tbody>{rows.map(row => (
          <Tr key={row.id}>
            <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.supplierId} · {row.qslNo}</div></Td>
            <Td>{row.category}<div className="text-caption text-ink-muted">{row.scopeType}{row.scopeDetail ? ` · ${row.scopeDetail}` : ''}</div></Td>
            <Td className="text-center"><Check ok={row.checks.qualification} label="Qualification approved" /></Td>
            <Td className="text-center"><Check ok={row.checks.capability} label="Capability approved" /></Td>
            <Td className="text-center"><Check ok={row.checks.validity} label="Validity" /></Td>
            <Td><div className="flex flex-wrap gap-1"><EligibilityBadge state={row.state} />{row.withdrawn && <Badge small>Withdrawn</Badge>}</div></Td>
            <Td className="max-w-64 text-caption text-ink-soft">{row.state === 'Published' ? '—' : row.reasons.length ? row.reasons.join('; ') : 'None'}</Td>
            <Td>{row.state === 'Eligible' && canPublish && <Button size="xs" variant="primary" onClick={() => onGo('publishing')}>Prepare to publish</Button>}</Td>
          </Tr>
        ))}</tbody>
      </Table>
    </TableContainer>
  );
}

// 5.2 Eligibility: Qualification Approved + relevant Capability Approved = QSL Eligible, checked per supplier, category and scope.
export function EligibilityTab({ actor, onGo }: { actor: Actor; onGo: (section: string) => void }) {
  const [view, setView] = useState<View>('check');
  const [search, setSearch] = useState('');
  const data = useQslQuery(() => listEligibility(actor), [actor.id]).data;
  const history = useQslQuery(() => listQslActivity(actor, 'eligibility'), [actor.id]).data ?? [];
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (...parts: string[]) => { const text = parts.join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); };
  const rows = (data?.rows ?? []).filter(row => matches(row.supplierName, row.supplierId, row.category, row.qslNo));
  const pending = (data?.pending ?? []).filter(row => matches(row.supplierName, row.category, row.qslNo));
  const logs = history.filter(row => matches(row.supplierName, row.category, row.qslNo, row.action));

  return (
    <div className="space-y-4">
      <Callout tone="info" title="Business rule">
        Qualification Approved + Relevant Capability Approved = QSL Eligible. The check is made per supplier and capability / product scope, not for the whole company.
      </Callout>
      <KpiGrid cols={4}>
        <KpiCard label="Eligible" value={data?.counts.eligible ?? '—'} tone="brand" note="Ready to publish" />
        <KpiCard label="Not eligible" value={data?.counts.notEligible ?? '—'} tone={data?.counts.notEligible ? 'danger' : 'neutral'} note="Blocked by a requirement" />
        <KpiCard label="Published" value={data?.counts.published ?? '—'} tone="success" note="Already on the QSL" />
        <KpiCard label="Pending requirements" value={data?.counts.pending ?? '—'} tone="warning" note="Qualification / capability in progress" />
      </KpiGrid>
      <Toolbar>
        <SegmentedControl<View> label="Eligibility view" value={view} onChange={setView} items={[
          { value: 'check', label: `Eligibility check${data ? ` (${rows.length})` : ''}` },
          { value: 'pending', label: `Pending requirements${data ? ` (${pending.length})` : ''}` },
          { value: 'history', label: 'Check history' },
        ]} />
        <SearchInput placeholder="Search supplier, category, no." value={search} onChange={event => setSearch(event.target.value)} aria-label="Search eligibility" />
      </Toolbar>
      <Card className="overflow-hidden">
        {view === 'check' && (<>
          <CheckTable rows={rows} canPublish={can(actor, 'qsl.publish')} onGo={onGo} />
          {rows.length === 0 && <EmptyState title="No suppliers to check" />}
        </>)}
        {view === 'pending' && (<>
          <TableContainer>
            <Table minWidth={860}>
              <HeadRow columns={['No.', 'Supplier', 'Category / Scope', 'Waiting for', 'Status', 'Owner']} />
              <tbody>{pending.map(row => (
                <Tr key={row.id}><Td className="font-mono text-caption">{row.qslNo}</Td><Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.category}<div className="text-caption text-ink-muted">{row.scope}</div></Td>
                  <Td><Badge small tone={row.waitingFor === 'Capability' ? 'brand' : 'info'}>{row.waitingFor}</Badge></Td><Td>{row.statusLabel}</Td><Td>{row.owner}</Td></Tr>
              ))}</tbody>
            </Table>
          </TableContainer>
          {pending.length === 0 && <EmptyState title="Nothing pending" description="Every qualification and capability has been decided" />}
        </>)}
        {view === 'history' && (<>
          <TableContainer>
            <Table minWidth={860}>
              <HeadRow columns={['Date', 'No.', 'Supplier', 'Category', 'Result', 'By', 'Note']} />
              <tbody>{logs.map((row, index) => (
                <Tr key={`${row.qslId}-${row.at}-${index}`}><Td>{stamp(row.at)}</Td><Td className="font-mono text-caption">{row.qslNo}</Td><Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.category}</Td><Td>{row.action}</Td><Td>{row.byName}</Td><Td className="max-w-64 text-caption text-ink-soft">{row.note ?? '—'}</Td></Tr>
              ))}</tbody>
            </Table>
          </TableContainer>
          {logs.length === 0 && <EmptyState title="No eligibility checks recorded yet" />}
        </>)}
      </Card>
    </div>
  );
}
