import { useState, useEffect, useMemo } from 'react';
import { useProducts } from '../hooks/useProducts';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ProductFormModal from '../components/product/ProductFormModal';
import Pagination from '../components/common/Pagination';
import { formatCurrency } from '../utils/formatCurrency';
import { exportToCSV } from '../utils/exportCSV';
import './ProductPage.css';

const PAGE_SIZE = 20;

// Component hien anh san pham, dung React state de xu ly loi anh
const ProductThumb = ({ product }) => {
  const [imgError, setImgError] = useState(false);
  const src = product.imageUrl || product.image;

  if (!src || imgError) {
    return <div className="product-thumb">{product.name.charAt(0).toUpperCase()}</div>;
  }

  return (
    <div className="product-thumb">
      <img src={src} alt={product.name} loading="lazy" onError={() => setImgError(true)} />
    </div>
  );
};
const ProductPage = () => {
  const { products, categories, loading, error, refetch, createProduct, updateProduct, deleteProduct } = useProducts();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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
      let matchStatus = true;
      if (filterStatus === 'inStock') matchStatus = p.stockQuantity > p.minStockAlert;
      else if (filterStatus === 'lowStock') matchStatus = p.stockQuantity <= p.minStockAlert && p.stockQuantity > 0;
      else if (filterStatus === 'outOfStock') matchStatus = p.stockQuantity === 0;

      return matchName && matchCat && matchStatus;
    });
  }, [products, debouncedSearch, filterCategory, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredProducts, safePage]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterCategory('');
    setFilterStatus('');
    setCurrentPage(1);
  };
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
    let success;
    if (editingProduct) {
      success = await updateProduct(editingProduct.id, data);
    } else {
      success = await createProduct(data);
      if (success) {
        const nextTotal = filteredProducts.length + 1;
        const lastPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
        setCurrentPage(lastPage);
      }
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
      return <span className="badge-status badge-out">Hết hàng</span>;
    }
    if (product.stockQuantity <= product.minStockAlert) {
      return <span className="badge-status badge-low">Sắp hết</span>;
    }
    return <span className="badge-status badge-in">Còn hàng</span>;
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
        <div>
          <h2>Quản lý sản phẩm</h2>
          <p className="page-subtitle">Quản lý danh sách sản phẩm và tồn kho cửa hàng</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportCSV}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Xuất CSV</span>
          </button>
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span> Thêm sản phẩm</span>
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm theo tên..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="inStock">Còn hàng</option>
          <option value="lowStock">Sắp hết</option>
          <option value="outOfStock">Hết hàng</option>
        </select>

        <button className="btn-reset" onClick={handleResetFilters}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Làm mới</span>
        </button>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        {filteredProducts.length === 0 ? (
          <EmptyState message="Không tìm thấy sản phẩm phù hợp. Thử đổi từ khóa hoặc bộ lọc." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th width="40px" className="text-center">#</th>
                  <th>Sản phẩm</th>
                  <th>Danh mục</th>
                  <th className="text-right">Giá nhập (đ)</th>
                  <th className="text-right">Giá bán (đ)</th>
                  <th className="text-center">Tồn kho</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((prod, idx) => (
                  <tr key={prod.id}>
                    <td className="text-center text-muted font-mono">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>
                      <div className="product-cell-group">
                        <ProductThumb product={prod} />
                        <div>
                          <div className="product-name">{prod.name}</div>
                          <div className="product-unit text-muted">ĐVT: {prod.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="category-tag">{getCategoryName(prod.categoryId)}</span></td>
                    <td className="text-right font-mono text-muted">{formatCurrency(prod.costPrice)}</td>
                    <td className="text-right font-mono font-medium">{formatCurrency(prod.sellPrice)}</td>
                    <td className="text-center font-mono font-bold">{prod.stockQuantity}</td>
                    <td className="text-center">{renderStockBadge(prod)}</td>
                    <td className="text-center actions-cell">
                      <button className="btn-action-icon btn-action-edit" onClick={() => handleOpenForm(prod)} title="Chỉnh sửa">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button className="btn-action-icon btn-action-delete" onClick={() => handleDeleteRequest(prod)} title="Xóa">
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

            <Pagination
              currentPage={safePage}
              totalItems={filteredProducts.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
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
