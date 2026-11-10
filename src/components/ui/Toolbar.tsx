import { Children, Fragment, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ElementType, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, FilterIcon } from '../icons';
import { translate, tx, useT } from '../../i18n';
import { Button } from './Button';
import { SearchInput, Select } from './Form';
import { cx } from './tones';

type SelectElement = ReactElement<SelectHTMLAttributes<HTMLSelectElement> & { children?: ReactNode }>;
type FilterState = { element: SelectElement; label: string; value: string; options: { value: string; label: string }[]; active: boolean; selectedLabel: string };

const flatten = (nodes: ReactNode): ReactNode[] =>
  Children.toArray(nodes).flatMap(node => (isValidElement(node) && node.type === Fragment ? flatten((node.props as { children?: ReactNode }).children) : [node]));

const isType = (node: ReactNode, type: ElementType): node is ReactElement => isValidElement(node) && node.type === type;
const isSelect = (node: ReactNode): node is SelectElement => isType(node, Select);

function describe(element: SelectElement): FilterState {
  const options = flatten(element.props.children).filter(isValidElement).map(option => {
    const props = (option as ReactElement<{ value?: string; children?: ReactNode }>).props;
    const label = Children.toArray(props.children).join('');
    return { value: props.value ?? label, label };
  });
  const value = String(element.props.value ?? '');
  const selected = options.find(option => option.value === value);
  return { element, label: element.props['aria-label'] ?? '', value, options, active: options.length > 0 && !!selected && value !== options[0].value, selectedLabel: selected?.label ?? value };
}

// Controlled selects are cleared through their own onChange, so no page needs to expose a reset handler.
function setValue(filter: FilterState, value: string) {
  filter.element.props.onChange?.({ target: { value }, currentTarget: { value } } as unknown as ChangeEvent<HTMLSelectElement>);
}

function FilterButton({ filters }: { filters: FilterState[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const count = filters.filter(filter => filter.active).length;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
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
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={t('Filter')}
        title={t('Filter')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className={cx('relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border transition-colors', count || open ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-control bg-surface text-ink-soft hover:border-ink-faint hover:bg-sunken')}
      >
        <FilterIcon className="h-4 w-4" />
        {count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-micro font-semibold text-white">{count}</span>}
      </button>
      {open && createPortal(
        <div ref={panel} role="dialog" aria-label={t('Filter')} style={{ top: position.top, right: position.right }} className="fixed z-[60] w-[30rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-card border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
            <FilterIcon className="h-4 w-4 text-brand-600" />
            <span className="text-body font-semibold text-ink">{t('Filter')}</span>
            {count > 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-micro font-semibold text-brand-700">{count}</span>}
            <button type="button" aria-label={t('Close')} onClick={() => setOpen(false)} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-control text-ink-muted hover:bg-sunken hover:text-ink">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid max-h-[60vh] grid-cols-1 gap-x-3 gap-y-4 overflow-y-auto p-4 sm:grid-cols-2">
            {filters.map(filter => (
              <div key={filter.element.key} className="min-w-0">
                {filter.label && (
                  <div className={cx('mb-1.5 flex items-center gap-1.5 text-caption font-medium', filter.active ? 'text-brand-700' : 'text-ink-soft')}>
                    {t(filter.label)}
                    {filter.active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
                  </div>
                )}
                {cloneElement(filter.element, { className: 'w-full' } as Partial<SelectHTMLAttributes<HTMLSelectElement>>)}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line-subtle bg-canvas px-4 py-3">
            <Button size="sm" variant="ghost" disabled={count === 0} onClick={() => filters.forEach(filter => filter.active && setValue(filter, filter.options[0].value))}>Clear filters</Button>
            <Button size="sm" variant="primary" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// A filter control with a visible caption, used by report pages that need date pickers next to selects.
export function FilterField({ label, active, className, children }: { label?: ReactNode; active?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={cx('block min-w-0', className)}>
      {label && (
        <span className={cx('mb-1 flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wide', active ? 'text-brand-700' : 'text-ink-muted')}>
          {tx(label)}
          {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
        </span>
      )}
      {children}
    </label>
  );
}

export function FilterBar({ children, heading, onClear, trailing, className }: { children: ReactNode; heading?: ReactNode; onClear?: () => void; trailing?: ReactNode; className?: string }) {
  const t = useT();
  return (
    <div role="group" aria-label={t('Filters')} className={cx('flex flex-wrap items-end gap-x-3 gap-y-3 rounded-control border border-line-subtle bg-canvas px-3 py-2.5', className)}>
      <span className="flex h-10 items-center gap-1.5 pr-1 text-caption font-semibold text-ink-soft"><FilterIcon className="h-4 w-4 text-brand-600" />{heading ? tx(heading) : t('Filter by')}</span>
      {children}
      {onClear && <Button size="sm" variant="ghost" className="mb-1" onClick={onClear}>Clear filters</Button>}
      {trailing && <div className="ml-auto flex flex-wrap items-center gap-2 pb-0.5">{trailing}</div>}
    </div>
  );
}

// Selects collapse into one filter icon with a popover and removable chips; the search box, the filter icon and `actions` sit at the right end of the row, with an optional `title` at the left.
export function Toolbar({ children, actions, className, title, description }: { children: ReactNode; actions?: ReactNode; className?: string; title?: ReactNode; description?: ReactNode }) {
  const t = useT();
  const items = flatten(children);
  const searches = items.filter(node => isType(node, SearchInput)) as ReactElement<{ className?: string }>[];
  const filters = items.filter(isSelect).map(describe);
  const rest = items.filter(node => !isType(node, SearchInput) && !isSelect(node));
  const chips = filters.filter(filter => filter.active);
  const hasControls = searches.length > 0 || filters.length > 0;

  return (
    <div>
      <div className={cx('flex flex-wrap items-center gap-2', className)}>
        {title && (
          <div className="min-w-0 pr-2">
            <h2 className="text-sm font-semibold text-ink">{tx(title)}</h2>
            {description && <p className="mt-0.5 text-caption text-ink-muted">{tx(description)}</p>}
          </div>
        )}
        {rest}
        {(hasControls || actions) && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {hasControls && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {searches.map(search => cloneElement(search, { className: 'w-full sm:w-60' }))}
                {filters.length > 0 && <FilterButton filters={filters} />}
              </div>
            )}
            {hasControls && actions && <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-line sm:block" />}
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map(chip => (
            <span key={chip.element.key} className="inline-flex h-7 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 pl-2.5 pr-1 text-caption text-brand-700">
              {chip.label && <span className="text-brand-600">{t(chip.label)}:</span>}
              <span className="font-medium">{translate(chip.selectedLabel)}</span>
              <button type="button" aria-label={`${t('Clear filters')}: ${t(chip.label || chip.selectedLabel)}`} onClick={() => setValue(chip, chip.options[0].value)} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-brand-100">
                <CloseIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button size="xs" variant="ghost" onClick={() => chips.forEach(chip => setValue(chip, chip.options[0].value))}>Clear filters</Button>
        </div>
      )}
    </div>
  );
}
