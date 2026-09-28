import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StockForm from '../components/inventory/StockForm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import WorkSessionBanner from '../components/workSession/WorkSessionBanner';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../hooks/useAuth';
import { INVENTORY_REASONS } from '../api/inventoryApi';
import { formatCurrency } from '../utils/formatCurrency';
import { toast } from 'react-toastify';

const ImportPage = () => {
  const { importStockBatch } = useInventory();
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Nhận request nhập kho từ StockForm
  const handleImportSubmit = (data) => {
    setConfirmData(data);
    return Promise.resolve();
  };

  // Thực hiện nhập kho nguyên tử (Atomic Batch)
  const executeImport = async () => {
    if (!confirmData) return;
    setIsLoading(true);

    const { items, receiptCode, supplier, note, onSuccess } = confirmData;
    const importItemsList = items || [];

    try {
      await importStockBatch(importItemsList, {
        receiptCode,
        supplier,
        note,
        reason: INVENTORY_REASONS.PURCHASE
      });
      toast.success('Xác nhận nhập hàng thành công! Đã cập nhật tồn kho.');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      toast.error(`Nhập kho thất bại: ${err.message || 'Lỗi xử lý API'}`);
    } finally {
      setIsLoading(false);
      setConfirmData(null);
    }
  };

  if (!can('inventory.import')) {
    return (
      <div className="page-container" style={{ maxWidth: '1280px' }}>
        <div className="import-page-header">
          <h2>Nhập hàng</h2>
          <div className="import-breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span className="import-breadcrumb-sep">&gt;</span>
            <span className="import-breadcrumb-current">Nhập hàng</span>
          </div>
        </div>
        <div className="page-content" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', color: 'var(--ink-muted)' }}>Bạn không có quyền thực hiện nhập kho. Vui lòng liên hệ Quản trị viên.</p>
        </div>
      </div>
    );
  }

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

      {/* BANNER CA LÀM VIỆC */}
      <WorkSessionBanner />

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
