import { useState, useContext, useMemo } from 'react';
import { categoryApi } from '../api/categoryApi';
import { AppDataContext } from '../context/AppDataContext';
import { useAuth } from './useAuth';
import { toast } from 'react-toastify';

export const useCategories = (includeInactive = false) => {
  const { categories: cachedCategories, refreshCategories, loadingInitial } = useContext(AppDataContext);
  const { currentUser } = useAuth();
  const [isRefetching, setIsRefetching] = useState(false);
  const [error] = useState(null);

  const categories = useMemo(() => {
    if (!Array.isArray(cachedCategories)) return [];
    if (!includeInactive) {
      return cachedCategories.filter(c => c && c.isActive !== false);
    }
    return cachedCategories.filter(Boolean);
  }, [cachedCategories, includeInactive]);

  const loading = loadingInitial || isRefetching;

  const refetch = async () => {
    setIsRefetching(true);
    await refreshCategories();
    setIsRefetching(false);
  };

  const createCategory = async (data) => {
    try {
      await categoryApi.create(data, currentUser);
      toast.success('Thêm danh mục thành công');
      await refreshCategories();
      return true;
    } catch (err) {
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Thêm danh mục thất bại');
      }
      return false;
    }
  };

  const updateCategory = async (id, data) => {
    try {
      await categoryApi.update(id, data, currentUser);
      toast.success('Cập nhật danh mục thành công');
      await refreshCategories();
      return true;
    } catch (err) {
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Cập nhật danh mục thất bại');
      }
      return false;
    }
  };

  const deleteCategory = async (id) => {
    try {
      await categoryApi.remove(id, currentUser);
      toast.success('Xóa danh mục thành công');
      await refreshCategories();
      return true;
    } catch (err) {
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Xóa danh mục thất bại');
      }
      return false;
    }
  };

  return {
    categories,
    loading,
    error,
    refetch,
    createCategory,
    updateCategory,
    deleteCategory
  };
};
