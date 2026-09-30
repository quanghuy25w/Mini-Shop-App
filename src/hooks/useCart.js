import { useContext } from 'react';
import { CartContext } from '../context/CartContext';
import { AppDataContext } from '../context/AppDataContext';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionContext } from '../context/WorkSessionContext';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { registerApi } from '../api/registerApi';
import { generateId } from '../utils/generateId';
import { getCurrentRegisterId } from '../utils/registerConfig';
import { getBusinessDate } from '../utils/businessDate';
import { isOutOfShift } from '../api/workSessionApi';

// Khóa đồng bộ cấp module chống chạy song song nhiều lệnh checkout cùng lúc
let isCheckoutRunning = false;

export const useCart = () => {
  const cartContext = useContext(CartContext);
  const { refreshProducts } = useContext(AppDataContext);
  const authContext = useContext(AuthContext);
  const workSessionContext = useContext(WorkSessionContext);

  const currentUser = authContext?.currentUser;
  const currentSession = workSessionContext?.currentSession;
  const currentMember = workSessionContext?.currentMember;
  const isCheckedIn = workSessionContext?.isCheckedIn;

  const checkout = async (arg1, arg2, arg3) => {
    if (isCheckoutRunning) {
      throw new Error("Äang xá»­ lÃ½ thanh toÃ¡n, vui lÃ²ng khÃ´ng thao tÃ¡c láº·p láº¡i!");
    }

    if (!currentUser?.id) {
      throw new Error('Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ thá»±c hiá»‡n thanh toÃ¡n.');
    }

    const isNotCheckedIn = !isCheckedIn || !currentSession?.id || currentSession?.status !== 'active' || (currentMember && currentMember.attendanceStatus === 'checked_out');
    if (isNotCheckedIn) {
      throw new Error('Báº¡n chÆ°a check-in vÃ o ca lÃ m viá»‡c nÃ o. Vui lÃ²ng check-in trÆ°á»›c khi thanh toÃ¡n.');
    }

    if (!cartContext.cartItems || cartContext.cartItems.length === 0) {
      throw new Error("Giá» hÃ ng trá»‘ng!");
    }

    let customTotalAmount = undefined;
    let paymentMethod = 'cash';
    let cashReceived = undefined;
    let extraPayload = {};

    if (typeof arg1 === 'number') {
      customTotalAmount = arg1;
      if (typeof arg2 === 'object' && arg2 !== null) {
        extraPayload = arg2;
        paymentMethod = arg2.paymentMethod || 'cash';
        cashReceived = arg2.cashReceived;
      } else if (typeof arg2 === 'string') {
        paymentMethod = arg2;
        cashReceived = arg3;
      }
    } else if (typeof arg1 === 'string') {
      paymentMethod = arg1;
      cashReceived = arg2;
      if (typeof arg3 === 'object' && arg3 !== null) {
        extraPayload = arg3;
      }
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      extraPayload = arg1;
      customTotalAmount = arg1.totalAmount;
      paymentMethod = arg1.paymentMethod || 'cash';
      cashReceived = arg1.cashReceived;
    }

    // Validate canonical register from registerApi/db.json
    const registerId = getCurrentRegisterId();
    if (!registerId) {
      throw new Error('REGISTER_MISSING: Không xác định được quầy bán hàng. Vui lòng cấu hình quầy.');
    }

    try {
      const canonicalRegisters = await registerApi.getAll();
      if (Array.isArray(canonicalRegisters) && canonicalRegisters.length > 0) {
        const foundReg = canonicalRegisters.find(r => r.id === registerId);
        if (!foundReg) {
          const err = new Error(`REGISTER_NOT_FOUND: Quáº§y bÃ¡n hÃ ng "${registerId}" khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng.`);
          err.code = 'REGISTER_NOT_FOUND';
          throw err;
        }
        if (foundReg.isActive === false) {
          const err = new Error(`REGISTER_INACTIVE: Quáº§y bÃ¡n hÃ ng "${foundReg.name || foundReg.id}" Ä‘ang bá»‹ vÃ´ hiá»‡u hÃ³a.`);
          err.code = 'REGISTER_INACTIVE';
          throw err;
        }
      }
    } catch (regErr) {
      if (regErr.code === 'REGISTER_NOT_FOUND' || regErr.code === 'REGISTER_INACTIVE') {
        throw regErr;
      }
    }

    isCheckoutRunning = true;

    // Biến lưu trữ lịch sử các bước để rollback khi cần
    const rollbackSteps = [];

    try {
      // Sao chép snapshot danh sách sản phẩm để tránh race condition khi cartItems thay đổi giữa chừng
      const itemsToProcess = [...cartContext.cartItems];

      // Upfront validation: verify all products exist, are active, and have sufficient stock before mutating anything
      const freshProductsMap = new Map();
      for (const item of itemsToProcess) {
        const pRes = await productApi.getById(item.productId);
        const currentProd = pRes.data;

        if (!currentProd) {
          throw new Error(`Sáº£n pháº©m "${item.productName || item.productId}" khÃ´ng tá»“n táº¡i trÃªn há»‡ thá»‘ng.`);
        }
        if (currentProd.isActive === false) {
          throw new Error(`Sáº£n pháº©m "${currentProd.name || item.productName}" Ä‘Ã£ ngá»«ng kinh doanh!`);
        }
        if (currentProd.stockQuantity < item.quantity) {
          throw new Error(`Sáº£n pháº©m "${item.productName}" khÃ´ng Ä‘á»§ tá»“n kho Ä‘á»ƒ thanh toÃ¡n!`);
        }
        freshProductsMap.set(item.productId, currentProd);
      }

      const nowIso = new Date().toISOString();
      const businessDate = (currentSession && currentSession.date) ? currentSession.date : getBusinessDate(nowIso);
      const outOfShiftFlag = isOutOfShift(currentSession);

      // a. Pre-generate order identifiers and transaction IDs upfront
      let orderCode;
      try {
        orderCode = await orderApi.generateOrderCode(businessDate);
      } catch (e) {
        throw new Error("Lá»—i khi táº¡o mÃ£ hÃ³a Ä‘Æ¡n tá»± Ä‘á»™ng.", { cause: e });
      }

      const orderId = generateId();
      const itemsWithTx = itemsToProcess.map(item => {
        const currentProd = freshProductsMap.get(item.productId);
        const canonPrice = Number(currentProd.sellPrice !== undefined ? currentProd.sellPrice : currentProd.price);
        if (isNaN(canonPrice)) {
          throw new Error(`Sản phẩm "${currentProd.name || item.productId}" không có giá niêm yết hợp lệ!`);
        }
        const canonCost = Number(currentProd.costPrice); // Can be undefined or NaN, but canonicalPrice is the selling price
        return {
          ...item,
          canonicalPrice: canonPrice,
          canonicalCost: canonCost
        };
      });

      const authoritativeSubtotal = itemsWithTx.reduce((sum, item) => sum + (item.canonicalPrice * (item.quantity || 1)), 0);
      let calculatedDiscount = 0;
      if (extraPayload.discountType === 'percent') {
        const val = Number(extraPayload.discountValue !== undefined ? extraPayload.discountValue : (extraPayload.discount || 0));
        calculatedDiscount = Math.round(authoritativeSubtotal * (val / 100));
      } else if (extraPayload.discountType === 'fixed') {
        const val = Number(extraPayload.discountValue !== undefined ? extraPayload.discountValue : (extraPayload.discount || 0));
        calculatedDiscount = Math.min(val, authoritativeSubtotal);
      } else if (customTotalAmount !== undefined && customTotalAmount !== null && !isNaN(customTotalAmount) && Number(customTotalAmount) !== cartContext.totalAmount) {
        calculatedDiscount = Math.max(0, authoritativeSubtotal - Number(customTotalAmount));
      } else if (cartContext.totalAmount !== undefined && cartContext.subtotal !== undefined && cartContext.subtotal > cartContext.totalAmount) {
        calculatedDiscount = Math.max(0, cartContext.subtotal - cartContext.totalAmount);
      }
      const finalAmount = Math.max(0, authoritativeSubtotal - calculatedDiscount);
      const discountAmount = calculatedDiscount;

      if (paymentMethod === 'cash' && cashReceived !== undefined && cashReceived !== null) {
        const numReceived = Number(cashReceived);
        if (isNaN(numReceived) || numReceived < finalAmount) {
          throw new Error(`Sá»‘ tiá»n khÃ¡ch Ä‘Æ°a (${numReceived.toLocaleString('vi-VN')}Ä‘) khÃ´ng Ä‘á»§ Ä‘á»ƒ thanh toÃ¡n Ä‘Æ¡n hÃ ng (${finalAmount.toLocaleString('vi-VN')}Ä‘).`);
        }
      }

      const change = (paymentMethod === 'cash' && cashReceived !== undefined && cashReceived !== null)
        ? Math.max(0, Number(cashReceived) - finalAmount)
        : 0;
      const orderData = {
        ...extraPayload,
        id: orderId,
        code: orderCode,
        items: itemsWithTx.map(i => ({
          productId: i.productId,
          productName: i.productName || '',
          quantity: i.quantity || 1,
          price: i.canonicalPrice
        })),
        subtotal: authoritativeSubtotal,
        discountAmount,
        totalAmount: finalAmount,
        paymentMethod,
        cashReceived: cashReceived !== undefined ? Number(cashReceived) : undefined,
        change,
        status: "completed",
        accountId: currentUser.id,
        sellerId: currentUser.id,
        workSessionId: currentSession?.id || null,
        registerId,
        businessDate,
        outOfShift: outOfShiftFlag,
        createdAt: nowIso
      };

      let createdOrder = null;
      try {
        const res = await orderApi.create(orderData, currentUser, { requireSellingContext: true, requireStrictTotals: true });
        createdOrder = res.data || orderData;
        if (!createdOrder.createdAt) {
          createdOrder.createdAt = nowIso;
        }
        if (!createdOrder.items) {
          createdOrder.items = orderData.items;
        }
      } catch (orderErr) {
        console.error('[useCart] orderApi.create thất bại:', orderErr);
        throw new Error("Lỗi khi khởi tạo đơn hàng mới trên hệ thống.", { cause: orderErr });
      }

      // Thành công toàn bộ: Cập nhật dữ liệu sản phẩm trong AppDataContext trước, sau đó xóa giỏ hàng
      try {
        await refreshProducts();
      } catch (refreshErr) {
        console.warn("[useCart] refreshProducts gặp sự cố:", refreshErr);
      }
      cartContext.clearCart();

      return createdOrder;
    } catch (err) {
      throw new Error(err.message || "Quá trình thanh toán gặp sự cố.", { cause: err });
    } finally {
      isCheckoutRunning = false;
    }
  };

  return {
    ...cartContext,
    checkout
  };
};


