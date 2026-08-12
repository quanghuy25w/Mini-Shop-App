import React, { useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { productApi } from '../api/productApi';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import CategoryFormModal from '../components/category/CategoryFormModal';
import { toast } from 'react-toastify';
import './CategoryPage.css';

const CategoryPage = () => {
  const { categories, loading, error, refetch, createCategory, updateCategory, deleteCategory } = useCategories();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [canDelete, setCanDelete] = useState(false);

  const handleOpenForm = (category = null) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
  };

  const handleSubmitForm = async (data) => {
    let success = false;
    if (editingCategory) {
      success = await updateCategory(editingCategory.id, data);
    } else {
      success = await createCategory(data);
    }
    
    if (success) {
      handleCloseForm();
    }
  };

  const handleDeleteRequest = async (category) => {
    try {
      // Kiểm tra sản phẩm thuộc danh mục này
      const res = await productApi.getAll();
      const products = res.data;
      
      const activeProducts = products.filter(
        p => p.categoryId === category.id && p.isActive === true
      );

      setDeletingCategory(category);
      if (activeProducts.length > 0) {
        setConfirmMessage(`Không thể xóa vì còn ${activeProducts.length} sản phẩm thuộc danh mục này.`);
        setCanDelete(false);
      } else {
        setConfirmMessage(`Bạn có chắc chắn muốn xóa danh mục "${category.name}" không? Hành động này không thể hoàn tác.`);
        setCanDelete(true);
      }
      setIsConfirmOpen(true);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi kiểm tra dữ liệu sản phẩm');
    }
  };

  const confirmDelete = async () => {
    if (canDelete && deletingCategory) {
      await deleteCategory(deletingCategory.id);
    }
    setIsConfirmOpen(false);
    setDeletingCategory(null);
  };

  if (loading) return <LoadingSpinner />;
  
  if (error) {
    return (
      <div className="error-state">
        <p>Có lỗi xảy ra: {error}</p>
        <button className="btn-primary" onClick={refetch}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Quản lý Danh mục</h2>
        <button className="btn-primary" onClick={() => handleOpenForm()}>+ Thêm danh mục</button>
      </div>

      <div className="page-content">
        {categories.length === 0 ? (
          <EmptyState message="Chưa có danh mục nào. Hãy thêm danh mục đầu tiên!" />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th width="30%">Tên danh mục</th>
                  <th width="45%">Mô tả</th>
                  <th width="25%" className="text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id}>
                    <td><strong>{cat.name}</strong></td>
                    <td>{cat.description || '-'}</td>
                    <td className="text-center actions-cell">
                      <button className="btn-icon btn-edit" onClick={() => handleOpenForm(cat)}>Sửa</button>
                      <button className="btn-icon btn-delete" onClick={() => handleDeleteRequest(cat)}>Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CategoryFormModal 
        isOpen={isFormOpen} 
        onClose={handleCloseForm} 
        onSubmit={handleSubmitForm}
        initialData={editingCategory}
        categories={categories}
      />

      <ConfirmDialog 
        isOpen={isConfirmOpen}
        title="Xác nhận"
        message={confirmMessage}
        onConfirm={confirmDelete}
        onCancel={() => setIsConfirmOpen(false)}
        showCancel={canDelete}
      />
    </div>
  );
};

export default CategoryPage;
