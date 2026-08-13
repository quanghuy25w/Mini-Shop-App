import axios from 'axios';
import { handleLocalStorageRequest } from './localStorageAdapter';

export const checkDemoMode = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_DEMO_MODE === true)) {
    return true;
  }
  if (typeof process !== 'undefined' && process.env && (process.env.VITE_DEMO_MODE === 'true' || process.env.VITE_DEMO_MODE === '1')) {
    return true;
  }
  return false;
};

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
