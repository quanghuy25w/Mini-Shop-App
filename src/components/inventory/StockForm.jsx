import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppDataContext } from '../../context/AppDataContext';
import { formatCurrency } from '../../utils/formatCurrency';
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
    const q = Number(quantity);
    const p = Number(unitPrice);
    if (isNaN(q) || q <= 0 || isNaN(p) || p < 0) return 0;
    return q * p;
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
          <div className="preview-empty">Vui lòng chọn 1 sản phẩm để xem thông tin tồn kho.</div>
        )}
      </div>
    </div>
  );
};

export default StockForm;
