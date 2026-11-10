import { useState } from 'react';
import Header from '../components/Header';
import ComplianceTracker from '../components/ComplianceTracker';
import { ArrowRightIcon } from '../components/icons';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { complianceCompanies as companies, daysLabel, needsAttention, type ComplianceCompany } from '../data/compliance';
import { isSampleOpen, sampleRequests } from '../data/samples';
import { useRenewals } from '../data/renewals';
import { suppliers } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { DocumentRenewal } from './compliance/DocumentRenewal';
import { BackLink, Button, Card, CardHeader, CellStack, EmptyState, HeadRow, KpiCard, KpiGrid, Page, PageContent, SearchInput, Select, Table, TableContainer, Tabs, Td, Toolbar, Tr, cx, type Tone } from '../components/ui';

const scoreText = (score: number) => (score >= 85 ? 'text-success-700' : score >= 70 ? 'text-warning-700' : 'text-danger-700');

type Tab = 'overview' | 'renewal';

export default function Compliance() {
  const { navigate, openSupplier, section, focusSupplierId } = useNavigation();
  useRenewals();
  // Deep links choose the starting tab; a supplier link opens its detail on the overview tab.
  const [tab, setTab] = useState<Tab>(section === 'renewal' ? 'renewal' : 'overview');
  const [selected, setSelected] = useState<ComplianceCompany | null>(() => (section === 'renewal' ? null : companies.find(company => company.id === focusSupplierId) ?? null));
  const [search, setSearch] = useState('');
  const [attentionFilter, setAttentionFilter] = useState('All attention levels');
  const filtered = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(search.toLowerCase()) || company.id.toLowerCase().includes(search.toLowerCase());
    const matchesAttention = attentionFilter === 'All attention levels' || company.items.some(document => {
      if (attentionFilter === 'Missing') return document.status === 'Missing';
      if (attentionFilter === 'No data received') return document.status === 'No data received';
      if (attentionFilter === 'Expired') return document.status === 'Expired';
      if (attentionFilter === 'Expiring in 30 days') return document.daysLeft !== null && document.daysLeft >= 0 && document.daysLeft <= 30;
      if (attentionFilter === 'Expiring in 90 days') return document.daysLeft !== null && document.daysLeft >= 0 && document.daysLeft <= 90;
      return true;
    });
    return matchesSearch && matchesAttention;
  });

  const openSupplierProfile = (id: string) => {
    const supplier = suppliers.find(item => item.id === id);
    if (supplier) openSupplier(supplier, 'Compliance');
  };

  if (selected) {
    const trackedItems = selected.items.filter(item => item.group !== 'Documents');
    const actionDocs = trackedItems.filter(needsAttention);
    const summary: { label: string; value: string; note: string; tone: Tone; size?: 'md' }[] = [
      { label: 'Compliance score', value: `${selected.compliance}%`, note: 'Portfolio requirements', tone: selected.compliance >= 85 ? 'success' : 'warning' },
      { label: 'Items tracked', value: `${trackedItems.length}`, note: `${new Set(trackedItems.map(item => item.group)).size} tracking types · ${(sampleRequests[selected.id] ?? []).length} sample requests`, tone: 'brand' },
      { label: 'Follow-up tasks', value: `${actionDocs.length}`, note: 'Missing, overdue or due soon', tone: actionDocs.length ? 'danger' : 'success' },
      { label: 'Last API sync', value: selected.lastSync, note: 'Across verification sources', tone: 'neutral', size: 'md' },
    ];
    return (
      <Page>
        <Header breadcrumb={['Monitor', 'Compliance & Monitoring', selected.id]} title={selected.name} action={{ label: 'Open Supplier Profile', onClick: () => openSupplierProfile(selected.id) }} />
        <PageContent>
          <BackLink onClick={() => setSelected(null)}>Back to companies</BackLink>

          <KpiGrid cols={4}>
            {summary.map(card => <KpiCard key={card.label} label={card.label} value={card.value} note={card.note} tone={card.tone} size={card.size} />)}
          </KpiGrid>

          <Card className="overflow-hidden">
            <CardHeader title="Compliance tracker" description="Verification is performed by connected third-party sources; SLM displays the latest status." />
            <ComplianceTracker companyId={selected.id} onOpenDocuments={() => navigate('compliance', 'renewal', selected.id)} />
          </Card>
        </PageContent>
      </Page>
    );
  }

  const allDocuments = companies.flatMap(company => company.items);
  const overviewCards: { label: string; value: number; note: string; tone: Tone }[] = [
    { label: 'Compliant companies', value: companies.filter(company => company.compliance >= 85).length, note: 'No immediate action', tone: 'success' },
    { label: 'Due in 90 days', value: allDocuments.filter(document => document.daysLeft !== null && document.daysLeft >= 0 && document.daysLeft <= 90).length, note: 'Based on expiry and due dates', tone: 'warning' },
    { label: 'Expired / overdue items', value: allDocuments.filter(document => document.status === 'Expired').length, note: 'Procurement attention required', tone: 'danger' },
    { label: 'Missing items', value: allDocuments.filter(document => document.status === 'Missing').length, note: 'Supplier follow-up required', tone: 'danger' },
    { label: 'No data received', value: allDocuments.filter(document => document.status === 'No data received').length, note: 'Source has not provided a record', tone: 'neutral' },
  ];

  return (
    <Page>
      <Header breadcrumb={['Monitor', 'Compliance & Monitoring']} title="Compliance & Monitoring" />
      <PageContent>
        <Tabs<Tab> label="Compliance sections" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Compliance overview' }, { value: 'renewal', label: 'Document renewal' }]} />
        {tab === 'renewal' && <DocumentRenewal initialSearch={companies.find(company => company.id === focusSupplierId)?.name} />}
        {tab === 'overview' && (<>
        <KpiGrid cols={5}>
          {overviewCards.map(card => <KpiCard key={card.label} label={card.label} value={card.value} note={card.note} tone={card.tone} />)}
        </KpiGrid>

        <Card className="overflow-hidden">
          <CardHeader
            title="Company compliance overview"
            description="Prioritized by upcoming due dates and gaps"
            actions={
              <Toolbar actions={<ExportButton filename="slm-compliance-overview" columns={['Supplier ID', 'Company', 'Category', 'Compliance %', 'Tracked items', 'Expiring within 90 days', 'Expired or missing', 'No data', 'Owner', 'Last sync']} rows={filtered.map(company => [company.id, company.name, company.category, company.compliance, company.items.length, company.items.filter(document => document.daysLeft !== null && document.daysLeft >= 0 && document.daysLeft <= 90).length, company.items.filter(document => document.status === 'Expired' || document.status === 'Missing').length, company.items.filter(document => document.status === 'No data received').length, company.owner, company.lastSync])} />}>
                <SearchInput value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-56" placeholder="Search company..." />
                <Select aria-label="Filter by attention level" value={attentionFilter} onChange={event => setAttentionFilter(event.target.value)}><option>All attention levels</option><option>Expired</option><option>Expiring in 30 days</option><option>Expiring in 90 days</option><option>Missing</option><option>No data received</option></Select>
              </Toolbar>
            }
          />
          <TableContainer>
            <Table minWidth={1280}>
              <HeadRow columns={['Company', 'Qualification', 'Risk', 'Compliance', 'Tracked items', 'Expiring ≤90d', 'Expired / Missing', 'Open samples', 'Next due', 'Owner', 'Last sync', '']} />
              <tbody>
                {filtered.map(company => {
                  const master = suppliers.find(supplier => supplier.id === company.id);
                  const expiring = company.items.filter(document => document.daysLeft !== null && document.daysLeft >= 0 && document.daysLeft <= 90).length;
                  const blockers = company.items.filter(document => document.status === 'Expired' || document.status === 'Missing').length;
                  const noData = company.items.filter(document => document.status === 'No data received').length;
                  const dated = company.items.filter(document => document.daysLeft !== null && document.daysLeft >= 0).sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));
                  const companyOpenSamples = (sampleRequests[company.id] ?? []).filter(isSampleOpen);
                  const companyLateSamples = companyOpenSamples.filter(sample => sample.daysLeft !== null && sample.daysLeft < 0).length;
                  return (
                    <Tr key={company.id} onClick={() => setSelected(company)}>
                      <Td><CellStack primary={company.name} secondary={`${company.id} · ${company.category}`} /></Td>
                      <Td><StatusBadge status={master?.qualificationStatus || 'Pending'} small /></Td>
                      <Td><StatusBadge status={master?.risk || 'Pending'} small /></Td>
                      <Td><div className={cx('text-sm font-semibold tabular-nums', scoreText(company.compliance))}>{company.compliance}%</div></Td>
                      <Td>{company.items.length}</Td>
                      <Td><span className={cx('font-semibold tabular-nums', expiring ? 'text-warning-700' : 'text-ink-muted')}>{expiring}</span></Td>
                      <Td><span className={cx('font-semibold tabular-nums', blockers ? 'text-danger-700' : 'text-success-700')}>{blockers}</span><div className="text-caption text-ink-muted">{noData} no data</div></Td>
                      <Td><span className="font-semibold tabular-nums text-ink-soft">{companyOpenSamples.length}</span>{companyLateSamples > 0 && <div className="text-caption text-danger-700">{companyLateSamples} late</div>}</Td>
                      <Td><div className="text-body text-ink-soft">{dated[0]?.name || '—'}</div><div className={cx('mt-0.5 text-caption', dated[0] && (dated[0].daysLeft || 0) <= 30 ? 'text-danger-700' : 'text-ink-muted')}>{dated[0] ? daysLabel(dated[0].daysLeft) : 'No dated item'}</div></Td>
                      <Td>{company.owner}</Td>
                      <Td className="whitespace-nowrap text-ink-muted">{company.lastSync}</Td>
                      <Td><Button variant="link" className="whitespace-nowrap" onClick={() => setSelected(company)}>View tasks <ArrowRightIcon className="h-3.5 w-3.5" /></Button></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableContainer>
          {filtered.length === 0 && <EmptyState title="No companies match these filters" description="Adjust the search or attention level to see more results." />}
        </Card>
        </>)}
      </PageContent>
    </Page>
  );
}
