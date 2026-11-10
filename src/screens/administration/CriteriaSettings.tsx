import { useState } from 'react';
import type { Actor, AnswerType, CriteriaData, CriteriaKind } from '../../qsl/types';
import { can } from '../../qsl/rbac';
import { addCriteriaToForm, createCriteria, deleteCriteria, setCriteriaActive, updateCriteria } from '../../qsl/services/criteria';
import { criteriaFormOptions, listCriteriaRows } from '../../qsl/services/queries';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Callout, Card, Checkbox, EmptyState, Field, HeadRow, Input, Modal, SegmentedControl, Select, Table, TableContainer, Td, Textarea, Toolbar, Tr } from '../../components/ui';
import { NoticeBox, attempt, type Notice } from '../qualification/shared';
import { cycle } from '../../lib/demo';

type Row = ReturnType<typeof listCriteriaRows>[number];
const answerTypes: { value: AnswerType; label: string }[] = [
  { value: 'ShortText', label: 'Short text' }, { value: 'LongText', label: 'Long text' }, { value: 'Choice', label: 'Choice' },
  { value: 'Number', label: 'Number' }, { value: 'Date', label: 'Date' }, { value: 'File', label: 'File' },
];
const emptyData = (groupId: string): CriteriaData => ({ code: '', name: '', groupId, description: '', answerType: 'ShortText', evidenceRequired: false, levels: ['', '', ''] });

