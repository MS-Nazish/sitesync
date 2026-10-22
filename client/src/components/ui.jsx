import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { initials } from '../utils/format';
import { useT } from '../i18n/LanguageContext';

const BUTTON_STYLES = {
  primary: 'bg-brand-500 text-slate-900 hover:bg-brand-400 focus-visible:ring-brand-500/40',
  dark: 'bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-500/40',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400/30',
  danger: 'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500/40',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500/40',
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1ebe5a] focus-visible:ring-emerald-500/40',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className = '', ...props }) {
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_STYLES[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
}

const BADGE_STYLES = {
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-sky-100 text-sky-700',
  gray: 'bg-slate-100 text-slate-600',
  purple: 'bg-violet-100 text-violet-700',
};

export function Badge({ color = 'gray', children, className = '', title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_STYLES[color]} ${className}`}>
      {children}
    </span>
  );
}

// Colour + translation key prefix for each kind of status badge
const STATUS_KINDS = {
  attendance: { prefix: 'status', colors: { present: 'green', half_day: 'yellow', absent: 'red' } },
  payroll: { prefix: 'payrollStatus', colors: { draft: 'gray', approved: 'blue', paid: 'green' } },
  site: { prefix: 'siteStatus', colors: { active: 'green', on_hold: 'yellow', completed: 'gray' } },
};

export function StatusBadge({ kind, value }) {
  const { t } = useT();
  const { prefix, colors } = STATUS_KINDS[kind];
  return <Badge color={colors[value] || 'gray'}>{t(`${prefix}.${value}`)}</Badge>;
}

export function Card({ title, actions, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {title && <h2 className="text-sm font-bold text-slate-700">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-sky-100 text-sky-600',
  };
  return (
    <div className="card flex items-start gap-3 p-4">
      {Icon && (
        <div className={`rounded-lg p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="label mb-0">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-bold text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  const { t } = useT();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Spinner({ label }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label || t('common.loading')}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      {Icon && <Icon className="mb-3 h-10 w-10 text-slate-300" />}
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-20 w-20 text-2xl' };
  if (src) return <img src={src} alt={name} className={`${sizes[size]} shrink-0 rounded-full object-cover`} />;
  return (
    <div className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600`} dir="ltr">
      {initials(name)}
    </div>
  );
}

export function SiteSelect({ sites, value, onChange, allowAll, className = '' }) {
  const { t } = useT();
  return (
    <select className={`input ${className}`} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {allowAll && <option value="">{t('common.allSites')}</option>}
      {!allowAll && !value && <option value="">{t('common.selectSite')}</option>}
      {sites.map((s) => (
        <option key={s._id} value={s._id}>
          {s.name}
          {s.status && s.status !== 'active' ? ` (${t(`siteStatus.${s.status}`)})` : ''}
        </option>
      ))}
    </select>
  );
}

// Phone numbers, CNICs and coordinates stay left-to-right inside Urdu text
export const Ltr = ({ children, className = '' }) => (
  <span dir="ltr" className={`inline-block ${className}`}>
    {children}
  </span>
);
