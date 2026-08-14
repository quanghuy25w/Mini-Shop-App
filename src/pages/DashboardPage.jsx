import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppDataContext } from '../context/AppDataContext';
import { orderApi } from '../api/orderApi';
import { formatCurrency } from '../utils/formatCurrency';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { subDays, isAfter } from 'date-fns';
import './DashboardPage.css';

const DashboardPage = () => {
  const { products, loadingInitial } = useContext(AppDataContext);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await orderApi.getAll();
        setOrders(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchOrders();
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
          salesCount[item.productId] = { name: item.productName, qty: 0 };
        }
        salesCount[item.productId].qty += item.quantity;
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
          <div className="stat-trend trend-up">
            <span className="trend-text">+ 4 so với hôm qua</span>
          </div>
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
          <div className="stat-trend trend-up">
            <span className="trend-text">+ 12% so với tuần trước</span>
          </div>
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
          <div className="stat-trend trend-up">
            <span className="trend-text">+ 8% so với tuần trước</span>
          </div>
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
          <div className="stat-trend trend-up">
            <span className="trend-text">+ 6 so với tuần trước</span>
          </div>
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
                      <td className="text-right font-mono">{formatCurrency(p.qty * 10000)}</td>
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
