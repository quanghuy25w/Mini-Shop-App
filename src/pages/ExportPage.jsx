import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StockForm from '../components/inventory/StockForm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useInventory } from '../hooks/useInventory';
import { toast } from 'react-toastify';

const ExportPage = () => {
  const { exportStock } = useInventory();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Nhan request xuat kho tu StockForm
  const handleExportSubmit = (data) => {
    setConfirmData(data);
    return Promise.resolve();
  };

  // Thuc hien xuat kho tuan tu cho cac san pham
  const executeExport = async () => {
    if (!confirmData) return;
    setIsLoading(true);

    const { items, receiptCode, reason, destination, note, onSuccess, onPartialSuccess } = confirmData;
    const exportItemsList = items || [];
    const successfulItems = [];
    let failedIndex = -1;
    let errorMessage = '';

    for (let i = 0; i < exportItemsList.length; i++) {
      const item = exportItemsList[i];

      // Format chuoi ghi chu ket hop thong tin ma phieu, ly do va noi nhan
      const noteParts = [`[Phiếu ${receiptCode}]`];
      if (reason) noteParts.push(`[Lý do: ${reason}]`);
      if (destination) noteParts.push(`[Kho xuất: Kho chính -> Nơi nhận: ${destination}]`);
      if (note) noteParts.push(note);
      const fullNote = noteParts.join(' ').trim();

      try {
        await exportStock(item.productId, item.quantity, fullNote);
        successfulItems.push(item);
      } catch (err) {
        failedIndex = i;
        errorMessage = err.message || 'Lỗi xử lý API';
        break; // Dung loop lap tuc khi co 1 item bi loi
      }
    }

    if (failedIndex === -1) {
      // Xuat kho thành cong toan bo
      toast.success('Xác nhận xuất kho thành công! Đã cập nhật tồn kho.');
      if (onSuccess) {
        onSuccess();
      }
      setIsLoading(false);
      setConfirmData(null);
      // Chuyen huong sang trang lich su giao dịch nhu hanh vi cu
      navigate('/transactions');
    } else {
      // Gián đoạn giữa chừng: khong rollback cac item da xuat thanh cong, giu lai cac item chua xuat tren bang
      const failedItem = exportItemsList[failedIndex];
      const remainingItems = exportItemsList.slice(failedIndex);

      if (successfulItems.length > 0) {
        toast.warn(
          `Đã xuất thành công ${successfulItems.length} sản phẩm. Xuất kho bị gián đoạn tại "${failedItem.product?.name || 'Sản phẩm'}": ${errorMessage}`
        );
      } else {
        toast.error(`Xuất kho thất bại tại "${failedItem.product?.name || 'Sản phẩm'}": ${errorMessage}`);
      }

      if (onPartialSuccess) {
        onPartialSuccess(remainingItems);
      }
      setIsLoading(false);
      setConfirmData(null);
    }
  };

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
