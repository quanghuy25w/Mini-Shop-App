import { useState, useEffect, useMemo, useCallback } from 'react';
import { workSessionApi } from '../../api/workSessionApi';
import { accountApi } from '../../api/accountApi';
import { staffApi } from '../../api/staffApi';
import { orderApi } from '../../api/orderApi';
import { formatCurrency } from '../../utils/formatCurrency';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import MemberStatusBadge from '../../components/workSession/MemberStatusBadge';
import WorkSessionFormModal from '../../components/workSession/WorkSessionFormModal';
import CloseWorkSessionModal from '../../components/workSession/CloseWorkSessionModal';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { logActivity, ACTIVITY_ACTIONS } from '../../utils/activityLogger';
import { getBusinessDate } from '../../utils/businessDate';
import './WorkSession.css';

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

const IconAlertCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const SHIFT_TYPE_LABELS = {
  daily: { label: 'Ca ngày', class: 'shift-morning' },
  morning: { label: 'Ca sáng', class: 'shift-morning' },
  afternoon: { label: 'Ca chiều', class: 'shift-afternoon' },
  evening: { label: 'Ca tối', class: 'shift-evening' }
};

const SESSION_STATUS = {
  active: 'Đang mở',
  planned: 'Lên lịch',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy'
};

const WorkSessionListPage = () => {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [membersMap, setMembersMap] = useState({});
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterShiftType, setFilterShiftType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closingSession, setClosingSession] = useState(null);

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, membersRes, accountsRes, staffRes, ordersRes] = await Promise.all([
        workSessionApi.getAll(),
        workSessionApi.getMembers(),
        accountApi.getAll(),
        staffApi.getAll(),
        orderApi.getAll()
      ]);

      const rawSessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      const rawMembers = Array.isArray(membersRes.data) ? membersRes.data : [];
      const rawAccounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
      const rawStaff = Array.isArray(staffRes.data) ? staffRes.data : [];
      const rawOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];

      setOrders(rawOrders);

      const mapped = {};
      rawMembers.forEach(m => {
        const acc = rawAccounts.find(a => String(a.id) === String(m.accountId));
        let displayName = 'Không xác định';
        let initial = '?';

        if (acc?.role === 'admin') {
          displayName = acc.email ? `Admin (${acc.email})` : 'Quản trị viên';
          initial = 'A';
        } else if (acc?.employeeId) {
          const staff = rawStaff.find(s => String(s.id) === String(acc.employeeId));
          if (staff) {
            displayName = staff.name;
            initial = staff.name ? staff.name.charAt(0).toUpperCase() : 'S';
          }
        }

        const enriched = {
          ...m,
          displayName,
          initial,
          role: acc?.role || 'staff'
        };

        if (!mapped[m.workSessionId]) {
          mapped[m.workSessionId] = [];
        }
        mapped[m.workSessionId].push(enriched);
      });

      setMembersMap(mapped);

      const sorted = [...rawSessions].sort((a, b) => {
        if (b.date !== a.date) return (b.date || '').localeCompare(a.date || '');
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      setSessions(sorted);
    } catch (err) {
      console.error('Lỗi khi tải danh sách ca làm việc:', err);
      toast.error('Lỗi khi tải dữ liệu ca làm việc');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => fetchData(), 0);
  }, [fetchData]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchSearch =
        !searchTerm.trim() ||
        (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.note && s.note.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchDate = !filterDate || s.date === filterDate;
      const matchShift = filterShiftType === 'ALL' || s.shiftType === filterShiftType;
      const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;

      return matchSearch && matchDate && matchShift && matchStatus;
    });
  }, [sessions, searchTerm, filterDate, filterShiftType, filterStatus]);

  const stats = useMemo(() => {
    const today = getBusinessDate(new Date());
    const activeSessions = sessions.filter(s => s.status === 'active');
    
    let presentMembersCount = 0;
    activeSessions.forEach(s => {
      const mems = membersMap[s.id] || [];
      presentMembersCount += mems.filter(m => m.attendanceStatus === 'present').length;
    });

    const todaySessions = sessions.filter(s => s.date === today);
    const todaySessionIds = new Set(todaySessions.map(s => s.id));
    const todayOrders = orders.filter(o =>
      o.status === 'completed' && (
        (o.workSessionId && todaySessionIds.has(o.workSessionId)) ||
        (o.createdAt && getBusinessDate(o.createdAt) === today) ||
        (o.businessDate && o.businessDate === today)
      )
    );
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    let missingCheckoutCount = 0;
    Object.values(membersMap).forEach(mems => {
      missingCheckoutCount += mems.filter(m => m.attendanceStatus === 'missing_checkout').length;
    });

    return {
      activeSessionsCount: activeSessions.length,
      presentMembersCount,
      todayRevenue,
      missingCheckoutCount
    };
  }, [sessions, membersMap, orders]);

  const handleCancelShift = (session) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hủy ca làm việc',
      message: `Bạn có chắc chắn muốn hủy ca "${session.name}" (${session.code}) không? Thao tác này không thể hoàn tác.`,
      onConfirm: async () => {
        try {
          await workSessionApi.patch(session.id, { status: 'cancelled' });
          logActivity({
            actor: currentUser,
            action: ACTIVITY_ACTIONS.SESSION_CANCELLED,
            entityType: 'workSession',
            entityId: session.id,
            workSessionId: session.id,
          });
          toast.success(`Đã hủy ca làm việc ${session.code}`);
          setTimeout(() => fetchData(), 0);
        } catch {
          toast.error('Không thể hủy ca làm việc');
        }
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const hasActiveFilters = searchTerm || filterDate || filterShiftType !== 'ALL' || filterStatus !== 'ALL';
  const clearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFilterShiftType('ALL');
    setFilterStatus('ALL');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Quản lý ca làm việc</h2>
          <p className="page-subtitle">Theo dõi trạng thái trực ca, nhân sự và kết toán tiền mặt tại cửa hàng</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="ws-stats-grid">
        <div className="ws-stat-card stat-primary">
          <div className="ws-stat-icon green">
            <IconClock />
          </div>
          <div className="ws-stat-content">
            <span className="ws-stat-label">Ca đang mở</span>
            <span className="ws-stat-value">{stats.activeSessionsCount}</span>
          </div>
        </div>

        <div className="ws-stat-card">
          <div className="ws-stat-icon blue">
            <IconUsers />
          </div>
          <div className="ws-stat-content">
            <span className="ws-stat-label">Nhân sự đang trực</span>
            <span className="ws-stat-value text-ledger">{stats.presentMembersCount}</span>
          </div>
        </div>

        <div className="ws-stat-card">
          <div className="ws-stat-icon amber">
            <IconDollar />
          </div>
          <div className="ws-stat-content">
            <span className="ws-stat-label">Doanh thu ca hôm nay</span>
            <span className="ws-stat-value">{formatCurrency(stats.todayRevenue)}</span>
          </div>
        </div>

        <div className="ws-stat-card">
          <div className="ws-stat-icon brick">
            <IconAlertCircle />
          </div>
          <div className="ws-stat-content">
            <span className="ws-stat-label">Quên ra ca</span>
            <span className="ws-stat-value" style={{ color: stats.missingCheckoutCount > 0 ? 'var(--brick)' : 'var(--ink)' }}>
              {stats.missingCheckoutCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="ws-toolbar">
        <div className="ws-filter-group">
          <input
            type="text"
            className="ws-search-input"
            placeholder="Tìm theo mã ca, tên ca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <input
            type="date"
            className="ws-date-input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            title="Ngày trực ca"
          />

          <select
            className="ws-select"
            value={filterShiftType}
            onChange={(e) => setFilterShiftType(e.target.value)}
          >
            <option value="ALL">Tất cả loại ca</option>
            <option value="daily">Ca ngày</option>
            <option value="morning">Ca sáng</option>
            <option value="afternoon">Ca chiều</option>
            <option value="evening">Ca tối</option>
          </select>

          <select
            className="ws-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="active">Đang mở</option>
            <option value="planned">Lên lịch</option>
            <option value="closed">Đã đóng</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
        
        {hasActiveFilters && (
          <button type="button" className="ws-filter-clear" onClick={clearFilters}>
            <IconX /> Bỏ lọc
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredSessions.length === 0 ? (
        <EmptyState message="Không có ca làm việc nào khớp với bộ lọc." />
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Ca làm việc</th>
                <th style={{ width: '15%' }}>Lịch trình</th>
                <th style={{ width: '25%' }}>Nhân sự trực ca</th>
                <th style={{ width: '16%' }}>Quỹ tiền mặt</th>
                <th style={{ width: '12%' }}>Bán hàng</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => {
                const shiftInfo = SHIFT_TYPE_LABELS[session.shiftType] || { label: session.shiftType, class: 'shift-morning' };
                const sessionMembers = membersMap[session.id] || [];
                const initialCash = Number(session.initialCash) || 0;
                const actualCash = session.actualCash !== null && session.actualCash !== undefined ? Number(session.actualCash) : null;
                
                const sessionOrders = orders.filter(o => o.workSessionId === session.id && o.status === 'completed');
                const liveRevenue = sessionOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
                const liveOrderCount = sessionOrders.length;

                const totalRev = session.status === 'closed' && session.totalRevenue !== undefined && session.totalRevenue !== null
                  ? Number(session.totalRevenue)
                  : liveRevenue;
                const totalOrdersCount = session.status === 'closed' && session.totalOrders !== undefined && session.totalOrders !== null
                  ? Number(session.totalOrders)
                  : liveOrderCount;

                return (
                  <tr key={session.id}>
                    {/* Identity */}
                    <td>
                      <div className="data-stack">
                        <div className="data-row">
                          <span className="font-mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>{session.code}</span>
                          <span className={`shift-type-pill ${shiftInfo.class}`}>{shiftInfo.label}</span>
                        </div>
                        <span className="data-title">{session.name}</span>
                      </div>
                    </td>

                    {/* Schedule */}
                    <td>
                      <div className="data-stack">
                        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{session.date}</span>
                        <div>
                          <span className={`session-status-badge session-status-${session.status}`}>
                            {session.status === 'active' && <span className="status-dot"></span>}
                            {SESSION_STATUS[session.status] || session.status}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* People */}
                    <td>
                      {sessionMembers.length === 0 ? (
                        <span className="data-subtitle" style={{ fontStyle: 'italic' }}>Chưa có người trực</span>
                      ) : (
                        <div className="ws-members-stack">
                          {sessionMembers.map((m) => (
                            <div key={m.id} className="ws-member-item">
                              <div className="ws-member-avatar" title={m.displayName}>{m.initial}</div>
                              <div className="ws-member-info">
                                <span className="ws-member-name">{m.displayName}</span>
                                <MemberStatusBadge
                                  attendanceStatus={m.attendanceStatus}
                                  workingStatus={m.workingStatus}
                                  isLate={m.isLate}
                                  lateMinutes={m.lateMinutes}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Cash */}
                    <td>
                      <div className="data-stack font-mono">
                        <div className="data-row" style={{ justifyContent: 'space-between' }}>
                          <span className="data-subtitle">Đầu ca:</span>
                          <span>{formatCurrency(initialCash)}</span>
                        </div>
                        <div className="data-row" style={{ justifyContent: 'space-between' }}>
                          <span className="data-subtitle">Thực tế:</span>
                          {actualCash !== null ? (
                            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatCurrency(actualCash)}</span>
                          ) : (
                            <span className="data-subtitle">Chưa kết toán</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Sales */}
                    <td>
                      <div className="data-stack font-mono">
                        <span className="text-ledger" style={{ fontWeight: 600 }}>{formatCurrency(totalRev)}</span>
                        <span className="data-subtitle">{totalOrdersCount} đơn</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="flex-center" style={{ justifyContent: 'center' }}>
                        {session.status === 'active' && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '6px 12px' }}
                              onClick={() => {
                                setEditingSession(session);
                                setIsFormOpen(true);
                              }}
                              title="Sửa quỹ"
                            >
                              Sửa
                            </button>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && (
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '6px 12px', background: 'var(--brick)' }}
                                onClick={() => {
                                  setClosingSession(session);
                                  setIsCloseModalOpen(true);
                                }}
                                title="Kết toán và đóng ca"
                              >
                                Đóng ca
                              </button>
                            )}
                          </>
                        )}

                        {session.status === 'planned' && (
                          <>
                            <button
                              type="button"
                              className="btn-icon-only"
                              onClick={() => {
                                setEditingSession(session);
                                setIsFormOpen(true);
                              }}
                              title="Sửa ca"
                            >
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className="btn-icon-only danger"
                              onClick={() => handleCancelShift(session)}
                              title="Hủy ca"
                            >
                              <IconTrash />
                            </button>
                          </>
                        )}

                        {session.status === 'closed' && (
                          <button
                            type="button"
                            className="btn-icon-only"
                            onClick={() => {
                              setEditingSession(session);
                              setIsFormOpen(true);
                            }}
                            title="Xem chi tiết"
                          >
                            <IconEye />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <WorkSessionFormModal
          isOpen={isFormOpen}
          editingSession={editingSession}
          onClose={() => {
            setIsFormOpen(false);
            setEditingSession(null);
          }}
          onSuccess={fetchData}
        />
      )}

      {isCloseModalOpen && (
        <CloseWorkSessionModal
          isOpen={isCloseModalOpen}
          session={closingSession}
          orders={orders}
          onClose={() => {
            setIsCloseModalOpen(false);
            setClosingSession(null);
          }}
          onSuccess={fetchData}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  );
};

export default WorkSessionListPage;
