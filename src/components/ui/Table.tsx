import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { translate, tx, useT } from '../../i18n';
import { cx } from './tones';

export function TableContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('relative overflow-x-auto', className)}>{children}</div>;
}

export function Table({ children, minWidth, className }: { children: ReactNode; minWidth?: number; className?: string }) {
  return (
    <table className={cx('w-full border-collapse text-left', className)} style={minWidth ? { minWidth } : undefined}>
      {children}
    </table>
  );
}

export function Th({ children, className, align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'center' | 'right' }) {
  useT();
  return (
    <th scope="col" className={cx('whitespace-nowrap border-b border-line bg-canvas px-3 py-2.5 text-micro font-semibold uppercase tracking-wide text-ink-muted', align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left', className)}>
      {children ? tx(children) : <span className="sr-only">{translate('Actions')}</span>}
    </th>
  );
}

export function HeadRow({ columns, leading }: { columns: string[]; leading?: ReactNode }) {
  return (
    <thead>
      <tr>
        {leading}
        {columns.map((label, index) => (
          <Th key={`${label}-${index}`}>{label}</Th>
        ))}
      </tr>
    </thead>
  );
}

export function Tr({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cx('border-b border-line-subtle transition-colors last:border-b-0', onClick ? 'cursor-pointer hover:bg-brand-50/50' : 'hover:bg-canvas', className)}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className, colSpan, dense }: { children?: ReactNode; className?: string; colSpan?: number; dense?: boolean }) {
  useT();
  return (
    <td colSpan={colSpan} className={cx('px-3 align-middle', dense ? 'py-2.5' : 'py-3', className)}>
      {tx(children)}
    </td>
  );
}

export function CellStack({ primary, secondary, mono, tone = 'default' }: { primary: ReactNode; secondary?: ReactNode; mono?: boolean; tone?: 'default' | 'link' | 'plain' }) {
  useT();
  return (
    <>
      <div className={tone === 'link' ? 'font-medium text-brand-700 hover:underline' : tone === 'plain' ? '' : 'font-medium text-ink'}>{tx(primary)}</div>
      {secondary && <div className={cx('mt-0.5 text-caption text-ink-muted', mono && 'font-mono')}>{tx(secondary)}</div>}
    </>
  );
}

export function Pagination({ summary, page, pageCount, onPrevious, onNext }: { summary: ReactNode; page: number; pageCount: number; onPrevious: () => void; onNext: () => void }) {
  const lang = useT();
  const step = 'flex h-8 w-8 items-center justify-center rounded-control border border-line bg-surface text-ink-soft transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-surface';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <span className="text-caption text-ink-muted">{summary}</span>
      <nav aria-label={lang('Pagination')} className="flex items-center gap-2">
        <button type="button" aria-label={lang('Previous')} className={step} disabled={page === 1} onClick={onPrevious}><ChevronLeftIcon className="h-4 w-4" /></button>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-control bg-brand-600 px-2 text-body text-white" aria-live="polite">{page}</span>
        <span className="text-body text-ink-soft">/ {pageCount}</span>
        <button type="button" aria-label={lang('Next')} className={step} disabled={page === pageCount} onClick={onNext}><ChevronRightIcon className="h-4 w-4" /></button>
      </nav>
    </div>
  );
}
