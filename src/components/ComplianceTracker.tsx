import { useState } from 'react';
import { complianceCompanies, complianceGroups, daysLabel, itemStatusLabel, needsAttention, type ComplianceGroup, type ComplianceItem, type ComplianceStatus } from '../data/compliance';
import { isSampleOpen, sampleRequests } from '../data/samples';
import SampleRequests from './SampleRequests';
import { RenewalAction } from './DocumentRenewal';
import { Badge, Button, CellStack, EmptyState, HeadRow, Table, TableContainer, Tabs, Td, Tr, cx, type Tone } from './ui';

// Documents are tracked separately (Documents tab and Document register).
type TrackerGroup = Exclude<ComplianceGroup, 'Documents'>;
type TrackerTab = 'All' | TrackerGroup | 'Samples';

const statusTone: Record<ComplianceStatus, Tone> = { Verified: 'success', Expiring: 'warning', Expired: 'danger', Missing: 'danger', 'No data received': 'neutral', Pending: 'info' };

const tabLabel: Record<TrackerTab, string> = { All: 'All items', Contracts: 'Contracts', Audits: 'Audits', Questionnaires: 'Questionnaires', Screening: 'Screening', Samples: 'Sample requests' };
const tabOrder: TrackerTab[] = ['All', ...complianceGroups.map(item => item.group).filter((group): group is TrackerGroup => group !== 'Documents'), 'Samples'];

// With `supplier` set, each row gets a renewal request action.
export function ItemsTable({ items, showGroup, supplier }: { items: ComplianceItem[]; showGroup: boolean; supplier?: { id: string; name: string } }) {
  if (items.length === 0) return <EmptyState title="Nothing tracked here yet" description="No record has been reported for this tracking type." />;
  return (
    <TableContainer>
      <Table minWidth={supplier ? 960 : 760}>
        <HeadRow columns={['Item', ...(showGroup ? ['Tracking type'] : []), 'Type', 'Due / expiry', 'Time remaining', 'Status', 'Source', ...(supplier ? ['Renewal'] : [])]} />
        <tbody>
          {items.map(item => (
            <Tr key={`${item.group}-${item.name}`} className={item.status === 'Expired' || item.status === 'Missing' ? 'bg-danger-50/40' : ''}>
              <Td><CellStack primary={item.name} secondary={`Owner: ${item.owner}`} /></Td>
              {showGroup && <Td><Badge small>{item.group}</Badge></Td>}
              <Td className="text-ink-muted">{item.type}</Td>
              <Td className="whitespace-nowrap">{item.expiry}</Td>
              <Td className={cx('whitespace-nowrap font-medium', item.daysLeft !== null && item.daysLeft <= 30 ? 'text-danger-700' : item.daysLeft !== null && item.daysLeft <= 90 ? 'text-warning-700' : 'text-ink-muted')}>{daysLabel(item.daysLeft)}</Td>
              <Td><Badge tone={statusTone[item.status]} dot small>{itemStatusLabel(item)}</Badge></Td>
              <Td className="text-ink-muted">{item.source}</Td>
              {supplier && <Td><RenewalAction supplierId={supplier.id} supplierName={supplier.name} item={item} /></Td>}
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}

export default function ComplianceTracker({ companyId, onOpenDocuments }: { companyId: string; onOpenDocuments?: () => void }) {
  const [tab, setTab] = useState<TrackerTab>('All');
  const items = (complianceCompanies.find(company => company.id === companyId)?.items ?? []).filter(item => item.group !== 'Documents');
  const samples = sampleRequests[companyId] ?? [];

  if (items.length === 0 && samples.length === 0) {
    return <EmptyState title="No compliance items tracked" description="The connected compliance sources have not reported anything for this supplier." />;
  }

  const countOf = (value: TrackerTab) => (value === 'All' ? items.length : value === 'Samples' ? samples.length : items.filter(item => item.group === value).length);
  const attentionOf = (value: TrackerTab) => (value === 'Samples'
    ? samples.filter(sample => isSampleOpen(sample) && sample.daysLeft !== null && sample.daysLeft < 0).length
    : items.filter(item => (value === 'All' || item.group === value) && needsAttention(item)).length);

  return (
    <div>
      <div className="border-b border-line px-3">
        <Tabs
          label="Compliance tracking types"
          value={tab}
          onChange={setTab}
          items={tabOrder.map(value => ({
            value,
            label: (
              <span className="inline-flex items-center gap-2">
                {tabLabel[value]}
                <span className="rounded-full bg-sunken px-1.5 text-micro tabular-nums text-ink-muted">{countOf(value)}</span>
                {attentionOf(value) > 0 && <span role="img" aria-label={`${attentionOf(value)} need attention`} className="h-1.5 w-1.5 rounded-full bg-danger-500" />}
              </span>
            ),
          }))}
        />
      </div>
      {onOpenDocuments && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle bg-canvas px-4 py-2 text-caption text-ink-muted">
          <span>Certificates, insurance and permits are tracked separately as documents.</span>
          <Button size="xs" variant="link" onClick={onOpenDocuments}>Open documents</Button>
        </div>
      )}
      {tab === 'Samples' ? <SampleRequests samples={samples} supplierId={companyId} readOnly /> : <ItemsTable items={tab === 'All' ? items : items.filter(item => item.group === tab)} showGroup={tab === 'All'} />}
    </div>
  );
}
