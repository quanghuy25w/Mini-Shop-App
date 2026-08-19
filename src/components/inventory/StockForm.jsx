import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AppDataContext } from '../../context/AppDataContext';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateTotalAmount } from '../../utils/calculateTotal';
import { validateStock } from '../../utils/validate';
import { toast } from 'react-toastify';
import './StockForm.css';

// Component render Thumbnail san pham (anh or icon visual)
const ProductThumbnail = ({ product, size = 38 }) => {
  if (!product) return null;
  if (product.imageUrl || product.image) {
    return (
      <div className="product-thumb-box" style={{ width: size, height: size }}>
        <img src={product.imageUrl || product.image} alt={product.name} />
      </div>
    );
  }

  let thumbClass = 'thumb-default';
  let iconSvg = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    </svg>
  );

  if (product.categoryId === 'c1111111-1111-1111-1111-111111111111') {
    thumbClass = 'thumb-drink';
    iconSvg = (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
      </svg>
    );
  } else if (product.categoryId === 'c2222222-2222-2222-2222-222222222222') {
    thumbClass = 'thumb-drink';
    iconSvg = (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="3"></rect>
        <line x1="5" y1="6" x2="19" y2="6"></line>
      </svg>
    );
  } else if (product.categoryId === 'c3333333-3333-3333-3333-333333333333') {
    thumbClass = 'thumb-home';
    iconSvg = (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      </svg>
    );
  } else if (product.categoryId === 'c4444444-4444-4444-4444-444444444444') {
    thumbClass = 'thumb-stationery';
    iconSvg = (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

// Helper lay ma san pham hien thi (VD: SP001)
const getProductCode = (product, idx = 0) => {
  if (product?.code) return product.code;
  if (product?.id && product.id.startsWith('p0000000-0000-0000-0000-00000000000')) {
    const num = parseInt(product.id.slice(-2), 10);
    return `SP${String(num).padStart(3, '0')}`;
  }
  return `SP${String(idx + 1).padStart(3, '0')}`;
};

const StockForm = ({ type, onSubmit, isLoading, initialProductId = '' }) => {
  const { products, categories } = useContext(AppDataContext);

  // Chi chon cac san pham đang active
  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);

  const getCategoryName = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : 'Khác';
  };

  // State cho Nhap hang & Xuat hang
  const [supplier, setSupplier] = useState('');
  const [importDate, setImportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiptCode, setReceiptCode] = useState(type === 'IN' ? 'PN008' : 'PX008');
  const [reason, setReason] = useState('Chuyển kho');
  const [destination, setDestination] = useState('Kho chi nhánh Hà Nội');
  const [note, setNote] = useState('');

  // State cho san pham dang chon & danh sach tam
  const [selectedProductId, setSelectedProductId] = useState(initialProductId);
  const [tempQuantity, setTempQuantity] = useState(type === 'IN' ? '20' : '1');
  const [tempUnitPrice, setTempUnitPrice] = useState('');
  const [tempItems, setTempItems] = useState([]);

  // Custom dropdown / popover picker state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef(null);

  // San pham duoc chon
  const selectedProduct = useMemo(() => {
    return activeProducts.find(p => p.id === selectedProductId) || null;
  }, [activeProducts, selectedProductId]);

  // Initial Product ID from props
  useEffect(() => {
    if (initialProductId && activeProducts.length > 0) {
      setSelectedProductId(initialProductId);
      const prod = activeProducts.find(p => p.id === initialProductId);
      if (prod) {
        setTempUnitPrice(String(prod.costPrice || 0));
        setTempQuantity('1');
      }
    }
  }, [initialProductId, activeProducts]);

  // Dong dropdown khi click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter san pham trong dropdown popover
  const filteredDropdownProducts = useMemo(() => {
    if (!dropdownSearch.trim()) return activeProducts;
    const q = dropdownSearch.toLowerCase();
    return activeProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      getProductCode(p).toLowerCase().includes(q) ||
      getCategoryName(p.categoryId).toLowerCase().includes(q)
    );
  }, [activeProducts, dropdownSearch, categories]);

  // Thanh tien tam tinh cho o dang chon (Nhap hang)
  const tempTotalAmount = useMemo(() => {
    const q = Number(tempQuantity) || 0;
    const p = Number(tempUnitPrice) || 0;
    return q * p;
  }, [tempQuantity, tempUnitPrice]);

  // Tong so luong & tong tien cho Nhap hang
  const totalImportQuantity = useMemo(() => {
    return tempItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [tempItems]);

  const totalImportAmount = useMemo(() => {
    return tempItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
  }, [tempItems]);

  // Tong so loai san pham, so luong xuat & tong gia tri xuat cho Xuat hang (theo costPrice)
  const totalItemTypes = useMemo(() => tempItems.length, [tempItems]);

  const totalExportQuantity = useMemo(() => {
    return tempItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [tempItems]);

  const totalExportValue = useMemo(() => {
    return tempItems.reduce((sum, item) => {
      const price = item.unitPrice || item.product?.costPrice || 0;
      return sum + (Number(item.quantity || 0) * Number(price));
    }, 0);
  }, [tempItems]);

  // Chon 1 san pham tu dropdown Nhap hang
  const handleSelectImportProduct = (product) => {
    setSelectedProductId(product.id);
    setTempUnitPrice(String(product.costPrice || 0));
    if (!tempQuantity || Number(tempQuantity) <= 0) {
      setTempQuantity('1');
    }
    setIsDropdownOpen(false);
    setDropdownSearch('');
  };

  // Them san pham vao danh sach tam Nhap hang
  const handleAddImportToList = () => {
    if (!selectedProduct) {
      toast.error('Vui lòng chọn 1 sản phẩm!');
      return;
    }

    const qtyNum = Number(tempQuantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error('Số lượng nhập phải lớn hơn 0!');
      return;
    }

    const priceNum = Number(tempUnitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Giá nhập/đơn vị phải lớn hơn hoặc bằng 0 ₫!');
      return;
    }

    const existingIndex = tempItems.findIndex(item => item.productId === selectedProduct.id);

    if (existingIndex >= 0) {
      const updatedList = [...tempItems];
      const existingItem = updatedList[existingIndex];
      existingItem.quantity += qtyNum;
      existingItem.unitPrice = priceNum;
      setTempItems(updatedList);
      toast.info(`Sản phẩm "${selectedProduct.name}" đã có trong danh sách. Đã cộng dồn số lượng!`);
    } else {
      setTempItems([
        ...tempItems,
        {
          productId: selectedProduct.id,
          product: selectedProduct,
          quantity: qtyNum,
          unitPrice: priceNum
        }
      ]);
      toast.success(`Đã thêm "${selectedProduct.name}" vào danh sách sản phẩm nhập.`);
    }
  };

  // Reset toan bo form Nhap hang
  const handleResetImportAll = () => {
    setSupplier('');
    const today = new Date();
    setImportDate(today.toISOString().split('T')[0]);
    setReceiptCode('PN008');
    setNote('');
    setSelectedProductId('');
    setTempQuantity('');
    setTempUnitPrice('');
    setTempItems([]);
    toast.info('Đã đặt lại toàn bộ thông tin phiếu nhập.');
  };

  // Submit toan bo phieu nhap
  const handleImportConfirmSubmit = async (e) => {
    e.preventDefault();

    if (tempItems.length === 0) {
      toast.error('Danh sách sản phẩm nhập đang trống! Vui lòng thêm ít nhất 1 sản phẩm.');
      return;
    }

    if (!supplier.trim()) {
      toast.error('Vui lòng chọn hoặc nhập Nhà cung cấp!');
      return;
    }

    if (!receiptCode.trim()) {
      toast.error('Vui lòng nhập Số phiếu nhập!');
      return;
    }

    try {
      await onSubmit({
        supplier: supplier.trim(),
        importDate,
        receiptCode: receiptCode.trim(),
        note: note.trim(),
        items: tempItems,
        totalQuantity: totalImportQuantity,
        totalAmount: totalImportAmount,
        onPartialSuccess: (remainingItems) => {
          setTempItems(remainingItems);
        },
        onSuccess: () => {
          setTempItems([]);
          setNote('');
          setSelectedProductId('');
          setTempQuantity('');
          setTempUnitPrice('');
        }
      });
    } catch (err) {
      // Handled in parent
    }
  };

  // Chon/Them san pham cho Xuat hang
  const handleAddExportProduct = (product) => {
    if (tempItems.some(i => i.productId === product.id)) {
      toast.warn(`Sản phẩm "${product.name}" đã có trong danh sách xuất kho!`);
      setIsDropdownOpen(false);
      return;
    }

    if (product.stockQuantity <= 0) {
      toast.error(`Sản phẩm "${product.name}" đã hết hàng trong kho!`);
      return;
    }

    setTempItems([
      ...tempItems,
      {
        productId: product.id,
        product,
        quantity: 1,
        unitPrice: product.costPrice || 0
      }
    ]);
    setIsDropdownOpen(false);
    setDropdownSearch('');
    toast.success(`Đã thêm "${product.name}" vào danh sách xuất kho.`);
  };

  // Cap nhat so luong xuat cua 1 dong trong bang
  const handleUpdateItemQuantity = (productId, newQty) => {
    const itemIndex = tempItems.findIndex(i => i.productId === productId);
    if (itemIndex < 0) return;

    const item = tempItems[itemIndex];
    const qtyNum = Number(newQty);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error('Số lượng xuất phải lớn hơn 0!');
      return;
    }

    const updatedList = [...tempItems];
    updatedList[itemIndex] = { ...item, quantity: qtyNum };
    setTempItems(updatedList);
  };

  // Xoá 1 san pham khoi danh sach tam
  const handleRemoveItem = (prodId) => {
    setTempItems(tempItems.filter(item => item.productId !== prodId));
    toast.info('Đã xoá sản phẩm khỏi danh sách.');
  };

  // Reset toan bo form Xuat hang
  const handleResetExport = () => {
    const today = new Date();
    setExportDate(today.toISOString().split('T')[0]);
    setReceiptCode('PX008');
    setReason('Chuyển kho');
    setDestination('Kho chi nhánh Hà Nội');
    setNote('');
    setTempItems([]);
    toast.info('Đã đặt lại toàn bộ thông tin phiếu xuất.');
  };

  // Submit toan bo phieu xuat
  const handleExportConfirmSubmit = async (e) => {
    e.preventDefault();

    if (tempItems.length === 0) {
      toast.error('Danh sách sản phẩm xuất đang trống! Vui lòng chọn ít nhất 1 sản phẩm.');
      return;
    }

    if (!receiptCode.trim()) {
      toast.error('Vui lòng nhập Số phiếu xuất!');
      return;
    }

    if (!destination.trim()) {
      toast.error('Vui lòng nhập Kho nhận / Nơi nhận!');
      return;
    }

    // Validate tat ca so luong xuat <= ton kho
    for (const item of tempItems) {
      const valErr = validateStock(item.quantity, item.product.stockQuantity);
      if (valErr) {
        toast.error(`Sản phẩm "${item.product.name}": ${valErr}`);
        return;
      }
    }

    try {
      await onSubmit({
        exportDate,
        receiptCode: receiptCode.trim(),
        reason: reason.trim(),
        destination: destination.trim(),
        note: note.trim(),
        items: tempItems,
        totalQuantity: totalExportQuantity,
        totalAmount: totalExportValue,
        onPartialSuccess: (remainingItems) => {
          setTempItems(remainingItems);
        },
        onSuccess: () => {
          setTempItems([]);
          setNote('');
        }
      });
    } catch (err) {
      // Handled in parent
    }
  };

  // =========================================================
  // GIAO DIỆN NHẬP HÀNG (type === 'IN')
  // =========================================================
  if (type === 'IN') {
    return (
      <div className="import-grid-layout">
        {/* CỘT TRÁI - CARD THÔNG TIN NHẬP HÀNG */}
        <div className="import-card">
          <h3 className="import-card-title">Thông tin nhập hàng</h3>

          <form onSubmit={handleImportConfirmSubmit}>
            <div className="form-group">
              <label>
                Nhà cung cấp <span className="required-mark">*</span>
              </label>
              <select
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                required
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                <option value="Nhà phân phối Abbott">Nhà phân phối Abbott</option>
                <option value="Nhà phân phối Vinamilk">Nhà phân phối Vinamilk</option>
                <option value="Nhà phân phối Nutifood">Nhà phân phối Nutifood</option>
                <option value="Nhà phân phối FrieslandCampina">Nhà phân phối FrieslandCampina</option>
                <option value="Nhà phân phối Nestlé">Nhà phân phối Nestlé</option>
                <option value="Nhà phân phối Meiji">Nhà phân phối Meiji</option>
                <option value="Nhà phân phối HiPP">Nhà phân phối HiPP</option>
                <option value="Nhà phân phối Aptamil">Nhà phân phối Aptamil</option>
                <option value="Nhà phân phối Nutricare">Nhà phân phối Nutricare</option>
                <option value="Nhà phân phối Rontamil">Nhà phân phối Rontamil</option>
              </select>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label>
                  Ngày nhập <span className="required-mark">*</span>
                </label>
                <input
                  type="date"
                  value={importDate}
                  onChange={e => setImportDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  Số phiếu nhập <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  value={receiptCode}
                  onChange={e => setReceiptCode(e.target.value)}
                  required
                  placeholder="VD: PN008"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Ghi chú</label>
              <div className="textarea-container">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0, 200))}
                  maxLength={200}
                  rows={4}
                  placeholder="Nhập ghi chú (nếu có)..."
                />
                <span className="char-counter">{note.length} / 200</span>
              </div>
            </div>

            <div className="import-card-actions">
              <button
                type="button"
                className="btn-reset-form"
                onClick={handleResetImportAll}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span>Đặt lại</span>
              </button>

              <button
                type="submit"
                className="btn-submit-import"
                disabled={isLoading || tempItems.length === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>{isLoading ? 'Đang nhập...' : 'Xác nhận nhập hàng'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* CỘT PHẢI - CARD CHI TIẾT SẢN PHẨM NHẬP */}
        <div className="import-card">
          <h3 className="import-card-title">Chi tiết sản phẩm nhập</h3>

          <div className="form-group">
            <label>
              Chọn sản phẩm <span className="required-mark">*</span>
            </label>
            <div className="custom-product-select" ref={dropdownRef}>
              <div
                className={`select-trigger-box ${isDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                {selectedProduct ? (
                  <div className="trigger-product-info">
                    <ProductThumbnail product={selectedProduct} size={38} />
                    <div className="trigger-product-text">
                      <span className="trigger-product-name">{selectedProduct.name}</span>
                      <span className="trigger-product-sub">
                        Mã SP: {getProductCode(selectedProduct)} &nbsp;|&nbsp; Danh mục: {getCategoryName(selectedProduct.categoryId)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="select-placeholder-text">-- Chọn sản phẩm --</span>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              {isDropdownOpen && (
                <div className="dropdown-popover">
                  <div className="dropdown-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      type="text"
                      placeholder="Tìm sản phẩm theo tên, mã..."
                      value={dropdownSearch}
                      onChange={e => setDropdownSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="dropdown-options-container">
                    {filteredDropdownProducts.length === 0 ? (
                      <div className="dropdown-no-results">Không tìm thấy sản phẩm phù hợp</div>
                    ) : (
                      filteredDropdownProducts.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`dropdown-item-row ${p.id === selectedProductId ? 'active' : ''}`}
                          onClick={() => handleSelectImportProduct(p)}
                        >
                          <ProductThumbnail product={p} size={34} />
                          <div className="dropdown-item-text">
                            <span className="dropdown-item-name">{p.name}</span>
                            <span className="dropdown-item-sub">
                              Mã SP: {getProductCode(p, idx)} &nbsp;|&nbsp; Danh mục: {getCategoryName(p.categoryId)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="product-inputs-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>
                Số lượng nhập <span className="required-mark">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={tempQuantity}
                onChange={e => setTempQuantity(e.target.value)}
                placeholder="VD: 20"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>
                Giá nhập / đơn vị (đ) <span className="required-mark">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={tempUnitPrice}
                onChange={e => setTempUnitPrice(e.target.value)}
                placeholder="VD: 6000"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Thành tiền (đ)</label>
              <input
                type="text"
                readOnly
                value={formatCurrency(tempTotalAmount)}
                className="readonly-amount-input font-mono"
              />
            </div>

            <button
              type="button"
              className="btn-add-to-list"
              onClick={handleAddImportToList}
            >
              + Thêm vào danh sách
            </button>
          </div>

          <div className="temp-table-section">
            <h4 className="temp-table-title">Danh sách sản phẩm</h4>
            <div className="import-table-container">
              {tempItems.length === 0 ? (
                <div className="empty-temp-table">
                  Chưa có sản phẩm nào trong danh sách. Vui lòng chọn sản phẩm và bấm "+ Thêm vào danh sách".
                </div>
              ) : (
                <table className="import-temp-table">
                  <thead>
                    <tr>
                      <th width="45px" className="text-center">#</th>
                      <th>Sản phẩm</th>
                      <th className="text-center">Số lượng</th>
                      <th className="text-right">Giá nhập (đ)</th>
                      <th className="text-right">Thành tiền (đ)</th>
                      <th width="80px" className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempItems.map((item, idx) => (
                      <tr key={item.productId || idx}>
                        <td className="text-center font-mono" style={{ color: '#64748b' }}>{idx + 1}</td>
                        <td>
                          <div className="table-product-cell">
                            <ProductThumbnail product={item.product} size={30} />
                            <span className="table-product-name">{item.product?.name}</span>
                          </div>
                        </td>
                        <td className="text-center font-mono font-medium">{item.quantity}</td>
                        <td className="text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right font-mono font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn-delete-row"
                            onClick={() => handleRemoveItem(item.productId)}
                            title="Xoá sản phẩm khỏi danh sách"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="summary-footer-box">
            <div className="summary-col-left">
              <span className="summary-label">Tổng số lượng sản phẩm</span>
              <span className="summary-val-qty">{totalImportQuantity}</span>
            </div>
            <div className="summary-col-right">
              <span className="summary-label">Tổng tiền nhập</span>
              <span className="summary-val-amount">{formatCurrency(totalImportAmount)} </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // GIAO DIỆN XUẤT HÀNG (type === 'OUT') - THIẾT KẾ MỚI 2 CỘT
  // =========================================================
  return (
    <div className="import-grid-layout">
      {/* CỘT TRÁI - CARD THÔNG TIN XUẤT HÀNG */}
      <div className="import-card">
        <h3 className="import-card-title">Thông tin xuất hàng</h3>

        <form onSubmit={handleExportConfirmSubmit}>
          <div className="form-group">
            <label>
              Kho xuất <span className="required-mark">*</span>
            </label>
            <select disabled value="Kho chính">
              <option value="Kho chính">🏠 Kho chính</option>
            </select>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label>
                Ngày xuất <span className="required-mark">*</span>
              </label>
              <input
                type="date"
                value={exportDate}
                onChange={e => setExportDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>
                Số phiếu xuất <span className="required-mark">*</span>
              </label>
              <input
                type="text"
                value={receiptCode}
                onChange={e => setReceiptCode(e.target.value)}
                required
                placeholder="VD: PX008"
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              Lý do xuất <span className="required-mark">*</span>
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            >
              <option value="Chuyển kho">Chuyển kho</option>
              <option value="Hỏng hóc / Hết hạn">Hỏng hóc / Hết hạn</option>
              <option value="Trả hàng nhà cung cấp">Trả hàng nhà cung cấp</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Kho nhận / Nơi nhận <span className="required-mark">*</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              required
              placeholder="VD: Kho chi nhánh Hà Nội"
            />
          </div>

          <div className="form-group">
            <label>Ghi chú</label>
            <div className="textarea-container">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 200))}
                maxLength={200}
                rows={4}
                placeholder="Nhập ghi chú (nếu có)..."
              />
              <span className="char-counter">{note.length} / 200</span>
            </div>
          </div>

          <div className="import-card-actions">
            <button
              type="button"
              className="btn-reset-form"
              onClick={handleResetExport}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              <span>Đặt lại</span>
            </button>

            <button
              type="submit"
              className="btn-submit-import"
              disabled={isLoading || tempItems.length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M1 3h15v13H1z"></path>
                <path d="M16 8h4l3 3v5h-7V8z"></path>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              <span>{isLoading ? 'Đang xuất...' : 'Xác nhận xuất hàng'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* CỘT PHẢI - CARD CHI TIẾT SẢN PHẨM XUẤT */}
      <div className="import-card">
        <h3 className="import-card-title">Chi tiết sản phẩm xuất</h3>

        {/* THANH TÌM KIẾM + NÚT THÊM SẢN PHẨM */}
        <div className="export-top-toolbar" ref={dropdownRef}>
          <div className="export-search-field">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={dropdownSearch}
              onChange={e => {
                setDropdownSearch(e.target.value);
                if (!isDropdownOpen) setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
            />
          </div>

          <button
            type="button"
            className="btn-open-prod-picker"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            + Thêm sản phẩm
          </button>

          {/* DROPDOWN MENU CHỌN SẢN PHẨM XUẤT */}
          {isDropdownOpen && (
            <div className="dropdown-popover" style={{ top: '50px' }}>
              <div className="dropdown-options-container">
                {filteredDropdownProducts.length === 0 ? (
                  <div className="dropdown-no-results">Không tìm thấy sản phẩm phù hợp</div>
                ) : (
                  filteredDropdownProducts.map((p, idx) => (
                    <div
                      key={p.id}
                      className="dropdown-item-row"
                      onClick={() => handleAddExportProduct(p)}
                    >
                      <ProductThumbnail product={p} size={34} />
                      <div className="dropdown-item-text">
                        <span className="dropdown-item-name">{p.name}</span>
                        <span className="dropdown-item-sub">
                          Tồn kho: <strong>{p.stockQuantity}</strong> {p.unit} &nbsp;|&nbsp; Mã SP: {getProductCode(p, idx)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* BẢNG DANH SÁCH SẢN PHẨM XUẤT */}
        <div className="import-table-container">
          {tempItems.length === 0 ? (
            <div className="empty-temp-table">
              Chưa có sản phẩm nào trong danh sách xuất kho. Bấm "+ Thêm sản phẩm" hoặc gõ từ khoá tìm kiếm ở trên để chọn.
            </div>
          ) : (
            <table className="import-temp-table">
              <thead>
                <tr>
                  <th width="45px" className="text-center">#</th>
                  <th>Sản phẩm</th>
                  <th className="text-center" width="90px">Tồn kho</th>
                  <th className="text-center" width="130px">Số lượng xuất</th>
                  <th className="text-center" width="70px">Đơn vị</th>
                  <th width="70px" className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {tempItems.map((item, idx) => {
                  const stock = item.product?.stockQuantity || 0;
                  const isLow = stock <= 5;
                  const isExceeded = item.quantity > stock;

                  return (
                    <tr key={item.productId || idx}>
                      <td className="text-center font-mono" style={{ color: '#64748b' }}>{idx + 1}</td>
                      <td>
                        <div className="table-product-cell">
                          <ProductThumbnail product={item.product} size={30} />
                          <span className="table-product-name">{item.product?.name}</span>
                        </div>
                      </td>
                      <td className={`text-center font-mono stock-qty-badge ${isLow || isExceeded ? 'text-stock-danger' : ''}`}>
                        {stock}
                      </td>
                      <td className="text-center">
                        <div className="cart-qty-spinner" style={{ margin: '0 auto' }}>
                          <button
                            type="button"
                            className="btn-spinner"
                            onClick={() => handleUpdateItemQuantity(item.productId, Math.max(1, item.quantity - 1))}
                          >-</button>
                          <input
                            type="text"
                            className="spinner-input"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                handleUpdateItemQuantity(item.productId, val);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-spinner"
                            onClick={() => handleUpdateItemQuantity(item.productId, item.quantity + 1)}
                          >+</button>
                        </div>
                      </td>
                      <td className="text-center" style={{ color: '#475569', fontSize: '13px' }}>
                        {item.product?.unit || 'Cái'}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-delete-row"
                          onClick={() => handleRemoveItem(item.productId)}
                          title="Xoá khỏi danh sách xuất kho"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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

        {/* DÒNG LƯU Ý HƯỚNG DẪN */}
        <div className="export-callout-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>Lưu ý: Số lượng xuất không được vượt quá tồn kho hiện có.</span>
        </div>

        {/* FOOTER TỔNG HỢP 3 KHỐI KPI */}
        <div className="export-kpi-footer-grid">
          <div className="export-kpi-card">
            <div className="export-kpi-icon kpi-icon-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
            </div>
            <div className="export-kpi-content">
              <span className="export-kpi-label">Tổng số sản phẩm</span>
              <div className="export-kpi-val-row">
                <span className="export-kpi-val">{totalItemTypes}</span>
                <span className="export-kpi-unit">loại</span>
              </div>
            </div>
          </div>

          <div className="export-kpi-card">
            <div className="export-kpi-icon kpi-icon-emerald">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
            </div>
            <div className="export-kpi-content">
              <span className="export-kpi-label">Tổng số lượng xuất</span>
              <div className="export-kpi-val-row">
                <span className="export-kpi-val">{totalExportQuantity}</span>
                <span className="export-kpi-unit">sản phẩm</span>
              </div>
            </div>
          </div>

          <div className="export-kpi-card">
            <div className="export-kpi-icon kpi-icon-mint">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </div>
            <div className="export-kpi-content">
              <span className="export-kpi-label">Tổng giá trị xuất</span>
              <div className="export-kpi-val-row">
                <span className="export-kpi-val">{formatCurrency(totalExportValue)} </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockForm;
