import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarCheck, Clock, HandCoins, HardHat, Wallet } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, StatCard, StatusBadge } from '../components/ui';
import { fmtDate, fmtLongDate, fmtShort, money } from '../utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { t, isRtl } = useT();
  const { data, loading } = useApi('/dashboard');

  if (loading || !data) return <Spinner />;
  const { totals, perSite, trend, pendingPayrolls, flagged, recentAdvances } = data;
  const marked = totals.present + totals.halfDay + totals.absent;
  const link = 'text-xs font-semibold text-brand-700 hover:underline';

  return (
    <>
      <PageHeader
        title={t('dash.greeting', { name: user.name })}
        subtitle={`${fmtLongDate(data.today)} · ${t('dash.activeSites', { n: totals.activeSites })}`}
        actions={
          <Link to="/attendance">
            <Button icon={CalendarCheck}>{t('dash.markToday')}</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          icon={HardHat}
          tone="green"
          label={t('dash.presentToday')}
          value={`${totals.present + totals.halfDay} / ${totals.activeWorkers}`}
          hint={t('dash.presentHint', { half: totals.halfDay, absent: totals.absent })}
        />
        <StatCard
          icon={Clock}
          tone={totals.notMarked ? 'amber' : 'green'}
          label={t('dash.notMarked')}
          value={totals.notMarked}
          hint={t('dash.markedSoFar', { n: marked })}
        />
        <StatCard
          icon={AlertTriangle}
          tone={totals.flaggedToday ? 'red' : 'slate'}
          label={t('dash.gpsFlags')}
          value={totals.flaggedToday}
          hint={t('dash.gpsFlagsHint')}
        />
        <StatCard icon={Wallet} tone="blue" label={t('dash.weekWages')} value={money(totals.weekWages)} hint={t('dash.weekWagesHint')} />
        <StatCard
          icon={HandCoins}
          tone="amber"
          label={t('dash.unsettled')}
          value={money(totals.pendingAdvances)}
          hint={t('dash.givenThisWeek', { amount: money(totals.weekAdvances) })}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title={t('dash.trend')} className="xl:col-span-2">
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 11 }} interval="preserveStartEnd" reversed={isRtl} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} orientation={isRtl ? 'right' : 'left'} />
                <Tooltip labelFormatter={fmtDate} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="present" name={t('status.present')} stackId="a" fill="#10b981" />
                <Bar dataKey="halfDay" name={t('status.half_day')} stackId="a" fill="#f59e0b" />
                <Bar dataKey="absent" name={t('status.absent')} stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('dash.payrollsWaiting')} actions={<Link to="/payroll" className={link}>{t('dash.allPayrolls')}</Link>} bodyClass="p-0">
          {pendingPayrolls.length === 0 ? (
            <EmptyState title={t('dash.nothingPending')}>{t('dash.nothingPendingHint')}</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingPayrolls.map((p) => (
                <li key={p._id}>
                  <Link to={`/payroll/${p._id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.site?.name}</p>
                      <p className="text-xs text-slate-500">
                        {fmtShort(p.weekStart)} – {fmtShort(p.weekEnd)} · {t('common.workersCount', { n: p.totals.workers })}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-bold">{money(p.totals.netPay)}</p>
                      <StatusBadge kind="payroll" value={p.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t('dash.sitesToday')} className="mt-5" bodyClass="p-0">
        {perSite.length === 0 ? (
          <EmptyState title={t('dash.noSites')}>{t('dash.noSitesHint')}</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.site')}</th>
                  <th>{t('common.workers')}</th>
                  <th>{t('dash.colMarked')}</th>
                  <th>{t('status.present')}</th>
                  <th>{t('dash.colHalf')}</th>
                  <th>{t('status.absent')}</th>
                  <th>{t('att.gpsFlag')}</th>
                  <th>{t('dash.colWeekWages')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {perSite.map((s) => (
                  <tr key={s._id}>
                    <td className="font-semibold">{s.name}</td>
                    <td>{s.workers}</td>
                    <td>
                      {s.marked >= s.workers && s.workers > 0 ? (
                        <Badge color="green">{t('dash.done')}</Badge>
                      ) : (
                        <Badge color="yellow">
                          {s.marked} / {s.workers}
                        </Badge>
                      )}
                    </td>
                    <td className="text-emerald-700">{s.present}</td>
                    <td className="text-amber-700">{s.halfDay}</td>
                    <td className="text-red-700">{s.absent}</td>
                    <td>{s.flagged ? <Badge color="red">{s.flagged}</Badge> : '—'}</td>
                    <td>
                      {money(s.weekWages)}
                      <span className="ms-1 text-xs text-slate-400">
                        ({fmtShort(s.weekStart)}–{fmtShort(s.weekEnd)})
                      </span>
                    </td>
                    <td className="text-end">
                      <Link to={`/attendance?site=${s._id}`} className={link}>
                        {t('dash.mark')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title={t('dash.flags7')} actions={<Link to="/attendance/log?flagged=true" className={link}>{t('dash.viewAll')}</Link>} bodyClass="p-0">
          {flagged.length === 0 ? (
            <EmptyState title={t('dash.noFlags')}>{t('dash.noFlagsHint')}</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {flagged.map((f) => (
                <li key={f._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{f.worker?.name}</p>
                    <p className="text-xs text-slate-500">
                      {f.site?.name} · {fmtDate(f.date)}
                    </p>
                  </div>
                  <Badge color="red">{t('dash.kmAway', { km: (f.distanceFromSite / 1000).toFixed(1) })}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('dash.recentAdvances')} actions={<Link to="/advances" className={link}>{t('dash.allAdvances')}</Link>} bodyClass="p-0">
          {recentAdvances.length === 0 ? (
            <EmptyState title={t('dash.noAdvances')} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentAdvances.map((a) => (
                <li key={a._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{a.worker?.name}</p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(a.date)}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold">{money(a.amount)}</p>
                    {a.payroll ? <Badge color="green">{t('common.deducted')}</Badge> : <Badge color="yellow">{t('common.pending')}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
