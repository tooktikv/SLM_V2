import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { ConfigError, getRevision, subscribe } from '../../config';
import type { ListItem } from '../../config';
import { Button, Callout, Card, CardHeader, Checkbox, EmptyState, HeadRow, Input, Table, TableContainer, Td, Tr } from '../../components/ui';

export const useConfigRevision = () => useSyncExternalStore(subscribe, getRevision);

export type Notice = { tone: 'danger' | 'success'; text: string; details?: string[] } | null;

// Runs a configuration change and turns validation errors into a notice.
export function useAction() {
  const [notice, setNotice] = useState<Notice>(null);
  const run = (action: () => void, success = 'Saved'): boolean => {
    try { action(); setNotice({ tone: 'success', text: success }); return true; }
    catch (error) {
      if (error instanceof ConfigError) setNotice({ tone: 'danger', text: 'Cannot save', details: error.details });
      else setNotice({ tone: 'danger', text: error instanceof Error ? error.message : 'Something went wrong' });
      return false;
    }
  };
  return { notice, run, clear: () => setNotice(null) };
}

export function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <Callout tone={notice.tone} title={notice.text}>{notice.details && <ul className="list-disc pl-4">{notice.details.map(line => <li key={line}>{line}</li>)}</ul>}</Callout>;
}

export type Column<T> = { header: string; render: (row: T, patch: (change: Partial<T>) => void, index: number) => ReactNode };

// Editable table that works on a local copy until Save is pressed.
export function DraftTable<T extends { id: string }>({ title, description, rows, setRows, columns, newRow, onSave, footer, minWidth = 760, locked }: {
  title: string;
  description?: string;
  rows: T[];
  setRows: (rows: T[]) => void;
  columns: Column<T>[];
  newRow: () => T;
  onSave: () => void;
  footer?: ReactNode;
  minWidth?: number;
  locked?: (row: T) => boolean;
}) {
  const patch = (index: number, change: Partial<T>) => setRows(rows.map((row, position) => (position === index ? { ...row, ...change } : row)));
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} description={description} actions={<Button onClick={() => setRows([...rows, newRow()])}>+ Add</Button>} />
      <TableContainer>
        <Table minWidth={minWidth}>
          <HeadRow columns={[...columns.map(column => column.header), '']} />
          <tbody>{rows.map((row, index) => (
            <Tr key={row.id}>
              {columns.map(column => <Td key={column.header} dense>{column.render(row, change => patch(index, change), index)}</Td>)}
              <Td dense>{!locked?.(row) && <Button size="xs" variant="link-danger" onClick={() => setRows(rows.filter((_, position) => position !== index))}>Remove</Button>}</Td>
            </Tr>
          ))}</tbody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <EmptyState title="Nothing configured yet" />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle px-5 py-3">
        <div className="text-caption text-ink-muted">{footer}</div>
        <Button variant="primary" onClick={onSave}>Save changes</Button>
      </div>
    </Card>
  );
}

// Simple list of names that can be enabled, disabled, renamed or removed.
export function ListEditor({ title, description, items, onChange, onSave }: { title: string; description?: string; items: ListItem[]; onChange: (items: ListItem[]) => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const add = () => { if (!name.trim()) return; onChange([...items, { id: `new-${Date.now().toString(36)}-${items.length}`, name: name.trim(), active: true }]); setName(''); };
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <ul className="divide-y divide-line-subtle">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
            <Input aria-label={`${title}: ${item.name}`} className="max-w-xs" value={item.name} disabled={item.locked} onChange={event => onChange(items.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)))} />
            <label className="flex items-center gap-2 text-caption text-ink-soft"><Checkbox checked={item.active} disabled={item.locked} onChange={event => onChange(items.map((entry, position) => (position === index ? { ...entry, active: event.target.checked } : entry)))} />Active</label>
            {item.locked ? <span className="text-caption text-ink-muted">System value</span> : <Button size="xs" variant="link-danger" onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove</Button>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle px-5 py-3">
        <Input aria-label={`New ${title}`} className="max-w-xs" placeholder="New value" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') add(); }} />
        <Button onClick={add}>Add</Button>
        <div className="ml-auto"><Button variant="primary" onClick={onSave}>Save changes</Button></div>
      </div>
    </Card>
  );
}
