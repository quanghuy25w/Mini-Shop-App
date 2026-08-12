import { useContext } from 'react';
import { AppDataContext } from '../context/AppDataContext';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { generateId } from '../utils/generateId';
import { validateStock } from '../utils/validate';

export const useInventory = () => {
  const { products, refreshProducts } = useContext(AppDataContext);

  const importStock = async (productId, quantity, unitPrice, note) => {
    if (quantity <= 0) throw new Error("Số lượng nhập phải lớn hơn 0");
    
    // Luôn lấy từ cache mới nhất (mặc định react re-render khi context đổi)
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error("Sản phẩm không tồn tại");

    const transactionData = {
      id: generateId(),
      productId,
      type: 'IN',
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      note: note || '',
      createdAt: new Date().toISOString()
    };

    let createdTransaction = null;
    try {
      // 1. Tạo bản ghi giao dịch
      const res = await inventoryApi.createTransaction(transactionData);
      createdTransaction = res.data;

      // 2. Cập nhật tồn kho sản phẩm (PATCH)
      const newStock = product.stockQuantity + Number(quantity);
      await productApi.patch(productId, { stockQuantity: newStock });
      
      // 3. Cập nhật lại cache chung
      await refreshProducts();
      return true;
    } catch (error) {
      // Rollback (xóa transaction vừa tạo) nếu lỗi bước sau
      if (createdTransaction) {
        try {
          await inventoryApi.removeTransaction(createdTransaction.id);
        } catch (rollbackError) {
          console.error("Lỗi hoàn tác transaction:", rollbackError);
        }
      }
      throw new Error("Có lỗi xảy ra khi nhập kho, đã hoàn tác dữ liệu.");
    }
  };

  const exportStock = async (productId, quantity, note) => {
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error("Sản phẩm không tồn tại");

    // Validate giới hạn tồn kho TRƯỚC KHI tạo giao dịch
    const valError = validateStock(Number(quantity), product.stockQuantity);
    if (valError) {
      throw new Error(valError);
    }

    const transactionData = {
      id: generateId(),
      productId,
      type: 'OUT',
      quantity: Number(quantity),
      unitPrice: product.costPrice, // Dùng giá vốn làm đơn giá xuất kho nội bộ
      note: note || '',
      createdAt: new Date().toISOString()
    };

    let createdTransaction = null;
    try {
      const res = await inventoryApi.createTransaction(transactionData);
      createdTransaction = res.data;

      const newStock = product.stockQuantity - Number(quantity);
      await productApi.patch(productId, { stockQuantity: newStock });
      
      await refreshProducts();
      return true;
    } catch (error) {
      if (createdTransaction) {
        try {
          await inventoryApi.removeTransaction(createdTransaction.id);
        } catch (rollbackError) {
          console.error("Lỗi hoàn tác transaction:", rollbackError);
        }
      }
      throw new Error("Có lỗi xảy ra khi xuất kho, đã hoàn tác dữ liệu.");
    }
  };

  return { importStock, exportStock };
};
