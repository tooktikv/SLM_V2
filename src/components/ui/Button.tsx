import type { ButtonHTMLAttributes } from 'react';
import { tx, useT } from '../../i18n';
import { cx } from './tones';

type Variant = 'primary' | 'secondary' | 'danger' | 'danger-soft' | 'warning-soft' | 'ghost' | 'link' | 'link-muted' | 'link-danger' | 'inline';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-sunken disabled:text-ink-faint',
  secondary: 'border border-brand-200 bg-surface text-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:border-line disabled:bg-surface disabled:text-ink-faint',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 disabled:bg-sunken disabled:text-ink-faint',
  'danger-soft': 'bg-danger-50 text-danger-600 hover:bg-danger-200/60 disabled:bg-sunken disabled:text-ink-faint',
  'warning-soft': 'bg-warning-50 text-warning-600 hover:bg-warning-200/60 disabled:bg-sunken disabled:text-ink-faint',
  ghost: 'text-brand-600 hover:bg-brand-50 disabled:text-ink-faint disabled:hover:bg-transparent',
  link: 'border border-brand-200 bg-surface text-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:border-line disabled:bg-surface disabled:text-ink-faint',
  'link-muted': 'border border-line bg-surface text-ink-soft hover:bg-sunken active:bg-line disabled:bg-surface disabled:text-ink-faint',
  'link-danger': 'border border-danger-200 bg-surface text-danger-600 hover:bg-danger-50 disabled:border-line disabled:bg-surface disabled:text-ink-faint',
  // Borderless text link for names inside table cells and for notes inside cards.
  inline: 'text-brand-600 hover:text-brand-700 disabled:text-ink-faint',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-caption',
  sm: 'h-8 px-3 text-caption',
  md: 'h-10 px-4 text-body',
  lg: 'h-12 px-4 text-body',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = 'secondary', size = 'sm', type = 'button', className, children, ...props }: ButtonProps) {
  useT();
  const isInline = variant === 'inline';
  return (
    <button
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed',
        isInline ? cx('rounded-sm underline-offset-2 hover:underline', size === 'md' || size === 'lg' ? 'text-body' : 'text-caption') : cx('rounded-control', sizes[size]),
        variants[variant],
        className,
      )}
      {...props}
    >
      {tx(children)}
    </button>
  );
}
