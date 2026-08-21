import React, { useState, useMemo, useEffect, useRef, useContext } from 'react';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';
import { AppDataContext } from '../context/AppDataContext';
import { formatCurrency } from '../utils/formatCurrency';
import InvoiceModal from '../components/sales/InvoiceModal';
import CheckoutConfirmModal from '../components/sales/CheckoutConfirmModal';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Pagination from '../components/common/Pagination';
import { printInvoice } from '../utils/printInvoice';
import { toast } from 'react-toastify';
import './SalesPage.css';

const PAGE_SIZE = 20;

// Component render Product Thumbnail (Visual SVG/Image)
const ProductThumbnail = ({ product, size = 44 }) => {
  if (!product) return null;
  if (product.imageUrl || product.image) {
    return (
      <div className="pos-card-thumb-container" style={{ width: size, height: size }}>
        <img src={product.imageUrl || product.image} alt={product.name} loading="lazy" />
      </div>
    );
  }

  let thumbClass = 'thumb-default';
  let iconSvg = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    </svg>
  );

  if (product.categoryId === 'c1111111-1111-1111-1111-111111111111') {
    thumbClass = 'thumb-drink';
    iconSvg = (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
      </svg>
    );
  } else if (product.categoryId === 'c2222222-2222-2222-2222-222222222222') {
    thumbClass = 'thumb-drink';
    iconSvg = (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="3"></rect>
        <line x1="5" y1="6" x2="19" y2="6"></line>
      </svg>
    );
  } else if (product.categoryId === 'c3333333-3333-3333-3333-333333333333') {
    thumbClass = 'thumb-drink';
    iconSvg = (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
      </svg>
    );
  } else if (product.categoryId === 'c4444444-4444-4444-4444-444444444444') {
    thumbClass = 'thumb-snack';
    iconSvg = (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
        <line x1="3" y1="6" x2="21" y2="6"></line>
      </svg>
    );
  }

  return (
    <div className={`product-thumb-box ${thumbClass}`} style={{ width: size, height: size }}>
      {iconSvg}
    </div>
  );
};

// Helper lay ma hien thi san pham (VD: SP001)
const getProductCode = (product, idx = 0) => {
  if (product?.code) return product.code;
  if (product?.id && product.id.startsWith('p0000000-0000-0000-0000-00000000000')) {
    const num = parseInt(product.id.slice(-2), 10);
    return `SP${String(num).padStart(3, '0')}`;
  }
  return `SP${String(idx + 1).padStart(3, '0')}`;
};

