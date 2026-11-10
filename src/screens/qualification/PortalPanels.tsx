import { useState } from 'react';
import type { getDetail } from '../../qsl/services/queries';
import { Badge, Card, CardHeader, DetailGrid, EmptyState, HeadRow, SegmentedControl, Table, TableContainer, Td, Tr, type Tone } from '../../components/ui';
import { formatDate } from './shared';

type Portal = ReturnType<typeof getDetail>['portal'];

const statusTone = (status: Portal['portalStatus']): Tone => (status === 'Result Released' ? 'success' : status === 'Additional Information Required' ? 'warning' : status === 'Requested' ? 'info' : 'brand');
const money = (value: number, currency: string, basis: string) => `${currency} ${value.toLocaleString('en-US')} / ${basis}`;
const optional = (value: number | undefined, unit = '') => (value === undefined ? '—' : `${value}${unit}`);

// What SLM asked the supplier for through the Supplier Portal: request header, skills and required documents.
export function PortalRequestCards({ portal, category, scope, dueDate, qslNo }: { portal: Portal; category: string; scope: string; dueDate?: string; qslNo: string }) {
  return (
    <>
      <Card>
        <CardHeader title="Supplier Portal request" description="What the supplier sees in the Supplier Portal" actions={portal.portalStatus ? <Badge tone={statusTone(portal.portalStatus)} dot>{portal.portalStatus}</Badge> : <Badge tone="neutral">Not sent yet</Badge>} />
        <div className="p-5">
          <DetailGrid items={[
            { label: 'Portal request ref.', value: portal.requestId || '—' }, { label: 'QSL round', value: qslNo },
            { label: 'Requesting Buyer', value: portal.buyer || '—' }, { label: 'Product Category', value: category },
            { label: 'Qualification Scope', value: scope || '—' }, { label: 'Requested on', value: formatDate(portal.requestedAt) },
            { label: 'Supplier due date', value: dueDate ? formatDate(dueDate) : '—' }, { label: 'Currencies', value: portal.currencies.join(', ') },
            { label: 'Rate basis', value: portal.rateBases.join(', ') },
            { label: 'Submission instructions', value: portal.instructions, wide: true },
          ]} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Skills and evidence required" description={`Rating scale: ${portal.ratingScale.map(item => `${item.level} ${item.name}`).join(' · ')}`} />
        <TableContainer>
          <Table minWidth={720}>
            <HeadRow columns={['Skill group', 'Skill / criteria', 'Defined by', 'Requirement', 'Evidence']} />
            <tbody>{portal.criteria.map(item => (
              <Tr key={item.id}>
                <Td dense className="text-ink-muted">{item.group}</Td><Td dense><div className="font-medium text-ink">{item.name}</div><div className="text-caption text-ink-muted">{item.description}</div></Td>
                <Td dense><Badge small tone={item.source === 'Central Standard' ? 'brand' : 'info'}>{item.source}</Badge></Td>
                <Td dense><Badge small tone={item.mandatory ? 'warning' : 'neutral'}>{item.mandatory ? 'Mandatory' : 'Optional'}</Badge></Td>
                <Td dense>{item.evidenceRequired ? <Badge small tone="warning">Evidence required</Badge> : <span className="text-caption text-ink-muted">Optional</span>}</Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {portal.criteria.length === 0 && <EmptyState title="Skills appear once the request is submitted" />}
        {portal.requiredEvidence.length > 0 && (
          <div className="border-t border-line-subtle p-5">
            <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-muted">Required company documents</div>
            <ul className="space-y-2">{portal.requiredEvidence.map(item => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="text-body font-medium text-ink">{item.title}</div><div className="text-caption text-ink-muted">{item.description || 'No description'}{item.docTypes.length ? ` · ${item.docTypes.join(', ')}` : ' · any document type'}</div></div>
                <Badge small tone={item.mandatory ? 'warning' : 'neutral'}>{item.mandatory ? 'Mandatory' : 'Optional'}</Badge>
              </li>
            ))}</ul>
          </div>
        )}
      </Card>
    </>
  );
}

// What the supplier sent back: commercial terms, the rate card per skill and the evidence attached.
export function RateCardCard({ portal }: { portal: Portal }) {
  const cards = portal.rateCards;
  const [picked, setPicked] = useState<number | null>(null);
  const card = cards.find(item => item.version === picked) ?? cards.at(-1);

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Rate card from the supplier" description="Self-ratings are declared by the supplier. They are kept apart from the rating the assessor gives." />
      {!card ? <EmptyState title="No rate card received yet" description="The supplier submits it through the Supplier Portal." /> : (
        <>
          {cards.length > 1 && (
            <div className="border-b border-line-subtle px-5 py-3">
              <SegmentedControl<string> label="Submission version" value={String(card.version)} onChange={value => setPicked(Number(value))} items={cards.map(item => ({ value: String(item.version), label: `V${item.version} · ${item.kind}` }))} />
            </div>
          )}
          <div className="p-5">
            <DetailGrid items={[
              { label: 'Submission ref.', value: card.ref }, { label: 'Submitted', value: `${formatDate(card.submittedAt)} · ${card.submittedBy} (${card.role})` },
              { label: 'Currency', value: card.terms.currency }, { label: 'Rate basis', value: card.terms.rateBasis },
              { label: 'Rates effective from', value: formatDate(card.terms.effectiveFrom) }, { label: 'Rates valid until', value: formatDate(card.terms.validUntil) },
              { label: 'Mobilisation lead time', value: optional(card.terms.leadTimeDays, ' days') }, { label: 'Payment terms', value: optional(card.terms.paymentTermsDays, ' days') },
              { label: 'Annual rate escalation', value: optional(card.terms.escalationPct, '%') }, { label: 'Overtime multiplier', value: `${optional(card.terms.overtimeWeekday, '×')} working day · ${optional(card.terms.overtimeHoliday, '×')} holiday` },
              ...(card.terms.notes ? [{ label: 'Other terms and conditions', value: card.terms.notes, wide: true }] : []),
            ]} />
          </div>
          <TableContainer>
            <Table minWidth={760}>
              <HeadRow columns={['Skill', 'Offered', 'Self-rating', 'Rate lines (level · headcount · average years · rate)']} />
              <tbody>{card.skills.map(skill => (
                <Tr key={skill.criteriaId}>
                  <Td dense><div className="font-medium text-ink">{skill.name}</div>{skill.comment && <div className="text-caption text-ink-muted">{skill.comment}</div>}</Td>
                  <Td dense><Badge small tone={skill.offered ? 'success' : 'neutral'}>{skill.offered ? 'Yes' : 'No'}</Badge></Td>
                  <Td dense>{skill.selfRating ? <Badge small tone="brand">{skill.selfRating} · {skill.selfRatingName}</Badge> : '—'}</Td>
                  <Td dense>{skill.lines.length ? <ul className="space-y-1">{skill.lines.map(line => <li key={line.level} className="text-caption text-ink-soft">L{line.level} {line.levelName} · {line.headcount} people · {line.avgYears} yrs · <span className="font-medium text-ink">{money(line.rate, card.terms.currency, card.terms.rateBasis)}</span></li>)}</ul> : <span className="text-caption text-ink-muted">—</span>}</Td>
                </Tr>
              ))}</tbody>
            </Table>
          </TableContainer>
          <div className="border-t border-line-subtle p-5">
            <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-muted">Evidence attached</div>
            <ul className="space-y-1.5">{card.evidence.map(ref => (
              <li key={ref.id} className="flex flex-wrap items-center justify-between gap-2 text-body">
                <span className="text-ink">{ref.docName} <span className="text-caption text-ink-muted">· {ref.docType} · v{ref.version}</span></span>
                <span className="text-caption text-ink-muted">{ref.target}{ref.expiry ? ` · expires ${formatDate(ref.expiry)}` : ''}</span>
              </li>
            ))}{!card.evidence.length && <li className="text-caption text-ink-muted">No evidence attached</li>}</ul>
            {card.replyList.length > 0 && <div className="mt-4"><div className="mb-1 text-caption font-semibold uppercase tracking-wide text-ink-muted">Replies to additional information</div><ul className="space-y-1">{card.replyList.map(reply => <li key={reply.key} className="text-body text-ink-soft">{reply.text}</li>)}</ul></div>}
            <div className="mt-4 text-caption text-ink-muted">Supplier declaration confirmed{card.revisesVersion ? ` · revises V${card.revisesVersion}` : ''}</div>
          </div>
        </>
      )}
    </Card>
  );
}

// Requests for more information sent back to the supplier, and whether they were answered.
export function InfoRequestsCard({ portal }: { portal: Portal }) {
  if (!portal.infoRequests.length) return null;
  return (
    <Card>
      <CardHeader title="Additional information requests" description="Sent to the supplier through the Supplier Portal" />
      <div className="divide-y divide-line-subtle">
        {portal.infoRequests.map(request => (
          <div key={request.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-body font-medium text-ink">{request.from} · {formatDate(request.requestedAt)}</div>
              <Badge small tone={request.status === 'Open' ? 'warning' : 'success'} dot>{request.status === 'Open' ? 'Open' : `Responded${request.respondedAt ? ` ${formatDate(request.respondedAt)}` : ''}`}</Badge>
            </div>
            <p className="mt-1 text-caption text-ink-muted">{request.message}</p>
            <ul className="mt-2 space-y-1">{request.items.map((item, index) => <li key={`${item.target}-${index}`} className="text-body text-ink-soft"><span className="font-medium text-ink">{item.target}:</span> {item.text}</li>)}</ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
