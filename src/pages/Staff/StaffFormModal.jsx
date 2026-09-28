import { useState, useEffect } from 'react';
import { staffApi } from '../../api/staffApi';
import { useAuth } from '../../hooks/useAuth';
import { validatePin } from '../../utils/validate';
import { PERMISSIONS } from '../../utils/permissions';
import './Staff.css';
import { getBusinessDate } from '../../utils/businessDate';

const PERMISSION_LABELS = {
  [PERMISSIONS.PRODUCT_MANAGE]: 'Thêm/Sửa sản phẩm',
  [PERMISSIONS.CATEGORY_MANAGE]: 'Thêm/Sửa danh mục',
  [PERMISSIONS.INVENTORY_IMPORT]: 'Nhập kho',
  [PERMISSIONS.INVENTORY_EXPORT]: 'Xuất kho',
  [PERMISSIONS.TRANSACTION_VIEW_ALL]: 'Xem lịch sử giao dịch toàn cửa hàng',
};

const StaffFormModal = ({ isOpen, onClose, onSubmit, initialData = null }) => {
  const { isAdmin } = useAuth();
  const isEdit = Boolean(initialData);

  const [formData, setFormData] = useState({
    name: '',
    employeeCode: '',
    role: 'staff',
    phone: '',
    hireDate: getBusinessDate(new Date()),
    employmentStatus: 'working',
    isActive: true,
    pin: '',
    permissions: []
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ reset form state khi modal mở
      setShowPin(false);
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          employeeCode: initialData.employeeCode || '',
          role: initialData.role || 'staff',
          phone: initialData.phone || '',
          hireDate: initialData.hireDate ? initialData.hireDate.slice(0, 10) : getBusinessDate(new Date()),
          employmentStatus: initialData.employmentStatus || 'working',
          isActive: initialData.isActive !== undefined ? initialData.isActive : true,
          pin: '', // để trống khi sửa, chỉ nhập nếu muốn đổi PIN
          permissions: Array.isArray(initialData.permissions) ? initialData.permissions : []
        });
        setErrors({});
      } else {
        // Đồng bộ reset form về trạng thái trống hoàn toàn ngay lập tức
        setFormData({
          name: '',
          employeeCode: '',
          role: 'staff',
          phone: '',
          hireDate: getBusinessDate(new Date()),
          employmentStatus: 'working',
          isActive: true,
          pin: '',
          permissions: []
        });
        setErrors({});

        // Tự động sinh mã nhân viên khi tạo mới
        const initNew = async () => {
          try {
            const nextCode = await staffApi.generateEmployeeCode();
            setFormData((prev) => ({
              ...prev,
              employeeCode: nextCode,
              pin: '' // Tuyệt đối giữ pin rỗng
            }));
          } catch {
            setFormData((prev) => ({
              ...prev,
              employeeCode: 'NV001',
              pin: '' // Tuyệt đối giữ pin rỗng
            }));
          }
        };
        initNew();
      }
    } else {
      setShowPin(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleEmploymentStatusChange = (status) => {
    setFormData((prev) => {
      // Gợi ý UX: khi chuyển sang Nghỉ việc (resigned) hoặc Nghỉ phép (on_leave), gợi ý tắt isActive
      const shouldSuggestInactive = status === 'resigned' || status === 'on_leave';
      return {
        ...prev,
        employmentStatus: status,
        isActive: shouldSuggestInactive ? false : true
      };
    });
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, pin: val }));
  };

  const handleTogglePermission = (permKey) => {
    if (!isAdmin) return;
    setFormData((prev) => {
      const current = prev.permissions || [];
      const updated = current.includes(permKey)
        ? current.filter((p) => p !== permKey)
        : [...current, permKey];
      return { ...prev, permissions: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Tên nhân viên không được để trống';
    }

    if (!formData.employeeCode.trim()) {
      newErrors.employeeCode = 'Mã nhân viên không được để trống';
    }

    if (!isEdit) {
      const pinErr = validatePin(formData.pin);
      if (pinErr) {
        newErrors.pin = pinErr;
      }
    } else if (formData.pin) {
      const pinErr = validatePin(formData.pin);
      if (pinErr) {
        newErrors.pin = pinErr;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmit(formData);
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="staff-modal-backdrop" onClick={onClose}>
      <div className="staff-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="staff-modal-header">
          <h3>{isEdit ? 'Chỉnh sửa thông tin nhân viên' : 'Thêm nhân viên mới'}</h3>
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
            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="staff-code">Mã nhân viên *</label>
                <input
                  id="staff-code"
                  type="text"
                  value={formData.employeeCode}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  placeholder="Vd: NV001"
                  required
                />
                {errors.employeeCode && <span className="text-brick" style={{ fontSize: '12px' }}>{errors.employeeCode}</span>}
              </div>

              <div className="form-group flex-1">
                <label htmlFor="staff-name">Tên nhân viên *</label>
                <input
                  id="staff-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Vd: Nguyễn Anh"
                  required
                  autoFocus
                />
                {errors.name && <span className="text-brick" style={{ fontSize: '12px' }}>{errors.name}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="staff-phone">Số điện thoại</label>
                <input
                  id="staff-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Vd: 0901234567"
                />
              </div>

              <div className="form-group flex-1">
                <label htmlFor="staff-hireDate">Ngày vào làm</label>
                <input
                  id="staff-hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="staff-employmentStatus">Tình trạng công việc</label>
                <select
                  id="staff-employmentStatus"
                  value={formData.employmentStatus}
                  onChange={(e) => handleEmploymentStatusChange(e.target.value)}
                >
                  <option value="working">Đang làm việc (working)</option>
                  <option value="on_leave">Nghỉ phép (on_leave)</option>
                  <option value="resigned">Đã nghỉ việc (resigned)</option>
                </select>
              </div>

              <div className="form-group flex-1" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '16px' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span><strong>Kích hoạt hoạt động</strong> (isActive)</span>
                </label>
                <span style={{ fontSize: '11.5px', color: 'var(--ink-faint)', marginLeft: '26px' }}>
                  Quyết định nhân viên có được phép đăng nhập hệ thống không
                </span>
              </div>
            </div>

            {/* Khối Vai trò (Role) */}
            <div className="form-row" style={{ marginTop: '12px' }}>
              <div className="form-group flex-1">
                <label htmlFor="staff-role">Vai trò tài khoản (Role) *</label>
                <select
                  id="staff-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={!isAdmin}
                >
                  <option value="employee">Nhân viên (Vận hành / Bán hàng cơ bản)</option>
                  <option value="staff">Staff (Quản lý cửa hàng / Toàn quyền vận hành)</option>
                </select>
                {!isAdmin && (
                  <span style={{ fontSize: '11.5px', color: 'var(--ink-faint)', marginTop: '4px', display: 'block' }}>
                    Chỉ Quản trị viên (Admin) mới có quyền gán hoặc thay đổi vai trò tài khoản.
                  </span>
                )}
              </div>
            </div>

            {/* Khối Account: Mã PIN (Gộp UI, Tách Data Model) */}
            <div className="staff-pin-callout">
              <div className="staff-pin-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <label htmlFor="staff-pin" style={{ cursor: 'pointer', margin: 0, fontWeight: 'inherit', color: 'inherit' }}>
                  {isEdit ? 'Tài khoản & Mã PIN đăng nhập (Account)' : 'Mã PIN đăng nhập tài khoản (bắt buộc đúng 6 chữ số)'}
                </label>
              </div>
              <p className="staff-pin-desc">
                {isEdit
                  ? (isAdmin ? 'Để trống nếu không muốn đổi PIN. Nhập 6 số mới nếu muốn cấp lại PIN cho nhân viên.' : 'Mã PIN được bảo mật. Chỉ Quản trị viên mới có thể cấp lại PIN.')
                  : 'Nhập mã PIN 6 chữ số cấp cho nhân viên để đăng nhập bằng Employee Code + PIN.'}
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="staff-pin"
                    name="staff-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="auth-input input-pin"
                    placeholder="••••••"
                    value={formData.pin || ''}
                    onChange={handlePinChange}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    required={!isEdit}
                    disabled={isEdit && !isAdmin}
                    style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '18px' }}
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowPin(!showPin)}
                    tabIndex="-1"
                    aria-label="Hiện/ẩn PIN"
                  >
                    {showPin ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
                {errors.pin && <span className="text-brick" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.pin}</span>}
              </div>
            </div>

            {/* Khối Phân quyền nhân viên */}
            <div className="staff-pin-callout" style={{ marginTop: '16px' }}>
              <div className="staff-pin-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>Phân quyền chức năng bổ sung (Permissions)</span>
              </div>
              <p className="staff-pin-desc">
                {isAdmin
                  ? 'Cấp thêm quyền hạn riêng cho nhân viên. Thao tác xóa vĩnh viễn và quản trị tài khoản chỉ dành cho Admin.'
                  : 'Chỉ Quản trị viên (Admin) mới có quyền cấp hoặc thu hồi quyền hạn của tài khoản.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {Object.keys(PERMISSION_LABELS).map((permKey) => (
                  <label key={permKey} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isAdmin ? 'pointer' : 'not-allowed', fontSize: '13.5px', opacity: isAdmin ? 1 : 0.75 }}>
                    <input
                      type="checkbox"
                      checked={(formData.permissions || []).includes(permKey)}
                      onChange={() => handleTogglePermission(permKey)}
                      disabled={!isAdmin}
                      style={{ width: '16px', height: '16px', cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                    />
                    <span>{PERMISSION_LABELS[permKey] || permKey}</span>
                  </label>
                ))}
              </div>
            </div>
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
              {isSubmitting ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tạo nhân viên')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffFormModal;
