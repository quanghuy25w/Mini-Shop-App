import React, { useState } from 'react';
import StockForm from '../components/inventory/StockForm';
import { useInventory } from '../hooks/useInventory';
import { toast } from 'react-toastify';

const ImportPage = () => {
  const { importStock } = useInventory();
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async (data) => {
    setIsLoading(true);
    try {
      await importStock(data.productId, data.quantity, data.unitPrice, data.note);
      toast.success('Nhập kho thành công!');
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
        <h2>Nhập Kho</h2>
      </div>
      <div className="page-content" style={{ background: 'none', boxShadow: 'none' }}>
        <StockForm 
          type="IN" 
          onSubmit={handleImport}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default ImportPage;
