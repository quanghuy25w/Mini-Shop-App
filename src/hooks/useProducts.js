import { useState, useMemo, useContext } from 'react';
import { productApi } from '../api/productApi';
import { AppDataContext } from '../context/AppDataContext';
import { toast } from 'react-toastify';

export const useProducts = (includeInactive = false) => {
  const { products: cachedProducts, refreshProducts, categories, loadingInitial } = useContext(AppDataContext);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error] = useState(null);

  const products = useMemo(() => {
    if (!includeInactive) {
      return cachedProducts.filter(p => p.isActive === true);
    }
    return cachedProducts;
  }, [cachedProducts, includeInactive]);

  const loading = loadingInitial || isRefetching;

  const refetch = async () => {
    setIsRefetching(true);
    await refreshProducts();
    setIsRefetching(false);
  };

  const createProduct = async (data) => {
    try {
      await productApi.create(data);
      toast.success('Thêm sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch {
      toast.error('Thêm sản phẩm thất bại');
      return false;
    }
  };

  const updateProduct = async (id, data) => {
    try {
      await productApi.update(id, data);
      toast.success('Cập nhật sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch {
      toast.error('Cập nhật sản phẩm thất bại');
      return false;
    }
  };

  const deleteProduct = async (id) => {
    try {
      await productApi.softDelete(id);
      toast.success('Xóa sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch {
      toast.error('Xóa sản phẩm thất bại');
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
    deleteProduct
  };
};
