import { useState } from 'react';
import { needsAttention, type ComplianceItem } from '../data/compliance';
import { complianceToday, defaultRenewalMessage, isoAfterToday, markRenewalReceived, renewalFor, renewalKind, requestRenewal, useRenewals, type RenewalChannel } from '../data/renewals';
import { Badge, Button, Callout, Field, Input, Modal, Select, Textarea } from './ui';

const channels: RenewalChannel[] = ['Supplier Portal', 'Email'];

function RenewalModal({ supplierId, supplierName, item, onClose }: { supplierId: string; supplierName: string; item: ComplianceItem; onClose: () => void }) {
  const kind = renewalKind(item);
  const [respondBy, setRespondBy] = useState(isoAfterToday(item.daysLeft !== null && item.daysLeft > 0 ? Math.min(14, item.daysLeft) : 14));
  const [channel, setChannel] = useState<RenewalChannel>('Supplier Portal');
  const [message, setMessage] = useState(defaultRenewalMessage(item));
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    try { requestRenewal({ supplierId, item, respondBy, channel, message }); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Something went wrong'); }
  };

  return (
    <Modal title={kind === 'Upload' ? 'Request document' : 'Request renewal'} eyebrow={`${supplierName} · ${item.name}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Callout tone="danger" title={error} />}
        <dl className="grid grid-cols-1 gap-3 rounded-control border border-line bg-canvas p-3 text-body sm:grid-cols-3">
          <div><dt className="text-caption text-ink-muted">Document</dt><dd className="font-medium text-ink">{item.name}</dd></div>
          <div><dt className="text-caption text-ink-muted">Current expiry</dt><dd className="font-medium text-ink">{item.expiry}</dd></div>
          <div><dt className="text-caption text-ink-muted">Status</dt><dd className="font-medium text-ink">{item.status}</dd></div>
        </dl>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Respond by" required><Input type="date" min={complianceToday} value={respondBy} onChange={event => setRespondBy(event.target.value)} /></Field>
          <Field label="Send via"><Select value={channel} onChange={event => setChannel(event.target.value as RenewalChannel)}>{channels.map(value => <option key={value}>{value}</option>)}</Select></Field>
          <Field label="Message to supplier" required className="sm:col-span-2"><Textarea value={message} onChange={event => setMessage(event.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Send request</Button></div>
      </div>
    </Modal>
  );
}

// Per-document renewal status and action: request a renewal, or confirm the supplier's reply.
export function RenewalAction({ supplierId, supplierName, item }: { supplierId: string; supplierName: string; item: ComplianceItem }) {
  useRenewals();
  const [open, setOpen] = useState(false);
  const request = renewalFor(supplierId, item);

  if (request) {
    return (
      <div className="space-y-1">
        <Badge small dot tone="info">{request.kind === 'Upload' ? 'Document requested' : 'Renewal requested'}</Badge>
        <div className="text-caption text-ink-muted">{`Respond by ${request.respondBy}`}</div>
        <Button size="xs" variant="link" onClick={() => markRenewalReceived(request)}>Mark as received</Button>
      </div>
    );
  }
  if (!needsAttention(item)) return <span className="text-caption text-ink-muted">Not needed</span>;
  return (
    <>
      <Button size="xs" variant="link" onClick={() => setOpen(true)}>{renewalKind(item) === 'Upload' ? 'Request document' : 'Request renewal'}</Button>
      {open && <RenewalModal supplierId={supplierId} supplierName={supplierName} item={item} onClose={() => setOpen(false)} />}
    </>
  );
}
