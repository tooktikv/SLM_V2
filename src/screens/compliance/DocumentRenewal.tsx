import { useState } from 'react';
import ExportButton from '../../components/ExportButton';
import { RenewalAction } from '../../components/DocumentRenewal';
import { complianceCompanies, daysLabel, itemStatusLabel, type ComplianceItem, type ComplianceStatus } from '../../data/compliance';
import { openRenewalCount, useRenewals } from '../../data/renewals';
import { Badge, Button, Card, EmptyState, HeadRow, KpiCard, KpiGrid, Modal, SearchInput, Select, Table, TableContainer, Td, Toolbar, Tr, cx, type Tone } from '../../components/ui';

type Row = { key: string; supplierId: string; supplierName: string; item: ComplianceItem };
const statusTone: Record<ComplianceStatus, Tone> = { Verified: 'success', Expiring: 'warning', Expired: 'danger', Missing: 'danger', 'No data received': 'neutral', Pending: 'info' };

const documentRows = (): Row[] => complianceCompanies.flatMap(company => company.items.filter(item => item.group === 'Documents').map(item => ({ key: `${company.id}|${item.group}|${item.name}`, supplierId: company.id, supplierName: company.name, item })));

const remainingClass = (days: number | null) => (days !== null && days <= 30 ? 'text-danger-700' : days !== null && days <= 90 ? 'text-warning-700' : 'text-ink-muted');
const dueWithin = (item: ComplianceItem, days: number) => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= days;
const rowTint = (item: ComplianceItem) => (item.status === 'Expired' || item.status === 'Missing' ? 'bg-danger-50/40' : '');

// Every supplier document with its expiry, status and renewal request.
export function DocumentRenewal({ initialSearch = '' }: { initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<ComplianceStatus | ''>('');
  const [renewalWindow, setRenewalWindow] = useState('');
  const [preview, setPreview] = useState<Row | null>(null);
  useRenewals();
  const rows = documentRows();
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
        <KpiCard label="Due in 90 days" value={count(item => dueWithin(item, 90))} note="Renewal due list" tone="warning" />
        <KpiCard label="Expired" value={count(item => item.status === 'Expired')} note="Overdue" tone="danger" />
        <KpiCard label="Missing or no data" value={count(item => item.status === 'Missing' || item.status === 'No data received')} note="Not submitted or not reported" tone="danger" />
        <KpiCard label="Renewals requested" value={openRenewalCount()} note="Waiting for the supplier" tone="info" />
      </KpiGrid>
      <Toolbar title="Document renewal" description={`${visible.length} of ${rows.length} documents`} actions={<ExportButton filename="slm-document-register" columns={['Supplier ID', 'Supplier', 'Document', 'Type', 'Expiry date', 'Days left', 'Status', 'Source']} rows={visible.map(row => [row.supplierId, row.supplierName, row.item.name, row.item.type, row.item.expiry, row.item.daysLeft, row.item.status, row.item.source])} />}>
        <SearchInput placeholder="Search supplier or document" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-64" />
        <Select aria-label="Document status" value={status} onChange={event => setStatus(event.target.value as ComplianceStatus | '')}><option value="">All statuses</option>{(['Verified', 'Expiring', 'Expired', 'Missing', 'No data received'] as ComplianceStatus[]).map(item => <option key={item}>{item}</option>)}</Select>
        <Select aria-label="Renewal window" value={renewalWindow} onChange={event => setRenewalWindow(event.target.value)}><option value="">Any expiry</option><option value="30">Due within 30 days</option><option value="60">Due within 60 days</option><option value="90">Due within 90 days</option></Select>
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={1080}>
            <HeadRow columns={['Supplier', 'Document', 'Expiry date', 'Time remaining', 'Status', 'Renewal', 'Source', '']} />
            <tbody>{visible.map(row => (
              <Tr key={row.key} className={rowTint(row.item)}>
                <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="font-mono text-caption text-ink-muted">{row.supplierId}</div></Td>
                <Td>{row.item.name}<div className="text-caption text-ink-muted">{row.item.type}</div></Td>
                <Td className="whitespace-nowrap">{row.item.expiry}</Td>
                <Td className={cx('whitespace-nowrap font-medium', remainingClass(row.item.daysLeft))}>{daysLabel(row.item.daysLeft)}</Td>
                <Td><Badge small dot tone={statusTone[row.item.status]}>{itemStatusLabel(row.item)}</Badge></Td>
                <Td><RenewalAction supplierId={row.supplierId} supplierName={row.supplierName} item={row.item} /></Td>
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
          <p className="text-body text-ink-soft">{`The file is held by ${preview.item.source}. SLM opens it through an authorised link once the source integration provides one; no file is stored in this demo.`}</p>
          <div className="flex justify-end border-t border-line pt-4"><Button variant="primary" onClick={() => setPreview(null)}>Close</Button></div>
        </Modal>
      )}
    </div>
  );
}
