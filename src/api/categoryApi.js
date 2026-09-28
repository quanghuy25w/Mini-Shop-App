import axiosClient from './axiosClient';
import { assertPermission, PERMISSIONS } from '../utils/permissions';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';

export const categoryApi = {
  getAll: () => axiosClient.get('/categories'),
  getById: (id) => axiosClient.get(`/categories/${id}`),
  create: (data, actor) => {
    assertPermission(actor, PERMISSIONS.CATEGORY_MANAGE);
    return axiosClient.post('/categories', data).then(res => {
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.CATEGORY_CREATE,
        entityType: 'category',
        entityId: res?.data?.id,
        metadata: { name: data.name },
      });
      return res;
    });
  },
  update: (id, data, actor) => {
    assertPermission(actor, PERMISSIONS.CATEGORY_MANAGE);
    return axiosClient.put(`/categories/${id}`, data).then(res => {
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.CATEGORY_UPDATE,
        entityType: 'category',
        entityId: id,
        metadata: { name: data.name },
      });
      return res;
    });
  },
  patch: (id, data, actor) => {
    assertPermission(actor, PERMISSIONS.CATEGORY_MANAGE);
    return axiosClient.patch(`/categories/${id}`, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  },
  remove: (id, actor) => {
    assertPermission(actor, PERMISSIONS.CATEGORY_DELETE);
    
    return (async () => {
      // Check if category has active products
      const productsRes = await axiosClient.get('/products');
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const hasActiveProducts = products.some(p => String(p.categoryId) === String(id) && p.isActive === true);
      if (hasActiveProducts) {
        const err = new Error('CATEGORY_HAS_ACTIVE_PRODUCTS: Không thể xóa danh mục đang chứa sản phẩm đang hoạt động.');
        err.code = 'CATEGORY_HAS_ACTIVE_PRODUCTS';
        throw err;
      }
      return axiosClient.patch(`/categories/${id}`, {
        isActive: false,
        updatedAt: new Date().toISOString()
      }).then(res => {
        logActivity({
          actor,
          action: ACTIVITY_ACTIONS.CATEGORY_DEACTIVATE,
          entityType: 'category',
          entityId: id,
        });
        return res;
      });
    })();
  }
};
