import type { ReactNode } from 'react';
import { ArrowLeftIcon, CheckIcon, LockIcon } from '../icons';
import { tx, useT } from '../../i18n';
import { InfoTip } from './Feedback';
import { cx, type Tone } from './tones';

export function Page({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col bg-canvas">{children}</div>;
}

export function PageScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('min-h-0 flex-1 overflow-y-auto', className)}>{children}</div>;
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6', className)}>{children}</div>;
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <PageScroll>
      <PageBody className={className}>{children}</PageBody>
    </PageScroll>
  );
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  useT();
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-sm text-caption font-medium text-ink-muted transition-colors hover:text-brand-700">
      <ArrowLeftIcon className="h-3.5 w-3.5" />
      {tx(children)}
    </button>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  useT();
  return <div className={cx('text-micro font-semibold uppercase tracking-wide text-ink-muted', className)}>{tx(children)}</div>;
}

const avatarTones: Partial<Record<Tone, string>> = {
  brand: 'bg-brand-100 text-brand-600',
  success: 'bg-success-50 text-success-600',
  neutral: 'bg-sunken text-ink-soft',
};

const avatarSizes = {
  sm: 'h-8 w-8 text-caption',
  md: 'h-10 w-10 text-body',
  lg: 'h-12 w-12 text-body',
  xl: 'h-14 w-14 text-base',
};

export function Avatar({
  initials,
  size = 'md',
  shape = 'circle',
  tone = 'brand',
  className,
}: {
  initials: string;
  size?: keyof typeof avatarSizes;
  shape?: 'circle' | 'square';
  tone?: 'brand' | 'success' | 'neutral';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-flex shrink-0 items-center justify-center font-semibold', shape === 'circle' ? 'rounded-full' : 'rounded-control', avatarSizes[size], avatarTones[tone], className)}
    >
      {initials}
    </span>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  useT();
  return (
    <div role="tablist" aria-label={label} className={cx('no-scrollbar flex gap-6 overflow-x-auto border-b border-line', className)}>
      {items.map(item => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cx(
              '-mb-px whitespace-nowrap border-b-2 px-1 py-3 text-body transition-colors',
              selected ? 'border-brand-600 font-semibold text-brand-600' : 'border-transparent font-normal text-ink-soft hover:text-ink',
            )}
          >
            {tx(item.label)}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  useT();
  return (
    <div role="group" aria-label={label} className={cx('inline-flex gap-1 rounded-control border border-line bg-sunken p-1', className)}>
      {items.map(item => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            className={cx('h-7 whitespace-nowrap rounded-[0.375rem] px-3 text-caption font-semibold transition-colors', selected ? 'bg-surface text-brand-600 shadow-card' : 'text-ink-soft hover:text-ink')}
          >
            {tx(item.label)}
          </button>
        );
      })}
    </div>
  );
}

export type StepState = 'done' | 'active' | 'todo' | 'locked';

export function Stepper({ steps, compact, className }: { steps: { label: string; caption?: string; state: StepState; hint?: string }[]; compact?: boolean; className?: string }) {
  useT();
  return (
    <div className={cx('overflow-x-auto', className)}>
      <ol className="flex min-w-max items-start">
        {steps.map((step, index) => (
          <li key={step.label} aria-current={step.state === 'active' || step.state === 'locked' ? 'step' : undefined} className={cx('flex items-start', index < steps.length - 1 && 'flex-1')}>
            <div className={cx('flex shrink-0 flex-col items-center text-center', compact ? 'w-16' : 'w-20')}>
              <span
                className={cx(
                  'flex items-center justify-center rounded-full border font-semibold',
                  'h-8 w-8 text-body',
                  step.state === 'done' && 'border-success-200 bg-success-50 text-success-600',
                  step.state === 'active' && 'border-brand-300 bg-brand-50 text-brand-600',
                  step.state === 'locked' && 'border-warning-200 bg-warning-50 text-warning-600',
                  step.state === 'todo' && 'border-line bg-sunken text-ink-muted',
                )}
              >
                {step.state === 'done' ? <CheckIcon className="h-4 w-4" /> : step.state === 'locked' ? <LockIcon className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={cx('mt-2 font-semibold', compact ? 'text-caption' : 'text-body', step.state === 'active' ? 'text-nav' : step.state === 'locked' ? 'text-warning-600' : 'text-ink')}>{tx(step.label)}</span>
              {(step.caption || step.hint) && (
                <span className={cx('mt-0.5 inline-flex items-center gap-1 text-caption', step.state === 'done' ? 'text-success-600' : step.state === 'active' ? 'text-brand-600' : 'text-ink-muted')}>
                  {tx(step.caption)}
                  {step.hint && <InfoTip label={`About ${step.label}`}>{step.hint}</InfoTip>}
                </span>
              )}
            </div>
            {index < steps.length - 1 && <div aria-hidden="true" className={cx('mt-4 h-0.5 min-w-4 flex-1 rounded-full', step.state === 'done' && steps[index + 1].state !== 'locked' ? 'bg-success-200' : 'bg-line')} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DetailGrid({ items, columns = 2, className }: { items: { label: string; value: ReactNode; wide?: boolean }[]; columns?: 1 | 2; className?: string }) {
  useT();
  return (
    <dl className={cx('grid gap-x-8 gap-y-4', columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1', className)}>
      {items.map(item => (
        <div key={item.label} className={cx(item.wide && columns === 2 && 'sm:col-span-2')}>
          <dt className="text-micro font-semibold uppercase tracking-wide text-ink-muted">{tx(item.label)}</dt>
          <dd className="mt-1 text-body text-ink">{tx(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
