import { useEffect, useState, type ReactNode } from 'react';
import Header from '../components/Header';
import { ArrowRightIcon, CheckIcon } from '../components/icons';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { suppliers } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import type { CarDraft } from '../types';
import { Avatar, BackLink, Badge, Button, Callout, Card, CardBody, CardHeader, CellStack, Eyebrow, Field, Grid, HeadRow, Input, KpiCard, KpiGrid, Page, PageContent, SearchInput, Select, Stepper, Table, TableContainer, Td, Toolbar, Tr, cx, type Tone } from '../components/ui';

type CapStatus = 'Awaiting supplier' | 'Under review' | 'Revision requested' | 'Approved';

export type Car = {
  id: string;
  supplier: string;
  issue: string;
  severity: string;
  owner: string;
  due: string;
  status: string;
  rootCause: string;
  action: string;
  evidence: string;
  verification: string;
  audit: string;
  stage: number;
  cap: { status: CapStatus; due: string; submitted: string; reviewer: string; preventive: string };
};

export const cars: Car[] = [
  { id: 'CAR-2024-121', supplier: 'Titan Industries Ltd', issue: 'Incoming material hardness below approved specification', severity: 'Critical', owner: 'S. Chen', due: 'Sep 20, 2024', status: 'Open', rootCause: 'Raw material lot variation under investigation', action: 'Contain affected lots and complete 8D analysis', evidence: 'Pending', verification: 'Pending', audit: 'AUD-2024-031', stage: 2, cap: { status: 'Awaiting supplier', due: 'Sep 27, 2024', submitted: '—', reviewer: 'S. Chen', preventive: '—' } },
  { id: 'CAR-2024-118', supplier: 'Titan Industries Ltd', issue: 'Batch QC-4411 — 12% defect rate on M8 bolts', severity: 'High', owner: 'S. Chen', due: 'Sep 25, 2024', status: 'Overdue', rootCause: 'Machine calibration drift (Press #3)', action: 'Recalibrate press and re-inspect stock', evidence: 'Pending', verification: 'Pending', audit: 'AUD-2024-022', stage: 3, cap: { status: 'Approved', due: 'Jul 15, 2024', submitted: 'Jul 12, 2024', reviewer: 'S. Chen', preventive: 'Add weekly calibration check to the maintenance schedule' } },
  { id: 'CAR-2024-112', supplier: 'Chemcore Solutions', issue: 'ESG audit finding: improper hazardous waste disposal', severity: 'Critical', owner: 'R. Okafor', due: 'Nov 1, 2024', status: 'Open', rootCause: '—', action: '—', evidence: '—', verification: '—', audit: 'AUD-2024-040', stage: 2, cap: { status: 'Awaiting supplier', due: 'Oct 15, 2024', submitted: '—', reviewer: 'R. Okafor', preventive: '—' } },
  { id: 'CAR-2024-105', supplier: 'Apex Components Inc', issue: 'Late delivery — 4 shipments more than 5 days overdue', severity: 'Medium', owner: 'M. Patel', due: 'Oct 10, 2024', status: 'In Progress', rootCause: 'Logistics partner capacity issues', action: 'Evaluate new logistics partner and update SLA', evidence: 'Uploaded', verification: 'Pending', audit: 'AUD-2024-035', stage: 3, cap: { status: 'Approved', due: 'Sep 20, 2024', submitted: 'Sep 18, 2024', reviewer: 'M. Patel', preventive: 'Quarterly logistics partner capacity review' } },
  { id: 'CAR-2024-099', supplier: 'GlobalTech Manufacturing', issue: 'ISO 14001 non-conformance — wastewater treatment', severity: 'High', owner: 'L. Torres', due: 'Sep 30, 2024', status: 'In Progress', rootCause: 'Drainage system failure, awaiting repair', action: 'Repair drainage and retrain operators', evidence: 'Partial', verification: 'Pending', audit: 'AUD-2024-028', stage: 2, cap: { status: 'Revision requested', due: 'Sep 15, 2024', submitted: 'Sep 12, 2024', reviewer: 'L. Torres', preventive: 'Quarterly operator training on wastewater procedures' } },
  { id: 'CAR-2024-091', supplier: 'BlueSky Plastics', issue: 'Material specification deviation — PP grade substitution', severity: 'Medium', owner: 'S. Chen', due: 'Aug 30, 2024', status: 'Completed', rootCause: 'Procurement error — wrong part number in PO', action: 'Updated PO template and added QA gate', evidence: 'Uploaded', verification: 'Verified', audit: 'AUD-2024-017', stage: 5, cap: { status: 'Approved', due: 'Aug 10, 2024', submitted: 'Aug 8, 2024', reviewer: 'S. Chen', preventive: 'Mandatory part-number check at PO approval' } },
];

