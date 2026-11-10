import { useState } from 'react';
import Header from '../components/Header';
import SampleRequests, { sampleStatusTone } from '../components/SampleRequests';
import ExportButton from '../components/ExportButton';
import { ArrowRightIcon } from '../components/icons';
import StatusBadge from '../components/StatusBadge';
import CompanyInformation from '../components/CompanyInformation';
import { NewTaskModal } from '../components/NewTaskModal';
import { suppliers } from '../data/suppliers';
import { onboardingCompanies as companies, stepNames, statusHistory, type DocumentStatus, type OnboardingCompany } from '../data/onboarding';
import { isSampleOpen, sampleRequests, type SampleRequest } from '../data/samples';
import { useNavigation } from '../NavigationContext';
import { demoActors } from '../qsl/actors';
import SampleTracking from './onboarding/SampleTracking';
import { Avatar, BackLink, Badge, Button, Callout, Card, CardBody, CardHeader, CellStack, EmptyState, Grid, HeadRow, KpiCard, KpiGrid, Page, PageContent, ProgressBar, SearchInput, Select, Stepper, Table, TableContainer, Td, Toolbar, Tr, cx, toneFill, type Tone } from '../components/ui';


function sampleOverview(samples: SampleRequest[]): { label: string; tone: Tone; detail: string } {
  if (!samples.length) return { label: 'Not required', tone: 'neutral', detail: 'No sample requested' };
  const active = samples.find(isSampleOpen);
  if (active) return { label: active.status, tone: sampleStatusTone[active.status], detail: `${active.id} · ${active.product}` };
  const rejected = samples.filter(sample => sample.status === 'Rejected').length;
  return { label: rejected ? 'Decision made' : 'Approved', tone: rejected ? 'warning' : 'success', detail: `${samples.length - rejected} approved · ${rejected} rejected` };
}

function documentBadge(status: DocumentStatus) {
  if (status === 'Verified') return <StatusBadge status="Approved" small />;
  if (status === 'Rejected') return <StatusBadge status="Rejected" small />;
  if (status === 'Under review') return <StatusBadge status="In Progress" small />;
  return <StatusBadge status="Pending" small />;
}

function SyncIndicator({ status }: { status: OnboardingCompany['syncStatus'] }) {
  return <span aria-hidden="true" className={cx('h-1.5 w-1.5 shrink-0 rounded-full', status === 'Synced' ? toneFill.success : toneFill.warning)} />;
}

