import { useEffect, useState } from 'react';
import { CloseIcon, PanelLeftIcon, SettingsIcon } from './icons';
import { Avatar, cx } from './ui';
import { useNavigation } from '../NavigationContext';
import { useT } from '../i18n';
import { modules, sectionsOf, type ModuleDef } from '../modules';

// Modules whose sections are empty for the current role (e.g. QSL for suppliers) are hidden.
const visibleGroups = (role: Parameters<typeof sectionsOf>[1]) => {
  const groups: { label: string; items: ModuleDef[] }[] = [];
  modules.filter(item => !item.sections || item.sections(role).length > 0).forEach(item => {
    const group = groups.find(entry => entry.label === item.group);
    if (group) group.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  });
  return groups;
};

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { active, section, role, navigate, setSection } = useNavigation();
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();
  const groups = visibleGroups(role);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && <button type="button" aria-label={t('Close navigation')} onClick={onClose} className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />}
      <aside
        className={cx(
          'z-50 flex h-full shrink-0 flex-col bg-nav text-white',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-72 max-lg:shadow-popover max-lg:transition-[transform,visibility]',
          'lg:transition-[width] lg:duration-200',
          collapsed ? 'lg:w-17' : 'lg:w-64',
          isOpen ? 'max-lg:visible max-lg:translate-x-0' : 'max-lg:invisible max-lg:-translate-x-full',
        )}
      >
        <div className={cx('flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-4', collapsed && 'lg:justify-center lg:px-0')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-white text-sm font-bold text-nav">S</div>
          <div className={cx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <div className="truncate text-sm font-semibold tracking-tight text-white">{t('SLM Platform')}</div>
            <div className="text-micro font-medium uppercase tracking-widest text-nav-muted">{t('Enterprise')}</div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-control text-nav-muted hover:bg-nav-hover hover:text-white lg:hidden"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex ? 'mt-5' : ''}>
              <div className={cx('mb-1.5 px-3 text-micro font-semibold uppercase tracking-wider text-nav-muted', collapsed && 'lg:hidden')}>{t(group.label)}</div>
              {groupIndex > 0 && collapsed && <div aria-hidden="true" className="mx-3 mb-2 hidden border-t border-white/10 lg:block" />}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = active === item.id || (active === 'supplier360' && item.id === 'suppliers');
                  const entries = item.sections ? item.sections(role) : [];
                  const hasSections = entries.length > 0;
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        title={t(item.label)}
                        aria-current={isActive && !hasSections ? 'page' : undefined}
                        aria-expanded={hasSections ? isActive : undefined}
                        onClick={() => { navigate(item.id); if (!hasSections) onClose(); }}
                        className={cx(
                          'group relative flex min-h-12 w-full items-center gap-3 rounded-control px-3 py-2 text-left text-white transition-colors',
                          collapsed && 'lg:justify-center lg:px-0',
                          isActive ? 'bg-nav-active' : 'hover:bg-nav-hover',
                        )}
                      >
                        <item.Icon className="h-5 w-5 shrink-0 text-white" />
                        <span className={cx('flex-1 truncate text-body', isActive ? 'font-semibold' : 'font-medium', collapsed && 'lg:sr-only')}>{t(item.label)}</span>
                        {item.no && <span aria-hidden="true" className={cx('text-micro tabular-nums text-nav-muted', collapsed && 'lg:hidden')}>{item.no}</span>}
                      </button>
                      {hasSections && isActive && (
                        <div className={cx('ml-5 mt-1 space-y-0.5 border-l border-white/20 pl-2', collapsed && 'lg:hidden')}>
                          {entries.map((entry, index) => (
                            <div key={entry.id}>
                              {entry.group && entry.group !== entries[index - 1]?.group && (
                                <div className="px-2 pb-0.5 pt-2 text-micro font-semibold uppercase tracking-wider text-nav-muted">{t(entry.group)}</div>
                              )}
                              <button
                                type="button"
                                aria-current={entry.id === section ? 'page' : undefined}
                                onClick={() => { setSection(entry.id); onClose(); }}
                                className={cx('block w-full truncate rounded-control px-2 py-2 text-left text-body transition-colors', entry.id === section ? 'bg-nav-active font-semibold text-white' : 'font-medium text-white/85 hover:bg-nav-hover hover:text-white')}
                              >
                                {t(entry.label)}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(current => !current)}
            className={cx(
              'mb-2 flex w-full items-center gap-3 rounded-control px-3 py-2 text-nav-muted transition-colors hover:bg-nav-hover hover:text-white max-lg:hidden',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <PanelLeftIcon className="h-5 w-5 shrink-0" />
            <span className={cx('text-body font-medium', collapsed && 'lg:sr-only')}>{t('Collapse')}</span>
          </button>
          <div className={cx('flex items-center gap-2.5 rounded-control px-2 py-1.5', collapsed && 'lg:justify-center lg:px-0')}>
            <Avatar initials="JK" />
            <div className={cx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
              <div className="truncate text-body font-semibold text-white">James Kim</div>
              <div className="truncate text-caption text-nav-muted">{t('Procurement Manager')}</div>
            </div>
            <button
              type="button"
              aria-label={t('Open administration')}
              onClick={() => { navigate('administration'); onClose(); }}
              className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-nav-muted transition-colors hover:bg-nav-hover hover:text-white', collapsed && 'lg:hidden')}
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
