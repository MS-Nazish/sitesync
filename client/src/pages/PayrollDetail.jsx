import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import api, { downloadFile, errorMessage } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Button, Card, EmptyState, PageHeader, Spinner, StatCard, StatusBadge } from '../components/ui';
import SendSlipsModal from '../components/SendSlipsModal';
import { fmtDate, fmtDateTime, money } from '../utils/format';

export default function PayrollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useT();
  const { data: payroll, setData, loading } = useApi(`/payroll/${id}`);
  const [busy, setBusy] = useState('');
  const [sendOpen, setSendOpen] = useState(false);

  if (loading && !payroll) return <Spinner />;
  if (!payroll) return <EmptyState title={t('pd.notFound')} />;

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const action = (path, success, confirmText) => () => {
    if (confirmText && !window.confirm(confirmText)) return;
    run(path, async () => setData((await api.patch(`/payroll/${id}/${path}`)).data), success);
  };

  const regenerate = () =>
    run(
      'regen',
      async () => {
        const res = await api.post('/payroll/generate', { site: payroll.site._id, date: payroll.weekStart });
        setData({ ...res.data, site: payroll.site });
      },
      t('pd.refreshed')
    );

  const remove = () => {
    if (!window.confirm(t('pd.deleteConfirm'))) return;
    run(
      'delete',
      async () => {
        await api.delete(`/payroll/${id}`);
        navigate('/payroll');
      },
      t('pd.deleted')
    );
  };

  const tot = payroll.totals;
  const isDraft = payroll.status === 'draft';

  return (
    <>
      <Link to="/payroll" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('pd.all')}
      </Link>

      <PageHeader
        title={payroll.site.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t('pd.week', { start: fmtDate(payroll.weekStart), end: fmtDate(payroll.weekEnd) })}
            <StatusBadge kind="payroll" value={payroll.status} />
          </span>
        }
        actions={
          <>
            {!isDraft && (
              <Button variant="whatsapp" icon={Send} onClick={() => setSendOpen(true)}>
                {t('pd.sendSlips')}
              </Button>
            )}
            <Button variant="secondary" icon={FileText} loading={busy === 'pdf'} onClick={() => run('pdf', () => downloadFile(`/payroll/${id}/pdf`, 'payroll.pdf'))}>
              PDF
            </Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === 'xlsx'} onClick={() => run('xlsx', () => downloadFile(`/payroll/${id}/excel`, 'payroll.xlsx'))}>
              Excel
            </Button>
            {isDraft && (
              <Button variant="secondary" icon={RefreshCw} loading={busy === 'regen'} onClick={regenerate}>
                {t('pd.regenerate')}
              </Button>
            )}
            {isAdmin && isDraft && (
              <>
                <Button variant="ghost" icon={Trash2} loading={busy === 'delete'} onClick={remove} aria-label={t('pd.deleteDraft')} />
                <Button icon={BadgeCheck} loading={busy === 'approve'} onClick={action('approve', t('pd.approved'), t('pd.approveConfirm'))}>
                  {t('pd.approve')}
                </Button>
              </>
            )}
            {isAdmin && payroll.status === 'approved' && (
              <>
                <Button variant="secondary" icon={RotateCcw} loading={busy === 'reopen'} onClick={action('reopen', t('pd.reopened'), t('pd.reopenConfirm'))}>
                  {t('pd.reopen')}
                </Button>
                <Button
                  variant="success"
                  icon={Banknote}
                  loading={busy === 'pay'}
                  onClick={action('pay', t('pd.paid'), t('pd.payConfirm', { amount: money(tot.netPay) }))}
                >
                  {t('pd.markPaid')}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('common.workers')} value={tot.workers} />
        <StatCard label={t('pd.gross')} value={money(tot.gross)} tone="blue" />
        <StatCard label={t('pd.deductions')} value={money(tot.deductions)} tone="amber" hint={t('dash.givenThisWeek', { amount: money(tot.advances) })} />
        <StatCard label={t('pd.net')} value={money(tot.netPay)} tone="green" />
      </div>

      {isDraft && (
        <p className="mt-4 rounded-lg bg-slate-200/60 px-4 py-2 text-sm text-slate-700">
          {t('pd.draftNote')} {isAdmin ? t('pd.draftNoteAdmin') : t('pd.draftNoteSup')}
        </p>
      )}

      <Card className="mt-4" bodyClass="p-0">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.worker')}</th>
                <th className="text-end">{t('pd.rate')}</th>
                <th className="text-center">{t('statusShort.present')}</th>
                <th className="text-center">{t('statusShort.half_day')}</th>
                <th className="text-center">{t('statusShort.absent')}</th>
                <th className="text-end">{t('pd.otH')}</th>
                <th className="text-end">{t('pd.wages')}</th>
                <th className="text-end">{t('pd.otPay')}</th>
                <th className="text-end">{t('pay.gross')}</th>
                <th className="text-end">{t('pay.advances')}</th>
                <th className="text-end">{t('pd.prev')}</th>
                <th className="text-end">{t('pay.net')}</th>
                <th className="text-end">{t('pd.carry')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payroll.lines.map((l) => (
                <tr key={l.worker}>
                  <td>
                    <Link to={`/workers/${l.worker}`} className="font-semibold hover:underline">
                      {l.workerName}
                    </Link>
                    <p className="text-xs text-slate-500">{t(`skill.${l.skill}`)}</p>
                  </td>
                  <td className="text-end text-slate-600">{money(l.dailyWage)}</td>
                  <td className="text-center text-emerald-700">{l.presentDays}</td>
                  <td className="text-center text-amber-700">{l.halfDays}</td>
                  <td className="text-center text-red-700">{l.absentDays}</td>
                  <td className="text-end">{l.overtimeHours || '—'}</td>
                  <td className="text-end">{money(l.wages)}</td>
                  <td className="text-end">{l.overtimePay ? money(l.overtimePay) : '—'}</td>
                  <td className="text-end font-semibold">{money(l.gross)}</td>
                  <td className="text-end text-red-700">{l.advances ? `− ${money(l.advances)}` : '—'}</td>
                  <td className="text-end text-red-700">{l.previousBalance ? `− ${money(l.previousBalance)}` : '—'}</td>
                  <td className="text-end text-base font-bold">{money(l.netPay)}</td>
                  <td className={`text-end ${l.carryForward ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>
                    {l.carryForward ? money(l.carryForward) : '—'}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Download}
                      onClick={() => run(`slip-${l.worker}`, () => downloadFile(`/payroll/${id}/slip/${l.worker}`, 'wage-slip.pdf'))}
                      loading={busy === `slip-${l.worker}`}
                    >
                      {t('wd.slip')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td className="px-3 py-3">{t('common.total')}</td>
                <td colSpan={7} />
                <td className="px-3 text-end">{money(tot.gross)}</td>
                <td className="px-3 text-end text-red-700">− {money(tot.advances)}</td>
                <td />
                <td className="px-3 text-end text-base">{money(tot.netPay)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-slate-500">
        {t('pd.generatedBy', { name: payroll.generatedBy?.name || '—', time: fmtDateTime(payroll.updatedAt) })}
        {payroll.approvedBy && ` · ${t('pd.approvedBy', { name: payroll.approvedBy.name, time: fmtDateTime(payroll.approvedAt) })}`}
        {payroll.paidAt && ` · ${t('pd.paidOn', { time: fmtDateTime(payroll.paidAt) })}`}
      </p>

      {!isDraft && <SendSlipsModal open={sendOpen} payroll={payroll} onClose={() => setSendOpen(false)} />}
    </>
  );
}
