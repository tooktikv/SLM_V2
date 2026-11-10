import { useState } from 'react';
import type { Supplier } from '../../data/suppliers';
import { useNavigation } from '../../NavigationContext';
import { Button, Callout, Eyebrow, Field, HeadRow, Modal, Select, Table, TableContainer, Td, Textarea, Tr } from '../../components/ui';
import { SourcingError, assignSourcing, changeStage, currentSourcingUser, getSourcing, listActivity, markInterested, removeFromSourcing, requiresReason, sourcingStages, sourcingTeam, type SourcingStage } from '../../sourcing';
import { useSourcingRevision } from '../../sourcing/useSourcing';
import { cycle } from '../../lib/demo';
import { StageBadge, activityLabel, formatStamp, stageHint } from './shared';

const PREVIEW = 3;

function Snapshot({ supplier }: { supplier: Supplier }) {
  const items: [string, string][] = [['Category', supplier.category], ['Country', supplier.country], ['Risk level', supplier.risk], ['Qualification', supplier.qual], ['Performance', supplier.perf > 0 ? `${supplier.perf}%` : '—'], ['Supplier status', supplier.status]];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-card border border-line-subtle bg-canvas p-4 sm:grid-cols-3">
      {items.map(([label, value]) => <div key={label}><dt className="text-micro font-semibold uppercase tracking-wide text-ink-muted">{label}</dt><dd className="mt-1 text-body text-ink">{value}</dd></div>)}
    </dl>
  );
}

// Add a supplier to the sourcing list, or change its status and owner. Day-to-day work happens in the Sourcing suppliers tab.
export default function SourcingModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  useSourcingRevision();
  const { openSupplier } = useNavigation();
  const record = getSourcing(supplier.id);
  const history = listActivity({ supplierId: supplier.id });
  const team = [...new Set([...sourcingTeam, record?.assignee ?? supplier.owner])].sort();
  const [assignee, setAssignee] = useState(supplier.owner);
  const [target, setTarget] = useState<SourcingStage | null>(null);
  const [text, setText] = useState('');
  const [removing, setRemoving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [fills, setFills] = useState(0);
  const fillSample = () => {
    setAssignee(cycle(team, fills));
    setText(cycle(['Strong capability in the target category; worth a closer look', 'Competitive pricing and short lead time', 'Recommended by the quality team after the last audit'], fills));
    setFills(fills + 1);
  };

  const run = (action: () => void) => {
    try { action(); setError(''); setTarget(null); setText(''); setRemoving(false); }
    catch (cause) { setError(cause instanceof SourcingError ? cause.message : 'Something went wrong'); }
  };
  const historyTable = <HistoryTable items={history} showAll={showAll} onToggle={() => setShowAll(current => !current)} />;

  if (!record) {
    return (
      <Modal title={supplier.name} eyebrow={`${supplier.id} \u00b7 Add to sourcing`} onClose={onClose} onFillSample={fillSample}>
        <p className="text-body text-ink-soft">Check the supplier details, then add it to sourcing. It will move to the Sourcing suppliers tab, where the sourcing team continues the work.</p>
        <Snapshot supplier={supplier} />
        {error && <Callout tone="danger" compact>{error}</Callout>}
        <div className="grid grid-cols-1 gap-4">
          <Field label="Responsible person" hint="The sourcing team member who follows up on this supplier"><Select value={assignee} onChange={event => setAssignee(event.target.value)}>{team.map(name => <option key={name}>{name}</option>)}</Select></Field>
          <Field label="Note (optional)"><Textarea value={text} onChange={event => setText(event.target.value)} placeholder="Why is this supplier interesting?" /></Field>
        </div>
        {history.length > 0 && <p className="text-caption text-ink-muted">This supplier was in sourcing before. Its earlier history is kept below.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => run(() => markInterested(currentSourcingUser, supplier.id, { assignee, note: text }))}>Add to sourcing</Button>
        </div>
        {history.length > 0 && historyTable}
      </Modal>
    );
  }

  const chosen = target ?? record.stage;
  const needsReason = target !== null && requiresReason(record.stage, target);

  return (
    <Modal title={supplier.name} eyebrow={`${supplier.id} \u00b7 Sourcing`} badge={<StageBadge stage={record.stage} />} onClose={onClose}>
      {error && <Callout tone="danger" compact>{error}</Callout>}

      <Snapshot supplier={supplier} />

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status" hint={stageHint[chosen]}>
            <Select value={chosen} onChange={event => { const next = event.target.value as SourcingStage; setTarget(next === record.stage ? null : next); setError(''); }}>
              {sourcingStages.map(stage => <option key={stage}>{stage}</option>)}
            </Select>
          </Field>
          <Field label="Responsible person" hint="Saved as soon as you change it">
            <Select value={record.assignee} onChange={event => run(() => assignSourcing(currentSourcingUser, supplier.id, event.target.value))}>{team.map(name => <option key={name}>{name}</option>)}</Select>
          </Field>
        </div>
        {target && (
          <div className="space-y-3 rounded-card border border-brand-200 bg-brand-50/40 p-4">
            <Field label={needsReason ? 'Reason (required)' : 'Note (optional)'}><Textarea value={text} onChange={event => setText(event.target.value)} /></Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => { setTarget(null); setText(''); setError(''); }}>Cancel</Button>
              <Button variant={target === 'Not Selected' ? 'danger' : 'primary'} onClick={() => run(() => changeStage(currentSourcingUser, supplier.id, target, { reason: text }))}>Save status</Button>
            </div>
          </div>
        )}
      </section>

      {historyTable}

      {removing ? (
        <section className="space-y-3 rounded-card border border-danger-200 bg-danger-50 p-4">
          <Field label="Reason for removing from sourcing (required)"><Textarea value={text} onChange={event => setText(event.target.value)} /></Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => { setRemoving(false); setText(''); setError(''); }}>Cancel</Button>
            <Button variant="danger" onClick={() => run(() => removeFromSourcing(currentSourcingUser, supplier.id, text))}>Remove from sourcing</Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
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

function HistoryTable({ items, showAll, onToggle }: { items: ReturnType<typeof listActivity>; showAll: boolean; onToggle: () => void }) {
  const shown = showAll ? items : items.slice(0, PREVIEW);
  return (
    <section className="space-y-2">
      <Eyebrow>Recent activity</Eyebrow>
      <div className="overflow-hidden rounded-card border border-line">
        <TableContainer>
          <Table minWidth={480}>
            <HeadRow columns={['Activity', 'By', 'When']} />
            <tbody>{shown.map(item => (
              <Tr key={item.id}>
                <Td><div className="text-body text-ink">{activityLabel(item)}</div>{item.note && <div className="text-caption text-ink-soft">{item.note}</div>}</Td>
                <Td className="whitespace-nowrap">{item.by}</Td>
                <Td className="whitespace-nowrap text-ink-muted">{formatStamp(item.at)}</Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
      </div>
      {items.length > PREVIEW && <Button size="xs" variant="inline" onClick={onToggle}>{showAll ? 'Show fewer' : `Show all ${items.length} activities`}</Button>}
    </section>
  );
}
