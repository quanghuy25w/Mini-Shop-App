import { getBusinessDate, getVnMinutes, getVnParts } from './businessDate';
import { calculateSessionReconciliation } from './reconciliation';
import { registerApi } from '../api/registerApi';

export const SHIFT_BOUNDARIES = {
  morning: {
    start: '07:30',
    end: '12:00',
    startMins: 7 * 60 + 30, // 450
    endMins: 12 * 60,       // 720
    name: 'Ca sáng',
    codeSuffix: '01',
    standardMinutes: 270, // 4 hours 30 mins
  },
  afternoon: {
    start: '13:00',
    end: '18:30',
    startMins: 13 * 60,      // 780
    endMins: 18 * 60 + 30,   // 1110
    name: 'Ca chiều',
    codeSuffix: '02',
    standardMinutes: 330, // 5 hours 30 mins
  },
  evening: {
    start: '19:00',
    end: '22:00',
    startMins: 19 * 60,      // 1140
    endMins: 22 * 60,        // 1320
    name: 'Ca tối',
    codeSuffix: '03',
    standardMinutes: 180, // 3 hours
  },
};

export const REST_PERIODS = [
  { start: '12:00', end: '13:00', startMins: 720, endMins: 780, label: 'Nghỉ trưa' },
  { start: '18:30', end: '19:00', startMins: 1110, endMins: 1140, label: 'Nghỉ tối' },
];

/**
 * Extracts total minutes from midnight (0..1439) in Asia/Ho_Chi_Minh timezone.
 * Robust against timezone differences when parsing literal ISO strings vs Date objects.
 */
export const extractTimeMinutes = (timeInput) => {
  if (!timeInput) return null;
  if (timeInput instanceof Date) {
    return getVnMinutes(timeInput);
  }
  if (typeof timeInput === 'number') {
    return getVnMinutes(new Date(timeInput));
  }
  if (typeof timeInput === 'string') {
    if (timeInput.includes('T') || timeInput.includes('-')) {
      const d = new Date(timeInput);
      if (!isNaN(d.getTime())) {
        return getVnMinutes(d);
      }
    }
    if (timeInput.includes(':')) {
      const parts = timeInput.split(':');
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (!isNaN(h) && !isNaN(m)) {
        return h * 60 + m;
      }
    }
  }
  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) {
    return getVnMinutes(d);
  }
  return null;
};

/**
 * Checks if a given timestamp falls within fixed rest periods (12:00–13:00 or 18:30–19:00).
 */
export const isTimeInRestPeriod = (timeInput) => {
  const totalMinutes = extractTimeMinutes(timeInput);
  if (totalMinutes === null) return false;

  // 12:00 (720) to 13:00 (780)
  const isLunchRest = totalMinutes >= 720 && totalMinutes < 780;
  // 18:30 (1110) to 19:00 (1140)
  const isDinnerRest = totalMinutes >= 1110 && totalMinutes < 1140;

  return isLunchRest || isDinnerRest;
};

/**
 * Formats duration in minutes into a human-readable string (e.g. 595 -> "9h55" or "9 giờ 55 phút").
 */
