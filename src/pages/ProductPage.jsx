import React, { useState, useEffect, useMemo } from 'react';
import { useProducts } from '../hooks/useProducts';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ProductFormModal from '../components/product/ProductFormModal';
import { formatCurrency } from '../utils/formatCurrency';
import { exportToCSV } from '../utils/exportCSV';
import './ProductPage.css';

const ProductPage = () => {
  const { products, categories, loading, error, refetch, createProduct, updateProduct, deleteProduct } = useProducts();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchName = p.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchCat = filterCategory ? p.categoryId === filterCategory : true;
      return matchName && matchCat;
    });
  }, [products, debouncedSearch, filterCategory]);

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Không rõ';
  };

  const handleExportCSV = () => {
    const data = filteredProducts.map(p => ({
      'Tên sản phẩm': p.name,
      'Danh mục': getCategoryName(p.categoryId),
      'ĐVT': p.unit,
      'Tồn kho': p.stockQuantity,
      'Giá vốn': p.costPrice,
      'Giá bán': p.sellPrice
    }));
    exportToCSV(data, 'Bao_Cao_Ton_Kho.csv');
  };

  const handleOpenForm = (product = null) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
  };

  const handleSubmitForm = async (data) => {
    let success = false;
    if (editingProduct) {
      success = await updateProduct(editingProduct.id, data);
    } else {
      success = await createProduct(data);
    }
    if (success) {
      handleCloseForm();
    }
  };

  const handleDeleteRequest = (product) => {
    setDeletingProduct(product);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingProduct) {
      await deleteProduct(deletingProduct.id);
    }
    setIsConfirmOpen(false);
    setDeletingProduct(null);
  };

  const renderStockBadge = (product) => {
    if (product.stockQuantity === 0) {
      return <span className="badge badge-danger">Hết hàng</span>;
    }
    if (product.stockQuantity <= product.minStockAlert) {
      return <span className="badge badge-warning">Sắp hết hàng</span>;
    }
    return <span className="badge badge-success">Còn hàng</span>;
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
        <h2>Quản lý Sản phẩm</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" style={{ padding: '10px 20px', border: '1px solid #3498db', background: 'white', color: '#3498db', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }} onClick={handleExportCSV}>Xuất báo cáo CSV</button>
          <button className="btn-primary" onClick={() => handleOpenForm()}>+ Thêm sản phẩm</button>
        </div>
      </div>

      <div className="filter-bar">
        <input 
          type="text" 
          placeholder="Tìm kiếm sản phẩm theo tên..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
          className="category-filter"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="page-content">
        {filteredProducts.length === 0 ? (
          <EmptyState message="Không tìm thấy sản phẩm nào phù hợp." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th width="25%">Tên sản phẩm</th>
                  <th width="15%">Danh mục</th>
                  <th width="15%" className="text-right">Giá bán</th>
                  <th width="10%" className="text-center">Tồn kho</th>
                  <th width="15%" className="text-center">Trạng thái</th>
                  <th width="20%" className="text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(prod => (
                  <tr key={prod.id}>
                    <td>
                      <div className="product-name">{prod.name}</div>
                      <div className="product-unit text-muted">ĐVT: {prod.unit}</div>
                    </td>
                    <td>{getCategoryName(prod.categoryId)}</td>
                    <td className="text-right font-medium">{formatCurrency(prod.sellPrice)}</td>
                    <td className="text-center">{prod.stockQuantity}</td>
                    <td className="text-center">{renderStockBadge(prod)}</td>
                    <td className="text-center actions-cell">
                      <button className="btn-icon btn-edit" onClick={() => handleOpenForm(prod)}>Sửa</button>
                      <button className="btn-icon btn-delete" onClick={() => handleDeleteRequest(prod)}>Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductFormModal 
        isOpen={isFormOpen} 
        onClose={handleCloseForm} 
        onSubmit={handleSubmitForm}
        initialData={editingProduct}
        products={products}
        categories={categories}
      />

      <ConfirmDialog 
        isOpen={isConfirmOpen}
        title="Xác nhận xóa"
        message={`Bạn có chắc chắn muốn xóa sản phẩm "${deletingProduct?.name}" không?`}
        onConfirm={confirmDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};

export default ProductPage;
