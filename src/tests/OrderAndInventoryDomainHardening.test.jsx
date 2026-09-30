import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useContext } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AppDataProvider, AppDataContext } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionContext } from '../context/WorkSessionContext';
import { useCart } from '../hooks/useCart';

import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { registerApi } from '../api/registerApi';
import { ROLES, PERMISSIONS } from '../utils/permissions';
import { getBusinessDate } from '../utils/businessDate';

// Test Harness Component for useCart
const CartTester = ({ onActionRef }) => {
  const { cartItems, addToCart, checkout, clearCart } = useCart();
  const { products } = useContext(AppDataContext);

  React.useEffect(() => {
    if (onActionRef) {
      onActionRef.current = {
        cartItems,
        addToCart,
        checkout,
        clearCart,
        products
      };
    }
  });

  return <div>Cart Tester (Items: {cartItems.length})</div>;
};

const renderHarness = ({ authValue, sessionValue, onActionRef }) => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthContext.Provider value={authValue}>
          <WorkSessionContext.Provider value={sessionValue}>
            <CartTester onActionRef={onActionRef} />
          </WorkSessionContext.Provider>
        </AuthContext.Provider>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Order & Inventory Domain Hardening Integration Tests', () => {
  const adminActor = { id: 'acc-admin', role: ROLES.ADMIN, permissions: Object.values(PERMISSIONS) };
  const staffActor = { id: 'acc-staff', role: ROLES.STAFF, permissions: [PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CANCEL, PERMISSIONS.ORDER_CANCEL_MANAGEMENT, PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.PRODUCT_VIEW] };
  const employeeActor = { id: 'acc-emp', role: ROLES.EMPLOYEE, permissions: [PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_CANCEL, PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.PRODUCT_VIEW] };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ORDER CREATION INVARIANTS & VALIDATION
  // =========================================================================
  describe('1. Order Creation Invariants', () => {
    it('Rejects order creation without seller identity', () => {
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          accountId: null,
          sellerId: null,
          code: 'HD-TEST-01',
          totalAmount: 100000, items: [{ productId: 'p-100K', quantity: 1, price: 100000 }]
        }, { role: 'admin', permissions: ['order.create'] });
      }).toThrow(/ORDER_VALIDATION_ERROR.*ngÆ°á»i bÃ¡n/i);
    });

    it('Rejects order creation with negative total amount', () => {
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          accountId: 'acc-emp',
          code: 'HD-TEST-02',
          totalAmount: -50000,
          items: [{ productId: 'p1', quantity: 1, price: 250000 }]
        }, employeeActor);
      }).toThrow(/ORDER_VALIDATION_ERROR.*Ã¢m/i);
    });

    it('Rejects order creation with invalid item quantities (<= 0)', () => {
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          accountId: 'acc-emp',
          code: 'HD-TEST-03',
          totalAmount: 50000, items: [{ productId: 'p1', quantity: 0, price: 250000 }]
        }, employeeActor);
      }).toThrow(/ORDER_VALIDATION_ERROR.*sá»‘ lÆ°á»£ng/i);
    });

    it('Rejects completed order creation when requireSellingContext is enabled and workSessionId is missing', () => {
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          accountId: 'acc-emp',
          code: 'HD-TEST-04',
          totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
          status: 'completed',
          items: [{ productId: 'p1', quantity: 1, price: 250000 }]
        }, employeeActor, { requireSellingContext: true });
      }).toThrow(/ORDER_VALIDATION_ERROR.*ca lÃ m viá»‡c/i);
    });

    it('Creates valid order with full authoritative selling context', async () => {
      const today = getBusinessDate();
      const res = await orderApi.create({
        id: 'ord-auth-01',
        code: 'HD-AUTH-01',
        accountId: employeeActor.id,
        workSessionId: 'ws-today-01',
        registerId: 'POS01',
        businessDate: today,
        paymentMethod: 'cash',
        totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }],
        subtotal: 200000,
        status: 'completed',
        items: [{ productId: 'p-100K', quantity: 2, price: 100000 }]
      }, employeeActor);

      expect(res.data).toBeDefined();
      expect(res.data.id).toBe('ord-auth-01');
      expect(res.data.accountId).toBe(employeeActor.id);
      expect(res.data.sellerId).toBe(employeeActor.id);
      expect(res.data.workSessionId).toBe('ws-today-01');
      expect(res.data.registerId).toBe('POS01');
      expect(res.data.businessDate).toBe(today);
      expect(res.data.paymentMethod).toBe('cash');
      expect(res.data.status).toBe('completed');
      expect(res.data.createdAt).toBeDefined();
    });
  });

  // =========================================================================
  // 2. STOCK VALIDATION & UPFRONT GUARDS
  // =========================================================================
  describe('2. Upfront Stock & Status Validation', () => {
    it('Aborts checkout upfront when product is deactivated (isActive: false) without mutating stock', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: employeeActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0];
      const initialStock = testProd.stockQuantity;

      // Soft delete product
      await productApi.softDelete(testProd.id, adminActor);

      await act(async () => {
        actionRef.current.addToCart(testProd, 1);
      });

      await expect(actionRef.current.checkout()).rejects.toThrow(/ngá»«ng kinh doanh/i);

      // Verify stock untouched
      const prodAfter = (await productApi.getById(testProd.id)).data;
      expect(prodAfter.stockQuantity).toBe(initialStock);

      // Verify no orphan SALE transactions created
      const txRes = await inventoryApi.getAllTransactions({ productId: testProd.id, reason: 'SALE' });
      expect(txRes.data.length).toBe(0);
    });

    it('Aborts checkout upfront when requested quantity exceeds available stock', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: employeeActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0];
      // Add 5 units to cart
      await act(async () => {
        actionRef.current.addToCart(testProd, 5);
      });

      // Another user bought out stock before checkout: stock becomes 2 (< 5)
      await productApi.updateStock(testProd.id, 2, adminActor, { source: 'pos_checkout' });

      await expect(actionRef.current.checkout()).rejects.toThrow(/khÃ´ng Ä‘á»§ tá»“n kho/i);

      const prodAfter = (await productApi.getById(testProd.id)).data;
      expect(prodAfter.stockQuantity).toBe(2);
    });

    it('Rejects negative stock update in productApi with INVALID_STOCK', async () => {
      const prodRes = await productApi.getAll();
      const p = prodRes.data[0];

      await expect(
        productApi.updateStock(p.id, -5, adminActor)
      ).rejects.toThrow(/INVALID_STOCK/);
    });
  });

  // =========================================================================
  // 3. CHECKOUT ROLLBACK & NON-DESTRUCTIVE DELTA COMPENSATION
  // =========================================================================
  describe('3. Checkout Rollback & Delta-Based Compensation', () => {
    it('Executes multi-product partial failure rollback without corrupting stock', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef
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

      // Mock updateStock to fail on prod2
      const originalUpdateStock = productApi.updateStock;
      vi.spyOn(productApi, 'updateStock').mockImplementation(async (id, newStock, actor, ctx) => {
        if (id === prod2.id) {
          throw new Error('MÃ´ phá»ng lá»—i máº¡ng khi trá»« prod2!');
        }
        return originalUpdateStock(id, newStock, actor, ctx);
      });

      await expect(actionRef.current.checkout()).rejects.toThrow(/MÃ´ phá»ng lá»—i máº¡ng/);

      // Verify prod1 stock fully restored to original
      const p1After = (await productApi.getById(prod1.id)).data;
      expect(p1After.stockQuantity).toBe(initialStock1);

      // Verify prod2 stock untouched
      const p2After = (await productApi.getById(prod2.id)).data;
      expect(p2After.stockQuantity).toBe(initialStock2);

      // Verify no orphan SALE transactions remain
      const txRes = await inventoryApi.getAllTransactions({ reason: 'SALE' });
      expect(txRes.data.length).toBe(0);

      // Verify cart is NOT cleared on failure
      expect(actionRef.current.cartItems.length).toBe(2);
    });

    it('Non-destructive delta rollback: preserves concurrent stock addition that occurred between deduction and rollback', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(1));
      const prod1 = actionRef.current.products[0];
      const prod2 = actionRef.current.products[1];
      const initialStock1 = prod1.stockQuantity; // e.g. 76

      await act(async () => {
        actionRef.current.addToCart(prod1, 5); // deducts 5 -> 71
        actionRef.current.addToCart(prod2, 1);
      });

      const originalUpdateStock = productApi.updateStock;
      vi.spyOn(productApi, 'updateStock').mockImplementation(async (id, newStock, actor, ctx) => {
        if (id === prod1.id && ctx.source === 'pos_checkout') {
          // Perform original deduction
          const res = await originalUpdateStock(id, newStock, actor, ctx);
          // SIMULATE CONCURRENT VALID OPERATION: another user imports 20 units of prod1
          await originalUpdateStock(prod1.id, newStock + 20, adminActor, { source: 'inventory_import' });
          return res;
        }
        if (id === prod2.id) {
          throw new Error('Lá»—i trá»« prod2 mÃ´ phá»ng!');
        }
        return originalUpdateStock(id, newStock, actor, ctx);
      });

      await expect(actionRef.current.checkout()).rejects.toThrow();

      // WITH DELTA COMPENSATION:
      // prod1 had 76.
      // Checkout deducted 5 -> 71.
      // Concurrent import added 20 -> 91.
      // Rollback adds back the delta of 5: 91 + 5 = 96!
      // (If snapshot rollback was used, it would have blindly overwritten with 76, losing the 20 imported units!)
      const p1Final = (await productApi.getById(prod1.id)).data;
      expect(p1Final.stockQuantity).toBe(initialStock1 + 20); // 76 + 20 = 96
    });
  });

  // =========================================================================
  // 4. INVENTORY TRANSACTION & ORDER LINKAGE
  // =========================================================================
  describe('4. Inventory Transaction & Order Linkage', () => {
    it('Creates traceable OUT SALE inventory transaction bidirectional-linked to completed Order', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: employeeActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-link', status: 'active' }, currentMember: { id: 'wsm-link', registerId: 'POS01' }, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0];
      const initialStock = testProd.stockQuantity;

      await act(async () => {
        actionRef.current.addToCart(testProd, 2);
      });

      let order = null;
      await act(async () => {
        order = await actionRef.current.checkout();
      });

      expect(order).toBeDefined();
      expect(order.status).toBe('completed');
      expect(order.inventoryTransactionIds.length).toBe(1);

      // Verify the SALE transaction
      const txRes = await inventoryApi.getAllTransactions({ productId: testProd.id, reason: 'SALE' });
      const saleTx = txRes.data.find(t => t.orderId === order.id);
      expect(saleTx).toBeDefined();
      expect(saleTx.orderCode).toBe(order.code);
      expect(saleTx.type).toBe('OUT');
      expect(saleTx.reason).toBe('SALE');
      expect(saleTx.quantity).toBe(2);
      expect(saleTx.unitPrice).toBe(testProd.sellPrice);
      expect(saleTx.unitCost).toBe(testProd.costPrice);
      expect(saleTx.accountId).toBe(employeeActor.id);
      expect(saleTx.workSessionId).toBe('ws-active-link');
      expect(saleTx.registerId).toBe('POS01');

      // Verify order points to transaction
      expect(order.inventoryTransactionIds).toContain(saleTx.id);

      // Stock deducted
      const prodAfter = (await productApi.getById(testProd.id)).data;
      expect(prodAfter.stockQuantity).toBe(initialStock - 2);
    });
  });

  // =========================================================================
  // 5. CANCELLATION LIFECYCLE, PERMISSIONS & IDEMPOTENCE
  // =========================================================================
  describe('5. Order Cancellation Lifecycle & Idempotence', () => {
    it('Employee cannot cancel another sellerâ€™s order', () => {
      const otherOrder = {
        id: 'ord-other-seller',
        accountId: 'acc-other',
        workSessionId: 'ws-active-1',
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      expect(() => {
        orderApi.cancel('ord-other-seller', {
          actor: employeeActor,
          reason: 'LÃ½ do há»§y',
          order: otherOrder,
          currentSessionId: 'ws-active-1'
        });
      }).toThrow(/CANCEL_DENIED.*chÃ­nh mÃ¬nh táº¡o/i);
    });

    it('Employee cannot cancel order outside current session', () => {
      const orderDiffSession = {
        id: 'ord-diff-session',
        accountId: employeeActor.id,
        workSessionId: 'ws-other-session',
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      expect(() => {
        orderApi.cancel('ord-diff-session', {
          actor: employeeActor,
          reason: 'LÃ½ do há»§y',
          order: orderDiffSession,
          currentSessionId: 'ws-active-1'
        });
      }).toThrow(/CANCEL_DENIED.*thuá»™c ca lÃ m viá»‡c hiá»‡n táº¡i/i);
    });

    it('Employee cannot cancel order after 15-minute window', () => {
      const oldOrder = {
        id: 'ord-old-emp',
        accountId: employeeActor.id,
        workSessionId: 'ws-active-1',
        status: 'completed',
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 mins ago
      };

      expect(() => {
        orderApi.cancel('ord-old-emp', {
          actor: employeeActor,
          reason: 'LÃ½ do há»§y',
          order: oldOrder,
          currentSessionId: 'ws-active-1'
        });
      }).toThrow(/CANCEL_DENIED.*quÃ¡ 15 phÃºt/i);
    });

    it('Staff cannot cancel orders from past business dates', () => {
      const pastDateOrder = {
        id: 'ord-past-date',
        accountId: employeeActor.id,
        businessDate: '2026-08-01',
        status: 'completed',
        createdAt: '2026-08-01T10:00:00.000Z'
      };

      expect(() => {
        orderApi.cancel('ord-past-date', {
          actor: staffActor,
          reason: 'Quáº£n lÃ½ muá»‘n há»§y ngÃ y cÅ©',
          order: pastDateOrder
        });
      }).toThrow(/CANCEL_DENIED.*trong ngÃ y lÃ m viá»‡c hiá»‡n táº¡i/i);
    });

    it('Rejects cancellation without reason', () => {
      const validOrder = {
        id: 'ord-no-reason',
        accountId: employeeActor.id,
        workSessionId: 'ws-active-1',
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      expect(() => {
        orderApi.cancel('ord-no-reason', {
          actor: employeeActor,
          reason: '   ',
          order: validOrder,
          currentSessionId: 'ws-active-1'
        });
      }).toThrow(/CANCEL_DENIED.*lÃ½ do há»§y/i);
    });

    it('Idempotence: Rejects repeated cancellation of already cancelled order', async () => {
      const nowIso = new Date().toISOString();
      await orderApi.create({
        id: 'ord-to-cancel-idemp',
        code: 'HD-IDEMP-01',
        accountId: employeeActor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 150000, items: [{ productId: 'p4', quantity: 150000, price: 1 }],
        status: 'completed',
        createdAt: nowIso,
        items: [{ productId: 'p2', quantity: 1, price: 150000 }]
      }, employeeActor);

      // First cancellation
      await orderApi.cancel('ord-to-cancel-idemp', {
        actor: employeeActor,
        reason: 'KhÃ¡ch yÃªu cáº§u hoÃ n tiá»n',
        currentSessionId: 'ws-active-1'
      });

      // Second cancellation attempt
      await expect(
        orderApi.cancel('ord-to-cancel-idemp', {
          actor: employeeActor,
          reason: 'Cá»‘ há»§y láº§n 2',
          currentSessionId: 'ws-active-1'
        })
      ).rejects.toThrow(/ORDER_ALREADY_CANCELLED/);
    });
  });

  // =========================================================================
  // 6. RESTOCK & CANCEL AND RESTOCK
  // =========================================================================
  describe('6. Restock & Traceable Inventory Restoration', () => {
    it('cancelAndRestock restores exact quantity sold and prevents double restock', async () => {
      const prodRes = await productApi.getAll();
      const testProd = prodRes.data[0];
      const initialStock = testProd.stockQuantity;

      // 1. Create order for 3 items
      const nowIso = new Date().toISOString();
      const order = {
        id: 'ord-restock-test',
        code: 'HD-RESTOCK-01',
        accountId: adminActor.id,
        workSessionId: 'ws-active-1',
        registerId: 'POS01',
        totalAmount: testProd.sellPrice * 3,
        status: 'completed',
        createdAt: nowIso,
        items: [{ productId: testProd.id, productName: testProd.name, quantity: 3, price: testProd.sellPrice }]
      };
      await orderApi.create(order, adminActor);
      await productApi.updateStock(testProd.id, initialStock - 3, adminActor, { source: 'pos_checkout' });

      // Verify stock deducted
      expect((await productApi.getById(testProd.id)).data.stockQuantity).toBe(initialStock - 3);

      // 2. Cancel and restock
      const cancelRes = await orderApi.cancelAndRestock(order.id, {
        actor: adminActor,
        reason: 'KhÃ¡ch hÃ ng tráº£ toÃ n bá»™ hÃ ng lá»—i',
        currentSessionId: 'ws-active-1'
      });

      expect(cancelRes.data.status).toBe('cancelled');

      // Verify stock restored to exact pre-sale amount
      const prodAfterRestock = (await productApi.getById(testProd.id)).data;
      expect(prodAfterRestock.stockQuantity).toBe(initialStock);

      // Verify IN CANCEL_RESTOCK transaction was created
      const restockTxs = (await inventoryApi.getAllTransactions({ productId: testProd.id, reason: 'CANCEL_RESTOCK' })).data;
      const tx = restockTxs.find(t => t.orderId === order.id);
      expect(tx).toBeDefined();
      expect(tx.type).toBe('IN');
      expect(tx.quantity).toBe(3);
      expect(tx.unitPrice).toBe(testProd.costPrice);

      // 3. Prevent double restock
      await expect(
        orderApi.cancelAndRestock(order.id, {
          actor: adminActor,
          reason: 'Cá»‘ hoÃ n kho láº§n 2'
        })
      ).rejects.toThrow(/ORDER_ALREADY_CANCELLED/);
    });
  });

  // =========================================================================
  // 7. HISTORICAL CANCELLATION
  // =========================================================================
  describe('7. Historical Order Cancellation', () => {
    it('Marks status as historical_cancelled when cancelling an order from a past business date', async () => {
      const pastDate = '2026-08-10';
      const pastOrder = {
        id: 'ord-hist-past',
        code: 'HD-PAST-99',
        accountId: adminActor.id,
        businessDate: pastDate,
        totalAmount: 250000,
        status: 'completed',
        createdAt: '2026-08-10T14:00:00.000Z',
        items: [{ productId: 'p1', quantity: 1, price: 250000 }]
      };
      await orderApi.create(pastOrder, adminActor);

      const cancelRes = await orderApi.cancel(pastOrder.id, {
        actor: adminActor,
        reason: 'Há»§y Ä‘Æ¡n lá»‹ch sá»­ theo phÃ¡n quyáº¿t cá»§a GiÃ¡m Ä‘á»‘c',
        order: pastOrder
      });

      expect(cancelRes.data.status).toBe('historical_cancelled');
      expect(cancelRes.data.cancelledBusinessDate).toBe(getBusinessDate());
      expect(cancelRes.data.refundAmount).toBe(500000);
      expect(cancelRes.data.refundMethod).toBe('cash');
    });
  });

  // =========================================================================
  // 8. CASH PAYMENT & CHANGE
  // =========================================================================
  describe('8. Cash Checkout & Insufficient Cash Protection', () => {
    it('Rejects cash checkout when cashReceived < finalAmount', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0]; // 436,000đ

      await act(async () => {
        actionRef.current.addToCart(testProd, 1);
      });

      // Customer gives only 300,000 for a 436,000 order
      await expect(
        actionRef.current.checkout('cash', 300000)
      ).rejects.toThrow(/khÃ´ng Ä‘á»§ Ä‘á»ƒ thanh toÃ¡n/i);
    });

    it('Calculates change correctly when customer pays sufficient cash', async () => {
      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: { id: 'wsm-1' }, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0]; // 436,000đ

      await act(async () => {
        actionRef.current.addToCart(testProd, 1);
      });

      let order;
      await act(async () => {
        order = await actionRef.current.checkout('cash', 500000);
      });

      expect(order).toBeDefined();
      expect(order.paymentMethod).toBe('cash');
      expect(order.cashReceived).toBe(500000);
      expect(order.change).toBe(500000 - 436000); // 64,000
    });
  });

  // =========================================================================
  // 9. AUTHORITATIVE REGISTER SOURCE & STATUS VALIDATION
  // =========================================================================
  describe('9. Authoritative Register Resolution from API/db.json', () => {
    it('Rejects checkout with REGISTER_NOT_FOUND when local register ID does not exist in registerApi/db.json', async () => {
      localStorage.setItem('minishop_current_register_id', 'NON_EXISTENT_POS');

      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: null, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0];

      await act(async () => {
        actionRef.current.addToCart(testProd, 1);
      });

      await expect(actionRef.current.checkout('cash', testProd.sellPrice)).rejects.toThrow(/REGISTER_NOT_FOUND/);

      localStorage.removeItem('minishop_current_register_id');
    });

    it('Rejects checkout with REGISTER_INACTIVE when registered POS is marked inactive in registerApi/db.json', async () => {
      const originalGetAll = registerApi.getAll;
      registerApi.getAll = vi.fn().mockResolvedValue([
        { id: 'POS01', name: 'Quáº§y Thu NgÃ¢n 01', isActive: false },
        { id: 'POS02', name: 'Quáº§y Thu NgÃ¢n 02', isActive: true },
      ]);

      const actionRef = { current: null };
      renderHarness({
        authValue: { currentUser: staffActor, isAuthenticated: true },
        sessionValue: { currentSession: { id: 'ws-active-1', status: 'active' }, currentMember: null, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const testProd = actionRef.current.products[0];

      await act(async () => {
        actionRef.current.addToCart(testProd, 1);
      });

      await expect(actionRef.current.checkout('cash', testProd.sellPrice)).rejects.toThrow(/REGISTER_INACTIVE/);

      registerApi.getAll = originalGetAll;
    });
  });

  // =========================================================================
  // 10. INVENTORY PERMISSION & CONTEXT BOUNDARY
  // =========================================================================
  describe('10. Inventory Permission & Order Context Boundary', () => {
    it('Rejects direct createTransaction for SALE when order context (orderId/orderCode) is absent', () => {
      expect(() => {
        inventoryApi.createTransaction({
          productId: 'p0000000-0000-0000-0000-000000000001',
          type: 'OUT',
          reason: 'SALE',
          quantity: 1,
          unitPrice: 50000,
        }, staffActor);
      }).toThrow(/INVALID_TRANSACTION_CONTEXT/);
    });

    it('Rejects direct createTransaction for CANCEL_RESTOCK when order context is absent', () => {
      expect(() => {
        inventoryApi.createTransaction({
          productId: 'p0000000-0000-0000-0000-000000000001',
          type: 'IN',
          reason: 'CANCEL_RESTOCK',
          quantity: 1,
          unitPrice: 50000,
        }, staffActor);
      }).toThrow(/INVALID_TRANSACTION_CONTEXT/);
    });

    it('Rejects direct createTransaction for SALE without ORDER_CREATE permission even if order context is present', () => {
      const unauthorizedActor = { id: 'acc-unauth', role: 'guest', permissions: [] };
      expect(() => {
        inventoryApi.createTransaction({
          productId: 'p0000000-0000-0000-0000-000000000001',
          type: 'OUT',
          reason: 'SALE',
          orderId: 'ord-dummy-01',
          orderCode: 'HD-DUMMY-01',
          quantity: 1,
          unitPrice: 50000,
        }, unauthorizedActor);
      }).toThrow(/PERMISSION_DENIED/);
    });

    it('Rejects direct createTransaction for CANCEL_RESTOCK without ORDER_CANCEL permission', () => {
      const unprivilegedStaff = { id: 'acc-staff-no-cancel', role: ROLES.STAFF, deniedPermissions: [PERMISSIONS.ORDER_CANCEL] };
      expect(() => {
        inventoryApi.createTransaction({
          productId: 'p0000000-0000-0000-0000-000000000001',
          type: 'IN',
          reason: 'CANCEL_RESTOCK',
          orderId: 'ord-dummy-01',
          orderCode: 'HD-DUMMY-01',
          quantity: 1,
          unitPrice: 50000,
        }, unprivilegedStaff);
      }).toThrow(/PERMISSION_DENIED/);
    });
  });
});
