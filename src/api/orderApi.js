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
      const err = new Error('ORDER_VALIDATION_ERROR: Dá»¯ liá»‡u Ä‘Æ¡n hÃ ng khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (!actor) {
      const err = new Error('NOT_AUTHENTICATED: YÃªu cáº§u Ä‘Äƒng nháº­p Ä‘á»ƒ táº¡o Ä‘Æ¡n hÃ ng.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    if (!data.accountId && !data.sellerId && !actor.id) {
      const err = new Error('ORDER_VALIDATION_ERROR: Thiáº¿u thÃ´ng tin ngÆ°á»i bÃ¡n (sellerId/accountId).');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (!actor.id) {
      const err = new Error('NOT_AUTHENTICATED: YÃªu cáº§u Ä‘Äƒng nháº­p Ä‘á»ƒ táº¡o Ä‘Æ¡n hÃ ng.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const userRole = (actor.role || '').toLowerCase();
    if (!['admin', 'staff', 'employee'].includes(userRole)) {
      const err = new Error('PERMISSION_DENIED: Vai trÃ² ngÆ°á»i dÃ¹ng khÃ´ng há»£p lá»‡.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CREATE);

    if (userRole === 'employee') {
      if (data.accountId && String(data.accountId) !== String(actor.id)) {
        const err = new Error('PERMISSION_DENIED: NhÃ¢n viÃªn khÃ´ng thá»ƒ táº¡o Ä‘Æ¡n hÃ ng thay máº·t tÃ i khoáº£n khÃ¡c.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      if (data.sellerId && String(data.sellerId) !== String(actor.id)) {
        const err = new Error('PERMISSION_DENIED: NhÃ¢n viÃªn khÃ´ng thá»ƒ táº¡o Ä‘Æ¡n hÃ ng thay máº·t ngÆ°á»i bÃ¡n khÃ¡c.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      if (data.employeeId && actor.employeeId && String(data.employeeId) !== String(actor.employeeId)) {
        const err = new Error('PERMISSION_DENIED: NhÃ¢n viÃªn khÃ´ng thá»ƒ táº¡o Ä‘Æ¡n hÃ ng thay máº·t nhÃ¢n viÃªn khÃ¡c.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      if (data.employeeCode && actor.employeeCode && String(data.employeeCode) !== String(actor.employeeCode)) {
        const err = new Error('PERMISSION_DENIED: NhÃ¢n viÃªn khÃ´ng thá»ƒ táº¡o Ä‘Æ¡n hÃ ng thay máº·t nhÃ¢n viÃªn khÃ¡c.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
    }

    const seller = actor.id || data.accountId || data.sellerId;
    if (!seller) {
      const err = new Error('ORDER_VALIDATION_ERROR: ÄÆ¡n hÃ ng thiáº¿u thÃ´ng tin tÃ i khoáº£n ngÆ°á»i bÃ¡n.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    const VALID_PAYMENT_METHODS = ['cash', 'transfer', 'card'];
    if (data.paymentMethod && !VALID_PAYMENT_METHODS.includes(data.paymentMethod)) {
      const err = new Error(`ORDER_VALIDATION_ERROR: PhÆ°Æ¡ng thá»©c thanh toÃ¡n "${data.paymentMethod}" khÃ´ng há»£p lá»‡. Chá»‰ cháº¥p nháº­n: cash, transfer, card.`);
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (data.registerId) {
      const canonicalRegs = registerApi.getSyncRegisters();
      if (Array.isArray(canonicalRegs) && canonicalRegs.length > 0) {
        const knownReg = canonicalRegs.find(r => r.id === data.registerId);
        if (!knownReg) {
          const err = new Error(`ORDER_VALIDATION_ERROR: Quáº§y bÃ¡n hÃ ng "${data.registerId}" khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng.`);
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
        if (knownReg.isActive === false) {
          const err = new Error(`ORDER_VALIDATION_ERROR: Quáº§y bÃ¡n hÃ ng "${data.registerId}" Ä‘ang bá»‹ vÃ´ hiá»‡u hÃ³a.`);
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
      }
    }

    const hasItems = data.items !== undefined;
    if (hasItems) {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        const err = new Error('ORDER_VALIDATION_ERROR: ÄÆ¡n hÃ ng hoÃ n táº¥t pháº£i cÃ³ Ã­t nháº¥t 1 sáº£n pháº©m.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }

      for (const item of data.items) {
        if (!item || !item.productId) {
          const err = new Error('ORDER_VALIDATION_ERROR: Sáº£n pháº©m trong Ä‘Æ¡n hÃ ng thiáº¿u thÃ´ng tin productId.');
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
        if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          const err = new Error('ORDER_VALIDATION_ERROR: Má»—i sáº£n pháº©m trong Ä‘Æ¡n hÃ ng pháº£i cÃ³ sá»‘ lÆ°á»£ng nguyÃªn > 0.');
          err.code = 'ORDER_VALIDATION_ERROR';
          throw err;
        }
      }
    } else {
      const err = new Error('ORDER_VALIDATION_ERROR: ÄÆ¡n hÃ ng hoÃ n táº¥t báº¯t buá»™c pháº£i cÃ³ Ã­t nháº¥t 1 sáº£n pháº©m.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    if (!data.workSessionId) {
      const err = new Error('ORDER_VALIDATION_ERROR: ÄÆ¡n hÃ ng hoÃ n táº¥t báº¯t buá»™c pháº£i gáº¯n vá»›i ca lÃ m viá»‡c (workSessionId).');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    // Synchronous total and discount validation
    const maxCap = ROLE_DISCOUNT_CAPS[userRole] ?? 0;
    let syncSubtotal = 0;
    if (hasItems) {
      for (const item of data.items) {
        if (item.price !== undefined && (isNaN(Number(item.price)) || Number(item.price) < 0)) {
          const err = new Error('ORDER_VALIDATION_ERROR: ÄÆ¡n giÃ¡ sáº£n pháº©m khÃ´ng Ä‘Æ°á»£c Ã¢m.');
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
        const err = new Error('ORDER_VALIDATION_ERROR: GiÃ¡ trá»‹ chiáº¿t kháº¥u khÃ´ng há»£p lá»‡.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }
      if (val > maxCap) {
        const err = new Error(`DISCOUNT_LIMIT_EXCEEDED: Vai trÃ² "${userRole}" chá»‰ Ä‘Æ°á»£c Ã¡p dá»¥ng chiáº¿t kháº¥u tá»‘i Ä‘a ${maxCap}%.`);
        err.code = 'DISCOUNT_LIMIT_EXCEEDED';
        throw err;
      }
      calculatedDiscount = Math.round(syncSubtotal * (val / 100));
    } else if (data.discountType === 'fixed') {
      const val = Number(data.discountValue !== undefined ? data.discountValue : (data.discountAmount || data.discount || 0));
      if (isNaN(val) || !isFinite(val) || val < 0) {
        const err = new Error('ORDER_VALIDATION_ERROR: GiÃ¡ trá»‹ chiáº¿t kháº¥u khÃ´ng há»£p lá»‡.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }
      const maxFixed = Math.round(syncSubtotal * (maxCap / 100));
      if (val > maxFixed) {
        const err = new Error(`DISCOUNT_LIMIT_EXCEEDED: Vai trÃ² "${userRole}" chá»‰ Ä‘Æ°á»£c Ã¡p dá»¥ng chiáº¿t kháº¥u tá»‘i Ä‘a ${maxCap}%.`);
        err.code = 'DISCOUNT_LIMIT_EXCEEDED';
        throw err;
      }
      calculatedDiscount = Math.min(val, syncSubtotal);
    } else {
      const rawDiscount = Number(data.discountAmount !== undefined ? data.discountAmount : (data.discount || 0));
      if (isNaN(rawDiscount) || !isFinite(rawDiscount) || rawDiscount < 0) {
        const err = new Error('ORDER_VALIDATION_ERROR: GiÃ¡ trá»‹ chiáº¿t kháº¥u khÃ´ng há»£p lá»‡.');
        err.code = 'ORDER_VALIDATION_ERROR';
        throw err;
      }
      const maxFixed = Math.round(syncSubtotal * (maxCap / 100));
      if (rawDiscount > maxFixed) {
        const err = new Error(`DISCOUNT_LIMIT_EXCEEDED: Vai trÃ² "${userRole}" chá»‰ Ä‘Æ°á»£c Ã¡p dá»¥ng chiáº¿t kháº¥u tá»‘i Ä‘a ${maxCap}%.`);
        err.code = 'DISCOUNT_LIMIT_EXCEEDED';
        throw err;
      }
      calculatedDiscount = Math.min(rawDiscount, syncSubtotal);
    }

    if (data.totalAmount !== undefined && (isNaN(Number(data.totalAmount)) || Number(data.totalAmount) < 0)) {
      const err = new Error('ORDER_VALIDATION_ERROR: Tá»•ng tiá»n Ä‘Æ¡n hÃ ng khÃ´ng Ä‘Æ°á»£c Ã¢m.');
      err.code = 'ORDER_VALIDATION_ERROR';
      throw err;
    }

    const expectedTotal = Math.max(0, syncSubtotal - calculatedDiscount);
    if (data.totalAmount !== undefined && Math.abs(Number(data.totalAmount) - expectedTotal) > 1) {
      const err = new Error(`ORDER_VALIDATION_ERROR: Tá»•ng tiá»n Ä‘Æ¡n hÃ ng (${data.totalAmount}) khÃ´ng khá»›p vá»›i giÃ¡ trá»‹ sáº£n pháº©m tÃ­nh toÃ¡n (${expectedTotal}).`);
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
                  const err = new Error(`ORDER_VALIDATION_ERROR: Sáº£n pháº©m "${prod.name}" Ä‘ang bá»‹ vÃ´ hiá»‡u hÃ³a.`);
                  err.code = 'ORDER_VALIDATION_ERROR';
                  throw err;
                }
                const canonicalPrice = Number(prod.sellPrice !== undefined ? prod.sellPrice : prod.price) || 0;
                if (item.price !== undefined && Math.abs(Number(item.price) - canonicalPrice) > 0.01) {
                  const err = new Error(`ORDER_PRICE_MISMATCH: ÄÆ¡n giÃ¡ cá»§a sáº£n pháº©m "${prod.name}" khÃ´ng khá»›p vá»›i giÃ¡ niÃªm yáº¿t há»‡ thá»‘ng.`);
                  err.code = 'ORDER_PRICE_MISMATCH';
                  throw err;
                }
                const effectivePrice = canonicalPrice;
                verifiedSubtotal += effectivePrice * item.quantity;
                verifiedItems.push({
                  productId: prod.id,
                  productName: prod.name || item.productName || '',
                  quantity: item.quantity,
                  price: effectivePrice
                });
              } else {
                const err = new Error(`ORDER_VALIDATION_ERROR: Sáº£n pháº©m "${item.productId}" khÃ´ng tá»“n táº¡i.`);
                err.code = 'ORDER_VALIDATION_ERROR';
                throw err;
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
              const err = new Error(`ORDER_VALIDATION_ERROR: Quáº§y bÃ¡n hÃ ng "${data.registerId}" khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng.`);
              err.code = 'ORDER_VALIDATION_ERROR';
              throw err;
            }
            if (found.isActive === false) {
              const err = new Error(`ORDER_VALIDATION_ERROR: Quáº§y bÃ¡n hÃ ng "${data.registerId}" Ä‘ang bá»‹ vÃ´ hiá»‡u hÃ³a.`);
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
              const err = new Error('ORDER_VALIDATION_ERROR: KhÃ´ng thá»ƒ táº¡o Ä‘Æ¡n hÃ ng cho ca lÃ m viá»‡c Ä‘Ã£ bá»‹ há»§y.');
              err.code = 'ORDER_VALIDATION_ERROR';
              throw err;
            }
            if (data.businessDate && sessionRes.data.date && data.businessDate !== sessionRes.data.date) {
              const err = new Error(`ORDER_VALIDATION_ERROR: NgÃ y cá»§a Ä‘Æ¡n hÃ ng (${data.businessDate}) khÃ´ng khá»›p vá»›i ngÃ y cá»§a ca lÃ m viá»‡c (${sessionRes.data.date}).`);
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
      const err = new Error('ORDER_MUTATION_RESTRICTED: Tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng khÃ´ng thá»ƒ thay Ä‘á»•i sang "cancelled" báº±ng updateStatus. Vui lÃ²ng sá»­ dá»¥ng quy trÃ¬nh há»§y Ä‘Æ¡n chuáº©n orderApi.cancel().');
      err.code = 'ORDER_MUTATION_RESTRICTED';
      throw err;
    }

    return (async () => {
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const existingOrder = orderRes.data;
      if (!existingOrder) {
        const err = new Error('ORDER_NOT_FOUND: KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng cáº§n cáº­p nháº­t.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }
      if (existingOrder.status === 'completed' && status !== 'completed') {
        const err = new Error(`ORDER_MUTATION_RESTRICTED: ÄÆ¡n hÃ ng Ä‘Ã£ hoÃ n táº¥t khÃ´ng thá»ƒ chuyá»ƒn sang tráº¡ng thÃ¡i "${status}" qua updateStatus.`);
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
      const err = new Error('ORDER_MUTATION_RESTRICTED: Tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng khÃ´ng thá»ƒ thay Ä‘á»•i sang "cancelled" báº±ng update. Vui lÃ²ng sá»­ dá»¥ng quy trÃ¬nh há»§y Ä‘Æ¡n chuáº©n orderApi.cancel().');
      err.code = 'ORDER_MUTATION_RESTRICTED';
      throw err;
    }

    return (async () => {
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const existingOrder = orderRes.data;
      if (!existingOrder) {
        const err = new Error('ORDER_NOT_FOUND: KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng cáº§n cáº­p nháº­t.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

      if (existingOrder.status === 'cancelled' || existingOrder.status === 'historical_cancelled') {
        const err = new Error('ORDER_MUTATION_RESTRICTED: ÄÆ¡n hÃ ng Ä‘Ã£ bá»‹ há»§y vÃ  khÃ´ng thá»ƒ chá»‰nh sá»­a.');
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
          const err = new Error(`ORDER_MUTATION_RESTRICTED: TrÆ°á»ng "${field}" cá»§a Ä‘Æ¡n hÃ ng Ä‘Ã£ hoÃ n táº¥t lÃ  báº¥t biáº¿n vÃ  khÃ´ng thá»ƒ chá»‰nh sá»­a qua update/patch. Vui lÃ²ng sá»­ dá»¥ng quy trÃ¬nh há»§y Ä‘Æ¡n chuáº©n orderApi.cancel().`);
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
      const err = new Error('NOT_AUTHENTICATED: YÃªu cáº§u Ä‘Äƒng nháº­p Ä‘á»ƒ cáº­p nháº­t Ä‘Æ¡n hÃ ng.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    if (data && (data.status === 'cancelled' || data.status === 'historical_cancelled')) {
      const err = new Error('ORDER_MUTATION_RESTRICTED: Tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng khÃ´ng thá»ƒ thay Ä‘á»•i sang "cancelled" báº±ng patch. Vui lÃ²ng sá»­ dá»¥ng quy trÃ¬nh há»§y Ä‘Æ¡n chuáº©n orderApi.cancel().');
      err.code = 'ORDER_MUTATION_RESTRICTED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    return (async () => {
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const existingOrder = orderRes.data;
      if (!existingOrder) {
        const err = new Error('ORDER_NOT_FOUND: KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng cáº§n cáº­p nháº­t.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

    if (existingOrder.status === 'cancelled' || existingOrder.status === 'historical_cancelled') {
      const err = new Error('ORDER_MUTATION_RESTRICTED: ÄÆ¡n hÃ ng Ä‘Ã£ bá»‹ há»§y vÃ  khÃ´ng thá»ƒ chá»‰nh sá»­a.');
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
          const err = new Error(`ORDER_MUTATION_RESTRICTED: TrÆ°á»ng "${field}" cá»§a Ä‘Æ¡n hÃ ng Ä‘Ã£ hoÃ n táº¥t lÃ  báº¥t biáº¿n vÃ  khÃ´ng thá»ƒ chá»‰nh sá»­a qua update/patch. Vui lÃ²ng sá»­ dá»¥ng quy trÃ¬nh há»§y Ä‘Æ¡n chuáº©n orderApi.cancel().`);
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
      const err = new Error('NOT_AUTHENTICATED: NgÆ°á»i thá»±c hiá»‡n chÆ°a Ä‘Äƒng nháº­p.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CANCEL);

    const isAdmin = actor.role === 'admin';
    const isManagement = isAdmin || hasPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    // If order was passed, execute synchronous validations to satisfy synchronous assertions
    if (order) {
      if (order.status === 'cancelled' || order.status === 'historical_cancelled') {
        const err = new Error('ORDER_ALREADY_CANCELLED: ÄÆ¡n hÃ ng Ä‘Ã£ á»Ÿ tráº¡ng thÃ¡i Ä‘Ã£ há»§y.');
        err.code = 'ORDER_ALREADY_CANCELLED';
        throw err;
      }

      if (!isManagement) {
        const sellerId = order.accountId || order.sellerId || order.createdBy;
        if (sellerId !== actor.id) {
          const err = new Error('CANCEL_DENIED: Báº¡n chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng do chÃ­nh mÃ¬nh táº¡o.');
          err.code = 'NOT_OWN_ORDER';
          throw err;
        }

        if (!currentSessionId || order.workSessionId !== currentSessionId) {
          const err = new Error('CANCEL_DENIED: Báº¡n chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng thuá»™c ca lÃ m viá»‡c hiá»‡n táº¡i.');
          err.code = 'NOT_CURRENT_SESSION';
          throw err;
        }

        const ageMs = Date.now() - new Date(order.createdAt).getTime();
        if (ageMs > 15 * 60 * 1000) {
          const err = new Error('CANCEL_DENIED: ÄÃ£ quÃ¡ 15 phÃºt ká»ƒ tá»« lÃºc táº¡o Ä‘Æ¡n, khÃ´ng thá»ƒ tá»± há»§y.');
          err.code = 'CANCEL_WINDOW_EXPIRED';
          throw err;
        }
      } else if (!isAdmin) {
        const orderBizDate = order.businessDate || (order.createdAt ? getBusinessDate(order.createdAt) : null);
        if (orderBizDate && orderBizDate !== getBusinessDate()) {
          const err = new Error('CANCEL_DENIED: Quáº£n lÃ½ chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng trong ngÃ y lÃ m viá»‡c hiá»‡n táº¡i.');
          err.code = 'STAFF_SAME_DAY_ONLY';
          throw err;
        }
      }

      if (!reason || !reason.trim()) {
        const err = new Error('CANCEL_DENIED: Vui lÃ²ng nháº­p lÃ½ do há»§y Ä‘Æ¡n.');
        err.code = 'REASON_REQUIRED';
        throw err;
      }
    }

    return (async () => {
      // Authoritative read from database
      const orderRes = await axiosClient.get(`/orders/${id}`);
      const targetOrder = orderRes.data;

      if (!targetOrder) {
        const err = new Error('ORDER_NOT_FOUND: KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng cáº§n há»§y.');
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

      if (targetOrder.status === 'cancelled' || targetOrder.status === 'historical_cancelled') {
        const err = new Error('ORDER_ALREADY_CANCELLED: ÄÆ¡n hÃ ng Ä‘Ã£ á»Ÿ tráº¡ng thÃ¡i Ä‘Ã£ há»§y.');
        err.code = 'ORDER_ALREADY_CANCELLED';
        throw err;
      }

      if (targetOrder.status !== 'completed') {
        const err = new Error(`ORDER_CANNOT_BE_CANCELLED: Chá»‰ cÃ³ thá»ƒ há»§y Ä‘Æ¡n hÃ ng á»Ÿ tráº¡ng thÃ¡i hoÃ n táº¥t (hiá»‡n táº¡i: ${targetOrder.status}).`);
        err.code = 'ORDER_CANNOT_BE_CANCELLED';
        throw err;
      }

      if (!isManagement) {
        const sellerId = targetOrder.accountId || targetOrder.sellerId || targetOrder.createdBy;
        if (sellerId !== actor.id) {
          const err = new Error('CANCEL_DENIED: Báº¡n chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng do chÃ­nh mÃ¬nh táº¡o.');
          err.code = 'NOT_OWN_ORDER';
          throw err;
        }

        if (!currentSessionId || targetOrder.workSessionId !== currentSessionId) {
          const err = new Error('CANCEL_DENIED: Báº¡n chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng thuá»™c ca lÃ m viá»‡c hiá»‡n táº¡i.');
          err.code = 'NOT_CURRENT_SESSION';
          throw err;
        }

        const ageMs = Date.now() - new Date(targetOrder.createdAt).getTime();
        if (ageMs > 15 * 60 * 1000) {
          const err = new Error('CANCEL_DENIED: ÄÃ£ quÃ¡ 15 phÃºt ká»ƒ tá»« lÃºc táº¡o Ä‘Æ¡n, khÃ´ng thá»ƒ tá»± há»§y.');
          err.code = 'CANCEL_WINDOW_EXPIRED';
          throw err;
        }
      } else if (!isAdmin) {
        const orderBizDate = targetOrder.businessDate || (targetOrder.createdAt ? getBusinessDate(targetOrder.createdAt) : null);
        if (orderBizDate && orderBizDate !== getBusinessDate()) {
          const err = new Error('CANCEL_DENIED: Quáº£n lÃ½ chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng trong ngÃ y lÃ m viá»‡c hiá»‡n táº¡i.');
          err.code = 'STAFF_SAME_DAY_ONLY';
          throw err;
        }
      }

      if (!reason || !reason.trim()) {
        const err = new Error('CANCEL_DENIED: Vui lÃ²ng nháº­p lÃ½ do há»§y Ä‘Æ¡n.');
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
      const err = new Error('NOT_AUTHENTICATED: NgÆ°á»i thá»±c hiá»‡n chÆ°a Ä‘Äƒng nháº­p.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.ORDER_CANCEL);

    if (!reason || !reason.trim()) {
      const err = new Error('CANCEL_DENIED: Vui lÃ²ng nháº­p lÃ½ do há»§y Ä‘Æ¡n.');
      err.code = 'REASON_REQUIRED';
      throw err;
    }

    const orderRes = await axiosClient.get(`/orders/${id}`);
    const targetOrder = orderRes.data;

    if (!targetOrder) {
      const err = new Error('ORDER_NOT_FOUND: KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng cáº§n há»§y.');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    if (targetOrder.status === 'cancelled' || targetOrder.status === 'historical_cancelled') {
      const err = new Error('ORDER_ALREADY_CANCELLED: ÄÆ¡n hÃ ng Ä‘Ã£ á»Ÿ tráº¡ng thÃ¡i Ä‘Ã£ há»§y.');
      err.code = 'ORDER_ALREADY_CANCELLED';
      throw err;
    }

    if (targetOrder.isRestocked) {
      const err = new Error('ORDER_ALREADY_RESTOCKED: ÄÆ¡n hÃ ng Ä‘Ã£ Ä‘Æ°á»£c hoÃ n kho trÆ°á»›c Ä‘Ã³.');
      err.code = 'ORDER_ALREADY_RESTOCKED';
      throw err;
    }

    const isAdmin = actor.role === 'admin';
    const isManagement = isAdmin || hasPermission(actor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT);

    if (!isManagement) {
      const sellerId = targetOrder.accountId || targetOrder.sellerId || targetOrder.createdBy;
      if (sellerId !== actor.id) {
        const err = new Error('CANCEL_DENIED: Báº¡n chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng do chÃ­nh mÃ¬nh táº¡o.');
        err.code = 'NOT_OWN_ORDER';
        throw err;
      }

      if (!currentSessionId || targetOrder.workSessionId !== currentSessionId) {
        const err = new Error('CANCEL_DENIED: Báº¡n chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng thuá»™c ca lÃ m viá»‡c hiá»‡n táº¡i.');
        err.code = 'NOT_CURRENT_SESSION';
        throw err;
      }

      const ageMs = Date.now() - new Date(targetOrder.createdAt).getTime();
      if (ageMs > 15 * 60 * 1000) {
        const err = new Error('CANCEL_DENIED: ÄÃ£ quÃ¡ 15 phÃºt ká»ƒ tá»« lÃºc táº¡o Ä‘Æ¡n, khÃ´ng thá»ƒ tá»± há»§y.');
        err.code = 'CANCEL_WINDOW_EXPIRED';
        throw err;
      }
    } else if (!isAdmin) {
      const orderBizDate = targetOrder.businessDate || (targetOrder.createdAt ? getBusinessDate(targetOrder.createdAt) : null);
      if (orderBizDate && orderBizDate !== getBusinessDate()) {
        const err = new Error('CANCEL_DENIED: Quáº£n lÃ½ chá»‰ Ä‘Æ°á»£c há»§y Ä‘Æ¡n hÃ ng trong ngÃ y lÃ m viá»‡c hiá»‡n táº¡i.');
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
        note: `HoÃ n kho - há»§y ${targetOrder.code || targetOrder.id}`,
        createdAt: new Date().toISOString(),
      }, actor);

      if (prod) {
        let attempt = 0;
        while (attempt < 3) {
          attempt++;
          try {
            const prodRes = await axiosClient.get(`/products/` + item.productId);
            const prod = prodRes.data;
            const currentStock = Number(prod.stockQuantity) || 0;
            const newStock = currentStock + Number(item.quantity);
            const expectedNextVersion = (prod.stockVersion || 0) + 1;
            const occSessionId = Math.random().toString(36).substring(2);
            await axiosClient.patch(`/products/` + item.productId, {
              stockQuantity: newStock,
              stockVersion: expectedNextVersion,
              _occSession: occSessionId,
              updatedAt: new Date().toISOString()
            });
            const verifyRes = await axiosClient.get(`/products/` + item.productId);
            if (verifyRes.data.stockVersion !== expectedNextVersion || verifyRes.data._occSession !== occSessionId) {
              const occErr = new Error('OCC_CONFLICT');
              occErr.code = 'OCC_CONFLICT';
              throw occErr;
            }
            break;
          } catch (err) {
            if (err.code === 'OCC_CONFLICT' && attempt < 3) continue;
            throw err;
          }
        }
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
    const err = new Error('ORDER_DELETION_RESTRICTED: ÄÆ¡n hÃ ng lÃ  báº£n ghi lá»‹ch sá»­ khÃ´ng Ä‘Æ°á»£c phÃ©p xÃ³a vÄ©nh viá»…n. Vui lÃ²ng sá»­ dá»¥ng chá»©c nÄƒng há»§y Ä‘Æ¡n.');
    err.code = 'ORDER_DELETION_RESTRICTED';
    throw err;
  },

  compensateCheckoutRollback: async (rollbackSteps, actor) => {
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: Authentication required for rollback.');
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

    for (let i = rollbackSteps.length - 1; i >= 0; i--) {
      const step = rollbackSteps[i];
      try {
        if (step.type === 'TRANSACTION') {
          await axiosClient.delete(`/inventoryTransactions/${step.transactionId}`);
        } else if (step.type === 'ORDER') {
          await axiosClient.delete(`/orders/${step.orderId}`);
        } else if (step.type === 'STOCK_DELTA') {
          let attempt = 0;
          while (attempt < 3) {
            attempt++;
            try {
              const prodRes = await axiosClient.get(`/products/${step.productId}`);
              const prod = prodRes.data;
              const currentStock = Number(prod.stockQuantity) || 0;
              const newStock = currentStock + Number(step.quantity);
              const expectedNextVersion = (prod.stockVersion || 0) + 1;
              const occSessionId = Math.random().toString(36).substring(2);
              await axiosClient.patch(`/products/${step.productId}`, {
                stockQuantity: newStock,
                stockVersion: expectedNextVersion,
                _occSession: occSessionId,
                updatedAt: new Date().toISOString()
              });
              const verifyRes = await axiosClient.get(`/products/${step.productId}`);
              if (verifyRes.data.stockVersion !== expectedNextVersion || verifyRes.data._occSession !== occSessionId) {
                const occErr = new Error('OCC_CONFLICT');
                occErr.code = 'OCC_CONFLICT';
                throw occErr;
              }
              break;
            } catch (err) {
              if (err.code === 'OCC_CONFLICT' && attempt < 3) continue;
              throw err;
            }
          }
        }
      } catch (err) {}
    }
  },

  removeInFlightOrder: async (orderId, actor) => {
    if (!actor || !actor.id) {
      const err = new Error('NOT_AUTHENTICATED: YÃªu cáº§u Ä‘Äƒng nháº­p Ä‘á»ƒ hoÃ n tÃ¡c Ä‘Æ¡n hÃ ng in-flight.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }
    assertPermission(actor, PERMISSIONS.ORDER_CREATE);
    const orderRes = await axiosClient.get(`/orders/${orderId}`);
    const order = orderRes.data;
    if (!order) return;

    if (actor.role !== 'admin' && String(order.accountId) !== String(actor.id) && String(order.sellerId) !== String(actor.id)) {
      const err = new Error('PERMISSION_DENIED: Báº¡n chá»‰ cÃ³ thá»ƒ hoÃ n tÃ¡c Ä‘Æ¡n hÃ ng in-flight do chÃ­nh mÃ¬nh táº¡o.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    const txRes = await axiosClient.get(`/inventoryTransactions?orderId=${orderId}`);
    const txList = Array.isArray(txRes.data) ? txRes.data : [];
    const activeTx = txList.filter(t => !t.isVoided);
    if (activeTx.length > 0) {
      const err = new Error('ORDER_DELETION_RESTRICTED: ÄÆ¡n hÃ ng Ä‘Ã£ cÃ³ giao dá»‹ch kho Ä‘Æ°á»£c xÃ¡c nháº­n, khÃ´ng thá»ƒ xÃ³a in-flight.');
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

    throw new Error('KhÃ´ng thá»ƒ táº¡o mÃ£ hÃ³a Ä‘Æ¡n duy nháº¥t, vui lÃ²ng thá»­ láº¡i.');
  }
};