const SalesPage = () => {
  const { products } = useProducts();
  const { categories } = useContext(AppDataContext);
  const { cartItems, addToCart, updateQuantity, removeFromCart, clearCart, checkout } = useCart();
  
  // UI filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [currentPage, setCurrentPage] = useState(1);

  // Cart additional states
  const [discount, setDiscount] = useState('0');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  // Processing & Modal states
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);

  // Confirm dialog state for Clear All / Remove item
  const [confirmState, setConfirmState] = useState(null);

  const searchInputRef = useRef(null);
  const isSubmittingRef = useRef(false); // khóa đồng bộ chống double-submit tức thời

  // Filter san pham hien thi
  const displayProducts = useMemo(() => {
    return products.filter(p => {
      if (!p.isActive) return false;
      const q = searchTerm.trim().toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || getProductCode(p).toLowerCase().includes(q);
      const matchCat = selectedCategory ? p.categoryId === selectedCategory : true;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(displayProducts.length / PAGE_SIZE));

  // Reset ve trang 1 khi tim kiem hoac danh muc thay doi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  // Tu dong lui ve trang cuoi neu currentPage vuot qua tong so trang
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return displayProducts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [displayProducts, currentPage]);

  // Tạm tính tong giỏ hang
  const subtotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + (item.quantity * item.price), 0);
  }, [cartItems]);

  // Tong so luong san pham trong gio
  const totalQuantity = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  // So tien giam gia
  const discountAmount = useMemo(() => {
    const val = Number(discount);
    if (isNaN(val) || val < 0) return 0;
    return Math.min(subtotal, val);
  }, [discount, subtotal]);

  // Tong thanh toan sau giam gia
  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Bind keyboard hotkeys (F1, F2, F5, F9, F11)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        toast.info('Chức năng quét mã vạch (F2) sẵn sàng!');
        searchInputRef.current?.focus();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleSaveDraft();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cartItems.length > 0 && !isProcessing && !isSubmittingRef.current) {
          handleOpenCheckoutConfirm();
        } else if (cartItems.length === 0) {
          toast.error('Giỏ hàng đang trống! Vui lòng chọn sản phẩm.');
        }
      } else if (e.key === 'F11') {
        e.preventDefault();
        handlePrintInvoiceAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, isProcessing, subtotal, discountAmount, finalTotal]);

  // Them san pham vao gio
  const handleProductClick = (prod) => {
    if (prod.stockQuantity <= 0) {
      toast.error(`Sản phẩm "${prod.name}" đã hết hàng trong kho!`);
      return;
    }
    addToCart(prod, 1);
  };

  // Mở Popup xác nhận thanh toán (F9)
  const handleOpenCheckoutConfirm = () => {
    if (cartItems.length === 0) {
      toast.error('Giỏ hàng đang trống! Vui lòng chọn sản phẩm.');
      return;
    }
    setIsCheckoutConfirmOpen(true);
  };

  // Thanh toán & In hóa đơn
  const handlePayAndPrint = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);
    try {
      const order = await checkout(finalTotal);
      setIsCheckoutConfirmOpen(false);
      setCompletedOrder(order);
      setDiscount('0');
      setOrderNote('');
      setShowNoteInput(false);
      toast.success('Thanh toán đơn hàng thành công!');
      
      // In hóa đơn độc lập qua printInvoice (100% không bị trắng trang trên mọi trình duyệt)
      printInvoice(order);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thanh toán');
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  // Chỉ thanh toán (không in)
  const handlePayOnly = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);
    try {
      const order = await checkout(finalTotal);
      setIsCheckoutConfirmOpen(false);
      setDiscount('0');
      setOrderNote('');
      setShowNoteInput(false);
      toast.success(`Thanh toán đơn ${order.code} thành công!`);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thanh toán');
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  // Luu đơn hang (F5)
  const handleSaveDraft = () => {
    if (cartItems.length === 0) {
      toast.error('Giỏ hàng trống, không thể lưu đơn!');
      return;
    }
    toast.success('Đã lưu tạm thông tin đơn hàng!');
  };

  // In hóa đơn (F11)
  const handlePrintInvoiceAction = () => {
    if (completedOrder) {
      printInvoice(completedOrder);
    } else if (cartItems.length > 0) {
      toast.info('Vui lòng hoàn tất thanh toán trước khi in hóa đơn.');
    } else {
      toast.error('Chưa có hóa đơn để in!');
    }
  };

  // Xac nhan Xoá tat ca gio hang
  const handleRequestClearCart = () => {
    if (cartItems.length === 0) return;
    setConfirmState({
      type: 'CLEAR_ALL',
      title: 'Xác nhận xóa giỏ hàng',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng hiện tại?'
    });
  };

  // Xac nhan Xoa 1 dong khoi gio
  const handleRequestRemoveItem = (item) => {
    setConfirmState({
      type: 'REMOVE_ITEM',
      productId: item.productId,
      title: 'Xóa sản phẩm khỏi giỏ',
      message: `Bạn có chắc chắn muốn xóa sản phẩm "${item.productName}" khỏi giỏ hàng?`
    });
  };

  const handleConfirmAction = () => {
    if (!confirmState) return;
    if (confirmState.type === 'CLEAR_ALL') {
      clearCart();
      setDiscount('0');
      setOrderNote('');
      toast.info('Đã xóa toàn bộ giỏ hàng.');
    } else if (confirmState.type === 'REMOVE_ITEM') {
      removeFromCart(confirmState.productId);
      toast.info('Đã xóa sản phẩm khỏi giỏ.');
    }
    setConfirmState(null);
  };

  return (
    <div className="page-container" style={{ maxWidth: '1360px' }}>
      {/* HEADER TRANG BÁN HÀNG */}
      <div className="sales-page-header">
        <h2>Bán hàng</h2>
        <p className="page-subtitle">Tạo đơn hàng và thanh toán cho khách</p>
      </div>

      <div className="sales-pos-layout">
        {/* CỘT TRÁI - KHU VỰC SẢN PHẨM */}
        <div className="sales-products-area">
          {/* THANH CÔNG CỤ: SEARCH + SELECT CATEGORY + TOGGLE VIEW */}
          <div className="sales-toolbar">
            <div className="sales-search-box">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Tìm kiếm sản phẩm (mã, tên...)" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              className="sales-category-select"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button 
              type="button"
              className={`btn-view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              title={viewMode === 'grid' ? 'Chuyển sang dạng Danh sách' : 'Chuyển sang dạng Lưới'}
            >
              {viewMode === 'grid' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                  <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              )}
            </button>
          </div>

          {/* DANH SÁCH SẢN PHẨM (GRID 4 CỘT HOẶC LIST) */}
          {displayProducts.length === 0 ? (
            <EmptyState message="Không tìm thấy sản phẩm phù hợp. Vui lòng kiểm tra lại từ khóa hoặc bộ lọc." />
          ) : viewMode === 'grid' ? (
            <div className="pos-products-grid">
              {paginatedProducts.map((prod, idx) => {
                const isOut = prod.stockQuantity <= 0;
                const isLow = prod.stockQuantity > 0 && prod.stockQuantity <= Math.max(5, prod.minStockAlert || 5);

                return (
                  <div 
                    key={prod.id}
                    className={`pos-product-card ${isOut ? 'out-of-stock' : ''}`}
                    onClick={() => handleProductClick(prod)}
                  >
                    <ProductThumbnail product={prod} size={60} />
                    <div className="pos-card-title">{prod.name}</div>
                    <div className="pos-card-price">{formatCurrency(prod.sellPrice)}</div>
                    <div className={`pos-card-stock ${isLow || isOut ? 'low-stock' : ''}`}>
                      {isOut ? 'Tồn: 0 (Hết hàng)' : `Tồn: ${prod.stockQuantity}`}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pos-products-list">
              {paginatedProducts.map((prod, idx) => {
                const isOut = prod.stockQuantity <= 0;
                const isLow = prod.stockQuantity > 0 && prod.stockQuantity <= Math.max(5, prod.minStockAlert || 5);

                return (
                  <div 
                    key={prod.id}
                    className={`pos-list-item ${isOut ? 'out-of-stock' : ''}`}
                    onClick={() => handleProductClick(prod)}
                  >
                    <div className="pos-list-left">
                      <ProductThumbnail product={prod} size={36} />
                      <div className="pos-list-title">{prod.name}</div>
                    </div>
                    <div className="pos-list-right">
                      <span className={`pos-card-stock ${isLow || isOut ? 'low-stock' : ''}`}>
                        {isOut ? 'Hết hàng' : `Tồn: ${prod.stockQuantity}`}
                      </span>
                      <span className="pos-card-price">{formatCurrency(prod.sellPrice)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalItems={displayProducts.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />

          {/* PANEL PHÍM TẮT Ở CUỐI TRANG */}
          <div className="pos-hotkeys-panel">
            <div className="hotkeys-header">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8"></path>
              </svg>
              <span>Phím tắt</span>
            </div>
            <div className="hotkeys-grid">
              <div className="hotkey-badge-card">
                <span className="hotkey-key">F1</span>
                <span className="hotkey-label">Tìm kiếm</span>
              </div>
              <div className="hotkey-badge-card">
                <span className="hotkey-key">F2</span>
                <span className="hotkey-label">Quét mã vạch</span>
              </div>
              <div className="hotkey-badge-card">
                <span className="hotkey-key">F5</span>
                <span className="hotkey-label">Lưu đơn hàng</span>
              </div>
              <div className="hotkey-badge-card">
                <span className="hotkey-key">F9</span>
                <span className="hotkey-label">Thanh toán</span>
              </div>
              <div className="hotkey-badge-card">
                <span className="hotkey-key">F11</span>
                <span className="hotkey-label">In hóa đơn</span>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI - CARD GIỎ HÀNG */}
        <div className="pos-cart-card">
          <div className="pos-cart-header">
            <div className="pos-cart-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span>Giỏ hàng</span>
            </div>

            {cartItems.length > 0 && (
              <button 
                type="button" 
                className="btn-clear-cart" 
                onClick={handleRequestClearCart}
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {/* BẢNG SẢN PHẨM TRONG GIỎ HÀNG */}
          <div className="pos-cart-table-container">
            {cartItems.length === 0 ? (
              <div className="empty-cart-view">
                Chưa có sản phẩm trong giỏ hàng. Chọn sản phẩm bên trái để thêm vào đơn.
              </div>
            ) : (
              <table className="pos-cart-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="text-center" width="85px">SL</th>
                    <th className="text-right">Đơn giá</th>
                    <th className="text-right">Thành tiền</th>
                    <th width="36px"></th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((item) => {
                    const dbProd = products.find(p => p.id === item.productId);
                    return (
                      <tr key={item.productId}>
                        <td>
                          <div className="cart-item-product-cell">
                            <ProductThumbnail product={dbProd || { name: item.productName }} size={28} />
                            <span className="cart-item-name">{item.productName}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cart-qty-spinner">
                            <button 
                              type="button" 
                              className="btn-spinner"
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  handleRequestRemoveItem(item);
                                } else {
                                  updateQuantity(item.productId, item.quantity - 1);
                                }
                              }}
                            >-</button>
                            <input 
                              type="text" 
                              className="spinner-input"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val > 0) {
                                  updateQuantity(item.productId, val);
                                }
                              }}
                            />
                            <button 
                              type="button" 
                              className="btn-spinner"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            >+</button>
                          </div>
                        </td>
                        <td className="text-right font-mono">{formatCurrency(item.price)}</td>
                        <td className="text-right font-mono font-medium">{formatCurrency(item.price * item.quantity)}</td>
                        <td className="text-center">
                          <button 
                            type="button" 
                            className="btn-cart-remove"
                            onClick={() => handleRequestRemoveItem(item)}
                            title="Xóa sản phẩm khỏi giỏ"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* NÚT BẤM THÊM GHI CHÚ ĐƠN HÀNG */}
          {!showNoteInput ? (
            <button 
              type="button" 
              className="btn-toggle-note"
              onClick={() => setShowNoteInput(true)}
            >
              <span>+ Thêm ghi chú đơn hàng</span>
            </button>
          ) : (
            <textarea 
              rows={2}
              className="order-note-textarea"
              placeholder="Nhập ghi chú đơn hàng (khách hẹn, thông tin thêm)..."
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
              autoFocus
            />
          )}

          {/* KHỐI TỔNG HỢP: SL, TẠM TÍNH, GIẢM GIÁ, TỔNG THANH TOÁN */}
          <div className="pos-summary-section">
            <div className="summary-line-item">
              <span>Tổng số lượng</span>
              <span className="font-mono font-medium">{totalQuantity}</span>
            </div>

            <div className="summary-line-item">
              <span>Tạm tính</span>
              <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
            </div>

            <div className="summary-discount-row">
              <span className="summary-label">Giảm giá</span>
              <div className="discount-input-box">
                <input 
                  type="number"
                  min="0"
                  value={discount}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) {
                      setDiscount(val);
                    }
                  }}
                  placeholder="0"
                />
                <span className="discount-currency-label">đ</span>
              </div>
            </div>

            <div className="summary-line-final">
              <span className="summary-final-title">Tổng thanh toán</span>
              <span className="summary-final-amount">{formatCurrency(finalTotal)}</span>
            </div>
          </div>

          {/* NÚT THAO TÁC POS */}
          <div className="pos-checkout-actions">
            <button 
              type="button" 
              className="btn-main-checkout" 
              onClick={handleOpenCheckoutConfirm}
              disabled={cartItems.length === 0 || isProcessing}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M6 12h.01M18 12h.01"></path>
              </svg>
              <span>{isProcessing ? 'ĐANG XỬ LÝ...' : 'Thanh toán (F9)'}</span>
            </button>

            <div className="pos-sub-actions-row">
              <button 
                type="button" 
                className="btn-sub-pos"
                onClick={handleSaveDraft}
                disabled={cartItems.length === 0}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                </svg>
                <span>Lưu đơn hàng (F5)</span>
              </button>

              <button 
                type="button" 
                className="btn-sub-pos"
                onClick={handlePrintInvoiceAction}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                <span>In hóa đơn sau khi thanh toán (F11)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP XÁC NHẬN THANH TOÁN (CHỌN IN HÓA ĐƠN HOẶC CHỈ THANH TOÁN HOẶC HỦY) */}
      <CheckoutConfirmModal
        isOpen={isCheckoutConfirmOpen}
        totalQuantity={totalQuantity}
        subtotal={subtotal}
        discountAmount={discountAmount}
        totalAmount={finalTotal}
        isProcessing={isProcessing}
        onPayAndPrint={handlePayAndPrint}
        onPayOnly={handlePayOnly}
        onCancel={() => setIsCheckoutConfirmOpen(false)}
      />

      {/* CONFIRM DIALOG FOR CLEAR ALL OR REMOVE ITEM */}
      <ConfirmDialog 
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
      />

      {/* INVOICE MODAL UPON CHECKOUT */}
      <InvoiceModal 
        isOpen={!!completedOrder} 
        order={completedOrder} 
        onClose={() => setCompletedOrder(null)} 
      />
    </div>
  );
};

export default SalesPage;
