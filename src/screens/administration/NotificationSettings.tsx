import { useState } from 'react';
import { getConfig, newId, updateConfig } from '../../config';
import type { NotificationChannel, NotificationTemplate, NotificationTrigger } from '../../config';
import { Callout, Checkbox, Input, SegmentedControl, Select, Textarea } from '../../components/ui';
import { DraftTable, NoticeBox, useAction, useConfigRevision } from './shared';

type View = 'triggers' | 'templates';
const CHANNELS: NotificationChannel[] = ['In-app', 'Email'];
const parseDays = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean).map(Number);

// H. Notification settings: trigger events, recipients, reminder rules, and in-app / email templates.
export default function NotificationSettings() {
  useConfigRevision();
  const { notice, run, clear } = useAction();
  const [view, setView] = useState<View>('triggers');
  const [triggers, setTriggers] = useState<NotificationTrigger[]>(() => getConfig('triggers'));
  const [templates, setTemplates] = useState<NotificationTemplate[]>(() => getConfig('templates'));
  const [reminderText, setReminderText] = useState<Record<string, string>>(() => Object.fromEntries(getConfig('triggers').map(item => [item.id, item.reminderDays.join(', ')])));

  const saveTriggers = () => run(() => {
    const next = triggers.map(item => ({ ...item, reminderDays: parseDays(reminderText[item.id] ?? '') }));
    updateConfig('triggers', draft => { draft.splice(0, draft.length, ...next); }, 'Notification triggers updated');
    setTriggers(next);
  }, 'Notification triggers saved');

  return (
    <div className="space-y-4">
      <SegmentedControl<View> label="Notification settings" value={view} onChange={next => { setView(next); clear(); }} items={[{ value: 'triggers', label: 'Triggers, recipients & reminders' }, { value: 'templates', label: 'Message templates' }]} />
      <NoticeBox notice={notice} />
      {view === 'triggers' && (
        <DraftTable<NotificationTrigger> title="Trigger events" description="Reminders are days before the due or expiry date, from the earliest to the latest" rows={triggers} setRows={setTriggers} minWidth={1000}
          newRow={() => ({ id: newId('tg'), event: 'New event', enabled: true, channels: ['In-app'], recipients: 'Supplier owner', reminderDays: [] })}
          onSave={saveTriggers}
          columns={[
            { header: 'Event', render: (row, patch) => <Input aria-label="Event" value={row.event} onChange={event => patch({ event: event.target.value })} /> },
            { header: 'Enabled', render: (row, patch) => <Checkbox aria-label="Enabled" checked={row.enabled} onChange={event => patch({ enabled: event.target.checked })} /> },
            { header: 'Channels', render: (row, patch) => <div className="flex gap-3">{CHANNELS.map(channel => <label key={channel} className="flex items-center gap-1.5 text-caption text-ink-soft"><Checkbox checked={row.channels.includes(channel)} onChange={event => patch({ channels: event.target.checked ? [...row.channels, channel] : row.channels.filter(item => item !== channel) })} />{channel}</label>)}</div> },
            { header: 'Recipients', render: (row, patch) => <Input aria-label="Recipients" value={row.recipients} onChange={event => patch({ recipients: event.target.value })} /> },
            { header: 'Reminder days', render: row => <Input aria-label="Reminder days" className="w-32" placeholder="90, 60, 30" value={reminderText[row.id] ?? row.reminderDays.join(', ')} onChange={event => setReminderText(current => ({ ...current, [row.id]: event.target.value }))} /> },
          ]} />
      )}
      {view === 'templates' && (
        <>
          <Callout tone="info" compact>Use placeholders such as {'{{supplier}}'}, {'{{dueDate}}'} and {'{{status}}'}. A template needs a trigger that uses its channel.</Callout>
          <DraftTable<NotificationTemplate> title="Email and in-app templates" rows={templates} setRows={setTemplates} minWidth={1000}
            newRow={() => ({ id: newId('tp'), triggerId: triggers[0]?.id ?? '', channel: 'Email', subject: 'Subject', body: 'Message' })}
            onSave={() => run(() => { updateConfig('templates', draft => { draft.splice(0, draft.length, ...templates); }, 'Notification templates updated'); }, 'Templates saved')}
            columns={[
              { header: 'Trigger event', render: (row, patch) => <Select size="sm" aria-label="Trigger event" value={row.triggerId} onChange={event => patch({ triggerId: event.target.value })}>{triggers.map(item => <option key={item.id} value={item.id}>{item.event}</option>)}</Select> },
              { header: 'Channel', render: (row, patch) => <Select size="sm" aria-label="Channel" value={row.channel} onChange={event => patch({ channel: event.target.value as NotificationChannel })}>{CHANNELS.map(item => <option key={item}>{item}</option>)}</Select> },
              { header: 'Subject', render: (row, patch) => <Input aria-label="Subject" value={row.subject} onChange={event => patch({ subject: event.target.value })} /> },
              { header: 'Body', render: (row, patch) => <Textarea aria-label="Body" className="min-h-16" value={row.body} onChange={event => patch({ body: event.target.value })} /> },
            ]} />
        </>
      )}
    </div>
  );
}
