import { downloadCsv } from '../lib/export';
import { Button } from './ui';

// Exports the rows currently shown in the table next to it (after filters).
export default function ExportButton({ filename, columns, rows, label = 'Export CSV' }: { filename: string; columns: string[]; rows: (string | number | undefined | null)[][]; label?: string }) {
  return <Button disabled={rows.length === 0} onClick={() => downloadCsv(`${filename}.csv`, columns, rows.map(row => row.map(cell => String(cell ?? ''))))}>{label}</Button>;
}
