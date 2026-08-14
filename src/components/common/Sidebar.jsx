import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </div>
        <span className="sidebar-title">Mini Shop</span>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
          </svg>
          <span>Danh mục</span>
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span>Sản phẩm</span>
        </NavLink>
        <NavLink to="/import" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.89V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.11"></path>
            <polyline points="7 9 12 14 17 9"></polyline>
            <line x1="12" y1="14" x2="12" y2="3"></line>
          </svg>
          <span>Nhập hàng</span>
        </NavLink>
        <NavLink to="/export" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.89V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.11"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span>Xuất hàng</span>
        </NavLink>
        <NavLink to="/sales" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span>Bán hàng</span>
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="12 8 12 12 14 14"></polyline>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
          </svg>
          <span>Lịch sử Giao dịch</span>
        </NavLink>
      </nav>

      <div className="sidebar-quick-guide">
        <div className="guide-title">
          <span className="guide-icon">💡</span>
          <span>Hướng dẫn nhanh</span>
        </div>
        <p className="guide-desc">
          Chọn sản phẩm, nhập số lượng và giá nhập để cập nhật tồn kho.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
