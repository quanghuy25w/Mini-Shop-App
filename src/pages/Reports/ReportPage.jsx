/**
 * ReportPage.jsx
 * WorkSession Reporting & End-of-Day Audit Page.
 * Renders Daily Work Report, Monthly Work Report, and End-of-Day Audit.
 * Enforces role-based data isolation (Employee strictly sees own reports).
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { reportApi } from '../../api/reportApi';
import { staffApi } from '../../api/staffApi';
import { formatCurrency } from '../../utils/formatCurrency';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ROLES } from '../../utils/permissions';
import { getBusinessDate } from '../../utils/businessDate';
import './ReportPage.css';

// ==========================================
// SVG Icons
// ==========================================
const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const IconAudit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const IconBag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <path d="M16 10a4 4 0 0 1-8 0"></path>
  </svg>
);

const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

const IconAlertClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconBriefcase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
  </svg>
);

const IconReceipt = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path>
    <line x1="16" y1="8" x2="8" y2="8"></line>
    <line x1="16" y1="12" x2="8" y2="12"></line>
    <line x1="16" y1="16" x2="10" y2="16"></line>
  </svg>
);

const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
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

const IconFileText = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const IconScale = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21"></line>
    <line x1="3" y1="9" x2="21" y2="9"></line>
    <path d="M3 9c0 3.87 3.13 7 7 7s7-3.13 7-7"></path>
  </svg>
);

const IconCheckCircle = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const IconAlertTriangle = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

// ==========================================
// Main Component
// ==========================================
const ReportPage = () => {
  const { currentUser } = useAuth();

  // Role checks
  const isAdminOrStaff = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.STAFF;
  const isEmployee = currentUser?.role === ROLES.EMPLOYEE;

  // Active Tab
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'monthly' | 'audit'

  // Filter States
  const todayStr = getBusinessDate(new Date());
  const currentMonthStr = todayStr.substring(0, 7);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser?.employeeId || '');

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [auditReport, setAuditReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  // Load staff list for Admin/Staff selector
  useEffect(() => {
    let isMounted = true;
    if (isAdminOrStaff) {
      staffApi.getAll().then(res => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setStaffList(list);
        if (list.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(list[0].id);
        }
      }).catch(err => {
        console.error('Lỗi khi tải danh sách nhân viên:', err);
      });
    }
    return () => { isMounted = false; };
  }, [isAdminOrStaff, selectedEmployeeId]);

  // Load Report Data based on active tab and filters
  useEffect(() => {
    let isCancelled = false;
    const fetchReports = async () => {
      if (!currentUser) return;
      setLoading(true);
      setError(null);

      try {
        if (activeTab === 'daily') {
          const res = await reportApi.getDailyWorkReport({
            date: selectedDate,
            employeeId: isEmployee ? currentUser.employeeId : (selectedEmployeeId || currentUser.employeeId),
            accountId: isEmployee ? currentUser.id : null,
            actor: currentUser,
          });
          if (!isCancelled) setDailyReport(res.data);
        } else if (activeTab === 'monthly') {
          const res = await reportApi.getMonthlyWorkReport({
            month: selectedMonth,
            employeeId: isEmployee ? currentUser.employeeId : (selectedEmployeeId || currentUser.employeeId),
            accountId: isEmployee ? currentUser.id : null,
            actor: currentUser,
          });
          if (!isCancelled) setMonthlyReport(res.data);
        } else if (activeTab === 'audit' && isAdminOrStaff) {
          const res = await reportApi.getEndOfDayAudit({
            date: selectedDate,
            actor: currentUser,
          });
          if (!isCancelled) setAuditReport(res.data);
        }
      } catch (err) {
        console.error('Lỗi tải báo cáo:', err);
        if (!isCancelled) setError(err.message || 'Không thể tải báo cáo');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchReports();
    return () => { isCancelled = true; };
  }, [activeTab, selectedDate, selectedMonth, selectedEmployeeId, currentUser, isEmployee, isAdminOrStaff, refreshKey]);

  return (
    <div className="report-page-container">
      {/* Page Header */}
      <div className="report-header-section">
        <div className="report-header-title">
          <h1>Báo cáo & Kiểm toán Ca làm việc</h1>
          <p>
            {isEmployee
              ? 'Xem nhật ký làm việc, thời gian thực tế và chi tiết bán hàng'
              : 'Theo dõi thời lượng làm việc thực tế, giao dịch bán hàng và đối soát ca'}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="report-tabs">
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <IconCalendar />
          <span>Báo cáo ngày</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          <IconBarChart />
          <span>Báo cáo tháng</span>
        </button>
        {isAdminOrStaff && (
          <button
            type="button"
            className={`report-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <IconAudit />
            <span>Kiểm toán cuối ngày</span>
          </button>
        )}
      </div>

      {/* Toolbar / Filters */}
      <div className="report-toolbar">
        <div className="report-filter-group">
          {activeTab !== 'monthly' && (
            <div className="report-filter-item">
              <span className="report-filter-label">Ngày:</span>
              <input
                type="date"
                className="report-input font-mono"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'monthly' && (
            <div className="report-filter-item">
              <span className="report-filter-label">Tháng:</span>
              <input
                type="month"
                className="report-input font-mono"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          )}

          {/* Employee Selector only for Admin/Staff on daily and monthly tabs */}
          {isAdminOrStaff && activeTab !== 'audit' && (
            <div className="report-filter-item">
              <span className="report-filter-label">Nhân viên:</span>
              <select
                className="report-input"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.employeeCode} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEmployee && (
            <div className="report-employee-context">
              Nhân viên: <strong>{currentUser?.name}</strong> <span className="font-mono">({currentUser?.employeeCode || 'Tài khoản cá nhân'})</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-secondary report-btn-refresh"
          onClick={handleRefresh}
        >
          <IconRefresh /> Làm mới
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner text="Đang tải dữ liệu báo cáo..." />
      ) : error ? (
        <div className="report-error-box">
          <IconAlertClock /> {error}
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: DAILY WORK REPORT                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'daily' && dailyReport && (
            <div>
              {/* Daily KPI Stat Cards */}
              <div className="report-stats-grid">
                <div className="report-stat-card">
                  <div className="report-stat-icon green">
                    <IconClock />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Tổng giờ làm việc</span>
                    <span className="report-stat-val text-ledger">{dailyReport.totalWorkDuration?.formatted || '0h00'}</span>
                  </div>
                </div>

                <div className="report-stat-card">
                  <div className="report-stat-icon blue">
                    <IconBag />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Đơn hàng hoàn tất</span>
                    <span className="report-stat-val">{dailyReport.completedOrderCount || 0}</span>
                  </div>
                </div>

                <div className="report-stat-card">
                  <div className="report-stat-icon amber">
                    <IconDollar />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Doanh thu bán hàng</span>
                    <span className="report-stat-val text-ledger">{formatCurrency(dailyReport.totalSalesAmount || 0)}</span>
                  </div>
                </div>

                <div className="report-stat-card">
                  <div className="report-stat-icon brick">
                    <IconAlertClock />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Đi muộn</span>
                    <span className="report-stat-val" style={{ color: dailyReport.isLate ? 'var(--brick)' : 'var(--ledger-dark)' }}>
                      {dailyReport.isLate ? `${dailyReport.totalLateMinutes} phút` : 'Đúng giờ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shift Participation Table */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconBriefcase />
                    <span>Các ca làm việc tham gia trong ngày</span>
                    <span className="report-badge report-badge-neutral">{dailyReport.shiftsCount} ca</span>
                  </h3>
                </div>

                <div className="report-table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Ca làm việc</th>
                        <th>Khung giờ ca</th>
                        <th>Giờ vào ca</th>
                        <th>Giờ ra ca</th>
                        <th>Tình trạng vào ca</th>
                        <th>Thời lượng làm việc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReport.shiftsParticipated?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="report-empty-box">Không có bản ghi tham gia ca làm việc trong ngày này.</td>
                        </tr>
                      ) : (
                        dailyReport.shiftsParticipated.map((s, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>{s.shiftName}</strong>
                              <div className="text-subtle font-mono">{s.workSessionCode}</div>
                            </td>
                            <td className="font-mono">{s.officialStart} → {s.officialEnd}</td>
                            <td className="font-mono">{s.checkInTime ? new Date(s.checkInTime).toLocaleTimeString('vi-VN') : '--:--'}</td>
                            <td className="font-mono">{s.checkOutTime ? new Date(s.checkOutTime).toLocaleTimeString('vi-VN') : 'Chưa ra ca'}</td>
                            <td>
                              {s.isLate ? (
                                <span className="report-badge late"><IconAlertTriangle /> Muộn {s.lateMinutes} phút</span>
                              ) : (
                                <span className="report-badge ontime"><IconCheckCircle /> Đúng giờ</span>
                              )}
                            </td>
                            <td>
                              <strong className="font-mono text-ledger">{s.durationFormatted?.formatted || '0h00'}</strong>
                              <span className="text-subtle" style={{ marginLeft: '4px' }}>
                                ({s.durationMinutes} phút)
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Sales Activity */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconReceipt />
                    <span>Chi tiết hoạt động bán hàng trong ngày</span>
                    <span className="report-badge report-badge-neutral">{dailyReport.salesDetails?.length || 0} đơn</span>
                  </h3>
                </div>

                <div className="report-table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Mã đơn</th>
                        <th>Sản phẩm & Số lượng</th>
                        <th>Ca làm việc</th>
                        <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReport.salesDetails?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="report-empty-box">Chưa có giao dịch bán hàng hoàn tất trong ngày này.</td>
                        </tr>
                      ) : (
                        dailyReport.salesDetails.map((order) => (
                          <tr key={order.orderId}>
                            <td className="font-mono">
                              {order.timeFormatted}
                              {order.isRestPeriodSale && (
                                <div style={{ marginTop: '4px' }}>
                                  <span className="report-badge rest-sale">Bán giờ nghỉ</span>
                                </div>
                              )}
                            </td>
                            <td><strong className="font-mono">{order.orderCode}</strong></td>
                            <td>
                              <div className="items-list-compact">
                                {order.items.map((item, iIdx) => (
                                  <div key={iIdx} className="item-line">
                                    <span>• {item.productName}</span>
                                    <span className="item-qty font-mono">× {item.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="text-subtle font-mono">
                              {order.workSessionCode || 'N/A'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong className="font-mono text-ledger">{formatCurrency(order.totalAmount)}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MONTHLY WORK REPORT                                                */}
          {/* ========================================================================= */}
          {activeTab === 'monthly' && monthlyReport && (
            <div>
              {/* Monthly KPI Stat Cards */}
              <div className="report-stats-grid">
                <div className="report-stat-card">
                  <div className="report-stat-icon green">
                    <IconCalendar />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Tổng giờ làm</span>
                    <span className="report-stat-val text-ledger">{monthlyReport.totalWorkDuration?.formatted || '0h00'}</span>
                  </div>
                </div>

                <div className="report-stat-card">
                  <div className="report-stat-icon blue">
                    <IconBriefcase />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Số ngày đi làm</span>
                    <span className="report-stat-val">{monthlyReport.totalWorkingDays || 0} ngày</span>
                  </div>
                </div>

                <div className="report-stat-card">
                  <div className="report-stat-icon amber">
                    <IconBag />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Đơn hoàn tất</span>
                    <span className="report-stat-val">{monthlyReport.totalCompletedOrders || 0}</span>
                  </div>
                </div>

                <div className="report-stat-card">
                  <div className="report-stat-icon brick">
                    <IconDollar />
                  </div>
                  <div className="report-stat-content">
                    <span className="report-stat-label">Doanh thu tháng</span>
                    <span className="report-stat-val text-ledger">{formatCurrency(monthlyReport.totalSalesAmount || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconCalendar />
                    <span>Chi tiết từng ngày làm việc trong tháng {selectedMonth}</span>
                    <span className="report-badge report-badge-neutral">
                      Trung bình: {monthlyReport.averageDailyDuration?.formatted || '0h00'} / ngày
                    </span>
                  </h3>
                </div>

                <div className="report-table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Số ca tham gia</th>
                        <th>Thời lượng làm việc</th>
                        <th>Đơn hoàn tất</th>
                        <th>Đi muộn</th>
                        <th style={{ textAlign: 'right' }}>Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyReport.dailyBreakdown?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="report-empty-box">Không có dữ liệu ca làm việc trong tháng này.</td>
                        </tr>
                      ) : (
                        monthlyReport.dailyBreakdown.map((row) => (
                          <tr key={row.date}>
                            <td><strong className="font-mono">{row.date}</strong></td>
                            <td>{row.shiftsCount} ca</td>
                            <td>
                              <strong className="font-mono text-ledger">{row.durationFormatted?.formatted || '0h00'}</strong>
                            </td>
                            <td>{row.completedOrderCount} đơn</td>
                            <td>
                              {row.isLate ? (
                                <span className="report-badge late"><IconAlertTriangle /> {row.lateMinutes}p</span>
                              ) : (
                                <span className="report-badge ontime"><IconCheckCircle /></span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong className="font-mono text-ledger">{formatCurrency(row.totalSalesAmount)}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: END-OF-DAY AUDIT (ADMIN & STAFF ONLY)                              */}
          {/* ========================================================================= */}
          {activeTab === 'audit' && isAdminOrStaff && auditReport && (
            <div>
              {/* SECTION A: STORE OVERVIEW */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconHome />
                    <span>Tổng quan hoạt động cửa hàng ({auditReport.date})</span>
                  </h3>
                </div>

                <div className="report-stats-grid" style={{ padding: '16px', marginBottom: 0 }}>
                  <div className="report-stat-card">
                    <div className="report-stat-icon green">
                      <IconDollar />
                    </div>
                    <div className="report-stat-content">
                      <span className="report-stat-label">Doanh thu hoàn tất</span>
                      <span className="report-stat-val text-ledger">{formatCurrency(auditReport.storeOverview?.totalSalesRevenue || 0)}</span>
                    </div>
                  </div>

                  <div className="report-stat-card">
                    <div className="report-stat-icon blue">
                      <IconBag />
                    </div>
                    <div className="report-stat-content">
                      <span className="report-stat-label">Đơn hoàn tất</span>
                      <span className="report-stat-val">{auditReport.storeOverview?.totalCompletedOrders || 0}</span>
                    </div>
                  </div>

                  <div className="report-stat-card">
                    <div className="report-stat-icon amber">
                      <IconBox />
                    </div>
                    <div className="report-stat-content">
                      <span className="report-stat-label">Nhập / Xuất kho</span>
                      <span className="report-stat-val font-mono">
                        +{auditReport.storeOverview?.inventorySummary?.importQuantity || 0} / -{auditReport.storeOverview?.inventorySummary?.exportQuantity || 0}
                      </span>
                    </div>
                  </div>

                  <div className="report-stat-card">
                    <div className="report-stat-icon brick">
                      <IconBriefcase />
                    </div>
                    <div className="report-stat-content">
                      <span className="report-stat-label">Số ca làm việc</span>
                      <span className="report-stat-val">{auditReport.storeOverview?.totalSessions || 0} ca</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: EMPLOYEE WORK SUMMARY */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconUsers />
                    <span>Tổng hợp làm việc của nhân sự</span>
                    <span className="report-badge report-badge-neutral">{auditReport.employeeSummaries?.length || 0} nhân viên</span>
                  </h3>
                </div>

                <div className="report-table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Ca tham gia</th>
                        <th>Thời lượng làm việc</th>
                        <th>Đi muộn</th>
                        <th>Đơn hoàn tất</th>
                        <th style={{ textAlign: 'right' }}>Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditReport.employeeSummaries?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="report-empty-box">Không có nhân sự trực ca trong ngày này.</td>
                        </tr>
                      ) : (
                        auditReport.employeeSummaries.map((emp) => (
                          <tr key={emp.employee.accountId}>
                            <td>
                              <div className="seller-info">
                                <span className="seller-name">{emp.employee.name}</span>
                                <span className="font-mono text-subtle">{emp.employee.employeeCode}</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex-gap-xs">
                                {emp.shiftsParticipated.map((s, sIdx) => (
                                  <span key={sIdx} className={`report-badge shift-${s.shiftType}`}>
                                    {s.shiftName} ({s.durationFormatted?.formatted})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <strong className="font-mono text-ledger">{emp.totalWorkDuration?.formatted || '0h00'}</strong>
                            </td>
                            <td>
                              {emp.isLate ? (
                                <span className="report-badge late"><IconAlertTriangle /> {emp.totalLateMinutes}p</span>
                              ) : (
                                <span className="report-badge ontime"><IconCheckCircle /></span>
                              )}
                            </td>
                            <td>{emp.completedOrderCount} đơn</td>
                            <td style={{ textAlign: 'right' }}>
                              <strong className="font-mono text-ledger">{formatCurrency(emp.totalSalesAmount)}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION C: DETAILED SALES ACTIVITY */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconReceipt />
                    <span>Chi tiết đơn hàng</span>
                    <span className="report-badge report-badge-neutral">{auditReport.salesDetails?.length || 0} giao dịch</span>
                  </h3>
                </div>

                <div className="report-table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Mã đơn</th>
                        <th>Người bán</th>
                        <th>Sản phẩm & Số lượng</th>
                        <th>Ca làm việc</th>
                        <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditReport.salesDetails?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="report-empty-box">Chưa có đơn hàng nào trong ngày này.</td>
                        </tr>
                      ) : (
                        auditReport.salesDetails.map((order) => (
                          <tr key={order.orderId}>
                            <td className="font-mono">
                              {order.timeFormatted}
                              {order.isRestPeriodSale && (
                                <div style={{ marginTop: '4px' }}>
                                  <span className="report-badge rest-sale">Bán giờ nghỉ</span>
                                </div>
                              )}
                            </td>
                            <td><strong className="font-mono">{order.orderCode}</strong></td>
                            <td>
                              <div className="seller-info">
                                <span className="seller-name">{order.seller.employeeName}</span>
                                <span className="font-mono text-subtle">{order.seller.employeeCode}</span>
                              </div>
                            </td>
                            <td>
                              <div className="items-list-compact">
                                {order.items.map((item, iIdx) => (
                                  <div key={iIdx} className="item-line">
                                    <span>• {item.productName}</span>
                                    <span className="item-qty font-mono">× {item.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="text-subtle font-mono">
                              {order.workSessionCode || 'N/A'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong className="font-mono text-ledger">{formatCurrency(order.totalAmount)}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION D: ACTIVITY / AUDIT SUMMARY */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconFileText />
                    <span>Nhật ký hoạt động</span>
                    <span className="report-badge report-badge-neutral">{auditReport.activityLogs?.length || 0} sự kiện</span>
                  </h3>
                </div>

                <div className="report-table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Người thực hiện</th>
                        <th>Hành động</th>
                        <th>Đối tượng</th>
                        <th>Ca làm việc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditReport.activityLogs?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="report-empty-box">Không có sự kiện nhật ký nào trong ngày này.</td>
                        </tr>
                      ) : (
                        auditReport.activityLogs.slice(0, 20).map((log) => (
                          <tr key={log.id}>
                            <td className="font-mono">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN') : '--:--'}</td>
                            <td>{log.actorName || log.actorRole || 'Hệ thống'}</td>
                            <td><span className="report-badge report-badge-neutral">{log.action}</span></td>
                            <td className="font-mono">{log.entityType} <span className="text-subtle">({log.entityId || 'N/A'})</span></td>
                            <td className="font-mono text-subtle">{log.workSessionId || 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION E: DATA CONSISTENCY VIEW */}
              <div className="report-section-card">
                <div className="report-section-header">
                  <h3 className="report-section-title">
                    <IconScale />
                    <span>Đối soát dữ liệu</span>
                  </h3>
                </div>

                <div className="consistency-grid">
                  <div className="consistency-item">
                    <span className="consistency-label">Ca làm việc</span>
                    <span className="consistency-val">{auditReport.consistency?.workSessionsCount || 0}</span>
                  </div>
                  <div className="consistency-item">
                    <span className="consistency-label">Lượt trực ca</span>
                    <span className="consistency-val">{auditReport.consistency?.membersCount || 0}</span>
                  </div>
                  <div className="consistency-item">
                    <span className="consistency-label">Đơn hoàn tất</span>
                    <span className="consistency-val text-ledger">{auditReport.consistency?.completedOrdersCount || 0}</span>
                  </div>
                  <div className="consistency-item">
                    <span className="consistency-label">Đơn đã hủy</span>
                    <span className="consistency-val text-brick">{auditReport.consistency?.cancelledOrdersCount || 0}</span>
                  </div>
                  <div className="consistency-item">
                    <span className="consistency-label">Giao dịch kho</span>
                    <span className="consistency-val">{auditReport.consistency?.inventoryTransactionsCount || 0}</span>
                  </div>
                  <div className="consistency-item">
                    <span className="consistency-label">Nhật ký hoạt động</span>
                    <span className="consistency-val">{auditReport.consistency?.activityLogsCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportPage;
