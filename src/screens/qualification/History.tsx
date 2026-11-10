import { useState } from 'react';
import type { Actor } from '../../qsl/types';
import { listHistory } from '../../qsl/services/queries';
import { useQslQuery } from '../../qsl/useQsl';
import ExportButton from '../../components/ExportButton';
import { Badge, Button, Card, EmptyState, HeadRow, SearchInput, SegmentedControl, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { ResultBadge, StandingBadge, formatDate } from './shared';

type View = 'qualification' | 'status';
const stamp = (value: string) => `${formatDate(value)} ${new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

const loadRounds = (actor: Actor, search: string) => listHistory(actor, 'qualification', search);
const loadActivity = (actor: Actor, search: string) => listHistory(actor, 'status', search);
type RoundRows = ReturnType<typeof loadRounds>;
type ActivityRows = ReturnType<typeof loadActivity>;

function QualificationHistory({ rows, onOpen }: { rows: RoundRows; onOpen: (id: string) => void }) {
  return (
    <>
      <TableContainer>
        <Table minWidth={900}>
          <HeadRow columns={['No.', 'Supplier', 'Category', 'Round', 'Status', 'Result', 'Effective - expiry', '']} />
          <tbody>{rows.map(row => (
            <Tr key={row.id}><Td className="font-mono text-caption">{row.qslNo}</Td><Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.category}</Td><Td>{row.round} · {row.type}</Td><Td><Badge small>{row.statusLabel}</Badge></Td>
              <Td><ResultBadge result={row.result} /></Td><Td>{row.effectiveDate ? `${formatDate(row.effectiveDate)} - ${formatDate(row.expiryDate)}` : '—'} <StandingBadge standing={row.standing} /></Td>
              <Td><Button size="xs" variant="link" onClick={() => onOpen(row.id)}>Open</Button></Td></Tr>
          ))}</tbody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <EmptyState title="No history found" />}
    </>
  );
}

function ActivityLog({ rows, onOpen }: { rows: ActivityRows; onOpen: (id: string) => void }) {
  return (
    <>
      <TableContainer>
        <Table minWidth={860}>
          <HeadRow columns={['Date', 'No.', 'Supplier', 'Activity', 'By', 'Note', '']} />
          <tbody>{rows.map((row, index) => (
            <Tr key={`${row.qslId}-${row.at}-${index}`}><Td>{stamp(row.at)}</Td><Td className="font-mono text-caption">{row.qslNo}</Td><Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.action}</Td><Td>{row.byName}</Td><Td className="max-w-64 text-caption text-ink-soft">{row.note ?? '—'}</Td>
              <Td><Button size="xs" variant="link" onClick={() => onOpen(row.qslId)}>Open</Button></Td></Tr>
          ))}</tbody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <EmptyState title="No activity found" />}
    </>
  );
}

// History: past qualification rounds and the activity log (approvals, suspensions, extensions).
export function HistoryTab({ actor, onOpen }: { actor: Actor; onOpen: (id: string) => void }) {
  const [view, setView] = useState<View>('qualification');
  const [search, setSearch] = useState('');
  const rounds = useQslQuery(() => loadRounds(actor, search), [actor.id, search]).data ?? [];
  const activity = useQslQuery(() => loadActivity(actor, search), [actor.id, search]).data ?? [];

  return (
    <div className="space-y-4">
      <Toolbar actions={view === 'qualification'
        ? <ExportButton filename="slm-qualification-history" columns={['No.', 'Supplier', 'Category', 'Round', 'Type', 'Status', 'Result', 'Effective', 'Expiry']} rows={rounds.map(row => [row.qslNo, row.supplierName, row.category, row.round, row.type, row.statusLabel, row.result, row.effectiveDate, row.expiryDate])} />
        : <ExportButton filename="slm-qualification-activity" columns={['Date', 'No.', 'Supplier', 'Activity', 'By', 'Note']} rows={activity.map(row => [row.at, row.qslNo, row.supplierName, row.action, row.byName, row.note])} />}>
        <SegmentedControl<View> label="History view" value={view} onChange={setView} items={[{ value: 'qualification', label: 'Qualification rounds' }, { value: 'status', label: 'Activity log' }]} />
        <SearchInput placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search history" />
      </Toolbar>
      <Card className="overflow-hidden">
        {view === 'qualification' ? <QualificationHistory rows={rounds} onOpen={onOpen} /> : <ActivityLog rows={activity} onOpen={onOpen} />}
      </Card>
    </div>
  );
}
