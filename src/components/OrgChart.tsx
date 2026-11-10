import { useState } from 'react';
import { engagementLabel, flattenOrg, unregisteredEntities, type OrgEngagement, type OrgNode, type OrgRelation, type OrgSource } from '../data/organization';
import { Badge, Button, Callout, Card, CardBody, CardHeader, DetailGrid, Eyebrow, Grid, ProgressBar, cx, type Tone } from './ui';

const relationTone: Record<OrgRelation, Tone> = { 'Ultimate parent': 'neutral', Subsidiary: 'info', Affiliate: 'warning', 'Plant / branch': 'neutral' };
const engagementTone: Record<OrgEngagement, Tone> = { Contracting: 'brand', Supplying: 'info', Invoicing: 'success' };
const engagementShort: Record<OrgEngagement, string> = { Contracting: 'Contract', Supplying: 'Supply', Invoicing: 'Invoice' };
const sourceTone: Record<OrgSource, Tone> = { 'D&B family tree': 'info', 'ERP vendor master': 'brand', 'Supplier declared': 'warning', 'Manual entry': 'neutral' };

function NodeCard({ node, selected, onSelect }: { node: OrgNode; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cx(
        'w-52 rounded-card border p-3 text-left shadow-card transition-colors hover:border-brand-300',
        node.current ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
        selected && 'ring-2 ring-brand-500',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={relationTone[node.relation]} small>{node.relation}</Badge>
        {node.ownership !== undefined && <span className="text-micro tabular-nums text-ink-muted">{node.ownership}% owned</span>}
      </div>
      <div className="mt-2 text-body font-semibold text-ink">{node.name}</div>
      <div className="mt-0.5 text-caption text-ink-muted">{node.country} · {node.focus}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {node.engagement.length > 0
          ? node.engagement.map(item => <Badge key={item} tone={engagementTone[item]} small>{engagementShort[item]}</Badge>)
          : <span className="text-micro text-ink-muted">No direct dealing</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line-subtle pt-2 text-micro">
        {node.supplierId ? <span className="font-mono text-ink-soft">{node.supplierId}</span> : <span className="text-ink-muted">{node.relation === 'Plant / branch' ? 'Site of parent entity' : 'Not in SLM'}</span>}
        <span className={node.verified ? 'text-success-700' : 'text-warning-700'}>{node.verified ? 'Verified' : 'Unverified'}</span>
      </div>
    </button>
  );
}

function Branch({ node, selectedId, onSelect }: { node: OrgNode; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <li>
      <NodeCard node={node} selected={node.id === selectedId} onSelect={() => onSelect(node.id)} />
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map(child => <Branch key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />)}
        </ul>
      )}
    </li>
  );
}

export default function OrgChart({ root, onOpenSupplier, onStartOnboarding }: { root: OrgNode; onOpenSupplier: (id: string) => void; onStartOnboarding: () => void }) {
  const nodes = flattenOrg(root);
  const [selectedId, setSelectedId] = useState(() => (nodes.find(node => node.current) ?? root).id);
  const selected = nodes.find(node => node.id === selectedId) ?? root;
  const verifiedCount = nodes.filter(node => node.verified).length;
  const unregistered = unregisteredEntities(root);
  const sources = [...new Set(nodes.map(node => node.source))];

  return (
    <Grid cols="split3">
      <Card className="overflow-hidden xl:col-span-2">
        <CardHeader
          title="Organization structure"
          description="Group hierarchy and the legal entities we deal with"
          actions={<><Button variant="link">Request update from supplier</Button><Button variant="link">+ Add entity</Button></>}
        />
        <CardBody className="space-y-4">
          <div className="overflow-x-auto pb-2">
            <div className="mx-auto w-max">
              <ul className="org-tree">
                <Branch node={root} selectedId={selected.id} onSelect={setSelectedId} />
              </ul>
            </div>
          </div>

          {unregistered.length > 0 && (
            <Callout tone="warning" title="Entities not registered in SLM" compact actions={<Button size="xs" onClick={onStartOnboarding}>Start onboarding</Button>}>
              {unregistered.map(node => `${node.name} (${node.focus.toLowerCase()})`).join(', ')} {unregistered.length === 1 ? 'is' : 'are'} used in supply but {unregistered.length === 1 ? 'has' : 'have'} no supplier record.
            </Callout>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
            <div className="flex items-center gap-3">
              <Eyebrow>Structure confidence</Eyebrow>
              <ProgressBar value={Math.round((verifiedCount / nodes.length) * 100)} tone={verifiedCount === nodes.length ? 'success' : 'warning'} label="Verified entities" className="w-24" />
              <span className="text-caption text-ink-muted">{verifiedCount} of {nodes.length} entities verified</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>Sources</Eyebrow>
              {sources.map(source => <Badge key={source} tone={sourceTone[source]} small>{source}</Badge>)}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={selected.name} description={selected.current ? 'Company being viewed' : 'Selected entity'} />
        <CardBody className="space-y-5">
          <DetailGrid
            columns={1}
            items={[
              { label: 'Relationship', value: <Badge tone={relationTone[selected.relation]} small>{selected.relation}</Badge> },
              { label: 'Ownership', value: selected.ownership !== undefined ? `${selected.ownership}% held by parent` : '—' },
              { label: 'Country · focus', value: `${selected.country} · ${selected.focus}` },
              { label: 'How we deal with it', value: selected.engagement.length > 0 ? <div className="flex flex-wrap gap-1.5">{selected.engagement.map(item => <Badge key={item} tone={engagementTone[item]} small>{engagementLabel[item]}</Badge>)}</div> : 'No direct dealing' },
              { label: 'SLM record', value: selected.supplierId ? <span className="font-mono">{selected.supplierId}</span> : selected.relation === 'Plant / branch' ? 'Covered by the parent supplier record' : 'Not registered' },
              { label: 'Data source', value: <div className="flex flex-wrap items-center gap-1.5"><Badge tone={sourceTone[selected.source]} small>{selected.source}</Badge><Badge tone={selected.verified ? 'success' : 'warning'} small>{selected.verified ? 'Verified' : 'Needs verification'}</Badge></div> },
            ]}
          />
          {selected.supplierId && !selected.current && <Button className="w-full" onClick={() => onOpenSupplier(selected.supplierId!)}>Open supplier profile</Button>}
          {!selected.supplierId && selected.relation !== 'Plant / branch' && selected.engagement.length > 0 && <Button className="w-full" onClick={onStartOnboarding}>Start onboarding</Button>}
          {!selected.verified && <Button variant="link">Request verification</Button>}
        </CardBody>
      </Card>
    </Grid>
  );
}
