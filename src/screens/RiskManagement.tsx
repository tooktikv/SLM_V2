import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { suppliers } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { RiskAssessment, RiskMonitoring } from './risk/RiskSections';
import { Button, Card, CardBody, CardHeader, Grid, HeadRow, KpiCard, KpiGrid, Page, PageContent, Table, TableContainer, Td, Tr, cx, type Tone } from '../components/ui';

const riskSuppliers = [
  { name: 'Titan Industries Ltd', id: 'SUP-0012', overall: 'Critical', score: 91, financial: 'High', operational: 'Critical', quality: 'Medium', esg: 'High', cyber: 'Low', trend: '↑', owner: 'S. Chen' },
  { name: 'Chemcore Solutions', id: 'SUP-0118', overall: 'High Risk', score: 78, financial: 'Medium', operational: 'High', quality: 'High', esg: 'Critical', cyber: 'Low', trend: '↑', owner: 'R. Okafor' },
  { name: 'GlobalTech Mfg', id: 'SUP-0051', overall: 'High Risk', score: 74, financial: 'Low', operational: 'Medium', quality: 'High', esg: 'Medium', cyber: 'High', trend: '→', owner: 'L. Torres' },
  { name: 'SteelForce Europe', id: 'SUP-0142', overall: 'High Risk', score: 71, financial: 'High', operational: 'High', quality: 'Low', esg: 'Low', cyber: 'Low', trend: '↓', owner: 'L. Torres' },
  { name: 'Apex Components', id: 'SUP-0034', overall: 'Medium Risk', score: 52, financial: 'Low', operational: 'Medium', quality: 'Medium', esg: 'Low', cyber: 'Medium', trend: '↑', owner: 'M. Patel' },
];

const categories = [
  { cat: 'Financial', crit: 3, high: 8, med: 24, low: 64 },
  { cat: 'Operational', crit: 2, high: 12, med: 31, low: 55 },
  { cat: 'Quality', crit: 4, high: 9, med: 28, low: 59 },
  { cat: 'Delivery', crit: 1, high: 6, med: 19, low: 74 },
  { cat: 'Cybersecurity', crit: 0, high: 4, med: 15, low: 81 },
  { cat: 'ESG', crit: 5, high: 14, med: 22, low: 59 },
  { cat: 'Regulatory', crit: 1, high: 7, med: 20, low: 72 },
  { cat: 'Geopolitical', crit: 2, high: 10, med: 18, low: 70 },
];

const heatmapData = [
  [0,1,2,3,2],
  [1,2,3,4,3],
  [2,3,3,3,2],
  [1,2,2,3,2],
  [0,1,1,2,1],
];

const levelColor = ['bg-success-50', 'bg-success-200', 'bg-warning-200', 'bg-danger-600', 'bg-danger-700'];
const levelText = ['text-ink-soft', 'text-ink', 'text-ink', 'text-white', 'text-white'];
const levelLabels = ['Very Low', 'Low', 'Medium', 'High', 'Critical'];
const impactLabels = ['Very High', 'High', 'Med', 'Low', 'Very Low'];
const likelihoodLabels = ['Unlikely', 'Possible', 'Likely', 'Very Likely', 'Certain'];

const riskDetail = [
  { risk: 'Debt-to-equity ratio increased to 3.2x (Q3 2024)', severity: 'Critical', impact: 'Supply continuity', mitigation: 'Monitor quarterly financials, prepare backup supplier', owner: 'S. Chen', due: 'Oct 15', supplier: 'Titan Industries' },
  { risk: 'ESG audit failed — hazardous waste disposal non-compliance', severity: 'Critical', impact: 'Regulatory fine, reputational', mitigation: 'Immediate CAR required, site audit scheduled Nov 2024', owner: 'R. Okafor', due: 'Nov 1', supplier: 'Chemcore Solutions' },
  { risk: 'Single-source dependency — 68% of ball bearing supply', severity: 'High', impact: 'Production halt risk', mitigation: 'Dual-source strategy in progress', owner: 'L. Torres', due: 'Dec 31', supplier: 'GlobalTech Mfg' },
];

const trendTone: Record<string, string> = { '↑': 'text-danger-600', '↓': 'text-success-600', '→': 'text-ink-muted' };
const trendLabel: Record<string, string> = { '↑': 'Trending up', '↓': 'Trending down', '→': 'Stable' };

function RiskCell({ level, label }: { level: number; label: string }) {
  return (
    <div role="img" aria-label={`${label}: ${levelLabels[level]}`} className={cx('flex h-10 items-center justify-center rounded-sm text-micro font-semibold', levelColor[level], levelText[level])}>
      {['VL','L','M','H','C'][level]}
    </div>
  );
}

