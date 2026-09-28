/**
 * FinalEdgeCasesAndIntegrityHardening.test.jsx
 *
 * Dedicated Test Suite for Phase 6B:
 * 1. Multi-POS & Register Isolation Invariants
 * 2. Work Session Lifecycle & Immutability Edge Cases
 * 3. Deactivated Account Fail-Closed Security
 * 4. Order & Cancellation Transactional Hardening
 * 5. Data Consistency Engine Adversarial Corruptions
 * 6. Self-Account View vs Administrative RBAC Hardening
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { initSeedData } from './mockApi';
import { workSessionApi } from '../api/workSessionApi';
import { accountApi } from '../api/accountApi';
import { orderApi } from '../api/orderApi';
import { productApi } from '../api/productApi';
import { hasPermission, assertPermission, PERMISSIONS, ROLES } from '../utils/permissions';
import { validateReportingConsistency } from '../utils/reportCalculations';
import { REGISTERS } from '../utils/registerConfig';

describe('Phase 6B: Final Edge Cases, Business Integrity & Pre-Audit QA', () => {

  const adminActor = {
    id: 'acc-admin-qa',
    employeeId: 'st-adm-qa',
    role: ROLES.ADMIN,
    name: 'Quản trị viên QA',
    isActive: true,
  };

  const staffActor = {
    id: 'acc-staff-qa',
    employeeId: 'st-stf-qa',
    role: ROLES.STAFF,
    name: 'Quản lý QA',
    isActive: true,
  };

  const employee1 = {
    id: 'acc-emp1-qa',
    employeeId: 'st-emp1-qa',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên 01 QA',
    employeeCode: 'NVQA01',
    isActive: true,
  };

  const employee2 = {
    id: 'acc-emp2-qa',
    employeeId: 'st-emp2-qa',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên 02 QA',
    employeeCode: 'NVQA02',
    isActive: true,
  };

  beforeEach(async () => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();

    // Seed test accounts for self-view and authentication tests
    await accountApi.create(adminActor);
    await accountApi.create(staffActor);
    await accountApi.create(employee1);
    await accountApi.create(employee2);
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. MULTI-POS & REGISTER ISOLATION INVARIANTS
  // =========================================================================
  describe('1. Multi-POS & Register Isolation Invariants', () => {
    it('Rejects order creation with an unregistered register ID', () => {
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          id: 'ord-invalid-pos',
          registerId: 'POS99',
          items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 10000 }],
          totalAmount: 10000, items: [{ productId: 'p4', quantity: 10000, price: 1 }],
          paymentMethod: 'cash',
        }, employee1);
      }).toThrow(/Quầy bán hàng "POS99" không tồn tại/i);
    });

    it('Rejects order creation with an invalid payment method', () => {
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          id: 'ord-invalid-method',
          registerId: 'POS01',
          items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 10000 }],
          totalAmount: 10000, items: [{ productId: 'p4', quantity: 10000, price: 1 }],
          paymentMethod: 'crypto',
        }, employee1);
      }).toThrow(/Phương thức thanh toán "crypto" không hợp lệ/i);
    });

    it('Enforces POS isolation: rejects two active employees occupying the same POS concurrently', async () => {
      const today = '2026-10-01';
      await workSessionApi.create({
        id: 'ws-pos-iso-1',
        date: today,
        status: 'active',
      }, adminActor);

      // Employee 1 takes POS01
      await workSessionApi.createMember({
        id: 'wsm-emp1-pos1',
        workSessionId: 'ws-pos-iso-1',
        accountId: employee1.id,
        registerId: 'POS01',
        attendanceStatus: 'present',
      }, adminActor);

      // Employee 2 attempts to take POS01 concurrently -> rejected
      await expect(
        workSessionApi.createMember({
          id: 'wsm-emp2-pos1',
          workSessionId: 'ws-pos-iso-1',
          accountId: employee2.id,
          registerId: 'POS01',
          attendanceStatus: 'present',
        }, adminActor)
      ).rejects.toThrow(/Quầy thu ngân POS01 đang được sử dụng bởi nhân viên khác/i);
    });

    it('Enforces Employee isolation: rejects one employee occupying multiple POS concurrently', async () => {
      const today = '2026-10-02';
      await workSessionApi.create({
        id: 'ws-pos-iso-2',
        date: today,
        status: 'active',
      }, adminActor);

      // Employee 1 takes POS01
      await workSessionApi.createMember({
        id: 'wsm-emp1-pos1-a',
        workSessionId: 'ws-pos-iso-2',
        accountId: employee1.id,
        registerId: 'POS01',
        attendanceStatus: 'present',
      }, adminActor);

      // Same Employee 1 attempts to take POS02 without checking out POS01 -> rejected
      await expect(
        workSessionApi.createMember({
          id: 'wsm-emp1-pos2-b',
          workSessionId: 'ws-pos-iso-2',
          accountId: employee1.id,
          registerId: 'POS02',
          attendanceStatus: 'present',
        }, adminActor)
      ).rejects.toThrow(/Nhân viên đang hoạt động tại quầy thu ngân khác/i);
    });
  });

  // =========================================================================
  // 2. WORK SESSION LIFECYCLE & IMMUTABILITY EDGE CASES
  // =========================================================================
  describe('2. Work Session Lifecycle & Immutability Edge Cases', () => {
    it('Auto-close past session sets actualCash to null, avoids fabricated cash figures', async () => {
      const pastDate = '2026-09-01';
      await workSessionApi.create({
        id: 'ws-past-auto-close',
        date: pastDate,
        status: 'active',
        initialCash: 500000,
      }, adminActor);

      await workSessionApi.autoClosePastSessions('2026-09-02');

      const sessionRes = await workSessionApi.getById('ws-past-auto-close');
      const session = sessionRes.data;

      expect(session.status).toBe('closed');
      expect(session.isAutoClosed).toBe(true);
      expect(session.actualCash).toBeNull();
    });

    it('Closed session rejects reopening or status modifications', async () => {
      const date = '2026-10-03';
      await workSessionApi.create({
        id: 'ws-closed-reopen',
        date,
        status: 'planned',
        initialCash: 500000,
      }, adminActor);

      await workSessionApi.patch('ws-closed-reopen', { status: 'active' }, adminActor);
      await workSessionApi.patch('ws-closed-reopen', { status: 'closed', actualCash: 500000 }, adminActor);

      // Attempt reopening closed -> active
      await expect(
        workSessionApi.patch('ws-closed-reopen', { status: 'active' }, adminActor)
      ).rejects.toThrow(/Chuyển trạng thái ca không hợp lệ/i);

      // Attempt closed -> cancelled
      await expect(
        workSessionApi.patch('ws-closed-reopen', { status: 'cancelled' }, adminActor)
      ).rejects.toThrow(/Chuyển trạng thái ca không hợp lệ/i);
    });

    it('Closed session rejects financial field tampering (CLOSED_SESSION_IMMUTABLE)', async () => {
      const date = '2026-10-04';
      await workSessionApi.create({
        id: 'ws-fin-immutable',
        date,
        status: 'planned',
        initialCash: 500000,
      }, adminActor);

      await workSessionApi.patch('ws-fin-immutable', { status: 'active' }, adminActor);
      await workSessionApi.patch('ws-fin-immutable', { status: 'closed', actualCash: 500000 }, adminActor);

      // Tamper with initialCash
      await expect(
        workSessionApi.patch('ws-fin-immutable', { initialCash: 9999999 }, adminActor)
      ).rejects.toThrow(/CLOSED_SESSION_IMMUTABLE/i);

      // Tamper with actualCash
      await expect(
        workSessionApi.patch('ws-fin-immutable', { actualCash: 9999999 }, adminActor)
      ).rejects.toThrow(/CLOSED_SESSION_IMMUTABLE/i);
    });

    it('Cancelled session is completely immutable (CANCELLED_SESSION_IMMUTABLE)', async () => {
      const date = '2026-10-05';
      await workSessionApi.create({
        id: 'ws-cancel-imm',
        date,
        status: 'planned',
        initialCash: 500000,
      }, adminActor);

      await workSessionApi.patch('ws-cancel-imm', { status: 'cancelled' }, adminActor);

      await expect(
        workSessionApi.patch('ws-cancel-imm', { note: 'Đổi ghi chú ca đã hủy' }, adminActor)
      ).rejects.toThrow(/Ca làm việc đã bị hủy và không thể chỉnh sửa/i);
    });

    it('Manual session close requires explanation note if cash discrepancy exists', async () => {
      const date = '2026-10-06';
      await workSessionApi.create({
        id: 'ws-discrepancy-test',
        date,
        status: 'planned',
        initialCash: 1000000,
      }, adminActor);

      await workSessionApi.patch('ws-discrepancy-test', { status: 'active' }, adminActor);

      // Actual cash 800,000 when expected 1,000,000 (diff -200,000) without note -> rejected
      await expect(
        workSessionApi.closeSession('ws-discrepancy-test', {
          actualCash: 800000,
          closeNote: '',
          actor: adminActor,
        })
      ).rejects.toThrow(/DISCREPANCY_NOTE_REQUIRED/i);
    });
  });

  // =========================================================================
  // 3. DEACTIVATED USER FAIL-CLOSED SECURITY
  // =========================================================================
  describe('3. Deactivated Account Fail-Closed Security', () => {
    it('Immediately revokes all permissions for deactivated account', () => {
      const deactivatedAdmin = { ...adminActor, isActive: false };
      const deactivatedStaff = { ...staffActor, isActive: false };
      const deactivatedEmp = { ...employee1, isActive: false };

      expect(hasPermission(deactivatedAdmin, PERMISSIONS.PRODUCT_VIEW)).toBe(false);
      expect(hasPermission(deactivatedStaff, PERMISSIONS.ORDER_CREATE)).toBe(false);
      expect(hasPermission(deactivatedEmp, PERMISSIONS.POS_ACCESS)).toBe(false);

      expect(() => assertPermission(deactivatedAdmin, PERMISSIONS.PRODUCT_VIEW)).toThrow(/ACCOUNT_INACTIVE/i);
      expect(() => assertPermission(deactivatedStaff, PERMISSIONS.ORDER_CREATE)).toThrow(/ACCOUNT_INACTIVE/i);
      expect(() => assertPermission(deactivatedEmp, PERMISSIONS.POS_ACCESS)).toThrow(/ACCOUNT_INACTIVE/i);
    });

    it('Immediately revokes all permissions if staffInfo is deactivated', () => {
      const inactiveStaffProfile = {
        ...employee1,
        isActive: true,
        staffInfo: { id: employee1.employeeId, isActive: false },
      };

      expect(hasPermission(inactiveStaffProfile, PERMISSIONS.POS_ACCESS)).toBe(false);
      expect(() => assertPermission(inactiveStaffProfile, PERMISSIONS.POS_ACCESS)).toThrow(/ACCOUNT_INACTIVE/i);
    });

    it('Blocks deactivated actor from creating orders', () => {
      const deactivatedActor = { ...employee1, isActive: false };

      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          id: 'ord-deactivated-user',
          registerId: 'POS01',
          items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 10000 }],
          totalAmount: 10000, items: [{ productId: 'p4', quantity: 10000, price: 1 }],
          paymentMethod: 'cash',
        }, deactivatedActor);
      }).toThrow(/ACCOUNT_INACTIVE/i);
    });
  });

  // =========================================================================
  // 4. ORDER CANCELLATION, RESTOCK & TRANSACTION ROLLBACK HARDENING
  // =========================================================================
  describe('4. Order Cancellation, Restock & Transaction Rollback Hardening', () => {
    it('Employee cannot cancel order created by another seller (NOT_OWN_ORDER)', async () => {
      const today = '2026-10-07';
      const order = await orderApi.create({
        id: 'ord-seller-diff',
        registerId: 'POS01',
        workSessionId: 'ws-cancel-rules',
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
        totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
        paymentMethod: 'cash',
        businessDate: today,
        createdAt: new Date().toISOString(),
      }, employee1);

      // Employee 2 attempts to cancel Employee 1's order -> rejected
      await expect(
        orderApi.cancel(order.data.id, {
          actor: employee2,
          currentSessionId: 'ws-cancel-rules',
          reason: 'Hủy nhầm',
        })
      ).rejects.toThrow(/Bạn chỉ được hủy đơn hàng do chính mình tạo/i);
    });

    it('Employee cannot cancel order outside of 15-minute window (CANCEL_WINDOW_EXPIRED)', async () => {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const order = await orderApi.create({
        id: 'ord-expired-cancel',
        registerId: 'POS01',
        workSessionId: 'ws-cancel-window',
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
        totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
        paymentMethod: 'cash',
        createdAt: twentyMinutesAgo,
      }, employee1);

      await expect(
        orderApi.cancel(order.data.id, {
          actor: employee1,
          currentSessionId: 'ws-cancel-window',
          reason: 'Quá thời hạn',
        })
      ).rejects.toThrow(/Đã quá 15 phút kể từ lúc tạo đơn/i);
    });

    it('Rejects double cancellation on an already cancelled order (ORDER_ALREADY_CANCELLED)', async () => {
      const order = await orderApi.create({
        id: 'ord-double-cancel',
        registerId: 'POS01',
        workSessionId: 'ws-cancel-double',
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
        totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
        paymentMethod: 'cash',
        createdAt: new Date().toISOString(),
      }, employee1);

      // First cancellation
      await orderApi.cancel(order.data.id, {
        actor: employee1,
        currentSessionId: 'ws-cancel-double',
        reason: 'Hủy lần 1',
      });

      // Second cancellation attempt -> rejected
      await expect(
        orderApi.cancel(order.data.id, {
          actor: employee1,
          currentSessionId: 'ws-cancel-double',
          reason: 'Hủy lần 2',
        })
      ).rejects.toThrow(/ORDER_ALREADY_CANCELLED/i);
    });

    it('Rollback compensation leaves stock intact if cancellation fails midway', async () => {
      const prodsRes = await productApi.getAll();
      const testProd = prodsRes.data[0];
      const initialStock = testProd.stockQuantity;

      const order = await orderApi.create({
        id: 'ord-rollback-test',
        registerId: 'POS01',
        workSessionId: 'ws-cancel-rb',
        items: [{ productId: testProd.id, quantity: 2, price: 10000 }],
        totalAmount: 20000, items: [{ productId: 'p4', quantity: 20000, price: 1 }],
        paymentMethod: 'cash',
        createdAt: new Date().toISOString(),
      }, adminActor);

      // Mock failure inside order patch during cancelAndRestock
      vi.spyOn((await import('../api/axiosClient')).default, 'patch').mockImplementationOnce(() => {
        throw new Error('NETWORK_TIMEOUT_MID_RESTOCK');
      });

      await expect(
        orderApi.cancelAndRestock(order.data.id, {
          actor: adminActor,
          reason: 'Test rollback restock',
        })
      ).rejects.toThrow();

      // Product stock must be preserved and not corrupted
      const prodAfter = await productApi.getById(testProd.id);
      expect(prodAfter.data.stockQuantity).toBe(initialStock);
    });
  });

  // =========================================================================
  // 5. DATA CONSISTENCY ENGINE ADVERSARIAL VERIFICATION
  // =========================================================================
  describe('5. Data Consistency Engine Adversarial Verification', () => {
    const today = '2026-10-10';

    it('Detects ORDER_MISSING_REGISTER when order lacks registerId', () => {
      const findings = validateReportingConsistency({
        dateStr: today,
        sessions: [{ id: 'ws-clean', date: today, status: 'active', initialCash: 1000000 }],
        orders: [
          {
            id: 'ord-no-reg',
            businessDate: today,
            totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
            paymentMethod: 'cash',
            status: 'completed',
            registerId: null, // MISSING
          }
        ],
        registers: REGISTERS,
      });

      expect(findings.warningCount).toBeGreaterThan(0);
      expect(findings.findings.some(f => f.type === 'ORDER_MISSING_REGISTER')).toBe(true);
    });

    it('Detects ORDER_INVALID_REGISTER when order references non-existent register', () => {
      const findings = validateReportingConsistency({
        dateStr: today,
        sessions: [{ id: 'ws-clean', date: today, status: 'active', initialCash: 1000000 }],
        orders: [
          {
            id: 'ord-bad-reg',
            businessDate: today,
            totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
            paymentMethod: 'cash',
            status: 'completed',
            registerId: 'POS99', // INVALID
          }
        ],
        registers: REGISTERS,
      });

      expect(findings.warningCount).toBeGreaterThan(0);
      expect(findings.findings.some(f => f.type === 'ORDER_INVALID_REGISTER')).toBe(true);
    });

    it('Detects INCONSISTENT_CANCELLATION_REFUND when refund exceeds total amount or is negative', () => {
      const findings = validateReportingConsistency({
        dateStr: today,
        sessions: [{ id: 'ws-clean', date: today, status: 'active', initialCash: 1000000 }],
        orders: [
          {
            id: 'ord-bad-refund',
            businessDate: today,
            totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
            refundAmount: 250000, // EXCEEDS totalAmount
            paymentMethod: 'cash',
            status: 'cancelled',
            registerId: 'POS01',
          }
        ],
        registers: REGISTERS,
      });

      expect(findings.isConsistent).toBe(false);
      expect(findings.criticalCount).toBeGreaterThan(0);
      expect(findings.findings.some(f => f.type === 'INCONSISTENT_CANCELLATION_REFUND')).toBe(true);
    });

    it('Detects DUPLICATE_SALE_LINKAGE when multiple SALE transactions exist for single item', () => {
      const findings = validateReportingConsistency({
        dateStr: today,
        sessions: [{ id: 'ws-clean', date: today, status: 'active', initialCash: 1000000 }],
        orders: [
          {
            id: 'ord-dup-sale',
            code: 'HD-DUP-01',
            businessDate: today,
            totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
            paymentMethod: 'cash',
            status: 'completed',
            registerId: 'POS01',
            items: [{ productId: 'prod-001', quantity: 1, price: 50000 }],
          }
        ],
        inventoryTransactions: [
          {
            id: 'tx-sale-1',
            orderId: 'ord-dup-sale',
            orderCode: 'HD-DUP-01',
            productId: 'prod-001',
            reason: 'SALE',
            type: 'OUT',
            quantity: 1,
            businessDate: today,
          },
          {
            id: 'tx-sale-2',
            orderId: 'ord-dup-sale',
            orderCode: 'HD-DUP-01',
            productId: 'prod-001',
            reason: 'SALE',
            type: 'OUT',
            quantity: 1,
            businessDate: today,
          }
        ],
        registers: REGISTERS,
      });

      expect(findings.warningCount).toBeGreaterThan(0);
      expect(findings.findings.some(f => f.type === 'DUPLICATE_SALE_LINKAGE')).toBe(true);
    });

    it('Detects DUPLICATE_RESTOCK_TRANSACTION when multiple CANCEL_RESTOCK exist for single item', () => {
      const findings = validateReportingConsistency({
        dateStr: today,
        sessions: [{ id: 'ws-clean', date: today, status: 'active', initialCash: 1000000 }],
        orders: [
          {
            id: 'ord-dup-restock',
            code: 'HD-DUP-02',
            businessDate: today,
            totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
            refundAmount: 50000,
            paymentMethod: 'cash',
            status: 'cancelled',
            registerId: 'POS01',
            items: [{ productId: 'prod-001', quantity: 1, price: 50000 }],
          }
        ],
        inventoryTransactions: [
          {
            id: 'tx-restock-1',
            orderId: 'ord-dup-restock',
            orderCode: 'HD-DUP-02',
            productId: 'prod-001',
            reason: 'CANCEL_RESTOCK',
            type: 'IN',
            quantity: 1,
            businessDate: today,
          },
          {
            id: 'tx-restock-2',
            orderId: 'ord-dup-restock',
            orderCode: 'HD-DUP-02',
            productId: 'prod-001',
            reason: 'CANCEL_RESTOCK',
            type: 'IN',
            quantity: 1,
            businessDate: today,
          }
        ],
        registers: REGISTERS,
      });

      expect(findings.warningCount).toBeGreaterThan(0);
      expect(findings.findings.some(f => f.type === 'DUPLICATE_RESTOCK_TRANSACTION')).toBe(true);
    });

    it('Evaluates isConsistent = true with zero findings on pristine data', () => {
      const findings = validateReportingConsistency({
        dateStr: today,
        sessions: [{ id: 'ws-pristine', date: today, status: 'active', initialCash: 1000000 }],
        orders: [
          {
            id: 'ord-pristine',
            code: 'HD-OK-01',
            businessDate: today,
            totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
            paymentMethod: 'cash',
            status: 'completed',
            registerId: 'POS01',
            workSessionId: 'ws-pristine',
            items: [{ productId: 'prod-001', quantity: 1, price: 50000 }],
          }
        ],
        inventoryTransactions: [
          {
            id: 'tx-pristine',
            orderId: 'ord-pristine',
            orderCode: 'HD-OK-01',
            productId: 'prod-001',
            reason: 'SALE',
            type: 'OUT',
            quantity: 1,
            businessDate: today,
          }
        ],
        registers: REGISTERS,
      });

      expect(findings.isConsistent).toBe(true);
      expect(findings.findings.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. SELF-ACCOUNT VIEW VS ADMINISTRATIVE RBAC HARDENING
  // =========================================================================
  describe('6. Self-Account View vs Administrative RBAC Hardening', () => {
    it('Employee and Staff can view their own account credentials for session rehydration', async () => {
      // Employee self-view
      const selfEmpRes = await accountApi.getById(employee1.id, employee1);
      expect(selfEmpRes.data.id).toBe(employee1.id);

      // Staff self-view
      const selfStaffRes = await accountApi.getById(staffActor.id, staffActor);
      expect(selfStaffRes.data.id).toBe(staffActor.id);
    });

    it('Employee and Staff are forbidden from querying other user accounts (PERMISSION_DENIED)', () => {
      // Employee attempts to view Admin account (throws synchronously)
      expect(() => {
        accountApi.getById(adminActor.id, employee1);
      }).toThrow(/PERMISSION_DENIED/i);

      // Staff attempts to view Admin account (throws synchronously)
      expect(() => {
        accountApi.getById(adminActor.id, staffActor);
      }).toThrow(/PERMISSION_DENIED/i);
    });

    it('Employee and Staff are forbidden from listing all accounts (ACCOUNT_VIEW required)', () => {
      expect(() => {
        accountApi.getAll({}, employee1);
      }).toThrow(/PERMISSION_DENIED/i);

      expect(() => {
        accountApi.getAll({}, staffActor);
      }).toThrow(/PERMISSION_DENIED/i);
    });

    it('Employee can update their own password and PIN (self-service), but cannot change others', async () => {
      // Employee updates own password
      const pwRes = await accountApi.updatePassword(employee1.id, 'NewStrongPassword123', employee1);
      expect(pwRes.data.id).toBe(employee1.id);

      // Employee updates own PIN
      const pinRes = await accountApi.updatePin(employee1.id, '654321', employee1);
      expect(pinRes.data.id).toBe(employee1.id);

      // Employee attempts to update Staff password -> forbidden
      expect(() => {
        accountApi.updatePassword(staffActor.id, 'HackedPassword123', employee1);
      }).toThrow(/PERMISSION_DENIED/i);

      // Employee attempts to update Staff PIN -> forbidden
      expect(() => {
        accountApi.updatePin(staffActor.id, '999999', employee1);
      }).toThrow(/PERMISSION_DENIED/i);
    });
  });
});
