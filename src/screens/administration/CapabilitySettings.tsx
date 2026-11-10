import { useState } from 'react';
import { getConfig, updateConfig } from '../../config';
import type { QslRules } from '../../config';
import { getSettings, getStore, staff, updateSettings } from '../../qsl';
import { Badge, Button, Callout, Card, CardBody, CardHeader, Checkbox, Input } from '../../components/ui';
import { NoticeBox, useAction, useConfigRevision } from './shared';

// 13.3 Capability & skill settings: skill rating scale and rules, skill categories, product categories and verification authority.
export default function CapabilitySettings() {
  useConfigRevision();
  const rules = useAction();
  const process = useAction();
  const [qsl, setQsl] = useState<QslRules>(() => getConfig('qsl'));
  const [useSkillLevel, setUseSkillLevel] = useState(() => getSettings().useSkillLevel);
  const approval = getConfig('capabilityApproval');
  const productCategories = getConfig('lists').productCategories.filter(item => item.active);
  const skills = getStore().criteriaGroups;

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Skill rating scale" description="Levels used for the supplier self-rating and the assessor rating" />
          <CardBody className="space-y-4">
            <NoticeBox notice={rules.notice} />
            {qsl.ratingScale.map((item, index) => (
              <div key={item.level} className="grid grid-cols-[4rem_1fr_2fr] items-center gap-3">
                <span className="text-caption font-semibold text-ink-muted">Level {item.level}</span>
                <Input aria-label={`Level ${item.level} label`} value={item.label} onChange={event => setQsl(current => ({ ...current, ratingScale: current.ratingScale.map((entry, position) => (position === index ? { ...entry, label: event.target.value } : entry)) }))} />
                <Input aria-label={`Level ${item.level} description`} value={item.description} onChange={event => setQsl(current => ({ ...current, ratingScale: current.ratingScale.map((entry, position) => (position === index ? { ...entry, description: event.target.value } : entry)) }))} />
              </div>
            ))}
            <div className="border-t border-line-subtle pt-4"><Button variant="primary" onClick={() => rules.run(() => { updateConfig('qsl', draft => { draft.ratingScale = qsl.ratingScale; }, 'Skill rating scale updated'); }, 'Rating scale saved')}>Save rating scale</Button></div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Skill rating rules" />
          <CardBody className="space-y-4">
            <NoticeBox notice={process.notice} />
            <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={useSkillLevel} onChange={event => setUseSkillLevel(event.target.checked)} />Use skill rating levels (rated by the assessor)</label>
            <div className="border-t border-line-subtle pt-4"><Button variant="primary" onClick={() => process.run(() => { updateSettings(staff.admin, { useSkillLevel }); }, 'Skill rating rules saved')}>Save rules</Button></div>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Skill categories" description="Skills are the criteria groups of the assessment forms" />
          <CardBody className="flex flex-wrap gap-2">
            {skills.map(skill => <Badge key={skill.id} tone={skill.active ? 'brand' : 'neutral'}>{skill.name}</Badge>)}
            {skills.length === 0 && <span className="text-caption text-ink-muted">No skill categories yet</span>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Product categories" description="Maintained in General → Master Data" />
          <CardBody className="flex flex-wrap gap-2">{productCategories.map(item => <Badge key={item.id}>{item.name}</Badge>)}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Verification and approval authority" description="Maintained in Workflow &amp; Approval → Approvals" />
          <CardBody className="space-y-2 text-body text-ink-soft">
            <div>{approval.mode} approval by:</div>
            <ul className="list-disc pl-5">{approval.steps.map(step => <li key={step.id}>{step.role}{step.required ? ' (required)' : ''}</li>)}</ul>
          </CardBody>
        </Card>
        <Callout tone="info" compact>Capability validity follows the qualification validity (Qualification → Qualification Settings).</Callout>
      </div>
    </div>
  );
}
