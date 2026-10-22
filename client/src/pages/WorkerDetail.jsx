import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Pencil, Phone, UserX } from 'lucide-react';
import api, { downloadFile, errorMessage } from '../api/client';
import { useApi, useSites } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Avatar, Badge, Button, Card, EmptyState, Ltr, Spinner, StatCard, StatusBadge } from '../components/ui';
import WorkerForm from '../components/WorkerForm';
import { fmtDate, fmtMonth, fmtShort, money } from '../utils/format';

const DAY_COLORS = {
  present: 'bg-emerald-500 text-white',
  half_day: 'bg-amber-400 text-slate-900',
  absent: 'bg-red-500 text-white',
};

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function MonthCalendar({ workerId }) {
  const { t } = useT();
  const [month, setMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const { data, loading } = useApi(`/workers/${workerId}/attendance`, { month });
  const byDate = new Map((data?.records || []).map((r) => [r.date, r]));

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const count = (s) => (data?.records || []).filter((r) => r.status === s).length;

  return (
    <Card
      title={t('wd.calendar')}
      actions={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('wd.prevMonth')}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="w-32 text-center text-sm font-semibold">{fmtMonth(month)}</span>
          <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t('wd.nextMonth')}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      }
    >
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <div key={d} className="truncate">
                {t(`dayShort.${d}`)}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const date = `${month}-${String(day).padStart(2, '0')}`;
              const rec = byDate.get(date);
              const title = rec
                ? `${t(`status.${rec.status}`)}${rec.overtimeHours ? ` ${t('wd.otShort', { h: rec.overtimeHours })}` : ''} · ${rec.site?.name}`
                : t('wd.notMarked');
              return (
                <div
                  key={date}
                  title={title}
                  className={`relative flex aspect-square items-center justify-center rounded-lg font-latin text-sm font-semibold ${rec ? DAY_COLORS[rec.status] : 'bg-slate-100 text-slate-400'}`}
                >
                  {day}
                  {rec?.overtimeHours > 0 && <span className="absolute end-1 top-0.5 text-[9px]">+{rec.overtimeHours}</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
            {['present', 'half_day', 'absent'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${DAY_COLORS[s].split(' ')[0]}`} />
                {t(`status.${s}`)} {count(s)}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

export default function WorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useT();
  const { sites } = useSites();
  const { data, loading, reload } = useApi(`/workers/${id}`);
  const { data: advances } = useApi('/advances', { worker: id });
  const [editing, setEditing] = useState(false);

  if (loading && !data) return <Spinner />;
  if (!data) return <EmptyState title={t('wd.notFound')} />;
  const { worker, stats, payrolls } = data;

  const deactivate = async () => {
    if (!window.confirm(t('wd.deactivateConfirm', { name: worker.name }))) return;
    try {
      await api.delete(`/workers/${id}`);
      toast.success(t('wd.deactivated'));
      reload();
    } catch (err) {
      toast.error(await errorMessage(err));
    }
  };

  const slip = (p) =>
    downloadFile(`/payroll/${p._id}/slip/${id}`, `wage-slip-${p.weekStart}.pdf`).catch(async (err) => toast.error(await errorMessage(err)));

  return (
    <>
      <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('common.back')}
      </button>

      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={worker.name} src={worker.photo} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{worker.name}</h1>
              {worker.active ? <Badge color="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {t(`skill.${worker.skill}`)} · <strong>{worker.site?.name}</strong>
              {worker.fatherName && ` · ${t('wd.so', { name: worker.fatherName })}`}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-500">
              {worker.phone && (
                <a href={`tel:${worker.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                  <Phone className="h-3.5 w-3.5" /> <Ltr>{worker.phone}</Ltr>
                </a>
              )}
              {worker.cnic && <span>{t('wd.cnic', { cnic: '' })}<Ltr>{worker.cnic}</Ltr></span>}
              {worker.joinedAt && <span>{t('wd.joined', { date: fmtDate(worker.joinedAt) })}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
            {isAdmin && worker.active && (
              <Button variant="secondary" icon={UserX} onClick={deactivate}>
                {t('wd.deactivate')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard label={t('workers.dailyWage')} value={money(worker.dailyWage)} hint={t('wd.otPerHour', { amount: money(worker.effectiveOvertimeRate) })} />
        <StatCard label={t('wd.daysPresent')} value={stats.present} hint={t('wd.allTime')} />
        <StatCard label={t('wd.halfAbsent')} value={`${stats.halfDay} / ${stats.absent}`} />
        <StatCard label={t('dash.unsettled')} value={money(stats.pendingAdvances)} tone="amber" />
        <StatCard label={t('wd.totalPaid')} value={money(stats.totalPaid)} hint={t('wd.last12')} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MonthCalendar workerId={id} />

        <Card title={t('adv.title')} bodyClass="p-0">
          {!advances?.length ? (
            <EmptyState title={t('wd.noAdvances')} />
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {advances.map((a) => (
                <li key={a._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-semibold">{money(a.amount)}</p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(a.date)}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                  </div>
                  {a.payroll ? <Badge color="green">{t('common.deducted')}</Badge> : <Badge color="yellow">{t('common.pending')}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t('wd.history')} className="mt-4" bodyClass="p-0">
        {!payrolls.length ? (
          <EmptyState title={t('wd.notInPayroll')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('pay.week')}</th>
                  <th>{t('common.site')}</th>
                  <th>{t('wd.days')}</th>
                  <th className="text-end">{t('pay.gross')}</th>
                  <th className="text-end">{t('common.deducted')}</th>
                  <th className="text-end">{t('pay.net')}</th>
                  <th>{t('common.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <Link to={`/payroll/${p._id}`} className="font-semibold hover:underline">
                        {fmtShort(p.weekStart)} – {fmtShort(p.weekEnd)}
                      </Link>
                    </td>
                    <td className="text-slate-600">{p.site?.name}</td>
                    <td>
                      <Ltr>
                        {p.line.presentDays} / {p.line.halfDays} / {p.line.absentDays}
                      </Ltr>
                    </td>
                    <td className="text-end">{money(p.line.gross)}</td>
                    <td className="text-end text-red-700">{money(p.line.deductions)}</td>
                    <td className="text-end font-bold">{money(p.line.netPay)}</td>
                    <td>
                      <StatusBadge kind="payroll" value={p.status} />
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" icon={Download} onClick={() => slip(p)}>
                        {t('wd.slip')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <WorkerForm open={editing} worker={worker} sites={sites} onClose={() => setEditing(false)} onSaved={reload} />
    </>
  );
}
