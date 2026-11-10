import type { ReactNode } from 'react';
import { tx, useT } from '../../i18n';
import { cx, toneText, type Tone } from './tones';

export function Card({ children, className, padded }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cx('rounded-card border border-line bg-surface shadow-card', padded && 'p-5', className)}>{children}</div>;
}

export function CardHeader({ title, description, actions, compact, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; compact?: boolean; className?: string }) {
  useT();
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-5', compact ? 'py-3' : 'py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{tx(title)}</h2>
        {description && <p className="mt-0.5 text-caption text-ink-muted">{tx(description)}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('p-5', className)}>{children}</div>;
}

export function KpiCard({
  label,
  value,
  note,
  tone = 'neutral',
  size = 'lg',
  children,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  tone?: Tone;
  size?: 'lg' | 'md';
  children?: ReactNode;
  className?: string;
}) {
  useT();
  return (
    <Card className={cx('p-4', className)}>
      <div className="text-caption font-medium text-ink-muted">{tx(label)}</div>
      <div className={cx('mt-1.5 font-semibold tracking-tight tabular-nums', size === 'lg' ? 'text-2xl' : 'text-lg', toneText[tone])}>{value}</div>
      {note && <div className="mt-1 text-caption text-ink-muted">{tx(note)}</div>}
      {children}
    </Card>
  );
}

const kpiCols = {
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
};

export function KpiGrid({ cols, children, className }: { cols: keyof typeof kpiCols; children: ReactNode; className?: string }) {
  return <div className={cx('grid gap-4', kpiCols[cols], className)}>{children}</div>;
}

const gridCols = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
  split3: 'grid-cols-1 xl:grid-cols-3',
  split5: 'grid-cols-1 xl:grid-cols-5',
};

export function Grid({ cols, children, className }: { cols: keyof typeof gridCols; children: ReactNode; className?: string }) {
  return <div className={cx('grid gap-4', gridCols[cols], className)}>{children}</div>;
}
