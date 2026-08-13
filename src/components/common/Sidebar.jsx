import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-stamp">MS</div>
        <span className="sidebar-title">Mini Shop</span>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-dot"></span>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-dot"></span>
          <span>Danh mục</span>
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-dot"></span>
          <span>Sản phẩm</span>
        </NavLink>
        <NavLink to="/import" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-dot"></span>
          <span>Nhập hàng</span>
        </NavLink>
        <NavLink to="/export" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-dot"></span>
          <span>Xuất hàng</span>
        </NavLink>
        <NavLink to="/sales" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-dot"></span>
          <span>Bán hàng</span>
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-dot"></span>
          <span>Lịch sử Giao dịch</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
