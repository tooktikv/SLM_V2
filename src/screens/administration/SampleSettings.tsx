import { useState } from 'react';
import { getConfig, newId, updateConfig } from '../../config';
import type { SampleCriterion, SampleRequestType, SampleRequirement, SampleResultOption, SampleSettings as SampleConfig } from '../../config';
import { Checkbox, Input, SegmentedControl, Select } from '../../components/ui';
import { DraftTable, NoticeBox, useAction, useConfigRevision } from './shared';

type View = 'types' | 'requirements' | 'criteria' | 'results';

// F. Sample settings. Evaluation is done by the Buyer / requester; the Supplier Portal only collects the supplier's response.
export default function SampleSettings() {
  useConfigRevision();
  const { notice, run, clear } = useAction();
  const [view, setView] = useState<View>('types');
  const initial = getConfig('samples');
  const [types, setTypes] = useState<SampleRequestType[]>(initial.requestTypes);
  const [requirements, setRequirements] = useState<SampleRequirement[]>(initial.requirements);
  const [criteria, setCriteria] = useState<SampleCriterion[]>(initial.criteria);
  const [results, setResults] = useState<SampleResultOption[]>(initial.resultOptions);
  const save = (apply: (draft: SampleConfig) => void, label: string) => run(() => { updateConfig('samples', apply, `${label} updated`); }, `${label} saved`);

  return (
    <div className="space-y-4">
      <SegmentedControl<View> label="Sample settings" value={view} onChange={next => { setView(next); clear(); }} items={[{ value: 'types', label: 'Request types' }, { value: 'requirements', label: 'Requirements' }, { value: 'criteria', label: 'Evaluation criteria' }, { value: 'results', label: 'Result options' }]} />
      <NoticeBox notice={notice} />
      {view === 'types' && (
        <DraftTable<SampleRequestType> title="Sample request types" rows={types} setRows={setTypes} minWidth={720}
          newRow={() => ({ id: newId('st'), name: 'New request type', defaultDueDays: 14, evaluationRequired: true, active: true })}
          onSave={() => save(draft => { draft.requestTypes = types; }, 'Request types')}
          columns={[
            { header: 'Name', render: (row, patch) => <Input aria-label="Request type name" value={row.name} onChange={event => patch({ name: event.target.value })} /> },
            { header: 'Default due (days)', render: (row, patch) => <Input aria-label="Default due days" type="number" className="w-24" value={row.defaultDueDays} onChange={event => patch({ defaultDueDays: Number(event.target.value) })} /> },
            { header: 'Evaluation required', render: (row, patch) => <Checkbox aria-label="Evaluation required" checked={row.evaluationRequired} onChange={event => patch({ evaluationRequired: event.target.checked })} /> },
            { header: 'Active', render: (row, patch) => <Checkbox aria-label="Active" checked={row.active} onChange={event => patch({ active: event.target.checked })} /> },
          ]} />
      )}
      {view === 'requirements' && (
        <DraftTable<SampleRequirement> title="Sample requirements" description="What the supplier must provide for each request type" rows={requirements} setRows={setRequirements} minWidth={720}
          newRow={() => ({ id: newId('sr'), requestTypeId: types[0]?.id ?? '', name: 'New requirement', mandatory: true })}
          onSave={() => save(draft => { draft.requestTypes = types; draft.requirements = requirements; }, 'Requirements')}
          columns={[
            { header: 'Request type', render: (row, patch) => <Select size="sm" aria-label="Request type" value={row.requestTypeId} onChange={event => patch({ requestTypeId: event.target.value })}>{types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select> },
            { header: 'Requirement', render: (row, patch) => <Input aria-label="Requirement" value={row.name} onChange={event => patch({ name: event.target.value })} /> },
            { header: 'Mandatory', render: (row, patch) => <Checkbox aria-label="Mandatory" checked={row.mandatory} onChange={event => patch({ mandatory: event.target.checked })} /> },
          ]} />
      )}
      {view === 'criteria' && (
        <DraftTable<SampleCriterion> title="Evaluation criteria" rows={criteria} setRows={setCriteria} minWidth={640}
          newRow={() => ({ id: newId('sc'), name: 'New criterion', passMark: 80, active: true })}
          onSave={() => save(draft => { draft.criteria = criteria; }, 'Evaluation criteria')}
          columns={[
            { header: 'Criterion', render: (row, patch) => <Input aria-label="Criterion" value={row.name} onChange={event => patch({ name: event.target.value })} /> },
            { header: 'Pass mark (%)', render: (row, patch) => <Input aria-label="Pass mark" type="number" className="w-24" value={row.passMark} onChange={event => patch({ passMark: Number(event.target.value) })} /> },
            { header: 'Active', render: (row, patch) => <Checkbox aria-label="Active" checked={row.active} onChange={event => patch({ active: event.target.checked })} /> },
          ]} />
      )}
      {view === 'results' && (
        <DraftTable<SampleResultOption> title="Evaluation result options" description="At least one Accept and one Fail outcome are required" rows={results} setRows={setResults} minWidth={560}
          newRow={() => ({ id: newId('sro'), label: 'New result', outcome: 'Retest' })}
          onSave={() => save(draft => { draft.resultOptions = results; }, 'Result options')}
          columns={[
            { header: 'Label', render: (row, patch) => <Input aria-label="Result label" value={row.label} onChange={event => patch({ label: event.target.value })} /> },
            { header: 'Outcome', render: (row, patch) => <Select size="sm" aria-label="Outcome" value={row.outcome} onChange={event => patch({ outcome: event.target.value as SampleResultOption['outcome'] })}><option>Accept</option><option>Fail</option><option>Retest</option></Select> },
          ]} />
      )}
    </div>
  );
}
