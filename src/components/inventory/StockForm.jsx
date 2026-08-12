import React, { useState, useContext, useMemo } from 'react';
import { AppDataContext } from '../../context/AppDataContext';
import { formatCurrency } from '../../utils/formatCurrency';
import './StockForm.css';

const StockForm = ({ type, onSubmit, isLoading }) => {
  const { products } = useContext(AppDataContext);
  
  // Chỉ chọn các sản phẩm đang active
  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
  
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [note, setNote] = useState('');

  const selectedProduct = useMemo(() => activeProducts.find(p => p.id === productId), [activeProducts, productId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!productId) return;
    onSubmit({ 
      productId, 
      quantity: Number(quantity), 
      unitPrice: type === 'IN' ? Number(unitPrice) : 0, // Xuất kho tự động lấy giá vốn trong hook
      note 
    });
  };

  const handleProductChange = (e) => {
    const id = e.target.value;
    setProductId(id);
    const product = activeProducts.find(p => p.id === id);
    if (product) {
      setUnitPrice(product.costPrice || 0); // Suggest cost price for import
    }
  };

  const resetForm = () => {
    setProductId('');
    setQuantity('');
    setUnitPrice('');
    setNote('');
  };

  // Expose resetForm via standard ways isn't easy here unless we use ref, so we'll just rely on the parent not needing it or doing it automatically, but wait: we want to clear form on success.
  // Actually we can pass a resetTrigger or handle it via a callback.
  // We'll modify onSubmit to return a promise. If resolved, we reset.
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
      // Error is handled in the parent, form stays filled so user can fix it
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
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Ghi chú</label>
          <textarea 
            value={note} 
            onChange={e => setNote(e.target.value)} 
            rows={3} 
            placeholder={type === 'IN' ? 'Ghi chú nhập hàng...' : 'Lý do xuất kho...'}
          />
        </div>

        <button type="submit" className="btn-primary btn-block" disabled={isLoading || !productId}>
          {isLoading ? 'Đang xử lý...' : (type === 'IN' ? 'Xác nhận Nhập Kho' : 'Xác nhận Xuất Kho')}
        </button>
      </form>

      <div className="stock-preview">
        <h4>Chi tiết Sản phẩm đang chọn</h4>
        {selectedProduct ? (
          <div className="preview-details">
            <p><strong>Sản phẩm:</strong> {selectedProduct.name}</p>
            <p><strong>ĐVT:</strong> {selectedProduct.unit}</p>
            <p><strong>Giá vốn hiện tại:</strong> {formatCurrency(selectedProduct.costPrice)}</p>
            <div className="highlight-stock">
              Tồn kho hiện tại: <span className="stock-number">{selectedProduct.stockQuantity}</span>
            </div>
            {type === 'OUT' && Number(quantity) > selectedProduct.stockQuantity && (
              <div className="stock-warning-text">
                Cảnh báo: Số lượng xuất vượt quá tồn kho!
              </div>
            )}
          </div>
        ) : (
          <div className="preview-empty">Vui lòng chọn 1 sản phẩm để xem thông tin tồn kho.</div>
        )}
      </div>
    </div>
  );
};
export default StockForm;
