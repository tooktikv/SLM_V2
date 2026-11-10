import { useState } from 'react';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { Supplier, suppliers } from '../data/suppliers';
import { getSourcing, sourcingStages } from '../sourcing';
import { useSourcingRevision } from '../sourcing/useSourcing';
import { Badge, Button, Card, CellStack, Checkbox, EmptyState, HeadRow, KpiCard, KpiGrid, Page, PageContent, Pagination, ProgressBar, SearchInput, Select, Table, TableContainer, Tabs, Td, Th, Toolbar, Tr, type Tone } from '../components/ui';
import { buyerOf } from './dashboard/shared';
import SourcingDashboard from './sourcing/SourcingDashboard';
import SourcingModal from './sourcing/SourcingModal';
import { StageBadge } from './sourcing/shared';

const riskTone: Record<string, Tone> = {
  'Critical': 'danger',
  'High Risk': 'danger',
  'Medium Risk': 'warning',
  'Low Risk': 'success',
};

function PerfBar({ value }: { value: number }) {
  if (!value) return <span className="text-caption text-ink-muted">N/A</span>;
  const tone: Tone = value >= 80 ? 'success' : value >= 65 ? 'warning' : 'danger';
  return (
    <div className="flex items-center gap-2">
      <ProgressBar value={value} tone={tone} label="Performance" className="w-16" />
      <span className="text-caption tabular-nums text-ink-soft">{value}%</span>
    </div>
  );
}

const scored = suppliers.filter(s => s.perf > 0);
const buyers = ['All Buyers / Companies', ...[...new Set(suppliers.map(buyerOf))].sort()];
const NOT_IN_SOURCING = 'Not in sourcing';
const countries = ['All Countries', ...Array.from(new Set(suppliers.map(supplier => supplier.country))).sort((a, b) => (a === 'Thailand' ? -1 : b === 'Thailand' ? 1 : a.localeCompare(b)))];

type Tab = 'directory' | 'sourcing';

// Supplier Management: the supplier directory and the sourcing team's selection pipeline share one page.
export default function SupplierManagement({ onOpenSupplier }: { onOpenSupplier: (supplier: Supplier, tab?: string) => void }) {
  const [tab, setTab] = useState<Tab>('directory');
  return (
    <Page>
      <Header breadcrumb={['Supplier lifecycle', 'Supplier Management']} title="Supplier Management" />
      <PageContent>
        <Tabs<Tab> label="Supplier management sections" value={tab} onChange={setTab} items={[{ value: 'directory', label: 'Supplier directory' }, { value: 'sourcing', label: 'Sourcing suppliers' }]} />
        {tab === 'directory' ? <DirectoryTab onOpenSupplier={onOpenSupplier} /> : <SourcingDashboard />}
      </PageContent>
    </Page>
  );
}

