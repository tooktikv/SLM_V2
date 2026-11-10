import { useMemo, useState, type ReactNode } from 'react';
import type { Actor, RateBasis, RequiredEvidence, ScopeType } from '../../qsl/types';
import { SCOPE_TYPES } from '../../qsl/types';
import { createDraft, submitRequest, updateDraft, type RequestInput } from '../../qsl/services/assessments';
import { getFormSkills, getRequestDraft, getRequestOptions } from '../../qsl/services/queries';
import { CURRENCIES, EVIDENCE_DOC_TYPES, RATE_BASES, defaultPortalRequest, validatePortalRequest } from '../../qsl/services/portalModel';
import { ratingScaleOf } from '../../qsl/services/portal';
import { Badge, Button, Callout, Checkbox, DetailGrid, Field, FileDrop, HeadRow, Input, Modal, MultiSelect, ProgressBar, SegmentedControl, Select, Table, TableContainer, Td, Textarea, Tr } from '../../components/ui';
import { useT } from '../../i18n';
import { errorMessage, formatDate } from './shared';
import { cycle, isoInDays } from '../../lib/demo';

type Props = { actor: Actor; draftId?: string; prefill?: RequestInput; onClose: () => void; onDone: (id: string) => void };

const today = () => new Date().toISOString().slice(0, 10);

