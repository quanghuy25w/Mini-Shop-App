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
      throw new Error("Đang xử lý thanh toán, vui lòng không thao tác lặp lại!");
    }

    if (!currentUser?.id) {
      throw new Error('Vui lòng đăng nhập để thực hiện thanh toán.');
    }

    const isNotCheckedIn = !isCheckedIn || !currentSession?.id || currentSession?.status !== 'active' || (currentMember && currentMember.attendanceStatus === 'checked_out');
    if (isNotCheckedIn) {
      throw new Error('Bạn chưa check-in vào ca làm việc nào. Vui lòng check-in trước khi thanh toán.');
    }

    if (!cartContext.cartItems || cartContext.cartItems.length === 0) {
      throw new Error("Giỏ hàng trống!");
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
          const err = new Error(`REGISTER_NOT_FOUND: Quầy bán hàng "${registerId}" không tồn tại trong hệ thống.`);
          err.code = 'REGISTER_NOT_FOUND';
          throw err;
        }
        if (foundReg.isActive === false) {
          const err = new Error(`REGISTER_INACTIVE: Quầy bán hàng "${foundReg.name || foundReg.id}" đang bị vô hiệu hóa.`);
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
          throw new Error(`Sản phẩm "${item.productName || item.productId}" không tồn tại trên hệ thống.`);
        }
        if (currentProd.isActive === false) {
          throw new Error(`Sản phẩm "${currentProd.name || item.productName}" đã ngừng kinh doanh!`);
        }
        if (currentProd.stockQuantity < item.quantity) {
          throw new Error(`Sản phẩm "${item.productName}" không đủ tồn kho để thanh toán!`);
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
        throw new Error("Lỗi khi tạo mã hóa đơn tự động.", { cause: e });
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
          throw new Error(`Số tiền khách đưa (${numReceived.toLocaleString('vi-VN')}đ) không đủ để thanh toán đơn hàng (${finalAmount.toLocaleString('vi-VN')}đ).`);
        }
      }

      const change = (paymentMethod === 'cash' && cashReceived !== undefined && cashReceived !== null)
        ? Math.max(0, Number(cashReceived) - finalAmount)
        : 0;

      // STAGE 1: Trừ tồn kho sản phẩm (dùng updateStock để kích hoạt versioning & atomic validation)
      for (const item of itemsWithTx) {
        const currentProd = freshProductsMap.get(item.productId);
        const updatedStock = currentProd.stockQuantity - item.quantity;
        await productApi.updateStock(item.productId, updatedStock, currentUser, {
          source: 'pos_checkout',
          expectedVersion: currentProd.stockVersion || 0,
          orderCode
        });

        // Ghi lại delta phục hồi
        rollbackSteps.push({
          type: 'STOCK_DELTA',
          productId: item.productId,
          quantity: item.quantity
        });
      }

      // STAGE 2: Tạo order với status "completed" đã có sẵn inventoryTransactionIds (bất biến ngay từ đầu)
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
        console.error('[useCart] orderApi.create thất bại:', orderErr);
        throw new Error("Lỗi khi khởi tạo đơn hàng mới trên hệ thống.", { cause: orderErr });
      }

      // STAGE 3: Ghi nhận các giao dịch xuất kho SALE sau khi đơn hàng đã tồn tại hợp lệ
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
          note: `Bán lẻ qua đơn hàng ${createdOrder.code}`,
          createdAt: nowIso
        };

        const transRes = await inventoryApi.createTransaction(transactionData, currentUser, { source: 'pos_checkout' });
        const txId = transRes?.data?.id || item.txId;
        rollbackSteps.push({
          type: 'TRANSACTION',
          transactionId: txId
        });
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
      // Non-destructive delta-based rollback of all in-flight actions if checkout failed
      for (let i = rollbackSteps.length - 1; i >= 0; i--) {
        const step = rollbackSteps[i];
        try {
          if (step.type === 'TRANSACTION') {
            await inventoryApi.removeTransaction(step.transactionId, currentUser, { source: 'pos_checkout' });
          } else if (step.type === 'ORDER') {
            await orderApi.removeInFlightOrder(step.orderId, currentUser);
          } else if (step.type === 'STOCK_DELTA') {
            await productApi.adjustStockDelta(step.productId, step.quantity, currentUser, {
              source: 'pos_checkout_compensation'
            });
          }
        } catch (rollbackErr) {
          console.error(`Rollback thất bại:`, rollbackErr);
        }
      }

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
