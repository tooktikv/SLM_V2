import { useEffect, useState } from 'react';
import type { Actor, Level } from '../../qsl/types';
import { verifyRatings } from '../../qsl/services/assessments';
import { getSheet } from '../../qsl/services/queries';
import { verdictLabel } from '../../qsl/labels';
import { useQslQuery } from '../../qsl/useQsl';
import { Button, Callout, Card, CardHeader, EmptyState, Eyebrow, Field, HeadRow, Input, Select, Table, TableContainer, Td, Textarea, Tr } from '../../components/ui';
import { LevelBadge, NoticeBox, attempt, type Notice } from './shared';

// Central Verification: confirm or adjust each proposed skill rating. Verified ratings are stored apart from self and proposed ratings.
export function VerifyPage({ actor, id, onDone }: { actor: Actor; id: string; onDone: () => void }) {
  const sheet = useQslQuery(() => getSheet(actor, id), [actor.id, id]);
  const data = sheet.data;
  const [levels, setLevels] = useState<Record<string, Level | ''>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overall, setOverall] = useState('');
  const [loadedFor, setLoadedFor] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!data || loadedFor === data.id) return;
    setLevels(Object.fromEntries(data.skills.map(skill => [skill.id, (skill.proposed ?? skill.self ?? '') as Level | ''])));
    setLoadedFor(data.id);
  }, [data, loadedFor]);

  if (sheet.error) return <Callout tone="danger" title="Cannot open this item">{sheet.error}</Callout>;
  if (!data) return <EmptyState title="Loading..." />;

  const items = data.sections.flatMap(section => section.items);
  const count = (verdict: string) => items.filter(item => item.evaluation?.verdict === verdict).length;
  const editable = data.nextAction === 'verify';
  const submit = () => {
    const decisions = data.skills.filter(skill => levels[skill.id]).map(skill => ({ skillId: skill.id, verifiedLevel: levels[skill.id] as Level, comment: comments[skill.id] }));
    if (attempt(() => verifyRatings(actor, id, { decisions, comments: overall }), setNotice)) onDone();
  };

  return (
    <div className="space-y-5">
      <Card padded>
        <Eyebrow>{data.qslNo} · {data.category} · {data.scope.type}{data.scope.detail ? ` · ${data.scope.detail}` : ''}</Eyebrow>
        <h2 className="mt-1 text-lg font-semibold text-ink">Skill Rating Verification · {data.supplier.name}</h2>
        <p className="mt-1 text-caption text-ink-muted">The Central Authority confirms or adjusts the Skill Ratings proposed by the Assessor. The supplier's self-rating never becomes a verified rating automatically.</p>
      </Card>
      <NoticeBox notice={notice} />
      <Card>
        <CardHeader title="Skill ratings" />
        <TableContainer>
          <Table minWidth={820}>
            <HeadRow columns={['Skill', 'Supplier self-rating', 'Assessor proposed', 'Verified rating', 'Reason (required when adjusting)']} />
            <tbody>{data.skills.map(skill => {
              const reference = skill.proposed ?? skill.self;
              const adjusted = !!levels[skill.id] && levels[skill.id] !== reference;
              return (
                <Tr key={skill.id}>
                  <Td dense className="font-medium text-ink">{skill.name}</Td>
                  <Td dense><LevelBadge level={skill.self} /></Td>
                  <Td dense><LevelBadge level={skill.proposed} /></Td>
                  <Td dense>{editable ? <Select size="sm" aria-label={`Verified ${skill.name}`} value={String(levels[skill.id] ?? '')} onChange={event => setLevels(current => ({ ...current, [skill.id]: event.target.value ? Number(event.target.value) as Level : '' }))}><option value="">—</option>{[1, 2, 3].map(level => <option key={level} value={level}>Level {level}</option>)}</Select> : <LevelBadge level={skill.verified} />}</Td>
                  <Td dense>{editable ? <Input placeholder={adjusted ? 'Reason for adjustment' : 'Confirmed as proposed'} value={comments[skill.id] ?? ''} invalid={adjusted && !comments[skill.id]?.trim()} onChange={event => setComments(current => ({ ...current, [skill.id]: event.target.value }))} /> : skill.verifierComment ?? '—'}</Td>
                </Tr>
              );
            })}</tbody>
          </Table>
        </TableContainer>
      </Card>
      <Card padded className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Assessor input</h3>
        <div className="grid grid-cols-3 gap-3 text-center">{['Compliant', 'NonCompliant', 'NeedsFix'].map(verdict => <div key={verdict} className="rounded-control bg-canvas p-2"><div className="text-lg font-semibold tabular-nums text-ink">{count(verdict)}</div><div className="text-caption text-ink-muted">{verdictLabel[verdict as 'Compliant']}</div></div>)}</div>
        <div className="text-body"><Eyebrow>Recommendation</Eyebrow>{data.recommended === 'Pass' ? 'Pass' : data.recommended === 'Fail' ? 'Fail' : '—'} · {data.assessor}</div>
        <div className="text-body"><Eyebrow>Assessment summary</Eyebrow>{data.evaluationSummary || '—'}</div>
      </Card>
      {editable && (
        <Card padded className="space-y-3">
          <Field label="Central Verifier comments"><Textarea value={overall} onChange={event => setOverall(event.target.value)} /></Field>
          <div className="flex justify-end"><Button variant="primary" onClick={submit}>Confirm ratings and send to Approver</Button></div>
        </Card>
      )}
    </div>
  );
}
