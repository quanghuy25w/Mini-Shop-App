import axios from 'axios';
import { handleLocalStorageRequest, initSeedData } from './localStorageAdapter';

export const isLocalHostname = (hostname) => {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  if (hostname.endsWith('.local')) return true;
  
  // Kiểm tra dải IP LAN nội bộ (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  return false;
};

export const checkDemoMode = () => {
  // 1. Kiểm tra biến môi trường VITE_DEMO_MODE
  const envObj = typeof import.meta !== 'undefined' ? import.meta.env : null;
  if (envObj && (String(envObj['VITE_DEMO_MODE']) === 'true' || envObj['VITE_DEMO_MODE'] === true)) {
    return true;
  }

  const procObj = typeof process !== 'undefined' ? process.env : null;
  if (procObj && (String(procObj['VITE_DEMO_MODE']) === 'true' || procObj['VITE_DEMO_MODE'] === '1')) {
    return true;
  }

  // 2. Tự động chuyển sang Demo Mode nếu chạy trên domain Cloud (không phải localhost và không phải IP LAN nội bộ)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    if (hostname && !isLocalHostname(hostname)) {
      return true;
    }
  }

  return false;
};

// Khởi tạo Seed Data ngay khi module axiosClient nạp nếu ở Demo Mode
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
