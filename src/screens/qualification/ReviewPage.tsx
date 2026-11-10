import { useEffect, useState } from 'react';
import type { Actor, Level, ScopeType, Verdict } from '../../qsl/types';
import { SCOPE_TYPES } from '../../qsl/types';
import { decide, proposeRatings, requestMoreInfo, saveEvaluations, submitToVerification } from '../../qsl/services/assessments';
import { autoPublishIfConfigured } from '../../qsl/services/publishing';
import { getSheet, type SheetItem } from '../../qsl/services/queries';
import { statusLabel, verdictLabel } from '../../qsl/labels';
import { addMonthsIso } from '../../qsl/dates';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Callout, Card, CardHeader, Checkbox, EmptyState, Eyebrow, Field, Grid, HeadRow, Input, SegmentedControl, Select, Stepper, Table, TableContainer, Td, Textarea, Tr, type StepState, type Tone } from '../../components/ui';
import { LevelBadge, NoticeBox, ResultBadge, attempt, formatDate, type Notice } from './shared';

type Local = { verdict: Verdict | ''; comment: string; requestCorrection: boolean; message: string };

const verdictTone: Record<Verdict, Tone> = { Compliant: 'success', NonCompliant: 'danger', NeedsFix: 'warning' };
const todayIso = () => new Date().toISOString().slice(0, 10);

function Answer({ item }: { item: SheetItem }) {
  return (
    <div className="space-y-2">
      <Eyebrow>Supplier answer</Eyebrow>
      <div className="rounded-control bg-canvas p-3 text-body text-ink">{item.answer === undefined ? <span className="text-ink-muted">Not answered</span> : `${item.answer}${item.unit ? ` ${item.unit}` : ''}`}</div>
      <div className="flex flex-wrap gap-2">{item.evidence.length ? item.evidence.map(file => <Badge key={file.id} small>{file.fileName}</Badge>) : item.evidenceRequired ? <span className="text-caption text-danger-700">Evidence not attached</span> : null}</div>
      <div className="text-caption text-ink-muted">{item.description}</div>
    </div>
  );
}

