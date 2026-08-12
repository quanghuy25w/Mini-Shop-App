import React, { useState, useEffect } from 'react';
import { generateId } from '../../utils/generateId';
import './ProductFormModal.css';

const ProductFormModal = ({ isOpen, onClose, onSubmit, initialData, products, categories }) => {
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    unit: '',
    costPrice: 0,
    sellPrice: 0,
    stockQuantity: 0,
    minStockAlert: 0
  });
  
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          categoryId: initialData.categoryId,
          unit: initialData.unit || '',
          costPrice: initialData.costPrice,
          sellPrice: initialData.sellPrice,
          stockQuantity: initialData.stockQuantity,
          minStockAlert: initialData.minStockAlert
        });
      } else {
        setFormData({
          name: '',
          categoryId: '',
          unit: 'Cái',
          costPrice: 0,
          sellPrice: 0,
          stockQuantity: 0,
          minStockAlert: 10
        });
      }
      setError('');
      setWarning('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue = value;
    if (type === 'number') {
      finalValue = value === '' ? '' : Number(value);
    }
    
    const newFormData = { ...formData, [name]: finalValue };
    setFormData(newFormData);
    
    // Warning logic
    if (name === 'costPrice' || name === 'sellPrice') {
      const cost = name === 'costPrice' ? finalValue : newFormData.costPrice;
      const sell = name === 'sellPrice' ? finalValue : newFormData.sellPrice;
      if (Number(sell) <= Number(cost) && sell !== '' && cost !== '') {
        setWarning('Cảnh báo: Giá bán đang nhỏ hơn hoặc bằng giá vốn!');
      } else {
        setWarning('');
      }
    }
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const { name, categoryId, costPrice, sellPrice, stockQuantity, minStockAlert, unit } = formData;
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tên sản phẩm không được để trống');
      return;
    }
    
    if (!categoryId) {
      setError('Vui lòng chọn danh mục');
      return;
    }
    
    if (costPrice < 0 || sellPrice < 0 || stockQuantity < 0 || minStockAlert < 0) {
      setError('Các trường số lượng và giá tiền không được âm');
      return;
    }

    // Check unique active product name
    const isDuplicate = products.some(p => 
      p.name.toLowerCase() === trimmedName.toLowerCase() && 
      p.id !== initialData?.id && 
      p.isActive === true
    );

    if (isDuplicate) {
      setError('Tên sản phẩm đã tồn tại');
      return;
    }

    const now = new Date().toISOString();
    
    const data = {
      id: initialData ? initialData.id : generateId(),
      name: trimmedName,
      categoryId,
      unit: unit.trim(),
      costPrice: Number(costPrice),
      sellPrice: Number(sellPrice),
      stockQuantity: Number(stockQuantity),
      minStockAlert: Number(minStockAlert),
      isActive: true,
      createdAt: initialData ? initialData.createdAt : now,
      updatedAt: now
    };

    onSubmit(data);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content product-modal">
        <h3>{initialData ? 'Sửa Sản phẩm' : 'Thêm Sản phẩm mới'}</h3>
        
        <form onSubmit={handleSubmit}>
          {error && <div className="error-alert">{error}</div>}
          {warning && <div className="warning-alert">{warning}</div>}
          
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Tên sản phẩm (*)</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} autoFocus />
            </div>
            <div className="form-group flex-1">
              <label>Danh mục (*)</label>
              <select name="categoryId" value={formData.categoryId} onChange={handleChange}>
                <option value="">-- Chọn danh mục --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Đơn vị tính</label>
              <input type="text" name="unit" value={formData.unit} onChange={handleChange} />
            </div>
            <div className="form-group flex-1">
              <label>Tồn kho</label>
              <input type="number" name="stockQuantity" value={formData.stockQuantity} onChange={handleChange} min="0" />
            </div>
            <div className="form-group flex-1">
              <label>Cảnh báo mức tối thiểu</label>
              <input type="number" name="minStockAlert" value={formData.minStockAlert} onChange={handleChange} min="0" />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Giá vốn (₫)</label>
              <input type="number" name="costPrice" value={formData.costPrice} onChange={handleChange} min="0" />
            </div>
            <div className="form-group flex-1">
              <label>Giá bán (₫)</label>
              <input type="number" name="sellPrice" value={formData.sellPrice} onChange={handleChange} min="0" />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-submit">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormModal;
