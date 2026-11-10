import { useEffect, useState } from 'react';
import type { Actor, AnswerValue, Level } from '../../qsl/types';
import { attachEvidence, checkBeforeSubmit, saveAnswers, saveSelfRatings, submitAnswers } from '../../qsl/services/assessments';
import { getSheet, type SheetItem } from '../../qsl/services/queries';
import { statusLabel, supplierStatusLabel } from '../../qsl/labels';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Callout, Card, CardHeader, DetailGrid, EmptyState, Eyebrow, Field, Input, ProgressBar, Select, Textarea } from '../../components/ui';
import { NoticeBox, ResultBadge, attempt, formatDate, statusTone, type Notice } from './shared';

function AnswerInput({ item, value, disabled, invalid, onChange }: { item: SheetItem; value: AnswerValue | undefined; disabled: boolean; invalid: boolean; onChange: (value: AnswerValue | '') => void }) {
  const text = value === undefined ? '' : String(value);
  switch (item.answerType) {
    case 'LongText': return <Textarea value={text} disabled={disabled} invalid={invalid} onChange={event => onChange(event.target.value)} />;
    case 'Choice': return <Select value={text} disabled={disabled} aria-invalid={invalid || undefined} onChange={event => onChange(event.target.value)}><option value="">— Select —</option>{(item.options ?? []).map(option => <option key={option}>{option}</option>)}</Select>;
    case 'Number': return <div className="flex items-center gap-2"><Input type="number" value={text} disabled={disabled} invalid={invalid} className="max-w-48" onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} />{item.unit && <span className="text-caption text-ink-muted">{item.unit}</span>}</div>;
    case 'Date': return <Input type="date" value={text} disabled={disabled} invalid={invalid} className="max-w-48" onChange={event => onChange(event.target.value)} />;
    case 'File': return <span className="text-caption text-ink-muted">Attach the file using "Attach evidence" below</span>;
    default: return <Input value={text} disabled={disabled} invalid={invalid} onChange={event => onChange(event.target.value)} />;
  }
}

