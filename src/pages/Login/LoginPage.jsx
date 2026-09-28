import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import StaffLogin from './StaffLogin';
import AdminLogin from './AdminLogin';
import './Login.css';

const LoginPage = ({ defaultRole = 'staff' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAdmin, loading, isAuthenticated } = useAuth();
  
  // Determine active tab from defaultRole prop or URL pathname
  const initialRole = location.pathname.includes('admin') ? 'admin' : (defaultRole || 'staff');
  const [activeTab, setActiveTab] = useState(initialRole);

  useEffect(() => {
    if (!loading) {
      if (hasAdmin === false) {
        navigate('/setup-admin', { replace: true });
      } else if (isAuthenticated) {
        const destination = location.state?.from?.pathname || '/';
        navigate(destination, { replace: true });
      }
    }
  }, [hasAdmin, loading, isAuthenticated, navigate, location]);

  useEffect(() => {
    if (location.pathname.includes('admin')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ tab theo URL
      setActiveTab('admin');
    } else if (location.pathname.includes('staff')) {
      setActiveTab('staff');
    }
  }, [location.pathname]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <h1 className="auth-title">Hệ thống Mini-Shop</h1>
          <p className="auth-subtitle">
            {activeTab === 'staff'
              ? 'Đăng nhập nhân viên để bắt đầu ca bán hàng'
              : 'Đăng nhập quản trị viên quản lý cửa hàng'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            Nhân viên (PIN)
          </button>
          <button
            type="button"
            className={`auth-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Quản trị viên
          </button>
        </div>

        {activeTab === 'staff' ? (
          <StaffLogin onSwitchToAdmin={() => setActiveTab('admin')} />
        ) : (
          <AdminLogin onSwitchToStaff={() => setActiveTab('staff')} />
        )}
      </div>
    </div>
  );
};

export default LoginPage;
