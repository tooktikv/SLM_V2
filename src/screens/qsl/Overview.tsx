import { useState } from 'react';
import type { Actor } from '../../qsl/types';
import { can } from '../../qsl/rbac';
import { categoriesFor, getDetail, listDirectory, type DirectoryRow, type Standing } from '../../qsl/services/queries';
import { getQslSummary } from '../../qsl/services/qslRegister';
import { useQslQuery } from '../../qsl/useQsl';
import { Badge, Button, Card, CardBody, CardHeader, DetailGrid, EmptyState, HeadRow, KpiCard, KpiGrid, Modal, ProgressBar, SearchInput, Select, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { LevelBadge, StandingBadge, formatDate } from '../qualification/shared';
import { ScopeModal } from './modals';

const standings: Standing[] = ['Published', 'Expiring', 'Suspended', 'Expired', 'Withdrawn'];

function SupplierDetail({ actor, row, onClose, onProfile }: { actor: Actor; row: DirectoryRow; onClose: () => void; onProfile: (supplierId: string) => void }) {
  const data = useQslQuery(() => getDetail(actor, row.id), [actor.id, row.id]).data;
  return (
    <Modal title={row.supplierName} eyebrow={`${row.listingNo} · QSL supplier details`} badge={<StandingBadge standing={row.standing} />} onClose={onClose}>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Supplier information</h3>
        <DetailGrid items={[
          { label: 'Supplier ID', value: row.supplierId }, { label: 'Country', value: row.country },
          { label: 'Tax ID', value: data?.supplier.taxId ?? '—' }, { label: 'Product category', value: row.category },
        ]} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">QSL scope</h3>
        <DetailGrid items={[
          { label: 'Scope', value: `${row.scopeType}${row.scopeDetail ? ` · ${row.scopeDetail}` : ''}` }, { label: 'Qualification level', value: <LevelBadge level={row.level} /> },
          { label: 'Effective date', value: formatDate(row.effectiveDate) }, { label: 'Expiry date', value: formatDate(row.expiryDate) },
          { label: 'Published', value: `${formatDate(row.publishedAt)} · ${row.publishedBy}` }, { label: 'Scope changes', value: String(row.scopeChanges) },
        ]} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Qualification reference</h3>
        <DetailGrid items={[
          { label: 'Qualification no.', value: row.qslNo }, { label: 'Approved on', value: formatDate(data?.dates.approvedAt) },
          { label: 'Approver', value: data?.people.approver ?? '—' }, { label: 'Qualification expiry', value: formatDate(data?.dates.expiryDate) },
        ]} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Capability reference</h3>
        <div className="flex flex-wrap gap-2">{row.skills.length ? row.skills.map(skill => <Badge key={skill.skillId}>{skill.name} · Level {skill.level}</Badge>) : <span className="text-caption text-ink-muted">No verified skill rating</span>}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        {actor.role !== 'Buyer' && <Button onClick={() => onProfile(row.supplierId)}>Open supplier profile</Button>}
        <Button variant="primary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

// 5.1 QSL Overview & Register: dashboard counts by status, then the searchable register of published suppliers.
export function OverviewTab({ actor, onGo, onProfile }: { actor: Actor; onGo: (section: string) => void; onProfile: (supplierId: string) => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<Standing | ''>('');
  const [scopeRow, setScopeRow] = useState<DirectoryRow | null>(null);
  const [detailRow, setDetailRow] = useState<DirectoryRow | null>(null);
  const summary = useQslQuery(() => getQslSummary(actor), [actor.id]).data;
  const query = useQslQuery(() => listDirectory(actor, { search, category: category || undefined, status: status || undefined }), [actor.id, search, category, status]);
  const rows = query.data?.rows ?? [];
  const canManage = can(actor, 'enrollment.manage');
  const canPrepare = can(actor, 'qsl.publish');

  return (
    <div className="space-y-5">
      <KpiGrid cols={5}>
        <KpiCard label="Eligible" value={summary?.eligible ?? '—'} tone={summary?.eligible ? 'brand' : 'neutral'} note={canPrepare ? <Button size="xs" variant="inline" onClick={() => onGo('eligibility')}>Review eligibility</Button> : 'Approved, not yet published'} />
        <KpiCard label="Published" value={summary?.published ?? '—'} tone="success" note={summary ? `${summary.expiring} expiring soon` : undefined} />
        <KpiCard label="Pending" value={summary?.pending ?? '—'} tone="warning" note="Qualification / capability in progress" />
        <KpiCard label="Suspended" value={summary?.suspended ?? '—'} note={<Button size="xs" variant="inline" onClick={() => setStatus('Suspended')}>Filter register</Button>} />
        <KpiCard label="Expired" value={summary?.expired ?? '—'} tone={summary?.expired ? 'danger' : 'neutral'} note={<Button size="xs" variant="inline" onClick={() => setStatus('Expired')}>Filter register</Button>} />
      </KpiGrid>

      {summary && summary.byCategory.length > 0 && (
        <Card>
          <CardHeader title="Published suppliers by product category" />
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summary.byCategory.map(item => (
              <div key={item.category}>
                <div className="mb-1 flex justify-between text-caption"><span className="text-ink-soft">{item.category}</span><span className="font-semibold tabular-nums text-ink">{item.total}</span></div>
                <ProgressBar value={summary.published ? (item.total / summary.published) * 100 : 0} label={item.category} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Toolbar>
        <SearchInput placeholder="Search supplier ID, company, QSL ID" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search QSL" />
        <Select aria-label="Product category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categoriesFor().map(item => <option key={item}>{item}</option>)}</Select>
        <Select aria-label="QSL status" value={status} onChange={event => setStatus(event.target.value as Standing | '')}>
          <option value="">All statuses</option>{standings.map(item => <option key={item} value={item}>{item}{query.data ? ` (${query.data.counts[item]})` : ''}</option>)}
        </Select>
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={980}>
            <HeadRow columns={['QSL ID', 'Supplier', 'Category / Scope', 'Level / Verified skills', 'Effective - expiry', 'Status', '']} />
            <tbody>
              {rows.map(row => (
                <Tr key={row.id}>
                  <Td className="font-mono text-caption">{row.listingNo}</Td>
                  <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.supplierId} · {row.country}</div></Td>
                  <Td>{row.category}<div className="text-caption text-ink-muted">{row.scopeType}{row.scopeDetail ? ` · ${row.scopeDetail}` : ''}</div></Td>
                  <Td><div className="flex flex-wrap items-center gap-1"><LevelBadge level={row.level} />{row.skills.map(skill => <Badge key={skill.skillId} small>{skill.name} · {skill.level}</Badge>)}</div></Td>
                  <Td>{formatDate(row.effectiveDate)} - {formatDate(row.expiryDate)}<div className="text-caption text-ink-muted">{row.extensions ? `Renewed ${row.extensions}x` : `Validity ${row.validityMonths} months`}</div></Td>
                  <Td><StandingBadge standing={row.standing} /></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="xs" variant="link" onClick={() => setDetailRow(row)}>Details</Button>
                      {canManage && row.standing !== 'Withdrawn' && <Button size="xs" variant="link-muted" onClick={() => setScopeRow(row)}>Scope</Button>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState title="No suppliers in the QSL" description="Approved suppliers appear here once they are published (Publishing Management)" />}
      </Card>
      {scopeRow && <ScopeModal actor={actor} row={scopeRow} onClose={() => setScopeRow(null)} />}
      {detailRow && <SupplierDetail actor={actor} row={detailRow} onClose={() => setDetailRow(null)} onProfile={onProfile} />}
    </div>
  );
}
