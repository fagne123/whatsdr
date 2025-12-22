import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// Calls
export const getActiveCalls = async () => {
  const response = await api.get('/calls/active');
  return response.data;
};

export const getCallHistory = async (page = 1, limit = 20) => {
  const response = await api.get(`/calls/history?page=${page}&limit=${limit}`);
  return response.data;
};

export const clearCallHistory = async () => {
  const response = await api.delete('/calls/history');
  return response.data;
};

export const getCallById = async (id) => {
  const response = await api.get(`/calls/${id}`);
  return response.data;
};

export const startCall = async (phoneNumber) => {
  const response = await api.post('/calls/start', { phoneNumber });
  return response.data;
};

export const endCall = async (id) => {
  const response = await api.post(`/calls/${id}/end`);
  return response.data;
};

// Stats
export const getStats = async () => {
  const response = await api.get('/stats');
  return response.data;
};

export default api;