// Qualification Request as a four-step flow: supplier and scope, team and schedule, Supplier Portal request, review.
const STEPS = ['Supplier & scope', 'Team & schedule', 'Supplier Portal', 'Review'];
const TEAM_KEYS = ['dueDate', 'assessor', 'approver', 'reason'];
const stepOfKey = (key: string) => (key.startsWith('portal') ? 2 : TEAM_KEYS.includes(key) ? 1 : 0);

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
  const portalDefaults = useMemo(() => defaultPortalRequest(actor.name), [actor]);
  const [buyer, setBuyer] = useState(initial.portal?.buyer ?? portalDefaults.buyer);
  const [buyerEdited, setBuyerEdited] = useState(!!initial.portal?.buyer && initial.portal.buyer !== actor.name);
  const [instructions, setInstructions] = useState(initial.portal?.instructions ?? portalDefaults.instructions);
  const [currencies, setCurrencies] = useState<string[]>(initial.portal?.currencies ?? portalDefaults.currencies);
  const [rateBases, setRateBases] = useState<RateBasis[]>(initial.portal?.rateBases ?? portalDefaults.rateBases);
  const [requiredEvidence, setRequiredEvidence] = useState<RequiredEvidence[]>(initial.portal?.requiredEvidence ?? portalDefaults.requiredEvidence);
  const t = useT();
  const [step, setStep] = useState(0);
  const [addedId, setAddedId] = useState('');
  const [fills, setFills] = useState(0);
  const [touched, setTouched] = useState<number[]>([]);
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const forms = options.forms.filter(form => form.categories.includes(category));
  const previousOptions = options.completed.filter(item => item.supplierId === supplierId && item.category === category);

  const skills = useMemo(() => (formId ? getFormSkills(actor, formId) : []), [actor, formId]);
  const scale = useMemo(() => ratingScaleOf(), []);
  const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  const portalPayload = { requestId: '', buyer, instructions, currencies, rateBases, requiredEvidence };
  const changeEvidence = (id: string, patch: Partial<RequiredEvidence>) => setRequiredEvidence(list => list.map(item => (item.id === id ? { ...item, ...patch } : item)));

  const errors: Record<string, string> = {};
  validatePortalRequest(portalPayload).forEach((message, index) => { errors[`portal${index}`] = message; });
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
  const stepKeys = (index: number) => Object.keys(errors).filter(key => stepOfKey(key) === index);
  const touch = (...indexes: number[]) => setTouched(list => [...new Set([...list, ...indexes])]);
  const showPortal = touched.includes(2);
  const shown = (key: string) => (touched.includes(stepOfKey(key)) ? errors[key] : undefined);
  const hint = (key: string) => (shown(key) ? <span className="text-danger-700">{shown(key)}</span> : undefined);

  const chooseSupplier = (id: string) => {
    const supplier = options.suppliers.find(item => item.id === id);
    setSupplierId(id);
    if (!buyerEdited) setBuyer([actor.name, supplier?.buyerUnit].filter(Boolean).join(' · '));
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

  const fillSample = () => {
    const free = options.suppliers.filter(item => !item.hasOpenRound);
    const supplier = cycle(free.length ? free : options.suppliers, fills);
    const assessor = cycle(options.assessors, fills);
    chooseSupplier(supplier.id);
    setFormId(options.forms.find(form => !!supplier.category && form.categories.includes(supplier.category))?.id ?? '');
    setType('First');
    setScopeType('Site / plant');
    setScopeDetail(`${supplier.name} main plant`);
    setDueDate(isoInDays(30));
    setAssessorId(assessor.id);
    setApproverId((options.approvers.find(user => user.id !== assessor.id) ?? options.approvers[0])?.id ?? '');
    setReason(cycle(['Annual supplier qualification', 'Extension to a new product category', 'New supplier onboarding'], fills));
    setTouched([]);
    setServerError(null);
    setFills(fills + 1);
  };

  const payload = (): RequestInput => ({
    supplierId, category, formId, assessmentType: type, previousQslId: type === 'Re' ? previousId : undefined, sampleRequired: false, scopeType, scopeDetail, dueDate: dueDate || undefined,
    coordinatorId, assessorId, approverId, reason, documents: files, portal: { buyer, instructions, currencies, rateBases, requiredEvidence },
  });

  const run = (submit: boolean) => {
    setServerError(null);
    if (!supplierId) { touch(0); setStep(0); return; }
    if (submit) {
      const blocked = [0, 1, 2].find(index => stepKeys(index).length);
      if (blocked !== undefined) { touch(0, 1, 2); setStep(blocked); return; }
    }
    try {
      const saved = draftId ? updateDraft(actor, draftId, payload()) : createDraft(actor, payload());
      if (submit) submitRequest(actor, saved.id);
      onDone(saved.id);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };
  const next = () => {
    touch(step);
    if (!stepKeys(step).length) setStep(step + 1);
  };

  const stepErrors = touched.includes(step) ? stepKeys(step).map(key => errors[key]) : [];
  const supplierName = options.suppliers.find(item => item.id === supplierId)?.name ?? '—';
  const userName = (list: { id: string; name: string }[], id: string) => list.find(item => item.id === id)?.name ?? '—';
  const previous = previousOptions.find(item => item.id === previousId);
  const formLabel = forms.find(form => form.id === formId)?.label ?? '—';
  const reviewCard = (title: string, target: number, items: { label: string; value: ReactNode; wide?: boolean }[]) => (
    <div className="rounded-control border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{title}</h3><Button size="xs" variant="link" onClick={() => setStep(target)}>Edit</Button></div>
      <DetailGrid items={items} />
    </div>
  );

  return (
    <Modal title="Qualification Request" eyebrow={type === 'Re' ? 'Renewal / Reassessment' : 'Create assessment request'} onClose={onClose} onFillSample={fillSample} closeLabel="Close">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-caption"><span className="font-semibold text-ink">{t(`Step ${step + 1} of ${STEPS.length}`)}</span><span className="text-ink-muted">{t(STEPS[step])}</span></div>
        <ProgressBar value={((step + 1) / STEPS.length) * 100} label={t(`Step ${step + 1} of ${STEPS.length}`)} />
      </div>
      {stepErrors.length > 0 && (
        <Callout tone="danger" title="Some information is missing"><ul className="list-disc pl-4">{stepErrors.map(message => <li key={message}>{message}</li>)}</ul></Callout>
      )}
      {serverError && <Callout tone="danger" title={serverError.message}>{serverError.details.length > 0 && <ul className="list-disc pl-4">{serverError.details.map(message => <li key={message}>{message}</li>)}</ul>}</Callout>}

      {step === 0 && (
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

      )}

      {step === 1 && (
        <>
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
        <div>
          <div className="mb-2 text-body font-medium text-ink">Attach documents</div>
          <FileDrop files={files} onChange={setFiles} label="Attach documents" hint="Only file names are stored in this prototype" />
        </div>
      </section>

        </>
      )}

      {step === 2 && (
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Request to the Supplier Portal</h3>
          <p className="mt-0.5 text-caption text-ink-muted">What the supplier sees and has to provide: skills with a rate card, commercial terms and supporting documents.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Requesting Buyer" required className="sm:col-span-2" hint={showPortal && !buyer.trim() ? <span className="text-danger-700">Please enter the requesting buyer</span> : 'Shown to the supplier, e.g. name and company'}>
            <Input value={buyer} invalid={showPortal && !buyer.trim()} onChange={event => { setBuyer(event.target.value); setBuyerEdited(true); }} />
          </Field>
          <Field label="Currencies" required hint={showPortal && !currencies.length ? <span className="text-danger-700">Select at least one currency</span> : 'The first one selected is the default'}>
            <div className="flex flex-wrap gap-2">{CURRENCIES.map(code => <Button key={code} size="sm" variant={currencies.includes(code) ? 'primary' : 'secondary'} aria-pressed={currencies.includes(code)} onClick={() => setCurrencies(list => toggle(list, code))}>{code}</Button>)}</div>
          </Field>
          <Field label="Rate basis" required hint={showPortal && !rateBases.length ? <span className="text-danger-700">Select at least one rate basis</span> : 'How the supplier quotes its rates'}>
            <div className="flex flex-wrap gap-2">{RATE_BASES.map(item => <Button key={item} size="sm" variant={rateBases.includes(item) ? 'primary' : 'secondary'} aria-pressed={rateBases.includes(item)} onClick={() => setRateBases(list => toggle(list, item))}>{item}</Button>)}</div>
          </Field>
          <Field label="Submission instructions" required className="sm:col-span-2" hint={showPortal && !instructions.trim() ? <span className="text-danger-700">Please enter the submission instructions</span> : undefined}>
            <Textarea value={instructions} invalid={showPortal && !instructions.trim()} onChange={event => setInstructions(event.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-body font-medium text-ink">Skills the supplier will rate</span>
            <span className="text-caption text-ink-muted">Rating scale: {scale.map(item => `${item.level} ${item.name}`).join(' · ')}</span>
          </div>
          {skills.length ? (
            <div className="overflow-hidden rounded-control border border-line">
              <TableContainer>
                <Table minWidth={620}>
                  <HeadRow columns={['Skill group', 'Skill / criteria', 'Defined by', 'Requirement', 'Evidence']} />
                  <tbody>{skills.map(item => (
                    <Tr key={item.id}>
                      <Td dense className="text-ink-muted">{item.group}</Td><Td dense className="font-medium text-ink">{item.name}</Td>
                      <Td dense><Badge small tone={item.source === 'Central Standard' ? 'brand' : 'info'}>{item.source}</Badge></Td>
                      <Td dense><Badge small tone={item.mandatory ? 'warning' : 'neutral'}>{item.mandatory ? 'Mandatory' : 'Optional'}</Badge></Td>
                      <Td dense>{item.evidenceRequired ? <Badge small tone="warning">Evidence required</Badge> : <span className="text-caption text-ink-muted">Optional</span>}</Td>
                    </Tr>
                  ))}</tbody>
                </Table>
              </TableContainer>
            </div>
          ) : <div className="rounded-control border border-dashed border-line px-4 py-3 text-caption text-ink-muted">Select an assessment form to see the skills the supplier will be asked to rate.</div>}
        </div>

        <div className="overflow-hidden rounded-control border border-line">
          <div className="border-b border-line bg-canvas px-4 py-3">
            <div className="text-body font-medium text-ink">Required company documents</div>
            <div className="text-caption text-ink-muted">Documents the supplier must upload together with the rate card</div>
          </div>
          <ul className="divide-y divide-line-subtle">
            {requiredEvidence.map(item => (
              <li key={item.id} className="space-y-4 px-4 py-4">
                <Field label="Document type" hint="Kind of file the supplier can upload (none selected accepts all)">
                  <div className="sm:w-72"><MultiSelect aria-label="Accepted document types" placeholder="Any document type" options={EVIDENCE_DOC_TYPES} value={item.docTypes} onChange={docTypes => changeEvidence(item.id, { docTypes })} /></div>
                </Field>
                <Field label="Document title" required>
                  <Input placeholder="e.g. ISO 9001 certificate" value={item.title} invalid={touched.includes(2) && !item.title.trim()} autoFocus={item.id === addedId} onChange={event => changeEvidence(item.id, { title: event.target.value })} />
                </Field>
                <Field label="Description">
                  <Textarea rows={2} style={{ minHeight: 64 }} placeholder="Tell the supplier what the document should show (optional)" value={item.description} onChange={event => changeEvidence(item.id, { description: event.target.value })} />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={item.mandatory} onChange={event => changeEvidence(item.id, { mandatory: event.target.checked })} />Mandatory</label>
                  <Button size="xs" variant="link-danger" onClick={() => setRequiredEvidence(list => list.filter(entry => entry.id !== item.id))}>Remove</Button>
                </div>
              </li>
            ))}
          </ul>
          {!requiredEvidence.length && <div className="px-4 py-3 text-caption text-ink-muted">No company-level documents requested.</div>}
          <button
            type="button"
            onClick={() => { const id = `req-${Date.now().toString(36)}`; setAddedId(id); setRequiredEvidence(list => [...list, { id, title: '', description: '', docTypes: [], mandatory: false }]); }}
            className="w-full border-t border-line-subtle px-4 py-3 text-center text-body font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >+ Add document</button>
        </div>
      </section>

      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-caption text-ink-muted">Check the request before sending it. The supplier is notified through the Supplier Portal once it is submitted.</p>
          {reviewCard('Supplier and scope', 0, [
            { label: 'Supplier', value: `${supplierName} (${supplierId})` }, { label: 'Product Category', value: category },
            { label: 'Qualification Scope', value: scopeType === 'Company-wide' ? scopeType : `${scopeType} · ${scopeDetail}` }, { label: 'Assessment form', value: formLabel },
            { label: 'Assessment type', value: type === 'Re' ? `Reassessment${previous ? ` · ${previous.qslNo}` : ''}` : 'First assessment' },
          ])}
          {reviewCard('Team and schedule', 1, [
            { label: 'Supplier due date', value: formatDate(dueDate) }, { label: 'Coordinator (requester)', value: userName(options.coordinators, coordinatorId) },
            { label: 'Assessor', value: userName(options.assessors, assessorId) }, { label: 'Approver (central)', value: userName(options.approvers, approverId) },
            { label: 'Reason for the assessment', value: reason, wide: true }, { label: 'Attach documents', value: files.length ? files.join(', ') : '—', wide: true },
          ])}
          {reviewCard('Request to the Supplier Portal', 2, [
            { label: 'Requesting Buyer', value: buyer }, { label: 'Currencies', value: currencies.join(', ') }, { label: 'Rate basis', value: rateBases.join(', ') },
            { label: 'Skills the supplier will rate', value: `${skills.length}` },
            { label: 'Submission instructions', value: instructions, wide: true },
            { label: 'Required company documents', value: requiredEvidence.length ? requiredEvidence.map(item => `${item.title}${item.mandatory ? ' (mandatory)' : ''}`).join(', ') : '—', wide: true },
          ])}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => run(false)}>Save draft</Button>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          {step < STEPS.length - 1 ? <Button variant="primary" onClick={next}>Next</Button> : <Button variant="primary" onClick={() => run(true)}>Submit request</Button>}
        </div>
      </div>
    </Modal>
  );
}
