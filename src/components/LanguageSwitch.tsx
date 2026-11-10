import { setLang, useLang, useT, type Lang } from '../i18n';
import { cx } from './ui';

const options: { value: Lang; label: string }[] = [{ value: 'th', label: 'TH' }, { value: 'en', label: 'EN' }];

export default function LanguageSwitch() {
  const lang = useLang();
  const t = useT();
  return (
    <div role="group" aria-label={t('Language')} className="inline-flex gap-1 rounded-control border border-line bg-sunken p-1">
      {options.map(item => (
        <button
          key={item.value}
          type="button"
          aria-pressed={lang === item.value}
          onClick={() => setLang(item.value)}
          className={cx('h-7 w-10 rounded-[0.375rem] text-caption font-semibold transition-colors', lang === item.value ? 'bg-surface text-brand-600 shadow-card' : 'text-ink-soft hover:text-ink')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
