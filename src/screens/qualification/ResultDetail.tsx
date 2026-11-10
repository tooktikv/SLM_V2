import type { Actor } from '../../qsl/types';
import { getDetail, type NextAction } from '../../qsl/services/queries';
import { statusLabel, supplierStatusLabel, typeLabel, verdictLabel } from '../../qsl/labels';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Callout, Card, CardHeader, DetailGrid, EmptyState, Eyebrow, Grid, HeadRow, Stepper, Table, TableContainer, Td, Tr, type StepState } from '../../components/ui';
import { InfoRequestsCard, PortalRequestCards, RateCardCard } from './PortalPanels';
import { LevelBadge, ResultBadge, StandingBadge, ValidityBadge, formatDate, statusTone } from './shared';

const STEPS = ['Request', 'Pre-Qualification', 'Assessment', 'Approval', 'QSL eligible'];
const stepOf = { Draft: 0, WaitingSupplier: 0, PreQualReview: 1, SampleEvaluation: 1, WaitingAssessment: 2, InfoRequested: 2, WaitingApproval: 3, Completed: 4 } as const;

export function ResultDetail({ actor, id, onOpen, onContinue, onReassess, onProfile }: {
  actor: Actor;
  id: string;
  onOpen: (id: string) => void;
  onContinue: (id: string, action: Exclude<NextAction, null>) => void;
  onReassess: (id: string) => void;
  onProfile: (supplierId: string) => void;
}) {
  const query = useQslQuery(() => getDetail(actor, id), [actor.id, id]);
  const data = query.data;
  if (query.error) return <Callout tone="danger" title="Item not found or access denied">{query.error}</Callout>;
  if (!data) return <EmptyState title="Loading..." />;

  const row = data.row;
  const current = stepOf[row.status];
  const steps = STEPS.map((label, index): { label: string; state: StepState } => ({ label, state: row.status === 'Completed' ? 'done' : index < current ? 'done' : index === current ? 'active' : 'todo' }));
  const staff = actor.role !== 'Supplier';

  return (
    <div className="space-y-5">
      <Card padded>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>{row.qslNo} · {row.roundLabel}</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-ink">{data.supplier.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[row.status]} dot>{actor.role === 'Supplier' ? supplierStatusLabel[row.status] : statusLabel[row.status]}</Badge>
              <ResultBadge result={row.result} /><StandingBadge standing={data.standing} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.nextAction && <Button variant="primary" onClick={() => onContinue(row.id, row.nextAction!)}>Continue</Button>}
            {data.canReassess && <Button onClick={() => onReassess(row.id)}>Start renewal / reassessment</Button>}
            {staff && <Button onClick={() => onProfile(data.supplier.id)}>Open supplier profile</Button>}
          </div>
        </div>
        <Stepper compact className="mt-5" steps={steps} />
      </Card>

      <Grid cols="split5">
        <div className="space-y-5 xl:col-span-3">
          <Card>
            <CardHeader title="Overall result" />
            <div className="p-5">
              <DetailGrid items={[
                { label: 'Result', value: <ResultBadge result={row.result} /> },
                { label: 'Validity', value: <ValidityBadge validity={data.validity} /> },
                { label: 'Product Category', value: data.category },
                { label: 'Round', value: `${data.round} · ${typeLabel[data.round > 1 ? 'Re' : 'First']}${data.previousNo ? ` · ref. ${data.previousNo}` : ''}` },
                { label: 'Approved on', value: formatDate(data.dates.approvedAt) },
                { label: 'Effective date', value: formatDate(data.dates.effectiveDate) },
                { label: 'Expiry date', value: data.dates.expiryDate ? formatDate(data.dates.expiryDate) : '—' },
                ...(staff ? [{ label: 'Coordinator', value: data.people.coordinator }, { label: 'Assessor', value: data.people.assessor }, { label: 'Approver', value: data.people.approver }] : []),
                ...(data.decision && staff ? [{ label: 'Decision reason', value: data.decision.reason, wide: true }] : []),
                ...(staff && data.evaluationSummary ? [{ label: 'Assessment summary', value: data.evaluationSummary, wide: true }] : []),
              ]} />
            </div>
          </Card>

          <PortalRequestCards portal={data.portal} category={data.category} scope={row.scope} dueDate={row.dueDate} qslNo={row.qslNo} />
          <RateCardCard portal={data.portal} />
          <InfoRequestsCard portal={data.portal} />

          {data.enrollment && (
            <Card>
              <CardHeader title="QSL listing" description="Published scope, validity and qualification level" />
              <div className="p-5">
                <DetailGrid items={[
                  { label: 'QSL ID', value: data.enrollment.listingNo }, { label: 'Product Category', value: data.enrollment.productCategory },
                  { label: 'Qualification Scope', value: `${data.enrollment.scopeType}${data.enrollment.scopeDetail ? ` · ${data.enrollment.scopeDetail}` : ''}` },
                  { label: 'QSL effective - expiry', value: `${formatDate(data.enrollment.effectiveDate)} - ${formatDate(data.enrollment.expiryDate)}` },
                  { label: 'Qualification Level', value: <LevelBadge level={data.level} /> }, { label: 'QSL status', value: <StandingBadge standing={data.standing} /> },
                  ...(data.enrollment.withdrawal ? [{ label: 'Withdrawn', value: `${formatDate(data.enrollment.withdrawal.at)} · ${data.enrollment.withdrawal.reason}`, wide: true }] : []),
                ]} />
                {data.assessedSkills.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{data.assessedSkills.map(skill => <Badge key={skill.skillId} small>{skill.name} · Level {skill.level}</Badge>)}</div>}
              </div>
            </Card>
          )}

          {staff && data.ratings.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Skill Rating" description="The supplier self-rating and the assessor rating are stored separately" />
              <TableContainer><Table minWidth={480}><HeadRow columns={['Skill', 'Supplier self', 'Assessed']} /><tbody>{data.ratings.map(rating => <Tr key={rating.name}><Td dense>{rating.name}</Td><Td dense><LevelBadge level={rating.self} /></Td><Td dense><LevelBadge level={rating.assessed} /></Td></Tr>)}</tbody></Table></TableContainer>
            </Card>
          )}

          {staff ? (
            <Card className="overflow-hidden">
              <CardHeader title="Result per criteria" />
              {data.criteriaResults.length ? (
                <TableContainer><Table minWidth={520}><HeadRow columns={['Criteria', 'Result', 'Comment']} /><tbody>{data.criteriaResults.map(result => <Tr key={result.name}><Td dense>{result.name}</Td><Td dense>{verdictLabel[result.verdict]}</Td><Td dense className="text-ink-muted">{result.comment || '—'}</Td></Tr>)}</tbody></Table></TableContainer>
              ) : <EmptyState title="No criteria results yet" />}
              {data.internalNote && <div className="border-t border-line-subtle p-5 text-body"><Eyebrow>Internal note</Eyebrow>{data.internalNote}</div>}
            </Card>
          ) : (
            <Card>
              <CardHeader title="Messages from CPF" />
              <div className="space-y-2 p-5">{data.cpfMessages.length ? data.cpfMessages.map(item => <div key={`${item.name}${item.message}`} className="text-body"><span className="font-medium text-ink">{item.name}: </span>{item.message}{item.resolved ? ' (resolved)' : ''}</div>) : <span className="text-caption text-ink-muted">No messages</span>}</div>
            </Card>
          )}
        </div>

        <div className="space-y-5 xl:col-span-2">
          {staff && data.approvals.length > 0 && (
            <Card>
              <CardHeader title="Approval Log" />
              <ul className="divide-y divide-line-subtle">{data.approvals.map(entry => <li key={entry.id} className="px-5 py-3"><div className="flex items-center justify-between"><Badge small tone={entry.decision === 'Approve' ? 'success' : entry.decision === 'Reject' ? 'danger' : 'warning'}>{entry.decision}</Badge><span className="text-caption text-ink-muted">{formatDate(entry.at)} · {entry.byName}</span></div><div className="mt-1 text-caption text-ink-soft">{entry.reason}</div></li>)}</ul>
            </Card>
          )}
          {staff && (data.suspensions.length > 0 || data.extensions.length > 0) && (
            <Card>
              <CardHeader title="Monitoring" />
              <ul className="space-y-2 p-5 text-caption text-ink-soft">
                {data.suspensions.map((item, index) => <li key={`s${index}`}>Suspended {formatDate(item.suspendedAt)} by {item.suspendedBy}: {item.reason}{item.reactivatedAt ? ` → reactivated ${formatDate(item.reactivatedAt)}` : ' (still suspended)'}</li>)}
                {data.extensions.map((item, index) => <li key={`e${index}`}>Extended {formatDate(item.previousExpiry)} → {formatDate(item.newExpiry)}: {item.reason}</li>)}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Evidence and documents" />
            <ul className="space-y-1.5 p-5 text-body">
              {[...data.documents.map(name => ({ label: 'Request attachment', name })), ...data.evidence.map(item => ({ label: item.criteria, name: item.fileName }))].map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3"><span className="text-ink">{file.name}</span><span className="text-caption text-ink-muted">{file.label}</span></li>)}
              {!data.documents.length && !data.evidence.length && <li className="text-caption text-ink-muted">No documents</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <ol className="space-y-3 p-5">
              {data.history.map((item, index) => (
                <li key={`${item.at}-${index}`} className="flex gap-3 border-l-2 border-brand-200 pl-3">
                  <div className="min-w-24 text-caption text-ink-muted">{formatDate(item.at)}</div>
                  <div><div className="text-body font-medium text-ink">{item.action}</div><div className="mt-0.5 text-caption text-ink-muted">{item.by} · {item.role}{item.note ? ` · ${item.note}` : ''}</div></div>
                </li>
              ))}
              {!data.history.length && <li className="text-caption text-ink-muted">No history yet</li>}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Other rounds" />
            <div className="divide-y divide-line-subtle">
              {data.otherRounds.map(item => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div><div className="text-body font-medium text-ink">{item.qslNo}</div><div className="text-caption text-ink-muted">Round {item.round} · {item.statusLabel}</div></div>
                  <div className="flex items-center gap-3"><ResultBadge result={item.result} /><Button variant="link" onClick={() => onOpen(item.id)}>Open</Button></div>
                </div>
              ))}
              {!data.otherRounds.length && <div className="px-5 py-4 text-caption text-ink-muted">No other rounds</div>}
            </div>
          </Card>
        </div>
      </Grid>
    </div>
  );
}
