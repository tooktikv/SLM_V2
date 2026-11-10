import { useState } from 'react';
import { suppliers } from '../data/suppliers';
import { getConfig } from '../config';
import { assignTask, createTask } from '../tasks';
import type { TaskActor } from '../tasks';
import { cycle, isoInDays } from '../lib/demo';
import { Button, Callout, Checkbox, Field, Input, Modal, Select, Textarea } from './ui';

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong');

// Creates a supplier task from a template or task type and optionally sends it to the Supplier Portal.
export function NewTaskModal({ actor, supplierId: initialSupplierId, onClose, onCreated }: { actor: TaskActor; supplierId?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const templates = getConfig('taskTemplates').filter(item => item.active);
  const types = getConfig('taskTypes').filter(item => item.active);
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? suppliers[0]?.id ?? '');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [title, setTitle] = useState(templates[0]?.name ?? '');
  const [instructions, setInstructions] = useState(templates[0]?.instructions ?? '');
  const [dueDate, setDueDate] = useState('');
  const [assignNow, setAssignNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fills, setFills] = useState(0);
  const template = templates.find(item => item.id === templateId);
  const type = types.find(item => item.id === (template?.taskTypeId ?? typeId));

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const next = templates.find(item => item.id === id);
    setTitle(next?.name ?? '');
    setInstructions(next?.instructions ?? '');
  };
  const fillSample = () => {
    if (!initialSupplierId && suppliers.length) setSupplierId(cycle(suppliers, fills).id);
    if (templates.length) pickTemplate(cycle(templates, fills).id);
    setDueDate(isoInDays(14));
    setAssignNow(true);
    setError(null);
    setFills(fills + 1);
  };
  const submit = () => {
    try {
      const task = createTask(actor, { supplierId, templateId: templateId || undefined, taskTypeId: templateId ? undefined : typeId, title, instructions, dueDate: dueDate || undefined });
      if (assignNow) assignTask(actor, task.id);
      onCreated(task.id);
    } catch (caught) { setError(errorText(caught)); }
  };

  return (
    <Modal title="New supplier task" eyebrow="Task assignment" onClose={onClose} onFillSample={fillSample} closeLabel="Close">
      <div className="space-y-4">
        {error && <Callout tone="danger" title={error} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier" required className="sm:col-span-2"><Select value={supplierId} onChange={event => setSupplierId(event.target.value)}>{suppliers.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}</Select></Field>
          <Field label="Task template"><Select value={templateId} onChange={event => pickTemplate(event.target.value)}><option value="">No template</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Task type" required hint={templateId ? 'Set by the template' : undefined}><Select value={template?.taskTypeId ?? typeId} disabled={!!templateId} onChange={event => setTypeId(event.target.value)}>{types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Title" required className="sm:col-span-2"><Input value={title} onChange={event => setTitle(event.target.value)} /></Field>
          <Field label="Instructions" className="sm:col-span-2"><Textarea value={instructions} onChange={event => setInstructions(event.target.value)} /></Field>
          <Field label="Due date" hint={type ? `Default: ${type.dueDays} days after assignment` : undefined}><Input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></Field>
        </div>
        {type && <Callout tone="info" compact>Review: {type.reviewWorkflow === 'Auto-accept' ? 'none, responses are accepted automatically' : type.reviewWorkflow === 'Two-step review' ? `${type.reviewerRole}, then ${type.secondReviewerRole}` : type.reviewerRole}. Configured in Administration → Tasks.</Callout>}
        <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={assignNow} onChange={event => setAssignNow(event.target.checked)} />Assign to the supplier now (sends the task to the Supplier Portal)</label>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>{assignNow ? 'Create and assign' : 'Save as draft'}</Button></div>
      </div>
    </Modal>
  );
}
