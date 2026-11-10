import { useState } from 'react';
import { sharedStatusTone, NewSampleModal } from '../../components/SampleActions';
import ExportButton from '../../components/ExportButton';
import { SampleProgress, sampleStatusTone } from '../../components/SampleRequests';
import { getConfig } from '../../config';
import { onboardingCompanies } from '../../data/onboarding';
import { isSampleOpen, sampleRequests, sampleStatuses, type SampleRequest, type SampleStatus } from '../../data/samples';
import { suppliers } from '../../data/suppliers';
import { sampleListFor, sharedSampleStatus } from '../../samples';
import { useSamplesRevision } from '../../samples/useSamples';
import { useNavigation } from '../../NavigationContext';
import { BackLink, Badge, Button, Card, CardHeader, DetailGrid, EmptyState, HeadRow, KpiCard, KpiGrid, SearchInput, Select, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';

type Row = SampleRequest & { supplierId: string; supplierName: string };
const supplierName = (id: string) => suppliers.find(item => item.id === id)?.name ?? onboardingCompanies.find(item => item.id === id)?.name ?? id;

// Request page: the request details with tracking and actions; the supplier profile is opened from here.
function SampleRequestPage({ row, onBack }: { row: Row; onBack: () => void }) {
  const { openSupplier } = useNavigation();
  const supplier = suppliers.find(item => item.id === row.supplierId);
  const type = getConfig('samples').requestTypes.find(item => item.id === row.typeId);
  const shared = sharedSampleStatus(row);

  return (
    <div className="space-y-4">
      <BackLink onClick={onBack}>Back to sample requests</BackLink>
      <Card>
        <CardHeader
          title={`Sample request ${row.id}`}
          description={`${row.supplierName} · ${row.supplierId}`}
          actions={<Button disabled={!supplier} onClick={() => supplier && openSupplier(supplier, 'Compliance')}>{supplier ? 'Open supplier profile' : 'Not in master'}</Button>}
        />
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={sampleStatusTone[row.status]} dot>{row.status}</Badge>
            <Badge tone={sharedStatusTone[shared]} small>{shared}</Badge>
          </div>
          <DetailGrid items={[
            { label: 'Supplier', value: `${row.supplierName} (${row.supplierId})` }, { label: 'Request type', value: type?.name ?? '—' },
            { label: 'Product', value: row.product }, { label: 'Purpose', value: row.purpose },
            { label: 'Specification', value: row.spec }, { label: 'Quantity', value: row.qty },
            { label: 'Requested by', value: `${row.requester} · ${row.department}` }, { label: 'Requested', value: row.requested },
            { label: 'Required by', value: row.required },
          ]} />
          <div className="border-t border-line-subtle pt-5"><SampleProgress sample={row} supplierId={row.supplierId} /></div>
        </div>
      </Card>
    </div>
  );
}

// 2. Sample Request Tracking: create sample requests and track every request per supplier, including delivery and evaluation.
export default function SampleTracking() {
  useSamplesRevision();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SampleStatus | ''>('');
  const [supplierId, setSupplierId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const supplierIds = Object.keys(sampleRequests);
  const rows: Row[] = supplierIds.flatMap(id => sampleListFor(id).map(sample => ({ ...sample, supplierId: id, supplierName: supplierName(id) })));
  const selected = selectedId ? rows.find(row => row.id === selectedId) : undefined;
  if (selected) return <SampleRequestPage row={selected} onBack={() => setSelectedId(null)} />;

  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = rows
    .filter(row => !supplierId || row.supplierId === supplierId)
    .filter(row => !status || row.status === status)
    .filter(row => { const text = [row.id, row.supplierName, row.supplierId, row.product, row.spec, row.purpose].join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); });
  const scoped = supplierId ? rows.filter(row => row.supplierId === supplierId) : rows;
  const open = scoped.filter(isSampleOpen);

  return (
    <>
      <KpiGrid cols={4}>
        <KpiCard label="Sample requests" value={scoped.length} note={`${new Set(scoped.map(row => row.supplierId)).size} suppliers`} tone="brand" />
        <KpiCard label="In progress" value={open.length} note="Requested to under testing" tone="info" />
        <KpiCard label="Past required date" value={open.filter(row => row.daysLeft !== null && row.daysLeft < 0).length} note="Open and overdue" tone="danger" />
        <KpiCard label="Decided" value={scoped.length - open.length} note={`${scoped.filter(row => row.status === 'Approved').length} approved`} tone="success" />
      </KpiGrid>
      <Toolbar title="Sample requests" description={`${visible.length} of ${scoped.length} requests`} actions={<><ExportButton filename="slm-sample-requests" columns={['Sample request', 'Supplier ID', 'Supplier', 'Product', 'Specification', 'Quantity', 'Purpose', 'Status', 'Requested', 'Required by', 'Result / note']} rows={visible.map(row => [row.id, row.supplierId, row.supplierName, row.product, row.spec, row.qty, row.purpose, row.status, row.requested, row.required, row.evaluation ? `${row.evaluation.result} · ${row.evaluation.comment}` : row.note])} /><Button variant="primary" size="md" onClick={() => setCreating(true)}>+ New Sample Request</Button></>}>
        <SearchInput placeholder="Search request, supplier, product" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-72" />
        <Select aria-label="Supplier" value={supplierId} onChange={event => setSupplierId(event.target.value)}><option value="">All suppliers</option>{supplierIds.map(id => <option key={id} value={id}>{supplierName(id)} ({id})</option>)}</Select>
        <Select aria-label="Request status" value={status} onChange={event => setStatus(event.target.value as SampleStatus | '')}><option value="">All statuses</option>{sampleStatuses.map(item => <option key={item}>{item}</option>)}</Select>
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={1080}>
            <HeadRow columns={['Sample request', 'Supplier', 'Product / material', 'Request date / status', 'Evaluation result', '']} />
            <tbody>{visible.map(row => (
              <Tr key={row.id}>
                <Td className="font-mono text-caption">{row.id}<div className="font-sans text-ink-muted">{row.purpose}</div></Td>
                <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.supplierId}</div></Td>
                <Td>{row.product}<div className="text-caption text-ink-muted">{row.spec} · {row.qty}</div></Td>
                <Td><Badge small tone={sampleStatusTone[row.status]} dot>{row.status}</Badge><div className="mt-0.5 text-caption text-ink-muted">Requested {row.requested} · required {row.required}</div></Td>
                <Td className="max-w-64 text-caption text-ink-soft">{row.evaluation ? `${row.evaluation.result} · ${row.evaluation.comment}` : row.note}</Td>
                <Td><Button size="xs" variant="link" onClick={() => setSelectedId(row.id)}>View</Button></Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {visible.length === 0 && <EmptyState title="No sample requests match these filters" />}
      </Card>
      {creating && <NewSampleModal onClose={() => setCreating(false)} />}
    </>
  );
}
