import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, CloseIcon, SearchIcon, UploadIcon } from '../icons';
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

export function Textarea({ className, invalid, placeholder, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  useT();
  return <textarea aria-invalid={invalid || undefined} className={cx(control, 'min-h-22 py-2.5', className)} placeholder={placeholder && translate(placeholder)} {...props} />;
}

// Pick several values from a list without taking up a row of chips; an empty selection means "any".
export function MultiSelect({ options, value, onChange, placeholder, 'aria-label': ariaLabel }: { options: string[]; value: string[]; onChange: (next: string[]) => void; placeholder: string; 'aria-label': string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    // Captured so that Escape closes the list and not the dialog around it.
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape, true); };
  }, [open]);

  const summary = !value.length ? t(placeholder) : value.length <= 2 ? value.map(item => t(item)).join(', ') : t(`${value.length} selected`);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={t(ariaLabel)}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className={cx(control, 'relative flex h-10 items-center pr-8 text-left', !value.length && 'text-ink-muted')}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      </button>
      {open && createPortal(
        <div ref={panel} role="listbox" aria-multiselectable="true" style={{ top: box.top, left: box.left, minWidth: Math.max(box.width, 224) }} className="fixed z-70 max-h-72 overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-lg">
          {options.map(option => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-body text-ink hover:bg-sunken">
              <Checkbox checked={value.includes(option)} onChange={() => onChange(value.includes(option) ? value.filter(item => item !== option) : [...value, option])} />
              {t(option)}
            </label>
          ))}
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-control border-t border-line-subtle px-3 py-2 text-left text-caption font-medium text-brand-700 hover:bg-sunken">{t('Clear selection')}</button>}
        </div>,
        document.body,
      )}
    </>
  );
}

// Drop area plus the list of chosen files; only file names are kept in this prototype.
export function FileDrop({ files, onChange, label, hint }: { files: string[]; onChange: (next: string[]) => void; label: string; hint?: ReactNode }) {
  const t = useT();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    const names = Array.from(list ?? []).map(file => file.name).filter(name => !files.includes(name));
    if (names.length) onChange([...files, ...names]);
  };
  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={t(label)}
        onClick={() => input.current?.click()}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.current?.click(); } }}
        onDragOver={event => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={event => { event.preventDefault(); setOver(false); add(event.dataTransfer.files); }}
        className={cx('flex cursor-pointer flex-col items-center gap-1 rounded-control border border-dashed px-4 py-5 text-center transition-colors', over ? 'border-brand-600 bg-brand-50' : 'border-control bg-canvas hover:border-ink-faint')}
      >
        <UploadIcon className="h-5 w-5 text-brand-600" />
        <div className="text-body text-ink"><span className="font-medium text-brand-700">{t('Choose files')}</span> {t('or drag and drop here')}</div>
        {hint && <div className="text-caption text-ink-muted">{tx(hint)}</div>}
      </div>
      <input ref={input} type="file" multiple hidden onChange={event => { add(event.target.files); event.target.value = ''; }} />
      {files.length > 0 && (
        <ul className="divide-y divide-line-subtle rounded-control border border-line">
          {files.map(name => (
            <li key={name} className="flex items-center justify-between gap-2 px-3 py-2 text-body">
              <span className="min-w-0 truncate text-ink">{name}</span>
              <button type="button" aria-label={`${t('Remove')} ${name}`} onClick={() => onChange(files.filter(file => file !== name))} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-sunken hover:text-danger-700"><CloseIcon className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