const steps = [
  { label: 'Audit finding', info: 'Auditor พบข้อบกพร่องจากการตรวจประเมิน Supplier' },
  { label: 'Issue CAR', info: 'ออกคำขอแก้ไข ระบุปัญหาและกำหนด Due Date' },
  { label: 'Submit CAP', info: 'Supplier วิเคราะห์ Root Cause และส่งแผนแก้ไขให้ Auditor พิจารณา' },
  { label: 'Implement & Verify', info: 'Supplier ดำเนินการ ส่งหลักฐาน และ Auditor ตรวจสอบประสิทธิผล' },
  { label: 'Close CAR', info: 'ปิดรายการเมื่อผลการแก้ไขผ่านเกณฑ์ที่กำหนด' },
];

const capTone: Record<CapStatus, Tone> = { 'Awaiting supplier': 'warning', 'Under review': 'info', 'Revision requested': 'danger', Approved: 'success' };
const capPending = (item: Car) => item.cap.status !== 'Approved';

function FieldGrid({ fields }: { fields: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => <div key={label} className="rounded-control bg-canvas p-3"><Eyebrow className="mb-1">{label}</Eyebrow><div className={cx('text-body', value === '—' ? 'italic text-ink-muted' : 'text-ink')}>{value}</div></div>)}
    </div>
  );
}

type TaskState = 'done' | 'active' | 'todo';

