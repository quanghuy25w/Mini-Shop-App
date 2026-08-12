import { useState, useEffect, useContext } from 'react';
import { productApi } from '../api/productApi';
import { AppDataContext } from '../context/AppDataContext';
import { toast } from 'react-toastify';

export const useProducts = (includeInactive = false) => {
  const { products: cachedProducts, refreshProducts, categories, loadingInitial } = useContext(AppDataContext);
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(loadingInitial);
    if (!loadingInitial) {
      let filtered = cachedProducts;
      if (!includeInactive) {
        filtered = cachedProducts.filter(p => p.isActive === true);
      }
      setProducts(filtered);
    }
  }, [cachedProducts, includeInactive, loadingInitial]);

  const refetch = async () => {
    setLoading(true);
    await refreshProducts();
    setLoading(false);
  };

  const createProduct = async (data) => {
    try {
      await productApi.create(data);
      toast.success('Thêm sản phẩm thành công');
      await refreshProducts();
      return true;
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
