import axiosClient from './axiosClient';

export const inventoryApi = {
  getAllTransactions: (filters = {}) => {
    let query = '?';
    if (filters.productId) query += `productId=${filters.productId}&`;
    if (filters.type) query += `type=${filters.type}&`;
    // Filter theo date trên json-server có thể không triệt để nếu không dùng param đúng,
    // ta sẽ lọc thêm trên client cho khoảng ngày.
    return axiosClient.get(`/inventoryTransactions${query}`);
  },
  createTransaction: (data) => axiosClient.post('/inventoryTransactions', data),
  removeTransaction: (id) => axiosClient.delete(`/inventoryTransactions/${id}`)
};
