import { Children, cloneElement, isValidElement, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDownIcon, SearchIcon } from '../icons';
import { translate, tx, useT } from '../../i18n';
import { cx } from './tones';

const control =
  'w-full rounded-control border border-control bg-surface px-3 text-body text-ink transition-colors placeholder:text-ink-muted hover:border-ink-faint focus:border-brand-600 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-faint [&:is(input,textarea):read-only]:bg-sunken aria-[invalid=true]:border-danger-600';

export function Input({ className, invalid, placeholder, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  useT();
  return <input aria-invalid={invalid || undefined} className={cx(control, 'h-10', className)} placeholder={placeholder && translate(placeholder)} {...props} />;
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const t = useT();
  return (
    <div className={cx('relative min-w-0', className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <Input aria-label={props.placeholder && t(props.placeholder)} className="pl-9" {...props} />
    </div>
  );
}

// Option labels are translated here because native <option> cannot render components.
const translateOptions = (nodes: ReactNode): ReactNode => Children.map(nodes, node => {
  if (!isValidElement(node)) return typeof node === 'string' ? translate(node) : node;
  const element = node as ReactElement<{ children?: ReactNode; value?: string }>;
  if (element.type !== 'option') return node;
  // Without an explicit value the browser would use the translated text, so pin the original text.
  const value = element.props.value ?? Children.toArray(element.props.children).join('');
  return cloneElement(element, { value }, tx(element.props.children));
});

export function Select({
  className,
  size = 'md',
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: 'sm' | 'md'; children: ReactNode }) {
  useT();
  return (
    <div className={cx('relative min-w-0', className)}>
      <select className={cx(control, size === 'sm' ? 'h-8' : 'h-10', 'appearance-none pr-8')} {...props}>
        {translateOptions(children)}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

export function Field({ label, hint, required, children, className }: { label: ReactNode; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  useT();
  return (
    <label className={cx('block', className)}>
      <span className="mb-2 flex items-center gap-1 text-body font-medium text-ink">
        {tx(label)}
        {required && <span aria-hidden="true" className="text-danger-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-2 block text-caption text-ink-muted">{tx(hint)}</span>}
    </label>
  );
}

export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="checkbox" className={cx('ui-checkbox', className)} {...props} />;
}

export function Textarea({ className, invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cx(control, 'min-h-22 py-2.5', className)} {...props} />;
}
