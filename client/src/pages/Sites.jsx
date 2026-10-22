import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Crosshair, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useSites } from '../hooks/useApi';
import { useT } from '../i18n/LanguageContext';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { getPosition } from '../utils/device';
import { fmtDate, todayStr } from '../utils/format';

const EMPTY = { name: '', address: '', clientName: '', lat: '', lng: '', radiusMeters: 200, weekStartDay: 6, status: 'active', startDate: todayStr() };

function SiteForm({ open, site, onClose, onSaved }) {
  const { t } = useT();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(site ? { ...EMPTY, ...site, lat: site.location?.lat ?? '', lng: site.location?.lng ?? '' } : EMPTY);
  }, [open, site]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await getPosition();
      setForm((f) => ({ ...f, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
      toast.success(t('sites.locationSet', { m: pos.accuracy }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocating(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const hasPin = form.lat !== '' && form.lng !== '';
    const body = {
      name: form.name,
      address: form.address,
      clientName: form.clientName,
      radiusMeters: Number(form.radiusMeters),
      weekStartDay: Number(form.weekStartDay),
      status: form.status,
      startDate: form.startDate,
      location: hasPin ? { lat: Number(form.lat), lng: Number(form.lng) } : undefined,
    };
    setSaving(true);
    try {
      if (site) await api.put(`/sites/${site._id}`, body);
      else await api.post('/sites', body);
      toast.success(site ? t('sites.updated') : t('sites.created'));
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
      title={site ? t('common.editName', { name: site.name }) : t('sites.new')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="site-form" loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="site-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('sites.name')} className="sm:col-span-2">
          <input className="input" required value={form.name} onChange={set('name')} placeholder={t('sites.namePh')} />
        </Field>
        <Field label={t('sites.address')} className="sm:col-span-2">
          <input className="input" value={form.address} onChange={set('address')} />
        </Field>
        <Field label={t('sites.client')}>
          <input className="input" value={form.clientName} onChange={set('clientName')} />
        </Field>
        <Field label={t('sites.startDate')}>
          <input className="input" type="date" value={form.startDate || ''} onChange={set('startDate')} />
        </Field>

        <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="label mb-0">{t('sites.location')}</span>
            <Button variant="secondary" size="sm" icon={Crosshair} loading={locating} onClick={useMyLocation}>
              {t('sites.useMyLocation')}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('sites.lat')}>
              <input className="input" dir="ltr" type="number" step="any" value={form.lat} onChange={set('lat')} />
            </Field>
            <Field label={t('sites.lng')}>
              <input className="input" dir="ltr" type="number" step="any" value={form.lng} onChange={set('lng')} />
            </Field>
            <Field label={t('sites.radius')}>
              <input className="input" type="number" min="20" value={form.radiusMeters} onChange={set('radiusMeters')} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('sites.locationHint')}</p>
        </div>

        <Field label={t('sites.weekStart')}>
          <select className="input" value={form.weekStartDay} onChange={set('weekStartDay')}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {t(`day.${d}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.status')}>
          <select className="input" value={form.status} onChange={set('status')}>
            {['active', 'on_hold', 'completed'].map((s) => (
              <option key={s} value={s}>
                {t(`siteStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

export default function Sites() {
  const { t } = useT();
  const { sites, loading, reload } = useSites();
  const [editing, setEditing] = useState(null);

  const remove = async (site) => {
    if (!window.confirm(t('sites.deleteConfirm', { name: site.name }))) return;
    try {
      await api.delete(`/sites/${site._id}`);
      toast.success(t('sites.deleted'));
      reload();
    } catch (err) {
      toast.error(await errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title={t('sites.title')}
        subtitle={t('sites.subtitle')}
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            {t('sites.new')}
          </Button>
        }
      />

      {loading && !sites.length ? (
        <Spinner />
      ) : !sites.length ? (
        <Card>
          <EmptyState icon={Building2} title={t('sites.none')}>
            {t('sites.noneHint')}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => (
            <Card key={s._id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-900">{s.name}</h3>
                  <p className="truncate text-sm text-slate-500">{s.address || t('sites.noAddress')}</p>
                </div>
                <StatusBadge kind="site" value={s.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-slate-500">{t('sites.clientShort')}</dt>
                <dd className="truncate">{s.clientName || '—'}</dd>
                <dt className="text-slate-500">{t('sites.started')}</dt>
                <dd>{fmtDate(s.startDate)}</dd>
                <dt className="text-slate-500">{t('sites.weekStarts')}</dt>
                <dd>{t(`day.${s.weekStartDay}`)}</dd>
                <dt className="text-slate-500">{t('sites.gpsPin')}</dt>
                <dd>
                  {s.location?.lat != null ? (
                    <a
                      className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps?q=${s.location.lat},${s.location.lng}`}
                    >
                      <MapPin className="h-3.5 w-3.5" /> {t('sites.radiusM', { m: s.radiusMeters })}
                    </a>
                  ) : (
                    <Badge color="yellow">{t('sites.notSet')}</Badge>
                  )}
                </dd>
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <Link to="/workers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-brand-700">
                  <Users className="h-4 w-4" /> {t('common.workersCount', { n: s.workerCount })}
                </Link>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(s)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(s)} aria-label={t('common.delete')} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SiteForm open={Boolean(editing)} site={editing?._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />
    </>
  );
}
