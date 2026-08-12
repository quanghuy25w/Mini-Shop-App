import axiosClient from './axiosClient';

export const orderApi = {
  getAll: () => axiosClient.get('/orders'),
  getById: (id) => axiosClient.get(`/orders/${id}`),
  create: (data) => axiosClient.post('/orders', data),
  updateStatus: (id, status) => axiosClient.patch(`/orders/${id}`, { status }),
  remove: (id) => axiosClient.delete(`/orders/${id}`),

  generateOrderCode: async () => {
    const res = await axiosClient.get('/orders');
    const orders = res.data;
    if (orders.length === 0) return 'HD001';
    
    let maxNum = 0;
    orders.forEach(o => {
      if (o.code && o.code.startsWith('HD')) {
        const num = parseInt(o.code.replace('HD', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    
    const nextNum = maxNum + 1;
    return `HD${nextNum.toString().padStart(3, '0')}`;
  }
};
