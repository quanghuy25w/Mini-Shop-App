import { useState, useMemo } from 'react';
import { useStaff } from '../../hooks/useStaff';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { accountApi } from '../../api/accountApi';
import StaffFormModal from './StaffFormModal';
import StaffDetailModal from './StaffDetailModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import './Staff.css';

const ITEMS_PER_PAGE = 10;

const StaffList = () => {
  const { currentUser, isAdmin, can } = useAuth();
  const {
    staffList,
    loading,
    error,
    refetch,
    createStaffWithAccount,
    updateStaffWithAccount,
    toggleStaffActive
  } = useStaff();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewingStaff, setViewingStaff] = useState(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmStaff, setConfirmStaff] = useState(null);

  const handleOpenForm = async (staff = null) => {
    if (staff) {
      try {
        const accRes = await accountApi.getByEmployeeId(staff.id);
        const acc = Array.isArray(accRes.data) ? accRes.data[0] : null;
        setEditingStaff({
          ...staff,
          permissions: acc?.permissions || [],
          role: acc?.role || 'employee'
        });
      } catch {
        setEditingStaff({ ...staff, permissions: [], role: 'employee' });
      }
    } else {
      setEditingStaff(null);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStaff(null);
  };

  const handleOpenDetail = (staff) => {
    setViewingStaff(staff);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setViewingStaff(null);
  };

  const handleSubmitForm = async (formData) => {
    if (editingStaff) {
      return await updateStaffWithAccount(editingStaff.id, formData);
    } else {
      return await createStaffWithAccount(formData);
    }
  };

  const handleRequestToggle = (staff) => {
    setConfirmStaff(staff);
    setIsConfirmOpen(true);
  };

  const confirmToggleActive = async () => {
    if (confirmStaff) {
      await toggleStaffActive(confirmStaff.id, confirmStaff.isActive);
    }
    setIsConfirmOpen(false);
    setConfirmStaff(null);
  };

  // Lọc và tìm kiếm nhân viên
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        !searchTerm.trim() ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(searchTerm));

      const matchStatus =
        statusFilter === 'ALL' || s.employmentStatus === statusFilter;

      const matchActive =
        activeFilter === 'ALL' ||
        (activeFilter === 'ACTIVE' && s.isActive === true) ||
        (activeFilter === 'INACTIVE' && s.isActive === false);

      return matchSearch && matchStatus && matchActive;
    });
  }, [staffList, searchTerm, statusFilter, activeFilter]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / ITEMS_PER_PAGE));
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStaff.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStaff, currentPage]);

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
      return new Date(dateStr).toLocaleDateString('vi-VN');
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
          <h2>Quản lý nhân viên</h2>
          <p className="page-subtitle">Quản lý hồ sơ nhân sự và tài khoản truy cập hệ thống của nhân viên.</p>
        </div>
        {(!currentUser || isAdmin || can(PERMISSIONS.EMPLOYEE_MANAGE)) && (
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Thêm nhân viên mới</span>
          </button>
        )}
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
            placeholder="Tìm theo tên, mã NV (NV001), số điện thoại..."
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
            style={{ width: '100%', height: '100%' }}
          >
            <option value="ALL">Tất cả tình trạng</option>
            <option value="working">Đang làm việc</option>
            <option value="on_leave">Nghỉ phép</option>
            <option value="resigned">Đã nghỉ việc</option>
          </select>
        </div>

        <div className="filter-group" style={{ flex: 1, minWidth: '160px' }}>
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
            style={{ width: '100%', height: '100%' }}
          >
            <option value="ALL">Tất cả quyền đăng nhập</option>
            <option value="ACTIVE">Được phép đăng nhập</option>
            <option value="INACTIVE">Đã khóa / Tạm dừng</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="page-content" style={{ padding: 0 }}>
        {filteredStaff.length === 0 ? (
          <EmptyState message="Không tìm thấy nhân viên nào phù hợp." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th width="45px" className="text-center">#</th>
                  <th>Nhân viên</th>
                  <th>Số điện thoại</th>
                  <th>Ngày vào làm</th>
                  <th className="text-center">Tình trạng</th>
                  <th className="text-center">Đăng nhập</th>
                  <th className="text-center" width="130px">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((staff, idx) => {
                  const itemIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  const avatarChar = staff.name?.trim().charAt(0).toUpperCase() || 'N';

                  return (
                    <tr key={staff.id}>
                      <td className="text-center text-muted font-mono">{itemIndex}</td>
                      <td>
                        <div className="staff-name-group">
                          <div className="staff-avatar-circle">{avatarChar}</div>
                          <div>
                            <span className="staff-name-title">{staff.name}</span>
                            <span className="staff-code-sub">{staff.employeeCode}</span>
                          </div>
                        </div>
                      </td>
                      <td>{staff.phone || '-'}</td>
                      <td>{formatDate(staff.hireDate)}</td>
                      <td className="text-center">{getStatusBadge(staff.employmentStatus)}</td>
                      <td className="text-center">
                        {staff.isActive ? (
                          <span className="badge badge-success" title="Đang được phép đăng nhập">Hoạt động</span>
                        ) : (
                          <span className="badge badge-danger" title="Tài khoản bị khóa / không được đăng nhập">Đã khóa</span>
                        )}
                      </td>
                      <td className="text-center actions-cell">
                        <button
                          className="btn-action-icon"
                          onClick={() => handleOpenDetail(staff)}
                          title="Xem chi tiết hồ sơ"
                          aria-label="Xem chi tiết"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                        <button
                          className="btn-action-icon btn-action-edit"
                          onClick={() => handleOpenForm(staff)}
                          title="Chỉnh sửa thông tin"
                          aria-label="Chỉnh sửa"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          className="btn-action-icon"
                          onClick={() => handleRequestToggle(staff)}
                          title={staff.isActive ? 'Khóa đăng nhập' : 'Kích hoạt đăng nhập'}
                          aria-label={staff.isActive ? 'Khóa' : 'Kích hoạt'}
                          style={{ color: staff.isActive ? 'var(--brick)' : 'var(--ledger)' }}
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
              <span>Hiển thị {filteredStaff.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredStaff.length)} của {filteredStaff.length} nhân viên</span>
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

      {/* Modals */}
      <StaffFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
        initialData={editingStaff}
      />

      <StaffDetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        staff={viewingStaff}
        onEdit={(staff) => handleOpenForm(staff)}
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={confirmStaff?.isActive ? 'Khóa quyền đăng nhập nhân viên' : 'Kích hoạt quyền đăng nhập nhân viên'}
        message={
          confirmStaff?.isActive
            ? `Bạn có chắc chắn muốn khóa quyền đăng nhập của nhân viên "${confirmStaff?.name}" (${confirmStaff?.employeeCode}) không? Nhân viên này sẽ không thể đăng nhập vào hệ thống.`
            : `Bạn có muốn kích hoạt lại quyền đăng nhập cho nhân viên "${confirmStaff?.name}" (${confirmStaff?.employeeCode}) không?`
        }
        onConfirm={confirmToggleActive}
        onCancel={() => setIsConfirmOpen(false)}
        confirmText={confirmStaff?.isActive ? 'Khóa nhân viên' : 'Kích hoạt'}
      />
    </div>
  );
};

export default StaffList;
