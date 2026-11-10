import { useState } from 'react';
import type { Actor } from '../../qsl/types';
import { completePreReview, recordSample } from '../../qsl/services/assessments';
import { getSheet, getSupplierDocuments } from '../../qsl/services/queries';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Callout, Card, CardHeader, Checkbox, DetailGrid, EmptyState, Eyebrow, Field, Input, SegmentedControl, Textarea } from '../../components/ui';
import CompanyInformation from '../../components/CompanyInformation';
import { NoticeBox, ResultBadge, attempt, formatDate, type Notice } from './shared';

// Pre-Qualification Review (supplier information and documents) and Sample Evaluation, both done by the buyer coordinator.
export function StagePage({ actor, id, mode, onDone }: { actor: Actor; id: string; mode: 'prereview' | 'sample'; onDone: () => void }) {
  const sheet = useQslQuery(() => getSheet(actor, id), [actor.id, id]);
  const documents = useQslQuery(() => getSupplierDocuments(actor, sheet.data?.supplier.id ?? ''), [actor.id, sheet.data?.supplier.id]);
  const [infoChecked, setInfoChecked] = useState(false);
  const [documentsChecked, setDocumentsChecked] = useState(false);
  const [comment, setComment] = useState('');
  const [reference, setReference] = useState('');
  const [sampleResult, setSampleResult] = useState<'Pass' | 'Fail'>('Pass');
  const [notice, setNotice] = useState<Notice | null>(null);
  const data = sheet.data;
  if (sheet.error) return <Callout tone="danger" title="Cannot open this item">{sheet.error}</Callout>;
  if (!data) return <EmptyState title="Loading..." />;

  const profile = data.supplierProfile;
  const items = data.sections.flatMap(section => section.items);

  const review = (decision: 'Proceed' | 'RequestInfo' | 'Reject') => { if (attempt(() => completePreReview(actor, id, { infoChecked, documentsChecked, decision, comment }), setNotice)) onDone(); };
  const sample = () => { if (attempt(() => recordSample(actor, id, { reference, result: sampleResult, comment }), setNotice)) onDone(); };

  return (
    <div className="space-y-5">
      <Card padded>
        <Eyebrow>{data.qslNo} · {data.category} · {data.scope.type}{data.scope.detail ? ` · ${data.scope.detail}` : ''}</Eyebrow>
        <h2 className="mt-1 text-lg font-semibold text-ink">{mode === 'prereview' ? 'Pre-Qualification Review' : 'Sample Evaluation'} · {data.supplier.name}</h2>
        <p className="mt-1 text-caption text-ink-muted">{mode === 'prereview' ? 'Check the supplier information and documents before the criteria assessment starts' : 'Evaluate the sample submitted by the supplier'}</p>
      </Card>
      <NoticeBox notice={notice} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-3">
          <Card>
            <CardHeader title="Supplier information (shared supplier profile)" />
            <div className="p-5">
              {profile && (
                <div className="space-y-5">
                  <DetailGrid items={[
                    { label: 'Material group', value: profile.materialGroup ?? '—' }, { label: 'Products', value: profile.productTypes.join(', ') || '—' },
                  ]} />
                  <div className="border-t border-line-subtle pt-5"><CompanyInformation supplier={profile} /></div>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Supplier documents" description="Documents held in the shared profile (not copied per buyer)" />
            <ul className="divide-y divide-line-subtle">
              {(documents.data ?? []).map(doc => <li key={doc.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><div><div className="text-body font-medium text-ink">{doc.name}</div><div className="text-caption text-ink-muted">{doc.type} · expires {doc.expiry}</div></div><Badge small>{doc.status}</Badge></li>)}
              {documents.data?.length === 0 && <li className="px-5 py-4 text-caption text-ink-muted">No documents in the profile</li>}
            </ul>
            {data.documents.length > 0 && <div className="border-t border-line-subtle px-5 py-3 text-caption text-ink-muted">Request attachments: {data.documents.join(', ')}</div>}
          </Card>
          <Card>
            <CardHeader title="Information submitted by the supplier" />
            <ul className="divide-y divide-line-subtle">
              {items.map(item => <li key={item.criteriaId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"><div><div className="text-body text-ink">{item.code} {item.name}</div><div className="text-caption text-ink-muted">{item.evidence.map(file => file.fileName).join(', ') || 'No evidence'}</div></div><div className="text-body text-ink-soft">{item.answer === undefined ? '—' : `${item.answer}${item.unit ? ` ${item.unit}` : ''}`}</div></li>)}
            </ul>
          </Card>
        </div>

        <div className="xl:col-span-2">
          {mode === 'prereview' ? (
            <Card padded className="space-y-4">
              <h3 className="text-sm font-semibold text-ink">Pre-qualification result</h3>
              <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={infoChecked} onChange={event => setInfoChecked(event.target.checked)} />Company information checked</label>
              <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={documentsChecked} onChange={event => setDocumentsChecked(event.target.checked)} />Documents checked</label>
              <Field label="Comment" hint="Required when requesting information or failing"><Textarea value={comment} onChange={event => setComment(event.target.value)} /></Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="danger-soft" onClick={() => review('Reject')}>Fail</Button>
                <Button onClick={() => review('RequestInfo')}>Request more information</Button>
                <Button variant="primary" onClick={() => review('Proceed')}>Proceed</Button>
              </div>
              {data.preReview && <div className="text-caption text-ink-muted">Last reviewed by {data.preReview.byName} · {formatDate(data.preReview.at)}</div>}
            </Card>
          ) : (
            <Card padded className="space-y-4">
              <h3 className="text-sm font-semibold text-ink">Sample evaluation result</h3>
              <Field label="Sample / request reference" required><Input value={reference} onChange={event => setReference(event.target.value)} /></Field>
              <Field label="Result"><SegmentedControl label="Sample result" value={sampleResult} onChange={setSampleResult} items={[{ value: 'Pass', label: 'Pass' }, { value: 'Fail', label: 'Fail' }]} /></Field>
              <Field label="Comment" hint="Required when failing"><Textarea value={comment} onChange={event => setComment(event.target.value)} /></Field>
              <div className="flex justify-end"><Button variant="primary" onClick={sample}>Save sample result</Button></div>
              {data.preReview && <div className="text-caption text-ink-muted">Pre-Qualification: {data.preReview.byName} · <ResultBadge result="Pass" /></div>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
