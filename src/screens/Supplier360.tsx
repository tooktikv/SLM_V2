import { useState, type ReactNode } from 'react';
import Header from '../components/Header';
import ComplianceTracker from '../components/ComplianceTracker';
import StatusBadge from '../components/StatusBadge';
import { Supplier } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { getCurrentActor } from '../qsl/actors';
import { useQslQuery } from '../qsl/useQsl';
import { getSupplierQualification } from '../qsl/services/queries';
import { ResultBadge, StandingBadge, formatDate } from './qualification/shared';
import { getSupplierLink } from '../integration';
import { useIntegrationRevision } from '../integration/useIntegration';
import { getSourcing } from '../sourcing';
import { useSourcingRevision } from '../sourcing/useSourcing';
import SourcingModal from './sourcing/SourcingModal';
import { StageBadge } from './sourcing/shared';
import ContactsTab from './supplier360/ContactsTab';
import DocumentsTab from './supplier360/DocumentsTab';
import CompanyInformation from '../components/CompanyInformation';
import { supplierProfiles } from '../data/contacts';
import { Avatar, BackLink, Badge, Button, Card, CardBody, CardHeader, DetailGrid, EmptyState, Eyebrow, Grid, HeadRow, KpiGrid, Page, PageBody, PageScroll, ProgressBar, Stepper, Table, TableContainer, Tabs, Td, Tr, cx, toneFill, type StepState, type Tone } from '../components/ui';

const tabs = ['Overview', 'Profile', 'Contacts', 'Capabilities', 'Qualification', 'Risk', 'Performance', 'Documents', 'Compliance', 'Audit', 'CAR', 'Activities'];

const lifecycleStages = ['Registered', 'Onboarded', 'Qualified', 'Approved', 'Active'];

const lifecycleDates: Record<string, Record<string, string>> = {
  'SUP-0012': { Registered: 'Jan 12, 2021', Onboarded: 'Feb 3, 2021', Qualified: 'Mar 15, 2021', Approved: 'Apr 1, 2021', Active: 'Since Apr 1, 2021' },
};

const requalificationHint = 'Optional step for suppliers that must be re-verified, for example after an expired certificate, a risk change or a scheduled reassessment. Locked until a requalification is requested.';

// Checks that run while a supplier is Active, not sequential stages.
const ongoingMonitoring = ['Risk review · Sep 2, 2024', 'Performance review · Aug 20, 2024', 'Audit · 3 open findings', 'CAR · 2 open'];

function lifecycleFor(supplier: Supplier): { label: string; caption: string; state: StepState; hint?: string }[] {
  const qualification = supplier.qualificationStatus || supplier.qual;
  const needsRequalification = supplier.status === 'Active' && (qualification === 'Pending' || qualification === 'Expired');
  const current = supplier.status === 'Draft' ? 0 : supplier.status === 'Pending' || supplier.status === 'Rejected' ? 2 : lifecycleStages.length;
  const dates = lifecycleDates[supplier.id] ?? {};
  const stages = lifecycleStages.map((stage, index) => {
    const state: StepState = index < current ? 'done' : index === current ? 'active' : 'todo';
    const fallback = state === 'done' ? 'Completed' : state === 'active' ? (supplier.status === 'Rejected' ? 'Not passed' : 'In progress') : 'Not started';
    return { label: stage, caption: dates[stage] ?? fallback, state };
  });
  return [...stages, { label: 'Requalification', caption: needsRequalification ? 'Required' : 'Not required', state: 'locked', hint: requalificationHint }];
}

const activities = [
  { date: 'Sep 2, 2024', event: 'Risk score updated after financial review', area: 'Risk' },
  { date: 'Aug 20, 2024', event: 'Q2 performance review submitted', area: 'Performance' },
  { date: 'Jul 1, 2024', event: 'CAR-2024-118 issued for a quality defect', area: 'CAR' },
  { date: 'May 15, 2024', event: 'Annual requalification assessment started', area: 'Qualification' },
  { date: 'Mar 10, 2024', event: 'Supply continuity review completed', area: 'Relationship' },
  { date: 'Jan 12, 2024', event: 'ISO 9001 certificate renewed', area: 'Document' },
];

