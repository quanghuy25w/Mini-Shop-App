import { useContext } from 'react';
import { CartContext } from '../context/CartContext';
import { AppDataContext } from '../context/AppDataContext';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { generateId } from '../utils/generateId';

export const useCart = () => {
  const cartContext = useContext(CartContext);
  const { refreshProducts, products } = useContext(AppDataContext);

  const checkout = async () => {
    if (cartContext.cartItems.length === 0) {
      throw new Error("Giỏ hàng trống!");
    }

    // a. Gọi generateOrderCode()
    let orderCode;
    try {
      orderCode = await orderApi.generateOrderCode();
    } catch (e) {
      throw new Error("Lỗi khi tạo mã hóa đơn tự động.");
    }

    // b. Tạo order với status "completed"
    const orderData = {
      id: generateId(),
      code: orderCode,
      items: cartContext.cartItems.map(i => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        price: i.price
      })),
      totalAmount: cartContext.totalAmount,
      status: "completed",
      createdAt: new Date().toISOString()
    };

    let createdOrder = null;
    try {
      const res = await orderApi.create(orderData);
      createdOrder = res.data;
    } catch (e) {
      throw new Error("Lỗi khi khởi tạo đơn hàng mới trên hệ thống.");
    }

    // Biến lưu trữ lịch sử các bước để rollback khi cần
    const rollbackSteps = []; 
    
    // c. Với TỪNG sản phẩm: PATCH trừ stock + tạo transaction OUT
    try {
      for (const item of cartContext.cartItems) {
        // Lấy dữ liệu sản phẩm gốc để chắc chắn số tồn kho là mới nhất
        const dbProduct = products.find(p => p.id === item.productId);
        if (!dbProduct || dbProduct.stockQuantity < item.quantity) {
          throw new Error(`Sản phẩm "${item.productName}" không đủ tồn kho để thanh toán!`);
        }

        // Tạo inventory transaction type OUT
        const transactionData = {
          id: generateId(),
          productId: item.productId,
          type: "OUT",
          quantity: item.quantity,
          unitPrice: item.price,
          note: `Bán hàng - ${orderCode}`,
          createdAt: new Date().toISOString()
        };
        const txRes = await inventoryApi.createTransaction(transactionData);
        const createdTx = txRes.data;

        // Trừ tồn kho
        const newStock = dbProduct.stockQuantity - item.quantity;
        await productApi.patch(item.productId, { stockQuantity: newStock });

        // Ghi lại bước này đã thành công để rollback nếu các item sau bị lỗi
        rollbackSteps.push({
          productId: item.productId,
          transactionId: createdTx.id,
          restoredStock: dbProduct.stockQuantity // Tồn kho cũ để khôi phục
        });
      }
    } catch (err) {
      // d. NẾU LỖI: ROLLBACK các bước đã thực hiện
      console.error("Lỗi khi thanh toán từng phần, bắt đầu quá trình rollback...", err);
      
      // 1. Hoàn tác số lượng tồn kho & Xóa transaction tương ứng
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

      throw new Error(err.message || "Quá trình thanh toán gặp sự cố. Hệ thống đã hoàn tác toàn bộ dữ liệu giỏ hàng.");
    }

    // e. Thành công toàn bộ
    cartContext.clearCart();
    await refreshProducts(); // Refresh để UI tự động cập nhật số lượng mới nhất
    
    return createdOrder; 
  };

  return {
    ...cartContext,
    checkout
  };
};
