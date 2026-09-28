import axiosClient from './axiosClient';
import { assertPermission, hasPermission, PERMISSIONS } from '../utils/permissions';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';

export const productApi = {
  getAll: () => axiosClient.get('/products'),
  getById: (id) => axiosClient.get(`/products/${id}`),

  create: (data, actor) => {
    assertPermission(actor, PERMISSIONS.PRODUCT_MANAGE);
    return axiosClient.post('/products', data).then(res => {
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.PRODUCT_CREATE,
        entityType: 'product',
        entityId: res?.data?.id,
        metadata: { name: data.name },
      });
      return res;
    });
  },

  update: async (id, data, actor) => {
    assertPermission(actor, PERMISSIONS.PRODUCT_MANAGE);

    // Fetch existing product to preserve stockQuantity from unauthorized direct modification
    let existingStock = 0;
    try {
      const existingRes = await axiosClient.get(`/products/${id}`);
      if (existingRes?.data && typeof existingRes.data.stockQuantity === 'number') {
        existingStock = existingRes.data.stockQuantity;
      }
    } catch {
      // Fallback
    }

    const safeData = {
      ...data,
      stockQuantity: existingStock,
      updatedAt: new Date().toISOString()
    };

    return axiosClient.put(`/products/${id}`, safeData).then(res => {
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.PRODUCT_UPDATE,
        entityType: 'product',
        entityId: id,
        metadata: { name: safeData.name },
      });
      return res;
    });
  },

  patch: (id, data, actor) => {
    if (!actor) {
      assertPermission(actor, PERMISSIONS.PRODUCT_MANAGE);
    } else if (actor.role !== 'admin') {
      const canManage = hasPermission(actor, PERMISSIONS.PRODUCT_MANAGE) || hasPermission(actor, PERMISSIONS.INVENTORY_IMPORT);
      if (!canManage) {
        assertPermission(actor, PERMISSIONS.PRODUCT_MANAGE);
      }
    }

    if (data && Object.prototype.hasOwnProperty.call(data, 'stockQuantity')) {
      const err = new Error('STOCK_MUTATION_RESTRICTED: stockQuantity cannot be modified via generic patch. Use dedicated inventory workflow.');
      err.code = 'STOCK_MUTATION_RESTRICTED';
      throw err;
    }

    return axiosClient.patch(`/products/${id}`, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  },

  updateStock: async (id, newStock, actor, context = {}) => {
    // Controlled stock update method for legitimate workflows (Import, Export, Checkout, Cancellation, Opening)
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Authentication required for stock mutation.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const requiredPermission = PERMISSIONS.INVENTORY_ADJUST;
    if (!hasPermission(actor, requiredPermission) && actor.role !== 'admin') {
      const err = new Error(`PERMISSION_DENIED: Cần quyền "${requiredPermission}" để thay đổi tồn kho.`);
      err.code = 'PERMISSION_DENIED';
      err.requiredPermission = requiredPermission;
      throw err;
    }

    const stockNum = Number(newStock);
    if (isNaN(stockNum) || stockNum < 0) {
      const err = new Error('INVALID_STOCK: Số lượng tồn kho không được âm.');
      err.code = 'INVALID_STOCK';
      throw err;
    }

    const { expectedVersion } = context;
    const patchData = {
      stockQuantity: stockNum,
      updatedAt: new Date().toISOString()
    };

    let occSessionId = null;
    let expectedNextVersion = null;

    if (expectedVersion !== undefined) {
      expectedNextVersion = expectedVersion + 1;
      patchData.stockVersion = expectedNextVersion;
      // Add a random marker to detect if someone else wrote the exact same version
      occSessionId = Math.random().toString(36).substring(2);
      patchData._occSession = occSessionId;
    }

    const res = await axiosClient.patch(`/products/${id}`, patchData);

    if (expectedVersion !== undefined) {
      // Re-read to verify that our specific patch is still the latest
      const verifyRes = await axiosClient.get(`/products/${id}`);
      const serverVersion = verifyRes.data.stockVersion;
      const serverSession = verifyRes.data._occSession;

      if (serverVersion !== expectedNextVersion || serverSession !== occSessionId) {
        const err = new Error('OCC_CONFLICT: Tồn kho đã bị thay đổi bởi giao dịch khác (Lost Update detected).');
        err.code = 'OCC_CONFLICT';
        throw err;
      }
    }

    return res;
  },

  deductStockForCheckout: async (id, quantity, actor) => {
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Authentication required for stock mutation.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }
    const requiredPermission = PERMISSIONS.ORDER_CREATE;
    if (!hasPermission(actor, requiredPermission) && actor.role !== 'admin') {
      const err = new Error('PERMISSION_DENIED');
      err.code = 'PERMISSION_DENIED';
      err.requiredPermission = requiredPermission;
      throw err;
    }
    const stockNum = Number(quantity);
    if (isNaN(stockNum) || stockNum <= 0) {
      const err = new Error('INVALID_STOCK');
      err.code = 'INVALID_STOCK';
      throw err;
    }
    
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      try {
        const prodRes = await axiosClient.get(`/products/${id}`);
        const prod = prodRes.data;
        const currentStock = Number(prod.stockQuantity) || 0;
        const newStock = currentStock - stockNum;
        if (newStock < 0) {
          const err = new Error('INVALID_STOCK');
          err.code = 'INVALID_STOCK';
          throw err;
        }
        
        const expectedNextVersion = (prod.stockVersion || 0) + 1;
        const occSessionId = Math.random().toString(36).substring(2);
        const patchData = {
          stockQuantity: newStock,
          stockVersion: expectedNextVersion,
          _occSession: occSessionId,
          updatedAt: new Date().toISOString()
        };
        
        const res = await axiosClient.patch(`/products/${id}`, patchData);
        
        const verifyRes = await axiosClient.get(`/products/${id}`);
        if (verifyRes.data.stockVersion !== expectedNextVersion || verifyRes.data._occSession !== occSessionId) {
          const err = new Error('OCC_CONFLICT');
          err.code = 'OCC_CONFLICT';
          throw err;
        }
        return res;
      } catch (err) {
        if (err.code === 'OCC_CONFLICT' && attempt < 3) continue;
        throw err;
      }
    }
  },

  adjustStockDelta: async (id, delta, actor, context = {}, maxRetries = 3) => {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        const prodRes = await axiosClient.get(`/products/${id}`);
        const prod = prodRes.data;
        if (!prod) {
          const err = new Error(`PRODUCT_NOT_FOUND: Không tìm thấy sản phẩm ${id}`);
          err.code = 'PRODUCT_NOT_FOUND';
          throw err;
        }
        const currentStock = Number(prod.stockQuantity) || 0;
        const newStock = currentStock + Number(delta);
        if (newStock < 0) {
          const err = new Error('INVALID_STOCK: Số lượng tồn kho không được âm.');
          err.code = 'INVALID_STOCK';
          throw err;
        }
        return await productApi.updateStock(id, newStock, actor, {
          ...context,
          expectedVersion: prod.stockVersion
        });
      } catch (err) {
        if (err.code === 'OCC_CONFLICT' && attempt < maxRetries) {
          continue;
        }
        throw err;
      }
    }
  },

  softDelete: (id, actor) => {
    assertPermission(actor, PERMISSIONS.PRODUCT_DELETE);
    return axiosClient.patch(`/products/${id}`, { 
      isActive: false,
      updatedAt: new Date().toISOString()
    }).then(res => {
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.PRODUCT_DEACTIVATE,
        entityType: 'product',
        entityId: id,
      });
      return res;
    });
  },

  reactivate: (id, actor) => {
    assertPermission(actor, PERMISSIONS.PRODUCT_MANAGE);
    return axiosClient.patch(`/products/${id}`, {
      isActive: true,
      updatedAt: new Date().toISOString()
    }).then(res => {
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.PRODUCT_UPDATE,
        entityType: 'product',
        entityId: id,
        metadata: { action: 'reactivate' }
      });
      return res;
    });
  }
};