// Qualification Assessment (Assessor, Standard + Buyer Custom criteria and proposed skill rating) and the Approval decision (Approver).
export function ReviewPage({ actor, id, onDone }: { actor: Actor; id: string; onDone: () => void }) {
  const sheet = useQslQuery(() => getSheet(actor, id), [actor.id, id]);
  const data = sheet.data;
  const [local, setLocal] = useState<Record<string, Local>>({});
  const [proposed, setProposed] = useState<Record<string, Level | ''>>({});
  const [loadedFor, setLoadedFor] = useState('');
  const [recommended, setRecommended] = useState<'Pass' | 'Fail' | ''>('');
  const [summary, setSummary] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [scopeType, setScopeType] = useState<ScopeType>('Site / plant');
  const [scopeDetail, setScopeDetail] = useState('');
  const [months, setMonths] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!data || loadedFor === data.id) return;
    const initial: Record<string, Local> = {};
    data.sections.flatMap(section => section.items).forEach(item => {
      const evaluation = item.evaluation;
      initial[item.criteriaId] = { verdict: (evaluation?.verdict as Verdict) ?? '', comment: evaluation?.comment ?? '', requestCorrection: evaluation?.requestCorrection ?? false, message: evaluation?.messageToSupplier ?? '' };
    });
    setLocal(initial);
    setProposed(Object.fromEntries(data.skills.filter(skill => skill.proposed).map(skill => [skill.id, skill.proposed as Level])));
    setRecommended(data.recommended ?? '');
    setSummary(data.evaluationSummary);
    setInternalNote(data.internalNote);
    setScopeType(data.scope.type as ScopeType);
    setScopeDetail(data.scope.detail);
    setMonths(String(data.validityMonths));
    setLoadedFor(data.id);
  }, [data, loadedFor]);

  if (sheet.error) return <Callout tone="danger" title="Cannot open this item">{sheet.error}</Callout>;
  if (!data) return <EmptyState title="Loading..." />;

  const items = data.sections.flatMap(section => section.items);
  const assessing = data.nextAction === 'assess';
  const approving = data.nextAction === 'approve';
  const order = ['PreQualReview', 'SampleEvaluation', 'WaitingAssessment', 'InfoRequested', 'WaitingVerification', 'WaitingApproval', 'Completed'];
  const at = order.indexOf(data.status);
  const steps: { label: string; state: StepState }[] = [
    { label: 'Pre-Qualification', state: 'done' },
    { label: 'Assessment', state: at <= 3 ? 'active' : 'done' },
    { label: 'Skill Verification', state: at === 4 ? 'active' : at > 4 ? 'done' : 'todo' },
    { label: 'Approval', state: at === 5 ? 'active' : at > 5 ? 'done' : 'todo' },
    { label: 'QSL eligible', state: at === 6 ? 'done' : 'todo' },
  ];

  const patch = (criteriaId: string, change: Partial<Local>) => setLocal(current => ({ ...current, [criteriaId]: { ...current[criteriaId], ...change } }));
  const persist = () => {
    saveEvaluations(actor, id, Object.entries(local).filter(([, value]) => value.verdict).map(([criteriaId, value]) => ({
      criteriaId, verdict: value.verdict as Verdict, comment: value.comment, requestCorrection: value.requestCorrection, messageToSupplier: value.message,
    })));
    const ratings = Object.entries(proposed).filter(([, level]) => level !== '').map(([skillId, level]) => ({ skillId, level: level as Level }));
    if (data.useSkillLevel && ratings.length) proposeRatings(actor, id, ratings);
  };
  const run = (action: () => void, success?: string, leave = false) => { if (attempt(action, setNotice, success) && leave) onDone(); };

  const evaluated = items.filter(item => local[item.criteriaId]?.verdict).length;
  const corrections = items.filter(item => local[item.criteriaId]?.requestCorrection || local[item.criteriaId]?.verdict === 'NeedsFix').length;
  const counts = (verdict: Verdict) => items.filter(item => item.evaluation?.verdict === verdict).length;
  const expiry = effectiveDate && Number(months) >= 1 ? addMonthsIso(effectiveDate, Number(months)) : undefined;
  const blockedSelf = approving && data.separateRule && data.assessedByCurrentUser;

  return (
    <div className="space-y-5">
      <Card padded>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>{data.qslNo} · {data.category} · {data.roundLabel}</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-ink">{data.supplier.name}</h2>
            <div className="mt-2 flex items-center gap-2"><Badge dot small>{statusLabel[data.status]}</Badge><ResultBadge result={data.result} /></div>
          </div>
          <Stepper compact steps={steps} />
        </div>
      </Card>

      <NoticeBox notice={notice} />

      <Grid cols="split5">
        <div className="space-y-4 xl:col-span-3">
          <h3 className="text-sm font-semibold text-ink">{approving ? 'Assessor results per criteria (read-only)' : 'Qualification Assessment · Standard Criteria + Buyer Custom Criteria'}</h3>
          {items.map(item => {
            const entry = local[item.criteriaId];
            return (
              <Card key={item.criteriaId} padded>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-caption text-ink-muted">{item.code}</span><span className="text-body font-semibold text-ink">{item.name}</span>
                  <Badge tone={item.kind === 'Standard' ? 'neutral' : 'info'} small>{item.kind === 'Standard' ? 'Standard' : 'Buyer custom'}</Badge><span className="text-caption text-ink-muted">{item.groupName}</span>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Answer item={item} />
                  <div className="space-y-3">
                    <Eyebrow>Evaluation</Eyebrow>
                    {assessing && entry ? (
                      <>
                        <Select value={entry.verdict} aria-label={`Result for ${item.name}`} onChange={event => patch(item.criteriaId, { verdict: event.target.value as Verdict | '', requestCorrection: event.target.value === 'NeedsFix' ? true : entry.requestCorrection })}>
                          <option value="">— Select result —</option>{(Object.keys(verdictLabel) as Verdict[]).map(verdict => <option key={verdict} value={verdict}>{verdictLabel[verdict]}</option>)}
                        </Select>
                        <Textarea placeholder="Internal comment (not shown to the supplier)" value={entry.comment} onChange={event => patch(item.criteriaId, { comment: event.target.value })} />
                        <label className="flex items-center gap-2 text-caption text-ink-soft"><Checkbox checked={entry.requestCorrection || entry.verdict === 'NeedsFix'} disabled={entry.verdict === 'NeedsFix'} onChange={event => patch(item.criteriaId, { requestCorrection: event.target.checked })} />Ask the supplier to correct this item</label>
                        {(entry.requestCorrection || entry.verdict === 'NeedsFix') && <Input placeholder="Message to the supplier" value={entry.message} onChange={event => patch(item.criteriaId, { message: event.target.value })} />}
                      </>
                    ) : item.evaluation ? (
                      <div className="space-y-2"><Badge tone={verdictTone[item.evaluation.verdict as Verdict]} small dot>{verdictLabel[item.evaluation.verdict as Verdict]}</Badge>{item.evaluation.comment && <div className="text-caption text-ink-muted">{item.evaluation.comment}</div>}</div>
                    ) : <span className="text-caption text-ink-muted">Not assessed</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4 xl:col-span-2">
          {data.useSkillLevel && (
            <Card>
              <CardHeader title="Skill Rating" description="Self-rating, assessor proposal and central verification are stored separately" />
              <TableContainer>
                <Table minWidth={420}>
                  <HeadRow columns={['Skill', 'Supplier self', 'Proposed', 'Verified']} />
                  <tbody>{data.skills.map(skill => (
                    <Tr key={skill.id}>
                      <Td dense>{skill.name}</Td>
                      <Td dense><LevelBadge level={skill.self} /></Td>
                      <Td dense>{assessing ? (
                        <Select size="sm" aria-label={`Proposed rating ${skill.name}`} value={String(proposed[skill.id] ?? '')} onChange={event => setProposed(current => ({ ...current, [skill.id]: event.target.value ? Number(event.target.value) as Level : '' }))}>
                          <option value="">—</option>{[1, 2, 3].map(level => <option key={level} value={level}>Level {level}</option>)}
                        </Select>
                      ) : <LevelBadge level={skill.proposed} />}</Td>
                      <Td dense>{skill.verified ? <div><LevelBadge level={skill.verified} />{skill.action === 'Adjusted' && <div className="mt-0.5 text-caption text-warning-700">Adjusted: {skill.verifierComment}</div>}</div> : <span className="text-ink-muted">—</span>}</Td>
                    </Tr>
                  ))}</tbody>
                </Table>
              </TableContainer>
            </Card>
          )}

          {assessing && (
            <Card padded className="space-y-4">
              <h3 className="text-sm font-semibold text-ink">Assessment summary</h3>
              <div className="grid grid-cols-2 gap-3 text-body"><div><Eyebrow>Assessed</Eyebrow>{evaluated}/{items.length}</div><div><Eyebrow>Items to correct</Eyebrow>{corrections}</div></div>
              <Field label="Overall recommendation" required>
                <SegmentedControl label="Overall recommendation" value={recommended || 'None'} onChange={value => setRecommended(value === 'None' ? '' : value)} items={[{ value: 'Pass', label: 'Pass' }, { value: 'Fail', label: 'Fail' }, { value: 'None', label: 'Not selected' }]} />
              </Field>
              <Field label="Assessment summary (shown to Central / Approver)" required><Textarea value={summary} onChange={event => setSummary(event.target.value)} /></Field>
              <Field label="Internal note"><Textarea value={internalNote} onChange={event => setInternalNote(event.target.value)} /></Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={() => run(persist, 'Draft saved')}>Save draft</Button>
                <Button onClick={() => run(() => { persist(); requestMoreInfo(actor, id); }, undefined, true)}>Request more information</Button>
                <Button variant="primary" onClick={() => run(() => { persist(); submitToVerification(actor, id, { recommended: recommended as 'Pass' | 'Fail', summary, internalNote }); }, undefined, true)}>Send to Central Verification</Button>
              </div>
            </Card>
          )}

          {!assessing && data.status !== 'WaitingSupplier' && (
            <Card padded className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Summary from the Assessor and Central Verification</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                {(['Compliant', 'NonCompliant', 'NeedsFix'] as Verdict[]).map(verdict => <div key={verdict} className="rounded-control bg-canvas p-2"><div className="text-lg font-semibold tabular-nums text-ink">{counts(verdict)}</div><div className="text-caption text-ink-muted">{verdictLabel[verdict]}</div></div>)}
              </div>
              <div className="text-body"><Eyebrow>Assessor recommendation</Eyebrow>{data.recommended ? (data.recommended === 'Pass' ? 'Pass' : 'Fail') : '—'} · {data.assessor}</div>
              <div className="text-body"><Eyebrow>Assessor comments</Eyebrow>{data.evaluationSummary || '—'}</div>
              <div className="text-body"><Eyebrow>Central Verifier comments</Eyebrow>{data.verificationComments || '—'}{data.verifierName ? ` · ${data.verifierName}` : ''}</div>
            </Card>
          )}

          {approving && (
            <Card padded className="space-y-4">
              <h3 className="text-sm font-semibold text-ink">Approve / Reject / Return</h3>
              {data.missingForApproval.length > 0 && <Callout tone="warning" title="Cannot approve yet: information is incomplete"><ul className="list-disc pl-4">{data.missingForApproval.map(line => <li key={line}>{line}</li>)}</ul></Callout>}
              {blockedSelf && <Callout tone="warning" compact>The Assessor cannot approve their own item (separation of duties)</Callout>}
              <Field label="Reason for the decision" required><Textarea value={reason} onChange={event => setReason(event.target.value)} /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Qualification Scope"><Select value={scopeType} onChange={event => setScopeType(event.target.value as ScopeType)}>{SCOPE_TYPES.map(item => <option key={item}>{item}</option>)}</Select></Field>
                <Field label="Scope details"><Input value={scopeDetail} disabled={scopeType === 'Company-wide'} onChange={event => setScopeDetail(event.target.value)} /></Field>
                <Field label="Effective date"><Input type="date" value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} /></Field>
                <Field label="Validity (months)"><Input type="number" min={1} max={60} value={months} onChange={event => setMonths(event.target.value)} /></Field>
              </div>
              <div className="text-caption text-ink-muted">Expiry date: {expiry ? formatDate(expiry) : '—'}</div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={() => run(() => { decide(actor, id, { decision: 'Return', reason }); }, undefined, true)}>Return</Button>
                <Button variant="danger-soft" onClick={() => run(() => { decide(actor, id, { decision: 'Reject', reason }); }, undefined, true)}>✕ Reject</Button>
                <Button variant="primary" disabled={data.missingForApproval.length > 0 || blockedSelf} onClick={() => run(() => { decide(actor, id, { decision: 'Approve', reason, effectiveDate, scopeType, scopeDetail, validityMonths: Number(months) }); autoPublishIfConfigured(actor, id); }, undefined, true)}>✓ Approve</Button>
              </div>
            </Card>
          )}
        </div>
      </Grid>
    </div>
  );
}