const badgeColumns = ['Result', 'Status', 'Decision', 'Verification', 'Rating', 'Severity', 'CAP'];
const cellTones: Record<string, Tone> = {
  Pass: 'success', Compliant: 'success', Verified: 'success', Approved: 'success', Closed: 'success', 'On target': 'success', Low: 'success',
  Conditional: 'warning', Expiring: 'warning', 'Near target': 'warning', Medium: 'warning', Minor: 'warning', 'Supplier response': 'warning', 'Awaiting supplier': 'warning',
  High: 'danger', Major: 'danger', Missing: 'danger', Overdue: 'danger', 'Below target': 'danger', 'Revision requested': 'danger',
  'Under review': 'info', 'In progress': 'info', 'CAR raised': 'info', Open: 'info',
};

function riskBadgeTone(risk: string): Tone {
  return risk === 'Critical' || risk === 'High Risk' ? 'danger' : risk === 'Medium Risk' ? 'warning' : 'success';
}

function SectionCard({ title, action, onAction, children, className = '' }: { title: string; action?: string; onAction?: () => void; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} actions={action && <Button variant="link" onClick={onAction}>{action}</Button>} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function ScoreCard({ label, value, tone, note }: { label: string; value: string; tone: Tone; note: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-caption font-medium text-ink-muted">{label}</div>
        <span aria-hidden="true" className={cx('mt-1 h-2 w-2 shrink-0 rounded-full', toneFill[tone])} />
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-caption text-ink-muted">{note}</div>
    </Card>
  );
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <TableContainer className="rounded-control border border-line">
      <Table minWidth={columns.length * 120}>
        <HeadRow columns={columns} />
        <tbody>
          {rows.map((row, index) => (
            <Tr key={index}>
              {row.map((cell, cellIndex) => (
                <Td key={cellIndex} dense className={cx(cellIndex === 0 && 'font-medium text-ink')}>
                  {badgeColumns.includes(columns[cellIndex]) && cellTones[cell] ? <Badge tone={cellTones[cell]} small>{cell}</Badge> : cell}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}

export default function Supplier360({ supplier, initialTab, onBack }: { supplier: Supplier; initialTab?: string; onBack: () => void }) {
  const [tab, setTab] = useState(initialTab && tabs.includes(initialTab) ? initialTab : 'Overview');
  const { navigate } = useNavigation();
  const qualificationData = useQslQuery(() => getSupplierQualification(getCurrentActor(), supplier.id), [supplier.id]);
  useIntegrationRevision();
  useSourcingRevision();
  const [sourcingOpen, setSourcingOpen] = useState(false);
  const sourcing = getSourcing(supplier.id);
  const primaryContact = supplierProfiles[supplier.id]?.contacts.find(contact => contact.type === 'Primary');
  const externalLink = getSupplierLink(supplier.id);
  const qslItems = qualificationData.data?.items ?? [];
  const riskValue = supplier.risk === 'Critical' ? 78 : supplier.risk === 'High Risk' ? 68 : supplier.risk === 'Medium Risk' ? 46 : 24;
  const qualificationStatus = supplier.qualificationStatus || supplier.qual;
  const isQualified = qualificationStatus === 'Qualified';
  const health = supplier.perf ? Math.round((supplier.perf + (100 - riskValue) + (isQualified ? 92 : 58)) / 3) : 42;
  const initials = supplier.name.split(' ').slice(0, 2).map(word => word[0]).join('');
  const riskTone: Tone = supplier.risk === 'Critical' || supplier.risk === 'High Risk' ? 'danger' : supplier.risk === 'Medium Risk' ? 'warning' : 'success';

  const renderTab = () => {
    if (tab === 'Overview') {
      return (
        <div className="space-y-5">
          <KpiGrid cols={5}>
            <ScoreCard label="Health score" value={`${health}/100`} tone={health >= 75 ? 'success' : 'warning'} note="Combined lifecycle health" />
            <ScoreCard label="Risk score" value={`${riskValue}/100`} tone={riskTone} note={`${supplier.risk} · ↑ 8 this quarter`} />
            <ScoreCard label="Performance" value={supplier.perf ? `${supplier.perf}%` : 'N/A'} tone={supplier.perf >= 80 ? 'success' : 'warning'} note="Q2 weighted score" />
            <ScoreCard label="Qualification" value={qualificationStatus} tone={isQualified ? 'success' : 'warning'} note="Review due Dec 15, 2024" />
            <ScoreCard label="Compliance" value="82%" tone="success" note="9 of 11 requirements valid" />
          </KpiGrid>

          <Grid cols="split5">
            <SectionCard title="Needs attention" action="View all" onAction={() => setTab('Activities')} className="xl:col-span-3">
              <div className="space-y-2">
                {[
                  ['Critical', 'Financial risk increased after the latest credit review', 'Review assessment', 'Risk'],
                  ['High', 'ISO 14001 certificate expires in 83 days', 'Request renewal', 'Compliance'],
                  ['Medium', 'CAR-2024-118 is 5 days overdue', 'Follow up', 'CAR'],
                ].map(item => (
                  <div key={item[1]} className="flex flex-wrap items-center gap-3 rounded-control bg-canvas p-3">
                    <span aria-hidden="true" className={cx('h-8 w-1 shrink-0 rounded-full', item[0] === 'Critical' ? 'bg-danger-500' : item[0] === 'High' ? 'bg-warning-600' : 'bg-warning-500')} />
                    <div className="min-w-0 flex-1">
                      <div className="text-caption font-semibold text-ink">{item[0]}</div>
                      <div className="mt-0.5 text-caption text-ink-muted">{item[1]}</div>
                    </div>
                    <Button variant="link" onClick={() => setTab(item[3])}>{item[2]} →</Button>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Open work" action="Manage tasks" onAction={() => navigate('tasks')} className="xl:col-span-2">
              <div className="space-y-3">
                {[
                  ['Open CAR', '2', '1 overdue'],
                  ['Audit findings', '3', 'Due this month'],
                  ['Missing documents', '2', 'Supplier notified'],
                  ['Capability requests', '2', 'External verification'],
                ].map(item => (
                  <div key={item[0]} className="flex items-center justify-between border-b border-line-subtle pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="text-body font-medium text-ink-soft">{item[0]}</div>
                      <div className="mt-0.5 text-caption text-ink-muted">{item[2]}</div>
                    </div>
                    <div className="text-lg font-semibold tabular-nums text-ink">{item[1]}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </Grid>

          <SectionCard title="Supplier lifecycle" action="View complete history" onAction={() => setTab('Activities')}>
            <Stepper steps={lifecycleFor(supplier)} />
            {supplier.status === 'Active' && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
                <Eyebrow className="shrink-0">Ongoing while active</Eyebrow>
                {ongoingMonitoring.map(item => <Badge key={item} small>{item}</Badge>)}
              </div>
            )}
            <p className="mt-3 text-caption text-ink-muted">Active is the end of the main flow. Requalification is an optional follow-up step that stays locked until a supplier must be re-verified.</p>
          </SectionCard>

          <Grid cols="split5">
            <SectionCard title="Digital passport" action="Open profile" onAction={() => setTab('Profile')} className="xl:col-span-2">
              <DetailGrid items={[
                { label: 'Legal name', value: supplier.name.replace('Ltd', 'GmbH') },
                { label: 'Registration', value: `${supplier.country.slice(0, 2).toUpperCase()}-2018-04532` },
                { label: 'Category', value: supplier.category },
                { label: 'Country', value: supplier.country },
                { label: 'Tier', value: 'Tier 1 · Strategic' },
                { label: 'Owner', value: supplier.owner },
              ]} />
            </SectionCard>
            <SectionCard title="Recent activity" action="View activity log" onAction={() => setTab('Activities')} className="xl:col-span-3">
              <ul className="space-y-3">
                {activities.slice(0, 4).map(activity => (
                  <li key={activity.date + activity.event} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="w-24 text-caption text-ink-muted">{activity.date}</div>
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <div className="min-w-0 flex-1 text-body text-ink-soft">{activity.event}</div>
                    <Badge small>{activity.area}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </Grid>
        </div>
      );
    }

    if (tab === 'Contacts') return <ContactsTab supplier={supplier} />;

    if (tab === 'Profile') return (
      <Grid cols="split3">
        <SectionCard title="Company information" action="Edit" className="xl:col-span-2">
          <CompanyInformation supplier={supplier} />
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title="Classification" action="Manage">
            <DetailGrid items={[
              { label: 'Category', value: supplier.category },
              { label: 'Additional category', value: 'Facilities Services' },
              { label: 'Tier', value: 'Tier 1' },
              { label: 'Segment', value: 'Strategic' },
              { label: 'Spend band', value: '€10M–€25M' },
              { label: 'Region', value: 'EMEA' },
              { label: 'Criticality', value: 'Business critical' },
            ]} />
          </SectionCard>
          <SectionCard title="Primary contact" action="View contacts" onAction={() => setTab('Contacts')}>
            {primaryContact ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <Avatar initials={primaryContact.name.split(' ').map(word => word[0]).join('')} size="lg" />
                  <div><div className="text-body font-semibold text-ink">{primaryContact.name}</div><div className="text-caption text-ink-muted">{primaryContact.title}</div></div>
                </div>
                <div className="space-y-1.5 text-body text-ink-soft"><div>{primaryContact.email}</div><div>{primaryContact.phone}</div></div>
              </>
            ) : <div className="text-body text-ink-muted">No primary contact recorded</div>}
          </SectionCard>
        </div>
        <SectionCard title="Banking & payment" action="Restricted · View" className="xl:col-span-2">
          <DetailGrid items={[
            { label: 'Payment terms', value: 'Net 45' },
            { label: 'Currency', value: 'EUR' },
            { label: 'Bank verification', value: 'Verified Sep 1, 2024' },
            { label: 'ERP vendor ID', value: 'V-1004832' },
            { label: 'External Supplier ID', value: externalLink ? <span className="font-mono">{externalLink.externalSupplierId}</span> : '—' },
            { label: 'Master data sync', value: externalLink ? <span>{externalLink.syncStatus}{externalLink.lastSyncedAt ? ` · ${formatDate(externalLink.lastSyncedAt)}` : ''}</span> : '—' },
          ]} />
        </SectionCard>
        <SectionCard title="Internal ownership" action="Reassign">
          <DetailGrid items={[
            { label: 'Supplier owner', value: supplier.owner },
            { label: 'Business unit', value: 'Global Procurement' },
            { label: 'Category manager', value: 'Sophie Chen' },
            { label: 'Last reviewed', value: supplier.lastReview },
          ]} />
        </SectionCard>
      </Grid>
    );

    if (tab === 'Capabilities') {
      const current = qslItems.filter(item => item.result === 'Pass' && (item.validity === 'Valid' || item.validity === 'Expiring'));
      const skills = current.flatMap(item => item.skills.map(skill => ({ item, skill })));
      return (
        <div className="space-y-5">
          <KpiGrid cols={4}>
            <ScoreCard label="Certified skills" value={String(skills.length)} tone="success" note="From approved capabilities" />
            <ScoreCard label="Product categories" value={String(new Set([supplier.category, ...qslItems.map(item => item.category)]).size)} tone="info" note="Registered and assessed" />
            <ScoreCard label="Current qualifications" value={String(current.length)} tone="success" note="Valid or expiring" />
            <ScoreCard label="Open assessments" value={String(qualificationData.data?.open ?? 0)} tone="warning" note="Qualification in progress" />
          </KpiGrid>

          <Grid cols="split5">
            <SectionCard title="Certified skills" action="Open capability register" onAction={() => navigate('qualification', 'qualified')} className="xl:col-span-3">
              {skills.length ? (
                <SimpleTable columns={['Category / skill', 'Scope', 'Verified level', 'Valid to']} rows={skills.map(({ item, skill }) => [
                  `${item.category} · ${skill.name}`, item.scope || '—', `Level ${skill.level}`, formatDate(item.expiryDate),
                ])} />
              ) : <EmptyState title={qualificationData.loading ? 'Loading qualification data...' : 'No certified skills yet'} />}
            </SectionCard>

            <SectionCard title="Registered business scope" className="xl:col-span-2">
              <div className="flex items-center justify-between gap-3 rounded-control border border-line p-3">
                <div><div className="text-body font-medium text-ink">{supplier.category}</div><div className="mt-0.5 text-caption text-ink-muted">{supplier.materialGroup || 'Primary category'}</div></div>
              </div>
              <div className="mt-4 border-t border-line-subtle pt-4">
                <Eyebrow className="mb-2">Registered products</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {(supplier.productTypes ?? []).map(product => <Badge key={product} small>{product}</Badge>)}
                </div>
              </div>
            </SectionCard>
          </Grid>
        </div>
      );
    }

    if (tab === 'Qualification') {
      if (!qslItems.length) return <EmptyState title={qualificationData.loading ? 'Loading qualification data...' : 'No qualification on record for this supplier'} />;
      return (
        <div className="space-y-5">
          {qslItems.map(item => (
            <SectionCard key={item.id} title={`Qualification · ${item.category}`} action="Open in Qualification" onAction={() => navigate('qualification', item.result === 'Pass' ? 'qualified' : 'pending')}>
              <div className="mb-5 flex flex-wrap items-center gap-3"><ResultBadge result={item.result} />{item.listed ? <StandingBadge standing={item.standing} /> : item.result === 'Pass' && <Badge small tone="info">Eligible, not published to QSL</Badge>}<span className="text-caption text-ink-muted">{item.qslNo}</span></div>
              <DetailGrid items={[
                { label: 'Scope', value: item.scope || '—' },
                { label: 'Qualification level', value: item.level ? `Level ${item.level}` : '—' },
                { label: 'Effective date', value: formatDate(item.effectiveDate) },
                { label: 'Valid until', value: item.expiryDate ? formatDate(item.expiryDate) : 'Not specified' },
                { label: 'Certified skills', value: item.skills.length ? item.skills.map(skill => `${skill.name} (L${skill.level})`).join(', ') : '—', wide: true },
              ]} />
            </SectionCard>
          ))}
        </div>
      );
    }

    if (tab === 'Risk') return (
      <Grid cols="split3">
        <SectionCard title="Overall risk">
          <div className="text-3xl font-semibold tracking-tight text-ink">{riskValue}<span className="text-base font-normal text-ink-muted">/100</span></div>
          <div className="mt-2"><Badge tone={riskBadgeTone(supplier.risk)}>{supplier.risk}</Badge></div>
          <div className="mt-5 text-caption text-ink-muted">Trend increased 8 points this quarter. Confidence: high.</div>
        </SectionCard>
        <SectionCard title="Risk drivers" action="Run assessment" onAction={() => navigate('risk', 'assessment')} className="xl:col-span-2">
          <SimpleTable columns={['Risk domain', 'Rating', 'Trend', 'Last updated']} rows={[
            ['Financial', 'High', 'Increasing', 'Sep 2, 2024'], ['Supply continuity', 'Medium', 'Stable', 'Aug 18, 2024'], ['Geopolitical', 'Low', 'Stable', 'Sep 1, 2024'], ['Cyber security', 'Low', 'Improving', 'Jul 28, 2024'], ['ESG', 'Medium', 'Stable', 'Aug 12, 2024'],
          ]} />
        </SectionCard>
        <SectionCard title="Recommended mitigation" action="Create action" onAction={() => navigate('car', undefined, supplier.id)} className="xl:col-span-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {['Request updated audited financials', 'Confirm alternate production capacity', 'Increase monitoring to monthly cadence'].map((item, index) => (
              <div key={item} className="rounded-control border border-brand-100 bg-brand-50 p-4"><div className="mb-1 text-micro font-semibold uppercase tracking-wide text-brand-700">Next best action {index + 1}</div><div className="text-body font-medium text-ink">{item}</div></div>
            ))}
          </div>
        </SectionCard>
      </Grid>
    );

    if (tab === 'Performance') return (
      <div className="space-y-5">
        <KpiGrid cols={4}>
          <ScoreCard label="Overall score" value={`${supplier.perf || 0}%`} tone="warning" note="↓ 4.2 vs previous quarter" />
          <ScoreCard label="Quality" value="71%" tone="warning" note="Target 95%" />
          <ScoreCard label="Delivery" value="58%" tone="danger" note="Target 92%" />
          <ScoreCard label="Service" value="84%" tone="success" note="Target 85%" />
        </KpiGrid>
        <SectionCard title="KPI scorecard" action="Open Q2 review" onAction={() => navigate('performance')}>
          <SimpleTable columns={['KPI', 'Actual', 'Target', 'Trend', 'Status']} rows={[
            ['On-time delivery', '82.4%', '≥ 95%', 'Down 7.1%', 'Below target'], ['Defect rate', '2.8%', '≤ 1.0%', 'Up 0.6%', 'Below target'], ['Lead-time adherence', '89%', '≥ 90%', 'Stable', 'Near target'], ['Response time', '4.2 hrs', '≤ 8 hrs', 'Improving', 'On target'],
          ]} />
        </SectionCard>
      </div>
    );

    if (tab === 'Documents') return <DocumentsTab supplier={supplier} onOpenRegister={() => navigate('compliance', 'renewal', supplier.id)} />;

    if (tab === 'Compliance') {
      return (
        <div className="space-y-5">
          <Grid cols="split3">
            <SectionCard title="Compliance coverage">
              <div className="text-3xl font-semibold tracking-tight text-ink">82%</div>
              <ProgressBar value={82} tone="success" size="md" label="Compliance coverage" className="mt-3" />
              <div className="mt-3 text-caption text-ink-muted">9 valid · 1 expiring · 1 missing</div>
            </SectionCard>
            <SectionCard title="Requirements" action="Request update" className="xl:col-span-2">
              <SimpleTable columns={['Requirement', 'Status', 'Owner', 'Next review']} rows={[
                ['Code of conduct', 'Compliant', 'Legal', 'Jan 12, 2025'], ['Modern slavery declaration', 'Compliant', 'ESG', 'Mar 1, 2025'], ['Environmental policy', 'Expiring', 'ESG', 'Dec 1, 2024'], ['Conflict minerals report', 'Missing', 'Compliance', 'Overdue'],
              ]} />
            </SectionCard>
          </Grid>
          <Card className="overflow-hidden">
            <CardHeader title="Compliance tracker" description="Contracts, audits, questionnaires, screening and sample requests" actions={<Button variant="link" onClick={() => navigate('compliance', 'overview', supplier.id)}>View in Compliance</Button>} />
            <ComplianceTracker key={supplier.id} companyId={supplier.id} onOpenDocuments={() => setTab('Documents')} />
          </Card>
        </div>
      );
    }

    if (tab === 'Audit') return (
      <Grid cols="split3">
        <SectionCard title="Audit summary">
          <DetailGrid columns={1} items={[{ label: 'Last audit', value: 'Jul 18, 2024' }, { label: 'Result', value: 'Conditional pass' }, { label: 'Score', value: '78 / 100' }, { label: 'Open findings', value: '3' }, { label: 'Next audit', value: 'Jan 20, 2025' }, { label: 'Audit owner', value: 'David Park' }]} />
        </SectionCard>
        <SectionCard title="Findings" action="View audit report" onAction={() => navigate('audit')} className="xl:col-span-2">
          <SimpleTable columns={['Finding', 'Severity', 'Owner', 'Status']} rows={[
            ['Calibration records incomplete', 'Major', 'Quality Lead', 'CAR raised'], ['Training matrix out of date', 'Minor', 'HR Manager', 'In progress'], ['Waste log retention gap', 'Minor', 'EHS Manager', 'Open'],
          ]} />
        </SectionCard>
      </Grid>
    );

    if (tab === 'CAR') return (
      <div className="space-y-5">
        <KpiGrid cols={4}>
          <ScoreCard label="Open CAR" value="2" tone="info" note="Across quality and delivery" />
          <ScoreCard label="Overdue" value="1" tone="danger" note="5 days overdue" />
          <ScoreCard label="Pending supplier" value="1" tone="warning" note="Response requested" />
          <ScoreCard label="Closed this year" value="6" tone="success" note="Avg. closure 18 days" />
        </KpiGrid>
        <SectionCard title="CAR & CAP" action="+ Create CAR" onAction={() => navigate('car', undefined, supplier.id)}>
          <SimpleTable columns={['CAR', 'Issue', 'Severity', 'Due date', 'CAP', 'Status']} rows={[
            ['CAR-2024-118', 'Quality defect rate above threshold', 'High', 'Sep 25, 2024', 'Approved', 'Overdue'], ['CAR-2024-087', 'Repeated delivery delays', 'Medium', 'Oct 18, 2024', 'Under review', 'Supplier response'], ['CAR-2024-041', 'Incomplete inspection records', 'Low', 'May 30, 2024', 'Approved', 'Closed'],
          ]} />
        </SectionCard>
      </div>
    );

    return (
      <SectionCard title="Complete activity log" action="Export">
        <ul>
          {activities.map(activity => (
            <li key={activity.date + activity.event} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle py-3 last:border-0">
              <div className="w-24 text-caption text-ink-muted">{activity.date}</div>
              <Avatar initials={activity.area.slice(0, 2).toUpperCase()} />
              <div className="min-w-0 flex-1"><div className="text-body font-medium text-ink">{activity.event}</div><div className="mt-0.5 text-caption text-ink-muted">{`Updated by System · ${activity.area}`}</div></div>
              <Button variant="link">View details</Button>
            </li>
          ))}
        </ul>
      </SectionCard>
    );
  };

  return (
    <Page>
      <Header breadcrumb={['Supplier Management', 'Supplier Directory', supplier.id]} title={supplier.name} />
      <PageScroll>
        <div className="border-b border-line bg-surface px-4 pt-4 md:px-6">
          <BackLink onClick={onBack}>Back to supplier directory</BackLink>
          <div className="mb-4 mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar initials={initials} size="xl" shape="square" />
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <div className="text-lg font-semibold text-ink">{supplier.name}</div>
                  <StatusBadge status={supplier.status} />
                  <Badge tone={riskTone}>{supplier.risk}</Badge>
                  {sourcing && <StageBadge stage={sourcing.stage} />}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
                  <span className="font-mono">{supplier.id}</span><span>{supplier.category} · {supplier.country}</span><span>Owner: {supplier.owner}</span><span>Tier 1 Strategic</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="md" onClick={() => setSourcingOpen(true)}>{sourcing ? 'Manage sourcing' : 'Add to sourcing'}</Button>
              <Button size="md">Edit profile</Button>
            </div>
          </div>
          <Tabs label="Supplier sections" value={tab} onChange={setTab} items={tabs.map(item => ({ value: item, label: item === 'CAR' ? 'CAR & CAP' : item }))} />
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-line-subtle py-2.5">
            <Eyebrow className="shrink-0">Related modules</Eyebrow>
            {[
              ['Qualification', 'qualification'], ['Risk', 'risk'], ['Compliance', 'compliance'],
              ['Performance', 'performance'], ['Audit', 'audit'], ['CAR & CAP', 'car'],
              ['Contacts', 'relationship'],
            ].map(([label, screen]) => <Button key={screen} size="xs" onClick={() => navigate(screen as 'qualification' | 'risk' | 'compliance' | 'performance' | 'audit' | 'car' | 'relationship', undefined, ['compliance', 'car', 'relationship'].includes(screen) ? supplier.id : undefined)}>{label}</Button>)}
          </div>
        </div>
        <PageBody>{renderTab()}</PageBody>
      </PageScroll>
      {sourcingOpen && <SourcingModal supplier={supplier} onClose={() => setSourcingOpen(false)} />}
    </Page>
  );
}
