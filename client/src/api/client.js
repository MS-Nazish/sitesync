import axios from 'axios';

export const TOKEN_KEY = 'sitesync_token';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or invalid token sends the user back to the login page
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/');
    if (err.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default api;

// True when the server could not be reached: no internet, or a proxy/host saying the API is down
export const isNetworkError = (err) => !err?.response || [502, 503, 504].includes(err.response.status);

// Pulls a readable message out of an API error, including JSON errors inside blob responses
export async function errorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message;
    } catch {
      return 'Download failed';
    }
  }
  return data?.message || err?.message || 'Something went wrong';
}

// Downloads a protected file (PDF / Excel) using the logged-in user's token
export async function downloadFile(url, fallbackName) {
  const res = await api.get(url, { responseType: 'blob' });
  const header = res.headers['content-disposition'] || '';
  const name = /filename="?([^"]+)"?/.exec(header)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
