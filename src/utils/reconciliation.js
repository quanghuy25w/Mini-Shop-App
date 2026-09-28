/**
 * reconciliation.js
 * 
 * Nguồn chân lý duy nhất (Single Source of Truth) cho toàn bộ tính toán
 * đối soát tài chính, doanh thu, hoàn tiền và tiền mặt ca làm việc / cuối ngày.
 *
 * Được sử dụng đồng nhất bởi:
 * 1. workSessionApi.closeSession (Đóng ca thủ công)
 * 2. workSessionApi.autoClosePastSessions (Đóng ca tự động)
 * 3. CloseWorkSessionModal (Giao diện xem trước kết toán trước khi đóng ca)
 * 4. Báo cáo hàng ngày & Kiểm toán cuối ngày (calculateEndOfDayAudit)
 * 5. Báo cáo tổng hợp tháng
 */

import { getBusinessDate } from './businessDate';
import { registerApi } from '../api/registerApi';

export const RECONCILIATION_STATUS = {
  MATCH: 'MATCH',                 // Khớp tiền hoàn toàn (actualCash === expectedCash)
  SURPLUS: 'SURPLUS',             // Thừa tiền mặt (actualCash > expectedCash)
  SHORTAGE: 'SHORTAGE',           // Thiếu hụt tiền mặt (actualCash < expectedCash)
  UNRECONCILED: 'UNRECONCILED',   // Chưa kiểm đếm / Đóng tự động không có kiểm đếm
};

/**
 * Xác định trạng thái đối soát dựa trên chênh lệch tiền mặt
 */
export const getReconciliationStatus = (actualCash, expectedCash) => {
  if (actualCash === null || actualCash === undefined || isNaN(Number(actualCash))) {
    return RECONCILIATION_STATUS.UNRECONCILED;
  }
  const diff = Number(actualCash) - Number(expectedCash);
  if (diff === 0) return RECONCILIATION_STATUS.MATCH;
  if (diff > 0) return RECONCILIATION_STATUS.SURPLUS;
  return RECONCILIATION_STATUS.SHORTAGE;
};

/**
 * Tính toán kết toán tài chính ca làm việc có tính đến POS-level và Store-level.
 *
 * @param {Object} params
 * @param {Object} params.session - Bản ghi WorkSession cần kết toán
 * @param {Array} params.orders - Danh sách toàn bộ hóa đơn từ API
 * @param {Array} [params.registers] - Danh sách quầy thu ngân cấu hình (từ API hoặc config)
 * @param {number|null} [params.actualCash] - Tiền mặt thực tế đếm được (nếu người dùng nhập vào)
 * @param {Object} [params.options]
 * @param {boolean} [params.options.recalculateLive=false] - Buộc tính toán lại ngay cả khi ca đã đóng
 * @returns {Object} Kết quả kết toán chi tiết và đồng nhất
 */
