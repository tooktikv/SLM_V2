import { useState, type ReactNode } from 'react';
import type { Actor } from '../../qsl/types';
import { getCapabilityHistory, listCapabilities, type CapabilityRow } from '../../qsl/services/qslRegister';
import { categoriesFor } from '../../qsl/services/queries';
import { useQslQuery } from '../../qsl/useQsl';
import ExportButton from '../../components/ExportButton';
import { capabilityProfiles } from '../../data/capability';
import { BackLink, Badge, Button, Card, CardBody, CardHeader, DetailGrid, EmptyState, Grid, HeadRow, SearchInput, Select, Table, TableContainer, Td, Toolbar, Tr } from '../../components/ui';
import { CapabilityBadge, LevelBadge, formatDate } from './shared';

function CapabilityDetail({ actor, row, onBack, onOpen, onProfile }: { actor: Actor; row: CapabilityRow; onBack: () => void; onOpen: (id: string) => void; onProfile: (supplierId: string, tab?: string) => void }) {
  const history = useQslQuery(() => getCapabilityHistory(actor, row.id), [actor.id, row.id]).data ?? [];
  const profile = capabilityProfiles[row.supplierId];
  const approved = row.status === 'Approved';

  return (
    <div className="space-y-5">
      <BackLink onClick={onBack}>Back to Supplier Qualified List</BackLink>
      <Card padded>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-micro font-semibold uppercase tracking-wide text-ink-muted">{row.qslNo} · Round {row.round}</div>
            <h2 className="mt-1 text-lg font-semibold text-ink">{row.supplierName}</h2>
            <div className="mt-1 text-caption text-ink-muted">{row.category} · {row.scope}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><CapabilityBadge status={row.status} />{approved && <Badge small tone="neutral">Valid {formatDate(row.validFrom)} - {formatDate(row.validUntil)}</Badge>}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onOpen(row.id)}>Open qualification result</Button>
            <Button onClick={() => onProfile(row.supplierId, 'Capabilities')}>Open supplier profile</Button>
          </div>
        </div>
      </Card>

      <Grid cols={2}>
        <Card>
          <CardHeader title="Capability profile" description="Declared by the supplier and assessed by the buyer" />
          {profile ? (
            <CardBody className="space-y-5">
              <DetailGrid items={[
                { label: 'Product category / type', value: profile.product.categories.join(', ') }, { label: 'Product range', value: profile.product.range },
                { label: 'Product specification', value: profile.product.specification, wide: true },
              ]} />
              <DetailGrid items={[
                { label: 'Manufacturing process', value: profile.manufacturing.process }, { label: 'Production capacity', value: profile.manufacturing.capacity },
                { label: 'Machinery & equipment', value: profile.manufacturing.machinery.join(', '), wide: true },
              ]} />
              <DetailGrid items={[
                { label: 'Factory', value: profile.factory.name }, { label: 'Factory location', value: profile.factory.location }, { label: 'Facility information', value: profile.factory.facility, wide: true },
              ]} />
            </CardBody>
          ) : <EmptyState title="No capability profile submitted" />}
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader title="Skill rating" description="The supplier self-rating and the assessor rating are stored separately" />
            <TableContainer>
              <Table minWidth={520}>
                <HeadRow columns={['Skill category', 'Supplier self', 'Assessed']} />
                <tbody>{row.skills.map(skill => (
                  <Tr key={skill.skillId}><Td dense>{skill.name}</Td><Td dense><LevelBadge level={skill.self} /></Td><Td dense><LevelBadge level={skill.assessed} /></Td></Tr>
                ))}</tbody>
              </Table>
            </TableContainer>
            {row.skills.length === 0 && <EmptyState title="No skills assessed in this round" />}
          </Card>
          {profile && profile.rateCard.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Rate card" />
              <TableContainer><Table minWidth={400}><HeadRow columns={['Item', 'Unit', 'Rate']} /><tbody>{profile.rateCard.map(item => <Tr key={item.item}><Td dense>{item.item}</Td><Td dense className="text-ink-muted">{item.unit}</Td><Td dense>{item.rate}</Td></Tr>)}</tbody></Table></TableContainer>
            </Card>
          )}
        </div>
      </Grid>

      <Grid cols={2}>
        <Card>
          <CardHeader title="Review & approval" description="The Assessor rates the skills; the Buyer approves the capability" />
          <ol className="space-y-3 p-5 text-body">
            <li className="flex items-start justify-between gap-3"><div><div className="font-medium text-ink">Assessment</div><div className="text-caption text-ink-muted">{row.assessment ? `${row.assessment.by} · ${formatDate(row.assessment.at)}` : 'Not assessed yet'}</div></div><Badge small tone={row.assessment ? 'success' : 'neutral'}>{row.assessment ? 'Assessed' : 'Pending'}</Badge></li>
            <li className="flex items-start justify-between gap-3"><div><div className="font-medium text-ink">Buyer approval</div><div className="text-caption text-ink-muted">{row.buyerApproval ? `${row.buyerApproval.by} · ${formatDate(row.buyerApproval.at)}` : 'Not decided yet'}</div></div><Badge small tone={row.buyerApproval?.decision === 'Approve' ? 'success' : row.buyerApproval ? 'danger' : 'neutral'}>{row.buyerApproval ? (row.buyerApproval.decision === 'Approve' ? 'Approved' : row.buyerApproval.decision) : 'Pending'}</Badge></li>
          </ol>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Capability history" description="Assessed ratings per round and the change from the previous round" />
          <TableContainer>
            <Table minWidth={520}>
              <HeadRow columns={['Round', 'Assessed', 'Skill ratings']} />
              <tbody>{history.map(entry => (
                <Tr key={entry.id}>
                  <Td dense><div className="font-medium text-ink">Round {entry.round}</div><div className="font-mono text-caption text-ink-muted">{entry.qslNo}</div></Td>
                  <Td dense>{formatDate(entry.at)}</Td>
                  <Td dense><div className="flex flex-wrap gap-1">{entry.skills.map(skill => (
                    <Badge key={skill.skillId} small tone={skill.change > 0 ? 'success' : skill.change < 0 ? 'warning' : 'neutral'}>{skill.name} · {skill.assessed ?? '—'}{skill.change > 0 ? ' ▲' : skill.change < 0 ? ' ▼' : ''}</Badge>
                  ))}</div></Td>
                </Tr>
              ))}</tbody>
            </Table>
          </TableContainer>
          {history.length === 0 && <EmptyState title="No assessed ratings yet" />}
        </Card>
      </Grid>
    </div>
  );
}

