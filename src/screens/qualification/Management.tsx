import { useState, type ReactNode } from 'react';
import type { Actor } from '../../qsl/types';
import { listManagement, type ManagementView, type NextAction, type QslRow } from '../../qsl/services/queries';
import { useQslQuery } from '../../qsl/useQsl';
import ExportButton from '../../components/ExportButton';
import { Badge, Button, Card, Checkbox, EmptyState, HeadRow, SearchInput, SegmentedControl, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { ResultBadge, formatDate, statusTone } from './shared';

const actionLabel: Record<Exclude<NextAction, null>, string> = {
  fill: 'Fill in form', prereview: 'Review', sample: 'Evaluate sample', assess: 'Assess', verify: 'Verify ratings', approve: 'Decide', edit: 'Edit draft',
};

const stageItems: { value: ManagementView; label: string; count?: 'open' | 'request' | 'assessment' | 'verification' | 'approval' }[] = [
  { value: 'open', label: 'All', count: 'open' },
  { value: 'request', label: 'Request', count: 'request' },
  { value: 'assessment', label: 'Assessment', count: 'assessment' },
  { value: 'verification', label: 'Verification', count: 'verification' },
  { value: 'approval', label: 'Approval', count: 'approval' },
];

// Supplier Qualification List: one pipeline from request through approval; each row offers the next step for the current role.
export function ManagementTab({ actor, onOpen, onContinue, actions }: { actor: Actor; onOpen: (id: string) => void; onContinue: (id: string, action: Exclude<NextAction, null>) => void; actions?: ReactNode }) {
  const isSupplier = actor.role === 'Supplier';
  const [view, setView] = useState<ManagementView>('open');
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const effective: ManagementView = isSupplier ? 'all' : view;
  const query = useQslQuery(() => listManagement(actor, effective, search), [actor.id, effective, search]);
  const counts = query.data?.counts;
  const total = query.data?.open;
  const rows: QslRow[] = (query.data?.rows ?? []).filter(row => !mine || row.nextAction);

  return (
    <div className="space-y-4">
      <Toolbar actions={<><ExportButton filename="slm-qualification-list" columns={['No.', 'Supplier ID', 'Supplier', 'Category', 'Scope', 'Round', 'Status', 'Owner', 'Due']} rows={rows.map(row => [row.qslNo, row.supplierId, row.supplierName, row.category, row.scope, row.roundLabel, row.statusLabel, row.owner, row.dueDate])} />{actions}</>}>
        {!isSupplier && (
          <SegmentedControl<ManagementView> label="Assessment stage" value={view} onChange={setView}
            items={stageItems.map(item => ({ value: item.value, label: `${item.label}${counts ? ` (${item.count === 'open' ? total : counts[item.count!]})` : ''}` }))} />
        )}
        <SearchInput placeholder="Search no., supplier, category" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search assessments" />
        {!isSupplier && <label className="flex items-center gap-2 text-caption text-ink-soft"><Checkbox checked={mine} onChange={event => setMine(event.target.checked)} />My tasks only</label>}
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={900}>
            <HeadRow columns={['No.', 'Supplier', 'Category / Scope', 'Round', 'Status', 'Owner', 'Due', '']} />
            <tbody>
              {rows.map(row => (
                <Tr key={row.id}>
                  <Td className="font-mono text-caption">{row.qslNo}</Td>
                  <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.supplierId}</div></Td>
                  <Td>{row.category}<div className="text-caption text-ink-muted">{row.scope}</div></Td>
                  <Td>{row.roundLabel}</Td>
                  <Td><div className="flex flex-wrap items-center gap-1.5"><Badge tone={statusTone[row.status]} small dot>{row.statusLabel}</Badge>{row.status === 'Completed' && <ResultBadge result={row.result} />}</div></Td>
                  <Td>{row.owner}</Td>
                  <Td className={row.overdue ? 'text-danger-700' : undefined}>{formatDate(row.dueDate)}{row.overdue ? ' (overdue)' : ''}</Td>
                  <Td>
                    <div className="flex gap-1.5">
                      {row.nextAction && <Button size="xs" variant="primary" onClick={() => onContinue(row.id, row.nextAction!)}>{actionLabel[row.nextAction]}</Button>}
                      <Button size="xs" variant="link" onClick={() => onOpen(row.id)}>Details</Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState title="No items" description={isSupplier ? 'No assessment requests yet' : 'No items at this stage'} />}
      </Card>
    </div>
  );
}