export const calculateSessionReconciliation = ({
  session,
  orders = [],
  registers = [],
  actualCash = null,
  options = {}
}) => {
  if (!session) {
    return {
      isStoredSnapshot: false,
      grossSales: 0,
      totalRevenue: 0,
      completedOrderCount: 0,
      cancelledOrderCount: 0,
      refundTotal: 0,
      netRevenue: 0,
      initialCash: 0,
      cashSales: 0,
      cashRefunds: 0,
      expectedCash: 0,
      actualCash: null,
      cashDifference: null,
      reconciliationStatus: RECONCILIATION_STATUS.UNRECONCILED,
      posBreakdown: {},
    };
  }

  // 1. RECONCILIATION SNAPSHOT: Nếu ca đã đóng thủ công và có snapshot hợp lệ
  // Trừ khi cờ recalculateLive = true, luôn tôn trọng số liệu lịch sử đã lưu trữ bất biến.
  const isClosedManually = session.status === 'closed' && session.actualCash !== null && session.actualCash !== undefined;
  if (isClosedManually && !options.recalculateLive && session.posBreakdown) {
    const storedActual = Number(session.actualCash);
    const storedExpected = Number(session.expectedCash ?? 0);
    const storedDiff = session.cashDifference ?? (session.cashDiscrepancy ?? (storedActual - storedExpected));
    const storedGross = Number(session.grossSales ?? session.totalRevenue ?? 0);
    const storedRefund = Number(session.refundTotal ?? 0);
    const storedNet = Number(session.netRevenue ?? (storedGross - storedRefund));

    return {
      isStoredSnapshot: true,
      sessionId: session.id,
      sessionCode: session.code,
      sessionDate: session.date,
      grossSales: storedGross,
      totalRevenue: Number(session.totalRevenue ?? storedGross),
      completedOrderCount: Number(session.completedOrderCount ?? session.totalOrders ?? 0),
      cancelledOrderCount: Number(session.cancelledOrderCount ?? 0),
      refundTotal: storedRefund,
      netRevenue: storedNet,
      initialCash: Number(session.initialCash ?? 0),
      cashSales: Number(session.cashSales ?? Object.values(session.posBreakdown || {}).reduce((s, p) => s + (Number(p.cashSales) || 0), 0)),
      cashRefunds: Number(session.cashRefunds ?? Object.values(session.posBreakdown || {}).reduce((s, p) => s + (Number(p.cashRefunds) || 0), 0)),
      expectedCash: storedExpected,
      actualCash: storedActual,
      cashDifference: storedDiff,
      reconciliationStatus: session.reconciliationStatus || getReconciliationStatus(storedActual, storedExpected),
      posBreakdown: session.posBreakdown,
      closedAt: session.endTime || session.closedAt || null,
      closedBy: session.closedBy || null,
      closeNote: session.closeNote || '',
    };
  }

  // 2. KHỞI TẠO BẢNG PHÂN BỔ THEO POS (POS Breakdown)
  const knownRegisters = (Array.isArray(registers) && registers.length > 0)
    ? registers
    : (registerApi?.getSyncRegisters?.() || []);
  const activeRegisters = (knownRegisters || []).filter(r => r.isActive !== false);

  const posBreakdown = {};
  activeRegisters.forEach(reg => {
    const regInitCash = session.posInitialCash && session.posInitialCash[reg.id] !== undefined
      ? Number(session.posInitialCash[reg.id])
      : 0;

    posBreakdown[reg.id] = {
      registerId: reg.id,
      registerName: reg.name || reg.id,
      initialCash: regInitCash,
      cashSales: 0,
      cashRefunds: 0,
      expectedCash: regInitCash,
      actualCash: null,
      difference: null,
      status: RECONCILIATION_STATUS.UNRECONCILED
    };
  });

  const ensurePosRecord = (posId) => {
    if (!posId) return null;
    const resolvedId = String(posId);
    if (!posBreakdown[resolvedId]) {
      posBreakdown[resolvedId] = {
        registerId: resolvedId,
        registerName: `Quầy ${resolvedId}`,
        initialCash: 0,
        cashSales: 0,
        cashRefunds: 0,
        expectedCash: 0,
        actualCash: null,
        difference: null,
        status: RECONCILIATION_STATUS.UNRECONCILED
      };
    }
    return resolvedId;
  };

  if (session.posInitialCash && typeof session.posInitialCash === 'object') {
    Object.entries(session.posInitialCash).forEach(([posId, amount]) => {
      const resolved = ensurePosRecord(posId);
      if (resolved && posBreakdown[resolved]) {
        posBreakdown[resolved].initialCash = Number(amount) || 0;
      }
    });
  }

  // 3. PHÂN LOẠI & LỌC ĐƠN HÀNG THUỘC NGỮ CẢNH CA
  let grossSales = 0;
  let completedOrderCount = 0;
  let cancelledOrderCount = 0;
  let refundTotal = 0;
  let storeCashSales = 0;
  let storeCashRefunds = 0;

  const targetDate = session.date;
  const processedOrderIds = new Set();

  (orders || []).forEach(order => {
    const orderDate = order.businessDate || (order.createdAt ? getBusinessDate(order.createdAt) : null);
    const isCreatedInThisSession = (order.workSessionId && order.workSessionId === session.id) ||
      (!order.workSessionId && orderDate === targetDate);

    // Case A: Đơn hàng hoàn tất (Completed) tạo trong ca hiện tại
    if (isCreatedInThisSession && order.status === 'completed') {
      processedOrderIds.add(order.id);
      const amount = Math.round(Number(order.totalAmount) || 0);
      grossSales += amount;
      completedOrderCount += 1;

      if (order.paymentMethod === 'cash') {
        storeCashSales += amount;
        const posId = ensurePosRecord(order.registerId);
        if (posId && posBreakdown[posId]) {
          posBreakdown[posId].cashSales += amount;
        }
      }
      return;
    }

    // Case B: Đơn hàng cùng ca bị hủy (Same-day cancellation)
    if (isCreatedInThisSession && order.status === 'cancelled') {
      processedOrderIds.add(order.id);
      cancelledOrderCount += 1;
      const refAmount = Math.round(Number(order.refundAmount ?? order.totalAmount) || 0);
      refundTotal += refAmount;

      const isCashRefund = order.refundCash !== false &&
        (order.refundMethod === 'cash' || (!order.refundMethod && order.paymentMethod === 'cash'));

      if (isCashRefund) {
        storeCashRefunds += refAmount;
        // Điểm mấu chốt Cross-POS: Gán hoàn tiền về quầy thực hiện hủy đơn (cancelledRegisterId)
        const refundPosId = ensurePosRecord(order.cancelledRegisterId || order.registerId);
        if (refundPosId && posBreakdown[refundPosId]) {
          posBreakdown[refundPosId].cashRefunds += refAmount;
        }
      }
      return;
    }

    // Case C: Đơn hàng lịch sử (Historical Order) được hủy TRONG ca làm việc này
    // Nguyên tắc: KHÔNG tính vào grossSales của ngày hôm nay, chỉ ghi nhận hoàn tiền
    const isCancelledInThisSession = order.status === 'historical_cancelled' && (
      order.cancelledWorkSessionId === session.id ||
      (!order.cancelledWorkSessionId && order.cancelledBusinessDate === targetDate)
    );

    if (isCancelledInThisSession && !processedOrderIds.has(order.id)) {
      processedOrderIds.add(order.id);
      cancelledOrderCount += 1;
      const refAmount = Math.round(Number(order.refundAmount ?? order.totalAmount) || 0);
      refundTotal += refAmount;

      const isCashRefund = order.refundCash !== false &&
        (order.refundMethod === 'cash' || (!order.refundMethod && order.paymentMethod === 'cash'));

      if (isCashRefund) {
        storeCashRefunds += refAmount;
        const refundPosId = ensurePosRecord(order.cancelledRegisterId || order.registerId);
        if (refundPosId && posBreakdown[refundPosId]) {
          posBreakdown[refundPosId].cashRefunds += refAmount;
        }
      }
    }
  });

  // 4. TÍNH TOÁN TIỀN ĐẦU CA & KỲ VỌNG (Expected Cash)
  const storeInitialCash = Math.round(Number(session.initialCash) || 0);
  const storeExpectedCash = storeInitialCash + storeCashSales - storeCashRefunds;
  const netRevenue = grossSales - refundTotal;

  // Cập nhật expectedCash cho từng POS
  Object.keys(posBreakdown).forEach(posId => {
    posBreakdown[posId].expectedCash = posBreakdown[posId].initialCash + posBreakdown[posId].cashSales - posBreakdown[posId].cashRefunds;
  });

  // 5. XỬ LÝ TIỀN MẶT THỰC ĐẾM (Actual Cash) & CHÊNH LỆCH (Discrepancy)
  let resolvedActualCash = null;
  if (actualCash !== null && actualCash !== undefined && !isNaN(Number(actualCash))) {
    resolvedActualCash = Math.round(Number(actualCash));
  } else if (session.actualCash !== null && session.actualCash !== undefined && !isNaN(Number(session.actualCash))) {
    resolvedActualCash = Math.round(Number(session.actualCash));
  }

  const cashDifference = resolvedActualCash !== null ? (resolvedActualCash - storeExpectedCash) : null;
  const reconciliationStatus = getReconciliationStatus(resolvedActualCash, storeExpectedCash);

  return {
    isStoredSnapshot: false,
    sessionId: session.id,
    sessionCode: session.code,
    sessionDate: session.date,
    grossSales,
    totalRevenue: grossSales, // Tương thích ngược với các thành phần cũ
    completedOrderCount,
    cancelledOrderCount,
    refundTotal,
    netRevenue,
    initialCash: storeInitialCash,
    cashSales: storeCashSales,
    cashRefunds: storeCashRefunds,
    expectedCash: storeExpectedCash,
    actualCash: resolvedActualCash,
    cashDifference,
    reconciliationStatus,
    posBreakdown,
  };
};
