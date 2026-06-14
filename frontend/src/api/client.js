import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const IS_DEV   = import.meta.env.DEV;

// Static TNEMIS API key for this application (production).
const TNEMIS_API_KEY = import.meta.env.VITE_TNEMIS_API_KEY || 'test@123';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach auth headers on every request
client.interceptors.request.use((config) => {
  if (IS_DEV) {
    // Dev bypass: backend accepts 'dev' and reads X-Dev-Role to pick the user
    config.headers['Authorization'] = 'dev';
    const devRole = localStorage.getItem('cms_dev_role') || 'admin';
    config.headers['X-Dev-Role'] = devRole;
  } else {
    config.headers['Authorization'] = TNEMIS_API_KEY;
    const token = localStorage.getItem('tnemis_token');
    if (token) config.headers['Token'] = token;
  }

  // For FormData uploads, let the browser set Content-Type (includes multipart boundary)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// EC-08: normalise errors so callers get a readable message
export function getErrorMessage(err) {
  if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out — please check your connection and try again.';
  }
  if (!err.response) {
    return 'Unable to reach the server. Please check your connection.';
  }
  if (err.response.status === 503) {
    return 'Service temporarily unavailable. Please try again shortly.';
  }
  if (err.response.status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (err.response.status === 500 && err.response.data?.dataStatus === false) {
    return err.response.data.message || 'Authentication error. Please re-open from TNEMIS.';
  }
  return err.response?.data?.detail || 'An unexpected error occurred.';
}

// On TNEMIS auth failure (production only) clear token and redirect
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!IS_DEV) {
      const isAuthError =
        err.response?.status === 500 && err.response?.data?.dataStatus === false;
      if (isAuthError) {
        localStorage.removeItem('tnemis_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default client;
