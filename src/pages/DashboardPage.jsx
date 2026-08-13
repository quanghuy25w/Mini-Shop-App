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

  if (loadingInitial || loadingOrders) return <LoadingSpinner />;

  return (
    <div className="page-container dashboard-container">
      <div className="page-header">
        <h2>Tổng Quan (Dashboard)</h2>
      </div>

      <div className="dashboard-cards">
        <div className="stat-card">
          <div className="stat-title">Sản phẩm đang bán</div>
          <div className="stat-value">{totalActiveProducts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Tổng giá trị tồn kho</div>
          <div className="stat-value font-mono">{formatCurrency(totalInventoryValue)}</div>
        </div>
        <div className="stat-card stat-card-featured">
          <div className="stat-title">Doanh thu 7 ngày qua</div>
          <div className="stat-value font-mono stat-value-featured">{formatCurrency(revenue7Days)}</div>
        </div>
      </div>

      <div className="dashboard-tables">
        <div className="dashboard-table-card">
          <h3>Sản phẩm sắp hết hàng (Tồn {'>'} 0)</h3>
          {lowStockProducts.length === 0 ? (
            <p className="empty-text">Không có sản phẩm nào sắp hết hàng.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th className="text-center">Tồn kho</th>
                    <th className="text-center">Mức cảnh báo</th>
                    <th className="text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="text-center">
                        <span className="badge badge-warning font-mono">{p.stockQuantity} {p.unit}</span>
                      </td>
                      <td className="text-center font-mono text-ink-soft">{p.minStockAlert}</td>
                      <td className="text-center">
                        <button 
                          className="btn-icon btn-primary" 
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={() => navigate(`/import?productId=${p.id}`)}
                        >
                          Nhập hàng
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dashboard-table-card">
          <h3>Top 5 sản phẩm bán chạy</h3>
          {topSellingProducts.length === 0 ? (
            <p className="empty-text">Chưa có dữ liệu bán hàng.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th className="text-center">Số lượng đã bán</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingProducts.map((p, idx) => (
                    <tr key={idx}>
                      <td>{p.name}</td>
                      <td className="text-center font-mono font-bold text-ledger">{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
