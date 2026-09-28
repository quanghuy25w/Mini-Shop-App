import { useState, useEffect } from 'react';
import { accountApi } from '../../api/accountApi';
import { PERMISSIONS } from '../../utils/permissions';
import './Staff.css';

const PERMISSION_LABELS = {
  [PERMISSIONS.PRODUCT_MANAGE]: 'Thêm/Sửa sản phẩm',
  [PERMISSIONS.CATEGORY_MANAGE]: 'Thêm/Sửa danh mục',
  [PERMISSIONS.INVENTORY_IMPORT]: 'Nhập kho',
  [PERMISSIONS.INVENTORY_EXPORT]: 'Xuất kho',
  [PERMISSIONS.TRANSACTION_VIEW_ALL]: 'Xem lịch sử giao dịch toàn cửa hàng',
};

const StaffDetailModal = ({ isOpen, onClose, staff, onEdit }) => {
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  useEffect(() => {
    if (isOpen && staff) {
      const loadAccount = async () => {
        setLoadingAccount(true);
        try {
          const res = await accountApi.getByEmployeeId(staff.id);
          const list = Array.isArray(res.data) ? res.data : [];
          setAccount(list[0] || null);
        } catch (err) {
          console.error('Lỗi khi tải tài khoản nhân viên:', err);
        } finally {
          setLoadingAccount(false);
        }
      };
      loadAccount();
    }
  }, [isOpen, staff]);

  if (!isOpen || !staff) return null;

  const avatarChar = staff.name?.trim().charAt(0).toUpperCase() || 'N';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'working':
        return <span className="badge staff-badge-working">Đang làm việc</span>;
      case 'on_leave':
        return <span className="badge staff-badge-on-leave">Nghỉ phép</span>;
      case 'resigned':
        return <span className="badge staff-badge-resigned">Đã nghỉ việc</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="staff-modal-backdrop" onClick={onClose}>
      <div className="staff-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="staff-modal-header">
          <h3>Hồ sơ nhân viên</h3>
          <button
            type="button"
            className="btn-action-icon"
            onClick={onClose}
            aria-label="Đóng modal"
          >
            ✕
          </button>
        </div>

        <div className="staff-modal-body">
          {/* Header Card */}
          <div className="staff-detail-header-card">
            <div className="staff-detail-avatar-lg">{avatarChar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '16px' }}>{staff.name}</h4>
                {getStatusBadge(staff.employmentStatus)}
              </div>
              <span className="font-mono text-muted" style={{ fontSize: '13px' }}>
                Mã NV: {staff.employeeCode}
              </span>
            </div>
          </div>

          {/* Chi tiết nhân viên */}
          <div className="staff-detail-grid">
            <div className="staff-detail-item">
              <span className="staff-detail-label">Số điện thoại</span>
              <span className="staff-detail-val">{staff.phone || 'Chưa cập nhật'}</span>
            </div>

            <div className="staff-detail-item">
              <span className="staff-detail-label">Ngày vào làm</span>
              <span className="staff-detail-val">{formatDate(staff.hireDate)}</span>
            </div>

            <div className="staff-detail-item">
              <span className="staff-detail-label">Quyền đăng nhập (isActive)</span>
              <span className="staff-detail-val">
                {staff.isActive ? (
                  <span className="badge badge-success">Được phép đăng nhập</span>
                ) : (
                  <span className="badge badge-danger">Đã khóa / Tạm dừng</span>
                )}
              </span>
            </div>

            <div className="staff-detail-item">
              <span className="staff-detail-label">Tình trạng công việc</span>
              <span className="staff-detail-val">{getStatusBadge(staff.employmentStatus)}</span>
            </div>

            <div className="staff-detail-item">
              <span className="staff-detail-label">Ngày tạo hồ sơ</span>
              <span className="staff-detail-val" style={{ fontSize: '12.5px' }}>{formatDateTime(staff.createdAt)}</span>
            </div>

            <div className="staff-detail-item">
              <span className="staff-detail-label">Cập nhật lần cuối</span>
              <span className="staff-detail-val" style={{ fontSize: '12.5px' }}>{formatDateTime(staff.updatedAt)}</span>
            </div>
          </div>

          {/* Thông tin tài khoản liên kết */}
          <div className="staff-pin-callout" style={{ marginTop: '8px' }}>
            <div className="staff-pin-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Thông tin tài khoản đăng nhập (Account)</span>
            </div>

            {loadingAccount ? (
              <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--ink-soft)' }}>Đang tải thông tin tài khoản...</p>
            ) : account ? (
              <div className="staff-detail-grid" style={{ marginTop: '8px' }}>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">ID Tài khoản</span>
                  <span className="staff-detail-val font-mono" style={{ fontSize: '12px' }}>{account.id}</span>
                </div>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Vai trò (Role)</span>
                  <span className="staff-detail-val">
                    <span className="badge badge-success">
                      {account.role === 'staff' ? 'Staff (Quản lý)' : account.role === 'employee' ? 'Nhân viên' : (account.role || 'Nhân viên')}
                    </span>
                  </span>
                </div>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Trạng thái tài khoản</span>
                  <span className="staff-detail-val">
                    {account.isActive ? 'Đang kích hoạt' : 'Bị vô hiệu hóa'}
                  </span>
                </div>
                <div className="staff-detail-item">
                  <span className="staff-detail-label">Mã PIN</span>
                  <span className="staff-detail-val font-mono">•••••• (6 chữ số)</span>
                </div>
                <div className="staff-detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="staff-detail-label">Quyền hạn được cấp</span>
                  <span className="staff-detail-val">
                    {Array.isArray(account.permissions) && account.permissions.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                        {account.permissions.map(key => (
                          <span key={key} className="badge badge-success">{PERMISSION_LABELS[key] || key}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '13px' }}>Chưa được cấp quyền nào (chỉ xem)</span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--brick)' }}>Chưa tìm thấy tài khoản liên kết</p>
            )}
          </div>
        </div>

        <div className="staff-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Đóng
          </button>
          {onEdit && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onClose();
                onEdit(staff);
              }}
            >
              Chỉnh sửa nhân viên
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDetailModal;
