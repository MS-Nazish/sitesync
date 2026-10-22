import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage, isNetworkError, TOKEN_KEY } from '../api/client';
import { useT } from '../i18n/LanguageContext';
import { enqueueAttendance, listQueued, putQueued, removeQueued } from './queue';

const OfflineContext = createContext(null);
export const SYNCED_EVENT = 'sitesync:synced';

function toForm(item) {
  const form = new FormData();
  form.append('site', item.site);
  form.append('date', item.date);
  form.append('entries', JSON.stringify(item.entries));
  form.append('offline', 'true');
  form.append('capturedAt', item.capturedAt);
  if (item.gps) {
    form.append('lat', item.gps.lat);
    form.append('lng', item.gps.lng);
    form.append('accuracy', item.gps.accuracy);
  }
  if (item.photo) form.append('photo', item.photo, 'photo.jpg');
  return form;
}

export function OfflineProvider({ children }) {
  const { t } = useT();
  const [online, setOnline] = useState(navigator.onLine);
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await listQueued());
    } catch {
      setItems([]);
    }
  }, []);

  // Uploads queued sheets one by one. Stops at the first network error (still offline).
  const syncNow = useCallback(
    async ({ quiet = false } = {}) => {
      if (busy.current || !localStorage.getItem(TOKEN_KEY)) return;
      busy.current = true;
      setSyncing(true);
      let sent = 0;
      let failed = 0;
      let skipped = 0;
      try {
        const queued = (await listQueued()).filter((i) => i.status !== 'failed');
        for (const item of queued) {
          try {
            const res = await api.post('/attendance', toForm(item));
            skipped += res.data.skipped?.length || 0;
            await removeQueued(item.id);
            sent += 1;
          } catch (err) {
            if (isNetworkError(err)) break; // no connection: try again later
            if (err.response.status === 401) break; // logged out: keep it for after login
            await putQueued({ ...item, status: 'failed', error: await errorMessage(err) });
            failed += 1;
          }
        }
      } finally {
        busy.current = false;
        setSyncing(false);
        await refresh();
      }
      if (sent) {
        toast.success(t('sync.done', { n: sent }));
        window.dispatchEvent(new Event(SYNCED_EVENT));
      }
      if (skipped) toast.error(t('sync.skipped', { n: skipped }));
      if (failed) toast.error(t('sync.failed', { n: failed }));
      if (!quiet && !sent && !failed && navigator.onLine === false) toast.error(t('sync.offline'));
    },
    [refresh, t]
  );

  const enqueue = useCallback(
    async (data) => {
      await enqueueAttendance(data);
      await refresh();
    },
    [refresh]
  );

  const discard = useCallback(
    async (id) => {
      await removeQueued(id);
      await refresh();
    },
    [refresh]
  );

  const retry = useCallback(
    async (id) => {
      const item = (await listQueued()).find((i) => i.id === id);
      if (item) await putQueued({ ...item, status: 'pending', error: null });
      await syncNow();
    },
    [syncNow]
  );

  useEffect(() => {
    refresh().then(() => syncNow({ quiet: true }));
    const goOnline = () => {
      setOnline(true);
      syncNow({ quiet: true });
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // navigator.onLine can be wrong (Wi-Fi without internet), so also retry every minute
    const timer = setInterval(() => syncNow({ quiet: true }), 60 * 1000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, [refresh, syncNow]);

  const value = useMemo(
    () => ({
      online,
      items,
      pending: items.filter((i) => i.status !== 'failed'),
      failed: items.filter((i) => i.status === 'failed'),
      syncing,
      syncNow,
      enqueue,
      discard,
      retry,
    }),
    [online, items, syncing, syncNow, enqueue, discard, retry]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export const useOffline = () => useContext(OfflineContext);
