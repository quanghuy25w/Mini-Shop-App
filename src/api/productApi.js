import axiosClient from './axiosClient';

export const productApi = {
  getAll: () => axiosClient.get('/products'),
  getById: (id) => axiosClient.get(`/products/${id}`),
  getByCategoryId: (categoryId) => axiosClient.get(`/products?categoryId=${categoryId}`),
  create: (data) => axiosClient.post('/products', data),
  update: (id, data) => axiosClient.put(`/products/${id}`, data),
  patch: (id, data) => axiosClient.patch(`/products/${id}`, data),
  softDelete: (id) => axiosClient.patch(`/products/${id}`, { isActive: false })
};
