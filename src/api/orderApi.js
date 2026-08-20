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

    let maxNum = 0;
    orders.forEach(o => {
      if (o.code && o.code.startsWith('HD')) {
        const num = parseInt(o.code.replace('HD', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    // Thử tối đa 5 lần, mỗi lần xác nhận lại mã chưa tồn tại (chống race
    // condition khi có request khác vừa tạo đơn xen giữa)
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateNum = maxNum + 1 + attempt;
      const candidateCode = `HD${candidateNum.toString().padStart(3, '0')}`;
      const checkRes = await axiosClient.get(`/orders?code=${candidateCode}`);
      if (checkRes.data.length === 0) {
        return candidateCode; // chắc chắn chưa ai dùng mã này
      }
    }
    throw new Error('Không thể tạo mã hóa đơn duy nhất, vui lòng thử lại.');
  }
};
