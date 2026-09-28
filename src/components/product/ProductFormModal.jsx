import { useState } from 'react';
import { generateId } from '../../utils/generateId';
import './ProductFormModal.css';

const ProductFormModal = ({ isOpen, onClose, onSubmit, initialData, products, categories }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: '',
    costPrice: 0,
    sellPrice: 0,
    stockQuantity: 0,
    minStockAlert: 0,
    imageUrl: ''
  });

  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialData, setPrevInitialData] = useState(initialData);

  if (prevIsOpen !== isOpen || prevInitialData !== initialData) {
    setPrevIsOpen(isOpen);
    setPrevInitialData(initialData);
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          sku: initialData.sku || initialData.code || '',
          barcode: initialData.barcode || '',
          categoryId: initialData.categoryId,
          unit: initialData.unit || '',
          costPrice: initialData.costPrice,
          sellPrice: initialData.sellPrice,
          stockQuantity: initialData.stockQuantity,
          minStockAlert: initialData.minStockAlert,
          imageUrl: initialData.imageUrl || ''
        });
      } else {
        // Auto generate suggested SKU
        const count = (products || []).length + 1;
        const suggestedSku = `SP${String(count).padStart(3, '0')}`;
        setFormData({
          name: '',
          sku: suggestedSku,
          barcode: '',
          categoryId: '',
          unit: 'Cái',
          costPrice: 0,
          sellPrice: 0,
          stockQuantity: 0,
          minStockAlert: 10,
          imageUrl: ''
        });
      }
      setError('');
      setWarning('');
    }
  }

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

    const { name, sku, barcode, categoryId, costPrice, sellPrice, stockQuantity, minStockAlert, unit, imageUrl } = formData;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tên sản phẩm không được để trống');
      return;
    }

    const trimmedSku = (sku || '').trim();
    if (!trimmedSku) {
      setError('Mã SKU không được để trống');
      return;
    }

    const trimmedBarcode = (barcode || '').trim();

    if (!categoryId) {
      setError('Vui lòng chọn danh mục');
      return;
    }

    if (costPrice < 0 || sellPrice < 0 || stockQuantity < 0 || minStockAlert < 0) {
      setError('Các trường số lượng và giá tiền không được âm');
      return;
    }

    // Check unique active product name
    const isDuplicateName = products.some(p =>
      p.name.toLowerCase() === trimmedName.toLowerCase() &&
      p.id !== initialData?.id &&
      p.isActive === true
    );

    if (isDuplicateName) {
      setError('Tên sản phẩm đã tồn tại');
      return;
    }

    // Check unique SKU among active products
    const isDuplicateSku = products.some(p =>
      (p.sku && p.sku.toLowerCase() === trimmedSku.toLowerCase() || p.code && p.code.toLowerCase() === trimmedSku.toLowerCase()) &&
      p.id !== initialData?.id &&
      p.isActive === true
    );

    if (isDuplicateSku) {
      setError('Mã SKU đã tồn tại, vui lòng chọn mã khác');
      return;
    }

    // Check unique Barcode among active products if entered
    if (trimmedBarcode) {
      const isDuplicateBarcode = products.some(p =>
        p.barcode && p.barcode.toLowerCase() === trimmedBarcode.toLowerCase() &&
        p.id !== initialData?.id &&
        p.isActive === true
      );

      if (isDuplicateBarcode) {
        setError('Mã vạch (Barcode) đã tồn tại cho sản phẩm khác');
        return;
      }
    }

    const now = new Date().toISOString();

    const data = {
      id: initialData ? initialData.id : generateId(),
      name: trimmedName,
      sku: trimmedSku,
      code: trimmedSku,
      barcode: trimmedBarcode || null,
      categoryId,
      unit: unit.trim(),
      costPrice: Number(costPrice),
      sellPrice: Number(sellPrice),
      stockQuantity: initialData ? initialData.stockQuantity : Number(stockQuantity),
      minStockAlert: Number(minStockAlert),
      imageUrl: imageUrl.trim(),
      isActive: true,
      createdAt: initialData ? initialData.createdAt : now,
      updatedAt: now
    };

    onSubmit(data);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content product-modal">
        <h3>{initialData ? 'Sửa Sản phẩm' : 'Thêm sản phẩm mới'}</h3>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-alert">{error}</div>}
          {warning && <div className="warning-alert">{warning}</div>}

          <div className="form-section-title">Thông tin cơ bản</div>
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
              <label>Mã SKU (*)</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="VD: SP001"
                disabled={Boolean(initialData)}
              />
            </div>
            <div className="form-group flex-1">
              <label>Mã vạch (Barcode)</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="VD: 893500123456"
              />
            </div>
            <div className="form-group flex-1">
              <label>Đơn vị tính</label>
              <input type="text" name="unit" value={formData.unit} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Link ảnh sản phẩm</label>
              <input
                type="text"
                name="imageUrl"
                placeholder="https://example.com/anh-san-pham.jpg"
                value={formData.imageUrl}
                onChange={handleChange}
              />
            </div>
            <div className="form-group flex-1">
              {formData.imageUrl && (
                <div className="image-preview">
                  <img
                    src={formData.imageUrl}
                    alt="Xem trước"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form-section-title">Giá và lợi nhuận</div>
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Giá vốn (₫)</label>
              <input type="number" name="costPrice" value={formData.costPrice} onChange={handleChange} min="0" />
            </div>
            <div className="form-group flex-1">
              <label>Giá bán (₫)</label>
              <input type="number" name="sellPrice" value={formData.sellPrice} onChange={handleChange} min="0" />
              {Number(formData.costPrice) > 0 && Number(formData.sellPrice) > 0 && (
                <span className={`profit-margin ${Number(formData.sellPrice) > Number(formData.costPrice) ? 'text-ledger' : 'text-brick'}`}>
                  Biên lợi nhuận: {(((Number(formData.sellPrice) - Number(formData.costPrice)) / Number(formData.sellPrice)) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="form-section-title">Tồn kho</div>
          <div className="form-row">
            <div className="form-group flex-1">
              <label>{initialData ? 'Tồn hiện tại' : 'Tồn đầu kỳ'}</label>
              <input
                type="number"
                name="stockQuantity"
                value={formData.stockQuantity}
                onChange={handleChange}
                min="0"
                disabled={Boolean(initialData)}
              />
              {initialData && (
                <span className="field-note" style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', display: 'block' }}>
                  Để thay đổi tồn kho, vui lòng dùng chức năng Nhập hàng / Xuất hàng.
                </span>
              )}
            </div>
            <div className="form-group flex-1">
              <label>Ngưỡng cảnh báo (tối thiểu)</label>
              <input type="number" name="minStockAlert" value={formData.minStockAlert} onChange={handleChange} min="0" />
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