function DirectoryTab({ onOpenSupplier }: { onOpenSupplier: (supplier: Supplier, tab?: string) => void }) {
  useSourcingRevision();
  const [buyerFilter, setBuyerFilter] = useState('All Buyers / Companies');
  const [sourcingFilter, setSourcingFilter] = useState('All Sourcing Stages');
  const [managing, setManaging] = useState<Supplier | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [countryFilter, setCountryFilter] = useState('All Countries');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filtered = suppliers.filter(s =>
    (`${s.name} ${s.id} ${s.taxId || ''}`.toLowerCase().includes(search.toLowerCase())) &&
    (riskFilter === 'All' || s.risk === riskFilter) &&
    (categoryFilter === 'All Categories' || s.category === categoryFilter) &&
    (statusFilter === 'All Statuses' || s.status === statusFilter) &&
    (countryFilter === 'All Countries' || s.country === countryFilter) &&
    (buyerFilter === 'All Buyers / Companies' || buyerOf(s) === buyerFilter) &&
    (sourcingFilter === 'All Sourcing Stages' || (sourcingFilter === NOT_IN_SOURCING ? !getSourcing(s.id) : getSourcing(s.id)?.stage === sourcingFilter))
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleSuppliers = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleAll = () => setSelected(visibleSuppliers.every(supplier => selected.includes(supplier.id)) ? [] : visibleSuppliers.map(supplier => supplier.id));
  const resetFilters = () => {
    setSearch('');
    setRiskFilter('All');
    setCategoryFilter('All Categories');
    setStatusFilter('All Statuses');
    setCountryFilter('All Countries');
    setBuyerFilter('All Buyers / Companies');
    setSourcingFilter('All Sourcing Stages');
    setPage(1);
  };

  return (
    <div className="space-y-5">
        <KpiGrid cols={5}>
          <KpiCard label="Total suppliers" value={suppliers.length} note={`${countries.length - 1} countries`} tone="brand" size="md" />
          <KpiCard label="Active" value={suppliers.filter(s => s.status === 'Active').length} note="Qualified to supply" tone="success" size="md" />
          <KpiCard label="Pending or draft" value={suppliers.filter(s => s.status === 'Pending' || s.status === 'Draft').length} note="Onboarding or review" tone="warning" size="md" />
          <KpiCard label="High risk" value={suppliers.filter(s => s.risk === 'High Risk' || s.risk === 'Critical').length} note="High or critical" tone="danger" size="md" />
          <KpiCard label="Average performance" value={`${Math.round(scored.reduce((total, s) => total + s.perf, 0) / (scored.length || 1))}%`} note={`${scored.length} scored suppliers`} size="md" />
        </KpiGrid>

        {/* Filters */}
        <Card className="p-3">
          <Toolbar className="gap-3" title="Supplier directory" description={`${filtered.length} of ${suppliers.length} suppliers`} actions={<>
            <ExportButton filename="slm-supplier-directory" columns={['Supplier ID', 'Supplier', 'Country', 'Tax ID', 'Buyer / company', 'Category', 'Status', 'Risk', 'Performance', 'Qualification', 'Sourcing stage', 'Owner', 'Last updated']} rows={filtered.map(s => [s.id, s.name, s.country, s.taxId || '', buyerOf(s), s.category, s.status, s.risk, s.perf || '', s.qual, getSourcing(s.id)?.stage ?? NOT_IN_SOURCING, s.owner, s.lastReview])} />
          </>}>
            <SearchInput
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="min-w-48 flex-1"
              placeholder="Search name, ID or tax ID..."
            />
            <Select aria-label="Category" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
              {['All Categories', 'Raw Materials', 'Electronics', 'Packaging', 'Mechanical', 'IT Services', 'Logistics'].map(item => <option key={item}>{item}</option>)}
            </Select>
            <Select aria-label="Country" value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }}>
              {countries.map(item => <option key={item}>{item}</option>)}
            </Select>
            <Select aria-label="Buyer / company" value={buyerFilter} onChange={e => { setBuyerFilter(e.target.value); setPage(1); }}>
              {buyers.map(item => <option key={item}>{item}</option>)}
            </Select>
            <Select aria-label="Sourcing stage" value={sourcingFilter} onChange={e => { setSourcingFilter(e.target.value); setPage(1); }}>
              {['All Sourcing Stages', NOT_IN_SOURCING, ...sourcingStages].map(item => <option key={item}>{item}</option>)}
            </Select>
            <Select aria-label="Risk level" value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1); }}>
              {['All', 'Critical', 'High Risk', 'Medium Risk', 'Low Risk'].map(item => <option key={item}>{item}</option>)}
            </Select>
            <Select aria-label="Supplier status" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              {['All Statuses', 'Active', 'Pending', 'Draft', 'Rejected'].map(item => <option key={item}>{item}</option>)}
            </Select>
          </Toolbar>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
              <span className="text-body font-medium text-brand-700">{selected.length} selected</span>
              <Button variant="link">Export</Button>
              <Button variant="link">Assign Owner</Button>
              <Button variant="link-danger">Deactivate</Button>
            </div>
          )}
          <TableContainer>
            <Table minWidth={1320}>
              <HeadRow
                leading={
                  <Th className="w-10">
                    <Checkbox checked={visibleSuppliers.length > 0 && visibleSuppliers.every(supplier => selected.includes(supplier.id))} onChange={toggleAll} aria-label="Select visible suppliers" />
                  </Th>
                }
                columns={['Supplier', 'Country / Tax ID', 'Category / Products', 'Status', 'Risk', 'Performance', 'Qualification', 'Sourcing', 'Owner', 'Last Updated', '']}
              />
              <tbody>
                {visibleSuppliers.map(s => (
                  <Tr key={s.id}>
                    <Td>
                      <Checkbox checked={selected.includes(s.id)} onChange={() => setSelected(p => p.includes(s.id) ? p.filter(id => id !== s.id) : [...p, s.id])} aria-label={`Select ${s.name}`} />
                    </Td>
                    <Td>
                      <button type="button" onClick={() => onOpenSupplier(s)} className="rounded-sm text-left">
                        <CellStack primary={s.name} secondary={s.id} mono tone="link" />
                      </button>
                    </Td>
                    <Td><CellStack primary={s.country} tone="plain" secondary={s.taxId || 'No tax ID'} mono /></Td>
                    <Td><CellStack primary={s.materialGroup || s.category} tone="plain" secondary={s.productTypes?.join(', ') || s.category} /></Td>
                    <Td><StatusBadge status={s.status} small /></Td>
                    <Td><Badge tone={riskTone[s.risk] ?? 'neutral'} small>{s.risk}</Badge></Td>
                    <Td><PerfBar value={s.perf} /></Td>
                    <Td><StatusBadge status={s.qualificationStatus || s.qual} small /></Td>
                    <Td>{getSourcing(s.id) ? <StageBadge stage={getSourcing(s.id)!.stage} small /> : <span className="text-caption text-ink-muted">Not in sourcing</span>}</Td>
                    <Td className="whitespace-nowrap">{s.owner}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{s.lastUpdated || s.lastReview}</Td>
                    <Td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Button variant="link" onClick={() => onOpenSupplier(s)}>View profile</Button>
                        <span aria-hidden="true" className="text-line">|</span>
                        <Button variant="link-muted" onClick={() => onOpenSupplier(s, 'Profile')}>Edit</Button>
                        <span aria-hidden="true" className="text-line">|</span>
                        <Button variant="link-muted" onClick={() => setManaging(s)}>{getSourcing(s.id) ? 'Manage sourcing' : 'Mark interested'}</Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
          {filtered.length === 0 && (
            <EmptyState
              title="No suppliers match these filters"
              description="Try a different search term or clear the active filters."
              action={<Button onClick={resetFilters}>Reset filters</Button>}
            />
          )}
          {/* Pagination */}
          <Pagination
            summary={<>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} suppliers</>}
            page={page}
            pageCount={pageCount}
            onPrevious={() => setPage(current => Math.max(1, current - 1))}
            onNext={() => setPage(current => Math.min(pageCount, current + 1))}
          />
        </Card>

      {managing && <SourcingModal supplier={managing} onClose={() => setManaging(null)} />}
    </div>
  );
}
