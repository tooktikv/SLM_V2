import { useState } from 'react';
import { getSettings, staff, updateSettings } from '../../qsl';
import { Button, Callout, Card, CardBody, CardHeader, Checkbox, Field, Input } from '../../components/ui';
import { NoticeBox, useAction, useConfigRevision } from './shared';

// 13.2 Qualification settings: validity, requalification and process rules. Criteria are managed in "Qualification Criteria".
export default function QualificationSettings() {
  useConfigRevision();
  const process = useAction();
  const [settings, setSettings] = useState(() => getSettings());
  const setMonths = (category: string, months: number) => setSettings(current => ({ ...current, validityMonthsByCategory: { ...current.validityMonthsByCategory, [category]: months } }));

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader title="Qualification validity and requalification" description="Applies to new approvals only. Stored expiry dates are not recomputed." />
        <CardBody className="space-y-5">
          <NoticeBox notice={process.notice} />
          <div>
            <div className="mb-2 text-caption font-medium text-ink-soft">Validity by product category (months)</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(settings.validityMonthsByCategory).map(([category, months]) => (
                <Field key={category} label={category}><Input type="number" min={1} max={60} value={months} onChange={event => setMonths(category, Number(event.target.value))} /></Field>
              ))}
            </div>
          </div>
          <Field label="Expiry reminder (days before expiry)" hint="Used for qualification, capability and QSL expiry alerts"><Input type="number" min={1} value={settings.reminderDays} onChange={event => setSettings(current => ({ ...current, reminderDays: Number(event.target.value) }))} /></Field>
          <div>
            <div className="mb-2 text-caption font-medium text-ink-soft">Requalification triggers</div>
            <div className="space-y-2">{Object.entries(settings.reassessmentTriggers).map(([trigger, enabled]) => (
              <label key={trigger} className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={enabled} onChange={event => setSettings(current => ({ ...current, reassessmentTriggers: { ...current.reassessmentTriggers, [trigger]: event.target.checked } }))} />{trigger}</label>
            ))}</div>
          </div>
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={settings.separateAssessorApprover} onChange={event => setSettings(current => ({ ...current, separateAssessorApprover: event.target.checked }))} />Assessor and approver must be different people</label>
          <div className="border-t border-line-subtle pt-4"><Button variant="primary" onClick={() => process.run(() => { updateSettings(staff.admin, { validityMonthsByCategory: settings.validityMonthsByCategory, reminderDays: settings.reminderDays, reassessmentTriggers: settings.reassessmentTriggers, separateAssessorApprover: settings.separateAssessorApprover }); }, 'Qualification settings saved')}>Save qualification settings</Button></div>
        </CardBody>
      </Card>
      <Callout tone="info" compact>Standard and Buyer custom criteria are managed in Qualification → Qualification Criteria. Skill rating levels are managed in Capability &amp; Skills.</Callout>
    </div>
  );
}
