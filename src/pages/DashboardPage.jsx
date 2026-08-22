import { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppDataContext } from '../context/AppDataContext';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { formatCurrency } from '../utils/formatCurrency';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { subDays, isAfter, isBefore } from 'date-fns';
import './DashboardPage.css';

const DashboardPage = () => {
  const { products, loadingInitial } = useContext(AppDataContext);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, txRes] = await Promise.all([
          orderApi.getAll(),
          inventoryApi.getAllTransactions(),
        ]);
        setOrders(ordersRes.data);
        setTransactions(txRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchData();
  }, []);

  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);

  const totalActiveProducts = activeProducts.length;

  const totalInventoryValue = useMemo(() => {
    return activeProducts.reduce((sum, p) => sum + (p.stockQuantity * p.costPrice), 0);
  }, [activeProducts]);

  const lowStockProducts = useMemo(() => {
    return activeProducts
      .filter(p => p.stockQuantity <= p.minStockAlert && p.stockQuantity > 0)
      .sort((a, b) => a.stockQuantity - b.stockQuantity);
  }, [activeProducts]);

  const revenue7Days = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return orders
      .filter(o => o.status === 'completed' && isAfter(new Date(o.createdAt), sevenDaysAgo))
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  const topSellingProducts = useMemo(() => {
    const salesCount = {};
    orders.filter(o => o.status === 'completed').forEach(order => {
      order.items.forEach(item => {
        if (!salesCount[item.productId]) {
          salesCount[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
        }
        salesCount[item.productId].qty += item.quantity;
        salesCount[item.productId].revenue += item.quantity * item.price;
      });
    });

    return Object.values(salesCount)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [orders]);

  const completedOrders7DaysCount = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return orders.filter(o => o.status === 'completed' && isAfter(new Date(o.createdAt), sevenDaysAgo)).length;
  }, [orders]);

  // ── Trend metrics ────────────────────────────────────────────────────────────

  // Card 1: sản phẩm active được tạo trong 24h gần nhất
  const newProductsLast24h = useMemo(() => {
    const oneDayAgo = subDays(new Date(), 1);
    return activeProducts.filter(p => isAfter(new Date(p.createdAt), oneDayAgo)).length;
  }, [activeProducts]);

  // Card 2: thay đổi giá trị tồn kho trong 7 ngày qua (IN - OUT) × unitPrice
  const inventoryValueChange7Days = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return transactions
      .filter(tx => isAfter(new Date(tx.createdAt), sevenDaysAgo))
      .reduce((sum, tx) => {
        const val = tx.quantity * (tx.unitPrice || 0);
        return tx.type === 'IN' ? sum + val : sum - val;
      }, 0);
  }, [transactions]);

  // Card 2: % thay đổi so với giá trị tồn kho tại điểm 7 ngày trước
  const inventoryValueChangePercent = useMemo(() => {
    // Ước tính giá trị tồn kho 7 ngày trước = hiện tại - delta
    const baseValue = totalInventoryValue - inventoryValueChange7Days;
    if (baseValue === 0) return null;
    return (inventoryValueChange7Days / Math.abs(baseValue)) * 100;
  }, [totalInventoryValue, inventoryValueChange7Days]);

  // Card 3: doanh thu completed orders trong 7 ngày TRƯỚC khoảng hiện tại (ngày -14 đến -7)
  const revenuePrev7Days = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const fourteenDaysAgo = subDays(new Date(), 14);
    return orders
      .filter(o =>
        o.status === 'completed' &&
        isAfter(new Date(o.createdAt), fourteenDaysAgo) &&
        isBefore(new Date(o.createdAt), sevenDaysAgo)
      )
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  // Card 3: % thay đổi doanh thu tuần này so với tuần trước
  const revenueChangePercent = useMemo(() => {
    if (revenuePrev7Days === 0) return null;
    return ((revenue7Days - revenuePrev7Days) / revenuePrev7Days) * 100;
  }, [revenue7Days, revenuePrev7Days]);

  // Card 4: số đơn completed trong khoảng ngày -14 đến -7
  const completedOrdersPrev7DaysCount = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const fourteenDaysAgo = subDays(new Date(), 14);
    return orders.filter(o =>
      o.status === 'completed' &&
      isAfter(new Date(o.createdAt), fourteenDaysAgo) &&
      isBefore(new Date(o.createdAt), sevenDaysAgo)
    ).length;
  }, [orders]);

  // Card 4: chênh lệch số đơn tuần này - tuần trước
  const ordersChangeCount = useMemo(
    () => completedOrders7DaysCount - completedOrdersPrev7DaysCount,
    [completedOrders7DaysCount, completedOrdersPrev7DaysCount]
  );

  // Hàm format text xu hướng, trả về { text, up: boolean | null }
  const formatTrend = (value, { isPercent = false, suffix = '' } = {}) => {
    if (value === null || value === undefined) {
      return { text: 'Chưa đủ dữ liệu so sánh', up: null };
    }
    const rounded = isPercent ? Math.round(value * 10) / 10 : Math.round(value);
    const sign = rounded > 0 ? '+' : '';
    const text = `${sign}${rounded}${isPercent ? '%' : ''}${suffix ? ' ' + suffix : ''}`;
    return { text, up: rounded >= 0 };
  };

  if (loadingInitial || loadingOrders) return <LoadingSpinner />;


  return (
    <div className="page-container dashboard-container">
      <div className="page-header">
        <div>
          <h2>Tổng Quan (Dashboard)</h2>
          <p className="page-subtitle">Thống kê hoạt động kinh doanh và tồn kho cửa hàng</p>
        </div>
      </div>

      <div className="dashboard-cards-4">
        {/* Card 1: Sản phẩm đang bán */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Sản phẩm đang bán</span>
            <div className="stat-icon-wrapper icon-emerald">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
          </div>
          <div className="stat-value">{totalActiveProducts}</div>
          {(() => {
            const t1 = formatTrend(newProductsLast24h, { suffix: 'so với hôm qua' });
            const cls1 = t1.up === true ? 'trend-up' : t1.up === false ? 'trend-down' : 'trend-neutral';
            return (
              <div className={`stat-trend ${cls1}`}>
                <span className="trend-text">{t1.text}</span>
              </div>
            );
          })()}
        </div>

        {/* Card 2: Tổng giá trị tồn kho */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Tổng giá trị tồn kho</span>
            <div className="stat-icon-wrapper icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
            </div>
          </div>
          <div className="stat-value font-mono">{formatCurrency(totalInventoryValue)}</div>
          {(() => {
            const t2 = formatTrend(inventoryValueChangePercent, { isPercent: true, suffix: 'so với 7 ngày trước' });
            const cls2 = t2.up === true ? 'trend-up' : t2.up === false ? 'trend-down' : 'trend-neutral';
            return (
              <div className={`stat-trend ${cls2}`}>
                <span className="trend-text">{t2.text}</span>
              </div>
            );
          })()}
        </div>

        {/* Card 3: Doanh thu 7 ngày */}
        <div className="stat-card stat-card-featured">
          <div className="stat-header">
            <span className="stat-title">Doanh thu 7 ngày</span>
            <div className="stat-icon-wrapper icon-emerald-filled">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>

                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="stat-value font-mono text-ledger">{formatCurrency(revenue7Days)}</div>
          {(() => {
            const t3 = formatTrend(revenueChangePercent, { isPercent: true, suffix: 'so với tuần trước' });
            const cls3 = t3.up === true ? 'trend-up' : t3.up === false ? 'trend-down' : 'trend-neutral';
            return (
              <div className={`stat-trend ${cls3}`}>
                <span className="trend-text">{t3.text}</span>
              </div>
            );
          })()}
        </div>

        {/* Card 4: Đơn hàng 7 ngày */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Đơn hàng 7 ngày</span>
            <div className="stat-icon-wrapper icon-amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
          </div>
          <div className="stat-value">{completedOrders7DaysCount}</div>
          {(() => {
            const t4 = formatTrend(ordersChangeCount, { suffix: 'so với tuần trước' });
            const cls4 = t4.up === true ? 'trend-up' : t4.up === false ? 'trend-down' : 'trend-neutral';
            return (
              <div className={`stat-trend ${cls4}`}>
                <span className="trend-text">{t4.text}</span>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="dashboard-tables">
        {/* Table 1: Sản phẩm sắp hết hàng */}
        <div className="dashboard-table-card">
          <div className="table-card-header">
            <h3>Sản phẩm sắp hết hàng</h3>
            <span className="table-card-subtitle">(Tồn kho ≤ mức cảnh báo)</span>
          </div>

          {lowStockProducts.length === 0 ? (
            <p className="empty-text">Không có sản phẩm nào sắp hết hàng.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="text-center">Tồn kho</th>
                    <th className="text-center">Cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.slice(0, 5).map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-center font-mono">{p.stockQuantity}</td>
                      <td className="text-center">
                        <span className="badge-warning-custom">Sắp hết</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="table-card-footer">
            <button className="btn-link" onClick={() => navigate('/import')}>
              <span>Xem tất cả</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>

        {/* Table 2: Top 5 sản phẩm bán chạy */}
        <div className="dashboard-table-card">
          <div className="table-card-header">
            <h3>Top 5 sản phẩm bán chạy</h3>
            <span className="table-card-subtitle">(Theo số lượng đã bán)</span>
          </div>

          {topSellingProducts.length === 0 ? (
            <p className="empty-text">Chưa có dữ liệu bán hàng.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="text-center">Đã bán</th>
                    <th className="text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingProducts.map((p, idx) => (
                    <tr key={idx}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-center font-mono font-bold text-ledger">{p.qty}</td>
                      <td className="text-right font-mono">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="table-card-footer">
            <button className="btn-link" onClick={() => navigate('/sales')}>
              <span>Xem tất cả</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
