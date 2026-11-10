import { useState } from 'react';
import type { Actor } from '../../qsl/types';
import { can } from '../../qsl/rbac';
import { reactivateQualification, suspendQualification } from '../../qsl/services/assessments';
import { withdrawFromQsl } from '../../qsl/services/publishing';
import { listDirectory, listMonitoring, type DirectoryRow } from '../../qsl/services/queries';
import { listQslActivity } from '../../qsl/services/qslRegister';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Card, EmptyState, HeadRow, SegmentedControl, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { StandingBadge, formatDate } from '../qualification/shared';
import { ReasonModal } from '../qualification/ReasonModal';
import { ExtendModal, ScopeModal } from './modals';

type View = 'active' | 'expiry' | 'suspended' | 'withdrawn' | 'status' | 'changes';
type Action = { kind: 'scope' | 'suspend' | 'reactivate' | 'withdraw' | 'extend'; row: DirectoryRow };
const stamp = (value: string) => `${formatDate(value)} ${new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

// 5.4 Monitoring & Maintenance: active list, expiry and renewal, suspension, reinstatement, withdrawal and history.
export function MonitoringTab({ actor, onRequalify }: { actor: Actor; onRequalify: () => void }) {
  const [view, setView] = useState<View>('active');
  const [action, setAction] = useState<Action | null>(null);
  const directory = useQslQuery(() => listDirectory(actor), [actor.id]).data;
  const monitoring = useQslQuery(() => listMonitoring(actor), [actor.id]).data;
  const statusLog = useQslQuery(() => listQslActivity(actor, 'status'), [actor.id]).data ?? [];
  const changeLog = useQslQuery(() => listQslActivity(actor, 'publication'), [actor.id]).data ?? [];
  const canManage = can(actor, 'monitoring.manage');
  const canScope = can(actor, 'enrollment.manage');
  const all = directory?.rows ?? [];
  const counts = directory?.counts;
  const lists: Record<'active' | 'suspended' | 'withdrawn', DirectoryRow[]> = {
    active: all.filter(row => row.standing === 'Published' || row.standing === 'Expiring'),
    suspended: all.filter(row => row.standing === 'Suspended'),
    withdrawn: all.filter(row => row.standing === 'Withdrawn'),
  };
  const expiry = monitoring?.due ?? [];

  const renderRows = (rows: DirectoryRow[], kind: 'active' | 'suspended' | 'withdrawn') => (
    <>
      <TableContainer>
        <Table minWidth={900}>
          <HeadRow columns={['QSL ID', 'Supplier', 'Category / Scope', 'Effective - expiry', 'Status', '']} />
          <tbody>{rows.map(row => (
            <Tr key={row.id}>
              <Td className="font-mono text-caption">{row.listingNo}</Td>
              <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.supplierId}</div></Td>
              <Td>{row.category}<div className="text-caption text-ink-muted">{row.scopeType}{row.scopeDetail ? ` · ${row.scopeDetail}` : ''}</div></Td>
              <Td>{formatDate(row.effectiveDate)} - {formatDate(row.expiryDate)}</Td>
              <Td><StandingBadge standing={row.standing} /></Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  {kind === 'active' && canManage && <Button size="xs" variant="link-danger" onClick={() => setAction({ kind: 'suspend', row })}>Suspend</Button>}
                  {kind === 'active' && canManage && <Button size="xs" variant="link-muted" onClick={() => setAction({ kind: 'withdraw', row })}>Withdraw</Button>}
                  {kind === 'active' && canScope && <Button size="xs" variant="link-muted" onClick={() => setAction({ kind: 'scope', row })}>Scope</Button>}
                  {kind === 'suspended' && canManage && <Button size="xs" variant="primary" onClick={() => setAction({ kind: 'reactivate', row })}>Reinstate</Button>}
                  {kind === 'suspended' && canManage && <Button size="xs" variant="link-muted" onClick={() => setAction({ kind: 'withdraw', row })}>Withdraw</Button>}
                </div>
              </Td>
            </Tr>
          ))}</tbody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <EmptyState title="No suppliers" />}
    </>
  );

  const renderLog = (rows: typeof statusLog) => (
    <>
      <TableContainer>
        <Table minWidth={860}>
          <HeadRow columns={['Date', 'No.', 'Supplier', 'Category', 'Change', 'By', 'Reason / details']} />
          <tbody>{rows.map((row, index) => (
            <Tr key={`${row.qslId}-${row.at}-${index}`}><Td>{stamp(row.at)}</Td><Td className="font-mono text-caption">{row.qslNo}</Td><Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.category}</Td><Td>{row.action}</Td><Td>{row.byName}</Td><Td className="max-w-64 text-caption text-ink-soft">{row.note ?? '—'}</Td></Tr>
          ))}</tbody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <EmptyState title="No history yet" />}
    </>
  );

  return (
    <div className="space-y-4">
      <Toolbar>
        <SegmentedControl<View> label="Monitoring view" value={view} onChange={setView} items={[
          { value: 'active', label: `Active${counts ? ` (${lists.active.length})` : ''}` },
          { value: 'expiry', label: `Expiry & renewal${monitoring ? ` (${expiry.length})` : ''}` },
          { value: 'suspended', label: `Suspended${counts ? ` (${lists.suspended.length})` : ''}` },
          { value: 'withdrawn', label: `Withdrawn${counts ? ` (${lists.withdrawn.length})` : ''}` },
          { value: 'status', label: 'Status history' },
          { value: 'changes', label: 'Change history' },
        ]} />
        {monitoring && view === 'expiry' && <span className="text-caption text-ink-muted">Reminder {monitoring.reminderDays} days before expiry</span>}
      </Toolbar>
      <Card className="overflow-hidden">
        {(view === 'active' || view === 'suspended' || view === 'withdrawn') && renderRows(lists[view], view)}
        {view === 'status' && renderLog(statusLog)}
        {view === 'changes' && renderLog(changeLog)}
        {view === 'expiry' && (
          <>
            <TableContainer>
              <Table minWidth={900}>
                <HeadRow columns={['Supplier', 'Category / Scope', 'QSL expiry', 'Left', 'Status', '']} />
                <tbody>{expiry.map(row => (
                  <Tr key={row.id}>
                    <Td className="font-medium text-ink">{row.supplierName}</Td>
                    <Td>{row.category}<div className="text-caption text-ink-muted">{row.scopeType}{row.scopeDetail ? ` · ${row.scopeDetail}` : ''}</div></Td>
                    <Td>{formatDate(row.expiryDate)}</Td>
                    <Td className={row.daysLeft! < 0 ? 'text-danger-700' : 'text-warning-700'}>{row.daysLeft! < 0 ? `${-row.daysLeft!} days overdue` : `${row.daysLeft} days`}</Td>
                    <Td><div className="flex flex-wrap gap-1"><StandingBadge standing={row.standing} />{row.reassessing && <Badge small tone="info">Requalification started</Badge>}</div></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {canManage && <Button size="xs" variant="primary" onClick={() => setAction({ kind: 'extend', row })}>Renew validity</Button>}
                        {!row.reassessing && <Button size="xs" onClick={onRequalify}>Requalify</Button>}
                      </div>
                    </Td>
                  </Tr>
                ))}</tbody>
              </Table>
            </TableContainer>
            {expiry.length === 0 && <EmptyState title="Nothing is expiring" description="Listings appear here inside the reminder window" />}
          </>
        )}
      </Card>

      {action?.kind === 'scope' && <ScopeModal actor={actor} row={action.row} onClose={() => setAction(null)} />}
      {action?.kind === 'extend' && <ExtendModal actor={actor} row={action.row} onClose={() => setAction(null)} />}
      {(action?.kind === 'suspend' || action?.kind === 'reactivate' || action?.kind === 'withdraw') && (
        <ReasonModal
          title={action.kind === 'suspend' ? 'Suspend from QSL' : action.kind === 'reactivate' ? 'Reinstate on QSL' : 'Withdraw from QSL'}
          eyebrow={`${action.row.supplierName} · ${action.row.category}`}
          label={action.kind === 'suspend' ? 'Reason for suspension' : action.kind === 'reactivate' ? 'Reinstatement note' : 'Reason for withdrawal'}
          confirmLabel={action.kind === 'suspend' ? 'Suspend' : action.kind === 'reactivate' ? 'Reinstate' : 'Withdraw'}
          danger={action.kind !== 'reactivate'}
          onClose={() => setAction(null)}
          onSubmit={reason => {
            if (action.kind === 'suspend') suspendQualification(actor, action.row.id, reason);
            else if (action.kind === 'reactivate') reactivateQualification(actor, action.row.id, reason);
            else withdrawFromQsl(actor, action.row.id, reason);
          }}
        />
      )}
    </div>
  );
}
