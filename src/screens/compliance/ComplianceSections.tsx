import { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import ExportButton from '../../components/ExportButton';
import { complianceCompanies, daysLabel, itemStatusLabel, needsAttention, type ComplianceItem, type ComplianceStatus } from '../../data/compliance';
import { Badge, Button, Card, CardHeader, EmptyState, HeadRow, KpiCard, KpiGrid, Modal, SearchInput, Select, Table, TableContainer, Td, Toolbar, Tr, cx, type Tone } from '../../components/ui';
import { suppliers } from '../../data/suppliers';
import { useNavigation } from '../../NavigationContext';

type Row = { key: string; supplierId: string; supplierName: string; item: ComplianceItem };
type FollowUp = 'Not started' | 'In progress' | 'Followed up' | 'Completed';
const followUps: FollowUp[] = ['Not started', 'In progress', 'Followed up', 'Completed'];
const statusTone: Record<ComplianceStatus, Tone> = { Verified: 'success', Expiring: 'warning', Expired: 'danger', Missing: 'danger', 'No data received': 'neutral', Pending: 'info' };

const rowsOf = (groups: ComplianceItem['group'][]): Row[] => complianceCompanies.flatMap(company => company.items.filter(item => groups.includes(item.group)).map(item => ({ key: `${company.id}|${item.group}|${item.name}`, supplierId: company.id, supplierName: company.name, item })));

// 7. Document Register: all supplier documents with expiry tracking, renewal windows, follow-up status and access.
export function DocumentRegister() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ComplianceStatus | ''>('');
  const [renewalWindow, setRenewalWindow] = useState('');
  const [followUp, setFollowUp] = useState<Record<string, FollowUp>>({});
  const [preview, setPreview] = useState<Row | null>(null);
  const rows = rowsOf(['Documents']);
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = rows
    .filter(row => !status || row.item.status === status)
    .filter(row => !renewalWindow || (row.item.daysLeft !== null && row.item.daysLeft <= Number(renewalWindow)))
    .filter(row => { const text = [row.supplierName, row.supplierId, row.item.name, row.item.type].join(' ').toLowerCase(); return tokens.every(token => text.includes(token)); })
    .sort((a, b) => (a.item.daysLeft ?? 9999) - (b.item.daysLeft ?? 9999));
  const count = (test: (item: ComplianceItem) => boolean) => rows.filter(row => test(row.item)).length;

  return (
    <div className="space-y-4">
      <KpiGrid cols={5}>
        <KpiCard label="Documents" value={rows.length} note="Tracked across suppliers" tone="brand" />
        <KpiCard label="Due in 90 days" value={count(item => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 90)} note="Renewal due list" tone="warning" />
        <KpiCard label="Expired" value={count(item => item.status === 'Expired')} note="Overdue" tone="danger" />
        <KpiCard label="Missing" value={count(item => item.status === 'Missing')} note="Not submitted" tone="danger" />
        <KpiCard label="No data received" value={count(item => item.status === 'No data received')} note="Source has no record" />
      </KpiGrid>
      <Toolbar title="Document register" description={`${visible.length} of ${rows.length} documents`} actions={<ExportButton filename="slm-document-register" columns={['Supplier ID', 'Supplier', 'Document', 'Type', 'Expiry date', 'Days left', 'Status', 'Source']} rows={visible.map(row => [row.supplierId, row.supplierName, row.item.name, row.item.type, row.item.expiry, row.item.daysLeft, row.item.status, row.item.source])} />}>
        <SearchInput placeholder="Search supplier or document" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-64" />
        <Select aria-label="Document status" value={status} onChange={event => setStatus(event.target.value as ComplianceStatus | '')}><option value="">All statuses</option>{(['Verified', 'Expiring', 'Expired', 'Missing', 'No data received'] as ComplianceStatus[]).map(item => <option key={item}>{item}</option>)}</Select>
        <Select aria-label="Renewal window" value={renewalWindow} onChange={event => setRenewalWindow(event.target.value)}><option value="">Any expiry</option><option value="30">Due within 30 days</option><option value="60">Due within 60 days</option><option value="90">Due within 90 days</option></Select>
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={1080}>
            <HeadRow columns={['Supplier', 'Document', 'Expiry date', 'Time remaining', 'Status', 'Renewal follow-up', 'Source', '']} />
            <tbody>{visible.map(row => (
              <Tr key={row.key} className={row.item.status === 'Expired' || row.item.status === 'Missing' ? 'bg-danger-50/40' : ''}>
                <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="font-mono text-caption text-ink-muted">{row.supplierId}</div></Td>
                <Td>{row.item.name}<div className="text-caption text-ink-muted">{row.item.type}</div></Td>
                <Td className="whitespace-nowrap">{row.item.expiry}</Td>
                <Td className={cx('whitespace-nowrap font-medium', row.item.daysLeft !== null && row.item.daysLeft <= 30 ? 'text-danger-700' : row.item.daysLeft !== null && row.item.daysLeft <= 90 ? 'text-warning-700' : 'text-ink-muted')}>{daysLabel(row.item.daysLeft)}</Td>
                <Td><Badge small dot tone={statusTone[row.item.status]}>{itemStatusLabel(row.item)}</Badge></Td>
                <Td>{needsAttention(row.item) ? <Select size="sm" aria-label={`Follow-up for ${row.item.name}`} value={followUp[row.key] ?? 'Not started'} onChange={event => setFollowUp(current => ({ ...current, [row.key]: event.target.value as FollowUp }))}>{followUps.map(item => <option key={item}>{item}</option>)}</Select> : <span className="text-caption text-ink-muted">Not needed</span>}</Td>
                <Td className="text-ink-muted">{row.item.source}</Td>
                <Td><Button size="xs" variant="link" disabled={row.item.status === 'Missing' || row.item.status === 'No data received'} onClick={() => setPreview(row)}>View / download</Button></Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {visible.length === 0 && <EmptyState title="No documents match these filters" />}
      </Card>
      {preview && (
        <Modal title={preview.item.name} eyebrow={`${preview.supplierName} · ${preview.item.type}`} onClose={() => setPreview(null)}>
          <p className="text-body text-ink-soft">The file is held by {preview.item.source}. SLM opens it through an authorised link once the source integration provides one; no file is stored in this demo.</p>
          <div className="flex justify-end border-t border-line pt-4"><Button variant="primary" onClick={() => setPreview(null)}>Close</Button></div>
        </Modal>
      )}
    </div>
  );
}

// MOCK: status history comes from the compliance source once connected.
const history = [
  { at: 'Sep 10, 2024', supplierId: 'SUP-0118', change: 'Compliance score 58% to 54%', reason: 'REACH declaration expired' },
  { at: 'Sep 8, 2024', supplierId: 'SUP-0012', change: 'Compliance score 80% to 82%', reason: 'ISO 9001 certificate renewed' },
  { at: 'Sep 5, 2024', supplierId: 'SUP-0034', change: 'Compliance score 78% to 76%', reason: 'RoHS declaration due within 60 days' },
  { at: 'Aug 30, 2024', supplierId: 'SUP-0051', change: 'Compliance score 89% to 91%', reason: 'Conflict minerals declaration verified' },
];

// 7. Findings & History: open compliance findings and the status history.
export function FindingsHistory() {
  const { openSupplier, navigate } = useNavigation();
  const findings = rowsOf(['Documents', 'Contracts', 'Audits', 'Questionnaires', 'Screening']).filter(row => row.item.status === 'Expired' || row.item.status === 'Missing' || row.item.status === 'No data received' || (row.item.status === 'Expiring' && (row.item.daysLeft ?? 99) <= 30));
  const open = (id: string) => { const supplier = suppliers.find(item => item.id === id); if (supplier) openSupplier(supplier, 'Compliance'); };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader title="Compliance findings" description="Expired, missing, no-data and items due within 30 days" actions={<ExportButton filename="slm-compliance-findings" columns={['Supplier', 'Finding', 'Tracking type', 'Status', 'Due', 'Owner']} rows={findings.map(row => [row.supplierName, row.item.name, row.item.group, itemStatusLabel(row.item), row.item.expiry, row.item.owner])} />} />
        <TableContainer>
          <Table minWidth={900}>
            <HeadRow columns={['Supplier', 'Finding', 'Tracking type', 'Status', 'Due', 'Owner', '']} />
            <tbody>{findings.map(row => (
              <Tr key={row.key}>
                <Td className="font-medium text-ink">{row.supplierName}</Td><Td>{row.item.name}</Td><Td><Badge small>{row.item.group}</Badge></Td>
                <Td><StatusBadge status={row.item.status === 'Expired' || row.item.status === 'Missing' ? 'Critical' : 'Medium Risk'} small /> <span className="text-caption text-ink-muted">{itemStatusLabel(row.item)}</span></Td>
                <Td>{daysLabel(row.item.daysLeft)}</Td><Td>{row.item.owner}</Td>
                <Td><div className="flex gap-2"><Button size="xs" variant="link" onClick={() => open(row.supplierId)}>Profile</Button><Button size="xs" variant="link-muted" onClick={() => navigate('car')}>Create corrective action</Button></div></Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {findings.length === 0 && <EmptyState title="No open findings" />}
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Compliance status history" description="Changes in each supplier's compliance score (demo data)" />
        <TableContainer>
          <Table minWidth={700}>
            <HeadRow columns={['Date', 'Supplier', 'Change', 'Reason']} />
            <tbody>{history.map(entry => <Tr key={`${entry.at}-${entry.supplierId}`}><Td className="whitespace-nowrap text-ink-muted">{entry.at}</Td><Td className="font-medium text-ink">{suppliers.find(item => item.id === entry.supplierId)?.name ?? entry.supplierId}</Td><Td>{entry.change}</Td><Td className="text-ink-soft">{entry.reason}</Td></Tr>)}</tbody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
}
