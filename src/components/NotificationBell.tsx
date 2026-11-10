import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { suppliers } from '../data/suppliers';
import { getNotificationRevision, listNotifications, markAllRead, markRead, subscribeNotifications, unreadCount, type AppNotification } from '../data/notifications';
import { useNavigation } from '../NavigationContext';
import { useT } from '../i18n';
import { BellIcon, CloseIcon } from './icons';
import { Badge, Button, cx, toneFill } from './ui';

// Admin notification centre.
export default function NotificationBell() {
  const t = useT();
  const { navigate, openSupplier } = useNavigation();
  useSyncExternalStore(subscribeNotifications, getNotificationRevision);
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const unread = unreadCount();
  const shown = listNotifications().filter(item => !unreadOnly || item.unread);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
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

  const go = (item: AppNotification) => {
    markRead(item.id);
    setOpen(false);
    const supplier = item.target.supplierId ? suppliers.find(entry => entry.id === item.target.supplierId) : undefined;
    if (supplier) openSupplier(supplier, item.target.tab);
    else navigate(item.target.screen, item.target.section);
  };

  return (
    <>
      <button ref={trigger} type="button" aria-label={t('Notifications')} title={t('Notifications')} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)} className={cx('relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control transition-colors hover:bg-brand-50 hover:text-brand-600', open ? 'bg-brand-50 text-brand-600' : 'text-ink-soft')}>
        <BellIcon className="h-4.5 w-4.5" />
        {unread > 0 && <span aria-hidden="true" className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-micro font-semibold text-white ring-2 ring-surface">{unread}</span>}
      </button>
      {open && createPortal(
        <div ref={panel} role="dialog" aria-label={t('Notifications')} style={{ top: position.top, right: position.right }} className="fixed z-[60] flex max-h-[min(36rem,calc(100vh-5rem))] w-[26rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
            <span className="text-body font-semibold text-ink">{t('Notifications')}</span>
            {unread > 0 && <span className="rounded-full bg-danger-50 px-2 py-0.5 text-micro font-semibold text-danger-700">{unread} {t('new')}</span>}
            <button type="button" aria-label={t('Close')} onClick={() => setOpen(false)} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-control text-ink-muted hover:bg-sunken hover:text-ink"><CloseIcon className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-4 py-2">
            <label className="flex items-center gap-2 text-caption text-ink-soft"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} />{t('Show unread only')}</label>
            <Button size="xs" variant="link" disabled={unread === 0} onClick={markAllRead}>Mark all as read</Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul>
              {shown.map(item => (
                <li key={item.id} className="border-b border-line-subtle last:border-0">
                  <button type="button" onClick={() => go(item)} className={cx('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken', item.unread && 'bg-brand-50/40')}>
                    <span aria-hidden="true" className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.unread ? toneFill[item.tone] : 'bg-transparent')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2"><Badge tone={item.tone} small>{item.category}</Badge><span className="shrink-0 text-micro text-ink-muted">{t(item.time)}</span></span>
                      <span className={cx('mt-1 block text-body text-ink', item.unread && 'font-semibold')}>{t(item.title)}</span>
                      <span className="mt-0.5 block text-caption text-ink-muted">{t(item.detail)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {shown.length === 0 && <div className="px-4 py-10 text-center text-caption text-ink-muted">{t('You are all caught up')}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
