import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { activityLogApi } from '../api/activityLogApi';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { exportToCSV } from '../utils/exportCSV';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import './TransactionHistoryPage.css';

const ACTION_MAP = {
  LOGIN: { label: 'Đăng nhập', className: 'badge-status badge-in' },
  LOGOUT: { label: 'Đăng xuất', className: 'badge-status badge-out' },
  LOGIN_FAILED: { label: 'Đăng nhập thất bại', className: 'badge-status' },
  CHECK_IN: { label: 'Check-in ca', className: 'badge-status badge-in' },
  CHECK_OUT: { label: 'Check-out ca', className: 'badge-status badge-out' },
  SESSION_CANCELLED: { label: 'Hủy ca làm việc', className: 'badge-status badge-out' },
  EMPLOYEE_CREATED: { label: 'Tạo nhân viên', className: 'badge-status badge-in' },
  EMPLOYEE_UPDATED: { label: 'Cập nhật nhân viên', className: 'badge-status' },
  EMPLOYEE_DEACTIVATED: { label: 'Khóa nhân viên', className: 'badge-status badge-out' },
  PERMISSION_CHANGED: { label: 'Đổi quyền hạn', className: 'badge-status' },
  PIN_CHANGED: { label: 'Đổi mã PIN', className: 'badge-status' },
  PASSWORD_CHANGED: { label: 'Đổi mật khẩu', className: 'badge-status' },
  CREATE: { label: 'Tạo mới', className: 'badge-status badge-in' },
  UPDATE: { label: 'Cập nhật', className: 'badge-status' },
  DEACTIVATE: { label: 'Vô hiệu / Ẩn', className: 'badge-status badge-out' },
  IMPORT: { label: 'Nhập kho', className: 'badge-status badge-in' },
  EXPORT: { label: 'Xuất kho', className: 'badge-status badge-out' },
  ORDER_CREATED: { label: 'Tạo đơn hàng', className: 'badge-status badge-in' },
  ORDER_CANCELLED: { label: 'Hủy đơn hàng', className: 'badge-status badge-out' },
};

const getActionBadge = (action, entityType) => {
  if (action === 'CREATE') {
    return {
      label: entityType === 'product' ? 'Tạo sản phẩm' : entityType === 'category' ? 'Tạo danh mục' : 'Tạo mới',
      className: 'badge-status badge-in'
    };
  }
  if (action === 'UPDATE') {
    return {
      label: entityType === 'product' ? 'Sửa sản phẩm' : entityType === 'category' ? 'Sửa danh mục' : 'Cập nhật',
      className: 'badge-status'
    };
  }
  if (action === 'DEACTIVATE') {
    return {
      label: entityType === 'product' ? 'Ẩn sản phẩm' : entityType === 'category' ? 'Xóa danh mục' : 'Vô hiệu hóa',
      className: 'badge-status badge-out'
    };
  }
  return ACTION_MAP[action] || { label: action, className: 'badge-status' };
};

const getEntityTypeLabel = (entityType) => {
  const map = {
    auth: 'Xác thực',
    workSession: 'Ca làm việc',
    staff: 'Nhân viên',
    account: 'Tài khoản',
    product: 'Sản phẩm',
    category: 'Danh mục',
    inventoryTransaction: 'Giao dịch kho',
    order: 'Đơn hàng'
  };
  return map[entityType] || entityType || '-';
};

const renderMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return '-';
  const parts = [];
  if (metadata.name) parts.push(`Tên: ${metadata.name}`);
  if (metadata.attemptedRole) parts.push(`Cổng: ${metadata.attemptedRole}`);
  if (metadata.totalAmount !== undefined) parts.push(`Tổng tiền: ${Number(metadata.totalAmount).toLocaleString('vi-VN')} đ`);
  if (metadata.reason) parts.push(`Lý do: ${metadata.reason}`);
  if (metadata.quantity !== undefined) parts.push(`SL: ${metadata.quantity}`);
  if (metadata.before && metadata.after) {
    parts.push(`Quyền: [${metadata.before.join(', ')}] → [${metadata.after.join(', ')}]`);
  }
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(metadata);
};

const ActivityLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterActorId, setFilterActorId] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [logsRes, accountsRes, staffRes] = await Promise.all([
        activityLogApi.getAll(),
        accountApi.getAll(),
        staffApi.getAll()
      ]);

      const rawLogs = Array.isArray(logsRes.data) ? logsRes.data : [];
      rawLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(rawLogs);
      setAccounts(Array.isArray(accountsRes.data) ? accountsRes.data : []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
    } catch (err) {
      console.error('Lỗi khi tải lịch sử hoạt động:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dữ liệu khi mount
    fetchData();
  }, [fetchData]);

  const getAccountDisplayName = useCallback((accountId) => {
    if (!accountId) return 'Hệ thống / Ẩn danh';
    const acc = accounts.find(a => String(a.id) === String(accountId));
    if (!acc) return accountId;
    if (acc.role === 'admin') {
      return acc.email ? `Admin (${acc.email})` : (acc.name || 'Quản trị viên');
    }
    const staff = staffList.find(s => String(s.id) === String(acc.employeeId));
    return staff ? `${staff.name} (${staff.employeeCode})` : 'Nhân viên';
  }, [accounts, staffList]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      let matchDateFrom = true;
      let matchDateTo = true;
      let matchAction = true;
      let matchActor = true;

      const logDate = new Date(log.timestamp);
      if (dateFrom) matchDateFrom = logDate >= new Date(dateFrom);
      if (dateTo) matchDateTo = logDate <= new Date(dateTo + 'T23:59:59');
      if (filterAction !== 'ALL') matchAction = log.action === filterAction;
      if (filterActorId !== 'ALL') {
        if (filterActorId === 'system') {
          matchActor = !log.actorId;
        } else {
          matchActor = log.actorId === filterActorId;
        }
      }

      return matchDateFrom && matchDateTo && matchAction && matchActor;
    });
  }, [logs, dateFrom, dateTo, filterAction, filterActorId]);

  const handleResetFilter = () => {
    setDateFrom('');
    setDateTo('');
    setFilterAction('ALL');
    setFilterActorId('ALL');
  };

  const handleExportCSV = () => {
    const data = filteredLogs.map(log => {
      const actionInfo = getActionBadge(log.action, log.entityType);
      return {
        'Thời gian': format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss'),
        'Người thực hiện': getAccountDisplayName(log.actorId),
        'Vai trò': log.actorRole || '-',
        'Hành động': actionInfo.label,
        'Đối tượng': getEntityTypeLabel(log.entityType),
        'Mã đối tượng': log.entityId || '-',
        'Mã ca': log.workSessionId || '-',
        'Chi tiết': renderMetadata(log.metadata)
      };
    });
    exportToCSV(data, 'Nhat_Ky_Hoat_Dong.csv');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Lịch sử hoạt động</h2>
          <p className="page-subtitle" style={{ color: 'var(--ink-soft)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Nhật ký kiểm toán toàn bộ thao tác đăng nhập, ca làm việc, nhân sự, kho và bán hàng
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
          >
             Xuất CSV
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="date-filter">
          <label>Từ ngày:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="date-filter">
          <label>Đến ngày:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="ALL">Tất cả hành động</option>
          <option value="LOGIN">Đăng nhập</option>
          <option value="LOGOUT">Đăng xuất</option>
          <option value="LOGIN_FAILED">Đăng nhập thất bại</option>
          <option value="CHECK_IN">Check-in ca</option>
          <option value="CHECK_OUT">Check-out ca</option>
          <option value="SESSION_CANCELLED">Hủy ca làm việc</option>
          <option value="EMPLOYEE_CREATED">Tạo nhân viên</option>
          <option value="EMPLOYEE_UPDATED">Cập nhật nhân viên</option>
          <option value="EMPLOYEE_DEACTIVATED">Khóa nhân viên</option>
          <option value="PERMISSION_CHANGED">Đổi quyền hạn</option>
          <option value="PIN_CHANGED">Đổi mã PIN</option>
          <option value="PASSWORD_CHANGED">Đổi mật khẩu</option>
          <option value="CREATE">Tạo mới (SP/DM)</option>
          <option value="UPDATE">Cập nhật (SP/DM)</option>
          <option value="DEACTIVATE">Ẩn/Xóa (SP/DM)</option>
          <option value="IMPORT">Nhập kho</option>
          <option value="EXPORT">Xuất kho</option>
          <option value="ORDER_CREATED">Tạo đơn hàng</option>
          <option value="ORDER_CANCELLED">Hủy đơn hàng</option>
        </select>

        <select
          className="filter-select"
          value={filterActorId}
          onChange={(e) => setFilterActorId(e.target.value)}
        >
          <option value="ALL">Tất cả người thực hiện</option>
          <option value="system">Hệ thống / Ẩn danh</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {getAccountDisplayName(acc.id)}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn-reset"
          onClick={handleResetFilter}
        >
          Đặt lại bộ lọc
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filteredLogs.length === 0 ? (
        <EmptyState message="Chưa có nhật ký hoạt động nào phù hợp với bộ lọc." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Thời gian</th>
                <th style={{ width: '180px' }}>Người thực hiện</th>
                <th style={{ width: '90px' }}>Vai trò</th>
                <th style={{ width: '150px' }}>Hành động</th>
                <th style={{ width: '120px' }}>Đối tượng</th>
                <th>Chi tiết / Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const actionBadge = getActionBadge(log.action, log.entityType);
                return (
                  <tr key={log.id}>
                    <td className="font-mono text-muted" style={{ fontSize: '12.5px' }}>
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: '13px' }}>
                      {getAccountDisplayName(log.actorId)}
                    </td>
                    <td>
                      {log.actorRole ? (
                        <span className="badge" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                          {log.actorRole}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={actionBadge.className}>
                        {actionBadge.label}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      <span style={{ fontWeight: 500 }}>{getEntityTypeLabel(log.entityType)}</span>
                      {log.entityId && (
                        <div className="font-mono text-muted" style={{ fontSize: '11px' }}>
                          ID: {log.entityId}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>
                      {renderMetadata(log.metadata)}
                      {log.workSessionId && (
                        <span className="font-mono text-muted" style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                          Ca: {log.workSessionId}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="table-footer-info" style={{ marginTop: '12px', fontSize: '13px', color: 'var(--ink-soft)' }}>
            <span>Hiển thị {filteredLogs.length} / {logs.length} bản ghi hoạt động</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogPage;
