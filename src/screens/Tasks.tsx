import { useState, type ReactNode } from 'react';
import Header from '../components/Header';
import { NewTaskModal } from '../components/NewTaskModal';
import ExportButton from '../components/ExportButton';
import { suppliers } from '../data/suppliers';
import { REVIEWER_ROLES, getConfig } from '../config';
import { getExternalSupplierId, listTransactions } from '../integration';
import { useIntegrationRevision } from '../integration/useIntegration';
import {
  TaskError, assignTask, completeTask, currentReviewerRole, getTask, getTaskSummary, listTasks, resendToPortal, reviewTask, simulatePortalResponse, startReview, statusOf,
} from '../tasks';
import type { Task, TaskActor, TaskStatus } from '../tasks';
import { useTasksRevision } from '../tasks/useTasks';
import {
  BackLink, Badge, Button, Callout, Card, CardBody, CardHeader, Checkbox, DetailGrid, EmptyState, Eyebrow, Field, Grid, HeadRow, KpiCard, KpiGrid, Page, PageContent, SearchInput, Select, Table, TableContainer, Td, Textarea, Toolbar, Tr, type Tone,
} from '../components/ui';

const STATUSES: TaskStatus[] = ['Draft', 'Assigned', 'In Progress', 'Submitted', 'Under Review', 'Returned', 'Approved', 'Rejected', 'Completed', 'Overdue'];
const statusTone: Record<TaskStatus, Tone> = {
  Draft: 'neutral', Assigned: 'info', 'In Progress': 'info', Submitted: 'brand', 'Under Review': 'brand', Returned: 'warning', Approved: 'success', Rejected: 'danger', Completed: 'success', Overdue: 'danger',
};
const formatDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const stamp = (value: string) => `${formatDate(value)} ${new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
const supplierName = (id: string) => suppliers.find(item => item.id === id)?.name ?? id;
const workflowText = (task: Task) => (task.workflow.type === 'Auto-accept' ? 'Auto-accept (no review)' : task.workflow.type === 'Two-step review' ? `Two-step review: ${task.workflow.reviewerRole}, then ${task.workflow.secondReviewerRole}` : `Single reviewer: ${task.workflow.reviewerRole}`);

function TaskDetail({ id, actor, roleSelect, onBack }: { id: string; actor: TaskActor; roleSelect: ReactNode; onBack: () => void }) {
  useTasksRevision();
  useIntegrationRevision();
  const task = getTask(id);
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const run = (action: () => unknown, success: string) => { try { action(); setNotice({ tone: 'success', text: success }); } catch (error) { setNotice({ tone: 'danger', text: error instanceof TaskError || error instanceof Error ? error.message : 'Something went wrong' }); } };
  const status = statusOf(task);
  const reviewer = currentReviewerRole(task);
  const awaitingReview = task.status === 'Submitted' || task.status === 'Under Review';
  const mine = awaitingReview && reviewer === actor.role;
  const latest = task.submissions[task.submissions.length - 1];
  const transactions = listTransactions({ supplierId: task.supplierId }).filter(tx => tx.internalRef === task.id);
  const external = getExternalSupplierId(task.supplierId);
  const canSimulate = task.status === 'Assigned' || task.status === 'In Progress' || task.status === 'Returned';

  return (
    <Page>
      <Header breadcrumb={['Supplier lifecycle', 'Supplier tasks', task.id]} title={task.title} extra={roleSelect} />
      <PageContent>
        <BackLink onClick={onBack}>Back to tasks</BackLink>
        {notice && <Callout tone={notice.tone} title={notice.text} />}
        {task.portalSync === 'Failed' && (
          <Callout tone="danger" title="The Supplier Portal did not receive this task" actions={<Button onClick={() => run(() => resendToPortal(actor, task.id), 'Resent to the Supplier Portal')}>Resend</Button>}>Check Administration → Integration → Logs for the error.</Callout>
        )}
        <Grid cols="split3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader title="Task details" actions={<Badge tone={statusTone[status]} dot>{status}</Badge>} />
              <CardBody>
                <DetailGrid items={[
                  { label: 'Task ID', value: <span className="font-mono">{task.id}</span> },
                  { label: 'Supplier', value: <span>{supplierName(task.supplierId)} <span className="font-mono text-caption text-ink-muted">{external}</span></span> },
                  { label: 'Task type', value: task.taskTypeName },
                  { label: 'Internal owner', value: task.owner },
                  { label: 'Due date', value: formatDate(task.dueDate) },
                  { label: 'Supplier Portal', value: task.portalSync ? <Badge small tone={task.portalSync === 'Sent' ? 'success' : 'danger'}>{task.portalSync === 'Sent' ? 'Delivered' : 'Delivery failed'}</Badge> : 'Not sent yet' },
                  { label: 'Review workflow', value: workflowText(task), wide: true },
                  { label: 'Instructions', value: task.instructions || '—', wide: true },
                  { label: 'Required forms', value: task.requiredForms || '—' },
                  { label: 'Required documents', value: task.requiredDocuments || '—' },
                ]} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Supplier response" description={latest ? `Revision ${latest.revision} · ${stamp(latest.submittedAt)} · ${latest.transactionId}` : 'Waiting for the supplier'} />
              <CardBody>
                {latest ? (
                  <div className="space-y-3 text-body">
                    {Object.entries(latest.answers).map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-line-subtle pb-2"><span className="text-ink-muted">{key}</span><span className="text-right text-ink">{value}</span></div>)}
                    {latest.files.length > 0 && <div className="flex flex-wrap gap-2">{latest.files.map(file => <Badge key={file} small>{file}</Badge>)}</div>}
                    {latest.note && <div className="text-ink-soft">{latest.note}</div>}
                    {!Object.keys(latest.answers).length && !latest.files.length && !latest.note && <span className="text-caption text-ink-muted">Response without attachments</span>}
                  </div>
                ) : <EmptyState title="No response yet" />}
              </CardBody>
            </Card>

            {task.reviews.length > 0 && (
              <Card>
                <CardHeader title="Review decisions" />
                <ul className="divide-y divide-line-subtle">{task.reviews.map((review, index) => (
                  <li key={index} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge small tone={review.decision === 'Approved' ? 'success' : review.decision === 'Returned' ? 'warning' : 'danger'}>{review.decision}</Badge><span className="text-body text-ink">Step {review.step} · {review.role}</span></div><span className="text-caption text-ink-muted">{review.by} · {stamp(review.at)} · response r{review.revision}</span></div>
                    {review.comment && <div className="mt-1 text-caption text-ink-soft">{review.comment}</div>}
                  </li>
                ))}</ul>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {task.status === 'Draft' && <Card padded><Button variant="primary" onClick={() => run(() => assignTask(actor, task.id), 'Assigned and sent to the Supplier Portal')}>Assign to supplier</Button></Card>}

            {awaitingReview && (
              <Card>
                <CardHeader title="Review" description={reviewer ? `Step ${task.reviewStep}: ${reviewer}` : undefined} />
                <CardBody className="space-y-3">
                  {!mine && <Callout tone="info" compact>Waiting for {reviewer}. You are acting as {actor.role}.</Callout>}
                  {mine && task.status === 'Submitted' && <Button onClick={() => run(() => startReview(actor, task.id), 'Review started')}>Start review</Button>}
                  {mine && (
                    <>
                      <Field label="Comment" hint="Required when returning or rejecting"><Textarea value={comment} onChange={event => setComment(event.target.value)} /></Field>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="primary" onClick={() => run(() => { reviewTask(actor, task.id, { decision: 'Approved', comment }); setComment(''); }, 'Approved')}>Approve</Button>
                        {task.workflow.allowReturn && <Button onClick={() => run(() => { reviewTask(actor, task.id, { decision: 'Returned', comment }); setComment(''); }, 'Returned to the supplier for correction')}>Return</Button>}
                        <Button variant="danger-soft" onClick={() => run(() => { reviewTask(actor, task.id, { decision: 'Rejected', comment }); setComment(''); }, 'Rejected')}>Reject</Button>
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>
            )}

            {task.status === 'Approved' && <Card padded><Button variant="primary" onClick={() => run(() => completeTask(actor, task.id), 'Task completed')}>Mark completed</Button></Card>}

            {canSimulate && (
              <Card>
                <CardHeader title="Mock Supplier Portal" description="Stands in for the supplier until the live portal is connected" />
                <CardBody className="flex flex-wrap gap-2">
                  {task.status === 'Assigned' && <Button onClick={() => run(() => simulatePortalResponse(task.id, { event: 'started' }), 'Supplier started the task')}>Supplier starts</Button>}
                  <Button onClick={() => run(() => simulatePortalResponse(task.id, { event: 'submitted', answers: { Response: `Revision ${task.submissions.length + 1}` }, files: [`response-r${task.submissions.length + 1}.pdf`], note: 'Submitted from the Supplier Portal' }), 'Supplier response received')}>Supplier submits</Button>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader title="History" />
              <ol className="space-y-3 p-5">{[...task.history].reverse().map((entry, index) => (
                <li key={index} className="border-l-2 border-brand-200 pl-3">
                  <div className="text-body font-medium text-ink">{entry.action}</div>
                  <div className="text-caption text-ink-muted">{entry.by} · {stamp(entry.at)}{entry.note ? ` · ${entry.note}` : ''}</div>
                </li>
              ))}</ol>
            </Card>

            {transactions.length > 0 && (
              <Card>
                <CardHeader title="Integration transactions" />
                <ul className="divide-y divide-line-subtle">{transactions.map(tx => (
                  <li key={tx.transactionId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-caption">
                    <div><div className="font-mono text-ink">{tx.transactionId}</div><div className="text-ink-muted">{tx.entityType} · {tx.direction}</div></div>
                    <Badge small dot tone={tx.status === 'Processed' ? 'success' : 'danger'}>{tx.status}</Badge>
                  </li>
                ))}</ul>
              </Card>
            )}
          </div>
        </Grid>
      </PageContent>
    </Page>
  );
}

// Supplier tasks: SLM creates and assigns tasks and reviews responses. The Supplier Portal receives and executes them.
export default function Tasks() {
  useTasksRevision();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState('Buyer');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [typeId, setTypeId] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const actor: TaskActor = { name: `${role} (demo)`, role };
  const summary = getTaskSummary();
  const rows = listTasks({ search, status: status || undefined, taskTypeId: typeId || undefined, reviewerRole: mineOnly ? role : undefined });

  const roleSelect = <Select aria-label="Acting as (demo)" value={role} onChange={event => setRole(event.target.value)}>{REVIEWER_ROLES.map(item => <option key={item} value={item}>Acting as: {item}</option>)}</Select>;
  if (selectedId) return <TaskDetail id={selectedId} actor={actor} roleSelect={roleSelect} onBack={() => setSelectedId(null)} />;

  return (
    <Page>
      <Header
        breadcrumb={['Supplier lifecycle']}
        title="Supplier tasks"
        extra={roleSelect}
      />
      <PageContent>
        <KpiGrid cols={5}>
          <KpiCard label="With supplier" value={summary.open} note="Assigned or in progress" tone="brand" />
          <KpiCard label="Awaiting review" value={summary.awaitingReview} note="Submitted by supplier" tone="warning" />
          <KpiCard label="Returned" value={summary.returned} note="Needs correction" />
          <KpiCard label="Overdue" value={summary.overdue} note="Past due date" tone={summary.overdue ? 'danger' : 'neutral'} />
          <KpiCard label="Completed" value={summary.completed} note="Approved or completed" tone="success" />
        </KpiGrid>
        <Toolbar actions={<><ExportButton filename="slm-supplier-tasks" columns={['Task', 'Title', 'Supplier ID', 'Supplier', 'Type', 'Due', 'Status']} rows={rows.map(task => [task.id, task.title, task.supplierId, supplierName(task.supplierId), task.taskTypeName, task.dueDate, statusOf(task)])} /><Button variant="primary" onClick={() => setCreating(true)}>+ New Task</Button></>}>
          <SearchInput placeholder="Search task, supplier, owner" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search tasks" />
          <Select aria-label="Status" value={status} onChange={event => setStatus(event.target.value as TaskStatus | '')}><option value="">All statuses</option>{STATUSES.map(item => <option key={item}>{item}</option>)}</Select>
          <Select aria-label="Task type" value={typeId} onChange={event => setTypeId(event.target.value)}><option value="">All task types</option>{getConfig('taskTypes').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <label className="flex items-center gap-2 text-caption text-ink-soft"><Checkbox checked={mineOnly} onChange={event => setMineOnly(event.target.checked)} />Awaiting my review</label>
        </Toolbar>
        <Card className="overflow-hidden">
          <TableContainer>
            <Table minWidth={1000}>
              <HeadRow columns={['Task', 'Supplier', 'Type', 'Due', 'Status', 'Reviewer', 'Portal', '']} />
              <tbody>{rows.map(task => {
                const state = statusOf(task);
                const reviewer = currentReviewerRole(task);
                return (
                  <Tr key={task.id}>
                    <Td><div className="font-medium text-ink">{task.title}</div><div className="font-mono text-caption text-ink-muted">{task.id}</div></Td>
                    <Td>{supplierName(task.supplierId)}<div className="font-mono text-caption text-ink-muted">{getExternalSupplierId(task.supplierId)}</div></Td>
                    <Td>{task.taskTypeName}</Td>
                    <Td className={state === 'Overdue' ? 'text-danger-700' : undefined}>{formatDate(task.dueDate)}</Td>
                    <Td><Badge tone={statusTone[state]} small dot>{state}</Badge></Td>
                    <Td className="text-caption">{task.workflow.type === 'Auto-accept' ? <span className="text-ink-muted">No review</span> : (task.status === 'Submitted' || task.status === 'Under Review') ? <span><Eyebrow>Step {task.reviewStep}</Eyebrow>{reviewer}</span> : <span className="text-ink-muted">{task.workflow.reviewerRole}</span>}</Td>
                    <Td>{task.portalSync ? <Badge small tone={task.portalSync === 'Sent' ? 'success' : 'danger'}>{task.portalSync === 'Sent' ? 'Delivered' : 'Failed'}</Badge> : <span className="text-ink-muted">—</span>}</Td>
                    <Td><Button size="xs" variant="link" onClick={() => setSelectedId(task.id)}>Open</Button></Td>
                  </Tr>
                );
              })}</tbody>
            </Table>
          </TableContainer>
          {rows.length === 0 && <EmptyState title="No tasks match" description="Adjust the filters or create a new task" />}
        </Card>
      </PageContent>
      {creating && <NewTaskModal actor={actor} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setSelectedId(id); }} />}
    </Page>
  );
}
