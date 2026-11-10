import { useState } from 'react';
import { getConfig, updateConfig } from '../../config';
import type { GeneralSettings as General } from '../../config';
import { Button, Card, CardBody, CardHeader, Field, Input, Select } from '../../components/ui';
import { ListEditor, NoticeBox, useAction, useConfigRevision } from './shared';

const TIME_ZONES = ['Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'UTC'];

// A. General settings: organization, business units, language, date and time.
export default function GeneralSettings() {
  useConfigRevision();
  const { notice, run } = useAction();
  const [form, setForm] = useState<General>(() => getConfig('general'));
  const [units, setUnits] = useState(() => getConfig('lists').businessUnits);
  const set = (patch: Partial<General>) => setForm(current => ({ ...current, ...patch }));

  return (
    <div className="max-w-3xl space-y-4">
      <NoticeBox notice={notice} />
      <Card>
        <CardHeader title="General settings" description="Organization, language and regional formats" />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Organization name" required><Input value={form.organization} onChange={event => set({ organization: event.target.value })} /></Field>
            <Field label="Legal entity" required><Input value={form.legalEntity} onChange={event => set({ legalEntity: event.target.value })} /></Field>
            <Field label="Language"><Select value={form.language} onChange={event => set({ language: event.target.value as General['language'] })}><option>English</option><option>Thai</option></Select></Field>
            <Field label="Date format"><Select value={form.dateFormat} onChange={event => set({ dateFormat: event.target.value as General['dateFormat'] })}><option>DD MMM YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></Select></Field>
            <Field label="Time zone" required><Select value={form.timeZone} onChange={event => set({ timeZone: event.target.value })}>{TIME_ZONES.map(item => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Default currency" required><Input value={form.currency} onChange={event => set({ currency: event.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="border-t border-line-subtle pt-4"><Button variant="primary" onClick={() => run(() => { updateConfig('general', draft => { Object.assign(draft, form); }, 'General settings updated'); }, 'General settings saved')}>Save general settings</Button></div>
        </CardBody>
      </Card>
      <ListEditor title="Business units" description="Used for ownership, access scope and reporting" items={units} onChange={setUnits}
        onSave={() => run(() => { updateConfig('lists', draft => { draft.businessUnits = units; }, 'Business units updated'); }, 'Business units saved')} />
    </div>
  );
}
