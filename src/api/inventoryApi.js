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
        const err = new Error('INVALID_TRANSACTION_CONTEXT: Giao dịch xuất bán hàng (SALE) bắt buộc phải gắn với mã đơn hàng (orderId/orderCode).');
        err.code = 'INVALID_TRANSACTION_CONTEXT';
        throw err;
      }
      key = PERMISSIONS.ORDER_CREATE;
    } else if (data.reason === INVENTORY_REASONS.CANCEL_RESTOCK) {
      if (!extractedOrderCode) {
        const err = new Error('INVALID_TRANSACTION_CONTEXT: Giao dịch hoàn kho (CANCEL_RESTOCK) bắt buộc phải gắn với đơn hàng được hủy (orderId/orderCode).');
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
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Không tìm thấy đơn hàng "${extractedOrderCode}" trong hệ thống.`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (order.status !== 'completed') {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Đơn hàng "${extractedOrderCode}" chưa hoàn tất (trạng thái: ${order.status}).`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        const orderItem = (order.items || []).find(i => String(i.productId) === String(data.productId));
        if (!orderItem) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Sản phẩm "${data.productId}" không có trong đơn hàng "${extractedOrderCode}".`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (Number(data.quantity) !== Number(orderItem.quantity)) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Số lượng giao dịch (${data.quantity}) không khớp với số lượng trên đơn hàng (${orderItem.quantity}).`);
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
          const err = new Error(`DUPLICATE_TRANSACTION: Đã tồn tại giao dịch xuất kho SALE cho đơn hàng "${extractedOrderCode}".`);
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
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Không tìm thấy đơn hàng "${extractedOrderCode}" trong hệ thống.`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (order.status !== 'cancelled' && order.status !== 'historical_cancelled') {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Không thể tạo giao dịch hoàn kho cho đơn hàng chưa bị hủy (trạng thái: ${order.status}).`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        const orderItem = (order.items || []).find(i => String(i.productId) === String(data.productId));
        if (!orderItem) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Sản phẩm "${data.productId}" không có trong đơn hàng "${extractedOrderCode}".`);
          err.code = 'INVALID_TRANSACTION_CONTEXT';
          throw err;
        }
        if (Number(data.quantity) !== Number(orderItem.quantity)) {
          const err = new Error(`INVALID_TRANSACTION_CONTEXT: Số lượng hoàn kho (${data.quantity}) không khớp với số lượng trên đơn hàng (${orderItem.quantity}).`);
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
          const err = new Error(`DUPLICATE_TRANSACTION: Đã tồn tại giao dịch hoàn kho CANCEL_RESTOCK cho đơn hàng "${extractedOrderCode}".`);
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

    let requiredPermission = PERMISSIONS.INVENTORY_ADJUST;
    if (context.source === 'pos_checkout' || context.source === 'checkout') {
      requiredPermission = PERMISSIONS.ORDER_CREATE;
    } else if (context.source === 'order_cancellation') {
      requiredPermission = PERMISSIONS.ORDER_CANCEL;
    } else if (context.source === 'inventory_import') {
      requiredPermission = PERMISSIONS.INVENTORY_IMPORT;
    } else if (context.source === 'inventory_export') {
      requiredPermission = PERMISSIONS.INVENTORY_EXPORT;
    } else if (context.source === 'inventory_opening') {
      requiredPermission = PERMISSIONS.PRODUCT_CREATE;
    }

    if (requiredPermission && !hasPermission(actor, requiredPermission) && actor.role !== 'admin') {
      const err = new Error(`PERMISSION_DENIED: Cần quyền "${requiredPermission}" để hoàn tác giao dịch.`);
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
          const err = new Error('PERMISSION_DENIED: Bạn chỉ có thể hoàn tác giao dịch do chính mình tạo.');
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
  },

  // Hỗ trợ khởi tạo test fixture/dữ liệu mẫu nội bộ (nghiêm cấm dùng để tạo giao dịch SALE/CANCEL_RESTOCK né kiểm tra)
  createSystemTransaction: async (data) => {
    if (data?.reason === INVENTORY_REASONS.SALE || data?.reason === INVENTORY_REASONS.CANCEL_RESTOCK) {
      const err = new Error('INVALID_TRANSACTION_CONTEXT: Không thể tạo giao dịch SALE/CANCEL_RESTOCK qua system primitive.');
      err.code = 'INVALID_TRANSACTION_CONTEXT';
      throw err;
    }
    const payload = {
      ...data,
      businessDate: data?.businessDate || getBusinessDate(),
      createdAt: data?.createdAt || new Date().toISOString(),
    };
    return axiosClient.post('/inventoryTransactions', payload);
  }
};
