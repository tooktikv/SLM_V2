import { useState } from 'react';
import { listChanges } from '../../config';
import { demoActors } from '../../qsl/actors';
import { listApprovalLog, listAuditLog, listProcessSettingsHistory } from '../../qsl/services/qslRegister';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Card, CardHeader, EmptyState, HeadRow, SearchInput, SegmentedControl, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { useConfigRevision } from './shared';
import { formatDate } from '../qualification/shared';

type View = 'activity' | 'changes' | 'approvals' | 'configuration' | 'access';

// MOCK: sign-in and data-access events come from the identity provider, which is not connected yet.
const accessLog = [
  { at: '2026-10-12T09:18:00Z', user: 'Sophie Chen', record: 'Supplier SUP-0012', via: 'Supplier profile', scope: 'Assigned suppliers' },
  { at: '2026-10-11T16:34:00Z', user: 'Marcus Patel', record: 'Qualification report', via: 'Export', scope: 'All business units' },
  { at: '2026-10-11T14:02:00Z', user: 'Laura Torres', record: 'Risk register', via: 'Risk Management', scope: 'Own business unit' },
];

const stamp = (value: string) => `${formatDate(value)} ${new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`;
const short = (value: unknown) => (value === null || value === undefined ? '—' : typeof value === 'string' ? value : JSON.stringify(value).slice(0, 90));

// 13.7 Audit logs & system governance.
export default function AuditLogs() {
  useConfigRevision();
  const admin = demoActors.Admin;
  const [view, setView] = useState<View>('activity');
  const [search, setSearch] = useState('');
  const audit = useQslQuery(() => listAuditLog(admin), []).data ?? [];
  const approvals = useQslQuery(() => listApprovalLog(admin), []).data ?? [];
  const processChanges = useQslQuery(() => listProcessSettingsHistory(admin), []).data ?? [];
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (...parts: (string | undefined)[]) => { const text = parts.join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); };
  const configuration = [
    ...listChanges().map(item => ({ at: item.at, area: `Config · ${item.section}`, summary: item.summary, by: 'Administrator' })),
    ...processChanges.map(item => ({ at: item.at, area: 'Qualification process', summary: item.summary, by: item.by })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-4">
      <Toolbar>
        <SegmentedControl<View> label="Audit log view" value={view} onChange={setView} items={[
          { value: 'activity', label: 'User activity' }, { value: 'changes', label: 'Data changes' }, { value: 'approvals', label: 'Approvals' },
          { value: 'configuration', label: 'Configuration' }, { value: 'access', label: 'Data access' },
        ]} />
        <SearchInput placeholder="Search log" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search audit log" />
      </Toolbar>
      <Card className="overflow-hidden">
        {view === 'activity' && (<>
          <CardHeader title="User activity logs" description="Actions performed by users in SLM" />
          <TableContainer><Table minWidth={760}><HeadRow columns={['Timestamp', 'User', 'Role', 'Action', 'Record']} /><tbody>
            {audit.filter(item => hit(item.action, item.recordRef, item.performedBy, item.remarks)).map(item => <Tr key={item.id}><Td className="whitespace-nowrap text-ink-muted">{stamp(item.performedAt)}</Td><Td>{item.performedBy}</Td><Td><Badge small>{item.performedByRole}</Badge></Td><Td>{item.action}{item.remarks ? <div className="text-caption text-ink-muted">{item.remarks}</div> : null}</Td><Td className="font-mono text-caption text-brand-700">{item.recordRef}</Td></Tr>)}
          </tbody></Table></TableContainer>
          {audit.length === 0 && <EmptyState title="No activity recorded" />}
        </>)}
        {view === 'changes' && (<>
          <CardHeader title="Record change history" description="Previous and new values of changed records" />
          <TableContainer><Table minWidth={860}><HeadRow columns={['Timestamp', 'Record', 'Change', 'Previous value', 'New value', 'By']} /><tbody>
            {audit.filter(item => (item.previousValue !== null || item.newValue !== null) && hit(item.action, item.recordRef, item.recordType)).map(item => <Tr key={item.id}><Td className="whitespace-nowrap text-ink-muted">{stamp(item.performedAt)}</Td><Td className="font-mono text-caption text-brand-700">{item.recordRef}</Td><Td>{item.action}</Td><Td className="max-w-48 truncate text-caption text-ink-muted">{short(item.previousValue)}</Td><Td className="max-w-48 truncate text-caption text-ink-soft">{short(item.newValue)}</Td><Td>{item.performedBy}</Td></Tr>)}
          </tbody></Table></TableContainer>
        </>)}
        {view === 'approvals' && (<>
          <CardHeader title="Approval activity history" description="Qualification approvals, rejections and returns" />
          <TableContainer><Table minWidth={760}><HeadRow columns={['Timestamp', 'Qualification', 'Supplier', 'Decision', 'By', 'Reason']} /><tbody>
            {approvals.filter(item => hit(item.qslNo, item.supplierName, item.byName, item.reason)).map(item => <Tr key={item.id}><Td className="whitespace-nowrap text-ink-muted">{stamp(item.at)}</Td><Td className="font-mono text-caption">{item.qslNo}</Td><Td>{item.supplierName}<div className="text-caption text-ink-muted">{item.category}</div></Td><Td><Badge small tone={item.decision === 'Approve' ? 'success' : item.decision === 'Reject' ? 'danger' : 'warning'}>{item.decision}</Badge></Td><Td>{item.byName}</Td><Td className="max-w-64 text-caption text-ink-soft">{item.reason}</Td></Tr>)}
          </tbody></Table></TableContainer>
          {approvals.length === 0 && <EmptyState title="No approvals recorded" />}
        </>)}
        {view === 'configuration' && (<>
          <CardHeader title="Settings change history" description="Changes made in Administration" />
          <TableContainer><Table minWidth={640}><HeadRow columns={['Timestamp', 'Area', 'Change', 'By']} /><tbody>
            {configuration.filter(item => hit(item.area, item.summary, item.by)).map((item, index) => <Tr key={`${item.at}-${index}`}><Td className="whitespace-nowrap text-ink-muted">{stamp(item.at)}</Td><Td>{item.area}</Td><Td>{item.summary}</Td><Td>{item.by}</Td></Tr>)}
          </tbody></Table></TableContainer>
          {configuration.length === 0 && <EmptyState title="No settings changed in this session" />}
        </>)}
        {view === 'access' && (<>
          <CardHeader title="Data access history" description="Who viewed or exported protected data (demo data)" />
          <TableContainer><Table minWidth={640}><HeadRow columns={['Timestamp', 'User', 'Record', 'Accessed via', 'Data scope']} /><tbody>
            {accessLog.filter(item => hit(item.user, item.record, item.via)).map(item => <Tr key={item.at}><Td className="whitespace-nowrap text-ink-muted">{stamp(item.at)}</Td><Td>{item.user}</Td><Td>{item.record}</Td><Td>{item.via}</Td><Td>{item.scope}</Td></Tr>)}
          </tbody></Table></TableContainer>
        </>)}
      </Card>
    </div>
  );
}
