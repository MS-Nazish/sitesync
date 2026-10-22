import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage, isNetworkError } from '../api/client';

// Loads a GET endpoint and re-loads when the url or params change. Pass url = null to skip.
// `offline` is true when the request failed because there is no connection (no toast in that case).
export function useApi(url, params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  const key = JSON.stringify(params || {});

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      setData(res.data);
    } catch (err) {
      if (isNetworkError(err)) {
        setOffline(true);
        setError('offline');
      } else {
        const msg = await errorMessage(err);
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, error, offline, reload };
}

// Sites the current user can see, used by every site picker
export function useSites(params) {
  const { data, loading, reload } = useApi('/sites', params);
  return { sites: data || [], loading, reload };
}
