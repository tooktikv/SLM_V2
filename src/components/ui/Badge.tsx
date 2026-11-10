import type { ReactNode } from 'react';
import { tx, useT } from '../../i18n';
import { cx, type Tone } from './tones';

const badgeTones: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: 'bg-sunken text-ink-soft', dot: 'bg-ink-soft' },
  brand: { pill: 'bg-brand-50 text-brand-600', dot: 'bg-brand-600' },
  success: { pill: 'bg-success-50 text-success-600', dot: 'bg-success-600' },
  warning: { pill: 'bg-warning-50 text-warning-600', dot: 'bg-warning-600' },
  danger: { pill: 'bg-danger-50 text-danger-600', dot: 'bg-danger-600' },
  info: { pill: 'bg-info-50 text-info-600', dot: 'bg-info-600' },
};

export function Badge({
  tone = 'neutral',
  dot,
  small,
  strong,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  small?: boolean;
  strong?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const styles = badgeTones[tone];
  useT();
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full',
        strong ? 'font-semibold' : 'font-medium',
        small ? 'px-2 py-0.5 text-caption' : 'px-2.5 py-1 text-caption',
        styles.pill,
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cx('h-[5px] w-[5px] shrink-0 rounded-full', styles.dot)} />}
      {tx(children)}
    </span>
  );
}
