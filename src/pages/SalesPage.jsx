import React, { useState, useMemo } from 'react';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';
import { formatCurrency } from '../utils/formatCurrency';
import InvoiceModal from '../components/sales/InvoiceModal';
import EmptyState from '../components/common/EmptyState';
import { toast } from 'react-toastify';
import './SalesPage.css';

const SalesPage = () => {
  const { products } = useProducts();
  const { cartItems, addToCart, updateQuantity, removeFromCart, totalAmount, checkout } = useCart();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Lọc sản phẩm đang active và theo từ khóa
  const displayProducts = useMemo(() => {
    return products.filter(p => {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchName;
    });
  }, [products, searchTerm]);

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const order = await checkout();
      setCompletedOrder(order);
      toast.success('Thanh toán thành công!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-container sales-page-container">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2>Bán Hàng (POS)</h2>
          <p className="page-subtitle">Tạo đơn bán hàng và thanh toán nhanh tại quầy Cửa hàng</p>
        </div>
      </div>

      <div className="sales-layout">
        {/* CỘT TRÁI: DANH SÁCH SẢN PHẨM */}
        <div className="sales-products-col">
          <div className="sales-search">
            <div className="search-wrapper">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                placeholder="Tìm kiếm sản phẩm để bán..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
          
          <div className="products-grid">
            {displayProducts.map(prod => {
              const isOutOfStock = prod.stockQuantity <= 0;
              return (
                <div 
                  key={prod.id} 
                  className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                  onClick={() => !isOutOfStock && addToCart(prod, 1)}
                >
                  <div className="card-top-row">
                    <div className="card-thumb">{prod.name.charAt(0).toUpperCase()}</div>
                    <span className="card-unit-badge">{prod.unit}</span>
                  </div>
                  <div className="card-name">{prod.name}</div>
                  <div className="card-price font-mono text-ledger">{formatCurrency(prod.sellPrice)}</div>
                  <div className="card-stock font-mono">
                    Tồn: {prod.stockQuantity}
                  </div>
                  {isOutOfStock && <div className="overlay-soldout">Hết hàng</div>}
                </div>
              );
            })}
            {displayProducts.length === 0 && (
               <div style={{ gridColumn: '1 / -1' }}>
                 <EmptyState message="Không tìm thấy sản phẩm." />
               </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: GIỎ HÀNG */}
        <div className="sales-cart-col">
          <div className="cart-header">
            <h3>Giỏ Hàng</h3>
            {cartItems.length > 0 && <span className="cart-badge-count">{cartItems.length} món</span>}
          </div>

          <div className="cart-items-container">
            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: '8px' }}>
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <div>Giỏ hàng đang trống. Chọn sản phẩm bên trái để thêm vào đơn.</div>
              </div>
            ) : (
              <div className="cart-items-list">
                {cartItems.map(item => (
                  <div key={item.productId} className="cart-item">
                    <div className="item-info">
                      <div className="item-name">{item.productName}</div>
                      <div className="item-price">{formatCurrency(item.price)}</div>
                    </div>
                    <div className="item-controls">
                      <div className="qty-control-group">
                        <button 
                          className="btn-qty" 
                          onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                        >-</button>
                        <input 
                          type="number" 
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                        />
                        <button 
                          className="btn-qty" 
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        >+</button>
                      </div>
                      <div className="item-subtotal text-ledger">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                      <button className="btn-remove" onClick={() => removeFromCart(item.productId)} title="Xóa món">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cart-summary">
            <div className="summary-row total">
              <span>Tổng thanh toán:</span>
              <span className="total-amount-highlight">{formatCurrency(totalAmount)}</span>
            </div>
            <button 
              className="btn-checkout" 
              onClick={handleCheckout}
              disabled={cartItems.length === 0 || isProcessing}
            >
              {isProcessing ? 'ĐANG XỬ LÝ...' : 'THANH TOÁN ĐƠN HÀNG'}
            </button>
          </div>
        </div>

        <InvoiceModal 
          isOpen={!!completedOrder} 
          order={completedOrder} 
          onClose={() => setCompletedOrder(null)} 
        />
      </div>
    </div>
  );
};

export default SalesPage;
