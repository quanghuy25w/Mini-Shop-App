import { useState, useMemo, useContext } from 'react';
import { productApi } from '../api/productApi';
import { inventoryApi, INVENTORY_TYPES, INVENTORY_REASONS } from '../api/inventoryApi';
import { AppDataContext } from '../context/AppDataContext';
import { useAuth } from './useAuth';
import { generateId } from '../utils/generateId';
import { getBusinessDate } from '../utils/businessDate';
import { toast } from 'react-toastify';

export const useProducts = (includeInactive = false) => {
  const { products: cachedProducts, refreshProducts, categories, loadingInitial } = useContext(AppDataContext);
  const { currentUser } = useAuth();
  const [isRefetching, setIsRefetching] = useState(false);
  const [error] = useState(null);

  const products = useMemo(() => {
    if (!Array.isArray(cachedProducts)) return [];
    if (!includeInactive) {
      return cachedProducts.filter(p => p && p.isActive === true);
    }
    return cachedProducts.filter(Boolean);
  }, [cachedProducts, includeInactive]);

  const loading = loadingInitial || isRefetching;

  const refetch = async () => {
    setIsRefetching(true);
    await refreshProducts();
    setIsRefetching(false);
  };

  const createProduct = async (data) => {
    let createdProduct = null;
    let openingTx = null;
    const initialStock = Number(data.stockQuantity) || 0;
    const initialCost = Number(data.costPrice) || 0;

    try {
      // 1. Tạo sản phẩm với stockQuantity: 0 trước để tuân thủ nguyên tắc chỉ đổi tồn qua chứng từ
      const productPayload = {
        ...data,
        stockQuantity: 0,
        costPrice: initialCost
      };
      const res = await productApi.create(productPayload, currentUser);
      createdProduct = res.data;

      // 2. Nếu có tồn đầu kỳ > 0, tạo giao dịch kho OPENING và updateStock
      if (initialStock > 0 && createdProduct?.id) {
        const txPayload = {
          id: generateId(),
          productId: createdProduct.id,
          type: INVENTORY_TYPES.IN,
          reason: INVENTORY_REASONS.OPENING,
          quantity: initialStock,
          unitPrice: initialCost,
          accountId: currentUser?.id || null,
          businessDate: getBusinessDate(),
          note: 'Tồn đầu kỳ khi tạo sản phẩm',
          createdAt: new Date().toISOString()
        };

        const txRes = await inventoryApi.createTransaction(txPayload, currentUser);
        openingTx = txRes.data;

        await productApi.updateStock(createdProduct.id, initialStock, currentUser, {
          source: 'inventory_opening',
          transactionId: openingTx.id
        });
      }

      toast.success('Thêm sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch (err) {
      // Rollback nếu bước ghi phiếu hoặc updateStock thất bại
      if (openingTx) {
        try {
          await inventoryApi.removeTransaction(openingTx.id, currentUser, { source: 'inventory_opening' });
        } catch (rbErr) {
          console.error("Lỗi hoàn tác transaction tồn đầu:", rbErr);
        }
      }
      if (createdProduct) {
        try {
          await productApi.softDelete(createdProduct.id, currentUser);
        } catch (rbErr) {
          console.error("Lỗi rollback sản phẩm:", rbErr);
        }
      }

      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Thêm sản phẩm thất bại');
      }
      return false;
    }
  };

  const updateProduct = async (id, data) => {
    try {
      await productApi.update(id, data, currentUser);
      toast.success('Cập nhật sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch (err) {
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Cập nhật sản phẩm thất bại');
      }
      return false;
    }
  };

  const deleteProduct = async (id) => {
    try {
      await productApi.softDelete(id, currentUser);
      toast.success('Xóa sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch (err) {
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Xóa sản phẩm thất bại');
      }
      return false;
    }
  };

  const reactivateProduct = async (id) => {
    try {
      await productApi.reactivate(id, currentUser);
      toast.success('Khôi phục sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch (err) {
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Khôi phục sản phẩm thất bại');
      }
      return false;
    }
  };

  return {
    products,
    categories,
    loading,
    error,
    refetch,
    createProduct,
    updateProduct,
    deleteProduct,
    reactivateProduct
  };
};
