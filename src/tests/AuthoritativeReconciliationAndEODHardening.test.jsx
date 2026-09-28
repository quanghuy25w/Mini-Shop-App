import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workSessionApi } from '../api/workSessionApi';
import { orderApi } from '../api/orderApi';
import { calculateEndOfDayAudit } from '../utils/reportCalculations';
import {
  calculateSessionReconciliation,
  RECONCILIATION_STATUS,
} from '../utils/reconciliation';
import { getBusinessDate } from '../utils/businessDate';
import { ROLES, PERMISSIONS } from '../utils/permissions';

const adminActor = {
  id: 'acc-admin-recon',
  role: ROLES.ADMIN,
  name: 'Admin Recon',
  permissions: Object.values(PERMISSIONS),
};

describe('Authoritative Reconciliation & Cash Domain Hardening (Phase 5A)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PURE ENGINE: SALES & PAYMENT METHODS
  // =========================================================================
  describe('1. Pure Engine: Sales, Payments & Physical Cash Isolation', () => {
    it('Counts cash orders towards cashSales and expectedCash, while non-cash orders only affect grossSales/netRevenue', () => {
      const session = {
        id: 'ws-test-recon-1',
        code: 'CA-2026-0923-01',
        date: '2026-09-23',
        initialCash: 1000000,
        status: 'active',
      };

      const orders = [
        // Cash completed: 300,000 at POS01
        {
          id: 'ord-cash-1',
          workSessionId: 'ws-test-recon-1',
          registerId: 'POS01',
          totalAmount: 300000, items: [{ productId: 'p4', quantity: 300000, price: 1 }],
          paymentMethod: 'cash',
          status: 'completed',
        },
        // Transfer completed: 500,000 at POS02 (does not enter physical drawer)
        {
          id: 'ord-trans-1',
          workSessionId: 'ws-test-recon-1',
          registerId: 'POS02',
          totalAmount: 500000, items: [{ productId: 'p4', quantity: 500000, price: 1 }],
          paymentMethod: 'transfer',
          status: 'completed',
        },
        // Card completed: 200,000 at POS01 (does not enter physical drawer)
        {
          id: 'ord-card-1',
          workSessionId: 'ws-test-recon-1',
          registerId: 'POS01',
          totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }],
          paymentMethod: 'card',
          status: 'completed',
        },
      ];

      const recon = calculateSessionReconciliation({ session, orders });

      expect(recon.grossSales).toBe(1000000); // 300k + 500k + 200k
      expect(recon.totalRevenue).toBe(1000000);
      expect(recon.completedOrderCount).toBe(3);
      expect(recon.netRevenue).toBe(1000000);

      // Physical cash isolation
      expect(recon.initialCash).toBe(1000000);
      expect(recon.cashSales).toBe(300000); // only cash order
      expect(recon.cashRefunds).toBe(0);
      expect(recon.expectedCash).toBe(1300000); // 1,000,000 initial + 300,000 cash
      expect(recon.actualCash).toBeNull();
      expect(recon.reconciliationStatus).toBe(RECONCILIATION_STATUS.UNRECONCILED);

      // POS Breakdown
      expect(recon.posBreakdown.POS01.cashSales).toBe(300000);
      expect(recon.posBreakdown.POS02.cashSales).toBe(0);
    });
  });

  // =========================================================================
  // 2. SAME-DAY CANCELLATIONS & CASH VS NON-CASH REFUNDS
  // =========================================================================
  describe('2. Same-Day Cancellations & Refund Impact', () => {
    it('Same-day cash cancellation reduces physical expectedCash, while non-cash refund only reduces netRevenue', () => {
      const session = {
        id: 'ws-test-recon-2',
        code: 'CA-2026-0923-02',
        date: '2026-09-23',
        initialCash: 500000,
        status: 'active',
      };

      const orders = [
        // Cash order completed: 400,000
        {
          id: 'ord-c-1',
          workSessionId: 'ws-test-recon-2',
          registerId: 'POS01',
          totalAmount: 400000, items: [{ productId: 'p4', quantity: 400000, price: 1 }],
          paymentMethod: 'cash',
          status: 'completed',
        },
        // Same-day cash cancellation: 100,000 refunded in cash
        {
          id: 'ord-c-cancel-cash',
          workSessionId: 'ws-test-recon-2',
          registerId: 'POS01',
          totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
          paymentMethod: 'cash',
          refundMethod: 'cash',
          refundCash: true,
          refundAmount: 100000,
          status: 'cancelled',
        },
        // Same-day transfer cancellation: 50,000 refunded via bank transfer (no cash leaving drawer)
        {
          id: 'ord-t-cancel-transfer',
          workSessionId: 'ws-test-recon-2',
          registerId: 'POS02',
          totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
          paymentMethod: 'transfer',
          refundMethod: 'transfer',
          refundCash: false,
          refundAmount: 50000,
          status: 'cancelled',
        },
      ];

      const recon = calculateSessionReconciliation({ session, orders });

      expect(recon.grossSales).toBe(400000);
      expect(recon.cancelledOrderCount).toBe(2);
      expect(recon.refundTotal).toBe(150000); // 100k cash + 50k transfer
      expect(recon.netRevenue).toBe(250000); // 400k - 150k

      // Drawer impact: only cash refund (100k) left the drawer
      expect(recon.initialCash).toBe(500000);
      expect(recon.cashSales).toBe(400000);
      expect(recon.cashRefunds).toBe(100000);
      expect(recon.expectedCash).toBe(500000 + 400000 - 100000); // 800,000
    });
  });

  // =========================================================================
  // 3. HISTORICAL CANCELLATIONS
  // =========================================================================
  describe('3. Historical Cancellations (Past Date Orders Cancelled Today)', () => {
    it('Historical order cancelled today does NOT count as today gross sale, but cash refund is deducted from today drawer', () => {
      const today = '2026-09-23';
      const todaySession = {
        id: 'ws-today-session',
        code: 'CA-20260923-01',
        date: today,
        initialCash: 1000000,
        status: 'active',
      };

      const orders = [
        // Today completed sale: 200,000 cash
        {
          id: 'ord-today-01',
          workSessionId: 'ws-today-session',
          registerId: 'POS01',
          businessDate: today,
          totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }],
          paymentMethod: 'cash',
          status: 'completed',
        },
        // Historical order from 2026-08-15, cancelled today with 300,000 cash refund from current drawer
        {
          id: 'ord-hist-past',
          code: 'HD-PAST-001',
          workSessionId: 'ws-past-session-0815',
          businessDate: '2026-08-15',
          registerId: 'POS01',
          totalAmount: 300000, items: [{ productId: 'p4', quantity: 300000, price: 1 }],
          paymentMethod: 'cash',
          status: 'historical_cancelled',
          cancelledWorkSessionId: 'ws-today-session',
          cancelledBusinessDate: today,
          cancelledRegisterId: 'POS01',
          refundAmount: 300000,
          refundCash: true,
          refundMethod: 'cash',
        },
      ];

      const recon = calculateSessionReconciliation({ session: todaySession, orders });

      // Historical order is NOT a new sale today!
      expect(recon.grossSales).toBe(200000);
      expect(recon.completedOrderCount).toBe(1);

      // Refund IS accounted in today's context
      expect(recon.cancelledOrderCount).toBe(1);
      expect(recon.refundTotal).toBe(300000);
      expect(recon.netRevenue).toBe(200000 - 300000); // -100,000

      // Physical cash reflects the 300k paid out today
      expect(recon.initialCash).toBe(1000000);
      expect(recon.cashSales).toBe(200000);
      expect(recon.cashRefunds).toBe(300000);
      expect(recon.expectedCash).toBe(1000000 + 200000 - 300000); // 900,000
    });
  });

  // =========================================================================
  // 4. CROSS-POS REFUND CONTEXT
  // =========================================================================
  describe('4. Cross-POS Refund Attribution', () => {
    it('Attributes sale to selling POS and refund to the distinct POS where return was performed', () => {
      const session = {
        id: 'ws-cross-pos',
        code: 'CA-20260923-01',
        date: '2026-09-23',
        initialCash: 2000000,
        status: 'active',
      };

      const orders = [
        // Sold at POS01 for 500,000
        {
          id: 'ord-sold-pos1',
          workSessionId: 'ws-cross-pos',
          registerId: 'POS01',
          totalAmount: 500000, items: [{ productId: 'p4', quantity: 500000, price: 1 }],
          paymentMethod: 'cash',
          status: 'completed',
        },
        // Another customer bought at POS01 for 200,000, but returned/cancelled at POS02!
        {
          id: 'ord-return-pos2',
          workSessionId: 'ws-cross-pos',
          registerId: 'POS01', // original selling POS
          cancelledRegisterId: 'POS02', // actual refund POS!
          totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }],
          paymentMethod: 'cash',
          refundMethod: 'cash',
          refundCash: true,
          refundAmount: 200000,
          status: 'cancelled',
        },
      ];

      const recon = calculateSessionReconciliation({ session, orders });

      // POS01 has the 500k sale and 0 refund
      expect(recon.posBreakdown.POS01.cashSales).toBe(500000);
      expect(recon.posBreakdown.POS01.cashRefunds).toBe(0);
      expect(recon.posBreakdown.POS01.expectedCash).toBe(500000);

      // POS02 has 0 sales and the 200k cash refund (cash handed out of POS02 drawer)
      expect(recon.posBreakdown.POS02.cashSales).toBe(0);
      expect(recon.posBreakdown.POS02.cashRefunds).toBe(200000);
      expect(recon.posBreakdown.POS02.expectedCash).toBe(-200000);

      // Store Total balances perfectly
      expect(recon.cashSales).toBe(500000);
      expect(recon.cashRefunds).toBe(200000);
      expect(recon.expectedCash).toBe(2000000 + 500000 - 200000); // 2,300,000
    });
  });

  // =========================================================================
  // 5. CASH DIFFERENCE & RECONCILIATION STATUS
  // =========================================================================
  describe('5. Cash Difference (MATCH, SURPLUS, SHORTAGE)', () => {
    const baseSession = {
      id: 'ws-diff-status',
      code: 'CA-STATUS',
      date: '2026-09-23',
      initialCash: 1000000,
      status: 'active',
    };
    const baseOrders = [
      {
        id: 'ord-s1',
        workSessionId: 'ws-diff-status',
        registerId: 'POS01',
        totalAmount: 500000, items: [{ productId: 'p4', quantity: 500000, price: 1 }],
        paymentMethod: 'cash',
        status: 'completed',
      },
    ];
    // Expected Cash = 1,000,000 + 500,000 = 1,500,000

    it('MATCH: When actualCash equals expectedCash exactly', () => {
      const recon = calculateSessionReconciliation({
        session: baseSession,
        orders: baseOrders,
        actualCash: 1500000,
      });
      expect(recon.actualCash).toBe(1500000);
      expect(recon.cashDifference).toBe(0);
      expect(recon.reconciliationStatus).toBe(RECONCILIATION_STATUS.MATCH);
    });

    it('SURPLUS: When actualCash is greater than expectedCash', () => {
      const recon = calculateSessionReconciliation({
        session: baseSession,
        orders: baseOrders,
        actualCash: 1550000, // 50,000 extra
      });
      expect(recon.actualCash).toBe(1550000);
      expect(recon.cashDifference).toBe(50000);
      expect(recon.reconciliationStatus).toBe(RECONCILIATION_STATUS.SURPLUS);
    });

    it('SHORTAGE: When actualCash is less than expectedCash', () => {
      const recon = calculateSessionReconciliation({
        session: baseSession,
        orders: baseOrders,
        actualCash: 1450000, // 50,000 short
      });
      expect(recon.actualCash).toBe(1450000);
      expect(recon.cashDifference).toBe(-50000);
      expect(recon.reconciliationStatus).toBe(RECONCILIATION_STATUS.SHORTAGE);
    });

    it('UNRECONCILED: When actualCash is null (drawer uncounted / active session)', () => {
      const recon = calculateSessionReconciliation({
        session: baseSession,
        orders: baseOrders,
        actualCash: null,
      });
      expect(recon.actualCash).toBeNull();
      expect(recon.cashDifference).toBeNull();
      expect(recon.reconciliationStatus).toBe(RECONCILIATION_STATUS.UNRECONCILED);
    });
  });

  // =========================================================================
  // 6. AUTO-CLOSE VS MANUAL CLOSE & IMMUTABILITY
  // =========================================================================
  describe('6. Auto-Close vs Manual Close & Reconciliation Immutability', () => {
    it('Auto-close creates valid expectedCash and UNRECONCILED status without fabricating actualCash', async () => {
      const pastDate = '2026-08-01';
      await workSessionApi.create({
        id: 'ws-autoclose-target',
        code: 'CA-20260801-01',
        date: pastDate,
        shiftType: 'daily',
        name: 'Ca quá khứ chưa đóng',
        status: 'active',
        initialCash: 800000,
      });

      await orderApi.create({
        id: 'ord-autoclose-01',
        code: 'HD-AUTO-01',
        workSessionId: 'ws-autoclose-target',
        registerId: 'POS01',
        businessDate: pastDate,
        totalAmount: 400000, items: [{ productId: 'p4', quantity: 400000, price: 1 }],
        paymentMethod: 'cash',
        status: 'completed',
      }, adminActor);

      // Trigger auto-close
      await workSessionApi.autoClosePastSessions(getBusinessDate());

      const closed = (await workSessionApi.getById('ws-autoclose-target')).data;
      expect(closed.status).toBe('closed');
      expect(closed.isAutoClosed).toBe(true);
      expect(closed.actualCash).toBeNull(); // NOT fabricated
      expect(closed.cashDifference).toBeUndefined(); // NOT fabricated
      expect(closed.reconciliationStatus).toBe(RECONCILIATION_STATUS.UNRECONCILED);
      expect(closed.expectedCash).toBe(800000 + 400000); // 1,200,000
    });

    it('Manual close creates immutable snapshot and prevents financial field mutations', async () => {
      const today = getBusinessDate();
      await workSessionApi.create({
        id: 'ws-manual-snapshot',
        code: 'CA-SNAPSHOT-01',
        date: today,
        shiftType: 'daily',
        name: 'Ca đóng thủ công',
        status: 'active',
        initialCash: 500000,
      });

      await orderApi.create({
        id: 'ord-manual-01',
        code: 'HD-MANUAL-01',
        workSessionId: 'ws-manual-snapshot',
        registerId: 'POS01',
        businessDate: today,
        totalAmount: 500000, items: [{ productId: 'p4', quantity: 500000, price: 1 }],
        paymentMethod: 'cash',
        status: 'completed',
      }, adminActor);

      // Manually close with actualCash = 1,000,000 (exact match)
      const closed = await workSessionApi.closeSession('ws-manual-snapshot', {
        actualCash: 1000000,
        closeNote: 'Kiểm quỹ khớp hoàn toàn',
        actor: adminActor,
      });

      expect(closed.status).toBe('closed');
      expect(closed.isAutoClosed).toBeUndefined();
      expect(closed.actualCash).toBe(1000000);
      expect(closed.expectedCash).toBe(1000000);
      expect(closed.cashDifference).toBe(0);
      expect(closed.reconciliationStatus).toBe(RECONCILIATION_STATUS.MATCH);
      expect(closed.reconciliationSnapshot).toBeDefined();

      // Verify Immutability: normal patch must reject edits to financial fields
      await expect(
        workSessionApi.patch('ws-manual-snapshot', { initialCash: 9999999 })
      ).rejects.toThrow(/CLOSED_SESSION_IMMUTABLE/);

      await expect(
        workSessionApi.patch('ws-manual-snapshot', { actualCash: 9999999 })
      ).rejects.toThrow(/CLOSED_SESSION_IMMUTABLE/);

      await expect(
        workSessionApi.patch('ws-manual-snapshot', { expectedCash: 9999999 })
      ).rejects.toThrow(/CLOSED_SESSION_IMMUTABLE/);
    });
  });

  // =========================================================================
  // 7. CALCULATION CONSISTENCY ACROSS API, PREVIEW & EOD AUDIT
  // =========================================================================
  describe('7. Calculation Consistency: API == Preview == EOD Audit', () => {
    it('Produces mathematically identical results between calculateSessionReconciliation and calculateEndOfDayAudit', async () => {
      const today = getBusinessDate();
      const testSession = {
        id: 'ws-consist-01',
        code: 'CA-CONSIST-01',
        date: today,
        shiftType: 'daily',
        status: 'active',
        initialCash: 1500000,
      };

      const testOrders = [
        {
          id: 'ord-cons-1',
          workSessionId: 'ws-consist-01',
          businessDate: today,
          registerId: 'POS01',
          totalAmount: 600000, items: [{ productId: 'p4', quantity: 600000, price: 1 }],
          paymentMethod: 'cash',
          status: 'completed',
        },
        {
          id: 'ord-cons-2',
          workSessionId: 'ws-consist-01',
          businessDate: today,
          registerId: 'POS02',
          totalAmount: 400000, items: [{ productId: 'p4', quantity: 400000, price: 1 }],
          paymentMethod: 'transfer',
          status: 'completed',
        },
        {
          id: 'ord-cons-3',
          workSessionId: 'ws-consist-01',
          businessDate: today,
          registerId: 'POS01',
          totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
          paymentMethod: 'cash',
          refundMethod: 'cash',
          refundCash: true,
          refundAmount: 100000,
          status: 'cancelled',
        },
      ];

      // 1. Pure calculation (used in preview modal and closeSession)
      const previewRecon = calculateSessionReconciliation({
        session: testSession,
        orders: testOrders,
        actualCash: 2000000,
      });

      // 2. End-of-Day Audit calculation
      const audit = calculateEndOfDayAudit({
        dateStr: today,
        sessions: [testSession],
        orders: testOrders,
        members: [],
        inventoryTransactions: [],
        activityLogs: [],
      });

      // Consistency Verification
      expect(previewRecon.grossSales).toBe(audit.storeOverview.totalSalesRevenue);
      expect(previewRecon.grossSales).toBe(1000000); // 600k + 400k
      expect(previewRecon.cashSales).toBe(600000);
      expect(previewRecon.cashRefunds).toBe(100000);
      expect(previewRecon.expectedCash).toBe(1500000 + 600000 - 100000); // 2,000,000
      expect(previewRecon.netRevenue).toBe(900000); // 1,000,000 - 100,000

      expect(audit.storeOverview.grossSales).toBe(previewRecon.grossSales);
      expect(audit.storeOverview.refundTotal).toBe(previewRecon.refundTotal);
      expect(audit.storeOverview.netRevenue).toBe(previewRecon.netRevenue);
      expect(audit.storeOverview.expectedCash).toBe(previewRecon.expectedCash);
    });
  });
});
