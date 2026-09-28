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

// KhÃ³a Ä‘á»“ng bá»™ cáº¥p module chá»‘ng cháº¡y song song nhiá»u lá»‡nh checkout cÃ¹ng lÃºc
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
      throw new Error('Báº¡n chÆ°a check-in vÃ o ca lÃ m viá»‡c nÃ o. Vui lÃ²ng check-in trÆ°á»›c khi thanh toÃ¡n.');
    }

    if (!cartContext.cartItems || cartContext.cartItems.length === 0) {
      throw new Error("Giá» hÃ ng trá»‘ng!");
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
    const localRegisterId = getCurrentRegisterId();
    let registerId = localRegisterId || 'POS01';

    try {
      const canonicalRegisters = await registerApi.getAll();
      if (Array.isArray(canonicalRegisters) && canonicalRegisters.length > 0) {
        const foundReg = canonicalRegisters.find(r => r.id === registerId);
        if (!foundReg) {
          const err = new Error(`REGISTER_NOT_FOUND: Quáº§y bÃ¡n hÃ ng "${registerId}" khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng.`);
          err.code = 'REGISTER_NOT_FOUND';
          throw err;
        }
        if (foundReg.isActive === false) {
          const err = new Error(`REGISTER_INACTIVE: Quáº§y bÃ¡n hÃ ng "${foundReg.name || foundReg.id}" Ä‘ang bá»‹ vÃ´ hiá»‡u hÃ³a.`);
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

    // Biáº¿n lÆ°u trá»¯ lá»‹ch sá»­ cÃ¡c bÆ°á»›c Ä‘á»ƒ rollback khi cáº§n
    const rollbackSteps = [];

    try {
      // Sao chÃ©p snapshot danh sÃ¡ch sáº£n pháº©m Ä‘á»ƒ trÃ¡nh race condition khi cartItems thay Ä‘á»•i giá»¯a chá»«ng
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
        const canonPrice = Number(currentProd.sellPrice !== undefined ? currentProd.sellPrice : currentProd.price) || Number(item.price) || 0;
        const canonCost = Number(currentProd.costPrice) || canonPrice || 0;
        return {
          ...item,
          txId: generateId(),
          canonicalPrice: canonPrice,
          canonicalCost: canonCost
        };
      });
      const preGeneratedTxIds = itemsWithTx.map(i => i.txId);

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
          throw new Error(`Sá»‘ tiá»n khÃ¡ch Ä‘Æ°a (${numReceived.toLocaleString('vi-VN')}Ä‘) khÃ´ng Ä‘á»§ Ä‘á»ƒ thanh toÃ¡n Ä‘Æ¡n hÃ ng (${finalAmount.toLocaleString('vi-VN')}Ä‘).`);
        }
      }

      const change = (paymentMethod === 'cash' && cashReceived !== undefined && cashReceived !== null)
        ? Math.max(0, Number(cashReceived) - finalAmount)
        : 0;

      // STAGE 1: Trá»« tá»“n kho sáº£n pháº©m (dÃ¹ng updateStock Ä‘á»ƒ kÃ­ch hoáº¡t versioning & atomic validation)
      for (const item of itemsWithTx) {
        const currentProd = freshProductsMap.get(item.productId);
        const updatedStock = currentProd.stockQuantity - item.quantity;
        await productApi.deductStockForCheckout(item.productId, item.quantity, currentUser);

        // Ghi láº¡i delta phá»¥c há»“i
        rollbackSteps.push({
          type: 'STOCK_DELTA',
          productId: item.productId,
          quantity: item.quantity
        });
      }

      // STAGE 2: Táº¡o order vá»›i status "completed" Ä‘Ã£ cÃ³ sáºµn inventoryTransactionIds (báº¥t biáº¿n ngay tá»« Ä‘áº§u)
      const orderData = {
        ...extraPayload,
        id: orderId,
        code: orderCode,
        inventoryTransactionIds: preGeneratedTxIds,
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
        rollbackSteps.push({
          type: 'ORDER',
          orderId: createdOrder.id
        });
      } catch (orderErr) {
        console.error('[useCart] orderApi.create tháº¥t báº¡i:', orderErr);
        throw new Error("Lá»—i khi khá»Ÿi táº¡o Ä‘Æ¡n hÃ ng má»›i trÃªn há»‡ thá»‘ng.", { cause: orderErr });
      }

      // STAGE 3: Ghi nháº­n cÃ¡c giao dá»‹ch xuáº¥t kho SALE sau khi Ä‘Æ¡n hÃ ng Ä‘Ã£ tá»“n táº¡i há»£p lá»‡
      for (const item of itemsWithTx) {
        const transactionData = {
          id: item.txId,
          productId: item.productId,
          type: 'OUT',
          reason: 'SALE',
          quantity: item.quantity,
          unitPrice: item.canonicalPrice,
          unitCost: item.canonicalCost,
          accountId: currentUser.id,
          workSessionId: currentSession?.id || null,
          registerId,
          businessDate,
          outOfShift: outOfShiftFlag,
          orderId: createdOrder.id,
          orderCode: createdOrder.code,
          note: `BÃ¡n láº» qua Ä‘Æ¡n hÃ ng ${createdOrder.code}`,
          createdAt: nowIso
        };

        const transRes = await inventoryApi.createTransaction(transactionData, currentUser, { source: 'pos_checkout' });
        const txId = transRes?.data?.id || item.txId;
        rollbackSteps.push({
          type: 'TRANSACTION',
          transactionId: txId
        });
      }

      // ThÃ nh cÃ´ng toÃ n bá»™: Cáº­p nháº­t dá»¯ liá»‡u sáº£n pháº©m trong AppDataContext trÆ°á»›c, sau Ä‘Ã³ xÃ³a giá» hÃ ng
      try {
        await refreshProducts();
      } catch (refreshErr) {
        console.warn("[useCart] refreshProducts gáº·p sá»± cá»‘:", refreshErr);
      }
      cartContext.clearCart();

      return createdOrder;
    } catch (err) {
      // Non-destructive delta-based rollback of all in-flight actions if checkout failed
      await orderApi.compensateCheckoutRollback(rollbackSteps, currentUser);
      throw new Error(err.message || "QuÃ¡ trÃ¬nh thanh toÃ¡n gáº·p sá»± cá»‘.", { cause: err });
    } finally {
      isCheckoutRunning = false;
    }
  };

  return {
    ...cartContext,
    checkout
  };
};
