import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // EC-08: 30 s — surfaces as ECONNABORTED
});

// Attach JWT on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// EC-08: normalise errors so callers get a readable message
export function getErrorMessage(err) {
  if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out — please check your connection and try again.';
  }
  if (!err.response) {
    return 'Unable to reach the server. Please check your connection.'; // EC-05
  }
  if (err.response.status === 503) {
    return 'Service temporarily unavailable. Please try again shortly.'; // EC-05
  }
  if (err.response.status === 403) {
    return 'You do not have permission to perform this action.'; // EC-01
  }
  return err.response?.data?.detail || 'An unexpected error occurred.';
}

// Auto-refresh on 401; redirect to login if refresh fails (EC-02)
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh/`, { refresh });
          localStorage.setItem('access_token', data.access);
          localStorage.setItem('refresh_token', data.refresh);
          original.headers.Authorization = `Bearer ${data.access}`;
          return client(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login'; // EC-02
        }
      }
    }
    return Promise.reject(err);
  },
);

export default client;
