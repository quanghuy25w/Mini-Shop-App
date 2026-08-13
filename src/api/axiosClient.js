import axios from 'axios';
import { handleLocalStorageRequest, initSeedData } from './localStorageAdapter';

export const checkDemoMode = () => {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]') {
      return true;
    }
  }

  const envObj = typeof import.meta !== 'undefined' ? import.meta.env : null;
  if (envObj && (String(envObj['VITE_DEMO_MODE']) === 'true' || envObj['VITE_DEMO_MODE'] === true)) {
    return true;
  }

  const procObj = typeof process !== 'undefined' ? process.env : null;
  if (procObj && (String(procObj['VITE_DEMO_MODE']) === 'true' || procObj['VITE_DEMO_MODE'] === '1')) {
    return true;
  }

  return false;
};

// Khởi tạo Seed Data ngay khi module axiosClient nạp trong Demo Mode
if (checkDemoMode()) {
  initSeedData();
}

const realAxiosClient = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

const axiosClient = {
  get: (url, config) => {
    if (checkDemoMode()) {
      return handleLocalStorageRequest('GET', url);
    }
    return realAxiosClient.get(url, config);
  },
  post: (url, data, config) => {
    if (checkDemoMode()) {
      return handleLocalStorageRequest('POST', url, data);
    }
    return realAxiosClient.post(url, data, config);
  },
  put: (url, data, config) => {
    if (checkDemoMode()) {
      return handleLocalStorageRequest('PUT', url, data);
    }
    return realAxiosClient.put(url, data, config);
  },
  patch: (url, data, config) => {
    if (checkDemoMode()) {
      return handleLocalStorageRequest('PATCH', url, data);
    }
    return realAxiosClient.patch(url, data, config);
  },
  delete: (url, config) => {
    if (checkDemoMode()) {
      return handleLocalStorageRequest('DELETE', url);
    }
    return realAxiosClient.delete(url, config);
  }
};

export default axiosClient;
