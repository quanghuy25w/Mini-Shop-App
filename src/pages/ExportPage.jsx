import React, { useState } from 'react';
import StockForm from '../components/inventory/StockForm';
import { useInventory } from '../hooks/useInventory';
import { toast } from 'react-toastify';

const ExportPage = () => {
  const { exportStock } = useInventory();
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async (data) => {
    setIsLoading(true);
    try {
      await exportStock(data.productId, data.quantity, data.note);
      toast.success('Xuất kho thành công!');
      setIsLoading(false);
      return Promise.resolve();
    } catch (error) {
      toast.error(error.message);
      setIsLoading(false);
      return Promise.reject(error);
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
          onSubmit={handleExport}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default ExportPage;
