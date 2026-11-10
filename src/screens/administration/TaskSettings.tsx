import { useState } from 'react';
import { REVIEWER_ROLES, getConfig, newId, updateConfig } from '../../config';
import type { AssignmentRule, ReviewWorkflow, TaskTemplate, TaskType } from '../../config';
import { Callout, Checkbox, Input, SegmentedControl, Select } from '../../components/ui';
import { DraftTable, NoticeBox, useAction, useConfigRevision } from './shared';

type View = 'types' | 'templates' | 'rules';
const WORKFLOWS: ReviewWorkflow[] = ['Single reviewer', 'Two-step review', 'Auto-accept'];

// C. Task configuration. Each task type has its own review workflow and reviewer mapping.
export default function TaskSettings() {
  useConfigRevision();
  const { notice, run, clear } = useAction();
  const [view, setView] = useState<View>('types');
  const [types, setTypes] = useState<TaskType[]>(() => getConfig('taskTypes'));
  const [templates, setTemplates] = useState<TaskTemplate[]>(() => getConfig('taskTemplates'));
  const [rules, setRules] = useState<AssignmentRule[]>(() => getConfig('assignmentRules'));
  const typeOptions = types.filter(item => item.active);
  const roleSelect = (value: string | undefined, onChange: (value: string) => void, label: string) => (
    <Select size="sm" aria-label={label} value={value ?? ''} onChange={event => onChange(event.target.value)}><option value="">— none —</option>{REVIEWER_ROLES.map(role => <option key={role}>{role}</option>)}</Select>
  );

  return (
    <div className="space-y-4">
      <SegmentedControl<View> label="Task configuration" value={view} onChange={next => { setView(next); clear(); }} items={[{ value: 'types', label: 'Task types & review' }, { value: 'templates', label: 'Task templates' }, { value: 'rules', label: 'Assignment rules' }]} />
      <NoticeBox notice={notice} />
      {view === 'types' && (
        <DraftTable<TaskType> title="Task types" description="Review workflow, reviewer mapping and due-date rules are set per task type" rows={types} setRows={setTypes} minWidth={1100}
          newRow={() => ({ id: newId('tt'), name: 'New task type', reviewWorkflow: 'Single reviewer', reviewerRole: 'Supplier Manager', dueDays: 14, reminderDaysBefore: 3, allowReturn: true, active: true })}
          onSave={() => run(() => { updateConfig('taskTypes', draft => { draft.splice(0, draft.length, ...types); }, 'Task types updated'); }, 'Task types saved')}
          columns={[
            { header: 'Name', render: (row, patch) => <Input aria-label="Task type name" value={row.name} onChange={event => patch({ name: event.target.value })} /> },
            { header: 'Review workflow', render: (row, patch) => <Select size="sm" aria-label="Review workflow" value={row.reviewWorkflow} onChange={event => { const reviewWorkflow = event.target.value as ReviewWorkflow; patch({ reviewWorkflow, allowReturn: reviewWorkflow === 'Auto-accept' ? false : row.allowReturn, reviewerRole: reviewWorkflow === 'Auto-accept' ? '' : row.reviewerRole }); }}>{WORKFLOWS.map(item => <option key={item}>{item}</option>)}</Select> },
            { header: 'Reviewer', render: (row, patch) => (row.reviewWorkflow === 'Auto-accept' ? <span className="text-caption text-ink-muted">No review</span> : roleSelect(row.reviewerRole, value => patch({ reviewerRole: value }), 'Reviewer')) },
            { header: 'Second reviewer', render: (row, patch) => (row.reviewWorkflow === 'Two-step review' ? roleSelect(row.secondReviewerRole, value => patch({ secondReviewerRole: value }), 'Second reviewer') : <span className="text-ink-muted">—</span>) },
            { header: 'Due (days)', render: (row, patch) => <Input aria-label="Due days" type="number" className="w-20" value={row.dueDays} onChange={event => patch({ dueDays: Number(event.target.value) })} /> },
            { header: 'Remind before', render: (row, patch) => <Input aria-label="Reminder days before due" type="number" className="w-20" value={row.reminderDaysBefore} onChange={event => patch({ reminderDaysBefore: Number(event.target.value) })} /> },
            { header: 'Return', render: (row, patch) => <Checkbox aria-label="Allow return for correction" checked={row.allowReturn} disabled={row.reviewWorkflow === 'Auto-accept'} onChange={event => patch({ allowReturn: event.target.checked })} /> },
            { header: 'Active', render: (row, patch) => <Checkbox aria-label="Active" checked={row.active} onChange={event => patch({ active: event.target.checked })} /> },
          ]} />
      )}
      {view === 'templates' && (
        <DraftTable<TaskTemplate> title="Task templates" description="Instructions, forms and documents sent to the Supplier Portal with the task" rows={templates} setRows={setTemplates} minWidth={1000}
          newRow={() => ({ id: newId('tm'), name: 'New template', taskTypeId: typeOptions[0]?.id ?? '', instructions: '', requiredForms: '', requiredDocuments: '', active: true })}
          onSave={() => run(() => { updateConfig('taskTemplates', draft => { draft.splice(0, draft.length, ...templates); }, 'Task templates updated'); }, 'Task templates saved')}
          columns={[
            { header: 'Name', render: (row, patch) => <Input aria-label="Template name" value={row.name} onChange={event => patch({ name: event.target.value })} /> },
            { header: 'Task type', render: (row, patch) => <Select size="sm" aria-label="Task type" value={row.taskTypeId} onChange={event => patch({ taskTypeId: event.target.value })}>{typeOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select> },
            { header: 'Instructions', render: (row, patch) => <Input aria-label="Instructions" value={row.instructions} onChange={event => patch({ instructions: event.target.value })} /> },
            { header: 'Required forms', render: (row, patch) => <Input aria-label="Required forms" value={row.requiredForms} onChange={event => patch({ requiredForms: event.target.value })} /> },
            { header: 'Required documents', render: (row, patch) => <Input aria-label="Required documents" value={row.requiredDocuments} onChange={event => patch({ requiredDocuments: event.target.value })} /> },
            { header: 'Active', render: (row, patch) => <Checkbox aria-label="Active" checked={row.active} onChange={event => patch({ active: event.target.checked })} /> },
          ]} />
      )}
      {view === 'rules' && (
        <>
          <Callout tone="info" compact>Rules create and assign tasks automatically. The Supplier Portal receives and executes them.</Callout>
          <DraftTable<AssignmentRule> title="Task assignment rules" rows={rules} setRows={setRules} minWidth={900}
            newRow={() => ({ id: newId('ar'), trigger: 'New trigger', taskTypeId: typeOptions[0]?.id ?? '', assignTo: 'Supplier owner', active: true })}
            onSave={() => run(() => { updateConfig('assignmentRules', draft => { draft.splice(0, draft.length, ...rules); }, 'Assignment rules updated'); }, 'Assignment rules saved')}
            columns={[
              { header: 'Trigger', render: (row, patch) => <Input aria-label="Trigger" value={row.trigger} onChange={event => patch({ trigger: event.target.value })} /> },
              { header: 'Task type', render: (row, patch) => <Select size="sm" aria-label="Task type" value={row.taskTypeId} onChange={event => patch({ taskTypeId: event.target.value })}>{types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select> },
              { header: 'Assign internal owner', render: (row, patch) => <Select size="sm" aria-label="Assign to" value={row.assignTo} onChange={event => patch({ assignTo: event.target.value as AssignmentRule['assignTo'] })}><option>Supplier owner</option><option>Category owner</option><option>Named role</option></Select> },
              { header: 'Role', render: (row, patch) => (row.assignTo === 'Named role' ? roleSelect(row.role, value => patch({ role: value }), 'Role') : <span className="text-ink-muted">—</span>) },
              { header: 'Active', render: (row, patch) => <Checkbox aria-label="Active" checked={row.active} onChange={event => patch({ active: event.target.checked })} /> },
            ]} />
        </>
      )}
    </div>
  );
}
