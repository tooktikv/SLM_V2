import { useState } from 'react';
import Header from '../components/Header';
import ComplianceTracker from '../components/ComplianceTracker';
import { ArrowRightIcon } from '../components/icons';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { complianceCompanies as companies, complianceGroups, daysLabel, needsAttention, type ComplianceCompany } from '../data/compliance';
import { isSampleOpen, sampleRequests } from '../data/samples';
import { suppliers } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { DocumentRegister, FindingsHistory } from './compliance/ComplianceSections';
import { BackLink, Badge, Button, Callout, Card, CardBody, CardHeader, CellStack, EmptyState, Grid, HeadRow, KpiCard, KpiGrid, Page, PageContent, SearchInput, Select, Table, TableContainer, Td, Toolbar, Tr, cx, type Tone } from '../components/ui';

const scoreText = (score: number) => (score >= 85 ? 'text-success-700' : score >= 70 ? 'text-warning-700' : 'text-danger-700');

export default function Compliance() {
  const { navigate, openSupplier, section, focusSupplierId } = useNavigation();
  const [selected, setSelected] = useState<ComplianceCompany | null>(() => companies.find(company => company.id === focusSupplierId) ?? null);
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
    const actionDocs = selected.items.filter(needsAttention);
    const summary: { label: string; value: string; note: string; tone: Tone; size?: 'md' }[] = [
      { label: 'Compliance score', value: `${selected.compliance}%`, note: 'Portfolio requirements', tone: selected.compliance >= 85 ? 'success' : 'warning' },
      { label: 'Items tracked', value: `${selected.items.length}`, note: `${new Set(selected.items.map(item => item.group)).size} tracking types · ${(sampleRequests[selected.id] ?? []).length} sample requests`, tone: 'brand' },
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

          <Grid cols="split3">
            <Card className="xl:col-span-2">
              <CardHeader title="Follow-up tasks" description="Items that are missing, overdue or due soon" actions={<Button variant="link">Manage cadence</Button>} />
              <CardBody className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {actionDocs.map(document => (
                  <div key={`${document.group}-${document.name}`} className={cx('rounded-control border p-3', document.status === 'Expired' || document.status === 'Missing' ? 'border-danger-200 bg-danger-50' : 'border-warning-200 bg-warning-50')}>
                    <div className="flex justify-between gap-2"><div className="text-body font-medium text-ink">{document.name}</div><div className={cx('whitespace-nowrap text-caption font-semibold', document.status === 'Expiring' ? 'text-warning-700' : 'text-danger-700')}>{document.status}</div></div>
                    <div className="mt-1 text-caption text-ink-muted">{document.group} · {daysLabel(document.daysLeft)} · Owner {document.owner}</div>
                    <div className="mt-2 flex items-center gap-2"><Button variant="link-muted" onClick={() => navigate('car')}>Create follow-up</Button></div>
                  </div>
                ))}
                {actionDocs.length === 0 && <Callout tone="success" className="md:col-span-2">No follow-up action is required.</Callout>}
              </CardBody>
            </Card>
            <Callout tone="info" title="Suggested reminder cadence" className="self-start">
              <ul className="mt-1 space-y-1.5"><li>90 days — notify procurement owner</li><li>60 days — request supplier renewal</li><li>30 days — escalate to category manager</li><li>Expired — create compliance blocker</li></ul>
            </Callout>
          </Grid>

          <Card className="overflow-hidden">
            <CardHeader title="Compliance tracker" description="Verification is performed by connected third-party sources; SLM displays the latest status." />
            <ComplianceTracker companyId={selected.id} />
          </Card>
        </PageContent>
      </Page>
    );
  }

  const allDocuments = companies.flatMap(company => company.items);
  const allSamples = Object.values(sampleRequests).flat();
  const openSamples = allSamples.filter(isSampleOpen);
  const lateSamples = openSamples.filter(sample => sample.daysLeft !== null && sample.daysLeft < 0);
  const overviewCards: { label: string; value: number; note: string; tone: Tone }[] = [
    { label: 'Compliant companies', value: companies.filter(company => company.compliance >= 85).length, note: 'No immediate action', tone: 'success' },
    { label: 'Due in 90 days', value: allDocuments.filter(document => document.daysLeft !== null && document.daysLeft >= 0 && document.daysLeft <= 90).length, note: 'Based on expiry and due dates', tone: 'warning' },
    { label: 'Expired / overdue items', value: allDocuments.filter(document => document.status === 'Expired').length, note: 'Procurement attention required', tone: 'danger' },
    { label: 'Missing items', value: allDocuments.filter(document => document.status === 'Missing').length, note: 'Supplier follow-up required', tone: 'danger' },
    { label: 'No data received', value: allDocuments.filter(document => document.status === 'No data received').length, note: 'Source has not provided a record', tone: 'neutral' },
  ];

  return (
    <Page>
      <Header breadcrumb={['Monitor', 'Compliance & Monitoring']} title={section === 'documents' ? 'Document Register' : section === 'findings' ? 'Findings & History' : 'Supplier Monitoring'} />
      <PageContent>
        {section === 'documents' && <DocumentRegister />}
        {section === 'findings' && <FindingsHistory />}
        {section !== 'documents' && section !== 'findings' && (<>
        <KpiGrid cols={5}>
          {overviewCards.map(card => <KpiCard key={card.label} label={card.label} value={card.value} note={card.note} tone={card.tone} />)}
        </KpiGrid>

        <Card>
          <CardHeader title="What SLM tracks" description="Beyond documents, each obligation has its own trigger, owner and reminder" />
          <CardBody>
            <Grid cols={3}>
              {complianceGroups.map(group => {
                const groupItems = allDocuments.filter(item => item.group === group.group);
                const attention = groupItems.filter(needsAttention).length;
                return (
                  <div key={group.group} className="rounded-control border border-line p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-body font-semibold text-ink">{group.title}</div>
                      <Badge tone={attention ? 'warning' : 'success'} small>{attention ? `${attention} need attention` : 'On track'}</Badge>
                    </div>
                    <p className="mt-1 text-caption text-ink-muted">{group.summary}</p>
                    <div className="mt-3 flex items-baseline gap-1.5"><span className="text-xl font-semibold tabular-nums text-ink">{groupItems.length}</span><span className="text-caption text-ink-muted">items tracked</span></div>
                    <div className="mt-2 border-t border-line-subtle pt-2 text-caption text-ink-muted">Trigger: {group.trigger}</div>
                  </div>
                );
              })}
              <div className="rounded-control border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-body font-semibold text-ink">Sample requests</div>
                  <Badge tone={lateSamples.length ? 'danger' : 'success'} small>{lateSamples.length ? `${lateSamples.length} past required date` : 'On track'}</Badge>
                </div>
                <p className="mt-1 text-caption text-ink-muted">Product samples requested for approval, testing or cost comparison</p>
                <div className="mt-3 flex items-baseline gap-1.5"><span className="text-xl font-semibold tabular-nums text-ink">{openSamples.length}</span><span className="text-caption text-ink-muted">open of {allSamples.length} requests</span></div>
                <div className="mt-2 border-t border-line-subtle pt-2 text-caption text-ink-muted">Trigger: Required-by date · lab result decision</div>
              </div>
            </Grid>
          </CardBody>
        </Card>

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
