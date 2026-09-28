import axiosClient from './axiosClient';
import { hasPermission, assertPermission, PERMISSIONS } from '../utils/permissions';
import { getBusinessDate } from '../utils/businessDate';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';
import {
  determineShiftForTime,
  isOutOfShift,
  SHIFT_FRAMES,
  REST_PERIODS,
  DAILY_SESSION,
  BUSINESS_WINDOW,
  TIMEZONE
} from '../utils/shiftConfig';
import { registerApi } from './registerApi';
import { calculateSessionReconciliation, RECONCILIATION_STATUS } from '../utils/reconciliation';

export {
  determineShiftForTime,
  isOutOfShift,
  SHIFT_FRAMES,
  REST_PERIODS,
  DAILY_SESSION,
  BUSINESS_WINDOW,
  TIMEZONE
};

const _inFlightSessionPromises = new Map();
const _inFlightCreationPromises = new Map();

const VALID_STATE_TRANSITIONS = {
  planned: ['active', 'cancelled'],
  active: ['closed'],
  closed: [],
  cancelled: []
};

const FINANCIAL_RECONCILIATION_FIELDS = [
  'initialCash',
  'actualCash',
  'expectedCash',
  'cashDifference',
  'cashDiscrepancy',
  'posBreakdown',
  'totalRevenue',
  'totalOrders',
  'startTime',
  'date',
  'grossSales',
  'refundTotal',
  'netRevenue',
  'cashSales',
  'cashRefunds',
  'reconciliationStatus',
  'reconciliationSnapshot'
];

const validateSessionMutation = (session, data) => {
  if (!session) return;

  // 1. Cancelled session is completely immutable
  if (session.status === 'cancelled') {
    const err = new Error('Ca làm việc đã bị hủy và không thể chỉnh sửa.');
    err.code = 'CANCELLED_SESSION_IMMUTABLE';
    throw err;
  }

  // 2. Closed session immutability
  if (session.status === 'closed') {
    if (data.status && data.status !== 'closed') {
      const err = new Error(`Chuyển trạng thái ca không hợp lệ: từ 'closed' sang '${data.status}'.`);
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }
    for (const field of FINANCIAL_RECONCILIATION_FIELDS) {
      if (data[field] !== undefined && JSON.stringify(data[field]) !== JSON.stringify(session[field])) {
        const err = new Error('CLOSED_SESSION_IMMUTABLE: Ca làm việc đã đóng không thể sửa đổi số liệu tài chính và đối soát.');
        err.code = 'CLOSED_SESSION_IMMUTABLE';
        throw err;
      }
    }
    return;
  }

  // 3. State transition check for non-closed sessions
  if (data.status && data.status !== session.status) {
    const allowedTargets = VALID_STATE_TRANSITIONS[session.status] || [];
    if (!allowedTargets.includes(data.status)) {
      const err = new Error(`Chuyển trạng thái ca không hợp lệ: từ '${session.status}' sang '${data.status}'.`);
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }
  }

  // 4. Initial cash lock: Only planned sessions can modify initialCash
  if (session.status !== 'planned') {
    if (data.initialCash !== undefined && Number(data.initialCash) !== Number(session.initialCash)) {
      const err = new Error('Tiền mặt đầu ca chỉ được chỉnh sửa khi ca ở trạng thái kế hoạch (planned).');
      err.code = 'INITIAL_CASH_LOCKED';
      throw err;
    }
  }
};

