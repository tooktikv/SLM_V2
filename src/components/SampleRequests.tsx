import { Fragment, useState } from 'react';
import { daysLabel } from '../data/compliance';
import { isSampleOpen, samplePurposes, sampleStage, sampleStages, sampleStatuses, type SampleRequest, type SampleStatus } from '../data/samples';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import { NewSampleModal, SampleDetailPanel, sharedStatusTone } from './SampleActions';
import { sampleListFor, sharedSampleStatus } from '../samples';
import { useSamplesRevision } from '../samples/useSamples';
import { Badge, Button, CellStack, EmptyState, Eyebrow, HeadRow, KpiCard, KpiGrid, Pagination, SearchInput, Select, Stepper, Table, TableContainer, Td, Th, Toolbar, Tr, cx, toneFill, type StepState, type Tone } from './ui';

const PAGE_SIZE = 6;
const ALL_STATUSES = 'All statuses';
const ALL_PURPOSES = 'All purposes';
const OPEN_REQUESTS = 'Open requests';

export const sampleStatusTone: Record<SampleStatus, Tone> = { Requested: 'neutral', 'In transit': 'info', Received: 'info', 'Under testing': 'brand', Approved: 'success', Conditional: 'warning', Rejected: 'danger' };

function StageBar({ status }: { status: SampleStatus }) {
  const stage = sampleStage(status);
  return (
    <div role="img" aria-label={`Stage ${stage} of ${sampleStages.length}: ${sampleStages[stage - 1]}`} className="flex gap-0.5">
      {sampleStages.map((name, index) => <span key={name} className={cx('h-1.5 w-4 rounded-full', index < stage ? toneFill[sampleStatusTone[status]] : 'bg-line')} />)}
    </div>
  );
}

function stepsFor(sample: SampleRequest): { label: string; caption?: string; state: StepState }[] {
  const current = sampleStage(sample.status) - 1;
  const decided = current === sampleStages.length - 1;
  return sampleStages.map((label, index) => ({
    label,
    caption: index === sampleStages.length - 1 ? (decided ? sample.status : undefined) : index < current ? 'Completed' : index === current ? 'Current' : undefined,
    state: decided || index < current ? 'done' : index === current ? 'active' : 'todo',
  }));
}

// Stepper, tracking history and (unless read-only) the delivery and evaluation actions of one request.
export function SampleProgress({ sample, supplierId, readOnly }: { sample: SampleRequest; supplierId: string; readOnly?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Eyebrow className="mb-2">Progress</Eyebrow>
          <Stepper compact steps={stepsFor(sample)} />
        </div>
        <div className="lg:col-span-2">
          <Eyebrow>Tracking history</Eyebrow>
          <ol className="mt-1 space-y-1.5">
            {(sample.events ?? []).map(event => (
              <li key={`${event.date}-${event.event}`} className="flex gap-3 text-caption"><span className="w-24 shrink-0 text-ink-muted">{event.date}</span><span className="text-ink-soft">{event.event}</span></li>
            ))}
          </ol>
          {sample.evaluator && <div className="mt-3 text-caption text-ink-muted">Evaluator: {sample.evaluator}</div>}
        </div>
      </div>
      {!readOnly && <div className="mt-5 border-t border-line-subtle pt-4"><SampleDetailPanel sample={sample} supplierId={supplierId} /></div>}
    </>
  );
}