function CriteriaModal({ actor, kind, row, onClose }: { actor: Actor; kind: CriteriaKind; row?: Row; onClose: () => void }) {
  const options = criteriaFormOptions();
  const [data, setData] = useState<CriteriaData>(row
    ? { code: row.code, name: row.name, groupId: row.groupId, description: row.description, answerType: row.answerType, options: row.options, unit: row.unit, evidenceRequired: row.evidenceRequired, levels: row.levels }
    : emptyData(options.skills[0]?.id ?? ''));
  const [choices, setChoices] = useState((row?.options ?? []).join(', '));
  const [formId, setFormId] = useState('');
  const [section, setSection] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const set = (patch: Partial<CriteriaData>) => setData(current => ({ ...current, ...patch }));
  const [fills, setFills] = useState(0);
  const fillSample = () => {
    const samples = [
      { name: 'Environmental management system', description: 'Describe how environmental impacts are monitored and reduced', answerType: 'ShortText' as AnswerType, evidenceRequired: true },
      { name: 'Certified quality standard', description: 'Which quality standard the site is certified to', answerType: 'Choice' as AnswerType, evidenceRequired: true },
      { name: 'On-time delivery rate', description: 'Share of orders delivered on time in the last 12 months', answerType: 'Number' as AnswerType, evidenceRequired: false },
    ];
    const sample = cycle(samples, fills);
    const code = `${kind === 'Standard' ? 'ST' : 'BC'}-${String(10 + fills).padStart(2, '0')}${Date.now().toString().slice(-3)}`;
    setData(current => ({ ...current, code, name: sample.name, description: sample.description, answerType: sample.answerType, unit: sample.answerType === 'Number' ? '%' : undefined, evidenceRequired: sample.evidenceRequired, levels: [`${sample.name}: basic control in place`, `${sample.name}: controlled and documented`, `${sample.name}: advanced, audited and continuously improved`] }));
    setChoices(sample.answerType === 'Choice' ? 'ISO 9001, IATF 16949, None' : '');
    if (kind === 'BuyerCustom' && options.forms.length) setFormId(options.forms[0].id);
    setNotice(null);
    setFills(fills + 1);
  };

  const save = () => {
    const payload: CriteriaData = { ...data, options: data.answerType === 'Choice' ? choices.split(',').map(item => item.trim()).filter(Boolean) : undefined };
    const done = attempt(() => {
      if (row) { updateCriteria(actor, row.id, payload); return; }
      const created = createCriteria(actor, payload, kind);
      if (formId) addCriteriaToForm(actor, formId, created.id, { section: section || 'Buyer custom', required: true });
    }, setNotice);
    if (done) onClose();
  };
  const form = options.forms.find(item => item.id === formId);

  return (
    <Modal title={row ? `Edit criteria ${row.code}` : kind === 'Standard' ? 'Add Standard Criteria' : 'Add Buyer Custom Criteria'} eyebrow={kind === 'Standard' ? 'Central Authority' : 'Buyer-owned'} onClose={onClose} onFillSample={row ? undefined : fillSample} closeLabel="Close">
      <div className="space-y-4">
        <NoticeBox notice={notice} />
        {row && <Callout tone="info" compact>Saving creates a new version. Rounds that already used the earlier version are not affected.</Callout>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required><Input value={data.code} onChange={event => set({ code: event.target.value })} /></Field>
          <Field label="Skill" required><Select value={data.groupId} onChange={event => set({ groupId: event.target.value })}>{options.skills.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Criteria name" required className="sm:col-span-2"><Input value={data.name} onChange={event => set({ name: event.target.value })} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={data.description} onChange={event => set({ description: event.target.value })} /></Field>
          <Field label="Answer type"><Select value={data.answerType} onChange={event => set({ answerType: event.target.value as AnswerType })}>{answerTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          {data.answerType === 'Choice' && <Field label="Options (comma-separated)"><Input value={choices} onChange={event => setChoices(event.target.value)} /></Field>}
          {data.answerType === 'Number' && <Field label="Unit"><Input value={data.unit ?? ''} onChange={event => set({ unit: event.target.value })} /></Field>}
          <label className="flex items-center gap-2 text-body text-ink-soft sm:col-span-2"><Checkbox checked={data.evidenceRequired} onChange={event => set({ evidenceRequired: event.target.checked })} />Evidence required</label>
          {([0, 1, 2] as const).map(index => <Field key={index} label={`Level ${index + 1} definition`}><Input value={data.levels[index]} onChange={event => { const levels = [...data.levels] as CriteriaData['levels']; levels[index] = event.target.value; set({ levels }); }} /></Field>)}
        </div>
        {!row && kind === 'BuyerCustom' && (
          <div className="grid grid-cols-1 gap-4 rounded-control bg-canvas p-3 sm:grid-cols-2">
            <Field label="Add to assessment form" hint="Optional, can be added later"><Select value={formId} onChange={event => setFormId(event.target.value)}><option value="">— Do not add now —</option>{options.forms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            {formId && <Field label="Section in form"><Input list="qsl-sections" value={section} placeholder="Buyer custom" onChange={event => setSection(event.target.value)} /><datalist id="qsl-sections">{form?.sections.map(item => <option key={item} value={item} />)}</datalist></Field>}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

// Criteria Management: Standard criteria are owned by the central authority; Buyer custom criteria are kept separate.
export default function CriteriaSettings({ actor }: { actor: Actor }) {
  const [kind, setKind] = useState<CriteriaKind>('Standard');
  const [modal, setModal] = useState<{ row?: Row } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const query = useQslQuery(() => listCriteriaRows(kind), [kind]);
  const rows = query.data ?? [];
  const editable = can(actor, kind === 'Standard' ? 'criteria.standard' : 'criteria.custom');

  return (
    <div className="space-y-4">
      <Toolbar>
        <SegmentedControl<CriteriaKind> label="Criteria type" value={kind} onChange={setKind} items={[{ value: 'Standard', label: 'Standard Criteria' }, { value: 'BuyerCustom', label: 'Buyer Custom Criteria' }]} />
        {editable && <Button variant="primary" onClick={() => setModal({})}>+ Add criteria</Button>}
      </Toolbar>
      {!editable && <Callout tone="info" compact>{kind === 'Standard' ? 'Standard Criteria are managed by the Central Authority (Admin) only' : 'Buyer Custom Criteria are managed by the Buyer Coordinator and Admin'}</Callout>}
      <NoticeBox notice={notice} />
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={860}>
            <HeadRow columns={['Code', 'Criteria', 'Skill', 'Answer', 'Used in', 'Version', 'Status', '']} />
            <tbody>
              {rows.map(row => (
                <Tr key={row.id}>
                  <Td className="font-mono text-caption">{row.code}</Td>
                  <Td><div className="font-medium text-ink">{row.name}</div><div className="text-caption text-ink-muted">{row.description}</div></Td>
                  <Td>{row.skill}</Td>
                  <Td>{answerTypes.find(item => item.value === row.answerType)?.label}{row.evidenceRequired ? ' · evidence' : ''}</Td>
                  <Td className="text-caption">{row.forms.join(', ') || '—'}<div className="text-ink-muted">{row.usage.assessments} rounds</div></Td>
                  <Td>v{row.version}</Td>
                  <Td><Badge small tone={row.active ? 'success' : 'neutral'} dot>{row.active ? 'Active' : 'Inactive'}</Badge></Td>
                  <Td>
                    {editable && (
                      <div className="flex gap-1.5">
                        <Button size="xs" variant="link" onClick={() => setModal({ row })}>Edit</Button>
                        <Button size="xs" variant="link-muted" onClick={() => attempt(() => setCriteriaActive(actor, row.id, !row.active), setNotice)}>{row.active ? 'Deactivate' : 'Activate'}</Button>
                        <Button size="xs" variant="link-danger" onClick={() => attempt(() => deleteCriteria(actor, row.id), setNotice, 'Criteria deleted')}>Delete</Button>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState title="No criteria yet" />}
      </Card>
      {modal && <CriteriaModal actor={actor} kind={kind} row={modal.row} onClose={() => setModal(null)} />}
    </div>
  );
}
