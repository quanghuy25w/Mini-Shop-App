 import axiosClient from './axiosClient';
import { assertPermission, hasPermission, PERMISSIONS } from '../utils/permissions';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';
import { getBusinessDate } from '../utils/businessDate';

export const INVENTORY_TYPES = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUST: 'ADJUST',
};

export const INVENTORY_REASONS = {
  OPENING: 'OPENING',               // Tồn đầu kỳ khi tạo sản phẩm
  PURCHASE: 'PURCHASE',             // Nhập mua từ nhà cung cấp
  SALE: 'SALE',                     // Bán lẻ tại quầy POS
  CANCEL_RESTOCK: 'CANCEL_RESTOCK', // Hoàn kho do hủy đơn hàng
  INTERNAL: 'INTERNAL',             // Xuất nội bộ / chuyển kho / trả NCC
  DAMAGE: 'DAMAGE',                 // Hàng hư hỏng / hết hạn
  ADJUST: 'ADJUST',                 // Kiểm kê / điều chỉnh kho
};

export const inventoryApi = {
  getAllTransactions: (filters = {}) => {
    let query = '?';
    if (filters.productId) query += `productId=${filters.productId}&`;
    if (filters.type) query += `type=${filters.type}&`;
    if (filters.reason) query += `reason=${filters.reason}&`;
    if (filters.businessDate) query += `businessDate=${filters.businessDate}&`;
    if (filters.orderId) query += `orderId=${filters.orderId}&`;
    if (filters.orderCode) query += `orderCode=${filters.orderCode}&`;
    return axiosClient.get(`/inventoryTransactions${query}`);
  },

  // Dùng cho nhập/xuất kho CHỦ ĐỘNG của người dùng (trang Nhập hàng/Xuất hàng, tạo SP có tồn đầu).
  createTransaction: (data, actor) => {
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Authentication required for inventory transaction.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const extractedOrderCode = data.orderCode || data.orderId || (data.note ? data.note.match(/(HD-[A-Za-z0-9_-]+)/)?.[1] : null);
    let key = PERMISSIONS.INVENTORY_EXPORT;
    if (data.reason === INVENTORY_REASONS.OPENING) {
      if (hasPermission(actor, PERMISSIONS.PRODUCT_MANAGE) || hasPermission(actor, PERMISSIONS.PRODUCT_CREATE)) {
        key = null; // Quyền quản lý sản phẩm hợp lệ cho tồn đầu kỳ
      } else {
        key = PERMISSIONS.INVENTORY_IMPORT;
      }
    } else if (data.reason === INVENTORY_REASONS.SALE) {
      if (!extractedOrderCode) {
        const err = new Error('INVALID_TRANSACTION_CONTEXT: Giao dá»‹ch xuáº¥t bÃ¡n hÃ ng (SALE) báº¯t buá»™c pháº£i gáº¯n vá»›i mÃ£ Ä‘Æ¡n hÃ ng (orderId/orderCode).');
        err.code = 'INVALID_TRANSACTION_CONTEXT';
        throw err;
      }
      key = PERMISSIONS.ORDER_CREATE;
    } else if (data.reason === INVENTORY_REASONS.CANCEL_RESTOCK) {
      if (!extractedOrderCode) {
        const err = new Error('INVALID_TRANSACTION_CONTEXT: Giao dá»‹ch hoÃ n kho (CANCEL_RESTOCK) báº¯t buá»™c pháº£i gáº¯n vá»›i Ä‘Æ¡n hÃ ng Ä‘Æ°á»£c há»§y (orderId/orderCode).');
        err.code = 'INVALID_TRANSACTION_CONTEXT';
        throw err;
      }
      key = PERMISSIONS.ORDER_CANCEL;
    } else if (data.type === 'IN') {
      key = PERMISSIONS.INVENTORY_IMPORT;
    } else if (data.type === 'ADJUST') {
      key = PERMISSIONS.INVENTORY_ADJUST;
    }

    if (key) {
      assertPermission(actor, key);
    }

    return (async () => {
      // 1. Lock down SALE transactions: must link to valid completed order
      if (data.reason === INVENTORY_REASONS.SALE) {
        const ordersRes = await axiosClient.get('/orders');
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const order = orders.find(o => o.code === extractedOrderCode || o.id === extractedOrderCode);
        if (!order) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng "${extractedOrderCode}" trong há»‡ thá»‘ng.`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (order.status !== 'completed') {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: ÄÆ¡n hÃ ng "${extractedOrderCode}" chÆ°a hoÃ n táº¥t (tráº¡ng thÃ¡i: ${order.status}).`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        const orderItem = (order.items || []).find(i => String(i.productId) === String(data.productId));
        if (!orderItem) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Sáº£n pháº©m "${data.productId}" khÃ´ng cÃ³ trong Ä‘Æ¡n hÃ ng "${extractedOrderCode}".`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (Number(data.quantity) !== Number(orderItem.quantity)) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Sá»‘ lÆ°á»£ng giao dá»‹ch (${data.quantity}) khÃ´ng khá»›p vá»›i sá»‘ lÆ°á»£ng trÃªn Ä‘Æ¡n hÃ ng (${orderItem.quantity}).`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        const txRes = await axiosClient.get('/inventoryTransactions');
        const allTx = Array.isArray(txRes.data) ? txRes.data : [];
        const duplicate = allTx.find(t =>
          (t.orderCode === extractedOrderCode || t.orderId === extractedOrderCode || (t.note && t.note.includes(extractedOrderCode))) &&
          String(t.productId) === String(data.productId) &&
          t.reason === INVENTORY_REASONS.SALE &&
          !t.isVoided
        );
        if (duplicate) {
          const err = new Error(`DUPLICATE_TRANSACTION: ÄÃ£ tá»“n táº¡i giao dá»‹ch xuáº¥t kho SALE cho Ä‘Æ¡n hÃ ng "${extractedOrderCode}".`);
          err.code = 'DUPLICATE_TRANSACTION';
          throw err;
        }
      }

      // 2. Lock down CANCEL_RESTOCK transactions: must link to valid cancelled order
      if (data.reason === INVENTORY_REASONS.CANCEL_RESTOCK) {
        const ordersRes = await axiosClient.get('/orders');
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const order = orders.find(o => o.code === extractedOrderCode || o.id === extractedOrderCode);
        if (!order) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng "${extractedOrderCode}" trong há»‡ thá»‘ng.`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (order.status !== 'cancelled' && order.status !== 'historical_cancelled') {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: KhÃ´ng thá»ƒ táº¡o giao dá»‹ch hoÃ n kho cho Ä‘Æ¡n hÃ ng chÆ°a bá»‹ há»§y (tráº¡ng thÃ¡i: ${order.status}).`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        const orderItem = (order.items || []).find(i => String(i.productId) === String(data.productId));
        if (!orderItem) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Sáº£n pháº©m "${data.productId}" khÃ´ng cÃ³ trong Ä‘Æ¡n hÃ ng "${extractedOrderCode}".`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (Number(data.quantity) !== Number(orderItem.quantity)) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Sá»‘ lÆ°á»£ng hoÃ n kho (${data.quantity}) khÃ´ng khá»›p vá»›i sá»‘ lÆ°á»£ng trÃªn Ä‘Æ¡n hÃ ng (${orderItem.quantity}).`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        const txRes = await axiosClient.get('/inventoryTransactions');
        const allTx = Array.isArray(txRes.data) ? txRes.data : [];
        const duplicate = allTx.find(t =>
          (t.orderCode === extractedOrderCode || t.orderId === extractedOrderCode || (t.note && t.note.includes(extractedOrderCode))) &&
          String(t.productId) === String(data.productId) &&
          t.reason === INVENTORY_REASONS.CANCEL_RESTOCK &&
          !t.isVoided
        );
        if (duplicate) {
          const err = new Error(`DUPLICATE_TRANSACTION: ÄÃ£ tá»“n táº¡i giao dá»‹ch hoÃ n kho CANCEL_RESTOCK cho Ä‘Æ¡n hÃ ng "${extractedOrderCode}".`);
          err.code = 'DUPLICATE_TRANSACTION';
          throw err;
        }
      }

      const payload = {
        ...data,
        reason: data.reason || (data.type === 'IN' ? INVENTORY_REASONS.PURCHASE : INVENTORY_REASONS.INTERNAL),
        orderCode: data.orderCode || extractedOrderCode || undefined,
        businessDate: data.businessDate || getBusinessDate(),
        createdAt: data.createdAt || new Date().toISOString(),
      };

      const res = await axiosClient.post('/inventoryTransactions', payload);
      logActivity({
        actor,
        action: payload.type === 'IN' ? ACTIVITY_ACTIONS.INVENTORY_IMPORT : ACTIVITY_ACTIONS.INVENTORY_EXPORT,
        entityType: 'inventoryTransaction',
        entityId: res?.data?.id,
        workSessionId: payload.workSessionId || null,
        metadata: { productId: payload.productId, quantity: payload.quantity, reason: payload.reason },
      });
      return res;
    })();
  },

  // Hủy giao dịch tạm/rollback in-flight (yêu cầu actor xác thực và quyền sở hữu/quyền theo source)
  removeTransaction: async (id, actor, context = {}) => {
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Authentication required to remove transaction.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const requiredPermission = PERMISSIONS.INVENTORY_ADJUST;
    if (!hasPermission(actor, requiredPermission) && actor.role !== 'admin') {
      const err = new Error(`PERMISSION_DENIED: Cáº§n quyá»n "${requiredPermission}" Ä‘á»ƒ hoÃ n tÃ¡c giao dá»‹ch.`);
      err.code = 'PERMISSION_DENIED';
      err.requiredPermission = requiredPermission;
      throw err;
    }

    // Nếu không phải admin hoặc quản lý điều chỉnh kho, chỉ được hoàn tác giao dịch do chính mình tạo
    if (actor.role !== 'admin' && !hasPermission(actor, PERMISSIONS.INVENTORY_ADJUST)) {
      try {
        const txRes = await axiosClient.get(`/inventoryTransactions/${id}`);
        const tx = txRes.data;
        if (tx && tx.accountId && String(tx.accountId) !== String(actor.id)) {
          const err = new Error('PERMISSION_DENIED: Báº¡n chá»‰ cÃ³ thá»ƒ hoÃ n tÃ¡c giao dá»‹ch do chÃ­nh mÃ¬nh táº¡o.');
          err.code = 'PERMISSION_DENIED';
          throw err;
        }
      } catch (getErr) {
        if (getErr.code === 'PERMISSION_DENIED') throw getErr;
      }
    }

    return axiosClient.delete(`/inventoryTransactions/${id}`);
  },

  // Đánh dấu giao dịch bị void (không xóa cứng lịch sử)
  voidTransaction: (id, actor) => {
    assertPermission(actor, PERMISSIONS.INVENTORY_ADJUST);
    return axiosClient.patch(`/inventoryTransactions/${id}`, {
      isVoided: true,
      voidedAt: new Date().toISOString(),
      voidedBy: actor?.id || null,
    });
  }
};
