// Formatting helpers. The active language is set by LanguageProvider so dates and money follow it.
let language = 'en';

export function setFormatLanguage(lang) {
  language = lang;
}

const locale = () => (language === 'ur' ? 'ur-PK' : 'en-GB');

export const money = (n) => {
  const value = Math.round(Number(n) || 0).toLocaleString('en-US');
  return language === 'ur' ? `${value} روپے` : `Rs ${value}`;
};

// Business dates are 'YYYY-MM-DD' strings in local time
export const todayStr = () => new Date().toLocaleDateString('en-CA');

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(dateStr, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!dateStr) return '—';
  return new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale(), { timeZone: 'UTC', ...opts });
}

export const fmtShort = (dateStr) => fmtDate(dateStr, { day: 'numeric', month: 'short' });

export const fmtWeekday = (dateStr) => fmtDate(dateStr, { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtLongDate = (dateStr) => fmtDate(dateStr, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const fmtMonth = (month) => fmtDate(`${month}-01`, { month: 'long', year: 'numeric' });

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const SKILLS = [
  'Mason',
  'Helper',
  'Carpenter',
  'Steel Fixer',
  'Electrician',
  'Plumber',
  'Painter',
  'Welder',
  'Operator',
  'Other',
];

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
