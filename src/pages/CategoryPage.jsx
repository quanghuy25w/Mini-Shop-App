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

  const [searchTerm, setSearchTerm] = useState('');
  const [productCounts, setProductCounts] = useState({});

  React.useEffect(() => {
    const fetchProductCounts = async () => {
      try {
        const res = await productApi.getAll();
        const counts = {};
        res.data.forEach(p => {
          if (p.isActive) {
            counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
          }
        });
        setProductCounts(counts);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProductCounts();
  }, []);

  const filteredCategories = React.useMemo(() => {
    return categories.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [categories, searchTerm]);

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
        <div>
          <h2>Quản lý Danh mục</h2>
          <p className="page-subtitle">Quản lý danh mục sản phẩm cửa hàng của bạn.</p>
        </div>
        <button className="btn-primary" onClick={() => handleOpenForm()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>+ Thêm danh mục</span>
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Tìm kiếm danh mục..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        {filteredCategories.length === 0 ? (
          <EmptyState message="Không tìm thấy danh mục phù hợp." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th width="50px" className="text-center">#</th>
                  <th>Tên danh mục</th>
                  <th className="text-center">Số lượng sản phẩm</th>
                  <th>Mô tả</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat, idx) => (
                  <tr key={cat.id}>
                    <td className="text-center text-muted font-mono">{idx + 1}</td>
                    <td><strong className="category-title-name">{cat.name}</strong></td>
                    <td className="text-center font-mono font-bold">{productCounts[cat.id] || 0}</td>
                    <td>{cat.description || '-'}</td>
                    <td className="text-center actions-cell">
                      <button className="btn-action-icon btn-action-edit" onClick={() => handleOpenForm(cat)} title="Chỉnh sửa">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button className="btn-action-icon btn-action-delete" onClick={() => handleDeleteRequest(cat)} title="Xóa">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-footer-info">
              <span>Hiển thị 1 - {filteredCategories.length} của {categories.length} danh mục</span>
            </div>
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
