import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StockForm from '../components/inventory/StockForm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useInventory } from '../hooks/useInventory';
import { formatCurrency } from '../utils/formatCurrency';
import { toast } from 'react-toastify';

const ImportPage = () => {
  const { importStock } = useInventory();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  const handleImportSubmit = (data) => {
    setConfirmData(data);
    return Promise.resolve();
  };

  const executeImport = async () => {
    if (!confirmData) return;
    setIsLoading(true);
    try {
      await importStock(confirmData.productId, confirmData.quantity, confirmData.unitPrice, confirmData.note);
      toast.success('Nhập kho thành công!');
      setIsLoading(false);
      setConfirmData(null);
      navigate('/transactions');
    } catch (error) {
      toast.error(error.message);
      setIsLoading(false);
      setConfirmData(null);
    }
  };

  const importTotalAmount = confirmData 
    ? (Number(confirmData.quantity) || 0) * (Number(confirmData.unitPrice) || 0)
    : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Nhập Kho</h2>
      </div>
      <div className="page-content" style={{ background: 'none', boxShadow: 'none' }}>
        <StockForm 
          type="IN" 
          onSubmit={handleImportSubmit}
          isLoading={isLoading}
          initialProductId={initialProductId}
        />
      </div>

      <ConfirmDialog 
        isOpen={!!confirmData}
        title="Xác nhận Nhập Kho"
        message={`Bạn đang chuẩn bị nhập ${confirmData?.quantity} sản phẩm với đơn giá ${formatCurrency(confirmData?.unitPrice)}. Tổng tiền nhập: ${formatCurrency(importTotalAmount)}. Sau khi nhập, hệ thống sẽ cập nhật lại tồn kho và ghi nhận vào lịch sử. Bạn có chắc chắn?`}
        onConfirm={executeImport}
        onCancel={() => setConfirmData(null)}
      />
    </div>
  );
};

export default ImportPage;
