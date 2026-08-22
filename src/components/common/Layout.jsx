import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

const Layout = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

  // Tự động đóng Drawer khi người dùng chuyển trang
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setIsDrawerOpen(false);
  }

  return (
    <div className="layout-container">
      {/* Backdrop overlay for mobile drawer */}
      <div 
        className={`sidebar-overlay ${isDrawerOpen ? 'active' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
        aria-hidden="true"
      />
      <Sidebar isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      <div className="layout-main">
        <Header onToggleNav={() => setIsDrawerOpen(prev => !prev)} />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
