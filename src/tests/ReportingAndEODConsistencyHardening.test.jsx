/**
 * ReportingAndEODConsistencyHardening.test.jsx
 *
 * Dedicated test suite for Phase 5B:
 * 1. Reporting Source of Truth & Reconciliation Engine integration
 * 2. Daily Work Report hardening (shift clamping, rest periods, role isolation)
 * 3. Monthly Work Report hardening (aggregation, historical accuracy, role isolation)
 * 4. End-of-Day Audit hardening (Store overview, canonical POS summary, categorized Order audit)
 * 5. Data Consistency Engine (validateReportingConsistency structured findings, authentic isConsistent boolean)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { initSeedData } from './mockApi';
import { reportApi } from '../api/reportApi';
import {
  calculateDailyWorkSummary,
  calculateMonthlyWorkSummary,
  calculateEndOfDayAudit,
  validateReportingConsistency,
  calculateShiftWorkDuration,
  isTimeInRestPeriod,
} from '../utils/reportCalculations';
import { calculateSessionReconciliation, RECONCILIATION_STATUS } from '../utils/reconciliation';
import { ROLES } from '../utils/permissions';

describe('Phase 5B: Reporting Domain Hardening & Data Consistency Validation', () => {

  const employee1 = {
    id: 'acc-emp-1',
    employeeId: 'st-emp-1',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên 01',
    employeeCode: 'NV001',
    isActive: true,
  };

  const employee2 = {
    id: 'acc-emp-2',
    employeeId: 'st-emp-2',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên 02',
    employeeCode: 'NV002',
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. REPORTING SOURCE OF TRUTH & RECONCILIATION FORMULA CONSUMPTION
  // =========================================================================
  describe('1. Reporting Source of Truth & Authoritative Reconciliation Integration', () => {
    it('Consumes calculateSessionReconciliation directly and matches storeOverview totals exactly', () => {
      const today = '2026-09-25';
      const session = {
        id: 'ws-5b-01',
        code: 'CA-20260925-01',
        date: today,
        shiftType: 'daily',
        status: 'active',
        initialCash: 1000000,
      };

      const orders = [
        {
          id: 'ord-1',
          workSessionId: 'ws-5b-01',
          businessDate: today,
          registerId: 'POS01',
          totalAmount: 500000, items: [{ productId: 'p4', quantity: 500000, price: 1 }],
          paymentMethod: 'cash',
          status: 'completed',
        },
        {
          id: 'ord-2',
          workSessionId: 'ws-5b-01',
          businessDate: today,
          registerId: 'POS02',
          totalAmount: 300000, items: [{ productId: 'p4', quantity: 300000, price: 1 }],
          paymentMethod: 'transfer',
          status: 'completed',
        },
        {
          id: 'ord-3',
          workSessionId: 'ws-5b-01',
          businessDate: today,
          registerId: 'POS01',
          cancelledRegisterId: 'POS02', // cross-POS refund
          totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
          refundAmount: 100000,
          paymentMethod: 'cash',
          refundMethod: 'cash',
          refundCash: true,
          status: 'cancelled',
        },
      ];

      const directRecon = calculateSessionReconciliation({
        session,
        orders,
      });

      const audit = calculateEndOfDayAudit({
        dateStr: today,
        sessions: [session],
        orders,
      });

      // Mathematical consistency
      expect(audit.storeOverview.grossSales).toBe(directRecon.grossSales);
      expect(audit.storeOverview.grossSales).toBe(800000);
      expect(audit.storeOverview.refundTotal).toBe(directRecon.refundTotal);
      expect(audit.storeOverview.refundTotal).toBe(100000);
      expect(audit.storeOverview.netRevenue).toBe(directRecon.netRevenue);
      expect(audit.storeOverview.netRevenue).toBe(700000);
      expect(audit.storeOverview.expectedCash).toBe(directRecon.expectedCash);
      expect(audit.storeOverview.expectedCash).toBe(1000000 + 500000 - 100000); // 1,400,000

      // Cross-POS refund attribution: refund happened at POS02
      expect(directRecon.posBreakdown.POS01.cashSales).toBe(500000);
      expect(directRecon.posBreakdown.POS01.cashRefunds).toBe(0);
      expect(directRecon.posBreakdown.POS02.cashRefunds).toBe(100000);
    });

    it('Excludes historical_cancelled orders from gross sales, but applies cash refund to today’s expected drawer', () => {
      const today = '2026-09-25';
      const session = {
        id: 'ws-5b-hist',
        code: 'CA-20260925-HIST',
        date: today,
        shiftType: 'morning',
        status: 'active',
        initialCash: 2000000,
      };

      const orders = [
        {
          id: 'ord-today-1',
          workSessionId: 'ws-5b-hist',
          businessDate: today,
          registerId: 'POS01',
          totalAmount: 400000, items: [{ productId: 'p4', quantity: 400000, price: 1 }],
          paymentMethod: 'cash',
          status: 'completed',
        },
        // Historical order from 2026-09-24, cancelled today in ws-5b-hist
        {
          id: 'ord-past-1',
          workSessionId: 'ws-old-session',
          businessDate: '2026-09-24',
          cancelledWorkSessionId: 'ws-5b-hist',
          cancelledBusinessDate: today,
          registerId: 'POS01',
          cancelledRegisterId: 'POS01',
          totalAmount: 150000, items: [{ productId: 'p4', quantity: 150000, price: 1 }],
          refundAmount: 150000,
          paymentMethod: 'cash',
          refundMethod: 'cash',
          refundCash: true,
          status: 'historical_cancelled',
        },
      ];

      const audit = calculateEndOfDayAudit({
        dateStr: today,
        sessions: [session],
        orders,
      });

      // Gross sales must be ONLY today's completed order (400k), NOT 550k
      expect(audit.storeOverview.grossSales).toBe(400000);
      expect(audit.storeOverview.totalSalesRevenue).toBe(400000);
      expect(audit.storeOverview.refundTotal).toBe(150000);
      expect(audit.storeOverview.netRevenue).toBe(250000);

      // Expected cash reduces by 150k refund
      expect(audit.storeOverview.expectedCash).toBe(2000000 + 400000 - 150000); // 2,250,000

      // Categorized Order Audit
      expect(audit.orderAudit.completedCount).toBe(1);
      expect(audit.orderAudit.historicalCancelledCount).toBe(1);
      expect(audit.orderAudit.historicalCancelled[0].orderId).toBe('ord-past-1');
      expect(audit.orderAudit.historicalCancelled[0].refundAmount).toBe(150000);
    });
  });

  // =========================================================================
  // 2. DAILY WORK REPORT HARDENING
  // =========================================================================
  describe('2. Daily Work Report Hardening', () => {
    it('Clamps work duration to shift boundaries and excludes rest periods', () => {
      // Checked in 07:15 (early) -> clamped to 07:30 official start.
      // Checked out 12:15 (late) -> clamped to 12:00 official end.
      const member = {
        id: 'm-clamp',
        workSessionId: 'ws-morning',
        accountId: employee1.id,
        shiftType: 'morning',
        checkInTime: '2026-09-25T00:15:00.000Z', // 07:15 VN
        checkOutTime: '2026-09-25T05:15:00.000Z', // 12:15 VN
      };
      const session = {
        id: 'ws-morning',
        date: '2026-09-25',
        shiftType: 'morning',
        status: 'closed',
      };

      const result = calculateShiftWorkDuration(member, session);
      // Morning is 07:30 to 12:00 = 270 minutes (4h30)
      expect(result.durationMinutes).toBe(270);
      expect(result.durationFormatted.formatted).toBe('4h30');
    });

    it('Correctly identifies rest periods and flags rest period sales', () => {
      expect(isTimeInRestPeriod('2026-09-25T05:30:00.000Z')).toBe(true); // 12:30 VN
      expect(isTimeInRestPeriod('2026-09-25T11:45:00.000Z')).toBe(true); // 18:45 VN
      expect(isTimeInRestPeriod('2026-09-25T03:00:00.000Z')).toBe(false); // 10:00 VN

      const orders = [
        {
          id: 'ord-lunch-sale',
          code: 'HD-LUNCH',
          accountId: employee1.id,
          totalAmount: 150000, items: [{ productId: 'p4', quantity: 150000, price: 1 }],
          status: 'completed',
          businessDate: '2026-09-25',
          createdAt: '2026-09-25T05:20:00.000Z', // 12:20 VN
          items: [{ productId: 'p1', productName: 'Bánh mì', quantity: 1, price: 150000 }],
        },
      ];

      const summary = calculateDailyWorkSummary({
        dateStr: '2026-09-25',
        accountId: employee1.id,
        orders,
        members: [],
        sessions: [],
      });

      expect(summary.completedOrderCount).toBe(1);
      expect(summary.salesDetails[0].isRestPeriodSale).toBe(true);
    });

    it('Enforces strict role isolation on getDailyWorkReport', async () => {
      // Employee requesting another employee's report should be overridden to their own data
      const res = await reportApi.getDailyWorkReport({
        date: '2026-09-25',
        employeeId: employee2.employeeId, // attempts to inspect employee2
        accountId: employee2.id,
        actor: employee1, // Authenticated as employee1
      });

      expect(res.success).toBe(true);
      expect(res.data.employee.accountId).toBe(employee1.id);
      expect(res.data.employee.employeeCode).toBe('NV001');
    });
  });

  // =========================================================================
  // 3. MONTHLY WORK REPORT HARDENING
  // =========================================================================
  describe('3. Monthly Work Report Hardening', () => {
    it('Aggregates daily work summaries across the month without double-counting', () => {
      const monthStr = '2026-09';
      const sessions = [
        { id: 'ws-m1', date: '2026-09-01', shiftType: 'morning', status: 'closed' },
        { id: 'ws-m2', date: '2026-09-02', shiftType: 'afternoon', status: 'closed' },
      ];
      const members = [
        {
          id: 'mb-1',
          workSessionId: 'ws-m1',
          accountId: employee1.id,
          shiftType: 'morning',
          checkInTime: '2026-09-01T00:30:00.000Z', // 07:30 VN
          checkOutTime: '2026-09-01T05:00:00.000Z', // 12:00 VN (270 mins)
        },
        {
          id: 'mb-2',
          workSessionId: 'ws-m2',
          accountId: employee1.id,
          shiftType: 'afternoon',
          checkInTime: '2026-09-02T06:00:00.000Z', // 13:00 VN
          checkOutTime: '2026-09-02T11:30:00.000Z', // 18:30 VN (330 mins)
        },
      ];
      const orders = [
        { id: 'o-m1', accountId: employee1.id, totalAmount: 400000, items: [{ productId: 'p4', quantity: 400000, price: 1 }], status: 'completed', businessDate: '2026-09-01' },
        { id: 'o-m2', accountId: employee1.id, totalAmount: 600000, items: [{ productId: 'p4', quantity: 600000, price: 1 }], status: 'completed', businessDate: '2026-09-02' },
      ];

      const monthly = calculateMonthlyWorkSummary({
        monthStr,
        accountId: employee1.id,
        sessions,
        members,
        orders,
      });

      expect(monthly.totalWorkingDays).toBe(2);
      expect(monthly.totalWorkMinutes).toBe(600); // 270 + 330
      expect(monthly.totalWorkDuration.formatted).toBe('10h00');
      expect(monthly.totalCompletedOrders).toBe(2);
      expect(monthly.totalSalesAmount).toBe(1000000);
      expect(monthly.averageDailyMinutes).toBe(300); // 600 / 2 = 300 mins (5h00)
      expect(monthly.dailyBreakdown.length).toBe(2);
    });

    it('Employee cannot access monthly report of another employee via reportApi', async () => {
      const res = await reportApi.getMonthlyWorkReport({
        month: '2026-09',
        employeeId: employee2.employeeId,
        accountId: employee2.id,
        actor: employee1,
      });

      expect(res.success).toBe(true);
      expect(res.data.employee.accountId).toBe(employee1.id);
    });
  });

  // =========================================================================
  // 4. END-OF-DAY AUDIT HARDENING (Store Overview, POS Summary, Order Audit)
  // =========================================================================
  describe('4. End-of-Day Audit Hardening', () => {
    it('Reports LIVE, FINAL, and UNRECONCILED lifecycle statuses correctly', () => {
      const today = '2026-09-25';
      const liveSession = {
        id: 'ws-live',
        code: 'CA-LIVE',
        date: today,
        status: 'active',
        initialCash: 1000000,
      };
      const finalSession = {
        id: 'ws-final',
        code: 'CA-FINAL',
        date: today,
        status: 'closed',
        initialCash: 1000000,
        actualCash: 1200000,
        expectedCash: 1200000,
        cashDifference: 0,
        reconciliationStatus: RECONCILIATION_STATUS.MATCH,
        posBreakdown: {
          POS01: { initialCash: 1000000, cashSales: 200000, cashRefunds: 0, expectedCash: 1200000, actualCash: 1200000 },
        },
      };
      const autoClosedSession = {
        id: 'ws-auto',
        code: 'CA-AUTO',
        date: today,
        status: 'closed',
        isAutoClosed: true,
        initialCash: 500000,
        actualCash: null,
      };

      const audit = calculateEndOfDayAudit({
        dateStr: today,
        sessions: [liveSession, finalSession, autoClosedSession],
        orders: [],
      });

      expect(audit.storeOverview.sessionStatusSummary.total).toBe(3);
      expect(audit.storeOverview.sessionStatusSummary.liveCount).toBe(1);
      expect(audit.storeOverview.sessionStatusSummary.finalCount).toBe(1);
      expect(audit.storeOverview.sessionStatusSummary.unreconciledCount).toBe(1);

      // Because live and auto-closed sessions are unreconciled, store-wide actualCash is null
      expect(audit.storeOverview.actualCash).toBeNull();
      expect(audit.storeOverview.cashDifference).toBeNull();
    });

    it('Derives canonical POS Summary with registers from database and calculates register financial metrics', () => {
      const today = '2026-09-25';
      const canonicalRegisters = [
        { id: 'POS01', code: 'Q01', name: 'Quầy Chính', isActive: true },
        { id: 'POS02', code: 'Q02', name: 'Quầy Phụ', isActive: true },
      ];

      const session = {
        id: 'ws-pos-test',
        code: 'CA-POS-01',
        date: today,
        status: 'closed',
        initialCash: 2000000,
        actualCash: 2800000,
        posInitialCash: { POS01: 1000000, POS02: 1000000 },
        posActualCash: { POS01: 1500000, POS02: 1300000 },
        posBreakdown: {
          POS01: { initialCash: 1000000, cashSales: 500000, cashRefunds: 0, expectedCash: 1500000, actualCash: 1500000, difference: 0 },
          POS02: { initialCash: 1000000, cashSales: 300000, cashRefunds: 0, expectedCash: 1300000, actualCash: 1300000, difference: 0 },
        },
      };

      const orders = [
        { id: 'ord-pos1-cash', registerId: 'POS01', totalAmount: 500000, items: [{ productId: 'p4', quantity: 500000, price: 1 }], paymentMethod: 'cash', status: 'completed', businessDate: today },
        { id: 'ord-pos1-card', registerId: 'POS01', totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }], paymentMethod: 'transfer', status: 'completed', businessDate: today },
        { id: 'ord-pos2-cash', registerId: 'POS02', totalAmount: 300000, items: [{ productId: 'p4', quantity: 300000, price: 1 }], paymentMethod: 'cash', status: 'completed', businessDate: today },
      ];

      const members = [
        {
          id: 'mb-pos1',
          workSessionId: 'ws-pos-test',
          accountId: employee1.id,
          registerId: 'POS01',
          attendanceStatus: 'present',
          workingStatus: 'selling',
        },
      ];

      const audit = calculateEndOfDayAudit({
        dateStr: today,
        sessions: [session],
        orders,
        members,
        registers: canonicalRegisters,
        staffList: [{ id: employee1.employeeId, employeeCode: 'NV001', name: 'Nhân viên 01' }],
        accountList: [employee1],
      });

      expect(audit.posSummary.length).toBe(2);

      const pos1 = audit.posSummary.find(p => p.registerId === 'POS01');
      expect(pos1.registerName).toBe('Quầy Chính');
      expect(pos1.openingFloat).toBe(1000000);
      expect(pos1.cashSales).toBe(500000);
      expect(pos1.nonCashSales).toBe(200000);
      expect(pos1.grossSales).toBe(700000);
      expect(pos1.expectedCash).toBe(1500000);
      expect(pos1.actualCash).toBe(1500000);
      expect(pos1.cashDifference).toBe(0);
      expect(pos1.status).toBe('MATCH');
      expect(pos1.activeEmployee.employeeCode).toBe('NV001');

      const pos2 = audit.posSummary.find(p => p.registerId === 'POS02');
      expect(pos2.registerName).toBe('Quầy Phụ');
      expect(pos2.grossSales).toBe(300000);
      expect(pos2.activeEmployee).toBeNull();
    });
  });

  // =========================================================================
  // 5. DATA CONSISTENCY VALIDATION ENGINE (validateReportingConsistency)
  // =========================================================================
  describe('5. Data Consistency Engine (validateReportingConsistency)', () => {
    const today = '2026-09-25';

    it('Passes with isConsistent: true and 0 critical findings when data foundation is healthy', () => {
      const session = {
        id: 'ws-clean',
        date: today,
        status: 'closed',
        actualCash: 1000000,
        expectedCash: 1000000,
      };
      const result = validateReportingConsistency({
        dateStr: today,
        sessions: [session],
        orders: [],
        members: [],
        inventoryTransactions: [],
        products: [{ id: 'p1', name: 'Sữa tươi', stockQuantity: 20 }],
      });

      expect(result.isConsistent).toBe(true);
      expect(result.criticalCount).toBe(0);
      expect(result.findings.length).toBe(0);
    });

    it('Detects duplicate non-cancelled sessions on the same date and sets isConsistent: false', () => {
      const sessions = [
        { id: 'ws-dup-1', code: 'CA-01', date: today, status: 'active' },
        { id: 'ws-dup-2', code: 'CA-02', date: today, status: 'active' },
      ];

      const result = validateReportingConsistency({
        dateStr: today,
        sessions,
      });

      expect(result.isConsistent).toBe(false);
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);

      const dupFinding = result.findings.find(f => f.type === 'DUPLICATE_WORK_SESSION');
      expect(dupFinding).toBeDefined();
      expect(dupFinding.severity).toBe('critical');
      expect(dupFinding.entity).toBe('workSession');
    });

    it('Detects auto-closed session with fabricated actualCash as critical anomaly', () => {
      const session = {
        id: 'ws-fab',
        code: 'CA-FAB',
        date: today,
        status: 'closed',
        isAutoClosed: true,
        actualCash: 1500000, // Fabricated! Auto-close must NOT fabricate actualCash
      };

      const result = validateReportingConsistency({
        dateStr: today,
        sessions: [session],
      });

      expect(result.isConsistent).toBe(false);
      const fabFinding = result.findings.find(f => f.type === 'INVALID_AUTOCLOSE_ACTUAL_CASH');
      expect(fabFinding).toBeDefined();
      expect(fabFinding.severity).toBe('critical');
    });

    it('Detects negative product stock as critical anomaly', () => {
      const products = [
        { id: 'p-neg', name: 'Sữa chua', stockQuantity: -3 },
      ];

      const result = validateReportingConsistency({
        dateStr: today,
        sessions: [],
        products,
      });

      expect(result.isConsistent).toBe(false);
      const negFinding = result.findings.find(f => f.type === 'NEGATIVE_PRODUCT_STOCK');
      expect(negFinding).toBeDefined();
      expect(negFinding.severity).toBe('critical');
      expect(negFinding.metadata.stockQuantity).toBe(-3);
    });

    it('Detects inventory movement quantity mismatch against order items as critical anomaly', () => {
      const orders = [
        {
          id: 'ord-mismatch',
          code: 'HD-MISMATCH',
          status: 'completed',
          businessDate: today,
          items: [{ productId: 'p1', quantity: 5 }],
        },
      ];
      const inventoryTransactions = [
        {
          id: 'tx-mismatch',
          orderId: 'ord-mismatch',
          type: 'OUT',
          reason: 'SALE',
          quantity: 3, // DEDUCTED ONLY 3 INSTEAD OF 5!
          businessDate: today,
        },
      ];

      const result = validateReportingConsistency({
        dateStr: today,
        sessions: [],
        orders,
        inventoryTransactions,
      });

      expect(result.isConsistent).toBe(false);
      const qtyFinding = result.findings.find(f => f.type === 'INVENTORY_QUANTITY_MISMATCH');
      expect(qtyFinding).toBeDefined();
      expect(qtyFinding.severity).toBe('critical');
      expect(qtyFinding.metadata.totalOrderQty).toBe(5);
      expect(qtyFinding.metadata.totalTxQty).toBe(3);
    });

    it('Detects concurrent multiple active members on the same POS terminal as warning', () => {
      const members = [
        {
          id: 'mb-1',
          workSessionId: 'ws-pos',
          accountId: employee1.id,
          registerId: 'POS01',
          attendanceStatus: 'present',
          workingStatus: 'selling',
        },
        {
          id: 'mb-2',
          workSessionId: 'ws-pos',
          accountId: employee2.id,
          registerId: 'POS01', // Both active on POS01!
          attendanceStatus: 'present',
          workingStatus: 'selling',
        },
      ];

      const result = validateReportingConsistency({
        dateStr: today,
        sessions: [{ id: 'ws-pos', date: today, status: 'active' }],
        members,
      });

      const posFinding = result.findings.find(f => f.type === 'POS_CONCURRENT_ASSIGNMENT');
      expect(posFinding).toBeDefined();
      expect(posFinding.severity).toBe('warning');
    });

    it('Detects orphan SALE inventory transactions without linked order as warning', () => {
      const inventoryTransactions = [
        {
          id: 'tx-orphan',
          orderId: 'non-existent-order-id',
          type: 'OUT',
          reason: 'SALE',
          quantity: 2,
          businessDate: today,
        },
      ];

      const result = validateReportingConsistency({
        dateStr: today,
        sessions: [],
        orders: [],
        inventoryTransactions,
      });

      const orphanFinding = result.findings.find(f => f.type === 'ORPHAN_INVENTORY_TRANSACTION');
      expect(orphanFinding).toBeDefined();
      expect(orphanFinding.severity).toBe('warning');
    });
  });
});
