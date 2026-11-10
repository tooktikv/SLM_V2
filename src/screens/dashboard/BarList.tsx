import { ProgressBar } from '../../components/ui';

export function BarList({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  return (
    <ul className="space-y-3">{items.map(item => (
      <li key={item.label}>
        <div className="mb-1 flex justify-between text-caption"><span className="text-ink-soft">{item.label}</span><span className="font-semibold tabular-nums text-ink">{item.value}</span></div>
        <ProgressBar value={total ? (item.value / total) * 100 : 0} label={item.label} />
      </li>
    ))}</ul>
  );
}