// Supplier: company information, answers to the standard + buyer custom criteria, evidence and skill self-rating.
export function SupplierForm({ actor, id, onDone }: { actor: Actor; id: string; onDone: () => void }) {
  const sheet = useQslQuery(() => getSheet(actor, id), [actor.id, id]);
  const data = sheet.data;
  const [answers, setAnswers] = useState<Record<string, AnswerValue | ''>>({});
  const [ratings, setRatings] = useState<Record<string, Level | ''>>({});
  const [note, setNote] = useState('');
  const [loadedFor, setLoadedFor] = useState('');
  const [highlight, setHighlight] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!data || loadedFor === data.id) return;
    const initial: Record<string, AnswerValue | ''> = {};
    data.sections.flatMap(section => section.items).forEach(item => { if (item.answer !== undefined) initial[item.criteriaId] = item.answer; });
    setAnswers(initial);
    setRatings(Object.fromEntries(data.skills.filter(skill => skill.self).map(skill => [skill.id, skill.self as Level])));
    setLoadedFor(data.id);
  }, [data, loadedFor]);

  if (sheet.error) return <Callout tone="danger" title="Cannot open the assessment form">{sheet.error}</Callout>;
  if (!data) return <EmptyState title="Loading..." />;

  const editable = data.nextAction === 'fill';
  const label = actor.role === 'Supplier' ? supplierStatusLabel[data.status] : statusLabel[data.status];
  const items = data.sections.flatMap(section => section.items);

  const persist = () => {
    saveAnswers(actor, id, Object.entries(answers).filter(([, value]) => value !== '').map(([criteriaId, value]) => ({ criteriaId, value: value as AnswerValue })));
    const chosen = Object.entries(ratings).filter(([, level]) => level !== '').map(([skillId, level]) => ({ skillId, level: level as Level }));
    if (data.useSkillLevel && chosen.length) saveSelfRatings(actor, id, chosen);
  };
  const saveDraft = () => attempt(() => persist(), setNotice, 'Draft saved');
  const review = () => attempt(() => {
    persist();
    const missing = checkBeforeSubmit(actor, id);
    const byItem: Record<string, string[]> = {};
    missing.forEach(entry => { byItem[entry.criteriaId] = [...(byItem[entry.criteriaId] ?? []), entry.message]; });
    setHighlight(byItem);
    setNotice(missing.length ? { tone: 'danger', text: `${missing.length} item(s) still need an answer or evidence`, details: missing.map(entry => `${entry.name}: ${entry.message}`) } : { tone: 'success', text: 'Everything is complete and ready to submit' });
  }, setNotice);
  const submit = () => { if (attempt(() => { persist(); submitAnswers(actor, id, note); }, setNotice)) onDone(); };

  return (
    <div className="space-y-5">
      <Card padded>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>{data.qslNo}</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-ink">{data.supplier.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={statusTone[data.status]} dot>{label}</Badge><ResultBadge result={data.result} /></div>
          </div>
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between text-caption text-ink-muted"><span>Progress</span><span className="tabular-nums">{data.progress.answered}/{data.progress.total} ({data.progress.percent}%)</span></div>
            <ProgressBar value={data.progress.percent} size="md" label="Assessment form progress" className="mt-2" />
            <div className="mt-3 flex flex-wrap gap-2">{data.sections.map(section => <Button key={section.title} size="xs" onClick={() => document.getElementById(`section-${section.title}`)?.scrollIntoView({ behavior: 'smooth' })}>{section.title}</Button>)}</div>
          </div>
        </div>
        <DetailGrid className="mt-5" items={[
          { label: 'Tax ID', value: data.supplier.taxId ?? '—' }, { label: 'Product Category', value: data.category }, { label: 'Qualification Scope', value: [data.scope.type, data.scope.detail].filter(Boolean).join(' · ') },
          { label: 'Assessment form', value: data.formLabel }, { label: 'Round', value: data.roundLabel }, { label: 'Due date', value: formatDate(data.dueDate) },
        ]} />
      </Card>

      {data.infoRequest && <Callout tone="warning" title="CPF requests more information">{data.infoRequest}</Callout>}
      {data.corrections.length > 0 && <Callout tone="warning" title={`CPF asks you to correct ${data.corrections.length} item(s)`}>{items.filter(item => item.correction).map(item => <div key={item.criteriaId}>{item.code} {item.name}: {item.correction}</div>)}</Callout>}
      {!editable && <Callout tone="info">This form is read-only. It can only be edited by the supplier while waiting for the supplier's information or after more information is requested.</Callout>}
      <NoticeBox notice={notice} />

      {data.sections.map(section => (
        <Card key={section.title}>
          <div id={`section-${section.title}`}><CardHeader title={section.title} /></div>
          <div className="divide-y divide-line-subtle">
            {section.items.map(item => {
              const flagged = highlight[item.criteriaId];
              return (
                <div key={item.criteriaId} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-caption text-ink-muted">{item.code}</span><span className="text-body font-semibold text-ink">{item.name}</span>
                    {item.kind === 'BuyerCustom' && <Badge tone="info" small>Buyer criteria</Badge>}{!item.required && <span className="text-caption text-ink-muted">(optional)</span>}
                  </div>
                  <div className="text-caption text-ink-muted"><span className="font-medium text-ink-soft">Criteria description: </span>{item.description}</div>
                  {item.evidenceRequired && <div className="text-caption text-ink-muted"><span className="font-medium text-ink-soft">Evidence required: </span>An evidence file must be attached</div>}
                  {item.correction && <Callout tone="warning" compact title="! CPF asks you to correct this item">{item.correction}</Callout>}
                  <AnswerInput item={item} value={answers[item.criteriaId] === '' ? undefined : answers[item.criteriaId]} disabled={!editable} invalid={!!flagged?.includes('Not answered')} onChange={value => setAnswers(current => ({ ...current, [item.criteriaId]: value }))} />
                  <div className="flex flex-wrap items-center gap-3">
                    {item.evidence.map(file => <Badge key={file.id} small>{file.fileName}</Badge>)}
                    {editable && (
                      <label className="cursor-pointer text-caption font-medium text-brand-700 hover:underline">Attach evidence
                        <input type="file" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) attempt(() => attachEvidence(actor, id, item.criteriaId, file.name), setNotice); event.target.value = ''; }} />
                      </label>
                    )}
                  </div>
                  {flagged?.map(message => <div key={message} className="text-caption font-medium text-danger-700">{message}</div>)}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {data.useSkillLevel && (
        <Card>
          <CardHeader title="Skill Rating Submission" description="Enter your own rating for each skill. It is a declared value only, not a verified result." />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {data.skills.map(skill => (
              <Field key={skill.id} label={skill.name}>
                <Select value={String(ratings[skill.id] ?? '')} disabled={!editable} onChange={event => setRatings(current => ({ ...current, [skill.id]: event.target.value ? Number(event.target.value) as Level : '' }))}>
                  <option value="">— Select level —</option>{[1, 2, 3].map(level => <option key={level} value={level}>Level {level}</option>)}
                </Select>
              </Field>
            ))}
          </div>
        </Card>
      )}

      {editable && data.infoRequest && <Card padded><Field label="Response to the information request" required><Textarea value={note} onChange={event => setNote(event.target.value)} /></Field></Card>}

      {editable && (
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-card border border-line bg-surface p-3 shadow-card">
          <Button onClick={saveDraft}>Save draft</Button>
          <Button onClick={review}>Check before submitting</Button>
          <Button variant="primary" onClick={submit}>Submit to CPF</Button>
        </div>
      )}
    </div>
  );
}
