import { cx, type Tone } from './tones';

const bars: Record<Tone, { solid: string; light: string }> = {
  neutral: { solid: 'bg-ink-muted', light: 'bg-line' },
  brand: { solid: 'bg-brand-600', light: 'bg-brand-200' },
  success: { solid: 'bg-success-600', light: 'bg-success-200' },
  warning: { solid: 'bg-warning-600', light: 'bg-warning-200' },
  danger: { solid: 'bg-danger-600', light: 'bg-danger-200' },
  info: { solid: 'bg-info-600', light: 'bg-info-200' },
};

export function ColumnChart({
  values,
  labels,
  tone = 'brand',
  height = 96,
  showValues,
  normalize,
  unit = '',
  ariaLabel,
}: {
  values: number[];
  labels: string[];
  tone?: Tone;
  height?: number;
  showValues?: boolean;
  normalize?: boolean;
  unit?: string;
  ariaLabel: string;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const heightOf = (value: number) => (normalize ? ((value - min) / (max - min || 1)) * 100 : value);

  return (
    <div role="img" aria-label={`${ariaLabel}: ${values.map((value, index) => `${labels[index]} ${value}${unit}`).join(', ')}`}>
      {showValues && (
        <div aria-hidden="true" className="mb-1 flex gap-1.5">
          {values.map((value, index) => (
            <span key={labels[index]} className="flex-1 text-center text-micro tabular-nums text-ink-muted">
              {value}
              {unit}
            </span>
          ))}
        </div>
      )}
      <div aria-hidden="true" className="flex items-end gap-1.5" style={{ height }}>
        {values.map((value, index) => (
          <div
            key={labels[index]}
            className={cx('flex-1 rounded-t', index === values.length - 1 ? bars[tone].solid : bars[tone].light)}
            style={{ height: `${heightOf(value)}%`, minHeight: 4 }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-1.5">
        {labels.map(label => (
          <span key={label} className="flex-1 text-center text-micro text-ink-muted">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
