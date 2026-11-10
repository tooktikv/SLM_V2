import type { ReactNode } from 'react';
import { ChevronRightIcon } from './icons';
import NotificationBell from './NotificationBell';
import LanguageSwitch from './LanguageSwitch';
import { useT } from '../i18n';
import { Avatar, Button } from './ui';

export default function Header({
  breadcrumb,
  title,
  action,
  extra,
}: {
  breadcrumb: string[];
  title: string;
  action?: { label: string; onClick?: () => void };
  extra?: ReactNode;
}) {
  const t = useT();
  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-surface py-2.5 pl-16 pr-4 md:pr-6 lg:pl-6">
      <div className="min-w-0 flex-1 basis-48">
        <nav aria-label={t('Breadcrumb')}>
          <ol className="flex flex-wrap items-center gap-x-2 text-body text-ink-muted">
            {breadcrumb.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-center gap-2">
                {index > 0 && <ChevronRightIcon className="h-3 w-3 text-ink-faint" />}
                <span className={index === breadcrumb.length - 1 ? 'font-semibold text-ink' : undefined}>{t(item)}</span>
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="text-lg font-semibold leading-tight tracking-tight text-ink md:text-xl">{t(title)}</h1>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {extra}
        <LanguageSwitch />
        <NotificationBell />
        <Avatar initials="JK" className="max-sm:hidden" />
        {action && (
          <Button variant="primary" size="md" onClick={action.onClick}>
            {t(action.label)}
          </Button>
        )}
      </div>
    </header>
  );
}
