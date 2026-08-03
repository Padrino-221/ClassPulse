import axios from 'axios';

export function getStoredToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

export function getStoredUser() {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Surface express-validator field errors ({ errors: [{ msg, ... }] }) through
    // the same data.error path every component already reads, so users see the
    // specific problem (e.g. "Enter a valid email address.") instead of a generic fallback.
    const data = error.response?.data;
    if (data && !data.error && Array.isArray(data.errors) && data.errors.length > 0) {
      data.error = data.errors[0].msg || 'Something went wrong. Please try again.';
    }
    if (error.response?.status === 401) {
      clearStoredAuth();
      window.location.href = '/lecturer/login';
    }
    return Promise.reject(error);
  }
);

export default api;
