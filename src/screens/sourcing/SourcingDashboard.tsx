import { useState } from 'react';
import ExportButton from '../../components/ExportButton';
import { suppliers, type Supplier } from '../../data/suppliers';
import { Badge, Button, Card, EmptyState, Field, HeadRow, KpiCard, KpiGrid, Modal, SearchInput, Select, Table, TableContainer, Tabs, Td, Toolbar, Tr, type Tone } from '../../components/ui';
import { getSourcing, getSourcingSummary, listActivity, listSourcing, sourcingStages, sourcingTeam, type SourcingAction, type SourcingStage } from '../../sourcing';
import { useSourcingRevision } from '../../sourcing/useSourcing';
import SourcingModal from './SourcingModal';
import { StageBadge, activityLabel, formatDay, formatStamp } from './shared';

const riskTone: Record<string, Tone> = { Critical: 'danger', 'High Risk': 'danger', 'Medium Risk': 'warning', 'Low Risk': 'success' };
const actions: SourcingAction[] = ['Marked as interested', 'Stage changed', 'Assigned', 'Removed from sourcing'];
const supplierOf = (id: string) => suppliers.find(item => item.id === id);
const PREVIEW = 8;

// Sourcing team view: which suppliers were marked, shortlisted, reviewed and finally selected or not.
export default function SourcingDashboard() {
  useSourcingRevision();
  const [stage, setStage] = useState<'All' | SourcingStage>('All');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [category, setCategory] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityAction, setActivityAction] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [managing, setManaging] = useState<Supplier | null>(null);
  const [picking, setPicking] = useState(false);

  const summary = getSourcingSummary();
  const categories = [...new Set(suppliers.map(item => item.category))].sort();
  const rows = listSourcing({ stage: stage === 'All' ? undefined : stage, assignee: assignee || undefined, search }).flatMap(record => {
    const supplier = supplierOf(record.supplierId);
    return supplier && (!category || supplier.category === category) ? [{ record, supplier }] : [];
  });
  const activity = listActivity({ search: activitySearch, action: (activityAction || undefined) as SourcingAction | undefined });
  const shownActivity = showAll ? activity : activity.slice(0, PREVIEW);

  return (
    <div className="space-y-5">
      <KpiGrid cols={6}>
        <KpiCard label="Total suppliers" value={summary.total} note="All suppliers in sourcing" tone="brand" size="md" />
        <KpiCard label="Interested" value={summary.byStage.Interested} note="Marked by the team" tone="info" size="md" />
        <KpiCard label="Shortlisted" value={summary.byStage.Shortlisted} note="Passed preliminary selection" tone="brand" size="md" />
        <KpiCard label="Under Review" value={summary.byStage['Under Review']} note="Being checked and assessed" tone="warning" size="md" />
        <KpiCard label="Selected" value={summary.byStage.Selected} note="Chosen suppliers" tone="success" size="md" />
        <KpiCard label="Not Selected" value={summary.byStage['Not Selected']} note="Reviewed, not chosen" tone="danger" size="md" />
      </KpiGrid>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 pt-1">
          <Tabs<'All' | SourcingStage> label="Sourcing stages" value={stage} onChange={setStage}
            items={[{ value: 'All', label: `All (${summary.total})` }, ...sourcingStages.map(name => ({ value: name, label: `${name} (${summary.byStage[name]})` }))]} />
        </div>
        <div className="border-b border-line-subtle p-4">
          <Toolbar title="Sourcing suppliers" description={`${rows.length} of ${summary.total} suppliers`}
            actions={<>
              <ExportButton filename="slm-sourcing-suppliers" columns={['Supplier ID', 'Supplier', 'Category', 'Risk', 'Sourcing stage', 'Responsible', 'Marked by', 'Marked on', 'Last update']} rows={rows.map(({ record, supplier }) => [supplier.id, supplier.name, supplier.category, supplier.risk, record.stage, record.assignee, record.interestedBy, formatDay(record.interestedAt), formatDay(record.updatedAt)])} />
              <Button variant="primary" size="md" onClick={() => setPicking(true)}>+ Mark supplier as interested</Button>
            </>}>
            <SearchInput placeholder="Search supplier, ID or person" value={search} onChange={event => setSearch(event.target.value)} />
            <Select aria-label="Responsible person" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">All responsible people</option>{sourcingTeam.map(name => <option key={name}>{name}</option>)}</Select>
            <Select aria-label="Category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(name => <option key={name}>{name}</option>)}</Select>
          </Toolbar>
        </div>
        <TableContainer>
          <Table minWidth={1100}>
            <HeadRow columns={['Supplier', 'Category', 'Risk level', 'Sourcing stage', 'Responsible', 'Marked interested', 'Last update', 'Action']} />
            <tbody>{rows.map(({ record, supplier }) => (
              <Tr key={supplier.id} onClick={() => setManaging(supplier)}>
                <Td><div className="font-medium text-ink">{supplier.name}</div><div className="font-mono text-caption text-ink-muted">{supplier.id}</div></Td>
                <Td>{supplier.category}</Td>
                <Td><Badge tone={riskTone[supplier.risk] ?? 'neutral'} small>{supplier.risk}</Badge></Td>
                <Td><StageBadge stage={record.stage} small /></Td>
                <Td>{record.assignee}</Td>
                <Td className="whitespace-nowrap"><div>{formatDay(record.interestedAt)}</div><div className="text-caption text-ink-muted">by {record.interestedBy}</div></Td>
                <Td className="whitespace-nowrap text-ink-muted">{formatDay(record.updatedAt)}</Td>
                <Td><Button size="xs" variant="link" onClick={event => { event.stopPropagation(); setManaging(supplier); }}>Manage</Button></Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState title="No suppliers in this view" description="Mark a supplier as interested to start tracking it here." />}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line-subtle p-4">
          <Toolbar title="Sourcing activity history" description="Interest, selection, review and decision records"
            actions={<ExportButton filename="slm-sourcing-activity" columns={['When', 'Supplier ID', 'Supplier', 'Activity', 'By', 'Note']} rows={activity.map(item => [formatStamp(item.at), item.supplierId, supplierOf(item.supplierId)?.name, activityLabel(item), item.by, item.note])} />}>
            <SearchInput placeholder="Search supplier, person or note" value={activitySearch} onChange={event => setActivitySearch(event.target.value)} />
            <Select aria-label="Activity type" value={activityAction} onChange={event => setActivityAction(event.target.value)}><option value="">All activities</option>{actions.map(name => <option key={name}>{name}</option>)}</Select>
          </Toolbar>
        </div>
        <TableContainer>
          <Table minWidth={900}>
            <HeadRow columns={['When', 'Supplier', 'Activity', 'By', 'Note']} />
            <tbody>{shownActivity.map(item => {
              const supplier = supplierOf(item.supplierId);
              return (
                <Tr key={item.id} onClick={supplier ? () => setManaging(supplier) : undefined}>
                  <Td className="whitespace-nowrap text-ink-muted">{formatStamp(item.at)}</Td>
                  <Td><div className="font-medium text-ink">{supplier?.name ?? item.supplierId}</div><div className="font-mono text-caption text-ink-muted">{item.supplierId}</div></Td>
                  <Td>{activityLabel(item)}</Td>
                  <Td>{item.by}</Td>
                  <Td className="text-ink-soft">{item.note ?? '—'}</Td>
                </Tr>
              );
            })}</tbody>
          </Table>
        </TableContainer>
        {activity.length === 0 && <EmptyState title="No activity matches these filters" />}
        {activity.length > PREVIEW && (
          <div className="flex justify-center border-t border-line-subtle p-3">
            <Button size="sm" variant="ghost" onClick={() => setShowAll(current => !current)}>{showAll ? 'Show fewer' : `Show all ${activity.length} activities`}</Button>
          </div>
        )}
      </Card>

      {picking && <Picker onClose={() => setPicking(false)} onPick={supplier => { setPicking(false); setManaging(supplier); }} />}
      {managing && <SourcingModal supplier={managing} onClose={() => setManaging(null)} />}
    </div>
  );
}

function Picker({ onPick, onClose }: { onPick: (supplier: Supplier) => void; onClose: () => void }) {
  const available = suppliers.filter(item => !getSourcing(item.id));
  const [id, setId] = useState(available[0]?.id ?? '');
  return (
    <Modal title="Mark supplier as interested" eyebrow="Sourcing" onClose={onClose}>
      {available.length === 0 ? <EmptyState title="Every supplier is already in sourcing" /> : (
        <Field label="Supplier"><Select value={id} onChange={event => setId(event.target.value)}>{available.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}</Select></Field>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!id} onClick={() => { const supplier = supplierOf(id); if (supplier) onPick(supplier); }}>Continue</Button>
      </div>
    </Modal>
  );
}
