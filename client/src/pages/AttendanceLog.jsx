import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardList, CloudOff, Image, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useApi, useSites } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SiteSelect, Spinner, StatusBadge } from '../components/ui';
import { addDays, fmtDateTime, fmtWeekday, todayStr } from '../utils/format';

export default function AttendanceLog() {
  const { isAdmin } = useAuth();
  const { t } = useT();
  const [params] = useSearchParams();
  const { sites } = useSites();
  const [filters, setFilters] = useState({
    site: '',
    from: addDays(todayStr(), -6),
    to: todayStr(),
    flagged: params.get('flagged') === 'true',
  });
  const query = { ...filters, flagged: filters.flagged ? 'true' : undefined, site: filters.site || undefined };
  const { data: records, loading, reload } = useApi('/attendance', query);
  const [photo, setPhoto] = useState(null);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const remove = async (id) => {
    if (!window.confirm(t('log.deleteConfirm'))) return;
    try {
      await api.delete(`/attendance/${id}`);
      toast.success(t('log.deleted'));
      reload();
    } catch (err) {
      toast.error(await errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title={t('log.title')} subtitle={t('log.subtitle')} />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('common.site')}>
            <SiteSelect sites={sites} value={filters.site} onChange={(v) => set('site', v)} allowAll />
          </Field>
          <Field label={t('common.from')}>
            <input type="date" className="input" value={filters.from} onChange={(e) => set('from', e.target.value)} />
          </Field>
          <Field label={t('common.to')}>
            <input type="date" className="input" value={filters.to} onChange={(e) => set('to', e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-red-600" checked={filters.flagged} onChange={(e) => set('flagged', e.target.checked)} />
            {t('log.onlyFlagged')}
          </label>
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading && !records ? (
          <Spinner />
        ) : !records?.length ? (
          <EmptyState icon={ClipboardList} title={t('log.noRecords')}>
            {t('log.noRecordsHint')}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.worker')}</th>
                  <th>{t('common.site')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('att.ot')}</th>
                  <th>{t('log.location')}</th>
                  <th>{t('log.photo')}</th>
                  <th>{t('log.markedBy')}</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td>{fmtWeekday(r.date)}</td>
                    <td className="font-semibold">{r.worker?.name}</td>
                    <td className="text-slate-600">{r.site?.name}</td>
                    <td>
                      <StatusBadge kind="attendance" value={r.status} />
                    </td>
                    <td>{r.overtimeHours ? r.overtimeHours : '—'}</td>
                    <td>
                      {r.gps?.lat == null ? (
                        <Badge color="gray">{t('log.noGps')}</Badge>
                      ) : r.outsideGeofence ? (
                        <a href={`https://www.google.com/maps?q=${r.gps.lat},${r.gps.lng}`} target="_blank" rel="noreferrer">
                          <Badge color="red">{t('log.mAway', { m: r.distanceFromSite })}</Badge>
                        </a>
                      ) : (
                        <Badge color="green">{r.distanceFromSite != null ? t('log.onSite', { m: r.distanceFromSite }) : t('log.captured')}</Badge>
                      )}
                    </td>
                    <td>
                      {r.photo ? (
                        <button type="button" className="inline-flex items-center gap-1 text-brand-700 hover:underline" onClick={() => setPhoto(r)}>
                          <Image className="h-4 w-4" /> {t('common.view')}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-xs text-slate-500">
                      {r.markedBy?.name}
                      {r.offline && (
                        <Badge color="blue" className="ms-1" title={t('log.offlineHint', { time: fmtDateTime(r.capturedAt) })}>
                          <CloudOff className="h-3 w-3" /> {t('log.offline')}
                        </Badge>
                      )}
                      <br />
                      {fmtDateTime(r.updatedAt)}
                    </td>
                    {isAdmin && (
                      <td>
                        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(r._id)} aria-label={t('common.delete')} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={Boolean(photo)} title={photo ? `${photo.site?.name} · ${fmtWeekday(photo.date)}` : ''} onClose={() => setPhoto(null)} wide>
        {photo && <img src={photo.photo} alt={t('att.photoProof')} className="w-full rounded-lg" />}
      </Modal>
    </>
  );
}
