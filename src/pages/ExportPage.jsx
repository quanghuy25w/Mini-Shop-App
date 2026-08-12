import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StockForm from '../components/inventory/StockForm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useInventory } from '../hooks/useInventory';
import { toast } from 'react-toastify';

const ExportPage = () => {
  const { exportStock } = useInventory();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  const handleExportSubmit = (data) => {
    // Instead of executing immediately, open the confirm dialog
    setConfirmData(data);
    return Promise.resolve(); // Keep form in current state
  };

  const executeExport = async () => {
    if (!confirmData) return;
    setIsLoading(true);
    try {
      await exportStock(confirmData.productId, confirmData.quantity, confirmData.note);
      toast.success('Xuất kho thành công!');
      setIsLoading(false);
      setConfirmData(null);
      // Automatically navigate to history page after success
      navigate('/transactions');
    } catch (error) {
      toast.error(error.message);
      setIsLoading(false);
      setConfirmData(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Xuất Kho (Thủ công)</h2>
      </div>
      <div className="page-content" style={{ background: 'none', boxShadow: 'none' }}>
        <StockForm 
          type="OUT" 
          onSubmit={handleExportSubmit}
          isLoading={isLoading}
        />
      </div>

      <ConfirmDialog 
        isOpen={!!confirmData}
        title="Xác nhận Xuất Kho"
        message={`Bạn đang chuẩn bị xuất ${confirmData?.quantity} sản phẩm. Sau khi xuất, hệ thống sẽ cập nhật lại tồn kho và ghi nhận vào lịch sử giao dịch. Bạn có chắc chắn?`}
        onConfirm={executeExport}
        onCancel={() => setConfirmData(null)}
      />
    </div>
  );
};

export default ExportPage;