export default function RiskManagement() {
  const { openSupplier, section } = useNavigation();
  const openSupplierByName = (name: string) => {
    const supplier = suppliers.find(item => item.name.startsWith(name) || name.startsWith(item.name.split(' ')[0]));
    if (supplier) openSupplier(supplier, 'Risk');
  };
  const count = (label: string) => suppliers.filter(supplier => supplier.risk === label).length;
  const kpis: { l: string; v: number; tone: Tone }[] = [
    { l: 'Critical Risk', v: count('Critical'), tone: 'danger' },
    { l: 'High Risk', v: count('High Risk'), tone: 'danger' },
    { l: 'Medium Risk', v: count('Medium Risk'), tone: 'warning' },
    { l: 'Low Risk', v: count('Low Risk'), tone: 'success' },
    { l: 'Trending Up', v: riskSuppliers.filter(item => item.trend === '↑').length, tone: 'danger' },
  ];
  const title = section === 'assessment' ? 'Risk Assessment' : section === 'monitoring' ? 'Monitoring & Alerts' : 'Risk Overview';

  if (section === 'assessment' || section === 'monitoring') {
    return (
      <Page>
        <Header breadcrumb={['Monitor', 'Risk Management']} title={title} />
        <PageContent>{section === 'assessment' ? <RiskAssessment onOpen={supplier => openSupplier(supplier, 'Risk')} /> : <RiskMonitoring onOpen={supplier => openSupplier(supplier, 'Risk')} />}</PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <Header breadcrumb={['Monitor', 'Risk Management']} title={title} />
      <PageContent>

        {/* KPI Row */}
        <KpiGrid cols={5}>
          {kpis.map(s => <KpiCard key={s.l} label={s.l} value={s.v} tone={s.tone} />)}
        </KpiGrid>

        <Grid cols={3}>
          {/* Risk by category */}
          <Card>
            <CardHeader title="Risk by Category" />
            <CardBody>
              <div className="space-y-3">
                {categories.map(c => (
                  <div key={c.cat}>
                    <div className="mb-1.5 flex justify-between">
                      <span className="text-caption text-ink-soft">{c.cat}</span>
                      <span className="text-caption font-semibold text-danger-700">{c.crit > 0 ? `${c.crit} Critical` : `${c.high} High`}</span>
                    </div>
                    <div className="flex h-2 gap-px overflow-hidden rounded-full" aria-hidden="true">
                      <div className="rounded-l-full bg-danger-700" style={{ width: `${c.crit}%` }} />
                      <div className="bg-danger-500" style={{ width: `${c.high}%` }} />
                      <div className="bg-warning-500" style={{ width: `${c.med}%` }} />
                      <div className="flex-1 rounded-r-full bg-success-500" />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Heatmap */}
          <Card>
            <CardHeader title="Risk Heatmap" />
            <CardBody>
              <div className="flex gap-2">
                <div className="grid grid-rows-5 gap-1 pt-7">
                  {impactLabels.map(l => (
                    <div key={l} className="flex h-10 w-14 items-center justify-end pr-1 text-micro text-ink-muted">{l}</div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 grid h-6 grid-cols-5 gap-1">
                    {likelihoodLabels.map(l => (
                      <div key={l} className="text-center text-micro leading-tight text-ink-muted">{l}</div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {heatmapData.map((row, ri) => (
                      <div key={ri} className="grid grid-cols-5 gap-1">
                        {row.map((cell, ci) => (
                          <RiskCell key={ci} level={cell} label={`Impact ${impactLabels[ri]}, likelihood ${likelihoodLabels[ci]}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-subtle pt-3">
                {levelLabels.map((l, i) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div aria-hidden="true" className={cx('h-3 w-3 rounded-sm border border-line', levelColor[i])} />
                    <span className="text-caption text-ink-muted">{l}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Top risk suppliers */}
          <Card>
            <CardHeader title="Top Risk Suppliers" />
            <CardBody className="space-y-1 p-3">
              {riskSuppliers.slice(0,5).map((s, i) => (
                <button key={i} type="button" onClick={() => openSupplierByName(s.name)} className="flex w-full items-center gap-3 rounded-control p-2 text-left transition-colors hover:bg-canvas">
                  <div className={cx('w-7 text-center text-body font-semibold tabular-nums', s.score >= 80 ? 'text-danger-700' : s.score >= 60 ? 'text-warning-700' : 'text-success-700')}>{s.score}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-medium text-ink">{s.name}</div>
                    <div className="text-caption text-ink-muted">{s.owner}</div>
                  </div>
                  <span role="img" aria-label={trendLabel[s.trend]} className={cx('text-body font-semibold', trendTone[s.trend])}>{s.trend}</span>
                  <StatusBadge status={s.overall} small />
                </button>
              ))}
            </CardBody>
          </Card>
        </Grid>

        {/* Risk Detail Table */}
        <Card className="overflow-hidden">
          <CardHeader title="Risk Register — Critical & High" actions={<ExportButton filename="slm-risk-register" columns={['Supplier', 'Risk', 'Severity', 'Impact', 'Mitigation', 'Owner', 'Due date']} rows={riskDetail.map(r => [r.supplier, r.risk, r.severity, r.impact, r.mitigation, r.owner, r.due])} />} />
          <TableContainer>
            <Table minWidth={960}>
              <HeadRow columns={['Supplier','Risk','Severity','Impact','Mitigation','Owner','Due Date']} />
              <tbody>
                {riskDetail.map((r, i) => (
                  <Tr key={i}>
                    <Td><Button variant="inline" size="md" onClick={() => openSupplierByName(r.supplier)}>{r.supplier}</Button></Td>
                    <Td className="max-w-xs text-ink">{r.risk}</Td>
                    <Td><StatusBadge status={r.severity === 'Critical' ? 'Critical' : 'High Risk'} small /></Td>
                    <Td>{r.impact}</Td>
                    <Td className="max-w-xs">{r.mitigation}</Td>
                    <Td>{r.owner}</Td>
                    <Td className="whitespace-nowrap">{r.due}</Td>
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
