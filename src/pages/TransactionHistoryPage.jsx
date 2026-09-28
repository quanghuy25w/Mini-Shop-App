import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { workSessionApi } from '../api/workSessionApi';
import { AppDataContext } from '../context/AppDataContext';
import { useAuth } from '../hooks/useAuth';
import { useWorkSession } from '../hooks/useWorkSession';
import { formatCurrency } from '../utils/formatCurrency';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { exportToCSV } from '../utils/exportCSV';
import { getBusinessDate } from '../utils/businessDate';
import './TransactionHistoryPage.css';

const TransactionHistoryPage = () => {
  const [activeTab, setActiveTab] = useState('inventory');

  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [workSessions, setWorkSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const { products, refreshProducts } = useContext(AppDataContext);
  const { currentUser, isAdmin, can } = useAuth();
  const { currentSession, currentMember, isCheckedIn } = useWorkSession();

  const canViewAll = isAdmin || can('transaction.view_all');

  // Filters for inventory
  const [filterProductId, setFilterProductId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Cancel order state
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [accRes, staffRes, wsRes] = await Promise.all([
        accountApi.getAll(),
        staffApi.getAll(),
        workSessionApi.getAll()
      ]);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      setWorkSessions(Array.isArray(wsRes.data) ? wsRes.data : []);

      if (activeTab === 'orders') {
        const res = await orderApi.getAll();
        const sorted = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(sorted);
      } else {
        const res = await inventoryApi.getAllTransactions();
        const sorted = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setTransactions(sorted);
      }
    } catch {
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    let ignore = false;
    const runFetch = async () => {
      if (!ignore) {
        await fetchData();
      }
    };
    runFetch();
    return () => {
      ignore = true;
    };
  }, [fetchData]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      let matchProduct = true;
      let matchType = true;
      let matchDateFrom = true;
      let matchDateTo = true;
      let matchOwner = canViewAll || tx.accountId === currentUser?.id;

      if (filterProductId) matchProduct = tx.productId === filterProductId;
      if (filterType) matchType = tx.type === filterType;

      const txDate = new Date(tx.createdAt);
      if (dateFrom) matchDateFrom = txDate >= new Date(dateFrom);
      if (dateTo) matchDateTo = txDate <= new Date(dateTo + 'T23:59:59');

      return matchProduct && matchType && matchDateFrom && matchDateTo && matchOwner;
    });
  }, [transactions, filterProductId, filterType, dateFrom, dateTo, canViewAll, currentUser]);

  const visibleOrders = useMemo(() => {
    return canViewAll ? orders : orders.filter(o => o.accountId === currentUser?.id);
  }, [orders, canViewAll, currentUser]);

  const getProductName = (id) => {
    const p = products.find(prod => prod.id === id);
    return p ? p.name : 'Sản phẩm đã bị xóa/Không rõ';
  };

  const getAccountDisplayName = (accountId) => {
    if (!accountId) return '-';
    const acc = accounts.find(a => String(a.id) === String(accountId));
    if (!acc) return accountId;
    if (acc.role === 'admin') {
      return acc.email ? `Admin (${acc.email})` : 'Quản trị viên';
    }
    const staff = staffList.find(s => String(s.id) === String(acc.employeeId));
    return staff ? `${staff.name} (${staff.employeeCode})` : 'Nhân viên';
  };

  const getSessionCode = (workSessionId) => {
    if (!workSessionId) return '-';
    const sess = workSessions.find(s => String(s.id) === String(workSessionId));
    return sess ? sess.code : workSessionId;
  };

  const canActorCancelOrder = useCallback((order) => {
    if (!order || order.status !== 'completed') return false;
    if (isAdmin) return true;

    if (currentUser?.role === 'staff' || can('order.cancel_management')) {
      const orderBizDate = order.businessDate || (order.createdAt ? getBusinessDate(order.createdAt) : null);
      return orderBizDate === getBusinessDate();
    }

    // Employee rules: only own orders in current active session within 15 minutes
    if (order.accountId !== currentUser?.id && order.createdBy !== currentUser?.id) return false;
    if (!currentSession?.id || order.workSessionId !== currentSession.id) return false;

    const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    if (!createdMs || (Date.now() - createdMs) > 15 * 60 * 1000) return false;

    return true;
  }, [isAdmin, currentUser, can, currentSession]);

  const handleCancelClick = useCallback((order) => {
    if (!canActorCancelOrder(order)) {
      if (currentUser?.role === 'employee') {
        if (order.accountId !== currentUser?.id && order.createdBy !== currentUser?.id) {
          toast.error('Bạn chỉ được hủy đơn hàng do chính mình tạo.');
          return;
        }
        if (!currentSession?.id || order.workSessionId !== currentSession.id) {
          toast.error('Bạn chỉ được hủy đơn hàng thuộc ca làm việc hiện tại.');
          return;
        }
      }
      toast.error('Bạn không có quyền hủy đơn hàng này.');
      return;
    }

    if (currentUser?.role === 'employee' && !isAdmin) {
      const nowMs = Date.now();
      const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : 0;
      if (createdMs && (nowMs - createdMs) > 15 * 60 * 1000) {
        toast.error('Đã quá 15 phút kể từ lúc tạo đơn, không thể tự hủy. Vui lòng liên hệ Quản trị viên.');
        return;
      }
    }

    setCancelReason('');
    setCancellingOrder(order);
    setIsCancelConfirmOpen(true);
  }, [canActorCancelOrder, currentUser, currentSession, isAdmin]);

  const executeCancelOrder = async () => {
    if (!cancellingOrder) return;

    // 1. Pre-flight Guard: Bắt buộc người hủy đơn phải đăng nhập và đang check-in vào ca active
    if (!currentUser?.id) {
      toast.error('Vui lòng đăng nhập để thực hiện hủy đơn hàng.');
      setIsCancelConfirmOpen(false);
      setCancellingOrder(null);
      return;
    }

    const isManager = currentUser?.role === 'admin' || currentUser?.role === 'staff';
    const isNotCheckedIn = isManager
      ? (!isCheckedIn || !currentSession?.id || currentSession?.status !== 'active')
      : (!isCheckedIn || !currentSession?.id || currentMember?.attendanceStatus !== 'present');

    if (isNotCheckedIn) {
      toast.error('Bạn chưa check-in vào ca làm việc nào. Vui lòng check-in trước khi hủy đơn hàng.');
      setIsCancelConfirmOpen(false);
      setCancellingOrder(null);
      return;
    }

    const orderCode = cancellingOrder.code;

    try {
      await orderApi.cancelAndRestock(cancellingOrder.id, {
        actor: currentUser,
        reason: cancelReason,
        currentSessionId: currentSession?.id,
      });

      toast.success(`Đã hủy đơn hàng ${orderCode} và hoàn trả kho.`);
      await refreshProducts();
      fetchData();
    } catch (error) {
      const messages = {
        NOT_OWN_ORDER: 'Bạn chỉ được hủy đơn hàng do chính mình tạo.',
        NOT_CURRENT_SESSION: 'Bạn chỉ được hủy đơn hàng thuộc ca làm việc hiện tại.',
        CANCEL_WINDOW_EXPIRED: 'Đã quá 15 phút kể từ lúc tạo đơn, không thể tự hủy.',
        REASON_REQUIRED: 'Vui lòng nhập lý do hủy đơn.',
        STAFF_SAME_DAY_ONLY: 'Quản lý chỉ được hủy đơn hàng trong ngày làm việc hiện tại.',
        ORDER_ALREADY_CANCELLED: 'Đơn hàng này đã được hủy trước đó.',
      };
      toast.error(messages[error?.code] || error.message || "Lỗi khi hủy đơn hàng. Vui lòng thử lại!");
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
        'Người thực hiện': getAccountDisplayName(tx.accountId),
        'Ca làm việc': getSessionCode(tx.workSessionId),
        'Ghi chú': tx.note
      }));
      exportToCSV(data, 'Lich_Su_Giao_Dich_Kho.csv');
    } else {
      const data = visibleOrders.map(o => ({
        'Mã HĐ': o.code,
        'Thời gian': format(new Date(o.createdAt), 'dd/MM/yyyy HH:mm'),
        'Sản phẩm': o.items.map(i => `${i.productName} (x${i.quantity})`).join('; '),
        'Người bán': getAccountDisplayName(o.accountId),
        'Ca làm việc': getSessionCode(o.workSessionId),
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

  const cancellingOrderSession = cancellingOrder
    ? workSessions.find(ws => ws.id === cancellingOrder.workSessionId)
    : null;
  const isCancellingClosedSession = isAdmin && cancellingOrderSession?.status === 'closed';

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
          onClick={() => {
            if (activeTab !== 'inventory') {
              setLoading(true);
              setActiveTab('inventory');
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="12 8 12 12 14 14"></polyline>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
          </svg>
          <span>Giao dịch nhập/Xuất kho</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => {
            if (activeTab !== 'orders') {
              setLoading(true);
              setActiveTab('orders');
            }
          }}
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
                        <th width="13%">Thời gian</th>
                        <th width="20%">Sản phẩm</th>
                        <th width="8%" className="text-center">Loại</th>
                        <th width="8%" className="text-center">Số lượng</th>
                        <th width="12%" className="text-right">Đơn giá</th>
                        <th width="15%">Người thực hiện</th>
                        <th width="10%">Ca làm việc</th>
                        <th width="14%">Ghi chú</th>
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
                          <td style={{ fontSize: '13px', fontWeight: 500 }}>{getAccountDisplayName(tx.accountId)}</td>
                          <td>
                            <span className="font-mono text-muted" style={{ fontSize: '12px' }}>{getSessionCode(tx.workSessionId)}</span>
                            {tx.outOfShift && (
                              <span className="badge" style={{ display: 'inline-block', marginLeft: '4px', fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600, padding: '1px 4px' }} title="Giao dịch thực hiện sau giờ kết ca chính thức">
                                Ngoài giờ
                              </span>
                            )}
                          </td>
                          <td className="font-mono text-muted">{tx.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="table-footer-info">
                    Tổng cộng: <strong>{filteredTransactions.length}</strong> giao dịch
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="orders-tab">
            {loading ? <LoadingSpinner /> : (
              visibleOrders.length === 0 ? (
                <EmptyState message="Chưa có giao dịch bán hàng nào." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mã HĐ</th>
                        <th>Thời gian</th>
                        <th>Sản phẩm</th>
                        <th>Người bán</th>
                        <th>Ca làm việc</th>
                        <th className="text-right">Tổng tiền</th>
                        <th className="text-center">Trạng thái</th>
                        <th className="text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map(order => (
                        <tr key={order.id}>
                          <td><strong className="font-mono">{order.code}</strong></td>
                          <td className="font-mono text-muted">{order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') : '---'}</td>
                          <td>
                            <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', color: 'var(--ink-soft)' }}>
                              {(order.items || []).map((item, idx) => (
                                <li key={idx}><strong>{item.productName}</strong> (x{item.quantity})</li>
                              ))}
                            </ul>
                          </td>
                          <td style={{ fontSize: '13px', fontWeight: 500 }}>{getAccountDisplayName(order.accountId)}</td>
                          <td>
                            <span className="font-mono text-muted" style={{ fontSize: '12px' }}>{getSessionCode(order.workSessionId)}</span>
                            {order.outOfShift && (
                              <span className="badge" style={{ display: 'inline-block', marginLeft: '4px', fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600, padding: '1px 4px' }} title="Đơn hàng bán sau giờ kết ca chính thức">
                                Ngoài giờ
                              </span>
                            )}
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
                            {order.status === 'completed' && canActorCancelOrder(order) && (
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
                    <span>Hiển thị {visibleOrders.length} hóa đơn bán hàng</span>
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
      >
        {(isCancellingClosedSession || (isAdmin && cancellingOrder?.businessDate && cancellingOrder.businessDate !== getBusinessDate())) && (
          <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '13px' }}>
            ⚠️ Đơn này thuộc ca/ngày trước đã đóng ({cancellingOrder?.businessDate || cancellingOrderSession?.date}). Việc hủy đơn sẽ được ghi nhận hoàn kho điều chỉnh vào ngày hôm nay ({getBusinessDate()}).
          </p>
        )}
        <textarea
          placeholder="Nhập lý do hủy đơn (bắt buộc)..."
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={2}
          style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '6px', border: '1px solid var(--line, #ddd)' }}
        />
      </ConfirmDialog>
    </div>
  );
};

export default TransactionHistoryPage;
