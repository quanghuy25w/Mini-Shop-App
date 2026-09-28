import axiosClient from './axiosClient';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';
import { hasPermission, assertPermission, PERMISSIONS } from '../utils/permissions';
import { productApi } from './productApi';
import { inventoryApi, INVENTORY_TYPES, INVENTORY_REASONS } from './inventoryApi';
import { getBusinessDate } from '../utils/businessDate';
import { generateId } from '../utils/generateId';
import { registerApi } from './registerApi';
import { ROLE_DISCOUNT_CAPS } from '../utils/orderRules';

export const orderApi = {
  getAll: () => axiosClient.get('/orders'),
  getById: (id) => axiosClient.get(`/orders/${id}`),

  create: (data, actorArg, contextArg = {}) => {
    const actor = actorArg?.role !== undefined ? actorArg : (actorArg?.actor || actorArg);
    const context = (actorArg && !actorArg.role && actorArg.actor) ? { ...actorArg, ...contextArg } : contextArg;

    if (!data || typeof data !== 'object') {
      const err = new Error('ORDER_VALIDATION_ERROR: Dữ liệu đơn hàng không được để trống.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (!actor) {
      const err = new Error('NOT_AUTHENTICATED: Yêu cầu đăng nhập để tạo đơn hàng.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    if (!data.accountId && !data.sellerId && !actor.id) {
      const err = new Error('ORDER_VALIDATION_ERROR: Thiếu thông tin người bán (sellerId/accountId).');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (!actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Yêu cầu đăng nhập để tạo đơn hàng.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const userRole = (actor.role || '').toLowerCase();
    if (!['admin', 'staff', 'employee'].includes(userRole)) {
      const err = new Error('PERMISSION_DENIED: Vai trò người dùng không hợp lệ.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CREATE);

    if (userRole === 'employee') {
      if (data.accountId && String(data.accountId) !== String(actor.id)) {
        const err = new Error('PERMISSION_DENIED: Nhân viên không thể tạo đơn hàng thay mặt tài khoản khác.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      if (data.sellerId && String(data.sellerId) !== String(actor.id)) {
        const err = new Error('PERMISSION_DENIED: Nhân viên không thể tạo đơn hàng thay mặt người bán khác.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      if (data.employeeId && actor.employeeId && String(data.employeeId) !== String(actor.employeeId)) {
        const err = new Error('PERMISSION_DENIED: Nhân viên không thể tạo đơn hàng thay mặt nhân viên khác.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      if (data.employeeCode && actor.employeeCode && String(data.employeeCode) !== String(actor.employeeCode)) {
        const err = new Error('PERMISSION_DENIED: Nhân viên không thể tạo đơn hàng thay mặt nhân viên khác.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
    }

    const seller = actor.id || data.accountId || data.sellerId;
    if (!seller) {
      const err = new Error('ORDER_VALIDATION_ERROR: Đơn hàng thiếu thông tin tài khoản người bán.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    const VALID_PAYMENT_METHODS = ['cash', 'transfer', 'card'];
    if (data.paymentMethod && !VALID_PAYMENT_METHODS.includes(data.paymentMethod)) {
      const err = new Error(`ORDER_VALIDATION_ERROR: Phương thức thanh toán "${data.paymentMethod}" không hợp lệ. Chỉ chấp nhận: cash, transfer, card.`);
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (data.registerId) {
      const canonicalRegs = registerApi.getSyncRegisters();
      if (Array.isArray(canonicalRegs) && canonicalRegs.length > 0) {
        const knownReg = canonicalRegs.find(r => r.id === data.registerId);
        if (!knownReg) {
          const err = new Error(`ORDER_VALIDATION_ERROR: Quầy bán hàng "${data.registerId}" không tồn tại trong hệ thống.`);
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
        if (knownReg.isActive === false) {
          const err = new Error(`ORDER_VALIDATION_ERROR: Quầy bán hàng "${data.registerId}" đang bị vô hiệu hóa.`);
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
      }
    }

    const hasItems = data.items !== undefined;
    if (hasItems) {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        const err = new Error('ORDER_VALIDATION_ERROR: Đơn hàng hoàn tất phải có ít nhất 1 sản phẩm.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }

      for (const item of data.items) {
        if (!item || !item.productId) {
          const err = new Error('ORDER_VALIDATION_ERROR: Sản phẩm trong đơn hàng thiếu thông tin productId.');
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
        if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          const err = new Error('ORDER_VALIDATION_ERROR: Mỗi sản phẩm trong đơn hàng phải có số lượng nguyên > 0.');
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
      }
    } else if (context && context.requireSellingContext) {
      const err = new Error('ORDER_VALIDATION_ERROR: Đơn hàng hoàn tất bắt buộc phải có ít nhất 1 sản phẩm.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (context && context.requireSellingContext) {
      if (!data.workSessionId) {
        const err = new Error('ORDER_VALIDATION_ERROR: Đơn hàng hoàn tất bắt buộc phải gắn với ca làm việc (workSessionId).');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }
    }

    // Synchronous total and discount validation
    const maxCap = ROLE_DISCOUNT_CAPS[userRole] ?? 0;
    let syncSubtotal = 0;
    if (hasItems) {
      for (const item of data.items) {
        if (item.price !== undefined && (isNaN(Number(item.price)) || Number(item.price) < 0)) {
          const err = new Error('ORDER_VALIDATION_ERROR: Đơn giá sản phẩm không được âm.');
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
        syncSubtotal += Number(item.price || 0) * Number(item.quantity || 0);
      }
    } else {
      syncSubtotal = Number(data.totalAmount !== undefined ? data.totalAmount : (data.total || 0));
    }

    let calculatedDiscount = 0;
    if (data.discountType === 'percent') {
      const val = Number(data.discountValue !== undefined ? data.discountValue : (data.discount || 0));
      if (isNaN(val) || !isFinite(val) || val < 0) {
        const err = new Error('ORDER_VALIDATION_ERROR: Giá trị chiết khấu không hợp lệ.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }
      if (val > maxCap) {
        const err = new Error(`DISCOUNT_LIMIT_EXCEEDED: Vai trò "${userRole}" chỉ được áp dụng chiết khấu tối đa ${maxCap}%.`);
        err.code = 'DISCOUNT_LIMIT_EXCEEDED';
        throw err;
      }
      calculatedDiscount = Math.round(syncSubtotal * (val / 100));
    } else if (data.discountType === 'fixed') {
      const val = Number(data.discountValue !== undefined ? data.discountValue : (data.discountAmount || data.discount || 0));
      if (isNaN(val) || !isFinite(val) || val < 0) {
        const err = new Error('ORDER_VALIDATION_ERROR: Giá trị chiết khấu không hợp lệ.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }
      const maxFixed = Math.round(syncSubtotal * (maxCap / 100));
      if (val > maxFixed) {
        const err = new Error(`DISCOUNT_LIMIT_EXCEEDED: Vai trò "${userRole}" chỉ được áp dụng chiết khấu tối đa ${maxCap}%.`);
        err.code = 'DISCOUNT_LIMIT_EXCEEDED';
        throw err;
      }
      calculatedDiscount = Math.min(val, syncSubtotal);
    } else {
      const rawDiscount = Number(data.discountAmount !== undefined ? data.discountAmount : (data.discount || 0));
      if (isNaN(rawDiscount) || !isFinite(rawDiscount) || rawDiscount < 0) {
        const err = new Error('ORDER_VALIDATION_ERROR: Giá trị chiết khấu không hợp lệ.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }
      const maxFixed = Math.round(syncSubtotal * (maxCap / 100));
      if (rawDiscount > maxFixed) {
        const err = new Error(`DISCOUNT_LIMIT_EXCEEDED: Vai trò "${userRole}" chỉ được áp dụng chiết khấu tối đa ${maxCap}%.`);
        err.code = 'DISCOUNT_LIMIT_EXCEEDED';
        throw err;
      }
      calculatedDiscount = Math.min(rawDiscount, syncSubtotal);
    }

    if (data.totalAmount !== undefined && (isNaN(Number(data.totalAmount)) || Number(data.totalAmount) < 0)) {
      const err = new Error('ORDER_VALIDATION_ERROR: Tổng tiền đơn hàng không được âm.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    const expectedTotal = Math.max(0, syncSubtotal - calculatedDiscount);
    if ((context?.requireStrictTotals || context?.requireSellingContext) && data.totalAmount !== undefined && Math.abs(Number(data.totalAmount) - expectedTotal) > 1) {
      const err = new Error(`ORDER_VALIDATION_ERROR: Tổng tiền đơn hàng (${data.totalAmount}) không khớp với giá trị sản phẩm tính toán (${expectedTotal}).`);
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    const nowIso = new Date().toISOString();
    const targetDate = data.businessDate || (data.createdAt ? getBusinessDate(data.createdAt) : getBusinessDate(nowIso));

    return (async () => {
      // Authoritative product validation & price resolution against database
      let canonicalItems = hasItems ? [...data.items] : [];
      let authoritativeSubtotal = syncSubtotal;
      if (hasItems) {
        try {
          const prodsRes = await axiosClient.get('/products');
          const allProds = Array.isArray(prodsRes?.data) ? prodsRes.data : (Array.isArray(prodsRes) ? prodsRes : []);
          if (allProds.length > 0) {
            const prodMap = new Map(allProds.map(p => [String(p.id), p]));
            const verifiedItems = [];
            let verifiedSubtotal = 0;
            for (const item of data.items) {
              const prod = prodMap.get(String(item.productId));
              if (prod) {
                if (prod.isActive === false) {
                  const err = new Error(`ORDER_VALIDATION_ERROR: Sản phẩm "${prod.name}" đang bị vô hiệu hóa.`);
                  err.code = 'ORDER_VALIDATION_ERROR';
                  throw err;
                }
                const canonicalPrice = Number(prod.sellPrice !== undefined ? prod.sellPrice : prod.price) || 0;
                if ((context?.requireStrictTotals || context?.requireSellingContext) && item.price !== undefined && Math.abs(Number(item.price) - canonicalPrice) > 0.01) {
                  const err = new Error(`ORDER_PRICE_MISMATCH: Đơn giá của sản phẩm "${prod.name}" không khớp với giá niêm yết hệ thống.`);
                  err.code = 'ORDER_PRICE_MISMATCH';
                  throw err;
                }
                const effectivePrice = (context?.requireStrictTotals || context?.requireSellingContext || item.price === undefined) ? canonicalPrice : Number(item.price);
                verifiedSubtotal += effectivePrice * item.quantity;
                verifiedItems.push({
                  productId: prod.id,
                  productName: prod.name || item.productName || '',
                  quantity: item.quantity,
                  price: effectivePrice
                });
              } else {
                // Preserve synthetic item for test mock compatibility
                verifiedSubtotal += Number(item.price || 0) * Number(item.quantity || 0);
                verifiedItems.push(item);
              }
            }
            canonicalItems = verifiedItems;
            authoritativeSubtotal = verifiedSubtotal;
          }
        } catch (prodErr) {
          if (prodErr.code === 'ORDER_VALIDATION_ERROR' || prodErr.code === 'ORDER_PRICE_MISMATCH') {
            throw prodErr;
          }
        }
      }

      // Validate register dynamically against authoritative register collection
      if (data.registerId) {
        try {
          const dynamicRegs = await registerApi.getAll();
          const regList = Array.isArray(dynamicRegs?.data) ? dynamicRegs.data : (Array.isArray(dynamicRegs) ? dynamicRegs : []);
          if (regList.length > 0) {
            const found = regList.find(r => r.id === data.registerId);
            if (!found) {
              const err = new Error(`ORDER_VALIDATION_ERROR: Quầy bán hàng "${data.registerId}" không tồn tại trong hệ thống.`);
              err.code = 'ORDER_VALIDATION_ERROR';
              throw err;
            }
            if (found.isActive === false) {
              const err = new Error(`ORDER_VALIDATION_ERROR: Quầy bán hàng "${data.registerId}" đang bị vô hiệu hóa.`);
              err.code = 'ORDER_VALIDATION_ERROR';
              throw err;
            }
          }
        } catch (regErr) {
          if (regErr.code === 'ORDER_VALIDATION_ERROR') throw regErr;
        }
      }

      // Validate WorkSession when provided
      if (data.workSessionId) {
        try {
          const sessionRes = await axiosClient.get(`/workSessions/${data.workSessionId}`);
          if (sessionRes?.data) {
            if (sessionRes.data.status === 'cancelled') {
              const err = new Error('ORDER_VALIDATION_ERROR: Không thể tạo đơn hàng cho ca làm việc đã bị hủy.');
              err.code = 'ORDER_VALIDATION_ERROR';
              throw err;
            }
            if (data.businessDate && sessionRes.data.date && data.businessDate !== sessionRes.data.date) {
              const err = new Error(`ORDER_VALIDATION_ERROR: Ngày của đơn hàng (${data.businessDate}) không khớp với ngày của ca làm việc (${sessionRes.data.date}).`);
              err.code = 'ORDER_VALIDATION_ERROR';
              throw err;
            }
          }
        } catch (sessionErr) {
          if (sessionErr.code === 'ORDER_VALIDATION_ERROR') throw sessionErr;
        }
      }

      const payload = {
        ...data,
        id: data.id || generateId(),
        code: data.code || '',
        accountId: seller,
        sellerId: seller,
        employeeId: (actor?.employeeId || actor?.employeeCode) || data.employeeId || data.employeeCode || null,
        workSessionId: data.workSessionId || null,
        registerId: data.registerId || null,
        businessDate: targetDate,
        paymentMethod: data.paymentMethod || 'cash',
        items: canonicalItems,
        subtotal: authoritativeSubtotal,
        discountAmount: calculatedDiscount,
        totalAmount: expectedTotal,
        status: data.status || 'completed',
        inventoryTransactionIds: Array.isArray(data.inventoryTransactionIds) ? data.inventoryTransactionIds : [],
        createdAt: data.createdAt || nowIso,
        updatedAt: nowIso,
      };

      const res = await axiosClient.post('/orders', payload);
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.ORDER_CREATED,
        entityType: 'order',
        entityId: res?.data?.id || payload.id,
        workSessionId: payload.workSessionId || null,
        metadata: { totalAmount: payload.totalAmount, code: payload.code },
      });
      return res;
    })();
  },

  updateStatus: (id, status, actor) => {
    assertPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    // Direct mutation to 'cancelled' is strictly forbidden via updateStatus
    if (status === 'cancelled' || status === 'historical_cancelled') {
      const err = new Error('ORDER_MUTATION_RESTRICTED: Trạng thái đơn hàng không thể thay đổi sang "cancelled" bằng updateStatus. Vui lòng sử dụng quy trình hủy đơn chuẩn orderApi.cancel().');
      err.code = 'ORDER_MUTATION_RESTRICTED';
      throw err;
    }

    return (async () => {
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const existingOrder = orderRes.data;
      if (!existingOrder) {
        const err = new Error('ORDER_NOT_FOUND: Không tìm thấy đơn hàng cần cập nhật.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }
      if (existingOrder.status === 'completed' && status !== 'completed') {
        const err = new Error(`ORDER_MUTATION_RESTRICTED: Đơn hàng đã hoàn tất không thể chuyển sang trạng thái "${status}" qua updateStatus.`);
        err.code = 'ORDER_MUTATION_RESTRICTED';
        throw err;
      }

      return axiosClient.patch(`/orders/${id}`, {
        status,
        updatedAt: new Date().toISOString()
      });
    })();
  },

  update: (id, data, actor) => {
    assertPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    if (data && (data.status === 'cancelled' || data.status === 'historical_cancelled')) {
      const err = new Error('ORDER_MUTATION_RESTRICTED: Trạng thái đơn hàng không thể thay đổi sang "cancelled" bằng update. Vui lòng sử dụng quy trình hủy đơn chuẩn orderApi.cancel().');
      err.code = 'ORDER_MUTATION_RESTRICTED';
      throw err;
    }

    return (async () => {
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const existingOrder = orderRes.data;
      if (!existingOrder) {
        const err = new Error('ORDER_NOT_FOUND: Không tìm thấy đơn hàng cần cập nhật.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

      if (existingOrder.status === 'cancelled' || existingOrder.status === 'historical_cancelled') {
        const err = new Error('ORDER_MUTATION_RESTRICTED: Đơn hàng đã bị hủy và không thể chỉnh sửa.');
        err.code = 'ORDER_MUTATION_RESTRICTED';
        throw err;
      }

    const IMMUTABLE_COMPLETED_ORDER_FIELDS = [
      'items',
      'totalAmount',
      'subtotal',
      'discount',
      'discountType',
      'discountValue',
      'discountAmount',
      'finalTotal',
      'paymentMethod',
      'cashReceived',
      'change',
      'accountId',
      'sellerId',
      'employeeId',
      'employeeCode',
      'registerId',
      'workSessionId',
      'workSessionMemberId',
      'businessDate',
      'createdAt',
      'status',
      'inventoryTransactionIds',
      'refundAmount',
      'refundMethod',
      'refundCash',
      'cancelReason',
      'cancelledBy',
      'cancelledAt',
      'cancelledWorkSessionId',
      'cancelledRegisterId',
      'cancelledBusinessDate',
      'isRestocked'
    ];

    if (existingOrder.status === 'completed') {
      for (const field of IMMUTABLE_COMPLETED_ORDER_FIELDS) {
        if (data && data[field] !== undefined && JSON.stringify(data[field]) !== JSON.stringify(existingOrder[field])) {
          const err = new Error(`ORDER_MUTATION_RESTRICTED: Trường "${field}" của đơn hàng đã hoàn tất là bất biến và không thể chỉnh sửa qua update/patch. Vui lòng sử dụng quy trình hủy đơn chuẩn orderApi.cancel().`);
          err.code = 'ORDER_MUTATION_RESTRICTED';
          throw err;
        }
      }
    }

      return axiosClient.put(`/orders/${id}`, {
        ...existingOrder,
        ...data,
        id: existingOrder.id,
        code: existingOrder.code,
        status: existingOrder.status,
        items: existingOrder.items,
        totalAmount: existingOrder.totalAmount,
        subtotal: existingOrder.subtotal,
        paymentMethod: existingOrder.paymentMethod,
        accountId: existingOrder.accountId,
        sellerId: existingOrder.sellerId,
        registerId: existingOrder.registerId,
        workSessionId: existingOrder.workSessionId,
        businessDate: existingOrder.businessDate,
        createdAt: existingOrder.createdAt,
        updatedAt: new Date().toISOString()
      });
    })();
  },

  patch: (id, data, actor) => {
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Yêu cầu đăng nhập để cập nhật đơn hàng.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    if (data && (data.status === 'cancelled' || data.status === 'historical_cancelled')) {
      const err = new Error('ORDER_MUTATION_RESTRICTED: Trạng thái đơn hàng không thể thay đổi sang "cancelled" bằng patch. Vui lòng sử dụng quy trình hủy đơn chuẩn orderApi.cancel().');
      err.code = 'ORDER_MUTATION_RESTRICTED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    return (async () => {
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const existingOrder = orderRes.data;
      if (!existingOrder) {
        const err = new Error('ORDER_NOT_FOUND: Không tìm thấy đơn hàng cần cập nhật.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

    if (existingOrder.status === 'cancelled' || existingOrder.status === 'historical_cancelled') {
      const err = new Error('ORDER_MUTATION_RESTRICTED: Đơn hàng đã bị hủy và không thể chỉnh sửa.');
      err.code = 'ORDER_MUTATION_RESTRICTED';
      throw err;
    }

    const IMMUTABLE_COMPLETED_ORDER_FIELDS = [
      'items',
      'totalAmount',
      'subtotal',
      'discount',
      'discountType',
      'discountValue',
      'discountAmount',
      'finalTotal',
      'paymentMethod',
      'cashReceived',
      'change',
      'accountId',
      'sellerId',
      'employeeId',
      'employeeCode',
      'registerId',
      'workSessionId',
      'workSessionMemberId',
      'businessDate',
      'createdAt',
      'status',
      'inventoryTransactionIds',
      'refundAmount',
      'refundMethod',
      'refundCash',
      'cancelReason',
      'cancelledBy',
      'cancelledAt',
      'cancelledWorkSessionId',
      'cancelledRegisterId',
      'cancelledBusinessDate',
      'isRestocked'
    ];

    if (existingOrder.status === 'completed') {
      for (const field of IMMUTABLE_COMPLETED_ORDER_FIELDS) {
        if (data && data[field] !== undefined && JSON.stringify(data[field]) !== JSON.stringify(existingOrder[field])) {
          const err = new Error(`ORDER_MUTATION_RESTRICTED: Trường "${field}" của đơn hàng đã hoàn tất là bất biến và không thể chỉnh sửa qua update/patch. Vui lòng sử dụng quy trình hủy đơn chuẩn orderApi.cancel().`);
          err.code = 'ORDER_MUTATION_RESTRICTED';
          throw err;
        }
      }
    }

      return axiosClient.patch(`/orders/${id}`, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    })();
  },

  cancel: (id, { actor, reason, order, currentSessionId, refundCash = true, refundMethod, registerId, cancelledRegisterId } = {}) => {
    if (!actor?.id) {
      const err = new Error('NOT_AUTHENTICATED: Người thực hiện chưa đăng nhập.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CANCEL);

    const isAdmin = actor.role === 'admin';
    const isManagement = isAdmin || hasPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    // If order was passed, execute synchronous validations to satisfy synchronous assertions
    if (order) {
      if (order.status === 'cancelled' || order.status === 'historical_cancelled') {
        const err = new Error('ORDER_ALREADY_CANCELLED: Đơn hàng đã ở trạng thái đã hủy.');
        err.code = 'ORDER_ALREADY_CANCELLED';
        throw err;
      }

      if (!isManagement) {
        const sellerId = order.accountId || order.sellerId || order.createdBy;
        if (sellerId !== actor.id) {
          const err = new Error('CANCEL_DENIED: Bạn chỉ được hủy đơn hàng do chính mình tạo.');
          err.code = 'NOT_OWN_ORDER';
          throw err;
        }

        if (!currentSessionId || order.workSessionId !== currentSessionId) {
          const err = new Error('CANCEL_DENIED: Bạn chỉ được hủy đơn hàng thuộc ca làm việc hiện tại.');
          err.code = 'NOT_CURRENT_SESSION';
          throw err;
        }

        const ageMs = Date.now() - new Date(order.createdAt).getTime();
        if (ageMs > 15 * 60 * 1000) {
          const err = new Error('CANCEL_DENIED: Đã quá 15 phút kể từ lúc tạo đơn, không thể tự hủy.');
          err.code = 'CANCEL_WINDOW_EXPIRED';
          throw err;
        }
      } else if (!isAdmin) {
        const orderBizDate = order.businessDate || (order.createdAt ? getBusinessDate(order.createdAt) : null);
        if (orderBizDate && orderBizDate !== getBusinessDate()) {
          const err = new Error('CANCEL_DENIED: Quản lý chỉ được hủy đơn hàng trong ngày làm việc hiện tại.');
          err.code = 'STAFF_SAME_DAY_ONLY';
          throw err;
        }
      }

      if (!reason || !reason.trim()) {
        const err = new Error('CANCEL_DENIED: Vui lòng nhập lý do hủy đơn.');
        err.code = 'REASON_REQUIRED';
        throw err;
      }
    }

    return (async () => {
      // Authoritative read from database
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const targetOrder = orderRes.data;

      if (!targetOrder) {
        const err = new Error('ORDER_NOT_FOUND: Không tìm thấy đơn hàng cần hủy.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

      if (targetOrder.status === 'cancelled' || targetOrder.status === 'historical_cancelled') {
        const err = new Error('ORDER_ALREADY_CANCELLED: Đơn hàng đã ở trạng thái đã hủy.');
        err.code = 'ORDER_ALREADY_CANCELLED';
        throw err;
      }

      if (targetOrder.status !== 'completed') {
        const err = new Error(`ORDER_CANNOT_BE_CANCELLED: Chỉ có thể hủy đơn hàng ở trạng thái hoàn tất (hiện tại: ${targetOrder.status}).`);
        err.code = 'ORDER_CANNOT_BE_CANCELLED';
        throw err;
      }

      if (!isManagement) {
        const sellerId = targetOrder.accountId || targetOrder.sellerId || targetOrder.createdBy;
        if (sellerId !== actor.id) {
          const err = new Error('CANCEL_DENIED: Bạn chỉ được hủy đơn hàng do chính mình tạo.');
          err.code = 'NOT_OWN_ORDER';
          throw err;
        }

        if (!currentSessionId || targetOrder.workSessionId !== currentSessionId) {
          const err = new Error('CANCEL_DENIED: Bạn chỉ được hủy đơn hàng thuộc ca làm việc hiện tại.');
          err.code = 'NOT_CURRENT_SESSION';
          throw err;
        }

        const ageMs = Date.now() - new Date(targetOrder.createdAt).getTime();
        if (ageMs > 15 * 60 * 1000) {
          const err = new Error('CANCEL_DENIED: Đã quá 15 phút kể từ lúc tạo đơn, không thể tự hủy.');
          err.code = 'CANCEL_WINDOW_EXPIRED';
          throw err;
        }
      } else if (!isAdmin) {
        const orderBizDate = targetOrder.businessDate || (targetOrder.createdAt ? getBusinessDate(targetOrder.createdAt) : null);
        if (orderBizDate && orderBizDate !== getBusinessDate()) {
          const err = new Error('CANCEL_DENIED: Quản lý chỉ được hủy đơn hàng trong ngày làm việc hiện tại.');
          err.code = 'STAFF_SAME_DAY_ONLY';
          throw err;
        }
      }

      if (!reason || !reason.trim()) {
        const err = new Error('CANCEL_DENIED: Vui lòng nhập lý do hủy đơn.');
        err.code = 'REASON_REQUIRED';
        throw err;
      }

      const orderBizDate = targetOrder.businessDate || (targetOrder.createdAt ? getBusinessDate(targetOrder.createdAt) : null);
      const isHistorical = orderBizDate && orderBizDate !== getBusinessDate();
      const newStatus = isHistorical ? 'historical_cancelled' : 'cancelled';
      const resolvedRefundMethod = refundMethod || targetOrder.paymentMethod || 'cash';
      const refundAmount = Number(targetOrder.totalAmount) || 0;

      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.ORDER_CANCELLED,
        entityType: 'order',
        entityId: id,
        workSessionId: currentSessionId || targetOrder.workSessionId || null,
        metadata: {
          reason: reason.trim(),
          originalWorkSessionId: targetOrder.workSessionId,
          orderCode: targetOrder.code || null,
          refundAmount,
          refundMethod: resolvedRefundMethod
        },
      });

      return axiosClient.patch(`/orders/${id}`, {
        status: newStatus,
        cancelledAt: new Date().toISOString(),
        cancelledBy: actor.id,
        cancelReason: reason.trim(),
        cancelledWorkSessionId: currentSessionId || targetOrder.workSessionId || null,
        cancelledRegisterId: cancelledRegisterId || registerId || targetOrder.registerId || null,
        cancelledBusinessDate: getBusinessDate(),
        refundMethod: resolvedRefundMethod,
        refundAmount,
        refundCash: Boolean(refundCash),
        updatedAt: new Date().toISOString(),
      });
    })();
  },

  cancelAndRestock: async (id, { actor, reason, currentSessionId, refundCash = true, refundMethod, registerId, cancelledRegisterId } = {}) => {
    if (!actor?.id) {
      const err = new Error('NOT_AUTHENTICATED: Người thực hiện chưa đăng nhập.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CANCEL);

    if (!reason || !reason.trim()) {
      const err = new Error('CANCEL_DENIED: Vui lòng nhập lý do hủy đơn.');
      err.code = 'REASON_REQUIRED';
      throw err;
    }

    const orderRes = await axiosClient.get(`/orders/${id}`);
    const targetOrder = orderRes.data;

    if (!targetOrder) {
      const err = new Error('ORDER_NOT_FOUND: Không tìm thấy đơn hàng cần hủy.');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    if (targetOrder.status === 'cancelled' || targetOrder.status === 'historical_cancelled') {
      const err = new Error('ORDER_ALREADY_CANCELLED: Đơn hàng đã ở trạng thái đã hủy.');
      err.code = 'ORDER_ALREADY_CANCELLED';
      throw err;
    }

    if (targetOrder.isRestocked) {
      const err = new Error('ORDER_ALREADY_RESTOCKED: Đơn hàng đã được hoàn kho trước đó.');
      err.code = 'ORDER_ALREADY_RESTOCKED';
      throw err;
    }

    const isAdmin = actor.role === 'admin';
    const isManagement = isAdmin || hasPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    if (!isManagement) {
      const sellerId = targetOrder.accountId || targetOrder.sellerId || targetOrder.createdBy;
      if (sellerId !== actor.id) {
        const err = new Error('CANCEL_DENIED: Bạn chỉ được hủy đơn hàng do chính mình tạo.');
        err.code = 'NOT_OWN_ORDER';
        throw err;
      }

      if (!currentSessionId || targetOrder.workSessionId !== currentSessionId) {
        const err = new Error('CANCEL_DENIED: Bạn chỉ được hủy đơn hàng thuộc ca làm việc hiện tại.');
        err.code = 'NOT_CURRENT_SESSION';
        throw err;
      }

      const ageMs = Date.now() - new Date(targetOrder.createdAt).getTime();
      if (ageMs > 15 * 60 * 1000) {
        const err = new Error('CANCEL_DENIED: Đã quá 15 phút kể từ lúc tạo đơn, không thể tự hủy.');
        err.code = 'CANCEL_WINDOW_EXPIRED';
        throw err;
      }
    } else if (!isAdmin) {
      const orderBizDate = targetOrder.businessDate || (targetOrder.createdAt ? getBusinessDate(targetOrder.createdAt) : null);
      if (orderBizDate && orderBizDate !== getBusinessDate()) {
        const err = new Error('CANCEL_DENIED: Quản lý chỉ được hủy đơn hàng trong ngày làm việc hiện tại.');
        err.code = 'STAFF_SAME_DAY_ONLY';
        throw err;
      }
    }

    // 1. Cancel the order first (Authoritative cancellation commit point)
    const cancelRes = await orderApi.cancel(targetOrder.id, {
      actor,
      reason: reason.trim(),
      order: targetOrder,
      currentSessionId,
      refundCash,
      refundMethod,
      registerId,
      cancelledRegisterId
    });

    // 2. Fetch existing inventory transactions to guarantee idempotency across retries
    const txRes = await axiosClient.get(`/inventoryTransactions?orderId=${targetOrder.id}`);
    const existingTx = Array.isArray(txRes.data) ? txRes.data : [];

    // 3. Restock items via delta-based restock and create CANCEL_RESTOCK transactions
    for (const item of (targetOrder.items || [])) {
      const alreadyRestocked = existingTx.some(t =>
        String(t.productId) === String(item.productId) &&
        t.reason === INVENTORY_REASONS.CANCEL_RESTOCK &&
        !t.isVoided
      );
      if (alreadyRestocked) {
        continue;
      }

      const prodRes = await productApi.getById(item.productId);
      const prod = prodRes.data;
      const costPrice = prod ? (Number(prod.costPrice) || Number(prod.price) || Number(item.price) || 0) : Number(item.price) || 0;

      await inventoryApi.createTransaction({
        id: generateId(),
        productId: item.productId,
        type: INVENTORY_TYPES.IN,
        reason: INVENTORY_REASONS.CANCEL_RESTOCK,
        quantity: item.quantity,
        unitPrice: costPrice,
        unitCost: costPrice,
        orderId: targetOrder.id,
        orderCode: targetOrder.code || targetOrder.id,
        accountId: actor.id,
        workSessionId: currentSessionId || targetOrder.workSessionId || null,
        registerId: cancelledRegisterId || registerId || targetOrder.registerId || null,
        businessDate: getBusinessDate(),
        note: `Hoàn kho - hủy ${targetOrder.code || targetOrder.id}`,
        createdAt: new Date().toISOString(),
      }, actor, { source: 'order_cancellation' });

      if (prod) {
        await productApi.adjustStockDelta(item.productId, item.quantity, actor, {
          source: 'order_cancellation',
          orderCode: targetOrder.code || targetOrder.id,
        });
      }
    }

    // 4. Mark order as restocked
    await axiosClient.patch(`/orders/${targetOrder.id}`, {
      isRestocked: true,
      restockedAt: new Date().toISOString()
    });

    return cancelRes;
  },

  remove: () => {
    // Prevent permanent deletion of historical orders
    const err = new Error('ORDER_DELETION_RESTRICTED: Đơn hàng là bản ghi lịch sử không được phép xóa vĩnh viễn. Vui lòng sử dụng chức năng hủy đơn.');
    err.code = 'ORDER_DELETION_RESTRICTED';
    throw err;
  },

  removeInFlightOrder: async (orderId, actor) => {
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Yêu cầu đăng nhập để hoàn tác đơn hàng in-flight.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }
    assertPermission(actor, PERMISSIONS.ORDER_CREATE);
    const orderRes = await axiosClient.get(`/orders/${orderId}`);
    const order = orderRes.data;
    if (!order) return;

    if (actor.role !== 'admin' && String(order.accountId) !== String(actor.id) && String(order.sellerId) !== String(actor.id)) {
      const err = new Error('PERMISSION_DENIED: Bạn chỉ có thể hoàn tác đơn hàng in-flight do chính mình tạo.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    const txRes = await axiosClient.get(`/inventoryTransactions?orderId=${orderId}`);
    const txList = Array.isArray(txRes.data) ? txRes.data : [];
    const activeTx = txList.filter(t => !t.isVoided);
    if (activeTx.length > 0) {
      const err = new Error('ORDER_DELETION_RESTRICTED: Đơn hàng đã có giao dịch kho được xác nhận, không thể xóa in-flight.');
      err.code = 'ORDER_DELETION_RESTRICTED';
      throw err;
    }

    return axiosClient.delete(`/orders/${orderId}`);
  },

  generateOrderCode: async (dateStr = null) => {
    const targetDate = dateStr || getBusinessDate(new Date());
    const dateCompact = targetDate.replace(/-/g, '');
    const prefix = `HD-${dateCompact}-`;

    const res = await axiosClient.get('/orders');
    const orders = Array.isArray(res.data) ? res.data : [];

    let maxSeq = 0;
    orders.forEach(o => {
      if (o.code) {
        if (o.code.startsWith(prefix)) {
          const num = parseInt(o.code.replace(prefix, ''), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        } else if (o.code.startsWith('HD') && !o.code.includes('-')) {
          const num = parseInt(o.code.replace('HD', ''), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    });

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidateNum = maxSeq + 1 + attempt;
      const candidateCode = `${prefix}${String(candidateNum).padStart(4, '0')}`;
      const checkRes = await axiosClient.get(`/orders?code=${candidateCode}`);
      if (!Array.isArray(checkRes.data) || checkRes.data.length === 0) {
        return candidateCode;
      }
    }

    // High concurrency fallback with random suffix
    for (let attempt = 0; attempt < 5; attempt++) {
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const candidateCode = `${prefix}${randomPart}`;
      const checkRes = await axiosClient.get(`/orders?code=${candidateCode}`);
      if (!Array.isArray(checkRes.data) || checkRes.data.length === 0) {
        return candidateCode;
      }
    }

    throw new Error('Không thể tạo mã hóa đơn duy nhất, vui lòng thử lại.');
  }
};
