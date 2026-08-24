import { useContext } from 'react';
import { CartContext } from '../context/CartContext';
import { AppDataContext } from '../context/AppDataContext';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { generateId } from '../utils/generateId';

// Khóa đồng bộ cấp module chống chạy song song nhiều lệnh checkout cùng lúc
let isCheckoutRunning = false;

export const useCart = () => {
  const cartContext = useContext(CartContext);
  const { refreshProducts } = useContext(AppDataContext);

  const checkout = async (customTotalAmount) => {
    if (isCheckoutRunning) {
      throw new Error("Đang xử lý thanh toán, vui lòng không thao tác lặp lại!");
    }
    if (!cartContext.cartItems || cartContext.cartItems.length === 0) {
      throw new Error("Giỏ hàng trống!");
    }

    isCheckoutRunning = true;

    try {
      // Sao chép snapshot danh sách sản phẩm để tránh race condition khi cartItems thay đổi giữa chừng
      const itemsToProcess = [...cartContext.cartItems];

      // a. Gọi generateOrderCode()
      let orderCode;
      try {
        orderCode = await orderApi.generateOrderCode();
      } catch (e) {
        throw new Error("Lỗi khi tạo mã hóa đơn tự động.", { cause: e });
      }

      const subtotal = cartContext.totalAmount; // tổng giá gốc chưa giảm
      const finalAmount = (customTotalAmount !== undefined && customTotalAmount !== null && !isNaN(customTotalAmount))
        ? Number(customTotalAmount)
        : subtotal;
      const discountAmount = Math.max(0, subtotal - finalAmount);

      // b. Tạo order với status "completed"
      const nowIso = new Date().toISOString();
      const orderData = {
        id: generateId(),
        code: orderCode,
        items: itemsToProcess.map(i => ({
          productId: i.productId,
          productName: i.productName || '',
          quantity: i.quantity || 1,
          price: i.price || 0          // giá gốc niêm yết từng dòng, KHÔNG chia đều discount
        })),
        subtotal: subtotal,
        discountAmount: discountAmount,
        totalAmount: finalAmount,
        status: "completed",
        createdAt: nowIso
      };

      let createdOrder = null;
      try {
        const res = await orderApi.create(orderData);
        createdOrder = res.data || orderData;
        if (!createdOrder.createdAt) {
          createdOrder.createdAt = nowIso;
        }
        if (!createdOrder.items) {
          createdOrder.items = orderData.items;
        }

        // FIX 3: Xác nhận cuối — phát hiện trường hợp cực hiếm 2 request lọt qua
        // generateOrderCode cùng lúc (sau khi đã có FIX1 + FIX2, xác suất gần như 0)
        try {
          const dupCheck = await orderApi.getAll();
          const sameCode = (dupCheck.data || []).filter(o => o && o.code === createdOrder.code);
          if (sameCode.length > 1) {
            console.warn(
              `[useCart] DUPLICATE ORDER CODE DETECTED: "${createdOrder.code}" xuất hiện ${sameCode.length} lần. ` +
              `IDs: ${sameCode.map(o => o.id).join(', ')}. Cần kiểm tra thủ công.`
            );
          }
        } catch (dupErr) {
          // Không throw — đây chỉ là cảnh báo, không được block luồng chính
          console.warn('[useCart] Không thể kiểm tra duplicate code:', dupErr);
        }
      } catch (e) {
        console.error('[useCart] orderApi.create thất bại:', e);
        throw new Error("Lỗi khi khởi tạo đơn hàng mới trên hệ thống.", { cause: e });
      }

      // Biến lưu trữ lịch sử các bước để rollback khi cần
      const rollbackSteps = []; 
      
      // c. Với TỪNG sản phẩm: PATCH trừ stock + tạo transaction OUT
      try {
        for (const item of itemsToProcess) {
          // Lấy dữ liệu sản phẩm gốc để chắc chắn số tồn kho là mới nhất
          const pRes = await productApi.getById(item.productId);
          const currentProd = pRes.data;

          if (!currentProd || currentProd.stockQuantity < item.quantity) {
            throw new Error(`Sản phẩm "${item.productName}" không đủ tồn kho để thanh toán!`);
          }

          // Tạo bản ghi giao dịch OUT
          const transactionData = {
            id: generateId(),
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            unitPrice: item.price,
            note: `Bán lẻ qua đơn hàng ${orderCode}`,
            createdAt: new Date().toISOString()
          };
          const transRes = await inventoryApi.createTransaction(transactionData);
          
          // Trừ tồn kho sản phẩm (PATCH)
          const updatedStock = currentProd.stockQuantity - item.quantity;
          await productApi.patch(item.productId, { stockQuantity: updatedStock });

          // Ghi lại bước đã thực hiện thành công để sẵn sàng hoàn tác nếu bước sau gãy
          rollbackSteps.push({
            productId: item.productId,
            transactionId: transRes.data.id,
            restoredStock: currentProd.stockQuantity
          });
        }
      } catch (err) {
        console.error("[useCart] Lỗi xảy ra trong quá trình trừ kho:", err);
        // d. NẾU BẤT KỲ BƯỚC NÀO LỖI -> ROLLBACK TOÀN BỘ
        // 1. Phục hồi tồn kho và xóa transaction các sản phẩm đã trừ trước đó
        for (const step of rollbackSteps) {
          try {
            await productApi.patch(step.productId, { stockQuantity: step.restoredStock });
            await inventoryApi.removeTransaction(step.transactionId);
          } catch (rollbackErr) {
            console.error(`Rollback thất bại cho sản phẩm ${step.productId}:`, rollbackErr);
          }
        }

        // 2. Xóa đơn hàng đã tạo ở bước (b)
        try {
          if (createdOrder) {
            await orderApi.remove(createdOrder.id);
          }
        } catch (rollbackErr) {
          console.error("Rollback xóa order thất bại:", rollbackErr);
        }

        throw new Error(err.message || "Quá trình thanh toán gặp sự cố. Hệ thống đã hoàn tác toàn bộ dữ liệu giỏ hàng.", { cause: err });
      }

      // e. Thành công toàn bộ: Cập nhật dữ liệu sản phẩm trong AppDataContext trước, sau đó xóa giỏ hàng
      try {
        await refreshProducts(); // Refresh để UI tự động cập nhật số lượng mới nhất
      } catch (refreshErr) {
        console.warn("[useCart] refreshProducts gặp sự cố:", refreshErr);
      }
      cartContext.clearCart();
      
      return createdOrder; 
    } finally {
      isCheckoutRunning = false;
    }
  };

  return {
    ...cartContext,
    checkout
  };
};
