import axios from 'axios';

const axiosClient = axios.create({
  baseURL: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ? import.meta.env.VITE_API_BASE_URL : 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error && !error.response && error.message === 'Network Error') {
      console.error('API is unavailable. Please ensure json-server is running.');
      const customError = new Error('Hệ thống máy chủ không phản hồi. Vui lòng kiểm tra kết nối mạng hoặc liên hệ quản trị viên (API_UNAVAILABLE).');
      customError.code = 'API_UNAVAILABLE';
      return Promise.reject(customError);
    }
    if (error?.response?.data) {
      const serverMsg = error.response.data.message || error.response.data.error;
      if (serverMsg && typeof serverMsg === 'string') {
        error.message = `${serverMsg} (${error.response.status})`;
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
