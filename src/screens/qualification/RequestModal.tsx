import { useMemo, useState } from 'react';
import type { Actor, ScopeType } from '../../qsl/types';
import { SCOPE_TYPES } from '../../qsl/types';
import { createDraft, submitRequest, updateDraft, type RequestInput } from '../../qsl/services/assessments';
import { getRequestDraft, getRequestOptions } from '../../qsl/services/queries';
import { Button, Callout, Field, Input, Modal, SegmentedControl, Select, Textarea } from '../../components/ui';
import { errorMessage, formatDate } from './shared';

type Props = { actor: Actor; draftId?: string; prefill?: RequestInput; onClose: () => void; onDone: (id: string) => void };

const today = () => new Date().toISOString().slice(0, 10);

// Qualification Request: supplier, product category, scope, form, assignees and optional sample evaluation.
export function RequestModal({ actor, draftId, prefill, onClose, onDone }: Props) {
  const options = useMemo(() => getRequestOptions(actor), [actor]);
  const initial = useMemo<RequestInput & { documents?: string[] }>(() => (draftId ? getRequestDraft(actor, draftId) : prefill ?? { supplierId: '' }), [actor, draftId, prefill]);
  const [supplierId, setSupplierId] = useState(initial.supplierId ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [scopeType, setScopeType] = useState<ScopeType>(initial.scopeType ?? 'Site / plant');
  const [scopeDetail, setScopeDetail] = useState(initial.scopeDetail ?? '');
  const [formId, setFormId] = useState(initial.formId ?? '');
  const [type, setType] = useState<'First' | 'Re'>(initial.assessmentType ?? 'First');
  const [previousId, setPreviousId] = useState(initial.previousQslId ?? '');
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '');
  const [coordinatorId, setCoordinatorId] = useState(initial.coordinatorId ?? (actor.role === 'Coordinator' ? actor.id : options.coordinators[0]?.id ?? ''));
  const [assessorId, setAssessorId] = useState(initial.assessorId ?? '');
  const [approverId, setApproverId] = useState(initial.approverId ?? '');
  const [reason, setReason] = useState(initial.reason ?? '');
  const [files, setFiles] = useState<string[]>(initial.documents ?? []);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const forms = options.forms.filter(form => form.categories.includes(category));
  const previousOptions = options.completed.filter(item => item.supplierId === supplierId && item.category === category);

  const errors: Record<string, string> = {};
  if (!supplierId) errors.supplier = 'Please select a supplier';
  if (!category) errors.category = 'Please select a category';
  if (scopeType !== 'Company-wide' && !scopeDetail.trim()) errors.scope = 'Please enter the scope details, e.g. plant name or product line';
  if (!formId || !forms.some(form => form.id === formId)) errors.form = 'Please select an active assessment form';
  if (type === 'Re' && !previousOptions.some(item => item.id === previousId)) errors.previous = previousOptions.length ? 'Please select the previous round' : 'No completed earlier round for this supplier and category';
  if (!dueDate) errors.dueDate = 'Please enter a due date';
  else if (dueDate < today()) errors.dueDate = 'Due date must not be in the past';
  if (!assessorId) errors.assessor = 'Please select an assessor';
  if (!approverId) errors.approver = 'Please select an approver';
  else if (options.separateRule && approverId === assessorId) errors.approver = 'The approver must be a different person from the assessor';
  if (!reason.trim()) errors.reason = 'Please enter the reason for the assessment';
  const shown = (key: string) => (showErrors ? errors[key] : undefined);
  const hint = (key: string) => (shown(key) ? <span className="text-danger-700">{shown(key)}</span> : undefined);

  const chooseSupplier = (id: string) => {
    const supplier = options.suppliers.find(item => item.id === id);
    setSupplierId(id);
    setCategory(supplier?.category ?? '');
    setPreviousId('');
    const matching = options.forms.filter(form => !!supplier?.category && form.categories.includes(supplier.category));
    setFormId(matching.length === 1 ? matching[0].id : '');
  };
  const chooseCategory = (name: string) => {
    setCategory(name);
    setPreviousId('');
    const matching = options.forms.filter(form => form.categories.includes(name));
    setFormId(matching.length === 1 ? matching[0].id : '');
  };

  const payload = (): RequestInput => ({
    supplierId, category, formId, assessmentType: type, previousQslId: type === 'Re' ? previousId : undefined, sampleRequired: false, scopeType, scopeDetail, dueDate: dueDate || undefined,
    coordinatorId, assessorId, approverId, reason, documents: files,
  });

  const run = (submit: boolean) => {
    setServerError(null);
    if (!supplierId || (submit && Object.keys(errors).length)) { setShowErrors(true); return; }
    try {
      const saved = draftId ? updateDraft(actor, draftId, payload()) : createDraft(actor, payload());
      if (submit) submitRequest(actor, saved.id);
      onDone(saved.id);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  const errorList = Object.values(errors);

  return (
    <Modal title="Qualification Request" eyebrow={type === 'Re' ? 'Renewal / Reassessment' : 'Create assessment request'} onClose={onClose} closeLabel="Close">
      {showErrors && errorList.length > 0 && (
        <Callout tone="danger" title="Some information is missing"><ul className="list-disc pl-4">{errorList.map(message => <li key={message}>{message}</li>)}</ul></Callout>
      )}
      {serverError && <Callout tone="danger" title={serverError.message}>{serverError.details.length > 0 && <ul className="list-disc pl-4">{serverError.details.map(message => <li key={message}>{message}</li>)}</ul>}</Callout>}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-ink">Supplier, product category and scope</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier" required hint={hint('supplier')}>
            <Select value={supplierId} aria-invalid={!!shown('supplier') || undefined} onChange={event => chooseSupplier(event.target.value)}>
              <option value="">— Select supplier —</option>
              {options.suppliers.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
            </Select>
          </Field>
          <Field label="Product Category" required hint={hint('category')}>
            <SegmentedControl label="Product Category" value={category} onChange={chooseCategory} items={options.categories.map(name => ({ value: name, label: name }))} />
          </Field>
          <Field label="Qualification Scope" required>
            <Select value={scopeType} onChange={event => setScopeType(event.target.value as ScopeType)}>{SCOPE_TYPES.map(item => <option key={item}>{item}</option>)}</Select>
          </Field>
          <Field label="Scope details" required={scopeType !== 'Company-wide'} hint={hint('scope')}>
            <Input value={scopeDetail} invalid={!!shown('scope')} disabled={scopeType === 'Company-wide'} placeholder="e.g. plant name / product line" onChange={event => setScopeDetail(event.target.value)} />
          </Field>
          <Field label="Assessment form" required hint={hint('form') ?? (category ? undefined : 'Select a product category first')}>
            <Select value={formId} aria-invalid={!!shown('form') || undefined} disabled={!category} onChange={event => setFormId(event.target.value)}>
              <option value="">— Select assessment form —</option>
              {forms.map(form => <option key={form.id} value={form.id}>{form.label}</option>)}
            </Select>
          </Field>
          <Field label="Assessment type" required>
            <SegmentedControl label="Assessment type" value={type} onChange={value => { setType(value); setPreviousId(''); }} items={[{ value: 'First', label: 'First assessment' }, { value: 'Re', label: 'Reassessment' }]} />
          </Field>
          {type === 'Re' && (
            <Field label="Linked previous round" required className="sm:col-span-2" hint={hint('previous')}>
              <Select value={previousId} aria-invalid={!!shown('previous') || undefined} onChange={event => setPreviousId(event.target.value)}>
                <option value="">— Select previous round —</option>
                {previousOptions.map(item => <option key={item.id} value={item.id}>{item.qslNo} · {item.result === 'Pass' ? 'Pass' : 'Fail'}{item.expiryDate ? ` · expires ${formatDate(item.expiryDate)}` : ''}</option>)}
              </Select>
            </Field>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-ink">Due date and people involved</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier due date" required hint={hint('dueDate')}><Input type="date" value={dueDate} invalid={!!shown('dueDate')} onChange={event => setDueDate(event.target.value)} /></Field>
          <Field label="Coordinator (requester)" required>
            <Select value={coordinatorId} onChange={event => setCoordinatorId(event.target.value)}>{options.coordinators.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</Select>
          </Field>
          <Field label="Assessor" required hint={hint('assessor')}>
            <Select value={assessorId} aria-invalid={!!shown('assessor') || undefined} onChange={event => setAssessorId(event.target.value)}><option value="">— Select assessor —</option>{options.assessors.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</Select>
          </Field>
          <Field label="Approver (central)" required hint={hint('approver')}>
            <Select value={approverId} aria-invalid={!!shown('approver') || undefined} onChange={event => setApproverId(event.target.value)}><option value="">— Select approver —</option>{options.approvers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</Select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-ink">Reason and attachments</h3>
        <Field label="Reason for the assessment" required hint={hint('reason')}><Textarea value={reason} invalid={!!shown('reason')} onChange={event => setReason(event.target.value)} /></Field>
        <Field label="Attach documents" hint={files.length ? files.join(', ') : 'Multiple files allowed (only file names are stored in this prototype)'}>
          <input type="file" multiple className="block w-full text-caption text-ink-soft" onChange={event => setFiles([...files, ...Array.from(event.target.files ?? []).map(file => file.name)])} />
        </Field>
      </section>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => run(false)}>Save draft</Button>
        <Button variant="primary" onClick={() => run(true)}>Submit request</Button>
      </div>
    </Modal>
  );
}
