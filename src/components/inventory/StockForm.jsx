import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppDataContext } from '../../context/AppDataContext';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateTotalAmount } from '../../utils/calculateTotal';
import './StockForm.css';

const StockForm = ({ type, onSubmit, isLoading, initialProductId = '' }) => {
  const { products } = useContext(AppDataContext);
  
  // Chỉ chọn các sản phẩm đang active
  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
  
  const [productId, setProductId] = useState(initialProductId);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (initialProductId) {
      setProductId(initialProductId);
      const product = activeProducts.find(p => p.id === initialProductId);
      if (product && type === 'IN') {
        setUnitPrice(product.costPrice || 0);
      }
    }
  }, [initialProductId, activeProducts, type]);

  const selectedProduct = useMemo(() => activeProducts.find(p => p.id === productId), [activeProducts, productId]);

  const totalImportAmount = useMemo(() => {
    if (type !== 'IN') return 0;
    return calculateTotalAmount(quantity, unitPrice);
  }, [type, quantity, unitPrice]);

  const handleProductChange = (e) => {
    const id = e.target.value;
    setProductId(id);
    const product = activeProducts.find(p => p.id === id);
    if (product) {
      setUnitPrice(product.costPrice || 0);
    }
  };

  const resetForm = () => {
    setProductId('');
    setQuantity('');
    setUnitPrice('');
    setNote('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit({ 
        productId, 
        quantity: Number(quantity), 
        unitPrice: type === 'IN' ? Number(unitPrice) : 0,
        note 
      });
      resetForm();
    } catch (err) {
      // Error is handled in parent
    }
  };

  return (
    <div className="stock-form-container">
      <form className="stock-form" onSubmit={handleFormSubmit}>
        <div className="form-group">
          <label>Chọn Sản Phẩm (*)</label>
          <select value={productId} onChange={handleProductChange} required>
            <option value="">-- Tìm và chọn sản phẩm --</option>
            {activeProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label>Số lượng (*)</label>
            <input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={e => setQuantity(e.target.value)} 
              required 
              placeholder="VD: 10"
            />
          </div>
          {type === 'IN' && (
            <div className="form-group flex-1">
              <label>Giá nhập (₫) (*)</label>
              <input 
                type="number" 
                min="0" 
                value={unitPrice} 
                onChange={e => setUnitPrice(e.target.value)} 
                required 
                placeholder="VD: 15000"
              />
            </div>
          )}
        </div>

        {/* Formula breakdown indicator */}
        {type === 'IN' && quantity && Number(quantity) > 0 && unitPrice !== '' && Number(unitPrice) >= 0 && (
          <div className="formula-badge">
            <span className="formula-label">Công thức tính:</span>
            <span className="formula-calc">
              {quantity} × {formatCurrency(unitPrice)} = <strong className="text-ledger">{formatCurrency(totalImportAmount)}</strong>
            </span>
          </div>
        )}

        <div className="form-group">
          <label>Ghi chú</label>
          <textarea 
            value={note} 
            onChange={e => setNote(e.target.value)} 
            rows={3} 
            placeholder={type === 'IN' ? 'Ghi chú nhập hàng (số hóa đơn, nhà cung cấp...)' : 'Lý do xuất kho...'}
          />
        </div>

        {/* Callout box listing actual validation constraints */}
        <div className="stock-callout-box">
          <div className="callout-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>{type === 'IN' ? 'Lưu ý khi Nhập kho' : 'Lưu ý khi Xuất kho'}</span>
          </div>
          <ul className="callout-list">
            <li>Số lượng {type === 'IN' ? 'nhập' : 'xuất'} phải là số lớn hơn 0 (`quantity &gt; 0`).</li>
            {type === 'IN' ? (
              <li>Giá nhập phải lớn hơn hoặc bằng 0 ₫ (`unitPrice &gt;= 0`).</li>
            ) : (
              <li>Số lượng xuất không được vượt quá tồn kho hiện tại.</li>
            )}
            <li>Tồn kho sau giao dịch sẽ tự động cập nhật ngay khi xác nhận.</li>
          </ul>
        </div>

        <button type="submit" className="btn-primary btn-block" disabled={isLoading || !productId}>
          {isLoading ? 'Đang xử lý...' : (type === 'IN' ? 'Xác nhận Nhập Kho' : 'Xác nhận Xuất Kho')}
        </button>
      </form>

      <div className="stock-preview">
        <div className="preview-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <h4>Chi tiết Sản phẩm đang chọn</h4>
        </div>
        
        {selectedProduct ? (
          <div className="preview-details">
            <div className="product-summary-card">
              <div className="product-avatar-placeholder">
                {selectedProduct.name.charAt(0).toUpperCase()}
              </div>
              <div className="product-meta">
                <div className="product-title-text">{selectedProduct.name}</div>
                <div className="product-badges-row">
                  <span className="product-code-badge">Mã SP: #{selectedProduct.id}</span>
                  <span className="product-unit-badge">ĐVT: {selectedProduct.unit}</span>
                </div>
              </div>
            </div>

            <div className="detail-info-row">
              <span className="info-label">Giá vốn hiện tại:</span>
              <span className="info-value font-mono">{formatCurrency(selectedProduct.costPrice)}</span>
            </div>
            
            <div className="stock-calculation">
              <div className="stock-row">
                <span>Tồn kho hiện tại:</span>
                <span className="font-mono font-medium">{selectedProduct.stockQuantity}</span>
              </div>
              
              {quantity && Number(quantity) > 0 && (
                <>
                  <div className="stock-row">
                    <span>{type === 'IN' ? 'Dự kiến nhập:' : 'Dự kiến xuất:'}</span>
                    <span className={`font-mono font-medium ${type === 'IN' ? 'text-ledger' : 'text-brick'}`}>
                      {type === 'IN' ? '+' : '-'}{quantity}
                    </span>
                  </div>
                  {type === 'IN' && Number(unitPrice) >= 0 && (
                    <div className="stock-row">
                      <span>Tổng tiền nhập:</span>
                      <span className="font-mono font-bold text-ledger">
                        {formatCurrency(totalImportAmount)}
                      </span>
                    </div>
                  )}
                  <div className="stock-row stock-total">
                    <span>Tồn kho sau giao dịch:</span>
                    <span className={`font-mono font-medium ${(type === 'OUT' && Number(quantity) > selectedProduct.stockQuantity) ? 'text-brick' : 'text-ledger'}`}>
                      {type === 'IN' ? selectedProduct.stockQuantity + Number(quantity) : selectedProduct.stockQuantity - Number(quantity)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {type === 'OUT' && Number(quantity) > selectedProduct.stockQuantity && (
              <div className="stock-warning-text">
                Cảnh báo: Số lượng xuất vượt quá tồn kho hiện tại!
              </div>
            )}
          </div>
        ) : (
          <div className="preview-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: '8px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div>Vui lòng chọn 1 sản phẩm để xem thông tin tồn kho.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockForm;
