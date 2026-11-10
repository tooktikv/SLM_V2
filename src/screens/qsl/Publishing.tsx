import { useState } from 'react';
import type { Actor, ScopeType } from '../../qsl/types';
import { SCOPE_TYPES } from '../../qsl/types';
import { can } from '../../qsl/rbac';
import { publishToQsl, validatePublish, type PublishInput } from '../../qsl/services/publishing';
import { listEligibility, listQslActivity, type EligibilityRow } from '../../qsl/services/qslRegister';
import { useQslQuery } from '../../qsl/useQsl';
import { getConfig } from '../../config';
import { Button, Callout, Card, CardHeader, Checkbox, EmptyState, HeadRow, Input, Modal, Select, Table, TableContainer, Td, Tr } from '../../components/ui';
import { NoticeBox, attempt, errorMessage, formatDate, type Notice } from '../qualification/shared';

type Draft = { scopeType: ScopeType; scopeDetail: string; effectiveDate: string; expiryDate: string };
const stamp = (value: string) => `${formatDate(value)} ${new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

const toInput = (draft: Draft): PublishInput => ({
  scopeType: draft.scopeType, scopeDetail: draft.scopeType === 'Company-wide' ? '' : draft.scopeDetail, effectiveDate: draft.effectiveDate, expiryDate: draft.expiryDate || undefined,
});

const problems = (id: string, draft: Draft): string[] => {
  try { return validatePublish(id, toInput(draft)); } catch (caught) { return [errorMessage(caught).message]; }
};

function Preview({ actor, rows, drafts, onClose, onDone }: { actor: Actor; rows: EligibilityRow[]; drafts: Record<string, Draft>; onClose: () => void; onDone: (count: number) => void }) {
  const rules = getConfig('qsl');
  const [confirmed, setConfirmed] = useState(!rules.requirePublisherConfirmation);
  const [notice, setNotice] = useState<Notice | null>(null);
  const checked = rows.map(row => ({ row, errors: problems(row.id, drafts[row.id]) }));
  const blocked = checked.some(item => item.errors.length > 0);
  const publish = () => {
    let published = 0;
    const ok = attempt(() => { rows.forEach(row => { publishToQsl(actor, row.id, toInput(drafts[row.id])); published += 1; }); }, setNotice);
    if (ok) onDone(published);
  };

  return (
    <Modal title="QSL preview" eyebrow="Review before publishing" onClose={onClose}>
      <NoticeBox notice={notice} />
      <TableContainer>
        <Table minWidth={640}>
          <HeadRow columns={['Supplier', 'Category / Scope', 'Effective - expiry', 'Validation']} />
          <tbody>{checked.map(({ row, errors }) => (
            <Tr key={row.id}>
              <Td dense><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.qslNo}</div></Td>
              <Td dense>{row.category}<div className="text-caption text-ink-muted">{drafts[row.id].scopeType}{drafts[row.id].scopeType !== 'Company-wide' && drafts[row.id].scopeDetail ? ` · ${drafts[row.id].scopeDetail}` : ''}</div></Td>
              <Td dense>{formatDate(drafts[row.id].effectiveDate)} - {drafts[row.id].expiryDate ? formatDate(drafts[row.id].expiryDate) : '—'}</Td>
              <Td dense>{errors.length ? <span className="text-caption text-danger-700">{errors.join('; ')}</span> : <span className="text-caption font-medium text-success-700">Eligible and valid</span>}</Td>
            </Tr>
          ))}</tbody>
        </Table>
      </TableContainer>
      {rules.requirePublisherConfirmation && (
        <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm these suppliers and scopes are correct and can be published{rules.publishToPortal ? ' (the Supplier Portal will be notified)' : ''}</label>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Back</Button>
        <Button variant="primary" disabled={blocked || !confirmed} onClick={publish}>Publish {rows.length} supplier{rows.length === 1 ? '' : 's'}</Button>
      </div>
    </Modal>
  );
}

// 5.3 Publishing: select eligible suppliers, set scope and validity, validate, preview and publish.
export function PublishingTab({ actor }: { actor: Actor }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const data = useQslQuery(() => listEligibility(actor), [actor.id]).data;
  const history = useQslQuery(() => listQslActivity(actor, 'publication'), [actor.id]).data ?? [];
  const eligible = (data?.rows ?? []).filter(row => row.state === 'Eligible');
  const canPublish = can(actor, 'qsl.publish');
  const rules = getConfig('qsl');

  const draftOf = (row: EligibilityRow): Draft => drafts[row.id] ?? {
    scopeType: row.scopeType as ScopeType, scopeDetail: row.scopeDetail, effectiveDate: row.qualificationEffective ?? '', expiryDate: row.qualificationExpiry ?? '',
  };
  const patch = (row: EligibilityRow, change: Partial<Draft>) => setDrafts(current => ({ ...current, [row.id]: { ...draftOf(row), ...change } }));
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const chosen = eligible.filter(row => selected.has(row.id));
  const resolved = Object.fromEntries(eligible.map(row => [row.id, draftOf(row)]));

  return (
    <div className="space-y-5">
      {rules.autoPublish && <Callout tone="info" title="Automatic publishing is on">Eligible suppliers are published automatically after approval. Change this in Administration → QSL Settings.</Callout>}
      {!canPublish && <Callout tone="warning" title="You do not have permission to publish to the QSL" />}
      <NoticeBox notice={notice} />
      <Card className="overflow-hidden">
        <CardHeader
          title="Eligible suppliers"
          description="Select suppliers, confirm the product / service scope and QSL validity, then preview and publish"
          actions={<Button variant="primary" disabled={!canPublish || chosen.length === 0} onClick={() => { setNotice(null); setPreviewing(true); }}>Preview & publish{chosen.length ? ` (${chosen.length})` : ''}</Button>}
        />
        <TableContainer>
          <Table minWidth={1100}>
            <HeadRow leading={<th className="w-10 border-b border-line bg-canvas px-3"><span className="sr-only">Select</span></th>} columns={['Supplier', 'Category', 'Scope', 'Scope details', 'Effective date', 'Expiry date', 'Validation']} />
            <tbody>{eligible.map(row => {
              const draft = draftOf(row);
              const errors = problems(row.id, draft);
              return (
                <Tr key={row.id}>
                  <Td><Checkbox aria-label={`Select ${row.supplierName}`} disabled={!canPublish} checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></Td>
                  <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.supplierId} · {row.qslNo}{row.withdrawn ? ' · republish' : ''}</div></Td>
                  <Td>{row.category}</Td>
                  <Td><Select size="sm" aria-label={`Scope for ${row.supplierName}`} value={draft.scopeType} onChange={event => patch(row, { scopeType: event.target.value as ScopeType })}>{SCOPE_TYPES.map(item => <option key={item}>{item}</option>)}</Select></Td>
                  <Td><Input aria-label={`Scope details for ${row.supplierName}`} value={draft.scopeType === 'Company-wide' ? '' : draft.scopeDetail} disabled={draft.scopeType === 'Company-wide'} onChange={event => patch(row, { scopeDetail: event.target.value })} /></Td>
                  <Td><Input type="date" aria-label={`Effective date for ${row.supplierName}`} value={draft.effectiveDate} onChange={event => patch(row, { effectiveDate: event.target.value })} /></Td>
                  <Td><Input type="date" aria-label={`Expiry date for ${row.supplierName}`} value={draft.expiryDate} onChange={event => patch(row, { expiryDate: event.target.value })} /></Td>
                  <Td className="max-w-56 text-caption">{errors.length ? <span className="text-danger-700">{errors[0]}</span> : <span className="font-medium text-success-700">Ready to publish</span>}</Td>
                </Tr>
              );
            })}</tbody>
          </Table>
        </TableContainer>
        {eligible.length === 0 && <EmptyState title="No eligible suppliers to publish" description="Suppliers appear here once their qualification and capability are approved" />}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Publication history" description="Publishing, scope changes and validity renewals" />
        <TableContainer>
          <Table minWidth={760}>
            <HeadRow columns={['Date', 'No.', 'Supplier', 'Category', 'Change', 'By', 'Details']} />
            <tbody>{history.map((row, index) => (
              <Tr key={`${row.qslId}-${row.at}-${index}`}><Td>{stamp(row.at)}</Td><Td className="font-mono text-caption">{row.qslNo}</Td><Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.category}</Td><Td>{row.action}</Td><Td>{row.byName}</Td><Td className="max-w-64 text-caption text-ink-soft">{row.note ?? '—'}</Td></Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {history.length === 0 && <EmptyState title="Nothing published yet" />}
      </Card>

      {previewing && (
        <Preview actor={actor} rows={chosen} drafts={resolved} onClose={() => setPreviewing(false)}
          onDone={count => { setPreviewing(false); setSelected(new Set()); setDrafts({}); setNotice({ tone: 'success', text: `${count} supplier${count === 1 ? '' : 's'} published to the QSL` }); }} />
      )}
    </div>
  );
}
