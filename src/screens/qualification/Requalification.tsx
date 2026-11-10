import { useState } from 'react';
import type { Actor } from '../../qsl/types';
import { can } from '../../qsl/rbac';
import { listRequalification, type NextAction } from '../../qsl/services/queries';
import { useQslQuery } from '../../qsl/useQsl';
import ExportButton from '../../components/ExportButton';
import { Badge, Button, Card, EmptyState, HeadRow, SegmentedControl, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { ValidityBadge, formatDate, statusTone } from './shared';

type View = 'due' | 'reassessment';

// Requalification: approved qualifications close to or past expiry, and the requalification requests already started.
export function RequalificationTab({ actor, onOpen, onContinue, onStart }: {
  actor: Actor;
  onOpen: (id: string) => void;
  onContinue: (id: string, action: Exclude<NextAction, null>) => void;
  onStart: (id: string) => void;
}) {
  const [view, setView] = useState<View>('due');
  const data = useQslQuery(() => listRequalification(actor), [actor.id]).data;
  const canStart = can(actor, 'qsl.create');
  const empty = data && (view === 'due' ? data.due : data.reassessment).length === 0;

  return (
    <div className="space-y-4">
      <Toolbar actions={view === 'due'
        ? <ExportButton filename="slm-requalification-due" columns={['No.', 'Supplier', 'Category', 'Scope', 'Qualification expiry', 'Days left', 'Validity']} rows={(data?.due ?? []).map(row => [row.qslNo, row.supplierName, row.category, row.scope, row.expiryDate, row.daysLeft, row.validity])} />
        : <ExportButton filename="slm-requalification-requests" columns={['Request ID', 'Supplier', 'Category', 'Scope', 'Previous round', 'Reason', 'Status', 'Due']} rows={(data?.reassessment ?? []).map(row => [row.qslNo, row.supplierName, row.category, row.scope, row.previousNo, row.reason, row.statusLabel, row.dueDate])} />}>
        <SegmentedControl<View> label="Requalification" value={view} onChange={setView} items={[
          { value: 'due', label: `Expiring / expired${data ? ` (${data.due.length})` : ''}` },
          { value: 'reassessment', label: `Requalification requests${data ? ` (${data.reassessment.length})` : ''}` },
        ]} />
        {data && <span className="text-caption text-ink-muted">{`Reminder ${data.reminderDays} days before the qualification expires`}</span>}
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          {view === 'due' ? (
            <Table minWidth={900}>
              <HeadRow columns={['Supplier', 'Category / Scope', 'Qualification expiry', 'Left', 'Validity', '']} />
              <tbody>{(data?.due ?? []).map(row => (
                <Tr key={row.id}>
                  <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.qslNo}</div></Td>
                  <Td>{row.category}<div className="text-caption text-ink-muted">{row.scope}</div></Td>
                  <Td>{formatDate(row.expiryDate)}</Td>
                  <Td className={row.daysLeft! < 0 ? 'text-danger-700' : 'text-warning-700'}>{row.daysLeft! < 0 ? `${-row.daysLeft!} days overdue` : `${row.daysLeft} days`}</Td>
                  <Td><div className="flex flex-wrap gap-1"><ValidityBadge validity={row.validity} />{row.reassessing && <Badge small tone="info">Requalification started</Badge>}</div></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {canStart && !row.reassessing && <Button size="xs" variant="primary" onClick={() => onStart(row.id)}>Request requalification</Button>}
                      <Button size="xs" variant="link" onClick={() => onOpen(row.id)}>Details</Button>
                    </div>
                  </Td>
                </Tr>
              ))}</tbody>
            </Table>
          ) : (
            <Table minWidth={960}>
              <HeadRow columns={['Request ID', 'Supplier', 'Category / Scope', 'Previous round', 'Reason', 'Assessment status', 'Due', '']} />
              <tbody>{(data?.reassessment ?? []).map(row => (
                <Tr key={row.id}>
                  <Td className="font-mono text-caption">{row.qslNo}</Td><Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.category}<div className="text-caption text-ink-muted">{row.scope}</div></Td>
                  <Td className="font-mono text-caption">{row.previousNo}</Td><Td className="max-w-56 text-caption text-ink-soft">{row.reason || '—'}</Td>
                  <Td><Badge tone={statusTone[row.status]} small dot>{row.statusLabel}</Badge></Td>
                  <Td className={row.overdue ? 'text-danger-700' : undefined}>{formatDate(row.dueDate)}</Td>
                  <Td><div className="flex gap-1.5">{row.nextAction && <Button size="xs" variant="primary" onClick={() => onContinue(row.id, row.nextAction!)}>Continue</Button>}<Button size="xs" variant="link" onClick={() => onOpen(row.id)}>Details</Button></div></Td>
                </Tr>
              ))}</tbody>
            </Table>
          )}
        </TableContainer>
        {empty && <EmptyState title="No items" />}
      </Card>
    </div>
  );
}
