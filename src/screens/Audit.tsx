import { useState } from 'react';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { suppliers } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { BackLink, Badge, Button, Callout, Card, CardBody, CardHeader, CellStack, DetailGrid, EmptyState, Grid, HeadRow, KpiCard, KpiGrid, Page, PageContent, ProgressBar, Table, TableContainer, Td, Tr, type Tone } from '../components/ui';

type Finding = { id: string; title: string; area: string; severity: 'Major' | 'Minor' | 'Observation'; evidence: string; status: 'Open' | 'CAR raised' | 'Closed'; car?: string };

export type AuditItem = { id: string; supplier: string; type: string; auditor: string; due: string; status: string; grade: string; pct: number; scope: string; location: string; auditDate: string; findings: Finding[] };

export const audits: AuditItem[] = [
  { id: 'AUD-2024-040', supplier: 'Chemcore Solutions', type: 'ESG Audit', auditor: 'R. Okafor', due: 'Nov 1, 2024', status: 'In Progress', grade: 'C', pct: 55, scope: 'Environmental, social and governance compliance', location: 'Lagos plant, Nigeria', auditDate: 'Oct 8–10, 2024', findings: [
    { id: 'F-01', title: 'Improper hazardous waste disposal', area: 'Environment · Waste', severity: 'Major', evidence: 'Waste manifest missing for 3 shipments; site photos', status: 'CAR raised', car: 'CAR-2024-112' },
    { id: 'F-02', title: 'Code of conduct not signed by subcontractors', area: 'Governance', severity: 'Minor', evidence: 'Subcontractor contract review', status: 'Open' },
    { id: 'F-03', title: 'Overtime records exceed policy in two months', area: 'Labour', severity: 'Minor', evidence: 'Timesheet sample, Jun–Jul 2024', status: 'Open' },
  ] },
  { id: 'AUD-2024-044', supplier: 'GlobalTech Mfg', type: 'Quality Audit', auditor: 'L. Torres', due: 'Oct 15, 2024', status: 'Pending', grade: '—', pct: 0, scope: 'Quality management system', location: 'Monterrey plant, Mexico', auditDate: 'Oct 15, 2024', findings: [] },
  { id: 'AUD-2024-046', supplier: 'Titan Industries', type: 'Financial Review', auditor: 'S. Chen', due: 'Oct 31, 2024', status: 'In Progress', grade: '—', pct: 30, scope: 'Financial stability and credit exposure', location: 'Remote review', auditDate: 'Oct 14–18, 2024', findings: [
    { id: 'F-01', title: 'Debt-to-equity ratio above policy threshold', area: 'Financial health', severity: 'Major', evidence: 'FY2023 audited statements', status: 'Open' },
    { id: 'F-02', title: 'Audited statements submitted late', area: 'Financial reporting', severity: 'Observation', evidence: 'Document submission log', status: 'Open' },
  ] },
  { id: 'AUD-2024-033', supplier: 'PrimeParts Co.', type: 'Supplier Quality Audit', auditor: 'J. Kim', due: 'Sep 30, 2024', status: 'Completed', grade: 'A', pct: 100, scope: 'Supplier quality system', location: 'Ohio plant, USA', auditDate: 'Sep 24–26, 2024', findings: [
    { id: 'F-01', title: 'Calibration label missing on one gauge', area: 'Measurement control', severity: 'Observation', evidence: 'Floor inspection photo', status: 'Closed' },
  ] },
  { id: 'AUD-2024-029', supplier: 'Nordex Logistics', type: 'Operational Audit', auditor: 'K. Hansen', due: 'Aug 31, 2024', status: 'Completed', grade: 'B+', pct: 100, scope: 'Warehouse and freight operations', location: 'Laem Chabang hub, Thailand', auditDate: 'Aug 26–28, 2024', findings: [
    { id: 'F-01', title: 'Temperature log gaps on two days', area: 'Cold chain', severity: 'Minor', evidence: 'Logger export', status: 'Closed' },
    { id: 'F-02', title: 'Driver training records incomplete', area: 'People', severity: 'Minor', evidence: 'Training matrix', status: 'Closed' },
  ] },
  { id: 'AUD-2024-050', supplier: 'Apex Components', type: 'Cybersecurity Audit', auditor: 'M. Patel', due: 'Dec 15, 2024', status: 'Draft', grade: '—', pct: 0, scope: 'Information security controls', location: 'Hsinchu, Taiwan', auditDate: 'Dec 9–13, 2024', findings: [] },
];

