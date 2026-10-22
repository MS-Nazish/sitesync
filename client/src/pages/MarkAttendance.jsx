import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, CheckCheck, CloudOff, Crosshair, Lock, MapPin, Save, Users } from 'lucide-react';
import api, { errorMessage, isNetworkError } from '../api/client';
import { useApi, useSites } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { SYNCED_EVENT, useOffline } from '../offline/OfflineContext';
import { queueId } from '../offline/queue';
import { Avatar, Badge, Button, Card, EmptyState, Field, Ltr, PageHeader, SiteSelect, Spinner } from '../components/ui';
import { compressImage, distanceInMeters, getPosition } from '../utils/device';
import { fmtDateTime, money, todayStr } from '../utils/format';

const OPTIONS = [
  { value: 'present', on: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'half_day', on: 'bg-amber-500 text-slate-900 border-amber-500' },
  { value: 'absent', on: 'bg-red-600 text-white border-red-600' },
];

export default function MarkAttendance() {
  const { user, isAdmin } = useAuth();
  const { t } = useT();
  const { online, items: queue, enqueue } = useOffline();
  const [params, setParams] = useSearchParams();
  const { sites } = useSites({ status: 'active' });
  const siteId = params.get('site') || sites[0]?._id || '';
  const [date, setDate] = useState(todayStr());

  const { data: sheet, loading, offline: sheetOffline, reload } = useApi(siteId ? '/attendance/sheet' : null, { site: siteId, date });

  const [entries, setEntries] = useState({});
  const [gps, setGps] = useState(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Sheets saved offline for this site and day, still waiting to upload
  const queued = queue.find((i) => i.id === queueId(siteId, date));
  // The queue is re-read every minute; compare by content so unsaved taps aren't reset
  const queuedKey = JSON.stringify(queued?.entries || []);
  const queuedIds = useMemo(() => new Set(JSON.parse(queuedKey).map((e) => e.worker)), [queuedKey]);

  // Fill the form from the server's records, then lay any not-yet-uploaded offline marks on top
  useEffect(() => {
    if (!sheet) return;
    const next = {};
    sheet.rows.forEach(({ worker, record }) => {
      if (record) next[worker._id] = { status: record.status, overtimeHours: record.overtimeHours || 0 };
    });
    JSON.parse(queuedKey).forEach((e) => {
      next[e.worker] = { status: e.status, overtimeHours: e.overtimeHours || 0 };
    });
    setEntries(next);
    setResult(null);
  }, [sheet, queuedKey]);

  useEffect(() => {
    window.addEventListener(SYNCED_EVENT, reload);
    return () => window.removeEventListener(SYNCED_EVENT, reload);
  }, [reload]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const site = sheet?.site;
  const distance = useMemo(() => {
    if (!gps || site?.location?.lat == null) return null;
    return distanceInMeters(gps, site.location);
  }, [gps, site]);
  const outside = distance != null && distance > site.radiusMeters;

  const editableRows = sheet?.rows.filter((r) => r.editable) || [];
  const counts = Object.values(entries).reduce(
    (c, e) => ({ ...c, [e.status]: (c[e.status] || 0) + 1 }),
    { present: 0, half_day: 0, absent: 0 }
  );
  const unmarked = (sheet?.rows.length || 0) - Object.keys(entries).length;

  const setStatus = (workerId, status) =>
    setEntries((prev) => ({ ...prev, [workerId]: { overtimeHours: 0, ...prev[workerId], status } }));
  const setOvertime = (workerId, hours) =>
    setEntries((prev) => ({ ...prev, [workerId]: { ...prev[workerId], overtimeHours: hours } }));

  const markAllPresent = () => {
    const next = { ...entries };
    editableRows.forEach(({ worker }) => {
      if (!next[worker._id]) next[worker._id] = { status: 'present', overtimeHours: 0 };
    });
    setEntries(next);
  };

  const captureLocation = async () => {
    setLocating(true);
    try {
      setGps(await getPosition());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocating(false);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const small = await compressImage(file);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
  };

  const clearProof = () => {
    setPhoto(null);
    setPreview(null);
  };

  const save = async () => {
    const editableIds = new Set(editableRows.map((r) => r.worker._id));
    const payload = Object.entries(entries)
      .filter(([id]) => editableIds.has(id))
      .map(([worker, e]) => ({ worker, status: e.status, overtimeHours: Number(e.overtimeHours) || 0 }));
    if (payload.length === 0) {
      toast.error(t('att.markOne'));
      return;
    }
    if (!gps && !window.confirm(t('att.noGpsConfirm'))) return;

    // No connection: keep it on the phone; OfflineProvider uploads it when the internet is back
    const saveOffline = async () => {
      await enqueue({ site: siteId, siteName: site?.name || '', date, entries: payload, gps, photo, userId: user._id });
      toast(t('att.savedOffline'), { icon: '📴', duration: 6000 });
      clearProof();
    };

    setSaving(true);
    try {
      if (!navigator.onLine) {
        await saveOffline();
        return;
      }
      const form = new FormData();
      form.append('site', siteId);
      form.append('date', date);
      form.append('entries', JSON.stringify(payload));
      if (gps) {
        form.append('lat', gps.lat);
        form.append('lng', gps.lng);
        form.append('accuracy', gps.accuracy);
      }
      if (photo) form.append('photo', photo);

      const res = await api.post('/attendance', form);
      setResult(res.data);
      toast.success(t('att.saved', { n: res.data.saved }));
      if (res.data.outsideGeofence) toast.error(t('att.flaggedToast', { distance: res.data.distanceFromSite }), { duration: 6000 });
      clearProof();
      reload();
    } catch (err) {
      if (isNetworkError(err)) await saveOffline();
      else toast.error(await errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={t('att.title')} subtitle={t('att.subtitle')} />

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <SiteSelect sites={sites} value={siteId} onChange={(id) => setParams({ site: id })} />
        <input
          type="date"
          className="input"
          value={date}
          max={todayStr()}
          disabled={!isAdmin}
          onChange={(e) => setDate(e.target.value || todayStr())}
          title={isAdmin ? t('att.dateAdmin') : t('att.dateSupervisor')}
        />
      </div>

      {!siteId ? (
        <Card className="mt-4">
          <EmptyState icon={MapPin} title={t('att.noSite')}>
            {isAdmin ? (
              <Link className="text-brand-700 underline" to="/sites">
                {t('att.addSiteFirst')}
              </Link>
            ) : (
              t('att.askAdmin')
            )}
          </EmptyState>
        </Card>
      ) : loading && !sheet ? (
        <Spinner />
      ) : !sheet ? (
        <Card className="mt-4">
          <EmptyState icon={CloudOff} title={sheetOffline ? t('att.offlineNoSheet') : t('att.noSite')} />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card
            title={t('common.workersCount', { n: sheet.rows.length })}
            actions={
              editableRows.length > 0 && (
                <Button variant="secondary" size="sm" icon={CheckCheck} onClick={markAllPresent}>
                  {t('att.markRest')}
                </Button>
              )
            }
            bodyClass="p-0"
          >
            {!online && (
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700">
                <CloudOff className="h-4 w-4 shrink-0" /> {t('att.offlineSheet')}
              </div>
            )}
            {sheet.payrollLocked && (
              <div className="flex items-center gap-2 border-b border-sky-100 bg-sky-50 px-4 py-2 text-sm text-sky-800">
                <Lock className="h-4 w-4 shrink-0" /> {t('att.locked')}
              </div>
            )}
            {sheet.rows.length === 0 ? (
              <EmptyState icon={Users} title={t('att.noWorkers')}>
                <Link className="text-brand-700 underline" to="/workers">
                  {t('att.noWorkersHint')}
                </Link>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sheet.rows.map(({ worker, record, editable }) => {
                  const entry = entries[worker._id];
                  return (
                    <li key={worker._id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${!entry ? 'bg-amber-50/40' : ''}`}>
                      <Avatar name={worker.name} src={worker.photo} />
                      <div className="min-w-[150px] flex-1">
                        <p className="truncate font-semibold text-slate-800">
                          {worker.name}
                          {!editable && <Lock className="ms-1.5 inline h-3.5 w-3.5 text-slate-400" />}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-1 text-xs text-slate-500">
                          <span>
                            {t(`skill.${worker.skill}`)} · {t('att.perDay', { amount: money(worker.dailyWage) })}
                          </span>
                          {record && !queuedIds.has(worker._id) && <span>· {t('att.savedAt', { time: fmtDateTime(record.updatedAt) })}</span>}
                          {queuedIds.has(worker._id) && (
                            <Badge color="blue">
                              <CloudOff className="h-3 w-3" /> {t('att.pendingSync')}
                            </Badge>
                          )}
                          {record?.outsideGeofence && <Badge color="red">{t('att.gpsFlag')}</Badge>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex overflow-hidden rounded-lg border border-slate-300">
                          {OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              disabled={!editable}
                              title={t(`status.${o.value}`)}
                              aria-label={t(`status.${o.value}`)}
                              onClick={() => setStatus(worker._id, o.value)}
                              className={`h-10 w-11 border-s border-slate-300 text-sm font-bold first:border-s-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                                entry?.status === o.value ? o.on : 'bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {t(`statusShort.${o.value}`)}
                            </button>
                          ))}
                        </div>
                        <label className="flex items-center gap-1 text-xs text-slate-500" title={t('att.otTitle')}>
                          {t('att.ot')}
                          <input
                            type="number"
                            min="0"
                            max="16"
                            step="0.5"
                            className="input w-16 px-2 py-2"
                            disabled={!editable || !entry || entry.status === 'absent'}
                            value={entry?.overtimeHours || ''}
                            placeholder="0"
                            onChange={(e) => setOvertime(worker._id, e.target.value)}
                          />
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="space-y-4">
            <Card title={t('att.proof')}>
              <div className="space-y-4">
                <div>
                  <span className="label">{t('att.location')}</span>
                  <Button variant="secondary" className="w-full" icon={Crosshair} loading={locating} onClick={captureLocation}>
                    {gps ? t('att.captureAgain') : t('att.captureLocation')}
                  </Button>
                  {gps && (
                    <div className={`mt-2 rounded-lg p-3 text-sm ${outside ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
                      {distance == null ? (
                        t('att.noPin')
                      ) : outside ? (
                        <>
                          <strong>{t('att.outside', { distance })}</strong> {t('att.outsideHint', { radius: site.radiusMeters })}
                        </>
                      ) : (
                        <>
                          <strong>{t('att.onSite')}</strong> {t('att.onSiteHint', { distance })}
                        </>
                      )}
                      <p className="mt-1 text-xs opacity-75">
                        <Ltr>
                          {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} · ±{gps.accuracy} m
                        </Ltr>
                      </p>
                    </div>
                  )}
                </div>

                <Field label={t('att.photo')}>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600 hover:border-brand-500">
                    <Camera className="h-5 w-5" /> {photo ? t('att.retakePhoto') : t('att.takePhoto')}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
                  </label>
                  {preview && <img src={preview} alt={t('att.photoProof')} className="mt-2 h-40 w-full rounded-lg object-cover" />}
                </Field>
              </div>
            </Card>

            <Card>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <p className="text-xl font-bold text-emerald-600">{counts.present}</p>
                  <p className="text-xs text-slate-500">{t('status.present')}</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600">{counts.half_day}</p>
                  <p className="text-xs text-slate-500">{t('status.half_day')}</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">{counts.absent}</p>
                  <p className="text-xs text-slate-500">{t('status.absent')}</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-400">{unmarked}</p>
                  <p className="text-xs text-slate-500">{t('att.left')}</p>
                </div>
              </div>
              <Button className="mt-4 w-full" size="lg" icon={Save} loading={saving} disabled={editableRows.length === 0} onClick={save}>
                {t('att.save')}
              </Button>
              {result?.skipped?.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">{t('att.notSaved')}</p>
                  <ul className="mt-1 list-disc ps-4">
                    {result.skipped.map((s, i) => (
                      <li key={i}>
                        {s.worker}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
