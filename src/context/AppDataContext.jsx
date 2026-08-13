import React, { createContext, useState, useEffect, useCallback } from 'react';
import { categoryApi } from '../api/categoryApi';
import { productApi } from '../api/productApi';
import { initSeedData } from '../api/localStorageAdapter';
import { checkDemoMode } from '../api/axiosClient';

export const AppDataContext = createContext();

export const AppDataProvider = ({ children }) => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  const refreshCategories = useCallback(async () => {
    try {
      const res = await categoryApi.getAll();
      setCategories(res.data);
    } catch (err) {
      console.error('Lỗi khi fetch categories:', err);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const res = await productApi.getAll();
      setProducts(res.data);
    } catch (err) {
      console.error('Lỗi khi fetch products:', err);
    }
  }, []);

  const initializeData = useCallback(async () => {
    setLoadingInitial(true);
    // Chỉ nạp Seed Data nếu đang chạy ở Demo Mode
    if (checkDemoMode()) {
      initSeedData();
    }
    await Promise.all([refreshCategories(), refreshProducts()]);
    setLoadingInitial(false);
  }, [refreshCategories, refreshProducts]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  return (
    <AppDataContext.Provider value={{
      categories,
      products,
      refreshCategories,
      refreshProducts,
      loadingInitial
    }}>
      {children}
    </AppDataContext.Provider>
  );
};
