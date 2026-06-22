import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to dynamically inject the X-API-Key header
apiClient.interceptors.request.use(
  (config) => {
    const selectedApiKey = localStorage.getItem('selectedApiKey');
    if (selectedApiKey && selectedApiKey !== 'undefined' && selectedApiKey !== 'null') {
      config.headers['X-API-Key'] = selectedApiKey;
    }
    const token = localStorage.getItem('rag_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
