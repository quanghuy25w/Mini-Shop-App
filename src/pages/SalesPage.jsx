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
    <div className="sales-layout">
      {/* CỘT TRÁI: DANH SÁCH SẢN PHẨM */}
      <div className="sales-products-col">
        <div className="sales-search">
          <input 
            type="text" 
            placeholder="Tìm kiếm sản phẩm để bán..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
                <div className="card-name">{prod.name}</div>
                <div className="card-price font-mono text-ledger">{formatCurrency(prod.sellPrice)}</div>
                <div className="card-stock font-mono">
                  Tồn: {prod.stockQuantity} {prod.unit}
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
        <h3>Giỏ Hàng</h3>
        <div className="cart-items-container">
          {cartItems.length === 0 ? (
            <div className="empty-cart">Giỏ hàng đang trống.</div>
          ) : (
            <div className="cart-items-list">
              {cartItems.map(item => (
                <div key={item.productId} className="cart-item">
                  <div className="item-info">
                    <div className="item-name">{item.productName}</div>
                    <div className="item-price">{formatCurrency(item.price)}</div>
                  </div>
                  <div className="item-controls">
                    <input 
                      type="number" 
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                    />
                    <div className="item-subtotal">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                    <button className="btn-remove" onClick={() => removeFromCart(item.productId)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cart-summary">
          <div className="summary-row total">
            <span>Tổng thanh toán:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
          <button 
            className="btn-checkout" 
            onClick={handleCheckout}
            disabled={cartItems.length === 0 || isProcessing}
          >
            {isProcessing ? 'Đang xử lý...' : 'THANH TOÁN'}
          </button>
        </div>
      </div>

      <InvoiceModal 
        isOpen={!!completedOrder} 
        order={completedOrder} 
        onClose={() => setCompletedOrder(null)} 
      />
    </div>
  );
};

export default SalesPage;
