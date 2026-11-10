import { dbdSource, type DbdRecord } from '../data/dbd';
import { Badge, Eyebrow, HeadRow, Table, TableContainer, Td, Tr, cx, type Tone } from './ui';

const date = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const baht = (value: number) => `฿${value.toLocaleString('en-US')}`;
const compact = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  return abs >= 1e9 ? `${sign}฿${(abs / 1e9).toFixed(2)}B` : abs >= 1e6 ? `${sign}฿${(abs / 1e6).toFixed(1)}M` : `${sign}฿${abs.toLocaleString('en-US')}`;
};
const statusTone: Record<DbdRecord['status'], Tone> = { Active: 'success', Liquidating: 'warning', Dissolved: 'danger' };

function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cx(wide && 'sm:col-span-2')}>
      <div className="text-caption text-ink-muted">{label}</div>
      <div className="mt-0.5 text-body text-ink">{value}</div>
    </div>
  );
}

// Registry facts from the DBD: capital, signing authority and the financial statements filed each year.
export default function DbdRegistry({ record }: { record?: DbdRecord }) {
  if (!record) {
    return (
      <div className="rounded-control border border-dashed border-line px-4 py-6 text-center">
        <div className="text-lg font-semibold text-ink-muted">N/A</div>
        <p className="mt-1 text-caption text-ink-muted">DBD data is only available for companies registered in Thailand.</p>
      </div>
    );
  }

  const latest = record.financials[0];
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <Eyebrow>Registered capital & status</Eyebrow>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Registered capital" value={baht(record.registeredCapital)} />
          <Field label="Paid-up capital" value={baht(record.paidUpCapital)} />
          <Field label="Company status" value={<Badge tone={statusTone[record.status]} small dot>{record.status}</Badge>} />
          <Field label="Registered on" value={date(record.registeredOn)} />
          <Field label="Business type" value={record.businessType} wide />
        </div>
      </section>

      <section className="space-y-3">
        <Eyebrow>Directors & signing authority</Eyebrow>
        <TableContainer className="rounded-control border border-line">
          <Table minWidth={480}>
            <HeadRow columns={['Director', 'Position', 'Signing authority']} />
            <tbody>{record.directors.map(director => (
              <Tr key={director.name}>
                <Td dense className="font-medium text-ink">{director.name}</Td>
                <Td dense>{director.position}</Td>
                <Td dense>{director.authorizedSignatory ? <Badge tone="brand" small>Authorized signatory</Badge> : <span className="text-ink-muted">Not authorized</span>}</Td>
              </Tr>
            ))}</tbody>
          </Table>
        </TableContainer>
        <p className="text-caption text-ink-muted">Signing condition: {record.signingAuthority}</p>
      </section>

      <section className="space-y-3">
        <Eyebrow>Financial statements (latest FY {latest.year})</Eyebrow>
        <TableContainer className="rounded-control border border-line">
          <Table minWidth={720}>
            <HeadRow columns={['Fiscal year', 'Revenue', 'Net profit', 'Net margin', 'Total assets', 'Total liabilities', 'Equity']} />
            <tbody>{record.financials.map(item => {
              const margin = item.revenue ? (item.netProfit / item.revenue) * 100 : 0;
              return (
                <Tr key={item.year}>
                  <Td dense className="font-medium text-ink">{item.year}</Td>
                  <Td dense className="tabular-nums">{compact(item.revenue)}</Td>
                  <Td dense className={cx('tabular-nums', item.netProfit < 0 ? 'font-medium text-danger-600' : 'text-ink')}>{compact(item.netProfit)}</Td>
                  <Td dense className={cx('tabular-nums', margin < 0 && 'text-danger-600')}>{margin.toFixed(1)}%</Td>
                  <Td dense className="tabular-nums">{compact(item.totalAssets)}</Td>
                  <Td dense className="tabular-nums">{compact(item.totalLiabilities)}</Td>
                  <Td dense className={cx('tabular-nums', item.totalAssets - item.totalLiabilities < 0 && 'text-danger-600')}>{compact(item.totalAssets - item.totalLiabilities)}</Td>
                </Tr>
              );
            })}</tbody>
          </Table>
        </TableContainer>
      </section>

      <p className="text-caption text-ink-muted">Source: {dbdSource}. Mock data for the prototype · last updated {date(record.updatedOn)}.</p>
    </div>
  );
}
