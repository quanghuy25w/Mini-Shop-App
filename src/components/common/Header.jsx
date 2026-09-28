import { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { inventoryApi } from '../../api/inventoryApi';
import { AppDataContext } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useWorkSession } from '../../hooks/useWorkSession';
import CheckInModal from '../workSession/CheckInModal';
import { formatCurrency } from '../../utils/formatCurrency';
import { toast } from 'react-toastify';
import './Header.css';

const Header = ({ onToggleNav }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { products } = useContext(AppDataContext);
  const { currentUser, isAdmin, isStaff, isEmployee, logout } = useAuth();
  const { currentSession, isCheckedIn, workingStatus } = useWorkSession();

  const [activities, setActivities] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dữ liệu khi mount, đúng pattern "Synchronizing with an external system" (react.dev)
    fetchActivities();
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

  const handleLogout = () => {
    logout();
    toast.info('Đã đăng xuất khỏi hệ thống');
    navigate('/login', { replace: true });
  };

  const displayName = currentUser?.name || currentUser?.email || 'Người dùng';
  const displayRole = isAdmin
    ? 'Quản trị viên'
    : isStaff
      ? `Staff (${currentUser?.employeeCode || 'Staff'})`
      : isEmployee
        ? `Nhân viên (${currentUser?.employeeCode || 'NV'})`
        : 'Thành viên';
  const avatarChar = displayName.trim().charAt(0).toUpperCase() || 'U';

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
        {/* SHIFT STATUS BADGE */}
        <button
          type="button"
          className={`header-shift-badge ${isCheckedIn ? 'active' : 'inactive'}`}
          onClick={() => setIsCheckInModalOpen(true)}
          title={isCheckedIn ? `Đang trực ca: ${currentSession?.name || ''} - Nhấp để xem chi tiết hoặc đổi trạng thái` : 'Xem thông tin ca làm việc'}
        >
          {isCheckedIn ? (
            <>
              <span className="status-dot" style={{ backgroundColor: workingStatus === 'busy' ? '#3b82f6' : 'var(--ledger)' }}></span>
              <span className="shift-text font-mono" style={{ fontWeight: 600 }}>{currentSession?.code}</span>
              <span className="shift-sub">({workingStatus === 'busy' ? 'Đang bán' : 'Hoạt động'})</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '13px' }}>⚠️</span>
              <span style={{ color: '#b45309', fontWeight: 600 }}>Chưa vào ca</span>
            </>
          )}
        </button>

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

        <div className="header-user" title={displayName}>
          <div className="user-avatar">{avatarChar}</div>
          <div className="user-info">
            <span className="user-name">{displayName}</span>
            <span className="user-role">{displayRole}</span>
          </div>
        </div>

        <button
          type="button"
          className="header-logout-btn"
          onClick={handleLogout}
          title="Đăng xuất"
          aria-label="Đăng xuất"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Đăng xuất</span>
        </button>
      </div>

      {isCheckInModalOpen && (
        <CheckInModal
          isOpen={isCheckInModalOpen}
          onClose={() => setIsCheckInModalOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;