export const workSessionApi = {
  determineShiftForTime,
  isOutOfShift,

  // ==========================================
  // 1. WORK SESSION (CA LÀM VIỆC) CRUD
  // ==========================================
  getAll: (params = {}) => {
    let query = '';
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.append('date', params.date);
    if (params.shiftType) searchParams.append('shiftType', params.shiftType);
    if (params.status) searchParams.append('status', params.status);
    if (params.createdBy) searchParams.append('createdBy', params.createdBy);
    if (params.closedBy) searchParams.append('closedBy', params.closedBy);
    const queryString = searchParams.toString();
    if (queryString) query = `?${queryString}`;
    return axiosClient.get(`/workSessions${query}`);
  },

  getById: (id) => axiosClient.get(`/workSessions/${id}`),

  create: (data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
    }
    const targetDate = data?.date || getBusinessDate(new Date());

    return (async () => {
      if (_inFlightCreationPromises.has(targetDate)) {
        try {
          await _inFlightCreationPromises.get(targetDate);
        } catch {
          // ignore error from previous concurrent attempt
        }
      }

      const creationTask = (async () => {
        // 1 businessDate = 1 non-cancelled WorkSession invariant
        const existingRes = await axiosClient.get(`/workSessions?date=${targetDate}`);
        const existingSessions = Array.isArray(existingRes.data) ? existingRes.data : [];
        const activeOrPlanned = existingSessions.find(s => s.status !== 'cancelled');
        if (activeOrPlanned) {
          const err = new Error(`Mỗi ngày làm việc chỉ được phép có duy nhất 1 ca làm việc (${targetDate}).`);
          err.code = 'DUPLICATE_SESSION_FOR_DATE';
          throw err;
        }

        const now = new Date().toISOString();
        const payload = {
          id: data.id || `ws_${Date.now()}`,
          code: data.code || '',
          date: targetDate,
          shiftType: data.shiftType || 'daily',
          name: data.name || 'Ca làm việc',
          startTime: data.startTime || now,
          endTime: data.endTime || null,
          status: data.status || 'planned',
          initialCash: Number(data.initialCash) || 0,
          actualCash: data.actualCash !== undefined && data.actualCash !== null ? Number(data.actualCash) : null,
          totalRevenue: Number(data.totalRevenue) || 0,
          totalOrders: Number(data.totalOrders) || 0,
          note: data.note || '',
          createdBy: data.createdBy || null,
          closedBy: data.closedBy || null,
          createdAt: data.createdAt || now,
          updatedAt: data.updatedAt || now
        };
        return axiosClient.post('/workSessions', payload);
      })();

      _inFlightCreationPromises.set(targetDate, creationTask);
      try {
        return await creationTask;
      } finally {
        _inFlightCreationPromises.delete(targetDate);
      }
    })();
  },

  update: (id, data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
    }
    return (async () => {
      const sessionRes = await axiosClient.get(`/workSessions/${id}`);
      const session = sessionRes.data;
      if (!session) {
        const err = new Error('Không tìm thấy ca làm việc.');
        err.code = 'SESSION_NOT_FOUND';
        throw err;
      }
      validateSessionMutation(session, data);
      return axiosClient.put(`/workSessions/${id}`, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    })();
  },

  patch: (id, data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
    }
    return (async () => {
      const sessionRes = await axiosClient.get(`/workSessions/${id}`);
      const session = sessionRes.data;
      if (!session) {
        const err = new Error('Không tìm thấy ca làm việc.');
        err.code = 'SESSION_NOT_FOUND';
        throw err;
      }
      validateSessionMutation(session, data);
      return axiosClient.patch(`/workSessions/${id}`, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    })();
  },

  closeSession: async (id, { actualCash, closeNote = '', actor } = {}) => {
    if (!actor?.id) {
      const err = new Error('NOT_AUTHENTICATED: Người thực hiện chưa đăng nhập.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);

    if (actualCash === undefined || actualCash === null || isNaN(Number(actualCash)) || Number(actualCash) < 0) {
      const err = new Error('ACTUAL_CASH_REQUIRED: Tiền mặt thực tế kiểm đếm là bắt buộc và phải lớn hơn hoặc bằng 0.');
      err.code = 'ACTUAL_CASH_REQUIRED';
      throw err;
    }

    const sessionRes = await axiosClient.get(`/workSessions/${id}`);
    const session = sessionRes.data;
    if (!session) {
      const err = new Error('SESSION_NOT_FOUND: Không tìm thấy ca làm việc.');
      err.code = 'SESSION_NOT_FOUND';
      throw err;
    }

    if (session.status === 'closed') {
      const err = new Error('SESSION_ALREADY_CLOSED: Ca làm việc này đã được đóng trước đó.');
      err.code = 'SESSION_ALREADY_CLOSED';
      throw err;
    }

    // Tính toán đối soát bằng cỗ máy tính toán chuẩn duy nhất
    const [ordersRes, registersRes] = await Promise.all([
      axiosClient.get('/orders'),
      registerApi.getAll().catch(() => ({ data: registerApi.getSyncRegisters() }))
    ]);
    const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    const allRegisters = Array.isArray(registersRes?.data) ? registersRes.data : (Array.isArray(registersRes) ? registersRes : registerApi.getSyncRegisters());

    const recon = calculateSessionReconciliation({
      session,
      orders: allOrders,
      registers: allRegisters,
      actualCash: Number(actualCash)
    });

    const discrepancy = recon.cashDifference;
    if (Math.abs(discrepancy) > 0 && (!closeNote || !closeNote.trim())) {
      const err = new Error(`DISCREPANCY_NOTE_REQUIRED: Có chênh lệch tiền mặt (${discrepancy > 0 ? '+' : ''}${discrepancy}₫). Vui lòng nhập lý do giải trình.`);
      err.code = 'DISCREPANCY_NOTE_REQUIRED';
      err.discrepancy = discrepancy;
      throw err;
    }

    const nowIso = new Date().toISOString();

    // 1. Cập nhật ca làm việc sang closed với snapshot tài chính đối soát bất biến
    const updateRes = await axiosClient.patch(`/workSessions/${id}`, {
      status: 'closed',
      endTime: nowIso,
      closedAt: nowIso,
      closedBy: actor.id,
      actualCash: recon.actualCash,
      expectedCash: recon.expectedCash,
      cashDifference: recon.cashDifference,
      cashDiscrepancy: recon.cashDifference,
      reconciliationStatus: recon.reconciliationStatus,
      grossSales: recon.grossSales,
      refundTotal: recon.refundTotal,
      netRevenue: recon.netRevenue,
      cashSales: recon.cashSales,
      cashRefunds: recon.cashRefunds,
      posBreakdown: recon.posBreakdown,
      reconciliationSnapshot: recon,
      note: closeNote.trim() ? (session.note ? `${session.note}\n[Đóng ca]: ${closeNote.trim()}` : `[Đóng ca]: ${closeNote.trim()}`) : (session.note || ''),
      closeNote: closeNote.trim(),
      totalRevenue: recon.totalRevenue,
      totalOrders: recon.completedOrderCount,
      updatedAt: nowIso
    });

    // 2. Reconcile các member còn present trong ca sang missing_checkout
    try {
      const membersRes = await axiosClient.get(`/workSessionMembers?workSessionId=${id}`);
      const members = Array.isArray(membersRes.data) ? membersRes.data : [];
      for (const m of members) {
        if (m.attendanceStatus === 'present') {
          await axiosClient.patch(`/workSessionMembers/${m.id}`, {
            attendanceStatus: 'missing_checkout',
            workingStatus: 'offline',
            checkOutTime: null,
            updatedAt: nowIso
          });
        }
      }
    } catch (mErr) {
      console.warn('[workSessionApi] Reconcile members on closeSession error:', mErr);
    }

    // 3. Ghi log kiểm toán
    logActivity({
      actor,
      action: ACTIVITY_ACTIONS.SESSION_CLOSED,
      entityType: 'workSession',
      entityId: id,
      workSessionId: id,
      metadata: {
        code: session.code,
        actualCash: recon.actualCash,
        expectedCash: recon.expectedCash,
        cashDifference: recon.cashDifference,
        cashDiscrepancy: recon.cashDifference,
        closeNote: closeNote.trim(),
        totalRevenue: recon.totalRevenue,
        totalOrders: recon.completedOrderCount
      }
    });

    return updateRes.data;
  },

  cancelSession: async (id, { reason = '', actor } = {}) => {
    if (!actor?.id) {
      const err = new Error('NOT_AUTHENTICATED: Người thực hiện chưa đăng nhập.');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);

    const sessionRes = await axiosClient.get(`/workSessions/${id}`);
    const session = sessionRes.data;
    if (!session) {
      const err = new Error('SESSION_NOT_FOUND: Không tìm thấy ca làm việc.');
      err.code = 'SESSION_NOT_FOUND';
      throw err;
    }

    validateSessionMutation(session, { status: 'cancelled' });

    const nowIso = new Date().toISOString();
    const updateRes = await axiosClient.patch(`/workSessions/${id}`, {
      status: 'cancelled',
      cancelReason: reason || 'Ca làm việc bị hủy',
      cancelledBy: actor.id,
      cancelledAt: nowIso,
      updatedAt: nowIso
    });

    logActivity({
      actor,
      action: ACTIVITY_ACTIONS.SESSION_CANCELLED,
      entityType: 'workSession',
      entityId: id,
      workSessionId: id,
      metadata: { code: session.code, reason }
    });

    return updateRes.data;
  },

  remove: () => {
    throw new Error('Dữ liệu ca làm việc (WorkSession) là nhật ký kiểm toán lịch sử và KHÔNG ĐƯỢC PHÉP XÓA.');
  },

  generateSessionCode: async (dateStr) => {
    const targetDate = dateStr || getBusinessDate(new Date());
    const formattedDate = targetDate.replace(/-/g, '');
    const prefix = `CA-${formattedDate}-`;

    const res = await axiosClient.get('/workSessions');
    const sessions = Array.isArray(res.data) ? res.data : [];

    let maxNum = 0;
    sessions.forEach(s => {
      if (s.code && s.code.startsWith(prefix)) {
        const numPart = s.code.replace(prefix, '');
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateNum = maxNum + 1 + attempt;
      const candidateCode = `${prefix}${String(candidateNum).padStart(2, '0')}`;
      const checkRes = await axiosClient.get(`/workSessions?code=${candidateCode}`);
      if (Array.isArray(checkRes.data) && checkRes.data.length === 0) {
        return candidateCode;
      }
    }
    throw new Error('Không thể tạo mã ca làm việc duy nhất, vui lòng thử lại.');
  },

  // 2. WORK SESSION MEMBER CRUD
  getMembers: (params = {}) => {
    let query = '';
    const searchParams = new URLSearchParams();
    if (params.workSessionId) searchParams.append('workSessionId', params.workSessionId);
    if (params.accountId) searchParams.append('accountId', params.accountId);
    if (params.attendanceStatus) searchParams.append('attendanceStatus', params.attendanceStatus);
    if (params.workingStatus) searchParams.append('workingStatus', params.workingStatus);
    if (params.shiftType) searchParams.append('shiftType', params.shiftType);
    const queryString = searchParams.toString();
    if (queryString) query = `?${queryString}`;
    return axiosClient.get(`/workSessionMembers${query}`);
  },

  getMemberById: (id) => axiosClient.get(`/workSessionMembers/${id}`),

  getMembersBySessionId: (sessionId) => axiosClient.get(`/workSessionMembers?workSessionId=${sessionId}`),

  getMembersByAccountId: (accountId) => axiosClient.get(`/workSessionMembers?accountId=${accountId}`),

  createMember: async (data, actor) => {
    if (actor !== undefined) {
      if (!actor) {
        assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
      } else if (actor.role === 'employee') {
        if (data.accountId && String(data.accountId) !== String(actor.id)) {
          const err = new Error('PERMISSION_DENIED: Nhân viên không thể thêm nhân viên khác vào ca làm việc.');
          err.code = 'PERMISSION_DENIED';
          err.requiredPermission = PERMISSIONS.WORK_SESSION_MANAGE;
          throw err;
        }
      } else {
        assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
      }
    }
    const attendanceStatus = data.attendanceStatus || 'present';

    // 1. Role Check: Admin/Staff không chấm công, không tạo WorkSessionMember
    if (data.accountId) {
      try {
        const accRes = await axiosClient.get(`/accounts/${data.accountId}`);
        const acc = accRes.data;
        if (acc && (acc.role === 'admin' || acc.role === 'staff')) {
          const err = new Error('Quản trị viên và Quản lý không cần điểm danh hoặc tham gia ca làm việc.');
          err.code = 'MANAGER_ATTENDANCE_RESTRICTED';
          throw err;
        }
      } catch (e) {
        if (e.code === 'MANAGER_ATTENDANCE_RESTRICTED') throw e;
      }
    }

    // 2. Session Status Check: Ca đã đóng hoặc đã hủy không thể tiếp nhận thành viên đang có mặt (present)
    if (data.workSessionId && attendanceStatus === 'present') {
      try {
        const sessionRes = await axiosClient.get(`/workSessions/${data.workSessionId}`);
        const session = sessionRes.data;
        if (session) {
          if (session.status === 'closed') {
            const err = new Error('Không thể thêm thành viên vào ca làm việc đã đóng.');
            err.code = 'SESSION_CLOSED';
            throw err;
          }
          if (session.status === 'cancelled') {
            const err = new Error('Không thể thêm thành viên vào ca làm việc đã hủy.');
            err.code = 'SESSION_CANCELLED';
            throw err;
          }
        }
      } catch (sErr) {
        if (sErr.code === 'SESSION_CLOSED' || sErr.code === 'SESSION_CANCELLED') throw sErr;
      }
    }

    // 3. Invariants Check (Fail-Closed) cho thành viên đang có mặt (present)
    if (data.workSessionId && attendanceStatus === 'present') {
      const membersRes = await axiosClient.get(`/workSessionMembers?workSessionId=${data.workSessionId}`);
      const members = Array.isArray(membersRes.data) ? membersRes.data : [];
      const activeMembers = members.filter(m => m.attendanceStatus === 'present' && m.id !== data.id);

      // Invariant 1: 1 POS <-> 1 Active Employee
      if (data.registerId) {
        const posOccupied = activeMembers.find(m => m.registerId === data.registerId && m.accountId !== data.accountId);
        if (posOccupied) {
          const err = new Error(`Quầy thu ngân ${data.registerId} đang được sử dụng bởi nhân viên khác.`);
          err.code = 'POS_OCCUPIED';
          throw err;
        }
      }

      // Invariant 2: 1 Employee <-> 1 Active POS
      if (data.accountId) {
        const employeeActiveElsewhere = activeMembers.find(m => m.accountId === data.accountId && m.registerId && m.registerId !== data.registerId);
        if (employeeActiveElsewhere) {
          const err = new Error(`Nhân viên đang hoạt động tại quầy thu ngân khác (${employeeActiveElsewhere.registerId}).`);
          err.code = 'EMPLOYEE_ACTIVE_ELSEWHERE';
          throw err;
        }
      }
    }

    const now = new Date().toISOString();
    const payload = {
      id: data.id || `wsm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workSessionId: data.workSessionId,
      accountId: data.accountId,
      registerId: data.registerId || null,
      shiftType: data.shiftType || 'morning',
      businessDate: data.businessDate || getBusinessDate(new Date()),
      attendanceStatus,
      checkInTime: data.checkInTime || null,
      checkOutTime: data.checkOutTime || null,
      workingStatus: data.workingStatus || 'offline',
      isLate: Boolean(data.isLate),
      lateMinutes: Number(data.lateMinutes) || 0,
      isEarly: Boolean(data.isEarly),
      note: data.note || '',
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    };
    return axiosClient.post('/workSessionMembers', payload);
  },

  patchMember: async (id, data, actor) => {
    let member = null;
    if (actor !== undefined || data.attendanceStatus) {
      const memberRes = await axiosClient.get(`/workSessionMembers/${id}`);
      member = memberRes.data;
    }

    if (actor !== undefined) {
      if (!actor) {
        assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
      } else if (!hasPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE)) {
        if (!member) {
          const err = new Error('MEMBER_NOT_FOUND: Không tìm thấy bản ghi thành viên ca.');
          err.code = 'MEMBER_NOT_FOUND';
          throw err;
        }
        if (String(member.accountId) !== String(actor.id)) {
          const err = new Error('PERMISSION_DENIED: Cần quyền "workSession.manage" để chỉnh sửa bản ghi ca của nhân viên khác.');
          err.code = 'PERMISSION_DENIED';
          err.requiredPermission = PERMISSIONS.WORK_SESSION_MANAGE;
          throw err;
        }
      }
    }

    if (data.attendanceStatus && member) {
      if (member.attendanceStatus === 'completed' || member.attendanceStatus === 'missing_checkout') {
        if (data.attendanceStatus !== member.attendanceStatus) {
          const err = new Error(`Trạng thái thành viên đã kết thúc (${member.attendanceStatus}) và không thể thay đổi.`);
          err.code = 'MEMBER_LIFECYCLE_TERMINAL';
          throw err;
        }
      }
    }
    return axiosClient.patch(`/workSessionMembers/${id}`, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  },

  removeMember: () => {
    const error = new Error('Dữ liệu thành viên ca làm việc (WorkSessionMember) là nhật ký kiểm toán lịch sử và KHÔNG ĐƯỢC PHÉP XÓA (WORKSESSION_MEMBER_DELETION_RESTRICTED).');
    error.code = 'WORKSESSION_MEMBER_DELETION_RESTRICTED';
    throw error;
  },

  // 3. WORKFLOW & AUDIT HELPER METHODS
  autoClosePastSessions: async (currentDateStr = null) => {
    const todayStr = currentDateStr || getBusinessDate(new Date());
    try {
      const res = await axiosClient.get('/workSessions');
      const sessions = Array.isArray(res.data) ? res.data : [];
      const [ordersRes, registersRes] = await Promise.all([
        axiosClient.get('/orders').catch(() => ({ data: [] })),
        registerApi.getAll().catch(() => ({ data: registerApi.getSyncRegisters() }))
      ]);
      const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const allRegisters = Array.isArray(registersRes?.data) ? registersRes.data : (Array.isArray(registersRes) ? registersRes : registerApi.getSyncRegisters());

      const pastActiveSessions = sessions.filter(s => s.date && s.date < todayStr && s.status === 'active');

      for (const session of pastActiveSessions) {
        const nowIso = new Date().toISOString();
        const recon = calculateSessionReconciliation({
          session,
          orders: allOrders,
          registers: allRegisters,
          actualCash: null // Không bịa số tiền thực tế kiểm đếm
        });

        await axiosClient.patch(`/workSessions/${session.id}`, {
          status: 'closed',
          endTime: session.endTime || nowIso,
          closedAt: session.endTime || nowIso,
          actualCash: null,
          expectedCash: recon.expectedCash,
          reconciliationStatus: RECONCILIATION_STATUS.UNRECONCILED,
          isAutoClosed: true,
          grossSales: recon.grossSales,
          refundTotal: recon.refundTotal,
          netRevenue: recon.netRevenue,
          cashSales: recon.cashSales,
          cashRefunds: recon.cashRefunds,
          posBreakdown: recon.posBreakdown,
          reconciliationSnapshot: recon,
          totalRevenue: recon.totalRevenue,
          totalOrders: recon.completedOrderCount,
          updatedAt: nowIso
        });

        try {
          const membersRes = await axiosClient.get(`/workSessionMembers?workSessionId=${session.id}`);
          const members = Array.isArray(membersRes.data) ? membersRes.data : [];
          for (const m of members) {
            if (m.attendanceStatus === 'present') {
              await axiosClient.patch(`/workSessionMembers/${m.id}`, {
                attendanceStatus: 'missing_checkout',
                checkOutTime: null,
                workingStatus: 'offline',
                updatedAt: nowIso
              });
            }
          }
        } catch (mErr) {
          console.warn('[workSessionApi] Reconcile past members error:', mErr);
        }
      }
    } catch (err) {
      console.warn('[workSessionApi] autoClosePastSessions error:', err);
    }
  },

  getActiveSessions: async () => {
    await workSessionApi.autoClosePastSessions();
    return axiosClient.get('/workSessions?status=active');
  },

  getUserActiveMembership: async (accountId) => {
    if (!accountId) return null;
    try {
      const res = await axiosClient.get(`/workSessionMembers?accountId=${accountId}&attendanceStatus=present`);
      const members = Array.isArray(res.data) ? res.data : [];
      if (members.length === 0) return null;

      // Tìm bản ghi member đầu tiên có ca tương ứng đang active
      for (const member of members) {
        try {
          const sessionRes = await axiosClient.get(`/workSessions/${member.workSessionId}`);
          const session = sessionRes.data;
          if (session && session.status === 'active') {
            return { session, member };
          }
        } catch {
          console.warn(`Không tìm thấy session ${member.workSessionId} cho member ${member.id}`);
        }
      }
      return null;
    } catch (err) {
      console.error('Lỗi khi lấy active membership:', err);
      return null;
    }
  },

  checkIn: async (memberId, actor) => {
    const memberRes = await axiosClient.get(`/workSessionMembers/${memberId}`);
    const member = memberRes.data;
    if (!member) {
      const err = new Error('Không tìm thấy bản ghi thành viên ca.');
      err.code = 'MEMBER_NOT_FOUND';
      throw err;
    }
    if (actor !== undefined) {
      if (!actor) {
        assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
      } else if (!hasPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE) && String(member.accountId) !== String(actor.id)) {
        const err = new Error('PERMISSION_DENIED: Cần quyền "workSession.manage" để check-in cho nhân viên khác.');
        err.code = 'PERMISSION_DENIED';
        err.requiredPermission = PERMISSIONS.WORK_SESSION_MANAGE;
        throw err;
      }
    }
    if (member.attendanceStatus === 'completed' || member.attendanceStatus === 'missing_checkout') {
      const err = new Error(`Không thể check-in lại cho thành viên đã ở trạng thái kết thúc (${member.attendanceStatus}).`);
      err.code = 'MEMBER_LIFECYCLE_TERMINAL';
      throw err;
    }

    const now = new Date().toISOString();
    const updatedMemberRes = await axiosClient.patch(`/workSessionMembers/${memberId}`, {
      attendanceStatus: 'present',
      checkInTime: member.checkInTime || now,
      workingStatus: 'active',
      updatedAt: now
    });

    // Nếu ca làm việc đang ở trạng thái 'planned', tự động kích hoạt ca sang 'active'
    try {
      const sessionRes = await axiosClient.get(`/workSessions/${member.workSessionId}`);
      const session = sessionRes.data;
      if (session && session.status === 'planned') {
        await axiosClient.patch(`/workSessions/${session.id}`, {
          status: 'active',
          updatedAt: now
        });
      }
    } catch (sessionErr) {
      console.warn('Lỗi khi kích hoạt trạng thái ca:', sessionErr);
    }

    return updatedMemberRes.data;
  },

  checkOut: async (memberId, actor) => {
    const memberRes = await axiosClient.get(`/workSessionMembers/${memberId}`);
    const member = memberRes.data;
    if (!member) {
      const err = new Error('Không tìm thấy bản ghi thành viên ca.');
      err.code = 'MEMBER_NOT_FOUND';
      throw err;
    }
    if (actor !== undefined) {
      if (!actor) {
        assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
      } else if (!hasPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE) && String(member.accountId) !== String(actor.id)) {
        const err = new Error('PERMISSION_DENIED: Cần quyền "workSession.manage" để check-out cho nhân viên khác.');
        err.code = 'PERMISSION_DENIED';
        err.requiredPermission = PERMISSIONS.WORK_SESSION_MANAGE;
        throw err;
      }
    }
    if (member.attendanceStatus === 'completed') {
      const err = new Error('Thành viên đã hoàn thành check-out trước đó.');
      err.code = 'ALREADY_CHECKED_OUT';
      throw err;
    }
    if (member.attendanceStatus === 'missing_checkout') {
      const err = new Error('Thành viên đã bị đánh dấu thiếu check-out do đóng ca.');
      err.code = 'MEMBER_MISSING_CHECKOUT';
      throw err;
    }
    if (member.attendanceStatus !== 'present') {
      const err = new Error('Chỉ có thể check-out thành viên đang có mặt (present).');
      err.code = 'INVALID_MEMBER_STATUS';
      throw err;
    }

    const now = new Date().toISOString();
    const res = await axiosClient.patch(`/workSessionMembers/${memberId}`, {
      attendanceStatus: 'completed',
      checkOutTime: now,
      workingStatus: 'offline',
      updatedAt: now
    });
    return res.data;
  },

  updateWorkingStatus: async (memberId, workingStatus, actor) => {
    const validStatuses = ['active', 'idle', 'busy', 'offline'];
    if (!validStatuses.includes(workingStatus)) {
      throw new Error(`workingStatus không hợp lệ: ${workingStatus}`);
    }
    if (actor !== undefined) {
      if (!actor) {
        assertPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE);
      } else if (!hasPermission(actor, PERMISSIONS.WORK_SESSION_MANAGE)) {
        const memberRes = await axiosClient.get(`/workSessionMembers/${memberId}`);
        const member = memberRes.data;
        if (!member) {
          const err = new Error('MEMBER_NOT_FOUND: Không tìm thấy bản ghi thành viên ca.');
          err.code = 'MEMBER_NOT_FOUND';
          throw err;
        }
        if (String(member.accountId) !== String(actor.id)) {
          const err = new Error('PERMISSION_DENIED: Cần quyền "workSession.manage" để thay đổi trạng thái của nhân viên khác.');
          err.code = 'PERMISSION_DENIED';
          err.requiredPermission = PERMISSIONS.WORK_SESSION_MANAGE;
          throw err;
        }
      }
    }
    const res = await axiosClient.patch(`/workSessionMembers/${memberId}`, {
      workingStatus,
      updatedAt: new Date().toISOString()
    });
    return res.data;
  },

  // 4. TỰ SINH CA THEO NGÀY LÀM VIỆC (1 Ca duy nhất / 1 Business Date)
  /**
   * Lấy hoặc tự động tạo đúng 1 WorkSession cho ngày dateStr (mặc định hôm nay).
   * Đảm bảo ca trước đó được tự động đóng, ca kế hoạch (planned) được kích hoạt thành active.
   * @param {string} dateStr - Chuỗi ngày định dạng YYYY-MM-DD
   * @param {Date} now - Thời điểm hiện tại (mặc định: new Date())
   * @returns {Promise<Object|null>} WorkSession object
   */
  getTodaySessionForDate: async (dateStr = null, now = new Date()) => {
    const targetDate = dateStr || getBusinessDate(now);

    if (_inFlightSessionPromises.has(targetDate)) {
      return _inFlightSessionPromises.get(targetDate);
    }

    const task = (async () => {
      // 1. Tự động đóng các ca ngày cũ nếu còn active
      await workSessionApi.autoClosePastSessions(targetDate);

      const sessionId = `ws_${targetDate}`;
      const sessionCode = `CA-${targetDate.replace(/-/g, '')}-01`;
      const formattedDate = targetDate.includes('-')
        ? `${targetDate.split('-')[2]}/${targetDate.split('-')[1]}/${targetDate.split('-')[0]}`
        : targetDate;

      // 2. Tìm ca làm việc duy nhất của ngày này
      let session = null;
      try {
        const existingRes = await axiosClient.get(`/workSessions?date=${targetDate}`);
        const sessions = Array.isArray(existingRes.data) ? existingRes.data : [];
        session = sessions.find(s => s.status !== 'cancelled') || null;
      } catch {
        // ignore
      }

      if (!session) {
        try {
          const directRes = await axiosClient.get(`/workSessions/${sessionId}`);
          if (directRes.data && directRes.data.status !== 'cancelled') {
            session = directRes.data;
          }
        } catch {
          // 404 = chưa tồn tại
        }
      }

      // 3. Nếu chưa có ca nào cho ngày này -> Tạo mới đúng 1 WorkSession cho cả ngày
      if (!session) {
        try {
          const createRes = await axiosClient.post('/workSessions', {
            id:           sessionId,
            code:         sessionCode,
            date:         targetDate,
            shiftType:    'daily',
            name:         `Ca làm việc ngày ${formattedDate}`,
            startTime:    now.toISOString(),
            endTime:      null,
            status:       'active',
            initialCash:  0,
            actualCash:   null,
            totalRevenue: 0,
            totalOrders:  0,
            note:         '',
            createdBy:    null,
            closedBy:     null,
            createdAt:    now.toISOString(),
            updatedAt:    now.toISOString()
          });
          session = createRes.data;
        } catch {
          // Race condition fallback: fetch lại
          try {
            const retryRes = await axiosClient.get(`/workSessions?date=${targetDate}`);
            const retryList = Array.isArray(retryRes.data) ? retryRes.data : [];
            session = retryList.find(s => s.status !== 'cancelled') || null;
            if (!session) {
              const retryDirect = await axiosClient.get(`/workSessions/${sessionId}`);
              session = retryDirect.data || null;
            }
          } catch (retryErr) {
            console.error('[workSessionApi] getTodaySessionForDate: không thể tạo/lấy session:', retryErr);
            return null;
          }
        }
      }

      if (!session) {
        return null;
      }

      // Ca đã bị huỷ -> return session so caller can handle
      if (session.status === 'cancelled') {
        return session;
      }

      // Ca ở planned -> kích hoạt
      if (session.status === 'planned') {
        try {
          await axiosClient.patch(`/workSessions/${session.id}`, {
            status: 'active',
            updatedAt: now.toISOString()
          });
          session = { ...session, status: 'active' };
        } catch (patchErr) {
          console.warn('[workSessionApi] Không thể kích hoạt ca planned:', patchErr);
        }
      }

      return session;
    })();

    _inFlightSessionPromises.set(targetDate, task);
    try {
      return await task;
    } finally {
      _inFlightSessionPromises.delete(targetDate);
    }
  },

  /**
   * @param {Date} now - Thời điểm đăng nhập (thường là `new Date()`)
   * @param {boolean} isAdmin - Nếu true, không gắn cờ đi muộn
   */
  getOrCreateWorkSession: async (now = new Date(), isAdmin = false) => {
    const dateStr = getBusinessDate(now);

    // 1. Xác định khung giờ làm việc hiện tại
    const shiftInfo = determineShiftForTime(now);
    if (!shiftInfo) {
      return { workSession: null, reason: 'out_of_business_hours', isLate: false, lateMinutes: 0 };
    }

    if (shiftInfo.isRestPeriod) {
      return {
        workSession: null,
        reason: 'rest_period',
        isRestPeriod: true,
        isLate: false,
        lateMinutes: 0,
        currentShift: shiftInfo
      };
    }

    // 2. Lấy hoặc tạo ca duy nhất của ngày hôm nay
    const session = await workSessionApi.getTodaySessionForDate(dateStr, now);

    if (!session) {
      return { workSession: null, reason: 'error', isLate: false, lateMinutes: 0 };
    }

    // Ca đã bị huỷ -> không cho vào
    if (session.status === 'cancelled') {
      return { workSession: null, reason: 'session_cancelled', isLate: false, lateMinutes: 0 };
    }

    return {
      workSession:  session,
      isLate:       isAdmin ? false : shiftInfo.isLate,
      lateMinutes:  isAdmin ? 0     : shiftInfo.lateMinutes,
      isEarly:      isAdmin ? false : shiftInfo.isEarly || false,
      currentShift: shiftInfo,
      reason:       null
    };
  }
};
