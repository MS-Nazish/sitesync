import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  CloudOff,
  Download,
  HandCoins,
  HardHat,
  KeyRound,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  RefreshCw,
  UserCog,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { useOffline } from '../offline/OfflineContext';
import { fmtDate } from '../utils/format';
import { Avatar, Button } from './ui';

const NAV = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/attendance', key: 'nav.markAttendance', icon: CalendarCheck, end: true },
  { to: '/attendance/log', key: 'nav.attendanceLog', icon: ClipboardList },
  { to: '/workers', key: 'nav.workers', icon: HardHat },
  { to: '/advances', key: 'nav.advances', icon: HandCoins },
  { to: '/payroll', key: 'nav.payroll', icon: ReceiptText },
  { to: '/sites', key: 'nav.sites', icon: Building2, admin: true },
  { to: '/users', key: 'nav.users', icon: UserCog, admin: true },
];

// Chrome / Edge / Android fire this when the app can be installed to the home screen
function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  const install = async () => {
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };
  return prompt ? install : null;
}

export function LanguageToggle({ className = '' }) {
  const { t, toggle } = useT();
  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${className}`}
    >
      <Languages className="h-4 w-4" /> {t('lang.switch')}
    </button>
  );
}

function Sidebar({ onNavigate }) {
  const { user, isAdmin, logout } = useAuth();
  const { t } = useT();
  const install = useInstallPrompt();

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-slate-900">
          <HardHat className="h-5 w-5" />
        </div>
        <div>
          <p className="font-latin text-base font-bold leading-tight text-white">SiteSync</p>
          <p className="text-[11px] leading-tight text-slate-400">{t('app.tagline')}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.filter((n) => !n.admin || isAdmin).map(({ to, key, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-brand-500 text-slate-900' : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {t(key)}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-800 p-3">
        {install && (
          <button
            type="button"
            onClick={install}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Download className="h-4 w-4" /> {t('nav.install')}
          </button>
        )}
        <LanguageToggle className="w-full justify-center text-slate-300 hover:bg-slate-800 hover:text-white" />
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="text-xs text-slate-400">{t(`role.${user?.role}`)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NavLink
            to="/account"
            onClick={onNavigate}
            className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs hover:bg-slate-800 hover:text-white"
          >
            <KeyRound className="h-3.5 w-3.5" /> {t('nav.password')}
          </NavLink>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5 rtl:rotate-180" /> {t('nav.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Offline banner, queued uploads and anything the server refused
function SyncBar() {
  const { t } = useT();
  const { online, pending, failed, syncing, syncNow, discard, retry } = useOffline();
  if (online && !pending.length && !failed.length) return null;

  return (
    <div className="space-y-2 px-4 pt-4 sm:px-6 lg:px-8">
      {(!online || pending.length > 0) && (
        <div className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ${online ? 'bg-sky-50 text-sky-900' : 'bg-slate-800 text-white'}`}>
          <CloudOff className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            {!online && <p className="font-semibold">{t('sync.offline')}</p>}
            {pending.length > 0 && <p>{t('sync.pending', { n: pending.length })}</p>}
          </div>
          {online && pending.length > 0 && (
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={syncing} onClick={() => syncNow()}>
              {syncing ? t('sync.syncing') : t('sync.now')}
            </Button>
          )}
        </div>
      )}
      {failed.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">{t('sync.failedTitle')}</p>
          <ul className="mt-2 space-y-2">
            {failed.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p>{t('sync.details', { site: item.siteName, date: fmtDate(item.date), n: item.entries.length })}</p>
                  <p className="text-xs text-red-700">{item.error}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => retry(item.id)}>
                  {t('sync.retry')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.confirm(t('sync.discardConfirm')) && discard(item.id)}
                >
                  {t('sync.discard')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useT();
  const current = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  return (
    <div className="min-h-screen lg:ps-64">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 shadow-xl">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button
              type="button"
              className="absolute end-3 top-5 rounded-lg p-1 text-slate-400 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label={t('nav.openMenu')}>
          <Menu className="h-5 w-5" />
        </button>
        <p className="flex-1 font-bold text-slate-800">{current ? t(current.key) : 'SiteSync'}</p>
        <LanguageToggle className="text-slate-600 hover:bg-slate-100" />
      </header>

      <SyncBar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
