import React from 'react';
import { useLocation } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const location = useLocation();

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

  return (
    <header className="header">
      <div className="header-left">
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

        <div className="header-icon-btn">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="notification-badge">3</span>
        </div>

        <div className="header-user">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <span className="user-name">Admin</span>
            <span className="user-role">Quản trị viên</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    </header>
  );
};

export default Header;
