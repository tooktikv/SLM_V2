import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon, InboxIcon, InfoIcon, SparklesIcon } from '../icons';
import { translate, tx, useT } from '../../i18n';
import { cx, toneFill, toneSoft, type Tone } from './tones';

type CalloutTone = 'info' | 'warning' | 'danger' | 'success';

const calloutIcon: Record<CalloutTone, { Icon: typeof InfoIcon; color: string }> = {
  info: { Icon: InfoIcon, color: 'text-info-600' },
  warning: { Icon: AlertTriangleIcon, color: 'text-warning-600' },
  danger: { Icon: AlertTriangleIcon, color: 'text-danger-600' },
  success: { Icon: CheckCircleIcon, color: 'text-success-600' },
};

export function Callout({
  tone = 'info',
  title,
  children,
  actions,
  compact,
  className,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const { Icon, color } = calloutIcon[tone];
  useT();
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={cx('flex flex-wrap items-start gap-3 rounded-control border', compact ? 'p-3' : 'p-4', toneSoft[tone], className)}>
      <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', color)} />
      <div className="min-w-0 flex-1">
        {title && <div className={cx('text-body font-semibold', color)}>{tx(title)}</div>}
        {children && <div className={cx('text-caption leading-relaxed text-ink-soft', title ? 'mt-1' : '')}>{tx(children)}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPos(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pos]);

  const show = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 264;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    setPos({ top: rect.top - 8, left });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        className="inline-flex shrink-0 rounded-full text-ink-muted transition-colors hover:text-ink-soft"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      {pos && createPortal(
        <div id={id} role="tooltip" style={{ top: pos.top, left: pos.left, width: 264 }} className="pointer-events-none fixed z-60 -translate-y-full rounded bg-ink px-3 py-2 text-left text-caption font-normal leading-relaxed text-white shadow-popover">
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

export function EmptyState({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  useT();
  return (
    <div className={cx('flex flex-col items-center rounded-card bg-canvas px-6 py-10 text-center', className)}>
      <InboxIcon className="h-8 w-8 text-brand-600" />
      <p className="mt-3 text-base font-semibold text-ink">{tx(title)}</p>
      {description && <p className="mt-1 max-w-sm text-body text-ink-soft">{tx(description)}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  fill,
  size = 'sm',
  label,
  target,
  className,
}: {
  value: number;
  tone?: Tone;
  fill?: string;
  size?: 'sm' | 'md';
  label?: string;
  target?: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      {...(label
        ? { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(clamped) }
        : { 'aria-hidden': true })}
      className={cx('relative rounded-full bg-sunken', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div className={cx('h-full rounded-full', fill ?? toneFill[tone])} style={{ width: `${clamped}%` }} />
      {target !== undefined && <div className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-ink-soft/60" style={{ left: `${target}%` }} />}
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  badge,
  onClose,
  onFillSample,
  closeLabel = 'Close',
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  onFillSample?: () => void;
  closeLabel?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-card border border-line bg-surface shadow-popover sm:rounded-card"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="text-micro font-semibold uppercase tracking-wide text-ink-muted">{tx(eyebrow)}</div>}
            <h2 id={titleId} className="mt-1 text-xl font-semibold text-ink">
              {tx(title)}
            </h2>
            {badge && <div className="mt-2">{badge}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onFillSample && (
              <button type="button" onClick={onFillSample} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-dashed border-brand-300 bg-brand-50 px-2.5 text-caption font-semibold text-brand-700 transition-colors hover:bg-brand-100">
                <SparklesIcon className="h-3.5 w-3.5" />{translate('Fill sample data')}
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              aria-label={translate(closeLabel)}
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-6 p-6">{children}</div>
      </section>
    </div>
  );
}