const severityTone: Record<Finding['severity'], Tone> = { Major: 'danger', Minor: 'warning', Observation: 'neutral' };
const findingTone: Record<Finding['status'], Tone> = { Open: 'info', 'CAR raised': 'brand', Closed: 'success' };

const upcoming = [
  { supplier: 'BlueSky Plastics', type: 'Annual Audit', date: 'Oct 5', auditor: 'L. Torres' },
  { supplier: 'Fastener World', type: 'ISO Verification', date: 'Oct 12', auditor: 'J. Kim' },
  { supplier: 'Vertex Systems', type: 'Security Audit', date: 'Oct 22', auditor: 'A. Singh' },
];

const gradeTone: Record<string, Tone> = {
  'A': 'success',
  'B+': 'success',
  'B': 'info',
  'C': 'warning',
  'D': 'danger',
  '—': 'neutral',
};

const gradeDistribution: [string, number, string][] = [['A', 18, 'bg-success-600'], ['B+', 24, 'bg-success-500'], ['B', 21, 'bg-info-500'], ['C', 16, 'bg-warning-500'], ['D / Fail', 8, 'bg-danger-500']];

export default function Audit() {
  const { openSupplier, openCar } = useNavigation();
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const openSupplierByName = (name: string) => {
    const supplier = suppliers.find(item => item.name.startsWith(name) || name.startsWith(item.name.split(' ')[0]));
    if (supplier) openSupplier(supplier, 'Audit');
  };

  if (selected) {
    const major = selected.findings.filter(finding => finding.severity === 'Major').length;
    const unresolved = selected.findings.filter(finding => finding.status !== 'Closed').length;
    return (
      <Page>
        <Header breadcrumb={['Audit & Assessment', 'Audits', selected.id]} title={`${selected.type} · ${selected.supplier}`} action={{ label: 'Open Supplier Profile', onClick: () => openSupplierByName(selected.supplier) }} />
        <PageContent>
          <BackLink onClick={() => setSelected(null)}>Back to audits</BackLink>

          <KpiGrid cols={4}>
            <KpiCard label="Progress" value={`${selected.pct}%`} note={selected.status} tone="brand" />
            <KpiCard label="Grade" value={selected.grade} note={selected.grade === '—' ? 'Not graded yet' : 'Final audit grade'} tone={gradeTone[selected.grade] ?? 'neutral'} />
            <KpiCard label="Findings" value={selected.findings.length} note={`${major} major`} tone={major ? 'danger' : 'neutral'} />
            <KpiCard label="Unresolved" value={unresolved} note="Open or CAR in progress" tone={unresolved ? 'warning' : 'success'} />
          </KpiGrid>

          <Grid cols="split3">
            <Card className="overflow-hidden xl:col-span-2">
              <CardHeader title="Audit findings" description="Major findings are raised as a CAR, then followed up through CAP." />
              {selected.findings.length === 0 ? (
                <EmptyState title="No findings recorded yet" description="Findings appear here once the auditor records them during the audit." />
              ) : (
                <TableContainer>
                  <Table minWidth={820}>
                    <HeadRow columns={['Finding', 'Area', 'Severity', 'Evidence', 'Status', '']} />
                    <tbody>
                      {selected.findings.map(finding => (
                        <Tr key={finding.id}>
                          <Td><CellStack primary={finding.title} secondary={finding.id} /></Td>
                          <Td className="text-ink-muted">{finding.area}</Td>
                          <Td><Badge tone={severityTone[finding.severity]} small>{finding.severity}</Badge></Td>
                          <Td className="text-ink-muted">{finding.evidence}</Td>
                          <Td><Badge tone={findingTone[finding.status]} small>{finding.status}</Badge></Td>
                          <Td>
                            {finding.car
                              ? <Button variant="secondary" size="xs" title={finding.car} onClick={() => openCar({ carId: finding.car! })}>View CAR</Button>
                              : finding.status === 'Open' && finding.severity !== 'Observation'
                                ? <Button variant="primary" size="xs" onClick={() => openCar({ draft: { supplier: selected.supplier, audit: selected.id, finding: finding.id, issue: finding.title, severity: finding.severity === 'Major' ? 'High' : 'Medium', owner: selected.auditor } })}>Create CAR</Button>
                                : null}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableContainer>
              )}
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title="Audit details" />
                <CardBody>
                  <DetailGrid columns={1} items={[
                    { label: 'Audit ID', value: <span className="font-mono">{selected.id}</span> },
                    { label: 'Scope', value: selected.scope },
                    { label: 'Location', value: selected.location },
                    { label: 'Audit date', value: selected.auditDate },
                    { label: 'Auditor', value: selected.auditor },
                    { label: 'Report due', value: selected.due },
                    { label: 'Status', value: <StatusBadge status={selected.status} small /> },
                  ]} />
                </CardBody>
              </Card>
              <Callout tone="info" title="From finding to CAR & CAP">
                Major and minor findings that need corrective action are issued as a CAR. The supplier then submits a CAP for the auditor to review.
              </Callout>
            </div>
          </Grid>
        </PageContent>
      </Page>
    );
  }

  const stats: { l: string; v: string; tone: Tone }[] = [
    { l: 'Active Audits', v: '14', tone: 'brand' },
    { l: 'Completed (YTD)', v: '87', tone: 'success' },
    { l: 'Overdue', v: '5', tone: 'danger' },
    { l: 'Scheduled (30d)', v: '11', tone: 'warning' },
  ];

  return (
    <Page>
      <Header breadcrumb={['Improve']} title="Audit & Assessment" />
      <PageContent>

        <KpiGrid cols={4}>
          {stats.map(s => <KpiCard key={s.l} label={s.l} value={s.v} tone={s.tone} />)}
        </KpiGrid>

        <Grid cols="split3">
          {/* Audit table */}
          <Card className="overflow-hidden xl:col-span-2">
            <CardHeader title="Audit Campaigns" actions={<><ExportButton filename="slm-audits" columns={['Supplier', 'Audit type', 'Auditor', 'Due date', 'Progress %', 'Grade', 'Status']} rows={audits.map(a => [a.supplier, a.type, a.auditor, a.due, a.pct, a.grade, a.status])} /><Button variant="primary">+ New Audit</Button></>} />
            <TableContainer>
              <Table minWidth={840}>
                <HeadRow columns={['Supplier','Audit Type','Auditor','Due Date','Progress','Grade','Status','']} />
                <tbody>
                  {audits.map(a => (
                    <Tr key={a.id} onClick={() => setSelected(a)}>
                      <Td><Button variant="inline" size="md" onClick={() => openSupplierByName(a.supplier)}>{a.supplier}</Button></Td>
                      <Td className="text-ink">{a.type}</Td>
                      <Td>{a.auditor}</Td>
                      <Td className="whitespace-nowrap">{a.due}</Td>
                      <Td>
                        {a.pct > 0 ? (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={a.pct} tone={a.pct === 100 ? 'success' : 'brand'} label={`${a.supplier} audit progress`} className="w-16" />
                            <span className="text-caption tabular-nums text-ink-muted">{a.pct}%</span>
                          </div>
                        ) : <span className="text-caption text-ink-muted">—</span>}
                      </Td>
                      <Td><Badge tone={gradeTone[a.grade]} small strong>{a.grade}</Badge></Td>
                      <Td><StatusBadge status={a.status} small /></Td>
                      <Td>
                        <Button variant="link" onClick={() => setSelected(a)}>View</Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Upcoming */}
            <Card>
              <CardHeader title="Upcoming Audits" />
              <CardBody className="space-y-2">
                {upcoming.map((u, i) => (
                  <div key={i} className="rounded-control border border-line p-3">
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="text-body font-medium text-ink">{u.supplier}</span>
                      <span className="text-caption font-semibold text-brand-700">{u.date}</span>
                    </div>
                    <div className="text-caption text-ink-muted">{u.type} · {u.auditor}</div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* Grade distribution */}
            <Card>
              <CardHeader title="Grade Distribution (YTD)" />
              <CardBody>
                <div className="space-y-3">
                  {gradeDistribution.map(([g, c, fill]) => (
                    <div key={g} className="flex items-center gap-3">
                      <span className="w-12 text-caption font-semibold text-ink-soft">{g}</span>
                      <ProgressBar value={c / 87 * 100} fill={fill} size="md" label={`Grade ${g}`} className="flex-1" />
                      <span className="w-6 text-right text-caption tabular-nums text-ink-soft">{c}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </Grid>
      </PageContent>
    </Page>
  );
}
