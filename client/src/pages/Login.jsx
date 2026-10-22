import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarCheck, HardHat, MapPin, ReceiptText } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { LanguageToggle } from '../components/Layout';
import { Button, Field } from '../components/ui';

// Demo login buttons only appear locally, or when VITE_SHOW_DEMO=true is set for a demo deployment
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true';
const DEMO = [
  { role: 'admin', email: 'admin@sitesync.com', password: 'admin123' },
  { role: 'supervisor', email: 'ali@sitesync.com', password: 'super123' },
];

export default function Login() {
  const { login, setup } = useAuth();
  const { t } = useT();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/auth/status')
      .then((res) => setNeedsSetup(res.data.needsSetup))
      .catch(() => toast.error(t('login.serverDown')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsSetup) await setup(form);
      else await login(form.email, form.password);
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-slate-900">
            <HardHat className="h-6 w-6" />
          </div>
          <span className="font-latin text-xl font-bold">SiteSync</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">
            {t('login.heroTitle1')} <span className="text-brand-400">{t('login.heroTitle2')}</span>
          </h1>
          <ul className="mt-8 space-y-4 text-slate-300">
            <li className="flex gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-brand-400" /> {t('login.feature1')}
            </li>
            <li className="flex gap-3">
              <CalendarCheck className="h-5 w-5 shrink-0 text-brand-400" /> {t('login.feature2')}
            </li>
            <li className="flex gap-3">
              <ReceiptText className="h-5 w-5 shrink-0 text-brand-400" /> {t('login.feature3')}
            </li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">{t('login.footer')}</p>
        <div className="pointer-events-none absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-brand-500/10" />
      </div>

      <div className="relative flex items-center justify-center px-4 py-12">
        <LanguageToggle className="absolute end-4 top-4 text-slate-600 hover:bg-slate-200" />
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-slate-900">
              <HardHat className="h-5 w-5" />
            </div>
            <span className="font-latin text-lg font-bold">SiteSync</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">{needsSetup ? t('login.createAdmin') : t('login.signIn')}</h2>
          <p className="mt-1 text-sm text-slate-500">{needsSetup ? t('login.setupHint') : t('login.signInHint')}</p>

          <div className="mt-6 space-y-4">
            {needsSetup && (
              <>
                <Field label={t('login.yourName')}>
                  <input className="input" required value={form.name} onChange={set('name')} />
                </Field>
                <Field label={t('common.phone')}>
                  <input className="input" dir="ltr" value={form.phone} onChange={set('phone')} />
                </Field>
              </>
            )}
            <Field label={t('login.email')}>
              <input className="input" dir="ltr" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field label={t('login.password')}>
              <input
                className="input"
                dir="ltr"
                type="password"
                required
                minLength={6}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={set('password')}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {needsSetup ? t('login.createAccount') : t('login.signIn')}
            </Button>
          </div>

          {!needsSetup && SHOW_DEMO && (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
              <p className="label mb-0">{t('login.demo')}</p>
              <div className="mt-2 flex gap-2">
                {DEMO.map((d) => (
                  <Button
                    key={d.role}
                    variant="secondary"
                    size="sm"
                    onClick={() => setForm({ ...form, email: d.email, password: d.password })}
                  >
                    {t('login.fill', { role: t(`role.${d.role}`) })}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
