import { useState } from 'react';
import { getConfig, updateConfig } from '../../config';
import type { QslRules } from '../../config';
import { getSettings, rolesFor } from '../../qsl';
import { Badge, Button, Callout, Card, CardBody, CardHeader, Checkbox, DetailGrid } from '../../components/ui';
import { NoticeBox, useAction, useConfigRevision } from './shared';

const statuses = [
  { name: 'Eligible', note: 'Qualification and capability approved; waiting to be published' },
  { name: 'Published', note: 'Active on the QSL within its effective and expiry dates' },
  { name: 'Expiring', note: 'Published, inside the expiry reminder window' },
  { name: 'Expired', note: 'Past the QSL expiry date; requalification required' },
  { name: 'Suspended', note: 'Temporarily blocked; can be reinstated' },
  { name: 'Withdrawn', note: 'Removed from the QSL; can be republished if still eligible' },
];

// 13.4 QSL settings: eligibility, publishing, validity, renewal, suspension, reinstatement, withdrawal and statuses.
export default function QslSettings() {
  useConfigRevision();
  const rules = useAction();
  const [qsl, setQsl] = useState<QslRules>(() => getConfig('qsl'));
  const reminderDays = getSettings().reminderDays;
  const roles = (permission: Parameters<typeof rolesFor>[0]) => rolesFor(permission).join(', ');

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Eligibility and publishing" description="A supplier is published to the QSL only when every rule below is met" />
        <CardBody className="space-y-4">
          <NoticeBox notice={rules.notice} />
          <Callout tone="info" compact>Mandatory: Supplier Qualification = Approved AND the relevant Capability = Approved. Only approved capabilities become approved QSL scope.</Callout>
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={qsl.pendingCapabilityInvalidatesApproved} onChange={event => setQsl(current => ({ ...current, pendingCapabilityInvalidatesApproved: event.target.checked }))} />A pending new capability makes the supplier not eligible until it is decided</label>
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={qsl.autoPublish} onChange={event => setQsl(current => ({ ...current, autoPublish: event.target.checked }))} />Publish automatically when eligible</label>
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={qsl.requirePublisherConfirmation} disabled={qsl.autoPublish} onChange={event => setQsl(current => ({ ...current, requirePublisherConfirmation: event.target.checked }))} />Require confirmation before publishing</label>
          <label className="flex items-center gap-2 text-body text-ink-soft"><Checkbox checked={qsl.publishToPortal} onChange={event => setQsl(current => ({ ...current, publishToPortal: event.target.checked }))} />Send published QSL status to the Supplier Portal</label>
          <div className="border-t border-line-subtle pt-4"><Button variant="primary" onClick={() => rules.run(() => { updateConfig('qsl', draft => { Object.assign(draft, qsl); }, 'QSL rules updated'); }, 'QSL rules saved')}>Save QSL rules</Button></div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Roles and maintenance rules" description="Derived from role permissions; every action needs a reason and is logged" />
          <CardBody>
            <DetailGrid columns={1} items={[
              { label: 'Publish to QSL', value: roles('qsl.publish') }, { label: 'Change scope', value: roles('enrollment.manage') },
              { label: 'Renew validity, suspend, reinstate, withdraw', value: roles('monitoring.manage') },
              { label: 'Expiry reminder', value: `${reminderDays} days before expiry (Qualification Settings)` },
              { label: 'Validity', value: 'Effective and expiry dates are set at publishing; the expiry cannot be after the qualification expiry' },
            ]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="QSL statuses" />
          <ul className="divide-y divide-line-subtle">{statuses.map(item => <li key={item.name} className="flex items-start gap-3 px-5 py-2.5"><Badge small className="mt-0.5">{item.name}</Badge><span className="text-caption text-ink-soft">{item.note}</span></li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
