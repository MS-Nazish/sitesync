import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HandCoins, Plus, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useApi, useSites } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SiteSelect, Spinner } from '../components/ui';
import { fmtDate, money, todayStr } from '../utils/format';

function AdvanceForm({ open, sites, onClose, onSaved }) {
  const { t } = useT();
  const [site, setSite] = useState('');
  const [form, setForm] = useState({ worker: '', amount: '', date: todayStr(), note: '' });
  const [saving, setSaving] = useState(false);
  const { data: workers } = useApi(open && site ? '/workers' : null, { site });

  useEffect(() => {
    if (open) {
      setSite(sites[0]?._id || '');
      setForm({ worker: '', amount: '', date: todayStr(), note: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/advances', form);
      toast.success(t('adv.recorded'));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(await errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('adv.give')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="advance-form" loading={saving}>
            {t('adv.saveBtn')}
          </Button>
        </>
      }
    >
      <form id="advance-form" onSubmit={submit} className="grid gap-4">
        <Field label={t('common.site')}>
          <SiteSelect
            sites={sites}
            value={site}
            onChange={(v) => {
              setSite(v);
              setForm({ ...form, worker: '' });
            }}
          />
        </Field>
        <Field label={t('adv.workerReq')}>
          <select className="input" required value={form.worker} onChange={set('worker')}>
            <option value="">{t('adv.selectWorker')}</option>
            {(workers || []).map((w) => (
              <option key={w._id} value={w._id}>
                {w.name} — {t(`skill.${w.skill}`)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('adv.amountReq')}>
            <input className="input" type="number" min="1" required value={form.amount} onChange={set('amount')} />
          </Field>
          <Field label={t('common.date')}>
            <input className="input" type="date" max={todayStr()} value={form.date} onChange={set('date')} />
          </Field>
        </div>
        <Field label={t('adv.reason')}>
          <input className="input" value={form.note} onChange={set('note')} placeholder={t('adv.reasonPh')} />
        </Field>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{t('adv.info')}</p>
      </form>
    </Modal>
  );
}

export default function Advances() {
  const { user, isAdmin } = useAuth();
  const { t } = useT();
  const { sites } = useSites();
  const [filters, setFilters] = useState({ site: '', status: '' });
  const { data: advances, loading, reload } = useApi('/advances', {
    site: filters.site || undefined,
    status: filters.status || undefined,
  });
  const [open, setOpen] = useState(false);

  const pending = (advances || []).filter((a) => !a.payroll).reduce((s, a) => s + a.amount, 0);

  const remove = async (id) => {
    if (!window.confirm(t('adv.deleteConfirm'))) return;
    try {
      await api.delete(`/advances/${id}`);
      toast.success(t('adv.deleted'));
      reload();
    } catch (err) {
      toast.error(await errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title={t('adv.title')}
        subtitle={advances ? t('adv.subtitle', { amount: money(pending) }) : ' '}
        actions={
          <Button icon={Plus} onClick={() => setOpen(true)} disabled={!sites.length}>
            {t('adv.give')}
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <SiteSelect sites={sites} value={filters.site} onChange={(v) => setFilters({ ...filters, site: v })} allowAll />
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">{t('adv.allStatus')}</option>
            <option value="pending">{t('adv.pendingOnly')}</option>
            <option value="settled">{t('adv.settledOnly')}</option>
          </select>
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading && !advances ? (
          <Spinner />
        ) : !advances?.length ? (
          <EmptyState icon={HandCoins} title={t('adv.none')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.worker')}</th>
                  <th>{t('common.site')}</th>
                  <th className="text-end">{t('common.amount')}</th>
                  <th>{t('common.note')}</th>
                  <th>{t('adv.givenBy')}</th>
                  <th>{t('common.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {advances.map((a) => {
                  const canDelete = !a.payroll && (isAdmin || a.givenBy?._id === user._id);
                  return (
                    <tr key={a._id}>
                      <td>{fmtDate(a.date)}</td>
                      <td>
                        <Link to={`/workers/${a.worker?._id}`} className="font-semibold hover:underline">
                          {a.worker?.name}
                        </Link>
                      </td>
                      <td className="text-slate-600">{a.site?.name}</td>
                      <td className="text-end font-semibold">{money(a.amount)}</td>
                      <td className="max-w-[200px] truncate text-slate-600">{a.note || '—'}</td>
                      <td className="text-slate-600">{a.givenBy?.name}</td>
                      <td>{a.payroll ? <Badge color="green">{t('common.deducted')}</Badge> : <Badge color="yellow">{t('common.pending')}</Badge>}</td>
                      <td>{canDelete && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(a._id)} aria-label={t('common.delete')} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdvanceForm open={open} sites={sites.filter((s) => s.status !== 'completed')} onClose={() => setOpen(false)} onSaved={reload} />
    </>
  );
}