export const formatDuration = (totalMinutes) => {
  const safeMinutes = Math.max(0, Math.round(totalMinutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  const formattedShort = `${hours}h${String(mins).padStart(2, '0')}`;
  const formattedLong = hours > 0 
    ? `${hours} giờ ${mins > 0 ? `${mins} phút` : ''}`.trim()
    : `${mins} phút`;

  return {
    hours,
    minutes: mins,
    totalMinutes: safeMinutes,
    formatted: formattedShort,
    longFormatted: formattedLong,
  };
};

/**
 * Formats a Date object or ISO string to HH:mm:ss in VN timezone.
 */
export const formatTimeOnly = (isoString) => {
  if (!isoString) return '--:--:--';
  const d = typeof isoString === 'string' || typeof isoString === 'number' ? new Date(isoString) : isoString;
  if (isNaN(d.getTime())) return '--:--:--';
  const parts = getVnParts(d);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
};

/**
 * Formats a Date object or ISO string to HH:mm in VN timezone.
 */
export const formatShortTime = (isoString) => {
  if (!isoString) return '--:--';
  const d = typeof isoString === 'string' || typeof isoString === 'number' ? new Date(isoString) : isoString;
  if (isNaN(d.getTime())) return '--:--';
  const parts = getVnParts(d);
  return `${parts.hour}:${parts.minute}`;
};

/**
 * Calculates working duration in minutes for a specific shift participation.
 * Clamps check-in to shift official start (if early) and check-out to shift official end.
 * Rest periods between shifts are inherently excluded.
 */
export const calculateShiftWorkDuration = (member, session) => {
  let shiftType = member?.shiftType;
  if (!shiftType && session?.shiftType && SHIFT_BOUNDARIES[session.shiftType]) {
    shiftType = session.shiftType;
  }
  if (!shiftType && member?.checkInTime) {
    const rawCheckInMins = extractTimeMinutes(member.checkInTime);
    if (rawCheckInMins !== null) {
      if (rawCheckInMins < 720) shiftType = 'morning';
      else if (rawCheckInMins < 1110) shiftType = 'afternoon';
      else shiftType = 'evening';
    }
  }
  if (!shiftType || !SHIFT_BOUNDARIES[shiftType]) shiftType = 'morning';
  const config = SHIFT_BOUNDARIES[shiftType] || SHIFT_BOUNDARIES.morning;

  // Determine effective check-in minutes
  const rawCheckInMins = extractTimeMinutes(member?.checkInTime);
  const checkInMins = rawCheckInMins !== null ? rawCheckInMins : config.startMins;

  // Effective start cannot start earlier than official shift start
  const effectiveStartMins = Math.max(checkInMins, config.startMins);

  // Determine effective check-out minutes
  let checkOutMins;
  const rawCheckOutMins = extractTimeMinutes(member?.checkOutTime);
  if (rawCheckOutMins !== null) {
    checkOutMins = rawCheckOutMins;
  } else if (session?.status === 'closed') {
    checkOutMins = config.endMins;
  } else {
    // Active session: min(nowMins, config.endMins)
    const now = new Date();
    const nowMins = getVnMinutes(now);
    checkOutMins = Math.min(nowMins, config.endMins);
  }

  // Effective end cannot exceed official shift end
  const effectiveEndMins = Math.min(checkOutMins, config.endMins);

  let durationMinutes = 0;
  if (effectiveEndMins > effectiveStartMins) {
    durationMinutes = effectiveEndMins - effectiveStartMins;
  }

  return {
    shiftType,
    shiftName: config.name,
    officialStart: config.start,
    officialEnd: config.end,
    checkInTime: member?.checkInTime || null,
    checkOutTime: member?.checkOutTime || null,
    isLate: Boolean(member?.isLate),
    lateMinutes: Number(member?.lateMinutes || 0),
    durationMinutes,
    durationFormatted: formatDuration(durationMinutes),
  };
};

/**
 * Checks if an order was created on a given date (YYYY-MM-DD).
 */
export const isOrderOnDate = (order, dateStr) => {
  if (!order || !dateStr) return false;
  if (order.businessDate) return order.businessDate === dateStr;
  if (order.createdAt) return getBusinessDate(order.createdAt) === dateStr;
  return false;
};

/**
 * Calculates Daily Work Summary for an employee on a given date.
 */
export const calculateDailyWorkSummary = ({
  dateStr,
  employeeId,
  accountId,
  actor,
  members = [],
  sessions = [],
  orders = [],
  staffList = [],
  accountList = [],
  activityLogs = [],
}) => {
  // Resolve staff and account
  let targetStaff = staffList.find(s => String(s.id) === String(employeeId) || String(s.employeeCode) === String(employeeId));
  let targetAccount = accountList.find(a => String(a.id) === String(accountId));

  if (!targetStaff && targetAccount?.employeeId) {
    targetStaff = staffList.find(s => String(s.id) === String(targetAccount.employeeId));
  }
  if (!targetAccount && targetStaff) {
    targetAccount = accountList.find(a => String(a.employeeId) === String(targetStaff.id));
  }

  const resolvedAccountId = targetAccount?.id || accountId || actor?.id;
  const resolvedEmployeeId = targetStaff?.id || employeeId || actor?.employeeId;

  const resolvedEmployeeCode = targetStaff?.employeeCode || targetAccount?.employeeCode || actor?.employeeCode || 'NV---';
  const resolvedName = targetStaff?.name || targetAccount?.name || actor?.name || 'Nhân viên';

  // Filter sessions for this date
  const sessionsOnDate = sessions.filter(s => s.date === dateStr || (s.id && s.id.startsWith(dateStr)));
  const sessionMap = new Map(sessionsOnDate.map(s => [s.id, s]));

  // Find all membership records for this account on this date
  const employeeMembers = members.filter(m => {
    if (String(m.accountId) !== String(resolvedAccountId)) return false;
    const session = sessionMap.get(m.workSessionId) || sessions.find(s => s.id === m.workSessionId);
    if (session && (session.date === dateStr || session.id.startsWith(dateStr))) return true;
    if (m.businessDate && m.businessDate === dateStr) return true;
    if (m.checkInTime && getBusinessDate(m.checkInTime) === dateStr) return true;
    return false;
  });

  // Calculate duration and details for each shift
  const shiftsParticipated = employeeMembers.map(member => {
    const session = sessionMap.get(member.workSessionId) || sessions.find(s => s.id === member.workSessionId);
    return {
      memberId: member.id,
      workSessionId: member.workSessionId,
      workSessionCode: session?.code || member.workSessionId,
      ...calculateShiftWorkDuration(member, session, dateStr),
    };
  });

  // Sort shifts chronologically (morning -> afternoon -> evening)
  const shiftOrder = { morning: 1, afternoon: 2, evening: 3 };
  shiftsParticipated.sort((a, b) => (shiftOrder[a.shiftType] || 0) - (shiftOrder[b.shiftType] || 0));

  // Aggregate total daily work minutes and late minutes
  const totalWorkMinutes = shiftsParticipated.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalLateMinutes = shiftsParticipated.reduce((sum, s) => sum + s.lateMinutes, 0);
  const isLateToday = shiftsParticipated.some(s => s.isLate);

  // Filter completed orders on this date created by this employee/account
  const completedOrders = orders.filter(o => {
    if (String(o.accountId) !== String(resolvedAccountId)) return false;
    if (o.status !== 'completed') return false; // exclude cancelled orders
    return isOrderOnDate(o, dateStr);
  });

  // Calculate completed order metrics
  const completedOrderCount = completedOrders.length;
  const totalSalesAmount = completedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  // Detailed sales list with item-level details
  const salesDetails = completedOrders.map(order => {
    const orderSession = sessionMap.get(order.workSessionId) || sessions.find(s => s.id === order.workSessionId);
    return {
      orderId: order.id,
      orderCode: order.code,
      createdAt: order.createdAt,
      timeFormatted: formatTimeOnly(order.createdAt),
      seller: {
        accountId: resolvedAccountId,
        employeeId: resolvedEmployeeId,
        employeeCode: resolvedEmployeeCode,
        employeeName: resolvedName,
      },
      items: Array.isArray(order.items) ? order.items.map(i => ({
        productId: i.productId,
        productName: i.productName || 'Sản phẩm',
        quantity: i.quantity || 1,
        price: i.price || 0,
        subtotal: (i.quantity || 1) * (i.price || 0),
      })) : [],
      totalAmount: order.totalAmount || 0,
      workSessionId: order.workSessionId || null,
      workSessionCode: orderSession?.code || order.workSessionId || null,
      isRestPeriodSale: isTimeInRestPeriod(order.createdAt),
    };
  });

  // Filter relevant activity logs on this date for this actor
  const employeeLogs = activityLogs.filter(log => {
    if (String(log.actorId) !== String(resolvedAccountId)) return false;
    const logDate = log.timestamp ? getBusinessDate(log.timestamp) : '';
    return logDate === dateStr;
  });

  return {
    date: dateStr,
    employee: {
      employeeId: resolvedEmployeeId,
      employeeCode: resolvedEmployeeCode,
      name: resolvedName,
      role: targetAccount?.role || actor?.role || 'employee',
      accountId: resolvedAccountId,
    },
    shiftsParticipated,
    shiftsCount: shiftsParticipated.length,
    totalWorkMinutes,
    totalWorkDuration: formatDuration(totalWorkMinutes),
    isLate: isLateToday,
    totalLateMinutes,
    completedOrderCount,
    totalSalesAmount,
    salesDetails,
    activityLogs: employeeLogs,
  };
};

/**
 * Calculates Monthly Work Summary for an employee for a given month (YYYY-MM).
 */
export const calculateMonthlyWorkSummary = ({
  monthStr, // e.g. "2026-09"
  employeeId,
  accountId,
  actor,
  members = [],
  sessions = [],
  orders = [],
  staffList = [],
  accountList = [],
  activityLogs = [],
}) => {
  // Resolve staff and account
  let targetStaff = staffList.find(s => String(s.id) === String(employeeId) || String(s.employeeCode) === String(employeeId));
  let targetAccount = accountList.find(a => String(a.id) === String(accountId));

  if (!targetStaff && targetAccount?.employeeId) {
    targetStaff = staffList.find(s => String(s.id) === String(targetAccount.employeeId));
  }
  if (!targetAccount && targetStaff) {
    targetAccount = accountList.find(a => String(a.employeeId) === String(targetStaff.id));
  }

  const resolvedAccountId = targetAccount?.id || accountId || actor?.id;
  const resolvedEmployeeId = targetStaff?.id || employeeId || actor?.employeeId;

  const resolvedEmployeeCode = targetStaff?.employeeCode || targetAccount?.employeeCode || actor?.employeeCode || 'NV---';
  const resolvedName = targetStaff?.name || targetAccount?.name || actor?.name || 'Nhân viên';

  // Collect all unique dates in this month where the employee participated or made sales
  const activeDateSet = new Set();

  sessions.forEach(s => {
    if (s.date && s.date.startsWith(monthStr)) {
      activeDateSet.add(s.date);
    }
  });

  members.forEach(m => {
    if (String(m.accountId) === String(resolvedAccountId)) {
      if (m.businessDate && m.businessDate.startsWith(monthStr)) {
        activeDateSet.add(m.businessDate);
      } else if (m.checkInTime) {
        const d = getBusinessDate(m.checkInTime);
        if (d.startsWith(monthStr)) activeDateSet.add(d);
      }
    }
  });

  orders.forEach(o => {
    if (String(o.accountId) === String(resolvedAccountId)) {
      if (o.businessDate && o.businessDate.startsWith(monthStr)) {
        activeDateSet.add(o.businessDate);
      } else if (o.createdAt) {
        const d = getBusinessDate(o.createdAt);
        if (d.startsWith(monthStr)) activeDateSet.add(d);
      }
    }
  });

  const sortedDates = Array.from(activeDateSet).sort();

  // Generate daily summaries for all active dates
  const dailyBreakdown = [];
  let totalMonthlyWorkMinutes = 0;
  let totalMonthlyCompletedOrders = 0;
  let totalMonthlySalesAmount = 0;
  let totalWorkingDays = 0;

  sortedDates.forEach(dateStr => {
    const dailySummary = calculateDailyWorkSummary({
      dateStr,
      employeeId: resolvedEmployeeId,
      accountId: resolvedAccountId,
      actor,
      members,
      sessions,
      orders,
      staffList,
      accountList,
      activityLogs,
    });

    if (dailySummary.shiftsCount > 0 || dailySummary.completedOrderCount > 0) {
      dailyBreakdown.push({
        date: dateStr,
        shiftsCount: dailySummary.shiftsCount,
        shifts: dailySummary.shiftsParticipated,
        durationMinutes: dailySummary.totalWorkMinutes,
        durationFormatted: dailySummary.totalWorkDuration,
        completedOrderCount: dailySummary.completedOrderCount,
        totalSalesAmount: dailySummary.totalSalesAmount,
        isLate: dailySummary.isLate,
        lateMinutes: dailySummary.totalLateMinutes,
      });

      totalMonthlyWorkMinutes += dailySummary.totalWorkMinutes;
      totalMonthlyCompletedOrders += dailySummary.completedOrderCount;
      totalMonthlySalesAmount += dailySummary.totalSalesAmount;
      if (dailySummary.shiftsCount > 0 || dailySummary.totalWorkMinutes > 0) {
        totalWorkingDays += 1;
      }
    }
  });

  const averageDailyMinutes = totalWorkingDays > 0 ? Math.round(totalMonthlyWorkMinutes / totalWorkingDays) : 0;

  return {
    month: monthStr,
    employee: {
      employeeId: resolvedEmployeeId,
      employeeCode: resolvedEmployeeCode,
      name: resolvedName,
      role: targetAccount?.role || actor?.role || 'employee',
      accountId: resolvedAccountId,
    },
    totalWorkMinutes: totalMonthlyWorkMinutes,
    totalWorkDuration: formatDuration(totalMonthlyWorkMinutes),
    totalWorkingDays,
    totalCompletedOrders: totalMonthlyCompletedOrders,
    totalSalesAmount: totalMonthlySalesAmount,
    averageDailyMinutes,
    averageDailyDuration: formatDuration(averageDailyMinutes),
    dailyBreakdown,
  };
};

/**
 * Pure validation engine for data consistency across WorkSessions, Orders,
 * Inventory Transactions, POS assignments, and Products on a given business date.
 *
 * Returns structured findings array and authentic boolean evaluation.
 */
export const validateReportingConsistency = ({
  dateStr,
  sessions = [],
  members = [],
  orders = [],
  inventoryTransactions = [],
  products = [],
  registers = [],
} = {}) => {
  const findings = [];

  const dateSessions = (sessions || []).filter(s => s.date === dateStr || (s.id && s.id.startsWith(dateStr)));
  const sessionMap = new Map(dateSessions.map(s => [s.id, s]));

  // 1. WorkSession Integrity Invariants
  // 1a. Duplicate non-cancelled sessions on same business date
  const nonCancelledSessions = dateSessions.filter(s => s.status !== 'cancelled');
  if (nonCancelledSessions.length > 1) {
    findings.push({
      severity: 'critical',
      type: 'DUPLICATE_WORK_SESSION',
      entity: 'workSession',
      entityId: nonCancelledSessions.map(s => s.id).join(', '),
      businessDate: dateStr,
      message: `Phát hiện ${nonCancelledSessions.length} ca làm việc không bị hủy trong cùng ngày kinh doanh ${dateStr}`,
      metadata: { sessionIds: nonCancelledSessions.map(s => s.id) },
    });
  }

  // 1b. Auto-closed session must NOT have fabricated actualCash
  dateSessions.forEach(session => {
    if (session.status === 'closed' && session.isAutoClosed && session.actualCash !== null && session.actualCash !== undefined) {
      findings.push({
        severity: 'critical',
        type: 'INVALID_AUTOCLOSE_ACTUAL_CASH',
        entity: 'workSession',
        entityId: session.id,
        businessDate: dateStr,
        message: `Ca đóng tự động (${session.code || session.id}) không được phép tự động sinh số tiền thực tế (actualCash)`,
        metadata: { sessionId: session.id, actualCash: session.actualCash },
      });
    }
  });

  // 1c. Manual closed session without actualCash
  dateSessions.forEach(session => {
    if (session.status === 'closed' && !session.isAutoClosed && (session.actualCash === null || session.actualCash === undefined)) {
      findings.push({
        severity: 'warning',
        type: 'UNRECONCILED_MANUAL_CLOSE',
        entity: 'workSession',
        entityId: session.id,
        businessDate: dateStr,
        message: `Ca đóng thủ công (${session.code || session.id}) thiếu số liệu tiền mặt thực đếm`,
        metadata: { sessionId: session.id },
      });
    }
  });

  // 2. Order & Session Invariants
  const dateOrders = (orders || []).filter(o => isOrderOnDate(o, dateStr));
  dateOrders.forEach(order => {
    // 2a. Order referencing non-existent WorkSession
    if (order.workSessionId && !(sessions || []).some(s => s.id === order.workSessionId)) {
      findings.push({
        severity: 'warning',
        type: 'ORPHAN_ORDER_SESSION',
        entity: 'order',
        entityId: order.id,
        businessDate: dateStr,
        message: `Đơn hàng ${order.code || order.id} liên kết với ca làm việc không tồn tại (${order.workSessionId})`,
        metadata: { orderId: order.id, orderCode: order.code, workSessionId: order.workSessionId },
      });
    }

    // 2b. Order date mismatch with linked session date
    if (order.workSessionId) {
      const linkedSession = (sessions || []).find(s => s.id === order.workSessionId);
      const orderDate = order.businessDate || (order.createdAt ? getBusinessDate(order.createdAt) : null);
      if (linkedSession && linkedSession.date && orderDate && linkedSession.date !== orderDate) {
        findings.push({
          severity: 'warning',
          type: 'ORDER_SESSION_DATE_MISMATCH',
          entity: 'order',
          entityId: order.id,
          businessDate: dateStr,
          message: `Ngày kinh doanh của đơn (${orderDate}) không khớp với ngày ca làm việc (${linkedSession.date})`,
          metadata: { orderId: order.id, orderDate, sessionDate: linkedSession.date, workSessionId: linkedSession.id },
        });
      }
    }

    // 2c. Order missing registerId or invalid register
    if (!order.registerId) {
      findings.push({
        severity: 'warning',
        type: 'ORDER_MISSING_REGISTER',
        entity: 'order',
        entityId: order.id,
        businessDate: dateStr,
        message: `Đơn hàng ${order.code || order.id} thiếu thông tin quầy thu ngân (registerId)`,
        metadata: { orderId: order.id, orderCode: order.code },
      });
    } else if (Array.isArray(registers) && registers.length > 0) {
      const regExists = registers.some(r => r.id === order.registerId);
      if (!regExists) {
        findings.push({
          severity: 'warning',
          type: 'ORDER_INVALID_REGISTER',
          entity: 'order',
          entityId: order.id,
          businessDate: dateStr,
          message: `Đơn hàng ${order.code || order.id} liên kết với quầy không hợp lệ (${order.registerId})`,
          metadata: { orderId: order.id, registerId: order.registerId },
        });
      }
    }

    // 2d. Inconsistent cancellation / refund
    if (order.status === 'cancelled' || order.status === 'historical_cancelled') {
      const refundAmt = Number(order.refundAmount ?? order.totalAmount ?? 0);
      const totalAmt = Number(order.totalAmount || 0);
      if (refundAmt < 0 || (totalAmt >= 0 && refundAmt > totalAmt)) {
        findings.push({
          severity: 'critical',
          type: 'INCONSISTENT_CANCELLATION_REFUND',
          entity: 'order',
          entityId: order.id,
          businessDate: dateStr,
          message: `Số tiền hoàn (${refundAmt}) không hợp lệ so với giá trị đơn ${order.code || order.id} (${totalAmt})`,
          metadata: { orderId: order.id, refundAmount: refundAmt, totalAmount: totalAmt },
        });
      }
    }
  });

  // 3. POS & Member Assignment Invariants
  const dateMembers = (members || []).filter(m => {
    const s = sessionMap.get(m.workSessionId) || (sessions || []).find(sess => sess.id === m.workSessionId);
    if (s && (s.date === dateStr || s.id.startsWith(dateStr))) return true;
    if (m.businessDate && m.businessDate === dateStr) return true;
    if (m.checkInTime && getBusinessDate(m.checkInTime) === dateStr) return true;
    return false;
  });

  const activeMembersInSession = dateMembers.filter(m =>
    m.attendanceStatus === 'present' && m.workingStatus !== 'offline' && m.registerId
  );

  // 3a. POS occupied by multiple active members concurrently
  const posAssignmentMap = new Map();
  activeMembersInSession.forEach(m => {
    const key = `${m.workSessionId || 'default'}_${m.registerId}`;
    if (!posAssignmentMap.has(key)) {
      posAssignmentMap.set(key, []);
    }
    posAssignmentMap.get(key).push(m);
  });

  posAssignmentMap.forEach((membersAtPos) => {
    if (membersAtPos.length > 1) {
      const regId = membersAtPos[0].registerId;
      findings.push({
        severity: 'warning',
        type: 'POS_CONCURRENT_ASSIGNMENT',
        entity: 'register',
        entityId: regId,
        businessDate: dateStr,
        message: `Quầy thu ngân ${regId} đang được gán cho nhiều hơn một nhân viên trực đồng thời`,
        metadata: {
          registerId: regId,
          memberIds: membersAtPos.map(m => m.id),
          accountIds: membersAtPos.map(m => m.accountId),
        },
      });
    }
  });

  // 3b. Active member occupying multiple POS terminals concurrently
  const memberPosMap = new Map();
  activeMembersInSession.forEach(m => {
    const key = `${m.workSessionId || 'default'}_${m.accountId}`;
    if (!memberPosMap.has(key)) {
      memberPosMap.set(key, []);
    }
    memberPosMap.get(key).push(m.registerId);
  });

  memberPosMap.forEach((registersAssigned, key) => {
    const uniqueRegisters = Array.from(new Set(registersAssigned));
    if (uniqueRegisters.length > 1) {
      findings.push({
        severity: 'warning',
        type: 'MEMBER_MULTIPLE_POS',
        entity: 'member',
        entityId: key,
        businessDate: dateStr,
        message: `Nhân viên đang chiếm giữ đồng thời nhiều quầy thu ngân (${uniqueRegisters.join(', ')})`,
        metadata: { registers: uniqueRegisters },
      });
    }
  });

  // 3c. Terminal member with workingStatus !== offline
  dateMembers.forEach(m => {
    if (m.attendanceStatus && m.attendanceStatus !== 'present' && m.workingStatus && m.workingStatus !== 'offline') {
      findings.push({
        severity: 'warning',
        type: 'INVALID_MEMBER_WORKING_STATUS',
        entity: 'member',
        entityId: m.id,
        businessDate: dateStr,
        message: `Nhân viên đã kết thúc/vắng mặt (${m.attendanceStatus}) nhưng trạng thái làm việc vẫn chưa offline (${m.workingStatus})`,
        metadata: { memberId: m.id, attendanceStatus: m.attendanceStatus, workingStatus: m.workingStatus },
      });
    }
  });

  // 4. Inventory Invariants
  const dateInventory = (inventoryTransactions || []).filter(t => {
    if (t.businessDate) return t.businessDate === dateStr;
    if (t.createdAt) return getBusinessDate(t.createdAt) === dateStr;
    return false;
  });

  if (dateInventory.length > 0) {
    const completedDateOrders = dateOrders.filter(o => o.status === 'completed');
    completedDateOrders.forEach(order => {
      const orderItems = Array.isArray(order.items) ? order.items : [];
      if (orderItems.length > 0) {
        const relatedTx = dateInventory.filter(t =>
          (t.orderId && String(t.orderId) === String(order.id)) ||
          (t.referenceId && String(t.referenceId) === String(order.id)) ||
          (t.orderCode && order.code && t.orderCode === order.code)
        );
        const saleTx = relatedTx.filter(t => t.type === 'OUT' || t.reason === 'SALE');
        if (saleTx.length === 0) {
          findings.push({
            severity: 'warning',
            type: 'ORDER_MISSING_INVENTORY_DEDUCTION',
            entity: 'order',
            entityId: order.id,
            businessDate: dateStr,
            message: `Đơn hàng hoàn tất ${order.code || order.id} không tìm thấy giao dịch trừ kho (SALE)`,
            metadata: { orderId: order.id, orderCode: order.code },
          });
        } else {
          // Stock movement quantity mismatch vs order item quantity
          const totalOrderQty = orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          const totalTxQty = saleTx.reduce((sum, tx) => {
            if (Array.isArray(tx.items)) {
              return sum + tx.items.reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
            }
            return sum + (Number(tx.quantity) || 0);
          }, 0);
          if (totalTxQty > 0 && totalTxQty !== totalOrderQty) {
            findings.push({
              severity: 'critical',
              type: 'INVENTORY_QUANTITY_MISMATCH',
              entity: 'order',
              entityId: order.id,
              businessDate: dateStr,
              message: `Số lượng hàng trừ kho (${totalTxQty}) không khớp với số lượng trên đơn ${order.code || order.id} (${totalOrderQty})`,
              metadata: { orderId: order.id, totalOrderQty, totalTxQty },
            });
          }
        }
      }
    });

    // 4b. Orphan SALE inventory transactions
    const saleTransactions = dateInventory.filter(t => t.reason === 'SALE' || (t.type === 'OUT' && (t.orderId || t.orderCode)));
    saleTransactions.forEach(tx => {
      const linkedOrderId = tx.orderId || tx.referenceId;
      if (linkedOrderId) {
        const foundOrder = (orders || []).find(o => String(o.id) === String(linkedOrderId) || o.code === tx.orderCode);
        if (!foundOrder) {
          findings.push({
            severity: 'warning',
            type: 'ORPHAN_INVENTORY_TRANSACTION',
            entity: 'inventoryTransaction',
            entityId: tx.id,
            businessDate: dateStr,
            message: `Giao dịch xuất kho SALE (${tx.id}) liên kết tới đơn hàng không tồn tại (${linkedOrderId})`,
            metadata: { transactionId: tx.id, linkedOrderId },
          });
        }
      }
    });

    // 4c. Restocked order missing CANCEL_RESTOCK transaction
    const restockedOrders = dateOrders.filter(o => (o.status === 'cancelled' || o.status === 'historical_cancelled') && o.restocked === true);
    restockedOrders.forEach(order => {
      const restockTx = dateInventory.filter(t =>
        (t.type === 'IN' || t.reason === 'CANCEL_RESTOCK') &&
        (String(t.orderId) === String(order.id) || String(t.referenceId) === String(order.id))
      );
      if (restockTx.length === 0) {
        findings.push({
          severity: 'warning',
          type: 'RESTOCKED_ORDER_MISSING_INVENTORY_TX',
          entity: 'order',
          entityId: order.id,
          businessDate: dateStr,
          message: `Đơn hàng đã hoàn hàng ${order.code || order.id} nhưng thiếu giao dịch hoàn kho CANCEL_RESTOCK`,
          metadata: { orderId: order.id, orderCode: order.code },
        });
      }
    });

    // 4d. Duplicate SALE inventory transactions for single order
    const saleTxByOrder = new Map();
    saleTransactions.forEach(tx => {
      const linkedOrderId = tx.orderId || tx.referenceId;
      if (linkedOrderId) {
        const list = saleTxByOrder.get(linkedOrderId) || [];
        list.push(tx);
        saleTxByOrder.set(linkedOrderId, list);
      }
    });

    saleTxByOrder.forEach((txList, ordId) => {
      const linkedOrder = (orders || []).find(o => String(o.id) === String(ordId) || o.code === txList[0].orderCode);
      const expectedCount = Array.isArray(linkedOrder?.items) && linkedOrder.items.length > 0 ? linkedOrder.items.length : 1;
      if (linkedOrder && txList.length > expectedCount) {
        findings.push({
          severity: 'warning',
          type: 'DUPLICATE_SALE_LINKAGE',
          entity: 'order',
          entityId: ordId,
          businessDate: dateStr,
          message: `Phát hiện giao dịch xuất kho SALE bị trùng lặp cho đơn hàng ${linkedOrder.code || ordId} (${txList.length} giao dịch / ${expectedCount} sản phẩm)`,
          metadata: { orderId: ordId, transactionIds: txList.map(t => t.id) },
        });
      }
    });

    // 4e. Duplicate CANCEL_RESTOCK inventory transactions
    const restockTransactions = dateInventory.filter(t => t.reason === 'CANCEL_RESTOCK' || (t.type === 'IN' && (t.orderId || t.orderCode)));
    const restockTxByOrder = new Map();
    restockTransactions.forEach(tx => {
      const linkedOrderId = tx.orderId || tx.referenceId;
      if (linkedOrderId) {
        const list = restockTxByOrder.get(linkedOrderId) || [];
        list.push(tx);
        restockTxByOrder.set(linkedOrderId, list);
      }
    });

    restockTxByOrder.forEach((txList, ordId) => {
      const linkedOrder = (orders || []).find(o => String(o.id) === String(ordId) || o.code === txList[0].orderCode);
      const expectedCount = Array.isArray(linkedOrder?.items) && linkedOrder.items.length > 0 ? linkedOrder.items.length : 1;
      if (linkedOrder && txList.length > expectedCount) {
        findings.push({
          severity: 'warning',
          type: 'DUPLICATE_RESTOCK_TRANSACTION',
          entity: 'order',
          entityId: ordId,
          businessDate: dateStr,
          message: `Phát hiện giao dịch hoàn kho CANCEL_RESTOCK bị trùng lặp cho đơn hàng ${linkedOrder.code || ordId} (${txList.length} giao dịch / ${expectedCount} sản phẩm)`,
          metadata: { orderId: ordId, transactionIds: txList.map(t => t.id) },
        });
      }
    });
  }

  // 5. Negative Stock Invariant
  if (Array.isArray(products) && products.length > 0) {
    products.forEach(prod => {
      const stock = Number(prod.stockQuantity);
      if (!isNaN(stock) && stock < 0) {
        findings.push({
          severity: 'critical',
          type: 'NEGATIVE_PRODUCT_STOCK',
          entity: 'product',
          entityId: prod.id,
          businessDate: dateStr,
          message: `Sản phẩm "${prod.name || prod.id}" có số lượng tồn kho âm (${stock})`,
          metadata: { productId: prod.id, productName: prod.name, stockQuantity: stock },
        });
      }
    });
  }

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const infoCount = findings.filter(f => f.severity === 'info').length;

  return {
    isConsistent: criticalCount === 0,
    findings,
    anomaliesCount: findings.length,
    criticalCount,
    warningCount,
    infoCount,
  };
};

/**
 * Calculates the complete End-of-Day Audit for a selected business date.
 */
export const calculateEndOfDayAudit = ({
  dateStr,
  sessions = [],
  members = [],
  orders = [],
  inventoryTransactions = [],
  activityLogs = [],
  staffList = [],
  accountList = [],
  registers = [],
  products = [],
}) => {
  // 1. Filter sessions on this date
  const dateSessions = sessions.filter(s => s.date === dateStr || (s.id && s.id.startsWith(dateStr)));
  const sessionMap = new Map(dateSessions.map(s => [s.id, s]));

  // 2. Filter orders on this date
  const dateOrders = orders.filter(o => isOrderOnDate(o, dateStr));
  const completedOrders = dateOrders.filter(o => o.status === 'completed');
  const cancelledOrders = dateOrders.filter(o => o.status === 'cancelled');

  const totalSalesRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const totalCancelledRevenue = cancelledOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  // 3. Inventory activity on this date
  const dateInventory = inventoryTransactions.filter(t => {
    if (t.businessDate) return t.businessDate === dateStr;
    if (t.createdAt) return getBusinessDate(t.createdAt) === dateStr;
    return false;
  });
  const purchaseTx = dateInventory.filter(t => t.type === 'IN' && t.reason !== 'CANCEL_RESTOCK');
  const restockTx = dateInventory.filter(t => t.type === 'IN' && t.reason === 'CANCEL_RESTOCK');
  const exportTx = dateInventory.filter(t => t.type === 'OUT');
  const adjustTx = dateInventory.filter(t => t.type === 'ADJUST');

  const inventorySummary = {
    totalTransactions: dateInventory.length,
    importCount: purchaseTx.length,
    importQuantity: purchaseTx.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
    purchaseCount: purchaseTx.length,
    purchaseQuantity: purchaseTx.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
    restockCount: restockTx.length,
    restockQuantity: restockTx.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
    exportCount: exportTx.length,
    exportQuantity: exportTx.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
    adjustCount: adjustTx.length,
    adjustQuantity: adjustTx.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
    transactions: dateInventory,
  };

  // 4. Find all participating employees on this date
  const dateMembers = members.filter(m => {
    const session = sessionMap.get(m.workSessionId) || sessions.find(s => s.id === m.workSessionId);
    if (session && (session.date === dateStr || session.id.startsWith(dateStr))) return true;
    if (m.businessDate && m.businessDate === dateStr) return true;
    if (m.checkInTime && getBusinessDate(m.checkInTime) === dateStr) return true;
    return false;
  });

  const participatingAccountIds = new Set([
    ...dateMembers.map(m => m.accountId),
    ...completedOrders.map(o => o.accountId),
  ]);

  const employeeSummaries = Array.from(participatingAccountIds).map(accId => {
    return calculateDailyWorkSummary({
      dateStr,
      accountId: accId,
      members: dateMembers,
      sessions: dateSessions,
      orders: dateOrders,
      staffList,
      accountList,
      activityLogs,
    });
  });

  // Sort employees by employeeCode
  employeeSummaries.sort((a, b) => a.employee.employeeCode.localeCompare(b.employee.employeeCode));

  // 5. Detailed Sales Activity with seller & item details
  const salesDetails = completedOrders.map(order => {
    const acc = accountList.find(a => String(a.id) === String(order.accountId));
    const st = staffList.find(s => String(s.id) === String(acc?.employeeId));
    const orderSession = sessionMap.get(order.workSessionId) || sessions.find(s => s.id === order.workSessionId);

    return {
      orderId: order.id,
      orderCode: order.code,
      createdAt: order.createdAt,
      timeFormatted: formatTimeOnly(order.createdAt),
      seller: {
        accountId: order.accountId,
        employeeId: st?.id || acc?.employeeId || null,
        employeeCode: st?.employeeCode || 'NV---',
        employeeName: st?.name || acc?.name || 'Nhân viên',
      },
      items: Array.isArray(order.items) ? order.items.map(i => ({
        productId: i.productId,
        productName: i.productName || 'Sản phẩm',
        quantity: i.quantity || 1,
        price: i.price || 0,
        subtotal: (i.quantity || 1) * (i.price || 0),
      })) : [],
      totalAmount: order.totalAmount || 0,
      workSessionId: order.workSessionId || null,
      workSessionCode: orderSession?.code || order.workSessionId || null,
      isRestPeriodSale: isTimeInRestPeriod(order.createdAt),
    };
  });

  // Sort sales chronologically
  salesDetails.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // 6. Operational Activity / Audit Logs on this date
  const dateLogs = activityLogs.filter(log => {
    if (log.timestamp) return getBusinessDate(log.timestamp) === dateStr;
    return false;
  });
  dateLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 7. Authoritative Session Reconciliation for each session on this date
  const sessionReconciliations = dateSessions.map(session => {
    const recon = calculateSessionReconciliation({
      session,
      orders,
      registers,
      options: { useStoredSnapshot: true }
    });

    let sessionLifecycleStatus;
    if (session.status === 'closed') {
      if (session.isAutoClosed || session.actualCash === null || session.actualCash === undefined) {
        sessionLifecycleStatus = 'UNRECONCILED';
      } else {
        sessionLifecycleStatus = 'FINAL';
      }
    } else if (session.status === 'cancelled') {
      sessionLifecycleStatus = 'CANCELLED';
    } else {
      sessionLifecycleStatus = 'LIVE';
    }

    return {
      ...recon,
      sessionLifecycleStatus,
    };
  });

  // 8. Financial aggregates from authoritative session reconciliations
  const grossSales = sessionReconciliations.length > 0
    ? sessionReconciliations.reduce((s, r) => s + (r.grossSales || 0), 0)
    : totalSalesRevenue;
  const refundTotal = sessionReconciliations.reduce((s, r) => s + (r.refundTotal || 0), 0);
  const netRevenue = grossSales - refundTotal;
  const initialCash = sessionReconciliations.reduce((s, r) => s + (r.initialCash || 0), 0);
  const cashSales = sessionReconciliations.reduce((s, r) => s + (r.cashSales || 0), 0);
  const cashRefunds = sessionReconciliations.reduce((s, r) => s + (r.cashRefunds || 0), 0);
  const expectedCash = initialCash + cashSales - cashRefunds;

  const hasUnreconciledSession = dateSessions.some(
    s => s.status !== 'closed' || s.isAutoClosed || s.actualCash === null || s.actualCash === undefined
  );
  const actualCash = (!hasUnreconciledSession && sessionReconciliations.length > 0 && sessionReconciliations.every(r => r.actualCash !== null && r.actualCash !== undefined))
    ? sessionReconciliations.reduce((s, r) => s + (r.actualCash || 0), 0)
    : null;
  const cashDifference = actualCash !== null ? (actualCash - expectedCash) : null;

  const sessionStatusSummary = {
    total: dateSessions.length,
    liveCount: dateSessions.filter(s => s.status === 'active').length,
    finalCount: dateSessions.filter(s => s.status === 'closed' && !s.isAutoClosed && s.actualCash !== null && s.actualCash !== undefined).length,
    unreconciledCount: dateSessions.filter(s => s.status === 'closed' && (s.isAutoClosed || s.actualCash === null || s.actualCash === undefined)).length,
    cancelledCount: dateSessions.filter(s => s.status === 'cancelled').length,
  };

  // 9. Canonical POS Summary
  const activeRegisters = (Array.isArray(registers) && registers.length > 0 ? registers : (registerApi?.getSyncRegisters?.() || []))
    .filter(r => r.isActive !== false);

  const registerMap = new Map();
  activeRegisters.forEach(r => registerMap.set(r.id, r));

  sessionReconciliations.forEach(recon => {
    if (recon.posBreakdown) {
      Object.keys(recon.posBreakdown).forEach(posId => {
        if (!registerMap.has(posId)) {
          registerMap.set(posId, { id: posId, code: posId, name: `Quầy ${posId}` });
        }
      });
    }
  });

  const posSummary = Array.from(registerMap.values()).map(reg => {
    let openingFloat = 0;
    let posCashSales = 0;
    let posCashRefunds = 0;
    let posExpectedCash = 0;
    let posActualCash = 0;
    let hasActualCash = true;

    sessionReconciliations.forEach(recon => {
      const b = recon.posBreakdown?.[reg.id];
      if (b) {
        openingFloat += Number(b.initialCash || 0);
        posCashSales += Number(b.cashSales || 0);
        posCashRefunds += Number(b.cashRefunds || 0);
        posExpectedCash += Number(b.expectedCash || 0);
        if (b.actualCash !== null && b.actualCash !== undefined) {
          posActualCash += Number(b.actualCash);
        } else {
          hasActualCash = false;
        }
      } else {
        hasActualCash = false;
      }
    });

    if (sessionReconciliations.length === 0) {
      hasActualCash = false;
    }

    const regCompletedOrders = completedOrders.filter(o => o.registerId === reg.id);
    const posNonCashSales = regCompletedOrders
      .filter(o => o.paymentMethod !== 'cash')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const posGrossSales = posCashSales + posNonCashSales;

    const resolvedActual = hasActualCash ? posActualCash : null;
    const diff = resolvedActual !== null ? (resolvedActual - posExpectedCash) : null;
    let status = 'UNRECONCILED';
    if (resolvedActual !== null) {
      if (diff === 0) status = 'MATCH';
      else if (diff > 0) status = 'SURPLUS';
      else status = 'SHORTAGE';
    }

    const activeMember = dateMembers.find(m =>
      m.registerId === reg.id &&
      m.attendanceStatus === 'present' &&
      m.workingStatus !== 'offline'
    );
    let activeEmployee = null;
    if (activeMember) {
      const acc = accountList.find(a => String(a.id) === String(activeMember.accountId));
      const st = staffList.find(s => String(s.id) === String(acc?.employeeId));
      activeEmployee = {
        memberId: activeMember.id,
        accountId: activeMember.accountId,
        employeeId: st?.id || acc?.employeeId || null,
        employeeCode: st?.employeeCode || acc?.employeeCode || 'NV---',
        employeeName: st?.name || acc?.name || 'Nhân viên',
      };
    }

    return {
      registerId: reg.id,
      registerCode: reg.code || reg.id,
      registerName: reg.name || `Quầy ${reg.id}`,
      openingFloat,
      cashSales: posCashSales,
      nonCashSales: posNonCashSales,
      grossSales: posGrossSales,
      refunds: posCashRefunds,
      expectedCash: posExpectedCash,
      actualCash: resolvedActual,
      cashDifference: diff,
      status,
      activeEmployee,
    };
  });

  // 10. Traceable Order Audit (Categorized: COMPLETED, CANCELLED, HISTORICAL_CANCELLED)
  const completedAuditList = completedOrders.map(order => {
    const acc = accountList.find(a => String(a.id) === String(order.accountId));
    const st = staffList.find(s => String(s.id) === String(acc?.employeeId));
    return {
      orderId: order.id,
      code: order.code || order.id,
      category: 'COMPLETED',
      createdAt: order.createdAt,
      cancelledAt: null,
      cashier: {
        accountId: order.accountId,
        employeeCode: st?.employeeCode || acc?.employeeCode || 'NV---',
        employeeName: st?.name || acc?.name || 'Nhân viên',
      },
      registerId: order.registerId || null,
      cancelledRegisterId: null,
      paymentMethod: order.paymentMethod || 'cash',
      totalAmount: Number(order.totalAmount || 0),
      refundAmount: 0,
      refundMethod: null,
      restocked: false,
      status: order.status,
    };
  });

  const cancelledAuditList = cancelledOrders.map(order => {
    const acc = accountList.find(a => String(a.id) === String(order.accountId));
    const st = staffList.find(s => String(s.id) === String(acc?.employeeId));
    return {
      orderId: order.id,
      code: order.code || order.id,
      category: 'CANCELLED',
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt || order.updatedAt || null,
      cashier: {
        accountId: order.accountId,
        employeeCode: st?.employeeCode || acc?.employeeCode || 'NV---',
        employeeName: st?.name || acc?.name || 'Nhân viên',
      },
      registerId: order.registerId || null,
      cancelledRegisterId: order.cancelledRegisterId || order.registerId || null,
      paymentMethod: order.paymentMethod || 'cash',
      totalAmount: Number(order.totalAmount || 0),
      refundAmount: Number(order.refundAmount ?? order.totalAmount ?? 0),
      refundMethod: order.refundMethod || (order.paymentMethod === 'cash' ? 'cash' : 'none'),
      restocked: Boolean(order.restocked),
      status: order.status,
    };
  });

  const historicalCancelledOrders = orders.filter(o => {
    if (o.status !== 'historical_cancelled') return false;
    const isCancelledToday = (
      o.cancelledBusinessDate === dateStr ||
      (o.cancelledWorkSessionId && dateSessions.some(s => s.id === o.cancelledWorkSessionId)) ||
      (o.cancelledAt && getBusinessDate(o.cancelledAt) === dateStr)
    );
    return isCancelledToday;
  });

  const historicalCancelledAuditList = historicalCancelledOrders.map(order => {
    const acc = accountList.find(a => String(a.id) === String(order.accountId));
    const st = staffList.find(s => String(s.id) === String(acc?.employeeId));
    return {
      orderId: order.id,
      code: order.code || order.id,
      category: 'HISTORICAL_CANCELLED',
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt || order.updatedAt || null,
      cashier: {
        accountId: order.accountId,
        employeeCode: st?.employeeCode || acc?.employeeCode || 'NV---',
        employeeName: st?.name || acc?.name || 'Nhân viên',
      },
      registerId: order.registerId || null,
      cancelledRegisterId: order.cancelledRegisterId || order.registerId || null,
      paymentMethod: order.paymentMethod || 'cash',
      totalAmount: Number(order.totalAmount || 0),
      refundAmount: Number(order.refundAmount ?? order.totalAmount ?? 0),
      refundMethod: order.refundMethod || (order.paymentMethod === 'cash' ? 'cash' : 'none'),
      restocked: Boolean(order.restocked),
      status: order.status,
    };
  });

  const orderAudit = {
    completed: completedAuditList,
    cancelled: cancelledAuditList,
    historicalCancelled: historicalCancelledAuditList,
    totalOrders: completedAuditList.length + cancelledAuditList.length + historicalCancelledAuditList.length,
    completedCount: completedAuditList.length,
    cancelledCount: cancelledAuditList.length,
    historicalCancelledCount: historicalCancelledAuditList.length,
    totalCompletedAmount: completedAuditList.reduce((s, o) => s + o.totalAmount, 0),
    totalRefundAmount: [...cancelledAuditList, ...historicalCancelledAuditList].reduce((s, o) => s + (o.refundAmount || 0), 0),
  };

  // 11. Data Consistency Cross-Check View
  const consistencyResult = validateReportingConsistency({
    dateStr,
    sessions,
    members,
    orders,
    inventoryTransactions,
    products,
    registers,
    staffList,
    accountList,
  });

  const consistency = {
    workSessionsCount: dateSessions.length,
    activeSessionsCount: dateSessions.filter(s => s.status === 'active').length,
    closedSessionsCount: dateSessions.filter(s => s.status === 'closed').length,
    membersCount: dateMembers.length,
    completedOrdersCount: completedOrders.length,
    totalSalesRevenue,
    cancelledOrdersCount: cancelledOrders.length,
    inventoryTransactionsCount: dateInventory.length,
    activityLogsCount: dateLogs.length,
    isConsistent: consistencyResult.isConsistent,
    findings: consistencyResult.findings,
    anomaliesCount: consistencyResult.anomaliesCount,
    criticalCount: consistencyResult.criticalCount,
    warningCount: consistencyResult.warningCount,
    infoCount: consistencyResult.infoCount,
  };

  return {
    date: dateStr,
    storeOverview: {
      totalSessions: dateSessions.length,
      sessions: dateSessions,
      sessionReconciliations,
      sessionStatusSummary,
      totalCompletedOrders: completedOrders.length,
      totalSalesRevenue,
      totalCancelledOrders: cancelledOrders.length,
      totalCancelledRevenue,
      grossSales,
      refundTotal,
      netRevenue,
      initialCash,
      cashSales,
      cashRefunds,
      expectedCash,
      actualCash,
      cashDifference,
      inventorySummary,
      posSummary,
    },
    posSummary,
    orderAudit,
    employeeSummaries,
    salesDetails,
    activityLogs: dateLogs,
    consistency,
  };
};

