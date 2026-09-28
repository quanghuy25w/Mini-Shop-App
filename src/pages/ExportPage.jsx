import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StockForm from '../components/inventory/StockForm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import WorkSessionBanner from '../components/workSession/WorkSessionBanner';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

const ExportPage = () => {
  const { exportStockBatch } = useInventory();
  const { can } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Nhận request xuất kho từ StockForm
  const handleExportSubmit = (data) => {
    setConfirmData(data);
    return Promise.resolve();
  };

  // Thực hiện xuất kho nguyên tử (Atomic Batch)
  const executeExport = async () => {
    if (!confirmData) return;
    setIsLoading(true);

    const { items, receiptCode, reason, destination, note, onSuccess } = confirmData;
    const exportItemsList = items || [];

    try {
      await exportStockBatch(exportItemsList, {
        receiptCode,
        reason,
        destination,
        note
      });
      toast.success('Xác nhận xuất kho thành công! Đã cập nhật tồn kho.');
      if (onSuccess) {
        onSuccess();
      }
      setIsLoading(false);
      setConfirmData(null);
      // Chuyển hướng sang trang lịch sử giao dịch
      navigate('/transactions');
    } catch (err) {
      toast.error(`Xuất kho thất bại: ${err.message || 'Lỗi xử lý API'}`);
      setIsLoading(false);
      setConfirmData(null);
    }
  };

  if (!can('inventory.export')) {
    return (
      <div className="page-container" style={{ maxWidth: '1280px' }}>
        <div className="import-page-header">
          <h2>Xuất hàng</h2>
          <div className="import-breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span className="import-breadcrumb-sep">&gt;</span>
            <span className="import-breadcrumb-current">Xuất hàng</span>
          </div>
        </div>
        <div className="page-content" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', color: 'var(--ink-muted)' }}>Bạn không có quyền thực hiện xuất kho. Vui lòng liên hệ Quản trị viên.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1280px' }}>
      {/* HEADER TRANG & BREADCRUMB */}
      <div className="import-page-header">
        <h2>Xuất hàng</h2>
        <div className="import-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span className="import-breadcrumb-sep">&gt;</span>
          <span className="import-breadcrumb-current">Xuất hàng</span>
        </div>
      </div>

      {/* BANNER CA LÀM VIỆC */}
      <WorkSessionBanner />

      {/* NOIDUNG TRANG XUẤT HÀNG 2 CỘT */}
      <div className="page-content" style={{ background: 'none', boxShadow: 'none', padding: 0 }}>
        <StockForm 
          type="OUT" 
          onSubmit={handleExportSubmit}
          isLoading={isLoading}
        />
      </div>

      {/* CONFIRM DIALOG */}
      <ConfirmDialog 
        isOpen={!!confirmData}
        title="Xác nhận Xuất hàng"
        message={
          confirmData 
            ? `Bạn có chắc chắn muốn xác nhận xuất ${confirmData.totalQuantity} sản phẩm (${confirmData.items?.length || 0} loại sản phẩm) theo phiếu ${confirmData.receiptCode} đến "${confirmData.destination}"?`
            : ''
        }
        onConfirm={executeExport}
        onCancel={() => setConfirmData(null)}
      />
    </div>
  );
};

export default ExportPage;
