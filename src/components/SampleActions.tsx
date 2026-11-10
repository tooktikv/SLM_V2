import { useState } from 'react';
import { suppliers } from '../data/suppliers';
import { samplePurposes, type SamplePurpose, type SampleRequest } from '../data/samples';
import { getConfig } from '../config';
import { getExternalSupplierId } from '../integration';
import {
  closeSample, createSampleRequest, currentBuyer, receiveSample, resendSampleRequest, sendSampleRequest, sharedSampleStatus, simulateSampleResponse, startEvaluation, submitEvaluation,
  type SharedSampleStatus,
} from '../samples';
import { Badge, Button, Callout, Checkbox, DetailGrid, Eyebrow, Field, Input, Modal, Select, Textarea, type Tone } from './ui';

export const sharedStatusTone: Record<SharedSampleStatus, Tone> = {
  Draft: 'neutral', Requested: 'neutral', 'Supplier Responding': 'info', Submitted: 'info', 'Under Evaluation': 'brand', Accepted: 'success', Failed: 'danger', Completed: 'success',
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong');

export function NewSampleModal({ supplierId: fixedSupplierId, onClose }: { supplierId?: string; onClose: () => void }) {
  const types = getConfig('samples').requestTypes.filter(item => item.active);
  const [supplierId, setSupplierId] = useState(fixedSupplierId ?? '');
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [product, setProduct] = useState('');
  const [spec, setSpec] = useState('');
  const [purpose, setPurpose] = useState<SamplePurpose>('New product');
  const [qty, setQty] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [sendNow, setSendNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const type = types.find(item => item.id === typeId);
  const requirements = getConfig('samples').requirements.filter(item => item.requestTypeId === typeId);
  const supplier = suppliers.find(item => item.id === supplierId);

  const submit = () => {
    try {
      if (!supplierId) throw new Error('Please select a supplier');
      const sample = createSampleRequest(currentBuyer, { supplierId, typeId, product, spec, purpose, qty, requiredDate: requiredDate || undefined });
      if (sendNow) sendSampleRequest(currentBuyer, sample.id);
      onClose();
    } catch (caught) { setError(errorText(caught)); }
  };

  return (
    <Modal title="New sample request" eyebrow={supplier ? `${supplier.name} · ${getExternalSupplierId(supplierId) ?? supplierId}` : 'Select a supplier'} onClose={onClose} closeLabel="Close">
      <div className="space-y-4">
        {error && <Callout tone="danger" title={error} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!fixedSupplierId && (
            <Field label="Supplier" required className="sm:col-span-2">
              <Select value={supplierId} onChange={event => setSupplierId(event.target.value)}><option value="">— Select supplier —</option>{suppliers.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}</Select>
            </Field>
          )}
          <Field label="Request type" required><Select value={typeId} onChange={event => setTypeId(event.target.value)}>{types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Purpose"><Select value={purpose} onChange={event => setPurpose(event.target.value as SamplePurpose)}>{samplePurposes.map(item => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Product" required><Input value={product} onChange={event => setProduct(event.target.value)} /></Field>
          <Field label="Specification"><Input value={spec} onChange={event => setSpec(event.target.value)} /></Field>
          <Field label="Quantity" required><Input value={qty} placeholder="e.g. 5 units" onChange={event => setQty(event.target.value)} /></Field>
          <Field label="Required by" hint={type ? `Default: ${type.defaultDueDays} days from today` : undefined}><Input type="date" value={requiredDate} onChange={event => setRequiredDate(event.target.value)} /></Field>
        </div>
        {requirements.length > 0 && (
          <div className="rounded-control bg-canvas p-3">
            <Eyebrow>Supplier must provide</Eyebrow>
            <ul className="mt-1 list-disc pl-4 text-caption text-ink-soft">{requirements.map(item => <li key={item.id}>{item.name}{item.mandatory ? ' (mandatory)' : ''}</li>)}</ul>
          </div>
        )}
        <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={sendNow} onChange={event => setSendNow(event.target.checked)} />Send to the supplier now (via the Supplier Portal)</label>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>{sendNow ? 'Create and send' : 'Save as draft'}</Button></div>
      </div>
    </Modal>
  );
}

// Delivery, supplier responses and the Buyer's evaluation for one sample request.
export function SampleDetailPanel({ sample, supplierId }: { sample: SampleRequest; supplierId: string }) {
  const settings = getConfig('samples');
  const criteria = settings.criteria.filter(item => item.active);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [result, setResult] = useState(settings.resultOptions[0]?.label ?? '');
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const run = (action: () => unknown, success: string) => { try { action(); setNotice({ tone: 'success', text: success }); } catch (error) { setNotice({ tone: 'danger', text: errorText(error) }); } };
  const shared = sharedSampleStatus(sample);
  const delivery = sample.delivery;
  const hasPortal = !!getExternalSupplierId(supplierId);
  const canMock = hasPortal && sample.status === 'Requested' && sample.portal?.sync !== 'Draft' && sample.portal?.sync !== 'Failed';

  return (
    <div className="space-y-4">
      {notice && <Callout tone={notice.tone} title={notice.text} compact />}
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={sharedStatusTone[shared]} small dot>{shared}</Badge>
        {sample.portal && <Badge small tone={sample.portal.sync === 'Failed' ? 'danger' : sample.portal.sync === 'Sent' ? 'success' : 'neutral'}>Supplier Portal: {sample.portal.sync === 'Sent' ? 'delivered' : sample.portal.sync === 'Failed' ? 'delivery failed' : 'not sent'}</Badge>}
        {sample.portal?.sync === 'Draft' && <Button size="xs" variant="primary" onClick={() => run(() => sendSampleRequest(currentBuyer, sample.id), 'Sent to the supplier')}>Send to supplier</Button>}
        {sample.portal?.sync === 'Failed' && <Button size="xs" onClick={() => run(() => resendSampleRequest(currentBuyer, sample.id), 'Resent to the supplier')}>Resend</Button>}
        {sample.status === 'In transit' && <Button size="xs" variant="primary" onClick={() => run(() => receiveSample(currentBuyer, sample.id), 'Marked as received')}>Mark received</Button>}
        {sample.status === 'Received' && <Button size="xs" variant="primary" onClick={() => run(() => startEvaluation(currentBuyer, sample.id), 'Evaluation started')}>Start evaluation</Button>}
        {(sample.status === 'Approved' || sample.status === 'Conditional' || sample.status === 'Rejected') && !sample.closedAt && <Button size="xs" onClick={() => run(() => closeSample(currentBuyer, sample.id), 'Request closed')}>Close request</Button>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {sample.requirements && sample.requirements.length > 0 && (
            <div><Eyebrow>Supplier requirements</Eyebrow><ul className="mt-1 list-disc pl-4 text-caption text-ink-soft">{sample.requirements.map(item => <li key={item}>{item}</li>)}</ul></div>
          )}
          {delivery && (
            <div><Eyebrow className="mb-1">Delivery information</Eyebrow>
              <DetailGrid items={[
                { label: 'Supplier confirmed', value: delivery.confirmedAt ?? '—' }, { label: 'Carrier', value: delivery.carrier ?? '—' }, { label: 'Tracking number', value: delivery.trackingNo ?? '—' },
                { label: 'Shipped', value: delivery.shippedAt ?? '—' }, { label: 'Expected', value: delivery.expectedAt ?? '—' }, { label: 'Received', value: delivery.receivedAt ?? '—' },
              ]} />
            </div>
          )}
          {canMock && (
            <div className="rounded-control border border-dashed border-line p-3">
              <Eyebrow>Mock Supplier Portal</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-2">
                {!delivery?.confirmedAt && <Button size="xs" onClick={() => run(() => simulateSampleResponse(sample.id, { event: 'confirmed' }), 'Supplier confirmed')}>Supplier confirms</Button>}
                <Button size="xs" onClick={() => run(() => simulateSampleResponse(sample.id, { event: 'shipped', carrier: 'DHL', trackingNo: `TRK-${Math.floor(100000 + Math.random() * 900000)}`, expectedAt: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) }), 'Supplier shipped the sample')}>Supplier ships</Button>
              </div>
            </div>
          )}
        </div>

        <div>
          {sample.status === 'Under testing' && (
            <div className="space-y-3">
              <Eyebrow>Evaluation by the Buyer</Eyebrow>
              {criteria.map(criterion => (
                <div key={criterion.id} className="grid grid-cols-[1fr_5rem] items-center gap-2">
                  <div><div className="text-body text-ink">{criterion.name}</div><div className="text-caption text-ink-muted">Pass mark {criterion.passMark}</div></div>
                  <Input aria-label={`${criterion.name} score`} type="number" min={0} max={100} value={scores[criterion.id] ?? ''} placeholder="0-100" onChange={event => setScores(current => ({ ...current, [criterion.id]: event.target.value }))} />
                  <Input className="col-span-2" aria-label={`${criterion.name} comment`} placeholder="Comment (optional)" value={notes[criterion.id] ?? ''} onChange={event => setNotes(current => ({ ...current, [criterion.id]: event.target.value }))} />
                </div>
              ))}
              <Field label="Result"><Select value={result} onChange={event => setResult(event.target.value)}>{settings.resultOptions.map(item => <option key={item.id} value={item.label}>{item.label} ({item.outcome})</option>)}</Select></Field>
              <Field label="Comment" hint="Required for deviations, failures and retests"><Textarea value={comment} onChange={event => setComment(event.target.value)} /></Field>
              <Button variant="primary" onClick={() => run(() => submitEvaluation(currentBuyer, sample.id, { scores: criteria.map(item => ({ criterionId: item.id, score: scores[item.id] === undefined || scores[item.id] === '' ? NaN : Number(scores[item.id]), comment: notes[item.id] })), result, comment }), 'Evaluation recorded')}>Record result</Button>
            </div>
          )}
          {sample.evaluation && (
            <div>
              <Eyebrow className="mb-1">Evaluation result</Eyebrow>
              <div className="mb-2 flex items-center gap-2"><Badge small tone={sample.evaluation.outcome === 'Accept' ? 'success' : sample.evaluation.outcome === 'Fail' ? 'danger' : 'warning'}>{sample.evaluation.result}</Badge><span className="text-caption text-ink-muted">{sample.evaluation.by}</span></div>
              <ul className="space-y-1 text-caption">{sample.evaluation.scores.map(item => <li key={item.criterionId} className="flex justify-between gap-3"><span className="text-ink-soft">{item.name}</span><span className={item.score < item.passMark ? 'font-semibold text-danger-700' : 'text-ink'}>{item.score} / {item.passMark}</span></li>)}</ul>
              {sample.evaluation.comment && <div className="mt-2 text-caption text-ink-soft">{sample.evaluation.comment}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
