import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StockForm from '../components/inventory/StockForm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useInventory } from '../hooks/useInventory';
import { formatCurrency } from '../utils/formatCurrency';
import { toast } from 'react-toastify';

const ImportPage = () => {
  const { importStock } = useInventory();
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Nhan request nhap kho tu StockForm
  const handleImportSubmit = (data) => {
    setConfirmData(data);
    return Promise.resolve();
  };

  // Thuc hien nhap kho tuan tu
  const executeImport = async () => {
    if (!confirmData) return;
    setIsLoading(true);

    const { items, receiptCode, supplier, note, onSuccess, onPartialSuccess } = confirmData;
    
    // Hop nhat array items de nhap kho
    const importItemsList = items || [];
    const successfulItems = [];
    let failedIndex = -1;
    let errorMessage = '';

    for (let i = 0; i < importItemsList.length; i++) {
      const item = importItemsList[i];
      const noteParts = [`[Phiếu ${receiptCode}]`];
      if (supplier) noteParts.push(`NCC: ${supplier}`);
      if (note) noteParts.push(`- ${note}`);
      const fullNote = noteParts.join(' ').trim();

      try {
        await importStock(item.productId, item.quantity, item.unitPrice, fullNote);
        successfulItems.push(item);
      } catch (err) {
        failedIndex = i;
        errorMessage = err.message || 'Lỗi xử lý API';
        break; // Dung loop lap tuc khi co 1 item bi loi
      }
    }

    if (failedIndex === -1) {
      // Nhap kho thanh cong toan bo
      toast.success('Xác nhận nhập hàng thành công! Đã cập nhật tồn kho.');
      if (onSuccess) {
        onSuccess();
      }
    } else {
      // Gián đoạn giữa chừng: khong rollback, giu lai cac san pham chua nhap trong bang
      const failedItem = importItemsList[failedIndex];
      const remainingItems = importItemsList.slice(failedIndex);

      if (successfulItems.length > 0) {
        toast.warn(
          `Đã nhập thành công ${successfulItems.length} sản phẩm. Nhập kho bị gián đoạn tại "${failedItem.product?.name || 'Sản phẩm'}": ${errorMessage}`
        );
      } else {
        toast.error(`Nhập kho thất bại tại "${failedItem.product?.name || 'Sản phẩm'}": ${errorMessage}`);
      }

      if (onPartialSuccess) {
        onPartialSuccess(remainingItems);
      }
    }

    setIsLoading(false);
    setConfirmData(null);
  };

  return (
    <div className="page-container" style={{ maxWidth: '1280px' }}>
      {/* HEADER TRANG & BREADCRUMB */}
      <div className="import-page-header">
        <h2>Nhập hàng</h2>
        <div className="import-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span className="import-breadcrumb-sep">&gt;</span>
          <span className="import-breadcrumb-current">Nhập hàng</span>
        </div>
      </div>

      {/* NOIDUNG TRANG NHẬP HÀNG 2 CỘT */}
      <div className="page-content" style={{ background: 'none', boxShadow: 'none', padding: 0 }}>
        <StockForm 
          type="IN" 
          onSubmit={handleImportSubmit}
          isLoading={isLoading}
          initialProductId={initialProductId}
        />
      </div>

      {/* CONFIRM DIALOG */}
      <ConfirmDialog 
        isOpen={!!confirmData}
        title="Xác nhận Nhập hàng"
        message={
          confirmData 
            ? `Bạn có chắc chắn muốn xác nhận nhập ${confirmData.totalQuantity} sản phẩm (${confirmData.items?.length || 0} loại sản phẩm) với tổng số tiền ${formatCurrency(confirmData.totalAmount)} theo phiếu ${confirmData.receiptCode}?`
            : ''
        }
        onConfirm={executeImport}
        onCancel={() => setConfirmData(null)}
      />
    </div>
  );
};

export default ImportPage;