function TaskRow({ index, state, title, status, description, action }: { index: number; state: TaskState; title: string; status: ReactNode; description: string; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold', state === 'done' && 'bg-success-50 text-success-700', state === 'active' && 'bg-brand-50 text-brand-700 ring-2 ring-brand-500', state === 'todo' && 'border-2 border-line bg-surface text-ink-muted')}>
        {state === 'done' ? <CheckIcon className="h-4 w-4" /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="text-body font-medium text-ink">{title}</span>{status}</div>
        <p className="mt-0.5 text-caption text-ink-muted">{description}</p>
      </div>
      {action}
    </li>
  );
}

function ImplementVerify({ item, onUpload, onVerify, onClose }: { item: Car; onUpload: () => void; onVerify: () => void; onClose: () => void }) {
  const capApproved = item.cap.status === 'Approved';
  const uploaded = item.evidence === 'Uploaded';
  const verified = item.verification === 'Verified';
  const closed = item.status === 'Completed';

  const overall: [Tone, string] = !capApproved ? ['neutral', 'Locked'] : verified ? ['success', 'Verified'] : uploaded ? ['info', 'Awaiting verification'] : ['warning', 'Awaiting evidence'];
  const evidenceBadge: [Tone, string] = uploaded ? ['success', 'Uploaded'] : item.evidence === 'Partial' ? ['warning', 'Partial'] : ['warning', 'Pending'];
  const verifyBadge: [Tone, string] = verified ? ['success', 'Verified'] : uploaded ? ['info', 'Ready to verify'] : ['neutral', 'Waiting for evidence'];

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Implement & Verify" description="Supplier proves the fix was carried out, then the auditor confirms it works" actions={<Badge tone={overall[0]} small>{overall[1]}</Badge>} />
      {!capApproved ? (
        <CardBody>
          <Callout tone="info" compact title="Locked until the CAP is approved">Implementation starts once the auditor approves the CAP. Current CAP status: {item.cap.status}.</Callout>
        </CardBody>
      ) : (
        <>
          <ol className="divide-y divide-line-subtle">
            <TaskRow
              index={1}
              state={uploaded ? 'done' : 'active'}
              title="Implementation evidence"
              status={<Badge tone={evidenceBadge[0]} small>{evidenceBadge[1]}</Badge>}
              description="Supplier · Proof that the corrective action was carried out"
              action={!uploaded && <Button variant="secondary" onClick={onUpload}>Upload evidence</Button>}
            />
            <TaskRow
              index={2}
              state={verified ? 'done' : uploaded ? 'active' : 'todo'}
              title="Effectiveness verification"
              status={<Badge tone={verifyBadge[0]} small>{verifyBadge[1]}</Badge>}
              description={`Auditor · ${item.cap.reviewer} confirms the fix works and the issue does not recur`}
              action={uploaded && !verified && <Button variant="primary" onClick={onVerify}>Verify</Button>}
            />
          </ol>
          {verified && !closed && (
            <div className="border-t border-line-subtle p-4">
              <Callout tone="success" compact title="Verification complete" actions={<Button variant="primary" onClick={onClose}>Close CAR</Button>}>The fix is confirmed effective. Close the CAR to finish this case.</Callout>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

const companyMeta: Record<string, { category: string; country: string; owner: string }> = {
  'Titan Industries Ltd': { category: 'Raw Materials', country: 'Germany', owner: 'S. Chen' },
  'Chemcore Solutions': { category: 'Chemicals', country: 'Nigeria', owner: 'R. Okafor' },
  'Apex Components Inc': { category: 'Electronics', country: 'Taiwan', owner: 'M. Patel' },
  'GlobalTech Manufacturing': { category: 'Packaging', country: 'Mexico', owner: 'L. Torres' },
  'BlueSky Plastics': { category: 'Packaging', country: 'Thailand', owner: 'S. Chen' },
};

const severityTone: Record<string, Tone> = { Critical: 'danger', High: 'danger', Medium: 'warning' };

const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type DraftForm = CarDraft & { due: string; capDue: string };

export default function CAR() {
  const { openSupplier, carTarget, clearCarTarget, focusSupplierId } = useNavigation();
  const [carList, setCarList] = useState<Car[]>(cars);
  const focusName = suppliers.find(item => item.id === focusSupplierId)?.name;
  const focusCompany = focusName && companyMeta[focusName] ? focusName : null;
  const [company, setCompany] = useState<string | null>(focusCompany);
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const companyCars = company ? carList.filter(item => item.supplier === company) : [];
  const [selectedId, setSelectedId] = useState(cars.find(item => item.supplier === focusCompany)?.id ?? cars[0].id);
  const selected = companyCars.find(item => item.id === selectedId) || companyCars[0];
  const meta = (name: string) => companyMeta[name] ?? { category: '—', country: '—', owner: '—' };
  const updateCar = (id: string, patch: Partial<Car>) => setCarList(list => list.map(item => (item.id === id ? { ...item, ...patch } : item)));
  const companies = Object.keys(companyMeta).map(name => {
    const items = carList.filter(item => item.supplier === name);
    return {
      name,
      ...companyMeta[name],
      total: items.length,
      open: items.filter(item => item.status !== 'Completed').length,
      capPending: items.filter(capPending).length,
      overdue: items.filter(item => item.status === 'Overdue').length,
      critical: items.filter(item => item.severity === 'Critical').length,
      latest: items[0]?.due || '—',
    };
  });

  const openCompany = (name: string) => {
    const first = carList.find(item => item.supplier === name);
    setCompany(name);
    if (first) setSelectedId(first.id);
  };

  useEffect(() => {
    if (!carTarget) return;
    if ('carId' in carTarget) {
      const target = cars.find(item => item.id === carTarget.carId);
      if (target) { setCompany(target.supplier); setSelectedId(target.id); }
    } else {
      const { draft: incoming } = carTarget;
      const supplier = Object.keys(companyMeta).find(name => name.startsWith(incoming.supplier) || incoming.supplier.startsWith(name.split(' ')[0])) ?? incoming.supplier;
      setDraft({ ...incoming, supplier, due: '2024-11-30', capDue: '2024-11-08' });
    }
    clearCarTarget();
  }, []);

  const issueCar = () => {
    if (!draft) return;
    const nextNumber = Math.max(...carList.map(item => Number(item.id.split('-')[2]))) + 1;
    const created: Car = {
      id: `CAR-2024-${nextNumber}`, supplier: draft.supplier, issue: draft.issue, severity: draft.severity, owner: draft.owner, due: formatDate(draft.due), status: 'Open',
      rootCause: '—', action: '—', evidence: '—', verification: '—', audit: draft.audit, stage: 2,
      cap: { status: 'Awaiting supplier', due: formatDate(draft.capDue), submitted: '—', reviewer: draft.owner, preventive: '—' },
    };
    setCarList([created, ...carList]);
    setCompany(draft.supplier);
    setSelectedId(created.id);
    setDraft(null);
  };

  const openSupplierProfile = (name: string) => {
    const supplier = suppliers.find(item => item.name.startsWith(name) || name.startsWith(item.name.split(' ')[0]));
    if (supplier) openSupplier(supplier, 'CAR');
  };

  if (draft) {
    const update = (patch: Partial<DraftForm>) => setDraft({ ...draft, ...patch });
    return (
      <Page>
        <Header breadcrumb={['CAR & CAP', 'New CAR']} title="Issue CAR" />
        <PageContent>
          <BackLink onClick={() => setDraft(null)}>Cancel and go back</BackLink>
          <Card>
            <CardHeader title="New CAR" description="Pre-filled from the audit finding. The supplier is asked to submit a CAP after the CAR is issued." />
            <CardBody>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Supplier"><Input readOnly value={draft.supplier} /></Field>
                <Field label="Audit finding"><Input readOnly value={`${draft.audit} · ${draft.finding}`} /></Field>
                <Field label="Issue" required className="md:col-span-2"><Input value={draft.issue} onChange={event => update({ issue: event.target.value })} /></Field>
                <Field label="Severity"><Select value={draft.severity} onChange={event => update({ severity: event.target.value })}><option>Critical</option><option>High</option><option>Medium</option></Select></Field>
                <Field label="Owner"><Input value={draft.owner} onChange={event => update({ owner: event.target.value })} /></Field>
                <Field label="CAP due date" hint="Supplier submits root cause and plan by this date"><Input type="date" value={draft.capDue} onChange={event => update({ capDue: event.target.value })} /></Field>
                <Field label="CAR due date" hint="Corrective action must be completed by this date"><Input type="date" value={draft.due} onChange={event => update({ due: event.target.value })} /></Field>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button onClick={() => setDraft(null)}>Cancel</Button>
                <Button variant="primary" disabled={!draft.issue.trim()} onClick={issueCar}>Issue CAR</Button>
              </div>
            </CardBody>
          </Card>
        </PageContent>
      </Page>
    );
  }

  if (!company) {
    return (
      <Page>
        <Header breadcrumb={['Improve']} title="CAR & CAP" />
        <PageContent>
          <KpiGrid cols={5}>
            <KpiCard label="Companies with CAR" value="5" note="Across 4 categories" tone="brand" />
            <KpiCard label="Open CAR" value="5" note="2 added this month" />
            <KpiCard label="CAP pending" value={`${carList.filter(capPending).length}`} note="Awaiting supplier or review" tone="warning" />
            <KpiCard label="Overdue" value="1" note="Needs immediate action" tone="danger" />
            <KpiCard label="Closed this year" value="47" note="Avg. closure 18 days" tone="success" />
          </KpiGrid>

          <Card className="overflow-hidden">
            <CardHeader
              title="Suppliers with CAR & CAP"
              description="Select a company to review its CAR cases, CAP status and improvement progress."
              actions={
                <Toolbar actions={<><ExportButton filename="slm-car-cap-suppliers" columns={['Company', 'Country', 'Category', 'Owner', 'Total cases', 'Open CAR', 'CAP pending', 'Overdue', 'Critical', 'Latest']} rows={companies.map(item => [item.name, item.country, item.category, item.owner, item.total, item.open, item.capPending, item.overdue, item.critical, item.latest])} /><Button variant="primary">+ New CAR</Button></>}>
                  <SearchInput aria-label="Search companies" className="w-full sm:w-56" placeholder="Search companies..." />
                  <Select aria-label="Filter by status"><option>All statuses</option><option>Has overdue</option><option>Has critical</option></Select>
                </Toolbar>
              }
            />
            <TableContainer>
              <Table minWidth={900}>
                <HeadRow columns={['Company', 'Category', 'Owner', 'Open CAR', 'CAP pending', 'Overdue', 'Critical', 'Next due', '']} />
                <tbody>
                  {companies.map(item => (
                    <Tr key={item.name} onClick={() => openCompany(item.name)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar initials={item.name[0]} shape="square" />
                          <div><CellStack primary={item.name} secondary={`${item.country} · ${item.total} total cases`} /></div>
                        </div>
                      </Td>
                      <Td>{item.category}</Td>
                      <Td>{item.owner}</Td>
                      <Td><Badge tone="brand" small strong>{item.open}</Badge></Td>
                      <Td><span className={cx('font-semibold tabular-nums', item.capPending ? 'text-warning-700' : 'text-ink-muted')}>{item.capPending}</span></Td>
                      <Td><span className={cx('font-semibold tabular-nums', item.overdue ? 'text-danger-700' : 'text-ink-muted')}>{item.overdue}</span></Td>
                      <Td><span className={cx('font-semibold tabular-nums', item.critical ? 'text-danger-700' : 'text-ink-muted')}>{item.critical}</span></Td>
                      <Td className="whitespace-nowrap text-ink-muted">{item.latest}</Td>
                      <Td><Button variant="link" className="whitespace-nowrap" onClick={() => openCompany(item.name)}>View CAR <ArrowRightIcon className="h-3.5 w-3.5" /></Button></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          </Card>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <Header breadcrumb={['CAR & CAP', 'Companies']} title={`CAR & CAP · ${company}`} action={{ label: 'Open Supplier Profile', onClick: () => openSupplierProfile(company) }} />
      <PageContent>
        <BackLink onClick={() => setCompany(null)}>Back to companies</BackLink>
        <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Avatar initials={company[0]} size="lg" shape="square" />
            <div><div className="text-sm font-semibold text-ink">{company}</div><div className="text-caption text-ink-muted">{meta(company).category} · {meta(company).country} · Owner {meta(company).owner}</div></div>
          </div>
          <div className="flex gap-8 text-center">
            <div><div className="text-lg font-semibold tabular-nums text-ink">{companyCars.length}</div><div className="text-caption text-ink-muted">Total CAR</div></div>
            <div><div className="text-lg font-semibold tabular-nums text-brand-700">{companyCars.filter(item => item.status !== 'Completed').length}</div><div className="text-caption text-ink-muted">Open</div></div>
            <div><div className="text-lg font-semibold tabular-nums text-danger-700">{companyCars.filter(item => item.status === 'Overdue').length}</div><div className="text-caption text-ink-muted">Overdue</div></div>
          </div>
        </Card>

        <Grid cols="split5">
          <Card className="self-start overflow-hidden xl:col-span-2">
            <CardHeader title="CAR cases" compact />
            {companyCars.map(item => (
              <button
                key={item.id}
                type="button"
                aria-current={selected?.id === item.id ? 'true' : undefined}
                onClick={() => setSelectedId(item.id)}
                className={cx('w-full border-b border-l-2 border-b-line-subtle px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-canvas', selected?.id === item.id ? 'border-l-brand-600 bg-brand-50/60' : 'border-l-transparent')}
              >
                <div className="mb-1 flex items-center justify-between gap-2"><span className="font-mono text-caption font-semibold text-brand-700">{item.id}</span><StatusBadge status={item.status} small /></div>
                <div className="line-clamp-2 text-body text-ink-soft">{item.issue}</div>
                <div className="mt-2 flex flex-wrap gap-2"><Badge tone={severityTone[item.severity] ?? 'neutral'} small>{item.severity}</Badge><Badge tone={capTone[item.cap.status]} small>CAP: {item.cap.status}</Badge><span className="text-caption text-ink-muted">Due {item.due}</span></div>
              </button>
            ))}
          </Card>

          {selected && (
            <div className="space-y-4 xl:col-span-3">
              <Card padded>
                <div className="mb-5">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-brand-700">{selected.id}</span><StatusBadge status={selected.status} /></div>
                  <div className="mt-2 text-body text-ink-soft">{selected.issue}</div>
                </div>
                <Stepper
                  compact
                  className="mb-4"
                  steps={steps.map((step, index) => ({
                    label: step.label,
                    caption: index < selected.stage ? 'Completed' : index === selected.stage ? 'Current' : undefined,
                    state: index < selected.stage ? 'done' : index === selected.stage ? 'active' : 'todo',
                  }))}
                />
                {steps[selected.stage] && <Callout tone="info" title={`Current step: ${steps[selected.stage].label}`} compact>{steps[selected.stage].info}</Callout>}
              </Card>

              <Card>
                <CardHeader title="CAR · Corrective Action Request" description="Issued by the auditor from the audit finding" actions={<Badge tone="danger" small>Auditor</Badge>} />
                <CardBody><FieldGrid fields={[['Audit finding', selected.audit], ['Severity', selected.severity], ['Owner', selected.owner], ['Due date', selected.due], ['Status', selected.status]]} /></CardBody>
              </Card>

              <Card>
                <CardHeader title="CAP · Corrective Action Plan" description="Root cause analysis and plan submitted by the supplier" actions={<Badge tone={capTone[selected.cap.status]} small>{selected.cap.status}</Badge>} />
                <CardBody>
                  <FieldGrid fields={[
                    ['CAP due date', selected.cap.due], ['Submitted', selected.cap.submitted],
                    ['Reviewer', selected.cap.reviewer], ['Root cause', selected.rootCause],
                    ['Corrective action', selected.action], ['Preventive action', selected.cap.preventive],
                  ]} />
                </CardBody>
              </Card>

              <ImplementVerify
                item={selected}
                onUpload={() => updateCar(selected.id, { evidence: 'Uploaded' })}
                onVerify={() => updateCar(selected.id, { verification: 'Verified', stage: 4 })}
                onClose={() => updateCar(selected.id, { status: 'Completed', stage: 5 })}
              />
            </div>
          )}
        </Grid>
      </PageContent>
    </Page>
  );
}
