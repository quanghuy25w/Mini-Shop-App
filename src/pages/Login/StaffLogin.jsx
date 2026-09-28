import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { staffApi } from '../../api/staffApi';
import { validatePin } from '../../utils/validate';
import { toast } from 'react-toastify';
import './Login.css';

const StaffLogin = ({ onSwitchToAdmin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginStaff } = useAuth();

  const [employeeCode, setEmployeeCode] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [matchedStaff, setMatchedStaff] = useState(null);
  const [staffLookupError, setStaffLookupError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const staffCacheRef = useRef([]);

// Danh sách nhân viên
  useEffect(() => {
    let isMounted = true;
    staffApi.getAll()
      .then(res => {
        if (isMounted && Array.isArray(res.data)) {
          staffCacheRef.current = res.data;
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const findStaffByIdentifier = useCallback((identifier) => {
    const trimmed = String(identifier || '').trim();
    if (!trimmed) return { type: 'none', staff: null };

    // 1. Tìm theo Employee Code (chính xác, không phân biệt hoa thường)
    const byCode = staffCacheRef.current.find(
      s => s.employeeCode && s.employeeCode.trim().toUpperCase() === trimmed.toUpperCase()
    );
    if (byCode) {
      return { type: 'single', staff: byCode };
    }

    // 2. Tìm theo Tên nhân viên
    const byName = staffCacheRef.current.filter(
      s => s.name && s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (byName.length === 1) {
      return { type: 'single', staff: byName[0] };
    }
    if (byName.length > 1) {
      return { type: 'multiple', count: byName.length };
    }

    return { type: 'not_found', staff: null };
  }, []);

  const handleCodeChange = (e) => {
    const val = e.target.value;
    setEmployeeCode(val);
    setErrorMessage('');

    const trimmed = val.trim();
    if (!trimmed) {
      setMatchedStaff(null);
      setStaffLookupError('');
      return;
    }

    const result = findStaffByIdentifier(trimmed);
    if (result.type === 'single') {
      setMatchedStaff(result.staff);
      setStaffLookupError('');
    } else if (result.type === 'multiple') {
      setMatchedStaff(null);
      setStaffLookupError('');
    } else {
      setMatchedStaff(null);
      if (trimmed.length >= 3) {
        setStaffLookupError('Chưa tìm thấy nhân viên với thông tin này');
      } else {
        setStaffLookupError('');
      }
    }
  };

  const handleCodeBlur = async () => {
    const trimmed = employeeCode.trim();
    if (!trimmed) return;

    if (!matchedStaff) {
      try {
        const res = await staffApi.getAll();
        const list = Array.isArray(res.data) ? res.data : [];
        staffCacheRef.current = list;

        const byCode = list.find(
          s => s.employeeCode && s.employeeCode.trim().toUpperCase() === trimmed.toUpperCase()
        );
        if (byCode) {
          setMatchedStaff(byCode);
          setStaffLookupError('');
          return;
        }

        const byName = list.filter(
          s => s.name && s.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (byName.length === 1) {
          setMatchedStaff(byName[0]);
          setStaffLookupError('');
          return;
        }
        if (byName.length > 1) {
          setMatchedStaff(null);
          setStaffLookupError('');
          return;
        }

        setMatchedStaff(null);
        setStaffLookupError('Không tìm thấy nhân viên với thông tin này');
      } catch (err) {
        console.warn('Lỗi khi tra cứu nhân viên:', err);
      }
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedInput = employeeCode.trim();
    if (!trimmedInput) {
      setErrorMessage('Vui lòng nhập mã hoặc tên nhân viên');
      return;
    }

    const pinErr = validatePin(pin);
    if (pinErr) {
      setErrorMessage(pinErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginStaff({
        employeeCode: trimmedInput,
        identifier: trimmedInput,
        pin: pin.trim()
      });

      if (res.success) {
        toast.success(`Xin chào ${res.user.name}! Đăng nhập thành công, bắt đầu ca làm việc.`);
        const destination = location.state?.from?.pathname || '/';
        navigate(destination, { replace: true });
      } else {
        setErrorMessage(res.error || 'Mã nhân viên hoặc mã PIN 6 số không chính xác.');
      }
    } catch {
      setErrorMessage('Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="staff-login-form">
      {errorMessage && (
        <div className="auth-error-alert" style={{ marginBottom: '18px' }}>
          {errorMessage}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="staff-code">Mã hoặc Tên nhân viên (Employee Code / Name)</label>
          <input
            id="staff-code"
            type="text"
            className="auth-input"
            placeholder="Vd: NV001"
            value={employeeCode}
            onChange={handleCodeChange}
            onBlur={handleCodeBlur}
            autoComplete="username"
            required
            autoFocus
          />

          {/* Hiển thị thông tin nhận diện Staff tương ứng */}
          {matchedStaff && (
            <div className="staff-identified-banner">
              <div className="staff-avatar-circle">
                {matchedStaff.name ? matchedStaff.name.charAt(0).toUpperCase() : 'NV'}
              </div>
              <div className="staff-identified-info">
                <div className="staff-identified-name">{matchedStaff.name}</div>
                <div className="staff-identified-code">
                  Mã: <strong>{matchedStaff.employeeCode}</strong>
                  {matchedStaff.phone ? ` • ${matchedStaff.phone}` : ''}
                </div>
              </div>
              <span className="staff-identified-badge">
                ✓ Xác nhận
              </span>
            </div>
          )}

          {matchedStaff && !matchedStaff.isActive && (
            <div className="auth-error-alert" style={{ marginTop: '6px', fontSize: '12.5px', padding: '8px 12px' }}>
               Hồ sơ nhân viên đang ở trạng thái ngừng hoạt động.
            </div>
          )}

          {staffLookupError && !matchedStaff && (
            <div style={{ fontSize: '12px', color: 'var(--brick, #e11d48)', marginTop: '4px' }}>
              {staffLookupError}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="staff-pin">Mã PIN (bắt buộc đúng 6 chữ số)</label>
          <div className="auth-input-wrapper">
            <input
              id="staff-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="auth-input input-pin"
              placeholder="••••••"
              value={pin}
              onChange={handlePinChange}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-input-toggle"
              onClick={() => setShowPin(!showPin)}
              tabIndex="-1"
              aria-label="Hiện/ẩn mã PIN"
            >
              {showPin ? (
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
              <span>BẮT ĐẦU CA LÀM VIỆC</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </>
          )}
        </button>
      </form>

      {onSwitchToAdmin && (
        <div className="auth-footer">
          <span>Bạn là Quản trị viên? </span>
          <button
            type="button"
            className="auth-link"
            onClick={onSwitchToAdmin}
          >
            Đăng nhập bằng Email & Mật khẩu
          </button>
        </div>
      )}
    </div>
  );
};

export default StaffLogin;
