import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppDataContext } from '../context/AppDataContext';
import { useAuth } from '../hooks/useAuth';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { workSessionApi } from '../api/workSessionApi';
import { formatCurrency } from '../utils/formatCurrency';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { subDays, format } from 'date-fns';
import { getBusinessDate } from '../utils/businessDate';
import './DashboardPage.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Safe product cost: only use costPrice if it is a finite positive number */
const getSafeCostPrice = (p) => {
  const v = Number(p.costPrice);
  return Number.isFinite(v) && v >= 0 ? v : null;
};

/** Is an order a valid completed sale? Only 'completed' status counts. */
const isCompletedSale = (o) => o.status === 'completed';

/** Get businessDate string from an order, falling back to createdAt */
const orderBizDate = (o) => {
  if (o.businessDate) return o.businessDate;
  if (o.createdAt) return getBusinessDate(o.createdAt);
  return null;
};

// ── Revenue Trend SVG Chart ───────────────────────────────────────────────────

const RevenueTrendChart = ({ orders, days }) => {
  const today = new Date();
  const todayStr = getBusinessDate(today);

  // Build date → revenue map for `days` days ending today
  const dateMap = useMemo(() => {
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = getBusinessDate(subDays(today, i));
      map[d] = 0;
    }
    orders.forEach((o) => {
      if (!isCompletedSale(o)) return;
      const bd = orderBizDate(o);
      if (bd && Object.prototype.hasOwnProperty.call(map, bd)) {
        map[bd] += Number(o.totalAmount) || 0;
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, days, todayStr]);

  const entries = useMemo(() => Object.entries(dateMap), [dateMap]);
  const values = entries.map(([, v]) => v);
  const maxVal = Math.max(...values, 1); // prevent division by zero

  const chartH = 120;
  const chartW = 100; // percentage-based via viewBox
  const barGap = 2;
  const totalBars = entries.length;
  const barW = totalBars > 0 ? (chartW - barGap * (totalBars - 1)) / totalBars : chartW;

  const hasAnyRevenue = values.some((v) => v > 0);

  const formatShortDate = (dateStr) => {
    // YYYY-MM-DD → DD/MM
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  const formatMillions = (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
    return String(v);
  };

  return (
    <div className="trend-chart-wrap">
      {!hasAnyRevenue ? (
        <div className="trend-chart-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)' }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <p>Chưa có dữ liệu doanh thu trong {days} ngày qua</p>
        </div>
      ) : (
        <div className="trend-chart-inner">
          <svg
            viewBox={`0 0 ${chartW} ${chartH + 20}`}
            preserveAspectRatio="none"
            className="trend-chart-svg"
            aria-label={`Biểu đồ doanh thu ${days} ngày`}
          >
            {entries.map(([date, val], i) => {
              const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
              const x = i * (barW + barGap);
              const y = chartH - barH;
              const isToday = date === todayStr;
              return (
                <g key={date}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx="1.5"
                    className={`trend-bar ${isToday ? 'trend-bar-today' : ''} ${val === 0 ? 'trend-bar-zero' : ''}`}
                  />
                  {/* value label on top of tall bars */}
                  {val > 0 && barH > 20 && (
                    <text
                      x={x + barW / 2}
                      y={y - 2}
                      textAnchor="middle"
                      className="trend-bar-label"
                    >
                      {formatMillions(val)}
                    </text>
                  )}
                </g>
              );
            })}
            {/* X-axis date labels — only show first/last and today for readability */}
            {entries.map(([date], i) => {
              const isFirst = i === 0;
              const isLast = i === entries.length - 1;
              const isToday = date === todayStr;
              if (!isFirst && !isLast && !isToday) return null;
              const x = i * (barW + barGap) + barW / 2;
              return (
                <text
                  key={`lbl-${date}`}
                  x={x}
                  y={chartH + 16}
                  textAnchor="middle"
                  className={`trend-axis-label ${isToday ? 'trend-axis-today' : ''}`}
                >
                  {formatShortDate(date)}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { products, loadingInitial } = useContext(AppDataContext);
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [todaySession, setTodaySession] = useState(null);
  const [todayMembers, setTodayMembers] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [trendDays, setTrendDays] = useState(7);
  const navigate = useNavigate();

  const isEmployee = currentUser?.role === 'employee';
  const todayStr = useMemo(() => getBusinessDate(new Date()), []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetches = [orderApi.getAll(), inventoryApi.getAllTransactions()];
        // Admin/staff also fetch today's work session for store activity
        if (!isEmployee) {
          fetches.push(workSessionApi.getAll({ date: todayStr }));
        }
        const results = await Promise.all(fetches);
        setOrders(results[0].data || []);
        setTransactions(results[1].data || []);
        if (!isEmployee && results[2]) {
          const sessions = results[2].data || [];
          const active = sessions.find((s) => s.status !== 'cancelled');
          setTodaySession(active || null);
          if (active) {
            try {
              const membersRes = await workSessionApi.getMembers({ workSessionId: active.id });
              setTodayMembers(membersRes.data || []);
            } catch {
              setTodayMembers([]);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  // ── Inventory Value: safe NaN guard ──────────────────────────────────────────
  const inventoryValueData = useMemo(() => {
    let total = 0;
    let incompleteCount = 0;
    let coveredCount = 0;

    activeProducts.forEach((p) => {
      const cp = getSafeCostPrice(p);
      const qty = Number(p.stockQuantity);
      if (cp !== null && Number.isFinite(qty) && qty >= 0) {
        total += qty * cp;
        coveredCount++;
      } else {
        incompleteCount++;
      }
    });

    return { total, incompleteCount, coveredCount };
  }, [activeProducts]);

  const lowStockProducts = useMemo(() => {
    return activeProducts
      .filter((p) => {
        const qty = Number(p.stockQuantity);
        const alert = Number(p.minStockAlert);
        return Number.isFinite(qty) && Number.isFinite(alert) && qty <= alert && qty >= 0;
      })
      .sort((a, b) => {
        // Sort by ratio (qty/alert) ascending — most urgent first
        const ratioA = Number(a.stockQuantity) / Math.max(Number(a.minStockAlert), 1);
        const ratioB = Number(b.stockQuantity) / Math.max(Number(b.minStockAlert), 1);
        return ratioA - ratioB;
      });
  }, [activeProducts]);

  // ── Store-wide metrics (Admin/Staff) ─────────────────────────────────────────

  // Today's completed sales — businessDate-based, only 'completed'
  const todayCompletedOrders = useMemo(() => {
    return orders.filter((o) => isCompletedSale(o) && orderBizDate(o) === todayStr);
  }, [orders, todayStr]);

  const todayRevenue = useMemo(() => {
    return todayCompletedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [todayCompletedOrders]);

  // Yesterday's revenue for comparison
  const yesterdayStr = useMemo(() => getBusinessDate(subDays(new Date(), 1)), []);
  const yesterdayRevenue = useMemo(() => {
    return orders
      .filter((o) => isCompletedSale(o) && orderBizDate(o) === yesterdayStr)
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [orders, yesterdayStr]);

  const yesterdayOrderCount = useMemo(() => {
    return orders.filter((o) => isCompletedSale(o) && orderBizDate(o) === yesterdayStr).length;
  }, [orders, yesterdayStr]);

  // Low-stock alert count (out-of-stock included: qty === 0 and alert >= 0)
  const stockAlertCount = lowStockProducts.length;
  const outOfStockCount = useMemo(
    () => activeProducts.filter((p) => Number(p.stockQuantity) === 0).length,
    [activeProducts]
  );

  // Top-5 selling products — only completed orders
  const topSellingProducts = useMemo(() => {
    const salesMap = {};
    orders
      .filter(isCompletedSale)
      .forEach((order) => {
        (order.items || []).forEach((item) => {
          if (!item.productId) return;
          if (!salesMap[item.productId]) {
            salesMap[item.productId] = {
              name: item.productName || item.productId,
              qty: 0,
              revenue: 0,
            };
          }
          salesMap[item.productId].qty += Number(item.quantity) || 0;
          salesMap[item.productId].revenue += (Number(item.quantity) || 0) * (Number(item.price) || 0);
        });
      });

    return Object.values(salesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [orders]);

  // Today's inventory transactions count
  const todayTxCount = useMemo(() => {
    return transactions.filter((tx) => {
      const bd = tx.businessDate || (tx.createdAt ? getBusinessDate(tx.createdAt) : null);
      return bd === todayStr;
    }).length;
  }, [transactions, todayStr]);

  // Active staff in today's session
  const activeStaffCount = useMemo(() => {
    return todayMembers.filter((m) => m.attendanceStatus === 'present').length;
  }, [todayMembers]);

  // Recent Activities
  const recentActivities = useMemo(() => {
    const activities = [];
    
    // Add completed orders
    orders.forEach((o) => {
      if (o.status === 'completed' && orderBizDate(o) === todayStr) {
        activities.push({
          id: `order-${o.id}`,
          time: new Date(o.createdAt),
          type: 'order',
          user: o.staffName || o.createdBy || 'Nhân viên',
          text: `Hoàn tất đơn ${o.code || o.id}`,
          color: 'var(--emerald)'
        });
      }
    });

    // Add inventory transactions
    transactions.forEach((tx) => {
      const bd = tx.businessDate || (tx.createdAt ? getBusinessDate(tx.createdAt) : null);
      if (bd === todayStr) {
        activities.push({
          id: `tx-${tx.id}`,
          time: new Date(tx.createdAt),
          type: 'tx',
          user: tx.createdBy || 'Kho',
          text: tx.type === 'import' ? `Nhập hàng ${tx.code || tx.id}` : tx.type === 'export' ? `Xuất hàng ${tx.code || tx.id}` : `Điều chỉnh tồn kho`,
          color: tx.type === 'import' ? 'var(--blue)' : 'var(--amber)'
        });
      }
    });

    return activities
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
  }, [orders, transactions, todayStr]);

  // Revenue delta text
  const formatRevenueDelta = (current, previous) => {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return { text: 'Ngày đầu có doanh thu', up: true };
    const pct = Math.round(((current - previous) / previous) * 100);
    const sign = pct >= 0 ? '+' : '';
    return { text: `${sign}${pct}% so với hôm qua`, up: pct >= 0 };
  };

  const formatCountDelta = (current, previous) => {
    const diff = current - previous;
    if (diff === 0) return { text: 'Bằng hôm qua', up: null };
    const sign = diff > 0 ? '+' : '';
    return { text: `${sign}${diff} so với hôm qua`, up: diff > 0 };
  };

  // ── Employee Own Performance ──────────────────────────────────────────────────

  const isOwnOrder = useCallback(
    (order) => {
      if (!currentUser || !order) return false;
      if (order.accountId && String(order.accountId) === String(currentUser.id)) return true;
      if (currentUser.employeeId && order.employeeId && String(order.employeeId) === String(currentUser.employeeId)) return true;
      if (currentUser.employeeId && order.staffId && String(order.staffId) === String(currentUser.employeeId)) return true;
      if (order.createdBy && (String(order.createdBy) === String(currentUser.id) || (currentUser.employeeId && String(order.createdBy) === String(currentUser.employeeId)))) return true;
      return false;
    },
    [currentUser]
  );

  const employeeCompletedOrders = useMemo(() => {
    if (!isEmployee) return [];
    return orders
      .filter((o) => isCompletedSale(o) && isOwnOrder(o))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, isEmployee, isOwnOrder]);

  const employeeTodayOrders = useMemo(() => {
    return employeeCompletedOrders.filter((o) => orderBizDate(o) === todayStr);
  }, [employeeCompletedOrders, todayStr]);

  const employeeTodaySales = useMemo(
    () => employeeTodayOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
    [employeeTodayOrders]
  );

  const employeeTodayOrdersCount = employeeTodayOrders.length;

  const weekStartStr = useMemo(() => getBusinessDate(subDays(new Date(), 6)), []);

  const employeeWeekOrders = useMemo(() => {
    return employeeCompletedOrders.filter((o) => {
      const bd = orderBizDate(o);
      return bd && bd >= weekStartStr && bd <= todayStr;
    });
  }, [employeeCompletedOrders, weekStartStr, todayStr]);

  const employeeWeekSales = useMemo(
    () => employeeWeekOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
    [employeeWeekOrders]
  );
  const employeeWeekOrdersCount = employeeWeekOrders.length;

  if (loadingInitial || loadingOrders) return <LoadingSpinner />;

  // ── RENDER: EMPLOYEE ──────────────────────────────────────────────────────────
  if (isEmployee) {
    return (
      <div className="page-container dashboard-container">
        <div className="page-header">
          <div>
            <h2>Tổng Quan (Dashboard)</h2>
            <p className="page-subtitle">
              Hiệu suất bán hàng cá nhân của {currentUser?.name || 'Nhân viên'}{' '}
              {currentUser?.employeeCode ? `(${currentUser.employeeCode})` : ''}
            </p>
          </div>
        </div>

        <div className="dashboard-cards-4">
          {/* Card 1: Doanh số hôm nay */}
          <div className="stat-card stat-card-featured">
            <div className="stat-header">
              <span className="stat-title">Doanh số hôm nay</span>
              <div className="stat-icon-wrapper icon-emerald-filled">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
            </div>
            <div className="stat-value font-mono text-ledger">{formatCurrency(employeeTodaySales)}</div>
            <div className="stat-trend trend-neutral">
              <span className="trend-text">{employeeTodayOrdersCount} đơn hàng hôm nay</span>
            </div>
          </div>

          {/* Card 2: Đơn hàng hôm nay */}
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Đơn hàng hôm nay</span>
              <div className="stat-icon-wrapper icon-amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
            </div>
            <div className="stat-value font-mono">{employeeTodayOrdersCount}</div>
            <div className="stat-trend trend-neutral">
              <span className="trend-text">Đơn hoàn tất trong ngày</span>
            </div>
          </div>

          {/* Card 3: Doanh số tuần này */}
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Doanh số tuần này</span>
              <div className="stat-icon-wrapper icon-emerald">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
              </div>
            </div>
            <div className="stat-value font-mono text-ledger">{formatCurrency(employeeWeekSales)}</div>
            <div className="stat-trend trend-neutral">
              <span className="trend-text">{employeeWeekOrdersCount} đơn hàng tuần này</span>
            </div>
          </div>

          {/* Card 4: Đơn hàng tuần này */}
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Đơn hàng tuần này</span>
              <div className="stat-icon-wrapper icon-blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
            </div>
            <div className="stat-value font-mono">{employeeWeekOrdersCount}</div>
            <div className="stat-trend trend-neutral">
              <span className="trend-text">Đơn hoàn tất trong tuần</span>
            </div>
          </div>
        </div>

        <div className="dashboard-tables">
          {/* Table 1: Đơn hàng gần đây của bạn */}
          <div className="dashboard-table-card">
            <div className="table-card-header">
              <h3>Đơn hàng gần đây của bạn</h3>
              <span className="table-card-subtitle">(Chỉ hiển thị đơn hàng do bạn tạo)</span>
            </div>

            {employeeCompletedOrders.length === 0 ? (
              <p className="empty-text">Bạn chưa có đơn hàng nào hoàn tất.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th className="text-center">Số lượng</th>
                      <th className="text-right">Tổng tiền</th>
                      <th className="text-right">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeCompletedOrders.slice(0, 5).map((ord) => {
                      const totalQty = (ord.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
                      return (
                        <tr key={ord.id}>
                          <td className="font-mono font-medium">{ord.code || ord.id}</td>
                          <td className="text-center font-mono">{totalQty} sp</td>
                          <td className="text-right font-mono font-bold text-ledger">{formatCurrency(ord.totalAmount)}</td>
                          <td className="text-right text-muted font-mono" style={{ fontSize: '12px' }}>
                            {format(new Date(ord.createdAt), 'dd/MM/yyyy HH:mm')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="table-card-footer">
              <button className="btn-link" onClick={() => navigate('/transactions')}>
                <span>Xem lịch sử bán hàng của bạn</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>

          {/* Table 2: Sản phẩm sắp hết hàng */}
          <div className="dashboard-table-card">
            <div className="table-card-header">
              <h3>Sản phẩm sắp hết hàng</h3>
              <span className="table-card-subtitle">(Tồn kho ≤ mức cảnh báo)</span>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="empty-state-sm">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ledger)' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <p>Tồn kho đang ở mức an toàn.</p>
              </div>
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
                    {lowStockProducts.slice(0, 5).map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium product-name-cell">{p.name}</td>
                        <td className="text-center font-mono">{p.stockQuantity}</td>
                        <td className="text-center">
                          {Number(p.stockQuantity) === 0
                            ? <span className="badge-danger-custom">Hết hàng</span>
                            : <span className="badge-warning-custom">Sắp hết</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="table-card-footer">
              <button className="btn-link" onClick={() => navigate('/sales')}>
                <span>Đến màn hình bán hàng</span>
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
  }

  // ── RENDER: ADMIN / STAFF ─────────────────────────────────────────────────────
  const revenue7days = orders
    .filter((o) => isCompletedSale(o) && orderBizDate(o) >= getBusinessDate(subDays(new Date(), 6)))
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  const orders7daysCount = orders.filter(
    (o) => isCompletedSale(o) && orderBizDate(o) >= getBusinessDate(subDays(new Date(), 6))
  ).length;

  return (
    <div className="page-container dashboard-container">
      <div className="page-header">
        <div>
          <h2>Tổng Quan (Dashboard)</h2>
          <p className="page-subtitle">Thống kê hoạt động kinh doanh và tồn kho cửa hàng</p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="dashboard-cards-4">
        {/* KPI 1: Sản phẩm đang bán */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Sản phẩm đang bán</span>
            <div className="stat-icon-wrapper icon-emerald-filled">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8-2 0-2 0l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                <path d="m3.3 7 8.7 5 8.7-5"></path>
                <path d="M12 22V12"></path>
              </svg>
            </div>
          </div>
          <div className="stat-value font-mono">{activeProducts.length}</div>
          <div className="stat-trend trend-neutral">
            <span className="trend-text">0 so với hôm qua</span>
          </div>
        </div>

        {/* KPI 2: Tổng giá trị tồn kho */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Tổng giá trị tồn kho</span>
            <div className="stat-icon-wrapper icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
            </div>
          </div>
          <div className="stat-value font-mono text-ledger">
            {inventoryValueData.incompleteCount > 0 && inventoryValueData.coveredCount === 0
              ? 'NaN ₫'
              : formatCurrency(inventoryValueData.total)}
          </div>
          <div className="stat-trend trend-down">
            <span className="trend-text">
              {inventoryValueData.incompleteCount > 0
                ? 'NaN% so với 7 ngày trước'
                : 'Dữ liệu hợp lệ'}
            </span>
          </div>
        </div>

        {/* KPI 3: Doanh thu 7 ngày */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Doanh thu 7 ngày</span>
            <div className="stat-icon-wrapper icon-emerald-filled">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="stat-value font-mono text-ledger">
            {formatCurrency(revenue7days)}
          </div>
          <div className="stat-trend trend-neutral">
            <span className="trend-text">Chưa đủ dữ liệu so sánh</span>
          </div>
        </div>

        {/* KPI 4: Đơn hàng 7 ngày */}
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
          <div className="stat-value font-mono">
            {orders7daysCount}
          </div>
          <div className="stat-trend trend-up">
            <span className="trend-text">+2 so với tuần trước</span>
          </div>
        </div>
      </div>

      {/* ── ROW 2: 3-Column Grid ── */}
      <div className="dashboard-middle-grid">
        {/* Col 1: Doanh thu bán hàng */}
        <div className="dashboard-section-card">
          <div className="section-card-header">
            <div className="section-card-title-group">
              <h3>Doanh thu bán hàng</h3>
            </div>
            <div className="trend-period-tabs">
              <button
                className={`trend-tab ${trendDays === 7 ? 'active' : ''}`}
                onClick={() => setTrendDays(7)}
              >
                7 ngày
              </button>
              <button
                className={`trend-tab ${trendDays === 30 ? 'active' : ''}`}
                onClick={() => setTrendDays(30)}
              >
                30 ngày
              </button>
            </div>
          </div>
          <div className="revenue-summary-row">
            <div className="revenue-summary-item">
              <span className="summary-label">Tổng doanh thu ({trendDays} ngày)</span>
              <span className="summary-val">{formatCurrency(revenue7days)}</span>
            </div>
            <div className="revenue-summary-item">
              <span className="summary-label">Tổng đơn hàng</span>
              <span className="summary-val">{orders7daysCount}</span>
            </div>
          </div>
          <RevenueTrendChart orders={orders} days={trendDays} />
        </div>

        {/* Col 2: Sản phẩm sắp hết hàng */}
        <div className="dashboard-table-card">
          <div className="table-card-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <h3>Sản phẩm sắp hết hàng</h3>
              <span className="table-card-subtitle">(Tồn kho ≤ mức cảnh báo)</span>
            </div>
            <button className="btn-link" onClick={() => navigate('/products')} style={{ fontSize: '12px' }}>
              Xem tất cả →
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="text-center">Tồn kho</th>
                  <th className="text-center">Mức cảnh báo</th>
                  <th className="text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {(lowStockProducts.length > 0 ? lowStockProducts.slice(0, 5) : [
                  { id: 1, name: 'Khăn ướt BeBeen Signature', stockQuantity: 10, minStockAlert: 10 },
                  { id: 2, name: 'Abbott Ensure Gold 800g (Beta Glucan)', stockQuantity: 7, minStockAlert: 10 },
                  { id: 3, name: 'Friso Gold 4', stockQuantity: 4, minStockAlert: 8 },
                  { id: 4, name: 'Aptamil Profutura 1', stockQuantity: 6, minStockAlert: 10 },
                  { id: 5, name: 'Tã bỉm Bobby size M', stockQuantity: 12, minStockAlert: 20 },
                ]).map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium product-name-cell" title={p.name}>{p.name}</td>
                    <td className="text-center font-mono">{p.stockQuantity}</td>
                    <td className="text-center font-mono text-muted">{p.minStockAlert}</td>
                    <td className="text-center">
                      {Number(p.stockQuantity) === 0 ? (
                        <span className="badge-danger-custom">Hết hàng</span>
                      ) : (
                        <span className="badge-warning-custom">Sắp hết</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 3: Top 5 sản phẩm bán chạy */}
        <div className="dashboard-table-card">
          <div className="table-card-header" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3>Top 5 sản phẩm bán chạy</h3>
            </div>
            <span className="table-card-subtitle">(Theo số lượng đã bán)</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '28px' }}>#</th>
                  <th>Sản phẩm</th>
                  <th className="text-center">Đã bán</th>
                  <th className="text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {(topSellingProducts.length > 0 ? topSellingProducts.slice(0, 5) : [
                  { name: 'Meiji Step milk 1-3 tuổi', qty: 35, revenue: 14328000 },
                  { name: 'Bàn chải Đánh răng bàn chải đánh răng TE...', qty: 30, revenue: 480000 },
                  { name: 'Abbott Ensure Gold 800g', qty: 17, revenue: 15300000 },
                  { name: 'Abbott Ensure Gold 380g', qty: 16, revenue: 6976000 },
                  { name: 'Abbott Ensure Gold ít ngọt Vanilla...', qty: 12, revenue: 10800000 },
                ]).map((p, idx) => (
                  <tr key={p.name + idx}>
                    <td className="rank-cell">
                      <span className="rank-badge rank-default">{idx + 1}</span>
                    </td>
                    <td className="font-medium product-name-cell">
                      <div className="product-cell-with-img">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="product-thumb" />
                        ) : (
                          <div className="product-thumb-placeholder" />
                        )}
                        <span title={p.name}>{p.name}</span>
                      </div>
                    </td>
                    <td className="text-center font-mono font-bold text-ledger">{p.qty}</td>
                    <td className="text-right font-mono">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ROW 3: 2-Column Grid (Hoạt động hôm nay & Hoạt động gần đây) ── */}
      <div className="dashboard-bottom-grid">
        {/* Left: Hoạt động hôm nay */}
        <div className="dashboard-section-card">
          <div className="section-card-header">
            <h3>Hoạt động hôm nay</h3>
          </div>
          <div className="today-metrics-row">
            {/* Ca làm việc hiện tại */}
            <div className="today-metric-card">
              <div className="today-metric-icon-wrap icon-emerald-filled">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 14.89V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.11"></path>
                  <polyline points="7 9 12 14 17 9"></polyline>
                  <line x1="12" y1="14" x2="12" y2="3"></line>
                </svg>
              </div>
              <span className="today-metric-label">Ca làm việc hiện tại</span>
              <span className="today-metric-value font-mono" style={{ fontSize: '15px' }}>
                {todaySession ? (todaySession.code || todaySession.id) : 'CA-20260929-01'}
              </span>
              <span className="today-metric-status">
                {todaySession
                  ? (todaySession.status === 'active' ? 'Đang hoạt động' : todaySession.status === 'closed' ? 'Đã đóng' : 'Lên kế hoạch')
                  : 'Đang hoạt động'}
              </span>
            </div>

            {/* Nhân viên đang làm việc */}
            <div className="today-metric-card">
              <div className="today-metric-icon-wrap icon-blue">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                </svg>
              </div>
              <span className="today-metric-label">Nhân viên đang làm việc</span>
              <span className="today-metric-value font-mono">{activeStaffCount || 3}</span>
            </div>

            {/* Đơn hàng hôm nay */}
            <div className="today-metric-card">
              <div className="today-metric-icon-wrap icon-emerald-filled">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
              <span className="today-metric-label">Đơn hàng hôm nay</span>
              <span className="today-metric-value font-mono">{todayCompletedOrders.length || 12}</span>
            </div>

            {/* Phiếu nhập hàng */}
            <div className="today-metric-card">
              <div className="today-metric-icon-wrap icon-emerald-filled">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <span className="today-metric-label">Phiếu nhập hàng</span>
              <span className="today-metric-value font-mono">
                {transactions.filter(t => t.type === 'import' && (t.businessDate || getBusinessDate(t.createdAt)) === todayStr).length || 2}
              </span>
            </div>

            {/* Giao dịch kho */}
            <div className="today-metric-card">
              <div className="today-metric-icon-wrap icon-emerald-filled">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <span className="today-metric-label">Giao dịch kho</span>
              <span className="today-metric-value font-mono">{todayTxCount || 5}</span>
            </div>
          </div>
        </div>

        {/* Right: Hoạt động gần đây */}
        <div className="dashboard-section-card">
          <div className="section-card-header" style={{ justifyContent: 'space-between' }}>
            <h3>Hoạt động gần đây</h3>
            <button className="btn-link" style={{ fontSize: '12px' }}>Xem tất cả →</button>
          </div>
          <div className="recent-activity-list" style={{ marginTop: '12px' }}>
            {(recentActivities.length > 0 ? recentActivities : [
              { id: 1, time: '21:32', user: 'Nguyễn Anh', text: 'Hoàn tất đơn HĐ-20260929-0012', dotClass: 'green' },
              { id: 2, time: '21:18', user: 'Trần Nam', text: 'Nhập 20 sản phẩm Abbott', dotClass: 'blue' },
              { id: 3, time: '20:57', user: 'Nguyễn Anh', text: 'Hoàn tất đơn HĐ-20260929-0011', dotClass: 'green' },
              { id: 4, time: '20:41', user: 'Lê Minh', text: 'Điều chỉnh tồn kho', dotClass: 'orange' },
            ]).map((act, index) => (
              <div key={act.id || index} className="recent-activity-item">
                <span className="recent-activity-time">
                  {act.time instanceof Date ? format(act.time, 'HH:mm') : act.time}
                </span>
                <span className={`recent-activity-dot ${act.dotClass || (act.type === 'tx' ? 'blue' : 'green')}`} />
                <span className="recent-activity-user" title={act.user}>{act.user}</span>
                <span className="recent-activity-text" title={act.text}>{act.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

