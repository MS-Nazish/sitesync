import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const saveSession = useCallback(({ token, user: u }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email, password) => saveSession((await api.post('/auth/login', { email, password })).data),
    [saveSession]
  );

  const setup = useCallback(async (data) => saveSession((await api.post('/auth/setup', data)).data), [saveSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    // Drop API responses the service worker cached for offline use, so the next user can't see them
    if ('caches' in window) caches.delete('api-cache').catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, setup, logout, isAdmin: user?.role === 'admin' }),
    [user, loading, login, setup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
