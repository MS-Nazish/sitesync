import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calculator, ReceiptText } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useApi, useSites } from '../hooks/useApi';
import { useT } from '../i18n/LanguageContext';
import { Button, Card, EmptyState, Field, PageHeader, SiteSelect, Spinner, StatusBadge } from '../components/ui';
import { fmtDate, fmtShort, money, todayStr } from '../utils/format';

export default function Payroll() {
  const navigate = useNavigate();
  const { t } = useT();
  const { sites } = useSites();
  const [filters, setFilters] = useState({ site: '', status: '' });
  const { data: payrolls, loading } = useApi('/payroll', {
    site: filters.site || undefined,
    status: filters.status || undefined,
  });

  const [genSite, setGenSite] = useState('');
  const [genDate, setGenDate] = useState(todayStr());
  const site = genSite || sites[0]?._id || '';
  const { data: week } = useApi(site ? '/payroll/week' : null, { site, date: genDate });
  const [generating, setGenerating] = useState(false);
  const siteInfo = sites.find((s) => s._id === site);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/payroll/generate', { site, date: genDate });
      toast.success(t('pay.draftReady'));
      navigate(`/payroll/${res.data._id}`);
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PageHeader title={t('pay.title')} subtitle={t('pay.subtitle')} />

      <Card title={t('pay.generate')} className="mb-5">
        <div className="grid items-end gap-3 md:grid-cols-[1fr_200px_auto]">
          <Field label={t('common.site')}>
            <SiteSelect sites={sites} value={site} onChange={setGenSite} />
          </Field>
          <Field label={t('pay.anyDay')}>
            <input type="date" className="input" value={genDate} max={todayStr()} onChange={(e) => setGenDate(e.target.value || todayStr())} />
          </Field>
          <Button icon={Calculator} loading={generating} disabled={!site} onClick={generate}>
            {t('pay.generateDraft')}
          </Button>
        </div>
        {week && (
          <p className="mt-3 text-sm text-slate-600">
            <strong>{t('pay.weekInfo', { start: fmtDate(week.start), end: fmtDate(week.end) })}</strong>
            {siteInfo && <span className="text-slate-400"> · {t('pay.weekStartsOn', { day: t(`day.${siteInfo.weekStartDay}`) })}</span>}
            {' · '}
            {t('pay.regenNote')}
          </p>
        )}
      </Card>

      <Card
        title={t('pay.history')}
        actions={
          <>
            <SiteSelect sites={sites} value={filters.site} onChange={(v) => setFilters({ ...filters, site: v })} allowAll className="w-48 py-1.5" />
            <select className="input w-36 py-1.5" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">{t('pay.anyStatus')}</option>
              <option value="draft">{t('payrollStatus.draft')}</option>
              <option value="approved">{t('payrollStatus.approved')}</option>
              <option value="paid">{t('payrollStatus.paid')}</option>
            </select>
          </>
        }
        bodyClass="p-0"
      >
        {loading && !payrolls ? (
          <Spinner />
        ) : !payrolls?.length ? (
          <EmptyState icon={ReceiptText} title={t('pay.none')}>
            {t('pay.noneHint')}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('pay.week')}</th>
                  <th>{t('common.site')}</th>
                  <th className="text-end">{t('common.workers')}</th>
                  <th className="text-end">{t('pay.gross')}</th>
                  <th className="text-end">{t('pay.advances')}</th>
                  <th className="text-end">{t('pay.net')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p._id} className="cursor-pointer" onClick={() => navigate(`/payroll/${p._id}`)}>
                    <td>
                      <Link to={`/payroll/${p._id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                        {fmtShort(p.weekStart)} – {fmtDate(p.weekEnd)}
                      </Link>
                    </td>
                    <td className="text-slate-600">{p.site?.name}</td>
                    <td className="text-end">{p.totals.workers}</td>
                    <td className="text-end">{money(p.totals.gross)}</td>
                    <td className="text-end text-red-700">{money(p.totals.advances)}</td>
                    <td className="text-end font-bold">{money(p.totals.netPay)}</td>
                    <td>
                      <StatusBadge kind="payroll" value={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
