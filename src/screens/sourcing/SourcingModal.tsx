import { useState } from 'react';
import type { Supplier } from '../../data/suppliers';
import { useNavigation } from '../../NavigationContext';
import { Button, Callout, Eyebrow, Field, Modal, Select, SegmentedControl, Textarea } from '../../components/ui';
import { SourcingError, assignSourcing, changeStage, currentSourcingUser, getSourcing, listActivity, markInterested, removeFromSourcing, requiresReason, sourcingStages, sourcingTeam, type SourcingStage } from '../../sourcing';
import { useSourcingRevision } from '../../sourcing/useSourcing';
import { StageBadge, activityLabel, formatStamp, stageHint } from './shared';

// Marks a supplier as interested, then manages its stage, assignment and history.
export default function SourcingModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  useSourcingRevision();
  const { openSupplier } = useNavigation();
  const record = getSourcing(supplier.id);
  const history = listActivity({ supplierId: supplier.id });
  const team = [...new Set([...sourcingTeam, record?.assignee ?? supplier.owner])].sort();
  const [assignee, setAssignee] = useState(record?.assignee ?? supplier.owner);
  const [target, setTarget] = useState<SourcingStage | null>(null);
  const [text, setText] = useState('');
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const run = (action: () => void) => {
    try { action(); setError(''); setTarget(null); setText(''); setRemoving(false); }
    catch (cause) { setError(cause instanceof SourcingError ? cause.message : 'Something went wrong'); }
  };

  if (!record) {
    return (
      <Modal title={supplier.name} eyebrow={`${supplier.id} \u00b7 Add to sourcing`} onClose={onClose}>
        <p className="text-body text-ink-soft">Mark this supplier as interested to start tracking it through shortlisting, review and the final decision.</p>
        {error && <Callout tone="danger" compact>{error}</Callout>}
        <Field label="Responsible person"><Select value={assignee} onChange={event => setAssignee(event.target.value)}>{team.map(name => <option key={name}>{name}</option>)}</Select></Field>
        <Field label="Note (optional)"><Textarea value={text} onChange={event => setText(event.target.value)} placeholder="Why is this supplier interesting?" /></Field>
        {history.length > 0 && <p className="text-caption text-ink-muted">This supplier was in sourcing before. Its earlier history is kept below.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => run(() => markInterested(currentSourcingUser, supplier.id, { assignee, note: text }))}>Mark as interested</Button>
        </div>
        {history.length > 0 && <History items={history} />}
      </Modal>
    );
  }

  const chosen = target ?? record.stage;
  const needsReason = target !== null && requiresReason(record.stage, target);

  return (
    <Modal title={supplier.name} eyebrow={`${supplier.id} \u00b7 Sourcing`} badge={<div className="flex flex-wrap items-center gap-2"><StageBadge stage={record.stage} /><span className="text-caption text-ink-muted">Responsible: {record.assignee}</span></div>} onClose={onClose}>
      {error && <Callout tone="danger" compact>{error}</Callout>}

      <section className="space-y-3">
        <Eyebrow>Stage</Eyebrow>
        <div className="overflow-x-auto">
          <SegmentedControl<SourcingStage> label="Sourcing stage" value={chosen} onChange={value => { setTarget(value === record.stage ? null : value); setError(''); }} items={sourcingStages.map(stage => ({ value: stage, label: stage }))} />
        </div>
        <p className="text-caption text-ink-muted">{stageHint[chosen]}. Suppliers can move forward or back; moving back or choosing Not Selected needs a reason.</p>
        {target && (
          <>
            <Field label={needsReason ? 'Reason (required)' : 'Note (optional)'}><Textarea value={text} onChange={event => setText(event.target.value)} /></Field>
            <div className="flex justify-end"><Button variant="primary" onClick={() => run(() => changeStage(currentSourcingUser, supplier.id, target, { reason: text }))}>Move to {target}</Button></div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <Eyebrow>Assignment</Eyebrow>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Responsible person" className="w-56" value={assignee} onChange={event => setAssignee(event.target.value)}>{team.map(name => <option key={name}>{name}</option>)}</Select>
          <Button disabled={assignee === record.assignee} onClick={() => run(() => assignSourcing(currentSourcingUser, supplier.id, assignee))}>Save assignment</Button>
        </div>
      </section>

      <History items={history} />

      {removing ? (
        <section className="space-y-3 rounded-card border border-danger-200 bg-danger-50 p-4">
          <Field label="Reason for removing from sourcing (required)"><Textarea value={text} onChange={event => setText(event.target.value)} /></Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => { setRemoving(false); setText(''); setError(''); }}>Cancel</Button>
            <Button variant="danger" onClick={() => run(() => removeFromSourcing(currentSourcingUser, supplier.id, text))}>Remove from sourcing</Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="link-danger" onClick={() => { setRemoving(true); setTarget(null); setText(''); setError(''); }}>Remove from sourcing</Button>
          <div className="flex gap-2">
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={() => { onClose(); openSupplier(supplier); }}>View supplier</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function History({ items }: { items: ReturnType<typeof listActivity> }) {
  return (
    <section className="space-y-3">
      <Eyebrow>Activity history</Eyebrow>
      <ol className="space-y-3">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
            <div className="min-w-0 flex-1">
              <div className="text-body text-ink">{activityLabel(item)}</div>
              {item.note && <div className="text-caption text-ink-soft">{item.note}</div>}
              <div className="text-caption text-ink-muted">{item.by} · {formatStamp(item.at)}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
