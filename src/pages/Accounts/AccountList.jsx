import { useState, useMemo } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useAuth } from '../../hooks/useAuth';
import AccountFormModal from './AccountFormModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import './Accounts.css';
import '../Staff/Staff.css';

const ITEMS_PER_PAGE = 10;

const AccountList = () => {
  const { currentUser } = useAuth();
  const {
    accounts,
    loading,
    error,
    refetch,
    createAdminAccount,
    changeAdminPassword,
    resetStaffPin,
    toggleAccountActive
  } = useAccounts(currentUser?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create-admin'); // 'create-admin' | 'reset-pin' | 'change-password'
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Confirm state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(null);

  const handleOpenCreateAdmin = () => {
    setSelectedAccount(null);
    setModalMode('create-admin');
    setIsModalOpen(true);
  };

  const handleOpenResetPin = (acc) => {
    setSelectedAccount(acc);
    setModalMode('reset-pin');
    setIsModalOpen(true);
  };

  const handleOpenChangePassword = (acc) => {
    setSelectedAccount(acc);
    setModalMode('change-password');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAccount(null);
  };

  const handleRequestToggle = (acc) => {
    setConfirmAccount(acc);
    setIsConfirmOpen(true);
  };

  const handleConfirmToggle = async () => {
    if (confirmAccount) {
      await toggleAccountActive(confirmAccount);
    }
    setIsConfirmOpen(false);
    setConfirmAccount(null);
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        !searchTerm.trim() ||
        (acc.displayName && acc.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (acc.email && acc.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (acc.displayCode && acc.displayCode.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchRole =
        roleFilter === 'ALL' || acc.role === roleFilter;

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && acc.isActive === true) ||
        (statusFilter === 'INACTIVE' && acc.isActive === false);

      return matchSearch && matchRole && matchStatus;
    });
  }, [accounts, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAccounts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAccounts, currentPage]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="error-state">
        <p>Có lỗi xảy ra: {error}</p>
        <button className="btn-primary" onClick={refetch}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Quản lý tài khoản</h2>
          <p className="page-subtitle">Quản lý tài khoản đăng nhập hệ thống của Quản trị viên và Nhân viên.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreateAdmin}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Tạo quản trị viên mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div className="search-wrapper" style={{ flex: 2, minWidth: '220px' }}>
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Tìm theo tên, email, mã nhân viên..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
          />
        </div>

        <div className="filter-group" style={{ flex: 1, minWidth: '160px' }}>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
            style={{ width: '100%', height: '100%' }}
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="admin">Quản trị viên (Admin)</option>
            <option value="staff">Staff (Quản lý)</option>
            <option value="employee">Nhân viên (Employee)</option>
          </select>
        </div>

        <div className="filter-group" style={{ flex: 1, minWidth: '160px' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
            style={{ width: '100%', height: '100%' }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Đã khóa / Tạm dừng</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="page-content" style={{ padding: 0 }}>
        {filteredAccounts.length === 0 ? (
          <EmptyState message="Không tìm thấy tài khoản nào phù hợp." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th width="45px" className="text-center">#</th>
                  <th>Người dùng / Định danh</th>
                  <th className="text-center">Vai trò</th>
                  <th>Phương thức đăng nhập</th>
                  <th>Ngày tạo</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-center" width="130px">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((acc, idx) => {
                  const itemIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  const avatarChar = acc.displayName?.trim().charAt(0).toUpperCase() || (acc.role === 'admin' ? 'A' : 'S');
                  const isCurrentLoggedIn = currentUser && String(currentUser.id) === String(acc.id);

                  return (
                    <tr key={acc.id}>
                      <td className="text-center text-muted font-mono">{itemIndex}</td>
                      <td>
                        <div className="staff-name-group">
                          <div className="staff-avatar-circle" style={{ background: acc.role === 'admin' ? '#1e3a8a' : 'var(--ink)' }}>
                            {avatarChar}
                          </div>
                          <div>
                            <span className="staff-name-title">
                              {acc.displayName}
                              {isCurrentLoggedIn && (
                                <span style={{ fontSize: '11px', color: 'var(--ledger-dark)', marginLeft: '6px', fontWeight: 600 }}>
                                  (Bạn)
                                </span>
                              )}
                            </span>
                            <span className="staff-code-sub">
                              {acc.role === 'admin' ? (acc.email || 'Admin') : `Mã NV: ${acc.displayCode}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="text-center">
                        {acc.role === 'admin' ? (
                          <span className="badge account-role-admin">Quản trị viên</span>
                        ) : acc.role === 'staff' ? (
                          <span className="badge account-role-staff">Staff</span>
                        ) : (
                          <span className="badge account-role-staff">Nhân viên</span>
                        )}
                      </td>
                      <td>
                        {acc.role === 'admin' ? (
                          <span className="account-type-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                              <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            Email + Mật khẩu
                          </span>
                        ) : (
                          <span className="account-type-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Tên + PIN (6 số)
                          </span>
                        )}
                      </td>
                      <td>{formatDateTime(acc.createdAt)}</td>
                      <td className="text-center">
                        {acc.isActive ? (
                          <span className="badge badge-success">Hoạt động</span>
                        ) : (
                          <span className="badge badge-danger">Đã khóa</span>
                        )}
                      </td>
                      <td className="text-center actions-cell">
                        {acc.role === 'admin' ? (
                          <button
                            className="btn-action-icon btn-action-edit"
                            onClick={() => handleOpenChangePassword(acc)}
                            title="Đổi mật khẩu Quản trị viên"
                            aria-label="Đổi mật khẩu"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                          </button>
                        ) : (
                          <button
                            className="btn-action-icon btn-action-edit"
                            onClick={() => handleOpenResetPin(acc)}
                            title="Cấp lại mã PIN 6 số cho nhân viên"
                            aria-label="Cấp lại PIN"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                          </button>
                        )}
                        <button
                          className="btn-action-icon"
                          onClick={() => handleRequestToggle(acc)}
                          title={acc.isActive ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
                          aria-label={acc.isActive ? 'Khóa' : 'Kích hoạt'}
                          style={{ color: acc.isActive ? 'var(--brick)' : 'var(--ledger)' }}
                          disabled={isCurrentLoggedIn}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                            <line x1="12" y1="2" x2="12" y2="12"></line>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="table-footer-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
              <span>Hiển thị {filteredAccounts.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)} của {filteredAccounts.length} tài khoản</span>
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => setCurrentPage(p)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AccountFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode={modalMode}
        account={selectedAccount}
        onCreateAdmin={createAdminAccount}
        onChangePassword={changeAdminPassword}
        onResetPin={resetStaffPin}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={confirmAccount?.isActive ? 'Khóa tài khoản truy cập' : 'Kích hoạt tài khoản truy cập'}
        message={
          confirmAccount?.isActive
            ? `Bạn có chắc chắn muốn khóa tài khoản "${confirmAccount?.displayName}" không? Tài khoản này sẽ không thể đăng nhập vào hệ thống.`
            : `Bạn có muốn kích hoạt lại tài khoản "${confirmAccount?.displayName}" không?`
        }
        onConfirm={handleConfirmToggle}
        onCancel={() => setIsConfirmOpen(false)}
        confirmText={confirmAccount?.isActive ? 'Khóa tài khoản' : 'Kích hoạt'}
      />
    </div>
  );
};

export default AccountList;
