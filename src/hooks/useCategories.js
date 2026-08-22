import { useState, useContext } from 'react';
import { categoryApi } from '../api/categoryApi';
import { AppDataContext } from '../context/AppDataContext';
import { toast } from 'react-toastify';

export const useCategories = () => {
  const { categories, refreshCategories, loadingInitial } = useContext(AppDataContext);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error] = useState(null);

  const loading = loadingInitial || isRefetching;

  const refetch = async () => {
    setIsRefetching(true);
    await refreshCategories();
    setIsRefetching(false);
  };

  const createCategory = async (data) => {
    try {
      await categoryApi.create(data);
      toast.success('Thêm danh mục thành công');
      await refreshCategories();
      return true;
    } catch {
      toast.error('Thêm danh mục thất bại');
      return false;
    }
  };

  const updateCategory = async (id, data) => {
    try {
      await categoryApi.update(id, data);
      toast.success('Cập nhật danh mục thành công');
      await refreshCategories();
      return true;
    } catch {
      toast.error('Cập nhật danh mục thất bại');
      return false;
    }
  };

  const deleteCategory = async (id) => {
    try {
      await categoryApi.remove(id);
      toast.success('Xóa danh mục thành công');
      await refreshCategories();
      return true;
    } catch {
      toast.error('Xóa danh mục thất bại');
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