export default function Onboarding() {
  const { section, role, navigate } = useNavigation();
  const actor = demoActors[role];
  const [taskFor, setTaskFor] = useState<{ supplierId?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<OnboardingCompany | null>(null);
  const [search, setSearch] = useState('');
  const [stepFilter, setStepFilter] = useState('All stages');

  const filtered = companies.filter(company =>
    (company.name.toLowerCase().includes(search.toLowerCase()) || company.id.toLowerCase().includes(search.toLowerCase())) &&
    (stepFilter === 'All stages' || company.step === stepFilter)
  );

  const taskModal = taskFor && (
    <NewTaskModal
      actor={{ name: actor.name, role: actor.role }}
      supplierId={taskFor.supplierId}
      onClose={() => setTaskFor(null)}
      onCreated={id => { setTaskFor(null); setNotice(`Task ${id} created and sent to the supplier`); }}
    />
  );
  const noticeBar = notice && <Callout tone="success" title={notice} actions={<Button onClick={() => navigate('tasks')}>Open Supplier Tasks</Button>} />;

  if (selected) {
    const requiredDocuments = selected.documents.filter(document => document.required);
    const verified = requiredDocuments.filter(document => document.status === 'Verified').length;
    const missing = requiredDocuments.filter(document => document.status === 'Missing');
    const attention = requiredDocuments.filter(document => document.status === 'Rejected');
    const activeStep = stepNames.indexOf(selected.step);
    const samples = sampleRequests[selected.id] ?? [];
    const summary: { label: string; value: string; note: string; tone: Tone }[] = [
      { label: 'Onboarding progress', value: `${selected.progress}%`, note: `${selected.days} days in onboarding`, tone: 'brand' },
      { label: 'Required documents', value: `${verified}/${requiredDocuments.length}`, note: 'Verified by third party', tone: 'success' },
      { label: 'Missing documents', value: `${missing.length}`, note: missing.length ? 'Waiting for supplier' : 'Nothing missing', tone: missing.length ? 'danger' : 'success' },
      { label: 'Needs attention', value: `${attention.length}`, note: attention.length ? 'Rejected by verifier' : 'No rejected documents', tone: attention.length ? 'warning' : 'neutral' },
      { label: 'Sample requests', value: `${samples.length}`, note: samples.length ? `${samples.filter(isSampleOpen).length} in progress · ${samples.filter(sample => !isSampleOpen(sample)).length} decided` : 'None requested', tone: 'neutral' },
    ];

    return (
      <Page>
        <Header breadcrumb={['Supplier lifecycle', 'Supplier Onboarding', selected.id]} title={selected.name} />
        <PageContent>
          <BackLink onClick={() => setSelected(null)}>Back to onboarding companies</BackLink>
          {noticeBar}

          <Card padded>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar initials={selected.name[0]} size="lg" shape="square" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-ink">{selected.name}</div>
                    <StatusBadge status="In Progress" small />
                  </div>
                  <div className="mt-1 text-caption text-ink-muted">{selected.id} · {selected.category} · {selected.country} · {selected.requestType} · Owner {selected.owner}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" onClick={() => setTaskFor({ supplierId: selected.id })}>Assign task to supplier</Button>
                <div className="sm:text-right">
                  <div className="flex items-center gap-1.5 sm:justify-end">
                    <SyncIndicator status={selected.syncStatus} />
                    <span className="text-caption font-medium text-ink-soft">{selected.syncStatus}</span>
                  </div>
                  <div className="mt-1 text-caption text-ink-muted">{selected.source} · {selected.lastSync}</div>
                </div>
              </div>
            </div>

            <Stepper
              steps={stepNames.map((step, index) => ({
                label: step,
                caption: index < activeStep ? 'Completed' : index === activeStep ? 'In progress' : 'Pending',
                state: index < activeStep ? 'done' : index === activeStep ? 'active' : 'todo',
              }))}
            />
          </Card>

          <Card>
            <CardHeader title="Onboarding status history" />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(statusHistory[selected.id] || []).map((event, index) => (
                <div key={`${event.date}-${index}`} className="border-l-2 border-brand-200 pl-3">
                  <div className="text-caption text-ink-muted">{event.date} · {event.source}</div>
                  <div className="mt-1 text-body font-medium text-ink">{event.status}</div>
                </div>
              ))}
              {!statusHistory[selected.id]?.length && <div className="text-caption text-ink-muted">No status history received from source.</div>}
            </CardBody>
          </Card>

          <KpiGrid cols={5}>
            {summary.map(card => <KpiCard key={card.label} label={card.label} value={card.value} note={card.note} tone={card.tone} />)}
          </KpiGrid>

          <Grid cols="split3">
            <Card className="overflow-hidden xl:col-span-2">
              <CardHeader
                title="Document verification status"
                description={`Verification results are provided by ${selected.source}. SLM displays the latest API data.`}
                actions={<span className="text-caption text-ink-muted">{`${verified} of ${requiredDocuments.length} required verified`}</span>}
              />
              <TableContainer>
                <Table minWidth={640}>
                  <HeadRow columns={['Document', 'Requirement', 'Verification', 'Updated', 'Source result']} />
                  <tbody>
                    {selected.documents.map(document => (
                      <Tr key={document.name}>
                        <Td className="font-medium text-ink">{document.name}</Td>
                        <Td><span className={cx('text-caption', document.required ? 'font-medium text-ink-soft' : 'text-ink-muted')}>{document.required ? 'Required' : 'Optional'}</span></Td>
                        <Td>{documentBadge(document.status)}</Td>
                        <Td className="text-ink-muted">{document.updated}</Td>
                        <Td className="text-ink-muted">{document.note}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title="What's still needed" description="Items blocking the next onboarding stage" />
                <CardBody>
                  {missing.length === 0 && attention.length === 0 ? (
                    <Callout tone="success">All required documents have been received and verified.</Callout>
                  ) : (
                    <div className="space-y-2">
                      {[...missing, ...attention].map(document => (
                        <div key={document.name} className={cx('rounded-control border p-3', document.status === 'Rejected' ? 'border-danger-200 bg-danger-50' : 'border-warning-200 bg-warning-50')}>
                          <div className="text-body font-medium text-ink">{document.name}</div>
                          <div className={cx('mt-1 text-caption', document.status === 'Rejected' ? 'text-danger-700' : 'text-warning-700')}>{document.status === 'Rejected' ? document.note : 'Supplier has not submitted this document'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Callout tone="info" title="System responsibility">
                Document verification is completed in <span className="font-semibold">{selected.source}</span>. SLM receives statuses through API and highlights missing or rejected requirements for onboarding follow-up.
                <div className="mt-3 border-t border-info-200 pt-3">
                  <span className="text-caption text-ink-muted">Last sync: {selected.lastSync}</span>
                </div>
              </Callout>
            </div>
          </Grid>

          <Card>
            <CardHeader title="Company information" description="Registration details of the supplier, shown from the company registry where one is available" />
            <CardBody><CompanyInformation supplier={{ id: selected.id, name: selected.name, country: selected.country, taxId: suppliers.find(item => item.id === selected.id)?.taxId }} /></CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Sample requests"
              description="Tracking overview of the samples requested for this supplier. Requests are created in Sample Request Tracking."
            />
            <SampleRequests key={selected.id} samples={samples} supplierId={selected.id} readOnly />
          </Card>
        </PageContent>
        {taskModal}
      </Page>
    );
  }

  return (
    <Page>
      <Header breadcrumb={['Supplier lifecycle', 'Supplier Onboarding']} title={section === 'samples' ? 'Sample Request Tracking' : 'Onboarding Register'} />
      <PageContent>
        {noticeBar}
        {section === 'samples' ? <SampleTracking /> : (<>
        <KpiGrid cols={4}>
          <KpiCard label="In onboarding" value={companies.length} note={`${companies.filter(company => company.syncStatus === 'Synced').length} synced today`} tone="brand" />
          <KpiCard label="Missing or rejected documents" value={companies.reduce((total, company) => total + company.documents.filter(document => document.required && (document.status === 'Missing' || document.status === 'Rejected')).length, 0)} note={`Across ${companies.filter(company => company.documents.some(document => document.required && (document.status === 'Missing' || document.status === 'Rejected'))).length} companies`} tone="danger" />
          <KpiCard label="Third-party review" value={companies.reduce((total, company) => total + company.documents.filter(document => document.status === 'Under review').length, 0)} note="Awaiting verification" tone="warning" />
          <KpiCard label="Average time in onboarding" value={`${Math.round(companies.reduce((total, company) => total + company.days, 0) / companies.length)} days`} note="Across open onboarding" tone="success" />
        </KpiGrid>

        <Card className="overflow-hidden">
          <CardHeader
            title="Companies in onboarding"
            description="Third-party verification data and outstanding onboarding requirements"
            actions={
              <Toolbar actions={<><ExportButton filename="slm-onboarding-register" columns={['Supplier ID', 'Company', 'Request type', 'Current stage', 'Progress %', 'Required documents verified', 'Data source', 'Owner', 'Days in onboarding']} rows={filtered.map(company => { const required = company.documents.filter(document => document.required); return [company.id, company.name, company.requestType, company.step, company.progress, `${required.filter(document => document.status === 'Verified').length}/${required.length}`, company.source, company.owner, company.days]; })} /><Button variant="primary" size="md" onClick={() => setTaskFor({})}>Assign task to supplier</Button></>}>
                <SearchInput value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-64" placeholder="Search company or supplier ID..." />
                <Select aria-label="Filter by stage" value={stepFilter} onChange={event => setStepFilter(event.target.value)}>
                  <option>All stages</option>
                  {stepNames.slice(0, -1).map(step => <option key={step}>{step}</option>)}
                </Select>
              </Toolbar>
            }
          />

          <TableContainer>
            <Table minWidth={1280}>
              <HeadRow columns={['Company', 'Request type', 'Current stage', 'Progress', 'Documents', 'Sample request', 'Data source', 'Owner', 'Days', '']} />
              <tbody>
                {filtered.map(company => {
                  const required = company.documents.filter(document => document.required);
                  const verified = required.filter(document => document.status === 'Verified').length;
                  const missing = required.filter(document => document.status === 'Missing' || document.status === 'Rejected').length;
                  const sample = sampleOverview(sampleRequests[company.id] ?? []);
                  return (
                    <Tr key={company.id} onClick={() => setSelected(company)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar initials={company.name[0]} shape="square" />
                          <div><CellStack primary={company.name} secondary={`${company.id} · ${company.category} · ${company.country}`} /></div>
                        </div>
                      </Td>
                      <Td>{company.requestType}</Td>
                      <Td><Badge tone="brand" small>{company.step}</Badge></Td>
                      <Td>
                        <div className="flex items-center gap-2"><ProgressBar value={company.progress} label={`${company.name} onboarding progress`} className="w-20" /><span className="text-caption tabular-nums text-ink-soft">{company.progress}%</span></div>
                      </Td>
                      <Td>
                        <div className="text-caption font-medium text-ink-soft">{verified}/{required.length} verified</div>
                        <div className={cx('mt-0.5 text-caption', missing ? 'text-danger-700' : 'text-success-700')}>{missing ? `${missing} missing or rejected` : 'Complete'}</div>
                      </Td>
                      <Td>
                        <Badge tone={sample.tone} small>{sample.label}</Badge>
                        <div className="mt-0.5 max-w-52 truncate text-caption text-ink-muted" title={sample.detail}>{sample.detail}</div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5"><SyncIndicator status={company.syncStatus} /><span className="text-caption text-ink-soft">{company.source}</span></div>
                        <div className="mt-0.5 text-caption text-ink-muted">{company.lastSync}</div>
                      </Td>
                      <Td>{company.owner}</Td>
                      <Td className="text-ink-muted">{company.days}d</Td>
                      <Td>
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <Button variant="link" onClick={event => { event.stopPropagation(); setSelected(company); }}>View details <ArrowRightIcon className="h-3.5 w-3.5" /></Button>
                          <Button variant="link-muted" onClick={event => { event.stopPropagation(); setTaskFor({ supplierId: company.id }); }}>Assign task</Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableContainer>
          {filtered.length === 0 && <EmptyState title="No onboarding companies match these filters." description="Adjust the search or stage filter to see more results." />}
        </Card>
        </>)}
      </PageContent>
      {taskModal}
    </Page>
  );
}
