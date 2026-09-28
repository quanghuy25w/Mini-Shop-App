import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, validatePassword } from '../../utils/validate';
import { toast } from 'react-toastify';
import './Login.css';

const SetupAdmin = () => {
  const navigate = useNavigate();
  const { hasAdmin, loading, setupFirstAdmin, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (hasAdmin === true) {
        if (isAuthenticated) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      }
    }
  }, [hasAdmin, loading, isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorMessage(emailErr);
      return;
    }

    const passErr = validatePassword(password);
    if (passErr) {
      setErrorMessage(passErr);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Xác nhận mật khẩu không khớp với mật khẩu đã nhập.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await setupFirstAdmin({
        email: email.trim(),
        password,
        name: name.trim() || 'Quản trị viên'
      });

      if (res.success) {
        toast.success('Khởi tạo Quản trị viên đầu tiên thành công! Đã đăng nhập vào hệ thống.');
        navigate('/', { replace: true });
      } else {
        setErrorMessage(res.error || 'Khởi tạo Quản trị viên thất bại.');
      }
    } catch {
      setErrorMessage('Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h1 className="auth-title">Khởi tạo Hệ thống</h1>
          <p className="auth-subtitle">Thiết lập tài khoản Quản trị viên đầu tiên cho Mini-Shop</p>
        </div>

        <div className="auth-setup-banner">
          <span className="auth-setup-badge"> Thiết lập ban đầu</span>
          <p className="auth-setup-text">
            Hệ thống chưa có tài khoản quản trị nào. Hãy nhập thông tin bên dưới để tạo tài khoản Quản trị viên đầu tiên.
          </p>
        </div>

        {errorMessage && (
          <div className="auth-error-alert" style={{ marginBottom: '18px' }}>
            {errorMessage}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="setup-email">Email Quản trị viên *</label>
            <input
              id="setup-email"
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
            <label className="auth-label" htmlFor="setup-name">Tên chủ cửa hàng (Tùy chọn)</label>
            <input
              id="setup-name"
              type="text"
              className="auth-input"
              placeholder="Vd: Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="setup-password">Mật khẩu *</label>
            <div className="auth-input-wrapper">
              <input
                id="setup-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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

          <div className="auth-field">
            <label className="auth-label" htmlFor="setup-confirm-password">Xác nhận mật khẩu *</label>
            <input
              id="setup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="auth-input"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span>Đang thiết lập...</span>
            ) : (
              <>
                <span>TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupAdmin;
