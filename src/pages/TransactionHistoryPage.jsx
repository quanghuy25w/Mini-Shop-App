import React, { useState, useEffect, useContext, useMemo } from 'react';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { AppDataContext } from '../context/AppDataContext';
import { formatCurrency } from '../utils/formatCurrency';
import { format } from 'date-fns';
import { generateId } from '../utils/generateId';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { exportToCSV } from '../utils/exportCSV';
import './TransactionHistoryPage.css';

const TransactionHistoryPage = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { products, refreshProducts } = useContext(AppDataContext);
  
  // Filters for inventory
  const [filterProductId, setFilterProductId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Cancel order state
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'orders') {
        const res = await orderApi.getAll();
        const sorted = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(sorted);
      } else {
        const res = await inventoryApi.getAllTransactions();
        const sorted = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setTransactions(sorted);
      }
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      let matchProduct = true;
      let matchType = true;
      let matchDateFrom = true;
      let matchDateTo = true;

      if (filterProductId) matchProduct = tx.productId === filterProductId;
      if (filterType) matchType = tx.type === filterType;
      
      const txDate = new Date(tx.createdAt);
      if (dateFrom) matchDateFrom = txDate >= new Date(dateFrom);
      if (dateTo) matchDateTo = txDate <= new Date(dateTo + 'T23:59:59');

      return matchProduct && matchType && matchDateFrom && matchDateTo;
    });
  }, [transactions, filterProductId, filterType, dateFrom, dateTo]);

  const getProductName = (id) => {
    const p = products.find(prod => prod.id === id);
    return p ? p.name : 'Sản phẩm đã bị xóa/Không rõ';
  };

  const handleCancelClick = (order) => {
    setCancellingOrder(order);
    setIsCancelConfirmOpen(true);
  };

  const executeCancelOrder = async () => {
    if (!cancellingOrder) return;
    try {
      await orderApi.updateStatus(cancellingOrder.id, "cancelled");
      for (const item of cancellingOrder.items) {
        const txData = {
          id: generateId(),
          productId: item.productId,
          type: "IN",
          quantity: item.quantity,
          unitPrice: item.price,
          note: `Hoàn kho - hủy ${cancellingOrder.code}`,
          createdAt: new Date().toISOString()
        };
        await inventoryApi.createTransaction(txData);
        const dbProduct = products.find(p => p.id === item.productId);
        if (dbProduct) {
           const newStock = dbProduct.stockQuantity + item.quantity;
           await productApi.patch(item.productId, { stockQuantity: newStock });
        }
      }
      toast.success(`Đã hủy đơn hàng ${cancellingOrder.code} và hoàn trả kho.`);
      await refreshProducts(); 
      fetchData(); 
    } catch (error) {
      toast.error("Lỗi khi hủy đơn hàng. Vui lòng thử lại!");
    } finally {
      setIsCancelConfirmOpen(false);
      setCancellingOrder(null);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'inventory') {
      const data = filteredTransactions.map(tx => ({
        'Thời gian': format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm'),
        'Sản phẩm': getProductName(tx.productId),
        'Loại giao dịch': tx.type === 'IN' ? 'Nhập kho' : 'Xuất kho',
        'Số lượng': tx.quantity,
        'Đơn giá': tx.unitPrice,
        'Ghi chú': tx.note
      }));
      exportToCSV(data, 'Lich_Su_Giao_Dich_Kho.csv');
    } else {
      const data = orders.map(o => ({
        'Mã HĐ': o.code,
        'Thời gian': format(new Date(o.createdAt), 'dd/MM/yyyy HH:mm'),
        'Sản phẩm': o.items.map(i => `${i.productName} (x${i.quantity})`).join('; '),
        'Tổng tiền': o.totalAmount,
        'Trạng thái': o.status === 'completed' ? 'Thành công' : 'Đã hủy'
      }));
      exportToCSV(data, 'Lich_Su_Don_Hang.csv');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Lịch sử Giao dịch & Đơn hàng</h2>
        <button className="btn-secondary" style={{ padding: '10px 20px', border: '1px solid #3498db', background: 'white', color: '#3498db', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }} onClick={handleExportCSV}>
          Xuất báo cáo CSV
        </button>
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Giao dịch Nhập/Xuất kho
        </button>
        <button 
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Đơn hàng (Sales)
        </button>
      </div>

      <div className="page-content" style={{ borderTopLeftRadius: 0 }}>
        {activeTab === 'inventory' && (
          <div className="inventory-tab">
            <div className="filter-bar">
              <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}>
                <option value="">Tất cả sản phẩm</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">Tất cả loại giao dịch</option>
                <option value="IN">Nhập kho (IN)</option>
                <option value="OUT">Xuất kho (OUT)</option>
              </select>
              <div className="date-filter">
                <label>Từ ngày:</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="date-filter">
                <label>Đến ngày:</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>

            {loading ? <LoadingSpinner /> : (
              filteredTransactions.length === 0 ? (
                <EmptyState message="Không có giao dịch nào phù hợp với bộ lọc." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th width="15%">Thời gian</th>
                        <th width="25%">Sản phẩm</th>
                        <th width="10%" className="text-center">Loại</th>
                        <th width="10%" className="text-center">Số lượng</th>
                        <th width="15%" className="text-right">Đơn giá</th>
                        <th width="25%">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map(tx => (
                        <tr key={tx.id}>
                          <td className="font-mono">{format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                          <td>{getProductName(tx.productId)}</td>
                          <td className="text-center">
                            {tx.type === 'IN' ? (
                              <span className="badge badge-success">IN</span>
                            ) : (
                              <span className="badge badge-danger">OUT</span>
                            )}
                          </td>
                          <td className="text-center font-mono">{tx.quantity}</td>
                          <td className="text-right font-mono">{formatCurrency(tx.unitPrice)}</td>
                          <td className="font-mono">{tx.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="orders-tab">
            {loading ? <LoadingSpinner /> : (
              orders.length === 0 ? (
                <EmptyState message="Chưa có giao dịch bán hàng nào." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mã HĐ</th>
                        <th>Thời gian</th>
                        <th>Sản phẩm</th>
                        <th className="text-right">Tổng tiền</th>
                        <th className="text-center">Trạng thái</th>
                        <th className="text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id}>
                          <td><strong>{order.code}</strong></td>
                          <td>{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                          <td>
                            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px' }}>
                              {order.items.map((item, idx) => (
                                <li key={idx}>{item.productName} (x{item.quantity})</li>
                              ))}
                            </ul>
                          </td>
                          <td className="text-right font-medium" style={{ color: '#e74c3c' }}>
                            {formatCurrency(order.totalAmount)}
                          </td>
                          <td className="text-center">
                            {order.status === 'completed' ? (
                              <span className="badge badge-success">Thành công</span>
                            ) : (
                              <span className="badge badge-danger">Đã hủy</span>
                            )}
                          </td>
                          <td className="text-center">
                            {order.status === 'completed' && (
                              <button 
                                className="btn-primary" 
                                style={{ background: '#e74c3c', fontSize: '13px', padding: '6px 12px' }}
                                onClick={() => handleCancelClick(order)}
                              >
                                Hủy đơn
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <ConfirmDialog 
        isOpen={isCancelConfirmOpen}
        title="Xác nhận Hủy Đơn"
        message={`Bạn có chắc chắn muốn hủy đơn ${cancellingOrder?.code}? Quá trình này sẽ hoàn trả số lượng vào kho và ghi lại lịch sử giao dịch.`}
        onConfirm={executeCancelOrder}
        onCancel={() => setIsCancelConfirmOpen(false)}
      />
    </div>
  );
};

export default TransactionHistoryPage;