// readOnly = overview tracking only; requests are created and handled in Supplier Onboarding → Sample Request Tracking.
export default function SampleRequests({ samples: initialSamples, supplierId, readOnly }: { samples: SampleRequest[]; supplierId?: string; readOnly?: boolean }) {
  useSamplesRevision();
  const samples = supplierId ? sampleListFor(supplierId) : initialSamples;
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL_STATUSES);
  const [purpose, setPurpose] = useState(ALL_PURPOSES);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (id: string) => setExpanded(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));

  const NewRequestButton = readOnly ? null : <Button variant="primary" disabled={!supplierId} onClick={() => setCreating(true)}>+ New sample request</Button>;

  if (samples.length === 0) {
    return (
      <>
        <EmptyState title="No sample requests" description="Sample requests raised for this supplier will be listed here." action={NewRequestButton} />
        {creating && supplierId && <NewSampleModal supplierId={supplierId} onClose={() => setCreating(false)} />}
      </>
    );
  }

  const open = samples.filter(isSampleOpen);
  const overdue = open.filter(sample => sample.daysLeft !== null && sample.daysLeft < 0);
  const decided = samples.filter(sample => !isSampleOpen(sample));
  const approved = decided.filter(sample => sample.status === 'Approved').length;

  const term = search.trim().toLowerCase();
  const filtered = samples.filter(sample => {
    const matchesSearch = !term || [sample.id, sample.product, sample.spec, sample.requester].some(value => value.toLowerCase().includes(term));
    const matchesStatus = status === ALL_STATUSES || (status === OPEN_REQUESTS ? isSampleOpen(sample) : sample.status === status);
    const matchesPurpose = purpose === ALL_PURPOSES || sample.purpose === purpose;
    return matchesSearch && matchesStatus && matchesPurpose;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstShown = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;

  return (
    <div>
      <div className="p-5">
        <KpiGrid cols={4}>
          <KpiCard label="Total requests" value={samples.length} note="All time" tone="brand" size="md" />
          <KpiCard label="Open" value={open.length} note="Waiting for shipment, receipt or test result" tone="neutral" size="md" />
          <KpiCard label="Past required-by date" value={overdue.length} note={overdue.length ? 'Follow up with supplier' : 'None'} tone={overdue.length ? 'danger' : 'success'} size="md" />
          <KpiCard label="Approval rate" value={decided.length ? `${Math.round((approved / decided.length) * 100)}%` : '—'} note={`${approved} of ${decided.length} decided`} tone="success" size="md" />
        </KpiGrid>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line-subtle px-5 py-3">
        <Toolbar>
          <SearchInput value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="w-full sm:w-56" placeholder="Search request or product..." />
          <Select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option>{ALL_STATUSES}</option><option>{OPEN_REQUESTS}</option>{sampleStatuses.map(item => <option key={item}>{item}</option>)}
          </Select>
          <Select aria-label="Filter by purpose" value={purpose} onChange={event => { setPurpose(event.target.value); setPage(1); }}>
            <option>{ALL_PURPOSES}</option>{samplePurposes.map(item => <option key={item}>{item}</option>)}
          </Select>
        </Toolbar>
        {NewRequestButton}
      </div>

      <TableContainer>
        <Table minWidth={1280}>
          <HeadRow leading={<Th className="w-8 px-2"><span className="sr-only">Details</span></Th>} columns={['Request', 'Product / specification', 'Purpose', 'Requested by', 'Qty', 'Requested', 'Required by', 'Progress', 'Status', 'Result / note']} />
          <tbody>
            {visible.map(sample => {
              const late = sample.daysLeft !== null && sample.daysLeft < 0;
              const isExpanded = expanded.includes(sample.id);
              return (
                <Fragment key={sample.id}>
                  <Tr className={late ? 'bg-danger-50/40' : ''}>
                    <Td className="px-2">
                      {(sample.events || sample.typeId) && (
                        <button type="button" aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} tracking history of ${sample.id}`} onClick={() => toggle(sample.id)} className="rounded-sm p-0.5 text-ink-muted transition-colors hover:bg-sunken hover:text-ink">
                          {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                        </button>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-caption text-ink">{sample.id}</Td>
                    <Td><CellStack primary={sample.product} secondary={sample.spec} /></Td>
                    <Td className="whitespace-nowrap text-ink-soft">{sample.purpose}</Td>
                    <Td><CellStack primary={sample.requester} tone="plain" secondary={sample.department} /></Td>
                    <Td className="whitespace-nowrap">{sample.qty}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{sample.requested}</Td>
                    <Td className="whitespace-nowrap">
                      <div>{sample.required}</div>
                      {sample.daysLeft !== null && <div className={cx('mt-0.5 text-caption font-medium', late ? 'text-danger-700' : sample.daysLeft <= 7 ? 'text-warning-700' : 'text-ink-muted')}>{daysLabel(sample.daysLeft)}</div>}
                    </Td>
                    <Td><StageBar status={sample.status} /></Td>
                    <Td><Badge tone={sampleStatusTone[sample.status]} dot small>{sample.status}</Badge><div className="mt-1"><Badge tone={sharedStatusTone[sharedSampleStatus(sample)]} small>{sharedSampleStatus(sample)}</Badge></div></Td>
                    <Td className="max-w-64 text-ink-soft">{sample.note}</Td>
                  </Tr>
                  {isExpanded && (sample.events || sample.typeId) && (
                    <tr className="border-b border-line-subtle bg-canvas">
                      <td colSpan={11} className="px-5 py-4">
                        {supplierId ? <SampleProgress sample={sample} supplierId={supplierId} readOnly={readOnly} /> : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      </TableContainer>
      {filtered.length === 0 ? (
        <EmptyState title="No sample requests match these filters" description="Adjust the search, status or purpose to see more results." />
      ) : (
        <Pagination
          summary={`Showing ${firstShown}–${firstShown + visible.length - 1} of ${filtered.length} requests`}
          page={currentPage}
          pageCount={pageCount}
          onPrevious={() => setPage(currentPage - 1)}
          onNext={() => setPage(currentPage + 1)}
        />
      )}
      {creating && supplierId && <NewSampleModal supplierId={supplierId} onClose={() => setCreating(false)} />}
    </div>
  );
}
