import { useState } from 'react';
import { REVIEWER_ROLES, getConfig, newId, updateConfig } from '../../config';
import type { ApprovalFlow } from '../../config';
import { Button, Callout, Card, CardBody, CardHeader, Checkbox, Field, Input, Select } from '../../components/ui';
import { NoticeBox, useAction, useConfigRevision } from './shared';

type FlowKey = 'qualificationApproval' | 'capabilityApproval';

function FlowCard({ flowKey, title, description, note }: { flowKey: FlowKey; title: string; description: string; note: string }) {
  const { notice, run } = useAction();
  const [flow, setFlow] = useState<ApprovalFlow>(() => getConfig(flowKey));
  const scopes = getConfig('lists').productCategories.filter(item => item.active).map(item => item.name);
  const patch = (change: Partial<ApprovalFlow>) => setFlow(current => ({ ...current, ...change }));
  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= flow.steps.length) return;
    const steps = [...flow.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    patch({ steps });
  };

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-5">
        <NoticeBox notice={notice} />
        <Callout tone="info" compact>{note}</Callout>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Approval sequence" hint={flow.mode === 'Sequential' ? 'Steps run in the order below' : 'All steps run at the same time'}>
            <Select value={flow.mode} onChange={event => patch({ mode: event.target.value as ApprovalFlow['mode'] })}><option>Sequential</option><option>Parallel</option></Select>
          </Field>
        </div>
        <div>
          <div className="mb-2 text-caption font-medium text-ink-soft">Approval hierarchy</div>
          <ol className="space-y-2">
            {flow.steps.map((step, index) => (
              <li key={step.id} className="flex flex-wrap items-center gap-3 rounded-control border border-line p-2.5">
                <span className="w-6 text-center text-caption font-semibold text-ink-muted">{flow.mode === 'Sequential' ? index + 1 : '•'}</span>
                <Select size="sm" aria-label={`Approver role ${index + 1}`} value={step.role} onChange={event => patch({ steps: flow.steps.map((entry, position) => (position === index ? { ...entry, role: event.target.value } : entry)) })}>{REVIEWER_ROLES.map(role => <option key={role}>{role}</option>)}</Select>
                <label className="flex items-center gap-2 text-caption text-ink-soft"><Checkbox checked={step.required} onChange={event => patch({ steps: flow.steps.map((entry, position) => (position === index ? { ...entry, required: event.target.checked } : entry)) })} />Required</label>
                {flow.mode === 'Sequential' && <><Button size="xs" variant="link-muted" onClick={() => move(index, -1)}>Up</Button><Button size="xs" variant="link-muted" onClick={() => move(index, 1)}>Down</Button></>}
                <Button size="xs" variant="link-danger" onClick={() => patch({ steps: flow.steps.filter((_, position) => position !== index) })}>Remove</Button>
              </li>
            ))}
          </ol>
          <Button className="mt-2" onClick={() => patch({ steps: [...flow.steps, { id: newId('step'), role: REVIEWER_ROLES.find(role => !flow.steps.some(step => step.role === role)) ?? REVIEWER_ROLES[0], required: true }] })}>+ Add step</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={flow.delegation.enabled} onChange={event => patch({ delegation: { ...flow.delegation, enabled: event.target.checked } })} />Allow approval delegation</label>
          <Field label="Maximum delegation (days)"><Input type="number" min={1} max={90} disabled={!flow.delegation.enabled} value={flow.delegation.maxDays} onChange={event => patch({ delegation: { ...flow.delegation, maxDays: Number(event.target.value) } })} /></Field>
        </div>
        <div>
          <div className="mb-2 text-caption font-medium text-ink-soft">Approver assignment by product category</div>
          <div className="space-y-2">
            {flow.assignments.map((entry, index) => (
              <div key={`${entry.scope}-${index}`} className="flex flex-wrap items-center gap-3">
                <Select size="sm" aria-label="Category" value={entry.scope} onChange={event => patch({ assignments: flow.assignments.map((item, position) => (position === index ? { ...item, scope: event.target.value } : item)) })}>{scopes.map(item => <option key={item}>{item}</option>)}</Select>
                <Select size="sm" aria-label="Approver" value={entry.approver} onChange={event => patch({ assignments: flow.assignments.map((item, position) => (position === index ? { ...item, approver: event.target.value } : item)) })}>{REVIEWER_ROLES.map(role => <option key={role}>{role}</option>)}</Select>
                <Button size="xs" variant="link-danger" onClick={() => patch({ assignments: flow.assignments.filter((_, position) => position !== index) })}>Remove</Button>
              </div>
            ))}
          </div>
          <Button className="mt-2" onClick={() => patch({ assignments: [...flow.assignments, { scope: scopes[0] ?? '', approver: REVIEWER_ROLES[0] }] })}>+ Add assignment</Button>
        </div>
        <div className="border-t border-line-subtle pt-4"><Button variant="primary" onClick={() => run(() => { updateConfig(flowKey, draft => { Object.assign(draft, flow); }, `${title} updated`); }, `${title} saved`)}>Save {title.toLowerCase()}</Button></div>
      </CardBody>
    </Card>
  );
}

// D. Approval configuration for qualification and capability.
export default function ApprovalSettings() {
  useConfigRevision();
  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-2">
      <FlowCard flowKey="qualificationApproval" title="Qualification approval" description="Decision on the supplier qualification result"
        note="Central Approver approval is mandatory. A supplier cannot approve its own qualification, and the assessor cannot approve what they assessed (see Qualification & QSL)." />
      <FlowCard flowKey="capabilityApproval" title="Capability approval" description="Decision on submitted capabilities and product scope"
        note="Both Central Authority and Buyer approval are required. The sequence is configurable: choose Parallel or Sequential and reorder the steps." />
    </div>
  );
}