// Qualified list: approved qualification and capability of each supplier by category and scope, in one place.
export function CapabilityTab({ actor, onOpen, onProfile, actions }: { actor: Actor; onOpen: (id: string) => void; onProfile: (supplierId: string, tab?: string) => void; actions?: ReactNode }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const query = useQslQuery(() => listCapabilities(actor, { search, category: category || undefined, status: 'Approved' }), [actor.id, search, category]);
  const rows = query.data?.rows ?? [];
  const detail = detailId ? rows.find(row => row.id === detailId) : undefined;

  if (detail) return <CapabilityDetail actor={actor} row={detail} onBack={() => setDetailId(null)} onOpen={onOpen} onProfile={onProfile} />;

  return (
    <div className="space-y-4">
      <Toolbar title="Qualified suppliers" description={`${rows.length} records`} actions={<><ExportButton filename="slm-qualified-suppliers" columns={['Supplier ID', 'Supplier', 'Category', 'Scope', 'Round', 'Status', 'Assessed skill rating', 'Valid from', 'Valid until']} rows={rows.map(row => [row.supplierId, row.supplierName, row.category, row.scope, row.round, row.status, row.skills.map(skill => `${skill.name}: ${skill.assessed ?? '-'}`).join('; '), row.validFrom, row.validUntil])} />{actions}</>}>
        <SearchInput placeholder="Search supplier, category, skill" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search capabilities" />
        <Select aria-label="Product category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categoriesFor().map(item => <option key={item}>{item}</option>)}</Select>
      </Toolbar>
      <Card className="overflow-hidden">
        <TableContainer>
          <Table minWidth={960}>
            <HeadRow columns={['Supplier', 'Category / Scope', 'Assessed skill rating', 'Status', 'Valid from - until', '']} />
            <tbody>{rows.map(row => (
              <Tr key={row.id}>
                <Td><div className="font-medium text-ink">{row.supplierName}</div><div className="text-caption text-ink-muted">{row.supplierId} · Round {row.round}</div></Td>
                <Td>{row.category}<div className="text-caption text-ink-muted">{row.scope}</div></Td>
                <Td><div className="flex flex-wrap gap-1">{row.skills.map(skill => <Badge key={skill.skillId} small tone={skill.assessed ? 'brand' : 'neutral'}>{skill.name} · {skill.assessed ?? '—'}</Badge>)}{row.skills.length === 0 && <span className="text-ink-muted">—</span>}</div></Td>
                <Td><CapabilityBadge status={row.status} /></Td>
                <Td>{row.validFrom ? `${formatDate(row.validFrom)} - ${formatDate(row.validUntil)}` : '—'}{row.daysLeft !== undefined && row.daysLeft >= 0 && row.daysLeft <= 60 && <div className="text-caption text-warning-700">{`${row.daysLeft} days left`}</div>}</Td>
                <Td><div className="flex gap-1.5"><Button size="xs" variant="link" onClick={() => setDetailId(row.id)}>Capability details</Button></div></Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        {rows.length === 0 && <EmptyState title="No qualified suppliers found" description="Suppliers appear here once a qualification round has been approved" />}
      </Card>
    </div>
  );
}
