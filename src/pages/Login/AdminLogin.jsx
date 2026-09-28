import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail } from '../../utils/validate';
import { toast } from 'react-toastify';
import './Login.css';

const AdminLogin = ({ onSwitchToStaff }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAdmin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorMessage(emailErr);
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginAdmin({ email, password });
      if (res.success) {
        toast.success('Đăng nhập Quản trị viên thành công!');
        const destination = location.state?.from?.pathname || '/';
        navigate(destination, { replace: true });
      } else {
        setErrorMessage(res.error || 'Email hoặc mật khẩu không chính xác.');
      }
    } catch {
      setErrorMessage('Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login-form">
      {errorMessage && (
        <div className="auth-error-alert" style={{ marginBottom: '18px' }}>
          {errorMessage}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="admin-email">Email Quản trị viên</label>
          <input
            id="admin-email"
            type="email"
            className="auth-input"
            placeholder="admin@minishop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="admin-password">Mật khẩu</label>
          <div className="auth-input-wrapper">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              className="auth-input"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-input-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
              aria-label="Hiện/ẩn mật khẩu"
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span>Đang đăng nhập...</span>
          ) : (
            <>
              <span>ĐĂNG NHẬP QUẢN TRỊ</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </>
          )}
        </button>
      </form>

      {onSwitchToStaff && (
        <div className="auth-footer">
          <span>Bạn là nhân viên bán hàng? </span>
          <button
            type="button"
            className="auth-link"
            onClick={onSwitchToStaff}
          >
            Đăng nhập bằng Tên + PIN
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminLogin;
