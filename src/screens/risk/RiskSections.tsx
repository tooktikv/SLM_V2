import { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import ExportButton from '../../components/ExportButton';
import { getConfig } from '../../config';
import { suppliers, type Supplier } from '../../data/suppliers';
import { useNavigation } from '../../NavigationContext';
import { Badge, Button, Callout, Card, CardBody, CardHeader, EmptyState, Grid, HeadRow, KpiCard, KpiGrid, SegmentedControl, Table, TableContainer, Td, Toolbar, Tr, cx, type Tone } from '../../components/ui';

// MOCK: score and level per supplier master risk label until the risk provider is connected.
const scoreOf = (supplier: Supplier) => (supplier.risk === 'Critical' ? 78 : supplier.risk === 'High Risk' ? 68 : supplier.risk === 'Medium Risk' ? 46 : 24);
const levelTone = (risk: string): Tone => (risk === 'Critical' || risk === 'High Risk' ? 'danger' : risk === 'Medium Risk' ? 'warning' : 'success');
const history: Record<string, number[]> = {
  'SUP-0012': [58, 62, 66, 70, 74, 78], 'SUP-0118': [60, 62, 64, 66, 68, 68], 'SUP-0051': [66, 66, 67, 68, 68, 68], 'SUP-0142': [72, 70, 69, 68, 68, 68],
  'SUP-0034': [40, 42, 44, 45, 46, 46], 'SUP-0089': [44, 44, 45, 46, 46, 46],
};
const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

// 6. Risk Assessment: questionnaire (from Administration), score, level and assessment date per supplier.
export function RiskAssessment({ onOpen }: { onOpen: (supplier: Supplier) => void }) {
  const settings = getConfig('risk');
  const questions = settings.criteria.filter(item => item.questionnaire);
  const ranked = [...suppliers].sort((a, b) => scoreOf(b) - scoreOf(a));
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader title="Supplier risk assessments" description="Score from 0 (low) to 100 (critical); levels follow the thresholds in Administration → Risk Config" actions={<><ExportButton filename="slm-risk-assessments" columns={['Supplier ID', 'Supplier', 'Risk score', 'Risk level', 'Assessment date', 'Owner']} rows={ranked.map(supplier => [supplier.id, supplier.name, scoreOf(supplier), supplier.risk, supplier.lastUpdated ?? supplier.lastReview, supplier.owner])} /><Button variant="primary">+ New Risk Assessment</Button></>} />
        <TableContainer>
          <Table minWidth={860}>
            <HeadRow columns={['Supplier', 'Risk score', 'Risk level', 'Assessment date', 'Owner', '']} />
            <tbody>{ranked.map(supplier => (
              <Tr key={supplier.id}>
                <Td><div className="font-medium text-ink">{supplier.name}</div><div className="font-mono text-caption text-ink-muted">{supplier.id}</div></Td>
                <Td><span className={cx('text-sm font-semibold tabular-nums', scoreOf(supplier) >= 68 ? 'text-danger-700' : scoreOf(supplier) >= 46 ? 'text-warning-700' : 'text-success-700')}>{scoreOf(supplier)}</span></Td>
                <Td><Badge small tone={levelTone(supplier.risk)}>{supplier.risk}</Badge></Td>
                <Td className="text-ink-muted">{supplier.lastUpdated ?? supplier.lastReview}</Td>
                <Td>{supplier.owner}</Td>
                <Td><Button size="xs" variant="link" onClick={() => onOpen(supplier)}>Open risk profile</Button></Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
      </Card>
      <Grid cols={2}>
        <Card>
          <CardHeader title="Risk questionnaire" description="Questions supplied to suppliers, from the risk criteria marked as questionnaire" />
          <ul className="divide-y divide-line-subtle">{questions.map(item => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-2.5"><div><div className="text-body text-ink">{item.name}</div><div className="text-caption text-ink-muted">{settings.categories.find(category => category.id === item.categoryId)?.name}</div></div><Badge small>{item.weight}% of category</Badge></li>
          ))}</ul>
          {questions.length === 0 && <EmptyState title="No questionnaire criteria configured" />}
        </Card>
        <Card>
          <CardHeader title="Risk categories and levels" />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">{settings.categories.map(category => <Badge key={category.id} tone="brand">{category.name} · {category.weight}%</Badge>)}</div>
            <div className="flex flex-wrap gap-2">{settings.levels.map(level => <Badge key={level.name} tone={level.name === 'Low' ? 'success' : level.name === 'Medium' ? 'warning' : 'danger'}>{level.name} from {level.min}</Badge>)}</div>
          </CardBody>
        </Card>
      </Grid>
    </div>
  );
}

type MonitoringView = 'high' | 'alerts' | 'history';

// 6. Risk Monitoring: high-risk list, alerts and score history.
export function RiskMonitoring({ onOpen }: { onOpen: (supplier: Supplier) => void }) {
  const { navigate } = useNavigation();
  const [view, setView] = useState<MonitoringView>('high');
  const threshold = getConfig('risk').levels.find(level => level.name === 'High')?.min ?? 60;
  const high = suppliers.filter(supplier => supplier.risk === 'Critical' || supplier.risk === 'High Risk').sort((a, b) => scoreOf(b) - scoreOf(a));
  const alerts = suppliers.filter(supplier => scoreOf(supplier) >= threshold).map(supplier => {
    const series = history[supplier.id];
    const change = series ? series[series.length - 1] - series[series.length - 2] : 0;
    return { supplier, score: scoreOf(supplier), change, reason: change > 0 ? `Score rose ${change} points` : 'Above the high-risk threshold' };
  });

  return (
    <div className="space-y-4">
      <KpiGrid cols={3}>
        <KpiCard label="High-risk suppliers" value={high.length} tone="danger" note="Critical or high" />
        <KpiCard label="Alert threshold" value={threshold} note="Administration → Risk Config" />
        <KpiCard label="Active alerts" value={alerts.length} tone={alerts.length ? 'warning' : 'success'} note="At or above the threshold" />
      </KpiGrid>
      <Toolbar>
        <SegmentedControl<MonitoringView> label="Risk monitoring view" value={view} onChange={setView} items={[{ value: 'high', label: 'High-risk suppliers' }, { value: 'alerts', label: 'Risk alerts' }, { value: 'history', label: 'Risk trend' }]} />
      </Toolbar>
      <Card className="overflow-hidden">
        {view === 'high' && (
          <TableContainer><Table minWidth={760}><HeadRow columns={['Supplier', 'Risk level', 'Score', 'Owner', 'Open actions', '']} /><tbody>{high.map(supplier => (
            <Tr key={supplier.id}><Td><div className="font-medium text-ink">{supplier.name}</div><div className="font-mono text-caption text-ink-muted">{supplier.id}</div></Td><Td><StatusBadge status={supplier.risk} small /></Td><Td className="tabular-nums">{scoreOf(supplier)}</Td><Td>{supplier.owner}</Td>
              <Td><Button size="xs" variant="link-muted" onClick={() => navigate('car')}>Corrective actions</Button></Td><Td><Button size="xs" variant="link" onClick={() => onOpen(supplier)}>Open profile</Button></Td></Tr>
          ))}</tbody></Table></TableContainer>
        )}
        {view === 'alerts' && (
          <div className="space-y-2 p-5">{alerts.map(item => (
            <Callout key={item.supplier.id} tone={item.score >= 78 ? 'danger' : 'warning'} compact title={`${item.supplier.name} · score ${item.score}`} actions={<Button size="xs" onClick={() => onOpen(item.supplier)}>Open</Button>}>{item.reason}. Owner {item.supplier.owner}.</Callout>
          ))}{alerts.length === 0 && <EmptyState title="No risk alerts" />}</div>
        )}
        {view === 'history' && (
          <TableContainer><Table minWidth={760}><HeadRow columns={['Supplier', ...months, 'Change']} /><tbody>{Object.entries(history).map(([id, series]) => {
            const supplier = suppliers.find(item => item.id === id)!;
            const change = series[series.length - 1] - series[0];
            return <Tr key={id}><Td className="font-medium text-ink">{supplier.name}</Td>{series.map((value, index) => <Td key={months[index]} className="tabular-nums">{value}</Td>)}<Td><span className={change > 0 ? 'font-semibold text-danger-700' : change < 0 ? 'font-semibold text-success-700' : 'text-ink-muted'}>{change > 0 ? `+${change}` : change}</span></Td></Tr>;
          })}</tbody></Table></TableContainer>
        )}
      </Card>
    </div>
  );
}
