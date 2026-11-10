import { useState } from 'react';
import ExportButton from '../../components/ExportButton';
import { complianceCompanies, needsAttention } from '../../data/compliance';
import { performanceSuppliers } from '../../data/performance';
import { sampleRequests, isSampleOpen } from '../../data/samples';
import { suppliers } from '../../data/suppliers';
import { useNavigation } from '../../NavigationContext';
import { demoActors } from '../../qsl/actors';
import { listDirectory } from '../../qsl/services/queries';
import { getQslSummary, listCapabilities } from '../../qsl/services/qslRegister';
import { useQslQuery } from '../../qsl/useQsl';
import type { Screen } from '../../types';
import { Button, Card, CardBody, CardHeader, ColumnChart, EmptyState, Eyebrow, Grid, HeadRow, Input, KpiCard, KpiGrid, Select, Table, TableContainer, Tabs, Td, Toolbar, Tr, cx, toneText, type Tone } from '../../components/ui';
import { audits } from '../Audit';
import { cars } from '../CAR';
import { BarList } from './BarList';
import { buyerOf, countBy, displayStatus, displayStatuses, findSupplierByName, mockNote } from './shared';

type Row = { cells: (string | number)[]; supplierId?: string; tab?: string };
type Kpi = { label: string; value: string | number; note: string; tone: Tone };
type Section = {
  id: string; tab: string; title: string; description: string; kpis: Kpi[]; trend: { title: string; base: number[]; tone: Tone; kind?: 'count' | 'score' };
  distribution: { title: string; items: { label: string; value: number }[] }; columns: string[]; rows: Row[]; drill: { label: string; screen: Screen; section?: string }[];
};

