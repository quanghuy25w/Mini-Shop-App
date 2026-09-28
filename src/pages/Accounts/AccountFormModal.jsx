import { useState, useEffect } from 'react';
import { validateEmail, validatePassword, validatePin } from '../../utils/validate';
import './Accounts.css';
import '../Staff/Staff.css';

const AccountFormModal = ({
  isOpen,
  onClose,
  mode = 'create-admin', // 'create-admin' | 'reset-pin' | 'change-password'
  account = null,
  onCreateAdmin,
  onChangePassword,
  onResetPin
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state form khi modal mở lại, chấp nhận giữ pattern hiện tại
      setEmail('');
      setName('');
      setPassword('');
      setConfirmPassword('');
      setPin('');
      setShowSecret(false);
      setErrors({});
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (mode === 'create-admin') {
      const emailErr = validateEmail(email);
      if (emailErr) newErrors.email = emailErr;

      const passErr = validatePassword(password);
      if (passErr) newErrors.password = passErr;

      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Xác nhận mật khẩu không khớp';
      }
    } else if (mode === 'change-password') {
      const passErr = validatePassword(password);
      if (passErr) newErrors.password = passErr;

      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Xác nhận mật khẩu không khớp';
      }
    } else if (mode === 'reset-pin') {
      const pinErr = validatePin(pin);
      if (pinErr) newErrors.pin = pinErr;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      let success = false;
      if (mode === 'create-admin' && onCreateAdmin) {
        success = await onCreateAdmin({ email, name, password });
      } else if (mode === 'change-password' && onChangePassword && account) {
        success = await onChangePassword(account.id, password);
      } else if (mode === 'reset-pin' && onResetPin && account) {
        success = await onResetPin(account.id, pin);
      }

      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    if (mode === 'create-admin') return 'Tạo Quản trị viên (Admin) mới';
    if (mode === 'reset-pin') return `Cấp lại mã PIN cho: ${account?.displayName || 'Nhân viên'}`;
    if (mode === 'change-password') return `Đổi mật khẩu Quản trị viên: ${account?.displayName || account?.email || 'Admin'}`;
    return 'Cập nhật tài khoản';
  };

  return (
    <div className="staff-modal-backdrop" onClick={onClose}>
      <div className="staff-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="staff-modal-header">
          <h3>{getTitle()}</h3>
          <button
            type="button"
            className="btn-action-icon"
            onClick={onClose}
            aria-label="Đóng modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="staff-modal-body">
            {mode === 'create-admin' && (
              <>
                <div className="form-group">
                  <label htmlFor="admin-create-email">Email Quản trị viên *</label>
                  <input
                    id="admin-create-email"
                    type="email"
                    placeholder="admin2@minishop.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  {errors.email && <span className="text-brick" style={{ fontSize: '12px' }}>{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="admin-create-name">Tên chủ cửa hàng (Tùy chọn)</label>
                  <input
                    id="admin-create-name"
                    type="text"
                    placeholder="Vd: Nguyễn Văn A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="admin-create-password">Mật khẩu *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="admin-create-password"
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Tối thiểu 6 ký tự"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="auth-input-toggle"
                      onClick={() => setShowSecret(!showSecret)}
                      tabIndex="-1"
                      aria-label="Hiện/ẩn mật khẩu"
                    >
                      {showSecret ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  {errors.password && <span className="text-brick" style={{ fontSize: '12px' }}>{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="admin-create-confirm">Xác nhận mật khẩu *</label>
                  <input
                    id="admin-create-confirm"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {errors.confirmPassword && <span className="text-brick" style={{ fontSize: '12px' }}>{errors.confirmPassword}</span>}
                </div>
              </>
            )}

            {mode === 'change-password' && (
              <>
                <div className="form-group">
                  <label htmlFor="admin-new-password">Mật khẩu mới *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="admin-new-password"
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Tối thiểu 6 ký tự"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="auth-input-toggle"
                      onClick={() => setShowSecret(!showSecret)}
                      tabIndex="-1"
                      aria-label="Hiện/ẩn mật khẩu"
                    >
                      {showSecret ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  {errors.password && <span className="text-brick" style={{ fontSize: '12px' }}>{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="admin-new-confirm">Xác nhận mật khẩu mới *</label>
                  <input
                    id="admin-new-confirm"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {errors.confirmPassword && <span className="text-brick" style={{ fontSize: '12px' }}>{errors.confirmPassword}</span>}
                </div>
              </>
            )}

            {mode === 'reset-pin' && (
              <div className="staff-pin-callout" style={{ marginTop: 0 }}>
                <div className="staff-pin-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <span>Nhập mã PIN 6 số mới cho nhân viên</span>
                </div>
                <p className="staff-pin-desc">
                  Admin tự nhập thủ công 6 chữ số mới. Sau khi lưu, nhân viên sẽ dùng mã PIN mới này để đăng nhập ca làm việc.
                </p>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="account-reset-pin"
                      name="account-reset-pin"
                      type={showSecret ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="auth-input input-pin"
                      placeholder="••••••"
                      value={pin || ''}
                      onChange={handlePinChange}
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      required
                      autoFocus
                      style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '20px' }}
                    />
                    <button
                      type="button"
                      className="auth-input-toggle"
                      onClick={() => setShowSecret(!showSecret)}
                      tabIndex="-1"
                      aria-label="Hiện/ẩn PIN"
                    >
                      {showSecret ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  {errors.pin && <span className="text-brick" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.pin}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="staff-modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang xử lý...' : (mode === 'create-admin' ? 'Tạo Quản trị viên' : 'Cập nhật')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountFormModal;
