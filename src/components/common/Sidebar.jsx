import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Mini Shop</div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
        <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Danh mục</NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Sản phẩm</NavLink>
        <NavLink to="/import" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Nhập hàng</NavLink>
        <NavLink to="/export" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Xuất hàng</NavLink>
        <NavLink to="/sales" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Bán hàng</NavLink>
        <NavLink to="/transactions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Lịch sử Giao dịch</NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
