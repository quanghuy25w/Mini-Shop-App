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
    const rollbackSteps = [];
    const orderCode = cancellingOrder.code;
    let isSuccess = false;

    try {
      for (const item of cancellingOrder.items) {
        const dbProduct = products.find(p => p.id === item.productId);
        const previousStock = dbProduct ? dbProduct.stockQuantity : 0;

        const txData = {
          id: generateId(),
          productId: item.productId,
          type: "IN",
          quantity: item.quantity,
          unitPrice: item.price,
          note: `Hoàn kho - hủy ${cancellingOrder.code}`,
          createdAt: new Date().toISOString()
        };
        const txRes = await inventoryApi.createTransaction(txData);
        const createdTx = txRes.data;

        if (dbProduct) {
          const newStock = previousStock + item.quantity;
          await productApi.patch(item.productId, { stockQuantity: newStock });
        }

        rollbackSteps.push({
          productId: item.productId,
          transactionId: createdTx.id,
          previousStock,
          hasProduct: Boolean(dbProduct)
        });
      }

      await orderApi.updateStatus(cancellingOrder.id, "cancelled");
      isSuccess = true;
    } catch (error) {
      console.error("Lỗi khi hủy đơn hàng, bắt đầu rollback...", error);
      for (const step of rollbackSteps) {
        try {
          if (step.hasProduct) {
            await productApi.patch(step.productId, { stockQuantity: step.previousStock });
          }
          await inventoryApi.removeTransaction(step.transactionId);
        } catch (rollbackErr) {
          console.error(`Rollback thất bại cho sản phẩm ${step.productId}:`, rollbackErr);
        }
      }
      toast.error("Lỗi khi hủy đơn hàng. Vui lòng thử lại!");
    } finally {
      setIsCancelConfirmOpen(false);
      setCancellingOrder(null);
    }

    if (isSuccess) {
      toast.success(`Đã hủy đơn hàng ${orderCode} và hoàn trả kho.`);
      try {
        await refreshProducts();
        fetchData();
      } catch (postErr) {
        console.error("Lỗi khi làm mới dữ liệu sau hủy đơn:", postErr);
      }
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

  const handleResetFilters = () => {
    setFilterProductId('');
    setFilterType('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Lịch sử giao dịch và đơn hàng</h2>
          <p className="page-subtitle">Theo dõi chi tiết biến động nhập/xuất kho và lịch sử bán hàng</p>
        </div>
        <button className="btn-secondary" onClick={handleExportCSV}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Xuất báo cáo CSV</span>
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="12 8 12 12 14 14"></polyline>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
          </svg>
          <span>Giao dịch nhập/Xuất kho</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span>Đơn hàng Bán (Sales)</span>
        </button>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        {activeTab === 'inventory' && (
          <div className="inventory-tab">
            <div className="filter-bar">
              <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)} className="filter-select">
                <option value="">Tất cả sản phẩm</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="filter-select">
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
              <button className="btn-reset" onClick={handleResetFilters}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span>Làm mới</span>
              </button>
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
                          <td className="font-mono text-muted">{format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                          <td className="font-medium">{getProductName(tx.productId)}</td>
                          <td className="text-center">
                            {tx.type === 'IN' ? (
                              <span className="badge-status badge-in">IN</span>
                            ) : (
                              <span className="badge-status badge-out">OUT</span>
                            )}
                          </td>
                          <td className="text-center font-mono font-bold">{tx.quantity}</td>
                          <td className="text-right font-mono">{formatCurrency(tx.unitPrice)}</td>
                          <td className="font-mono text-muted">{tx.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="table-footer-info">
                    <span>Hiển thị 1 - {filteredTransactions.length} của {transactions.length} bản ghi</span>
                  </div>
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
                          <td><strong className="font-mono">{order.code}</strong></td>
                          <td className="font-mono text-muted">{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                          <td>
                            <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', color: 'var(--ink-soft)' }}>
                              {order.items.map((item, idx) => (
                                <li key={idx}><strong>{item.productName}</strong> (x{item.quantity})</li>
                              ))}
                            </ul>
                          </td>
                          <td className="text-right font-mono font-bold text-ledger">
                            {formatCurrency(order.totalAmount)}
                          </td>
                          <td className="text-center">
                            {order.status === 'completed' ? (
                              <span className="badge-status badge-in">Thành công</span>
                            ) : (
                              <span className="badge-status badge-out">Đã hủy</span>
                            )}
                          </td>
                          <td className="text-center">
                            {order.status === 'completed' && (
                              <button
                                className="btn-cancel-order"
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

                  <div className="table-footer-info">
                    <span>Hiển thị {orders.length} hóa đơn bán hàng</span>
                  </div>
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