type Grouping = 'Month' | 'Quarter' | 'Year';
const groupings: Grouping[] = ['Month', 'Quarter', 'Year'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const riskScore: Record<string, number> = { Critical: 78, 'High Risk': 68, 'Medium Risk': 46, 'Low Risk': 24 };
const MAX_MONTHS = 24;

// Months are handled as 'YYYY-MM' strings so they can be bound straight to <input type="month">.
const toYm = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthIndex = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
const fromIndex = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
const monthLabel = (value: string) => `${monthNames[Number(value.slice(5, 7)) - 1]} ${value.slice(2, 4)}`;
const currentYm = toYm(new Date());
const shiftYm = (value: string, months: number) => fromIndex(monthIndex(value) + months);

type Period = 'all' | 'this' | '3' | 'ytd' | '12' | 'custom';
const periodOptions: { value: Period; label: string }[] = [
  { value: 'all', label: 'All time' }, { value: 'this', label: 'This month' }, { value: '3', label: 'Last 3 months' },
  { value: 'ytd', label: 'Year to date' }, { value: '12', label: 'Last 12 months' }, { value: 'custom', label: 'Custom months' },
];
const presetFrom: Record<Exclude<Period, 'all' | 'custom'>, () => string> = {
  this: () => currentYm, '3': () => shiftYm(currentYm, -2), ytd: () => `${currentYm.slice(0, 4)}-01`, '12': () => shiftYm(currentYm, -11),
};

// Record dates come as ISO or 'Mon D, YYYY'; anything else is treated as undated and always shown.
function monthOf(value?: string) {
  if (!value || !/\d{4}/.test(value)) return undefined;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? undefined : toYm(date);
}

// MOCK: monthly values are demo numbers. The last 12 months follow the base series; older months repeat it at a lower level.
function monthlyValue(base: number[], month: string, kind: 'count' | 'score') {
  const back = monthIndex(currentYm) - monthIndex(month);
  if (back < 0) return 0;
  const value = base[11 - (back % 12)];
  const years = Math.floor(back / 12);
  return kind === 'score' ? value - years * 2 : Math.max(0, Math.round(value * (1 - years * 0.12)));
}

// Total (counts) or average (scores) of the monthly values between two months.
function periodValue(base: number[], kind: 'count' | 'score', from: string, to: string) {
  const values: number[] = [];
  for (let index = monthIndex(from); index <= monthIndex(to); index += 1) values.push(monthlyValue(base, fromIndex(index), kind));
  const sum = values.reduce((total, value) => total + value, 0);
  return kind === 'score' ? Math.round(sum / (values.length || 1)) : sum;
}

type Bucket = { label: string; value: number };
function buildSeries(base: number[], kind: 'count' | 'score', from: string, to: string, grouping: Grouping): Bucket[] {
  const months: string[] = [];
  for (let index = monthIndex(from); index <= monthIndex(to); index += 1) months.push(fromIndex(index));
  const groups = new Map<string, number[]>();
  months.forEach(month => {
    const year = month.slice(0, 4);
    const key = grouping === 'Month' ? monthLabel(month) : grouping === 'Quarter' ? `Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1} ${year}` : year;
    groups.set(key, [...(groups.get(key) ?? []), monthlyValue(base, month, kind)]);
  });
  return [...groups.entries()].map(([label, values]) => ({ label, value: kind === 'score' ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : values.reduce((sum, value) => sum + value, 0) }));
}

const average = (values: number[]) => (values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0);

// Module Reports: one report per SLM module with a month range, monthly or yearly totals, summary table and drill-down.
export default function ModuleReports() {
  const { navigate, openSupplier } = useNavigation();
  const [tab, setTab] = useState('registration');
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState(shiftYm(currentYm, -11));
  const [customTo, setCustomTo] = useState(currentYm);
  const [grouping, setGrouping] = useState<Grouping>('Month');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [category, setCategory] = useState('');
  const [buyer, setBuyer] = useState('');
  const [status, setStatus] = useState('');
  const live = useQslQuery(() => ({ qsl: getQslSummary(demoActors.Admin), capabilities: listCapabilities(demoActors.Admin).rows, suspended: listDirectory(demoActors.Admin, { status: 'Suspended' }).rows.map(row => row.supplierId) }), []).data;

  // 'All time' applies no date filter; the trend then shows the last 12 months.
  const range = period === 'all' ? undefined : period === 'custom' ? { from: customFrom, to: customTo } : { from: presetFrom[period](), to: currentYm };
  const from = range?.from ?? shiftYm(currentYm, -11);
  const to = range?.to ?? currentYm;
  const inPeriod = (value?: string) => { const month = monthOf(value); return !range || !month || (month >= range.from && month <= range.to); };

  const suspendedIds = new Set(live?.suspended ?? []);
  const filtered = !!(category || buyer || status);
  const scopedBase = suppliers.filter(supplier => (!category || supplier.category === category) && (!buyer || buyerOf(supplier) === buyer) && (!status || displayStatus(supplier, suspendedIds) === status));
  const scopedIds = new Set(scopedBase.map(supplier => supplier.id));
  const scoped = scopedBase.filter(supplier => inPeriod(supplier.lastUpdated));
  const inScope = (name: string) => { if (!filtered) return true; const match = findSupplierByName(name); return !!match && scopedIds.has(match.id); };
  const idOf = (name: string) => findSupplierByName(name)?.id;
  const categories = [...new Set(suppliers.map(supplier => supplier.category))].sort();
  const buyers = [...new Set(suppliers.map(buyerOf))].sort();

  const statusCount = (name: string) => scoped.filter(supplier => displayStatus(supplier, suspendedIds) === name).length;
  const qualCount = (name: string) => scoped.filter(supplier => supplier.qualificationStatus === name).length;
  const riskCount = (name: string) => scoped.filter(supplier => supplier.risk === name).length;
  const capabilities = (live?.capabilities ?? []).filter(row => inScope(row.supplierName));
  const capCount = (...names: string[]) => capabilities.filter(row => names.includes(row.status)).length;
  const companies = complianceCompanies.filter(company => (!filtered || scopedIds.has(company.id)) && inPeriod(company.lastSync));
  const complianceItems = companies.flatMap(company => company.items);
  const samples = Object.entries(sampleRequests).filter(([id]) => !filtered || scopedIds.has(id)).flatMap(([id, list]) => list.map(sample => ({ ...sample, supplierId: id }))).filter(sample => inPeriod(sample.requested));
  const auditRows = audits.filter(audit => inScope(audit.supplier) && inPeriod(audit.due));
  const carRows = cars.filter(car => inScope(car.supplier) && inPeriod(car.due));
  const performance = performanceSuppliers.filter(item => inScope(item.name));
  const qsl = live?.qsl;

  const sections: Section[] = [
    {
      id: 'registration', tab: 'Registration', title: 'Supplier Registration Report', description: 'Suppliers registered in SLM, by current status and by how many joined in each period',
      kpis: [{ label: 'Registered suppliers', value: scoped.length, note: 'In the selected scope', tone: 'brand' }, { label: 'Active', value: statusCount('Active'), note: 'Qualified to supply', tone: 'success' }, { label: 'Pending', value: statusCount('Pending'), note: 'Onboarding or review', tone: 'warning' }, { label: 'Inactive', value: statusCount('Inactive'), note: 'Draft or rejected', tone: 'neutral' }],
      trend: { title: 'New registrations', base: [3, 4, 2, 5, 6, 4, 7, 5, 6, 8, 7, 9], tone: 'brand' },
      distribution: { title: 'Suppliers by status', items: displayStatuses.map(name => ({ label: name, value: statusCount(name) })) },
      columns: ['Supplier ID', 'Supplier', 'Category', 'Buyer / company', 'Status', 'Last updated'],
      rows: scoped.map(supplier => ({ cells: [supplier.id, supplier.name, supplier.category, buyerOf(supplier), displayStatus(supplier, suspendedIds), supplier.lastUpdated ?? '—'], supplierId: supplier.id, tab: 'Profile' })),
      drill: [{ label: 'Open supplier directory', screen: 'suppliers' }, { label: 'Open onboarding register', screen: 'onboarding' }],
    },
    {
      id: 'qualification', tab: 'Qualification', title: 'Supplier Qualification Summary', description: 'Which suppliers have passed qualification and which are still waiting',
      kpis: [{ label: 'Qualified', value: qualCount('Qualified'), note: 'Passed qualification', tone: 'success' }, { label: 'Pending', value: qualCount('Pending'), note: 'In assessment', tone: 'warning' }, { label: 'Expired', value: qualCount('Expired'), note: 'Requalification needed', tone: 'danger' }, { label: 'Rejected', value: qualCount('Rejected'), note: 'Did not qualify', tone: 'danger' }],
      trend: { title: 'Qualifications completed', base: [1, 2, 1, 3, 2, 4, 3, 2, 4, 3, 5, 4], tone: 'success' },
      distribution: { title: 'Suppliers by qualification status', items: ['Qualified', 'Pending', 'Expired', 'Rejected'].map(name => ({ label: name, value: qualCount(name) })) },
      columns: ['Supplier', 'Category', 'Qualification status', 'Owner'],
      rows: scoped.map(supplier => ({ cells: [supplier.name, supplier.category, supplier.qualificationStatus ?? supplier.qual, supplier.owner], supplierId: supplier.id, tab: 'Qualification' })),
      drill: [{ label: 'Open qualification list', screen: 'qualification', section: 'pending' }, { label: 'Open requalification', screen: 'qualification', section: 'requalification' }],
    },
    {
      id: 'qsl', tab: 'Qualification & QSL', title: 'Qualification & QSL Summary', description: 'Where each supplier stands on the QSL. It covers all suppliers, so the filters do not apply',
      kpis: [{ label: 'Published', value: qsl?.published ?? '—', note: 'On the QSL', tone: 'success' }, { label: 'Eligible, not published', value: qsl?.eligible ?? '—', note: 'Approved, awaiting publish', tone: 'brand' }, { label: 'Suspended', value: qsl?.suspended ?? '—', note: 'Suspended from the QSL', tone: 'warning' }, { label: 'Expired', value: qsl?.expired ?? '—', note: 'Validity ended', tone: 'danger' }],
      trend: { title: 'Listings published', base: [1, 0, 2, 1, 3, 2, 1, 2, 3, 2, 1, 2], tone: 'brand' },
      distribution: { title: 'Published suppliers by category', items: (qsl?.byCategory ?? []).map(item => ({ label: item.category, value: item.total })) },
      columns: ['Category', 'Published suppliers'], rows: (qsl?.byCategory ?? []).map(item => ({ cells: [item.category, item.total] })),
      drill: [{ label: 'Open qualified list', screen: 'qualification', section: 'qualified' }],
    },
    {
      id: 'capability', tab: 'Capability', title: 'Capability Approval Summary', description: 'Capabilities and skill ratings that are waiting for approval or already approved',
      kpis: [{ label: 'Approved', value: capCount('Approved'), note: 'Capability approved', tone: 'success' }, { label: 'In assessment', value: capCount('In assessment'), note: 'Assessment running', tone: 'info' }, { label: 'Pending approval', value: capCount('Pending buyer approval'), note: 'Waiting for the buyer', tone: 'warning' }, { label: 'Revision requested', value: capCount('Revision requested'), note: 'Back to supplier', tone: 'danger' }],
      trend: { title: 'Capabilities approved', base: [0, 1, 1, 2, 1, 2, 3, 2, 3, 2, 4, 3], tone: 'success' },
      distribution: { title: 'Capabilities by status', items: countBy(capabilities, row => row.status) },
      columns: ['Supplier', 'Category', 'Scope', 'Status', 'Valid until'],
      rows: capabilities.map(row => ({ cells: [row.supplierName, row.category, row.scope, row.status, row.validUntil ?? '—'], supplierId: row.supplierId, tab: 'Capabilities' })),
      drill: [{ label: 'Open capability list', screen: 'qualification', section: 'qualified' }],
    },
    {
      id: 'risk', tab: 'Risk', title: 'Supplier Risk Summary', description: 'Risk level and score of each supplier, and how many need action',
      kpis: [{ label: 'Critical', value: riskCount('Critical'), note: 'Immediate action', tone: 'danger' }, { label: 'High', value: riskCount('High Risk'), note: 'Escalated', tone: 'danger' }, { label: 'Medium', value: riskCount('Medium Risk'), note: 'Monitor', tone: 'warning' }, { label: 'Low', value: riskCount('Low Risk'), note: 'Within appetite', tone: 'success' }],
      trend: { title: 'High and critical suppliers', base: [3, 3, 4, 4, 3, 5, 4, 5, 4, 5, 6, 5], tone: 'danger' },
      distribution: { title: 'Suppliers by risk level', items: ['Critical', 'High Risk', 'Medium Risk', 'Low Risk'].map(name => ({ label: name, value: riskCount(name) })) },
      columns: ['Supplier', 'Risk level', 'Risk score', 'Owner'],
      rows: [...scoped].sort((a, b) => riskScore[b.risk] - riskScore[a.risk]).map(supplier => ({ cells: [supplier.name, supplier.risk, riskScore[supplier.risk], supplier.owner], supplierId: supplier.id, tab: 'Risk' })),
      drill: [{ label: 'Open risk overview', screen: 'risk' }],
    },
    {
      id: 'compliance', tab: 'Compliance', title: 'Compliance Summary', description: 'Status of documents, contracts, audits and screening, and what needs follow-up',
      kpis: [{ label: 'Average compliance', value: `${average(companies.map(company => company.compliance))}%`, note: 'Across suppliers', tone: 'brand' }, { label: 'Items tracked', value: complianceItems.length, note: 'All obligation types', tone: 'neutral' }, { label: 'Need attention', value: complianceItems.filter(needsAttention).length, note: 'Expiring, expired or missing', tone: 'danger' }, { label: 'Below 70%', value: companies.filter(company => company.compliance < 70).length, note: 'Suppliers', tone: 'warning' }],
      trend: { title: 'Average compliance score', base: [74, 75, 73, 76, 77, 76, 78, 77, 79, 78, 80, 81], tone: 'brand', kind: 'score' },
      distribution: { title: 'Items by status', items: countBy(complianceItems, item => item.status) },
      columns: ['Supplier', 'Compliance %', 'Items tracked', 'Need attention', 'Last sync'],
      rows: companies.map(company => ({ cells: [company.name, company.compliance, company.items.length, company.items.filter(needsAttention).length, company.lastSync], supplierId: company.id, tab: 'Compliance' })),
      drill: [{ label: 'Open compliance overview', screen: 'compliance', section: 'overview' }, { label: 'Open document renewal', screen: 'compliance', section: 'renewal' }],
    },
    {
      id: 'samples', tab: 'Sample Requests', title: 'Sample Request Summary', description: 'Sample requests from the request to the test result and decision',
      kpis: [{ label: 'Total requests', value: samples.length, note: 'All time', tone: 'brand' }, { label: 'In progress', value: samples.filter(isSampleOpen).length, note: 'Requested to testing', tone: 'info' }, { label: 'Approved', value: samples.filter(sample => sample.status === 'Approved').length, note: 'Passed evaluation', tone: 'success' }, { label: 'Rejected', value: samples.filter(sample => sample.status === 'Rejected').length, note: 'Failed evaluation', tone: 'danger' }],
      trend: { title: 'Sample requests raised', base: [2, 3, 2, 4, 3, 5, 4, 3, 5, 4, 6, 4], tone: 'brand' },
      distribution: { title: 'Requests by status', items: countBy(samples, sample => sample.status) },
      columns: ['Request', 'Supplier', 'Product', 'Status', 'Required by'],
      rows: samples.map(sample => ({ cells: [sample.id, suppliers.find(item => item.id === sample.supplierId)?.name ?? sample.supplierId, sample.product, sample.status, sample.required], supplierId: sample.supplierId, tab: 'Compliance' })),
      drill: [{ label: 'Open sample request tracking', screen: 'onboarding', section: 'samples' }],
    },
    {
      id: 'audit', tab: 'Audit & Assessment', title: 'Audit & Assessment Summary', description: 'Audit campaigns, grades and open findings',
      kpis: [{ label: 'Audits', value: auditRows.length, note: 'All campaigns', tone: 'brand' }, { label: 'In progress', value: auditRows.filter(audit => audit.status === 'In Progress').length, note: 'Fieldwork running', tone: 'info' }, { label: 'Completed', value: auditRows.filter(audit => audit.status === 'Completed').length, note: 'Report issued', tone: 'success' }, { label: 'Open findings', value: auditRows.reduce((total, audit) => total + audit.findings.filter(finding => finding.status !== 'Closed').length, 0), note: 'Not yet closed', tone: 'warning' }],
      trend: { title: 'Audits completed', base: [1, 0, 1, 2, 1, 1, 2, 1, 2, 1, 2, 1], tone: 'success' },
      distribution: { title: 'Audits by status', items: countBy(auditRows, audit => audit.status) },
      columns: ['Audit', 'Supplier', 'Type', 'Auditor', 'Due', 'Status', 'Grade'],
      rows: auditRows.map(audit => ({ cells: [audit.id, audit.supplier, audit.type, audit.auditor, audit.due, audit.status, audit.grade], supplierId: idOf(audit.supplier), tab: 'Audit' })),
      drill: [{ label: 'Open audit & assessment', screen: 'audit' }],
    },
    {
      id: 'car', tab: 'Corrective Action', title: 'Corrective Action Summary', description: 'Corrective actions (CAR) and supplier plans (CAP) that are open, overdue or closed',
      kpis: [{ label: 'Corrective actions', value: carRows.length, note: 'All CARs', tone: 'brand' }, { label: 'Open', value: carRows.filter(car => car.status !== 'Completed').length, note: 'Not closed', tone: 'warning' }, { label: 'Overdue', value: carRows.filter(car => car.status === 'Overdue').length, note: 'Past due date', tone: 'danger' }, { label: 'Completed', value: carRows.filter(car => car.status === 'Completed').length, note: 'Verified and closed', tone: 'success' }],
      trend: { title: 'CARs issued', base: [2, 1, 3, 2, 2, 4, 3, 2, 3, 4, 3, 2], tone: 'warning' },
      distribution: { title: 'CARs by status', items: countBy(carRows, car => car.status) },
      columns: ['CAR', 'Supplier', 'Issue', 'Severity', 'Due', 'Status'],
      rows: carRows.map(car => ({ cells: [car.id, car.supplier, car.issue, car.severity, car.due, car.status], supplierId: idOf(car.supplier), tab: 'CAR' })),
      drill: [{ label: 'Open corrective action', screen: 'car' }],
    },
    {
      id: 'performance', tab: 'Performance', title: 'Supplier Performance Summary', description: 'Scorecard results by supplier, from top performers to those below target',
      kpis: [{ label: 'Average score', value: `${average(performance.map(item => item.score))}%`, note: 'Across suppliers', tone: 'brand' }, { label: 'Suppliers scored', value: performance.length, note: 'With a scorecard', tone: 'neutral' }, { label: 'Top performers', value: performance.filter(item => item.score >= 90).length, note: 'Score 90 or higher', tone: 'success' }, { label: 'Below target', value: performance.filter(item => item.score < 60).length, note: 'Score under 60', tone: 'danger' }],
      trend: { title: 'Average performance score', base: [72, 74, 71, 76, 75, 78, 77, 76, 78, 79, 78, 80], tone: 'brand', kind: 'score' },
      distribution: { title: 'Suppliers by score band', items: [{ label: 'Excellent (90+)', value: performance.filter(item => item.score >= 90).length }, { label: 'Good (75–89)', value: performance.filter(item => item.score >= 75 && item.score < 90).length }, { label: 'Fair (60–74)', value: performance.filter(item => item.score >= 60 && item.score < 75).length }, { label: 'Poor (under 60)', value: performance.filter(item => item.score < 60).length }] },
      columns: ['Supplier', 'Category', 'Score', 'Delivery', 'Quality', 'Cost', 'Responsiveness'],
      rows: [...performance].sort((a, b) => b.score - a.score).map(item => ({ cells: [item.name, item.category, item.score, item.delivery, item.quality, item.cost, item.resp], supplierId: idOf(item.name), tab: 'Performance' })),
      drill: [{ label: 'Open performance management', screen: 'performance' }],
    },
  ];

  const section = sections.find(item => item.id === tab) ?? sections[0];
  const kind = section.trend.kind ?? 'count';
  const rangeStart = monthIndex(to) - monthIndex(from) >= MAX_MONTHS ? shiftYm(to, -(MAX_MONTHS - 1)) : from;
  const series = buildSeries(section.trend.base, kind, rangeStart, to, grouping);
  const total = section.distribution.items.reduce((sum, item) => sum + item.value, 0);
  const seriesTotal = series.reduce((sum, item) => sum + item.value, 0);
  const summaryRows = series.map((item, index) => {
    const previous = index > 0 ? series[index - 1].value : undefined;
    const change = previous === undefined ? '—' : `${item.value - previous > 0 ? '+' : ''}${item.value - previous}`;
    return [item.label, item.value, change, kind === 'count' ? `${seriesTotal ? Math.round((item.value / seriesTotal) * 100) : 0}%` : '—'];
  });
  const monthSpan = monthIndex(to) - monthIndex(rangeStart) + 1;
  const previousTo = shiftYm(rangeStart, -1);
  const current = periodValue(section.trend.base, kind, rangeStart, to);
  const previous = periodValue(section.trend.base, kind, shiftYm(previousTo, -(monthSpan - 1)), previousTo);
  const delta = current - previous;
  const deltaText = kind === 'score' ? `${delta > 0 ? '+' : ''}${delta} pts` : previous ? `${delta > 0 ? '+' : ''}${Math.round((delta / previous) * 100)}%` : '—';
  const upIsGood = section.trend.tone === 'brand' || section.trend.tone === 'success';
  const deltaTone: Tone = delta === 0 ? 'neutral' : (delta > 0) === upIsGood ? 'success' : 'danger';
  const peak = series.reduce((best, item) => (item.value > best.value ? item : best), series[0] ?? { label: '—', value: 0 });
  const low = series.reduce((worst, item) => (item.value < worst.value ? item : worst), series[0] ?? { label: '—', value: 0 });
  const unit = kind === 'score' ? '%' : '';
  const groupWord = grouping === 'Month' ? 'month' : grouping === 'Quarter' ? 'quarter' : 'year';
  const periodText = range ? `${monthLabel(rangeStart)} – ${monthLabel(to)}` : `${monthLabel(rangeStart)} – ${monthLabel(to)} (trend only)`;
  const open = (row: Row) => { const supplier = suppliers.find(item => item.id === row.supplierId); if (supplier) openSupplier(supplier, row.tab); };

  return (
    <div className="space-y-5">
      <Tabs<string> label="Report modules" value={section.id} onChange={setTab} items={sections.map(item => ({ value: item.id, label: item.tab }))} />

      <div>
        <Toolbar
          title={section.title}
          description={section.description}
          actions={<><ExportButton label="Export report" filename={`slm-${section.id}-report`} columns={section.columns} rows={section.rows.map(row => row.cells)} /><Button onClick={() => window.print()}>Print / PDF</Button></>}
          panelExtra={period === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0"><span className="mb-1.5 block text-caption font-medium text-brand-700">From month</span><Input type="month" aria-label="From month" value={customFrom} max={customTo} onChange={event => event.target.value && setCustomFrom(event.target.value)} /></label>
              <label className="block min-w-0"><span className="mb-1.5 block text-caption font-medium text-brand-700">To month</span><Input type="month" aria-label="To month" value={customTo} min={customFrom} onChange={event => event.target.value && setCustomTo(event.target.value)} /></label>
            </div>
          )}
        >
          <Select key="period" aria-label="Period" value={period} onChange={event => setPeriod(event.target.value as Period)}>{periodOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
          <Select key="grouping" aria-label="Group totals by" value={grouping} onChange={event => setGrouping(event.target.value as Grouping)}>{groupings.map(item => <option key={item}>{item}</option>)}</Select>
          <Select key="category" aria-label="Product category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</Select>
          <Select key="buyer" aria-label="Buyer / company" value={buyer} onChange={event => setBuyer(event.target.value)}><option value="">All buyers / companies</option>{buyers.map(item => <option key={item}>{item}</option>)}</Select>
          <Select key="status" aria-label="Supplier status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{displayStatuses.map(item => <option key={item}>{item}</option>)}</Select>
        </Toolbar>
        <p className="mt-2 text-caption text-ink-muted">{`Filters apply to the KPI cards, charts, period highlights and supplier list of every tab. ${scoped.length} of ${suppliers.length} suppliers in view. ${mockNote}`}</p>
      </div>
      <KpiGrid cols={4}>{section.kpis.map(kpi => <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} note={kpi.note} tone={kpi.tone} size="md" />)}</KpiGrid>

      <Grid cols={2}>
        <Card>
          <CardHeader title={section.trend.title} description={`${grouping === 'Month' ? 'Monthly' : grouping === 'Quarter' ? 'Quarterly' : 'Yearly'} · ${periodText}`} />
          <CardBody><ColumnChart values={series.map(item => item.value)} labels={series.map(item => item.label)} tone={section.trend.tone} showValues height={110} ariaLabel={section.trend.title} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={section.distribution.title} description="Current status of the suppliers in scope" />
          <CardBody>{section.distribution.items.length ? <BarList items={section.distribution.items} total={total} /> : <EmptyState title="No data for the selected filters" />}</CardBody>
        </Card>
      </Grid>

      <Card>
          <CardHeader title="Period highlights" description={`${section.trend.title} · ${periodText}`} actions={<Button onClick={() => setShowBreakdown(open => !open)}>{`${showBreakdown ? 'Hide' : 'Show'} ${groupWord}ly breakdown`}</Button>} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-control border border-line-subtle p-3"><Eyebrow>{kind === 'count' ? 'Total in period' : 'Average in period'}</Eyebrow><div className="mt-1 text-xl font-semibold tabular-nums text-ink">{current}{unit}</div><div className="text-caption text-ink-muted">{monthSpan} month{monthSpan > 1 ? 's' : ''}</div></div>
              <div className="rounded-control border border-line-subtle p-3"><Eyebrow>{`Vs previous ${monthSpan} month${monthSpan > 1 ? 's' : ''}`}</Eyebrow><div className={cx('mt-1 text-xl font-semibold tabular-nums', toneText[deltaTone])}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {deltaText}</div><div className="text-caption text-ink-muted">{`Was ${previous}${unit}`}</div></div>
              <div className="rounded-control border border-line-subtle p-3"><Eyebrow>Highest {groupWord}</Eyebrow><div className="mt-1 text-xl font-semibold tabular-nums text-ink">{peak.value}{unit}</div><div className="text-caption text-ink-muted">{peak.label}</div></div>
              <div className="rounded-control border border-line-subtle p-3"><Eyebrow>Lowest {groupWord}</Eyebrow><div className="mt-1 text-xl font-semibold tabular-nums text-ink">{low.value}{unit}</div><div className="text-caption text-ink-muted">{low.label}</div></div>
            </div>
          </CardBody>
          {showBreakdown && (
            <div className="border-t border-line-subtle">
              <div className="flex items-center justify-between gap-2 px-5 py-3"><span className="text-caption font-semibold text-ink-soft">{`${grouping}ly breakdown`}</span><ExportButton label="Export breakdown" filename={`slm-${section.id}-${grouping.toLowerCase()}-summary`} columns={[grouping, section.trend.title, 'Change', 'Share']} rows={summaryRows} /></div>
              <TableContainer>
                <Table minWidth={420}>
                  <HeadRow columns={[grouping, section.trend.title, 'Change', 'Share']} />
                  <tbody>{summaryRows.map(row => <Tr key={row[0]}>{row.map((cell, position) => <Td key={position} dense className={position === 0 ? 'font-medium text-ink' : 'tabular-nums'}>{cell}{position === 1 ? unit : ''}</Td>)}</Tr>)}</tbody>
                </Table>
              </TableContainer>
            </div>
          )}
        </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Supplier records" description={`${section.rows.length} records · current status`} actions={section.drill.map(link => <Button key={link.label} onClick={() => navigate(link.screen, link.section)}>{link.label}</Button>)} />
        <TableContainer>
          <Table minWidth={760}>
            <HeadRow columns={[...section.columns, '']} />
            <tbody>{section.rows.map((row, index) => (
              <Tr key={index} onClick={row.supplierId ? () => open(row) : undefined}>
                {row.cells.map((cell, position) => <Td key={position} dense className={position === 0 ? 'font-medium text-ink' : undefined}>{cell}</Td>)}
                <Td dense>{row.supplierId && <Button size="xs" variant="link" onClick={event => { event.stopPropagation(); open(row); }}>Open record</Button>}</Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {section.rows.length === 0 && <EmptyState title="No records match the selected filters" />}
      </Card>
    </div>
  );
}
