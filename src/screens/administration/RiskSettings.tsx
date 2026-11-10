import { useState } from 'react';
import { getConfig, newId, updateConfig } from '../../config';
import type { RiskCategory, RiskCriterion, RiskLevel } from '../../config';
import { Button, Callout, Card, CardBody, CardHeader, Checkbox, Field, Input, Select } from '../../components/ui';
import { DraftTable, NoticeBox, useAction, useConfigRevision } from './shared';

// G. Risk settings: categories, criteria, weights, scoring and levels. The existing escalation thresholds stay on this page.
export default function RiskSettings() {
  useConfigRevision();
  const { notice, run } = useAction();
  const initial = getConfig('risk');
  const [categories, setCategories] = useState<RiskCategory[]>(initial.categories);
  const [criteria, setCriteria] = useState<RiskCriterion[]>(initial.criteria);
  const [levels, setLevels] = useState<RiskLevel[]>(initial.levels);
  const total = categories.reduce((sum, item) => sum + item.weight, 0);
  const save = (label: string) => run(() => { updateConfig('risk', draft => { draft.categories = categories; draft.criteria = criteria; draft.levels = levels; }, `${label} updated`); }, `${label} saved`);

  return (
    <div className="mt-4 max-w-5xl space-y-4">
      <NoticeBox notice={notice} />
      <Callout tone="info" compact>Internal risk assessment and score ownership stay in SLM. Questionnaire answers can be received from the Supplier Portal.</Callout>
      <DraftTable<RiskCategory> title="Risk categories and weights" description="Category weights must total 100" rows={categories} setRows={setCategories} minWidth={560}
        footer={<span className={total === 100 ? 'font-semibold text-success-700' : 'font-semibold text-warning-700'}>Total weight {total}%</span>}
        newRow={() => ({ id: newId('rc'), name: 'New category', weight: 0 })} onSave={() => save('Risk categories')}
        columns={[
          { header: 'Category', render: (row, patch) => <Input aria-label="Risk category" value={row.name} onChange={event => patch({ name: event.target.value })} /> },
          { header: 'Weight (%)', render: (row, patch) => <Input aria-label="Category weight" type="number" className="w-24" value={row.weight} onChange={event => patch({ weight: Number(event.target.value) })} /> },
        ]} />
      <DraftTable<RiskCriterion> title="Risk criteria and questionnaire" description="Weights inside each category must total 100" rows={criteria} setRows={setCriteria} minWidth={760}
        newRow={() => ({ id: newId('rk'), categoryId: categories[0]?.id ?? '', name: 'New criterion', weight: 0, questionnaire: false })} onSave={() => save('Risk criteria')}
        columns={[
          { header: 'Category', render: (row, patch) => <Select size="sm" aria-label="Category" value={row.categoryId} onChange={event => patch({ categoryId: event.target.value })}>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select> },
          { header: 'Criterion', render: (row, patch) => <Input aria-label="Risk criterion" value={row.name} onChange={event => patch({ name: event.target.value })} /> },
          { header: 'Weight (%)', render: (row, patch) => <Input aria-label="Criterion weight" type="number" className="w-24" value={row.weight} onChange={event => patch({ weight: Number(event.target.value) })} /> },
          { header: 'Answered by supplier', render: (row, patch) => <Checkbox aria-label="Supplier questionnaire" checked={row.questionnaire} onChange={event => patch({ questionnaire: event.target.checked })} /> },
        ]} />
      <Card>
        <CardHeader title="Scoring and risk levels" description={`Method: ${initial.scoring.method}, scale 0-${initial.scoring.scale}`} />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {levels.map((level, index) => (
              <Field key={level.name} label={`${level.name} starts at`}><Input aria-label={`${level.name} threshold`} type="number" disabled={index === 0} value={level.min} onChange={event => setLevels(levels.map((item, position) => (position === index ? { ...item, min: Number(event.target.value) } : item)))} /></Field>
            ))}
          </div>
          <div className="mt-4 border-t border-line-subtle pt-4 text-right"><Button variant="primary" onClick={() => save('Risk levels')}>Save risk levels</Button></div>
        </CardBody>
      </Card>
    </div>
  );
}
