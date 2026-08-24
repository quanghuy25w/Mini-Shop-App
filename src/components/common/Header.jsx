import { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { inventoryApi } from '../../api/inventoryApi';
import { AppDataContext } from '../../context/AppDataContext';
import { formatCurrency } from '../../utils/formatCurrency';
import './Header.css';

const Header = ({ onToggleNav }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { products } = useContext(AppDataContext);

  const [activities, setActivities] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const dropdownRef = useRef(null);

  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/categories':
        return 'Dashboard > Danh mục';
      case '/products':
        return 'Dashboard > Sản phẩm';
      case '/import':
        return 'Dashboard > Nhập hàng';
      case '/export':
        return 'Dashboard > Xuất hàng';
      case '/sales':
        return 'Dashboard > Bán hàng';
      case '/transactions':
        return 'Dashboard > Lịch sử Giao dịch';
      default:
        return 'Dashboard';
    }
  };

  const fetchActivities = async () => {
    try {
      const [ordersRes, transRes] = await Promise.all([
        orderApi.getAll(),
        inventoryApi.getAllTransactions()
      ]);

      const rawOrders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
      const rawTrans = Array.isArray(transRes?.data) ? transRes.data : [];

      const isToday = (dateStr) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;
        const now = new Date();
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate()
        );
      };

      const todayOrders = rawOrders
        .filter((o) => o && isToday(o.createdAt))
        .map((o) => ({ ...o, _kind: 'order' }));

      const todayTrans = rawTrans
        .filter((t) => t && isToday(t.createdAt))
        .map((t) => ({ ...t, _kind: 'transaction' }));

      const combined = [...todayOrders, ...todayTrans]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

      setActivities(combined);
    } catch (error) {
      console.error('Lỗi khi tải hoạt động hôm nay:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadActivities = async () => {
      try {
        const [ordersRes, transRes] = await Promise.all([
          orderApi.getAll(),
          inventoryApi.getAllTransactions()
        ]);
        if (!isMounted) return;

        const rawOrders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
        const rawTrans = Array.isArray(transRes?.data) ? transRes.data : [];

        const isToday = (dateStr) => {
          if (!dateStr) return false;
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return false;
          const now = new Date();
          return (
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate()
          );
        };

        const todayOrders = rawOrders
          .filter((o) => o && isToday(o.createdAt))
          .map((o) => ({ ...o, _kind: 'order' }));

        const todayTrans = rawTrans
          .filter((t) => t && isToday(t.createdAt))
          .map((t) => ({ ...t, _kind: 'transaction' }));

        const combined = [...todayOrders, ...todayTrans]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10);

        setActivities(combined);
      } catch (error) {
        if (isMounted) {
          console.error('Lỗi khi tải hoạt động hôm nay:', error);
        }
      }
    };
    loadActivities();
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleToggleDropdown = async () => {
    if (!isDropdownOpen) {
      setIsDropdownOpen(true);
      await fetchActivities();
      setLastSeenAt(new Date());
    } else {
      setIsDropdownOpen(false);
    }
  };

  const handleViewAllHistory = () => {
    setIsDropdownOpen(false);
    navigate('/transactions');
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffInSeconds < 60) {
      return 'Vừa xong';
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} phút trước`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} giờ trước`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} ngày trước`;
  };

  const unreadCount = lastSeenAt === null
    ? activities.length
    : activities.filter((item) => {
        if (!item?.createdAt) return false;
        const d = new Date(item.createdAt);
        if (isNaN(d.getTime())) return false;
        return d > lastSeenAt;
      }).length;

  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  const renderItemContent = (item) => {
    if (!item) return '';
    if (item._kind === 'order') {
      const statusText =
        item.status === 'completed'
          ? 'thanh toán'
          : item.status === 'cancelled'
            ? 'bị hủy'
            : item.status || '';
      return `Đơn hàng #${item.code || ''} vừa ${statusText} · ${formatCurrency(item.totalAmount)}`;
    }
    const prod = products?.find((p) => p && String(p.id) === String(item.productId));
    const prodName = prod ? prod.name : (item.productName || 'Sản phẩm');
    const typeText = item.type === 'IN' ? 'Nhập kho' : 'Xuất kho';
    return `${typeText} ${item.quantity || 0} ${prodName}`;
  };

  return (
    <header className="header">
      <div className="header-left">
        <button
          type="button"
          className="btn-drawer-toggle"
          onClick={onToggleNav}
          aria-label="Mở menu điều hướng"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div className="header-title-group">
          <span className="header-title">Hệ thống Quản lý Shop</span>
          <span className="breadcrumb-separator">•</span>
          <span className="header-breadcrumb">{getBreadcrumb()}</span>
        </div>
      </div>

      <div className="header-right">
        <div className="status-badge">
          <span className="status-dot"></span>
          <span className="status-text">Online</span>
        </div>

        <div className="header-notification-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="header-icon-btn header-bell-btn"
            title="Thông báo"
            onClick={handleToggleDropdown}
            aria-label="Thông báo"
            aria-expanded={isDropdownOpen}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span className="notification-badge">{badgeText}</span>
            )}
          </button>

          {isDropdownOpen && (
            <div className="notification-dropdown">
              <div className="notification-dropdown-header">
                <span className="notification-dropdown-title">Hoạt động hôm nay</span>
                <span className="notification-dropdown-count">{activities.length}</span>
              </div>

              {activities.length === 0 ? (
                <div className="notification-empty">Chưa có hoạt động nào hôm nay</div>
              ) : (
                <ul className="notification-dropdown-list">
                  {activities.map((item) => (
                    <li key={`${item._kind}-${item.id}`} className="notification-item">
                      <div className="notification-item-content">{renderItemContent(item)}</div>
                      <div className="notification-item-time">{formatRelativeTime(item.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="notification-dropdown-footer">
                <button
                  type="button"
                  className="notification-footer-link"
                  onClick={handleViewAllHistory}
                >
                  Xem toàn bộ lịch sử →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="header-user">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <span className="user-name">Admin</span>
            <span className="user-role">Quản trị viên</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
