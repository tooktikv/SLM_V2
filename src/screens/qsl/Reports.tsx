import { useState } from 'react';
import type { Actor } from '../../qsl/types';
import { qslReport, type ReportKind } from '../../qsl/services/qslRegister';
import { useQslQuery } from '../../qsl/useQsl';
import { downloadCsv } from '../../lib/export';
import { Button, Card, CardHeader, EmptyState, HeadRow, Table, TableContainer, Td, Tr, cx } from '../../components/ui';

const kinds: { kind: ReportKind; title: string; description: string }[] = [
  { kind: 'published', title: 'Published suppliers', description: 'Suppliers on the QSL' },
  { kind: 'category', title: 'By product category', description: 'Suppliers grouped by category' },
  { kind: 'capability', title: 'By capability', description: 'Approved skill ratings' },
  { kind: 'expiry', title: 'QSL expiry', description: 'Expiring and expired listings' },
  { kind: 'status', title: 'QSL status', description: 'Suppliers by status' },
];

// 5.5 Reports & Export: Excel (CSV) and PDF (print) outputs of the QSL.
export function ReportsTab({ actor }: { actor: Actor }) {
  const [kind, setKind] = useState<ReportKind>('published');
  const report = useQslQuery(() => qslReport(actor, kind), [actor.id, kind]).data;

  return (
    <div className="space-y-4">
      <div role="group" aria-label="QSL report" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kinds.map(item => (
          <button
            key={item.kind}
            type="button"
            aria-pressed={kind === item.kind}
            onClick={() => setKind(item.kind)}
            className={cx('rounded-card border p-4 text-left transition-colors', kind === item.kind ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface hover:border-brand-200')}
          >
            <div className="text-body font-semibold text-ink">{item.title}</div>
            <div className="mt-0.5 text-caption text-ink-muted">{item.description}</div>
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title={report?.title ?? 'Report'}
          description={report ? `${report.description} · ${report.rows.length} rows` : undefined}
          actions={report && (
            <>
              <Button disabled={report.rows.length === 0} onClick={() => downloadCsv(`qsl-${kind}-report.csv`, report.columns, report.rows)}>Export Excel (CSV)</Button>
              <Button onClick={() => window.print()}>Export PDF (print)</Button>
            </>
          )}
        />
        {report && (
          <>
            <TableContainer>
              <Table minWidth={760}>
                <HeadRow columns={report.columns} />
                <tbody>{report.rows.map((row, index) => <Tr key={index}>{row.map((cell, position) => <Td key={position} dense>{cell}</Td>)}</Tr>)}</tbody>
              </Table>
            </TableContainer>
            {report.rows.length === 0 && <EmptyState title="No data for this report" />}
          </>
        )}
      </Card>
    </div>
  );
}
