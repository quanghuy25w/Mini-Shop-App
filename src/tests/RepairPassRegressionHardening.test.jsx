/**
 * RepairPassRegressionHardening.test.jsx
 *
 * Dedicated regression test suite for the Repair / Stabilization Pass:
 * 1. Completed order immutability via orderApi.update & orderApi.patch
 * 2. Cancelled order protection against generic mutations
 * 3. Canonical register validation in orderApi.create
 * 4. Payment method validation in orderApi.create
 * 5. Selling context & actor identity protection in orderApi.create
 * 6. Fail-closed actor handling in inventoryApi.voidTransaction
 * 7. Report API authorization & employee data isolation (Model B)
 * 8. useCart cash checkout calculation & insufficient cash protection
 * 9. Upfront stock & status validation in useCart
 * 10. Non-destructive delta-based rollback in useCart
 * 11. Authoritative 00:00 midnight business date boundary in Asia/Ho_Chi_Minh
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { initSeedData } from './mockApi';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { reportApi } from '../api/reportApi';
import { useCart } from '../hooks/useCart';
import { AppDataProvider, AppDataContext } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionContext } from '../context/WorkSessionContext';
import { ROLES } from '../utils/permissions';
import { getBusinessDate } from '../utils/businessDate';

// Test harness for useCart hook testing
const CartHarness = ({ onActionRef }) => {
  const { cartItems, addToCart, checkout } = useCart();
  const { products } = React.useContext(AppDataContext);
  React.useEffect(() => {
    if (onActionRef) {
      onActionRef.current = {
        addToCart,
        checkout,
        products,
        cartItems,
      };
    }
  });
  return <div data-testid="cart-harness">Items: {cartItems?.length || 0}</div>;
};

const renderHarness = ({ authValue, sessionValue, onActionRef }) => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthContext.Provider value={authValue}>
          <WorkSessionContext.Provider value={sessionValue}>
            <CartHarness onActionRef={onActionRef} />
          </WorkSessionContext.Provider>
        </AuthContext.Provider>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Repair & Stabilization Pass Regression Hardening Suite', () => {
  const adminActor = {
    id: 'acc-admin-repair',
    role: ROLES.ADMIN,
    name: 'Quản trị viên Repair',
    isActive: true,
  };

  const staffActor = {
    id: 'acc-staff-repair',
    employeeId: 'st-staff-repair',
    role: ROLES.STAFF,
    name: 'Quản lý Repair',
    isActive: true,
  };

  const employee1 = {
    id: 'acc-emp1-repair',
    employeeId: 'st-emp1-repair',
    employeeCode: 'NVRP01',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên 01 Repair',
    isActive: true,
  };

  const employee2 = {
    id: 'acc-emp2-repair',
    employeeId: 'st-emp2-repair',
    employeeCode: 'NVRP02',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên 02 Repair',
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ORDER MUTATION IMMUTABILITY & PROTECTION
  // =========================================================================
  describe('1. Order Mutation Immutability & Status Protection', () => {
    it('Completed order immutability: rejects modifying items, totalAmount, paymentMethod, registerId, and businessDate', async () => {
      const order = {
        id: 'ord-repair-imm-1',
        code: 'HD-RP-001',
        accountId: employee1.id,
        registerId: 'POS01',
        paymentMethod: 'cash',
        totalAmount: 150000,
        subtotal: 150000,
        status: 'completed',
        businessDate: '2026-09-24',
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 150000 }],
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(order, employee1);

      // Mutating items via update is forbidden
      await expect(
        orderApi.update(order.id, { items: [] }, adminActor)
      ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

      // Mutating totalAmount via patch is forbidden
      await expect(
        orderApi.patch(order.id, { totalAmount: 50000 }, adminActor)
      ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

      // Mutating paymentMethod via patch is forbidden
      await expect(
        orderApi.patch(order.id, { paymentMethod: 'card' }, adminActor)
      ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

      // Mutating registerId via update is forbidden
      await expect(
        orderApi.update(order.id, { registerId: 'POS02' }, adminActor)
      ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

      // Mutating businessDate via patch is forbidden
      await expect(
        orderApi.patch(order.id, { businessDate: '2026-09-25' }, adminActor)
      ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
    });

    it('Direct mutation to cancelled status is rejected synchronously in update, patch, and updateStatus', () => {
      expect(() => {
        orderApi.updateStatus('ord-any', 'cancelled', adminActor);
      }).toThrow(/ORDER_MUTATION_RESTRICTED/);

      expect(() => {
        orderApi.patch('ord-any', { status: 'cancelled' }, adminActor);
      }).toThrow(/ORDER_MUTATION_RESTRICTED/);

      expect(() => {
        orderApi.update('ord-any', { status: 'cancelled' }, adminActor);
      }).toThrow(/ORDER_MUTATION_RESTRICTED/);
    });

    it('Cancelled orders cannot be edited via generic update or patch', async () => {
      const order = {
        id: 'ord-repair-canc-1',
        code: 'HD-RP-002',
        accountId: employee1.id,
        registerId: 'POS01',
        paymentMethod: 'cash',
        totalAmount: 100000,
        status: 'cancelled',
        businessDate: '2026-09-24',
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(order, employee1);

      await expect(
        orderApi.update(order.id, { note: 'Chỉnh sửa đơn đã hủy' }, adminActor)
      ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

      await expect(
        orderApi.patch(order.id, { note: 'Chỉnh sửa đơn đã hủy' }, adminActor)
      ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
    });
  });

  // =========================================================================
  // 2. ORDER CREATION VALIDATION & CONTEXT
  // =========================================================================
  describe('2. Order Creation Hardening', () => {
    it('Rejects order creation with an unregistered POS register (POS99) synchronously', () => {
      expect(() => {
        orderApi.create({
          id: 'ord-rp-inv-pos',
          registerId: 'POS99',
          items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 10000 }],
          totalAmount: 10000,
          paymentMethod: 'cash',
        }, employee1);
      }).toThrow(/Quầy bán hàng "POS99" không tồn tại/i);
    });

    it('Rejects order creation with invalid payment methods and accepts valid methods', async () => {
      expect(() => {
        orderApi.create({
          id: 'ord-rp-inv-pay',
          registerId: 'POS01',
          paymentMethod: 'crypto',
          totalAmount: 10000,
        }, employee1);
      }).toThrow(/Phương thức thanh toán "crypto" không hợp lệ/i);

      // Valid methods
      for (const method of ['cash', 'transfer', 'card']) {
        const res = await orderApi.create({
          id: `ord-rp-valid-${method}`,
          registerId: 'POS01',
          paymentMethod: method,
          totalAmount: 10000,
        }, employee1);
        expect(res.data.paymentMethod).toBe(method);
      }
    });

    it('Requires selling context: rejects when requireSellingContext is enabled and items or workSessionId is missing', () => {
      expect(() => {
        orderApi.create({
          id: 'ord-rp-no-items',
          workSessionId: 'ws-active-1',
          items: [],
          totalAmount: 0,
        }, employee1, { requireSellingContext: true });
      }).toThrow(/phải có ít nhất 1 sản phẩm/i);

      expect(() => {
        orderApi.create({
          id: 'ord-rp-no-ws',
          items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 10000 }],
          totalAmount: 10000,
        }, employee1, { requireSellingContext: true });
      }).toThrow(/bắt buộc phải gắn với ca làm việc/i);
    });

    it('Forbids Employee from spoofing another accountId or sellerId', () => {
      expect(() => {
        orderApi.create({
          id: 'ord-rp-spoof-acc',
          accountId: employee2.id,
          totalAmount: 10000,
        }, employee1);
      }).toThrow(/không thể tạo đơn hàng thay mặt tài khoản khác/i);

      expect(() => {
        orderApi.create({
          id: 'ord-rp-spoof-seller',
          sellerId: employee2.id,
          totalAmount: 10000,
        }, employee1);
      }).toThrow(/không thể tạo đơn hàng thay mặt người bán khác/i);
    });
  });

  // =========================================================================
  // 3. INVENTORY VOID FAIL-CLOSED AUTHORIZATION
  // =========================================================================
  describe('3. Inventory voidTransaction Fail-Closed Security', () => {
    it('voidTransaction fails closed when actor is unauthenticated or lacks INVENTORY_ADJUST', () => {
      // Unauthenticated
      expect(() => {
        inventoryApi.voidTransaction('tx-any', null);
      }).toThrow(/NOT_AUTHENTICATED/);

      // Employee without inventory.adjust
      expect(() => {
        inventoryApi.voidTransaction('tx-any', employee1);
      }).toThrow(/PERMISSION_DENIED/);
    });

    it('voidTransaction succeeds when executed by Admin with INVENTORY_ADJUST', async () => {
      // Seed an inventory transaction
      const txRes = await inventoryApi.createSystemTransaction({
        id: 'tx-repair-void-test',
        productId: 'p0000000-0000-0000-0000-000000000001',
        type: 'IN',
        reason: 'PURCHASE',
        quantity: 10,
        unitPrice: 5000,
        note: 'Test nhập để void',
      });

      const voidRes = await inventoryApi.voidTransaction(txRes.data.id, adminActor);
      expect(voidRes.data.isVoided).toBe(true);
      expect(voidRes.data.voidedBy).toBe(adminActor.id);
    });
  });

  // =========================================================================
  // 4. REPORT AUTHORIZATION & EMPLOYEE ISOLATION (MODEL B)
  // =========================================================================
  describe('4. Report API Authorization & Employee Data Scope (Model B)', () => {
    it('Employee requesting Daily Work Report with another employeeId or accountId is strictly overridden to own identity', async () => {
      // Trying to substitute another employeeId
      const dailyRes = await reportApi.getDailyWorkReport({
        date: '2026-09-24',
        employeeId: employee2.employeeId,
        accountId: employee2.id,
        actor: employee1,
      });

      expect(dailyRes.success).toBe(true);
      expect(dailyRes.data.employee.accountId).toBe(employee1.id);
      expect(dailyRes.data.employee.employeeCode).toBe('NVRP01');
    });

    it('Employee requesting Monthly Work Report with another employeeId or accountId is strictly overridden to own identity', async () => {
      const monthlyRes = await reportApi.getMonthlyWorkReport({
        month: '2026-09',
        employeeId: employee2.employeeId,
        accountId: employee2.id,
        actor: employee1,
      });

      expect(monthlyRes.success).toBe(true);
      expect(monthlyRes.data.employee.accountId).toBe(employee1.id);
    });

    it('Allows Employee to fetch their own Daily and Monthly reports', async () => {
      const dailyRes = await reportApi.getDailyWorkReport({
        date: '2026-09-24',
        actor: employee1,
      });
      expect(dailyRes.success).toBe(true);

      const monthlyRes = await reportApi.getMonthlyWorkReport({
        month: '2026-09',
        actor: employee1,
      });
      expect(monthlyRes.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. USECART CHECKOUT: CASH, UPFRONT VALIDATION & DELTA ROLLBACK
  // =========================================================================
  describe('5. useCart Hardening: Cash Calculation, Upfront Validation & Rollback', () => {
    it('Validates cash payment: rejects when cashReceived < finalAmount, calculates change correctly when sufficient', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef,
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0]; // sellPrice 436,000

      await act(async () => {
        actionRef.current.addToCart(testProd, 1);
      });

      // 1. Insufficient cash
      await expect(
        actionRef.current.checkout('cash', 300000)
      ).rejects.toThrow(/không đủ để thanh toán/i);

      // 2. Sufficient cash (500,000)
      let completedOrder = null;
      await act(async () => {
        completedOrder = await actionRef.current.checkout('cash', 500000);
      });

      expect(completedOrder).not.toBeNull();
      expect(completedOrder.paymentMethod).toBe('cash');
      expect(completedOrder.cashReceived).toBe(500000);
      expect(completedOrder.change).toBe(500000 - 436000); // 64,000
    });

    it('Aborts checkout upfront when product is inactive without mutating stock', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef,
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0];
      const initialStock = testProd.stockQuantity;

      // Deactivate product
      await productApi.patch(testProd.id, { isActive: false }, adminActor);

      await act(async () => {
        actionRef.current.addToCart(testProd, 1);
      });

      await expect(actionRef.current.checkout()).rejects.toThrow(/đã ngừng kinh doanh/i);

      // Verify stock untouched
      const prodAfter = (await productApi.getById(testProd.id)).data;
      expect(prodAfter.stockQuantity).toBe(initialStock);

      // Restore active state
      await productApi.patch(testProd.id, { isActive: true }, adminActor);
    });

    it('Executes non-destructive delta rollback when multi-product checkout fails midway', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef,
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(1));
      const prod1 = actionRef.current.products[0];
      const prod2 = actionRef.current.products[1];
      const initialStock1 = prod1.stockQuantity;
      const initialStock2 = prod2.stockQuantity;

      await act(async () => {
        actionRef.current.addToCart(prod1, 2);
        actionRef.current.addToCart(prod2, 1);
      });

      // Mock updateStock to fail on second product
      const originalUpdateStock = productApi.updateStock;
      vi.spyOn(productApi, 'updateStock').mockImplementation(async (id, newStock, actor, ctx) => {
        if (id === prod2.id) {
          throw new Error('Mô phỏng đứt kết nối mạng khi trừ prod2!');
        }
        return originalUpdateStock(id, newStock, actor, ctx);
      });

      await expect(actionRef.current.checkout()).rejects.toThrow(/đứt kết nối mạng/);

      // Verify prod1 stock restored via delta
      const p1After = (await productApi.getById(prod1.id)).data;
      expect(p1After.stockQuantity).toBe(initialStock1);

      // Verify prod2 stock untouched
      const p2After = (await productApi.getById(prod2.id)).data;
      expect(p2After.stockQuantity).toBe(initialStock2);

      // Verify no orphan SALE transactions remain
      const txRes = await inventoryApi.getAllTransactions({ reason: 'SALE' });
      const orphanTx = txRes.data.filter(t => t.orderCode && t.orderCode.includes('HD-'));
      expect(orphanTx.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. AUTHORITATIVE BUSINESS DATE RULE (00:00 MIDNIGHT CALENDAR BOUNDARY)
  // =========================================================================
  describe('6. Authoritative Business Date Boundary (00:00 Midnight in Asia/Ho_Chi_Minh)', () => {
    it('Establishes that the calendar boundary transitions at 00:00:00 (midnight), NOT 06:00:00', () => {
      // 00:00:00 is today
      const midnight = new Date('2026-09-24T00:00:00.000+07:00');
      expect(getBusinessDate(midnight)).toBe('2026-09-24');

      // 05:30:00 is still 2026-09-24 (under 00:00 rule, this belongs to Sept 24)
      const earlyMorning = new Date('2026-09-24T05:30:00.000+07:00');
      expect(getBusinessDate(earlyMorning)).toBe('2026-09-24');

      // 23:59:59 is 2026-09-24
      const lateNight = new Date('2026-09-24T23:59:59.999+07:00');
      expect(getBusinessDate(lateNight)).toBe('2026-09-24');

      // 00:00:01 of the next second is 2026-09-25
      const nextDayMidnight = new Date('2026-09-25T00:00:01.000+07:00');
      expect(getBusinessDate(nextDayMidnight)).toBe('2026-09-25');
    });
  });
});
