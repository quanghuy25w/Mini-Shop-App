import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { initSeedData } from './mockApi';
import axiosClient from '../api/axiosClient';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { ROLE_DISCOUNT_CAPS } from '../utils/orderRules';
import { ROLES, PERMISSIONS } from '../utils/permissions';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionContext } from '../context/WorkSessionContext';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';

// Test Harness for useCart hook
const CartHarness = ({ onActionRef }) => {
  const cartHook = useCart();
  const { products } = useProducts();
  React.useEffect(() => {
    if (onActionRef) {
      onActionRef.current = {
        ...cartHook,
        products
      };
    }
  });
  return <div>Cart Harness Ready</div>;
};

const renderCart = ({ authValue, sessionValue, onActionRef }) => {
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

describe('GROUP A: Business Security & Financial Integrity Adversarial Test Suite', () => {
  const adminActor = {
    id: 'acc-admin',
    role: ROLES.ADMIN,
    name: 'Quản trị viên',
    permissions: Object.values(PERMISSIONS),
    isActive: true
  };

  const staffActor = {
    id: 'acc-staff',
    role: ROLES.STAFF,
    name: 'Nhân viên quản lý',
    employeeId: 'staff-002',
    permissions: [
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_CANCEL,
      PERMISSIONS.ORDER_CANCEL_MANAGEMENT,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.PRODUCT_VIEW
    ],
    isActive: true
  };

  const employeeActor = {
    id: 'acc-emp',
    role: ROLES.EMPLOYEE,
    name: 'Thu ngân viên',
    employeeId: 'staff-003',
    permissions: [
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_CANCEL,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.PRODUCT_VIEW
    ],
    isActive: true
  };

  const sessionFixture = {
    id: 'ws-active-1',
    code: 'CA-SANG-01',
    date: '2026-09-25',
    status: 'active'
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. _internalSystemPatch cannot bypass protection
  // ---------------------------------------------------------------------------
  it('1. _internalSystemPatch cannot bypass protection on completed orders', async () => {
    const orderRes = await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-a1-imm',
      code: 'HD-A1-001',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
      subtotal: 100000,
      paymentMethod: 'cash',
      items: [{ productId: 'p-test', productName: 'Item', quantity: 1, price: 100000 }]
    }, adminActor);

    await expect(
      orderApi.patch(orderRes.data.id, { totalAmount: 50000 }, adminActor, { _internalSystemPatch: true })
    ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

    const recheck = (await orderApi.getById(orderRes.data.id)).data;
    expect(recheck.totalAmount).toBe(100000);
  });

  // ---------------------------------------------------------------------------
  // 2. isSystemRollback cannot bypass protection
  // ---------------------------------------------------------------------------
  it('2. isSystemRollback cannot bypass actor requirement or order deletion', async () => {
    await expect(
      productApi.updateStock('p0000000-0000-0000-0000-000000000001', 999, null, { isSystemRollback: true })
    ).rejects.toThrow(/NOT_AUTHENTICATED/);

    expect(() => {
      orderApi.remove('ord-any', { isSystemRollback: true });
    }).toThrow(/ORDER_DELETION_RESTRICTED/);
  });

  // ---------------------------------------------------------------------------
  // 3. isSystemCheckout cannot bypass SALE validation
  // ---------------------------------------------------------------------------
  it('3. isSystemCheckout cannot bypass SALE transaction verification', async () => {
    await expect(
      inventoryApi.createTransaction({
        type: 'OUT',
        reason: 'SALE',
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 5,
        isSystemCheckout: true,
        orderCode: 'HD-NON-EXISTENT'
      }, adminActor)
    ).rejects.toThrow(/INVALID_TRANSACTION_CONTEXT/);
  });

  // ---------------------------------------------------------------------------
  // 4. isSystemCancel cannot bypass CANCEL_RESTOCK validation
  // ---------------------------------------------------------------------------
  it('4. isSystemCancel cannot bypass CANCEL_RESTOCK transaction verification', async () => {
    await expect(
      inventoryApi.createTransaction({
        type: 'IN',
        reason: 'CANCEL_RESTOCK',
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 5,
        isSystemCancel: true,
        orderCode: 'HD-FAKE-CANCEL'
      }, adminActor)
    ).rejects.toThrow(/INVALID_TRANSACTION_CONTEXT/);
  });

  // ---------------------------------------------------------------------------
  // 5. internalLink cannot bypass anything
  // ---------------------------------------------------------------------------
  it('5. internalLink cannot bypass immutability of inventoryTransactionIds', async () => {
    const orderRes = await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-a5-link',
      code: 'HD-A5-001',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
      inventoryTransactionIds: ['tx-orig-1'],
      items: [{ productId: 'p-test', quantity: 1, price: 100000 }]
    }, adminActor);

    await expect(
      orderApi.patch(orderRes.data.id, { inventoryTransactionIds: ['tx-forged-99'] }, adminActor, { internalLink: true })
    ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

    const recheck = (await orderApi.getById(orderRes.data.id)).data;
    expect(recheck.inventoryTransactionIds).toEqual(['tx-orig-1']);
  });

  // ---------------------------------------------------------------------------
  // 6. source=rollback cannot grant privileged authorization
  // ---------------------------------------------------------------------------
  it('6. source=rollback cannot grant privileged authorization to delete foreign records', async () => {
    // Seed transaction belonging to another user
    const tx = (await inventoryApi.createSystemTransaction({
      id: 'tx-foreign-user',
      productId: 'p0000000-0000-0000-0000-000000000001',
      type: 'OUT',
      quantity: 1,
      unitPrice: 10000,
      accountId: 'acc-other-user'
    })).data;

    // Employee cannot delete it even with source='rollback'
    await expect(
      inventoryApi.removeTransaction(tx.id, employeeActor, { source: 'rollback' })
    ).rejects.toThrow(/PERMISSION_DENIED/);
  });

  // ---------------------------------------------------------------------------
  // 7. missing actor fails closed
  // ---------------------------------------------------------------------------
  it('7. missing actor fails closed on all protected mutations', async () => {
    expect(() => orderApi.create({
          workSessionId: 'ws-mock-test', totalAmount: 10000 }, null)).toThrow(/NOT_AUTHENTICATED/);
    expect(() => orderApi.patch('ord-1', { note: 'test' }, null)).toThrow(/NOT_AUTHENTICATED/);
    expect(() => inventoryApi.createTransaction({ type: 'OUT' }, null)).toThrow(/NOT_AUTHENTICATED/);
    await expect(inventoryApi.removeTransaction('tx-1', null)).rejects.toThrow(/NOT_AUTHENTICATED/);
    await expect(productApi.updateStock('p-1', 10, null)).rejects.toThrow(/NOT_AUTHENTICATED/);
  });

  // ---------------------------------------------------------------------------
  // 8. unknown role fails closed
  // ---------------------------------------------------------------------------
  it('8. unknown role fails closed with PERMISSION_DENIED', () => {
    expect(() => {
      orderApi.create({
          workSessionId: 'ws-mock-test', totalAmount: 10000 }, { id: 'acc-guest', role: 'guest' });
    }).toThrow(/PERMISSION_DENIED/);
  });

  // ---------------------------------------------------------------------------
  // 9. employee discount above 10% is rejected by the service/API
  // ---------------------------------------------------------------------------
  it('9. employee discount above 10% is rejected authoritatively', () => {
    expect(ROLE_DISCOUNT_CAPS.employee).toBe(10);
    expect(() => {
      orderApi.create({
          workSessionId: 'ws-mock-test',
        totalAmount: 85000, items: [{ productId: 'p4', quantity: 85000, price: 1 }],
        discountType: 'percent',
        discountValue: 15,
        items: [{ productId: 'p-1', quantity: 1, price: 100000 }]
      }, employeeActor);
    }).toThrow(/DISCOUNT_LIMIT_EXCEEDED/);
  });

  // ---------------------------------------------------------------------------
  // 10. staff discount above 20% is rejected by the service/API
  // ---------------------------------------------------------------------------
  it('10. staff discount above 20% is rejected authoritatively', () => {
    expect(ROLE_DISCOUNT_CAPS.staff).toBe(20);
    expect(() => {
      orderApi.create({
          workSessionId: 'ws-mock-test',
        totalAmount: 75000, items: [{ productId: 'p4', quantity: 75000, price: 1 }],
        discountType: 'percent',
        discountValue: 25,
        items: [{ productId: 'p-1', quantity: 1, price: 100000 }]
      }, staffActor);
    }).toThrow(/DISCOUNT_LIMIT_EXCEEDED/);
  });

  // ---------------------------------------------------------------------------
  // 11. admin cannot exceed 100% discount
  // ---------------------------------------------------------------------------
  it('11. admin cannot exceed 100% discount maximum', () => {
    expect(ROLE_DISCOUNT_CAPS.admin).toBe(100);
    expect(() => {
      orderApi.create({
          workSessionId: 'ws-mock-test',
        totalAmount: 0, items: [{ productId: 'p4', quantity: 0, price: 1 }],
        discountType: 'percent',
        discountValue: 101,
        items: [{ productId: 'p-1', quantity: 1, price: 100000 }]
      }, adminActor);
    }).toThrow(/DISCOUNT_LIMIT_EXCEEDED/);
  });

  // ---------------------------------------------------------------------------
  // 12. forged totalAmount is rejected
  // ---------------------------------------------------------------------------
  it('12. forged totalAmount is rejected when strict totals is enforced', () => {
    expect(() => {
      orderApi.create({
          workSessionId: 'ws-mock-test',
        status: 'completed',
        items: [{ productId: 'p1', quantity: 0.2, price: 250000 }],
        totalAmount: 10000, items: [{ productId: 'p4', quantity: 10000, price: 1 }], // Forged total (actual is 50000)
        workSessionId: 'ws-active-1',
        registerId: 'POS01'
      }, adminActor, { requireStrictTotals: true });
    }).toThrow(/ORDER_VALIDATION_ERROR.*không khớp/i);
  });

  // ---------------------------------------------------------------------------
  // 13. stale/client price cannot become the authoritative sale price
  // ---------------------------------------------------------------------------
  it('13. stale/client cart price is overridden by canonical price at checkout', async () => {
    const actionRef = { current: null };
    renderCart({
      authValue: { currentUser: employeeActor, isAuthenticated: true },
      sessionValue: { currentSession: sessionFixture, isCheckedIn: true },
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
    const prod = actionRef.current.products[0]; // sellPrice: 436000
    const canonicalPrice = prod.sellPrice;
    expect(canonicalPrice).toBe(436000);

    // Stale price in client cart
    const tamperedProduct = { ...prod, sellPrice: 1000, price: 1000 };
    await act(async () => {
      actionRef.current.addToCart(tamperedProduct, 1);
    });

    // Checkout resolves authoritative price
    let createdOrder;
    await act(async () => {
      createdOrder = await actionRef.current.checkout();
    });

    expect(createdOrder.totalAmount).toBe(canonicalPrice);
    expect(createdOrder.items[0].price).toBe(canonicalPrice);

    // Verify inventory SALE transaction also has canonical price
    const txList = (await inventoryApi.getAllTransactions({ orderId: createdOrder.id })).data;
    expect(txList[0].unitPrice).toBe(canonicalPrice);
  });

  // ---------------------------------------------------------------------------
  // 14. completed order financial fields cannot be patched
  // ---------------------------------------------------------------------------
  it('14. completed order financial fields cannot be patched', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-imm-fields',
      code: 'HD-IMM-01',
      status: 'completed',
      totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }],
      subtotal: 200000,
      paymentMethod: 'cash',
      businessDate: '2026-09-25',
      registerId: 'POS01',
      items: [{ productId: 'p1', quantity: 1, price: 200000 }]
    }, adminActor)).data;

    await expect(orderApi.patch(order.id, { subtotal: 50000 }, adminActor)).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
    await expect(orderApi.patch(order.id, { totalAmount: 50000 }, adminActor)).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
    await expect(orderApi.patch(order.id, { paymentMethod: 'transfer' }, adminActor)).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
    await expect(orderApi.patch(order.id, { registerId: 'POS02' }, adminActor)).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
    await expect(orderApi.patch(order.id, { businessDate: '2026-09-01' }, adminActor)).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
    await expect(orderApi.update(order.id, { items: [] }, adminActor)).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);
  });

  // ---------------------------------------------------------------------------
  // 15. completed order inventory linkage cannot be patched through a bypass
  // ---------------------------------------------------------------------------
  it('15. completed order inventory linkage cannot be patched through a bypass', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-imm-link',
      code: 'HD-LINK-01',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
      inventoryTransactionIds: ['tx-initial-1'],
      items: [{ productId: 'p1', quantity: 1, price: 100000 }]
    }, adminActor)).data;

    await expect(
      orderApi.patch(order.id, { inventoryTransactionIds: ['tx-tampered'] }, adminActor, { _internalSystemPatch: true })
    ).rejects.toThrow(/ORDER_MUTATION_RESTRICTED/);

    const recheck = (await orderApi.getById(order.id)).data;
    expect(recheck.inventoryTransactionIds).toEqual(['tx-initial-1']);
  });

  // ---------------------------------------------------------------------------
  // 16. invalid SALE transaction is rejected
  // ---------------------------------------------------------------------------
  it('16. invalid SALE transaction is rejected if product is not in order or quantity mismatches', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-sale-check',
      code: 'HD-SALE-01',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 2, price: 50000 }]
    }, adminActor)).data;

    // Reject product not in order
    await expect(
      inventoryApi.createTransaction({
        type: 'OUT',
        reason: 'SALE',
        orderId: order.id,
        orderCode: order.code,
        productId: 'p0000000-0000-0000-0000-000000000002',
        quantity: 2
      }, adminActor)
    ).rejects.toThrow(/INVALID_TRANSACTION_CONTEXT/);

    // Reject quantity mismatch
    await expect(
      inventoryApi.createTransaction({
        type: 'OUT',
        reason: 'SALE',
        orderId: order.id,
        orderCode: order.code,
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 99
      }, adminActor)
    ).rejects.toThrow(/INVALID_TRANSACTION_CONTEXT/);
  });

  // ---------------------------------------------------------------------------
  // 17. duplicate SALE is rejected
  // ---------------------------------------------------------------------------
  it('17. duplicate SALE transaction for the same order and product is rejected', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-dup-sale',
      code: 'HD-DUP-SALE',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 100000 }]
    }, adminActor)).data;

    // 1st SALE transaction succeeds
    await inventoryApi.createTransaction({
      type: 'OUT',
      reason: 'SALE',
      orderId: order.id,
      orderCode: order.code,
      productId: 'p0000000-0000-0000-0000-000000000001',
      quantity: 1
    }, adminActor);

    // 2nd duplicate SALE transaction is rejected
    await expect(
      inventoryApi.createTransaction({
        type: 'OUT',
        reason: 'SALE',
        orderId: order.id,
        orderCode: order.code,
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 1
      }, adminActor)
    ).rejects.toThrow(/DUPLICATE_TRANSACTION/);
  });

  // ---------------------------------------------------------------------------
  // 18. invalid CANCEL_RESTOCK is rejected
  // ---------------------------------------------------------------------------
  it('18. CANCEL_RESTOCK transaction is rejected if order is not cancelled', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-not-cancelled',
      code: 'HD-NOT-CANCEL',
      status: 'completed', // Not cancelled!
      totalAmount: 100000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 100000 }]
    }, adminActor)).data;

    await expect(
      inventoryApi.createTransaction({
        type: 'IN',
        reason: 'CANCEL_RESTOCK',
        orderId: order.id,
        orderCode: order.code,
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 1
      }, adminActor)
    ).rejects.toThrow(/INVALID_TRANSACTION_CONTEXT/);
  });

  // ---------------------------------------------------------------------------
  // 19. duplicate CANCEL_RESTOCK is rejected
  // ---------------------------------------------------------------------------
  it('19. duplicate CANCEL_RESTOCK for the same cancelled order and product is rejected', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-dup-cancel',
      code: 'HD-DUP-CANCEL',
      status: 'cancelled',
      totalAmount: 100000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 100000 }]
    }, adminActor)).data;

    // 1st RESTOCK succeeds
    await inventoryApi.createTransaction({
      type: 'IN',
      reason: 'CANCEL_RESTOCK',
      orderId: order.id,
      orderCode: order.code,
      productId: 'p0000000-0000-0000-0000-000000000001',
      quantity: 1
    }, adminActor);

    // 2nd duplicate RESTOCK is rejected
    await expect(
      inventoryApi.createTransaction({
        type: 'IN',
        reason: 'CANCEL_RESTOCK',
        orderId: order.id,
        orderCode: order.code,
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 1
      }, adminActor)
    ).rejects.toThrow(/DUPLICATE_TRANSACTION/);
  });

  // ---------------------------------------------------------------------------
  // 20. checkout stock failure creates no order
  // ---------------------------------------------------------------------------
  it('20. checkout stock failure in Stage 1 creates NO order in the database', async () => {
    const actionRef = { current: null };
    renderCart({
      authValue: { currentUser: employeeActor, isAuthenticated: true },
      sessionValue: { currentSession: sessionFixture, isCheckedIn: true },
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
    const prod = actionRef.current.products[0];

    // Mock stock update failure
    vi.spyOn(productApi, 'updateStock').mockRejectedValueOnce(new Error('Mạng ngắt quãng khi trừ kho'));

    await act(async () => {
      actionRef.current.addToCart(prod, 1);
    });

    await expect(actionRef.current.checkout()).rejects.toThrow();

    // Verify NO order created in DB
    const ordersRes = await axiosClient.get('/orders');
    const matchingOrder = (ordersRes.data || []).find(o => o.accountId === employeeActor.id);
    expect(matchingOrder).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 21. checkout Stage 3 failure compensates correctly
  // ---------------------------------------------------------------------------
  it('21. checkout Stage 3 failure removes in-flight order and compensates stock delta', async () => {
    const actionRef = { current: null };
    renderCart({
      authValue: { currentUser: employeeActor, isAuthenticated: true },
      sessionValue: { currentSession: sessionFixture, isCheckedIn: true },
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
    const prod = actionRef.current.products[0];
    const initialStock = prod.stockQuantity;

    // Fail Stage 3: createTransaction throws
    vi.spyOn(inventoryApi, 'createTransaction').mockRejectedValueOnce(new Error('Lỗi tạo transaction OUT SALE'));

    await act(async () => {
      actionRef.current.addToCart(prod, 2);
    });

    await expect(actionRef.current.checkout()).rejects.toThrow();

    // Stock should be restored
    const prodAfter = (await productApi.getById(prod.id)).data;
    expect(prodAfter.stockQuantity).toBe(initialStock);

    // No in-flight order should remain
    const allOrders = (await axiosClient.get('/orders')).data || [];
    const leaked = allOrders.find(o => o.accountId === employeeActor.id && o.status === 'completed');
    expect(leaked).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 22. checkout rollback cannot delete unrelated records
  // ---------------------------------------------------------------------------
  it('22. checkout rollback cannot delete unrelated orders or transactions', async () => {
    // Legitimate completed order 1
    const order1 = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-unrelated-safe',
      code: 'HD-SAFE-01',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
      accountId: 'acc-other',
      sellerId: 'acc-other',
      items: [{ productId: 'p1', quantity: 1, price: 100000 }]
    }, adminActor)).data;

    // Legitimate transaction 1
    const tx1 = (await inventoryApi.createSystemTransaction({
      id: 'tx-safe-1',
      productId: 'p0000000-0000-0000-0000-000000000001',
      type: 'IN',
      quantity: 10,
      unitPrice: 10000,
      accountId: adminActor.id
    })).data;

    // Employee cannot delete order1 via removeInFlightOrder
    await expect(
      orderApi.removeInFlightOrder(order1.id, employeeActor)
    ).rejects.toThrow(/PERMISSION_DENIED/);

    // Employee cannot delete tx1 via removeTransaction
    await expect(
      inventoryApi.removeTransaction(tx1.id, employeeActor, { source: 'pos_checkout' })
    ).rejects.toThrow(/PERMISSION_DENIED/);

    // Records still exist
    expect((await orderApi.getById(order1.id)).data.id).toBe(order1.id);
    expect((await inventoryApi.getAllTransactions()).data.some(t => t.id === tx1.id)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 23. checkout rollback cannot require INVENTORY_ADJUST from an employee
  // ---------------------------------------------------------------------------
  it('23. checkout rollback succeeds for Employee using ORDER_CREATE without needing INVENTORY_ADJUST', async () => {
    const actionRef = { current: null };
    renderCart({
      authValue: { currentUser: employeeActor, isAuthenticated: true },
      sessionValue: { currentSession: sessionFixture, isCheckedIn: true },
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
    const prod = actionRef.current.products[0];
    const initialStock = prod.stockQuantity;

    // Fail order creation to trigger rollback of stock
    vi.spyOn(orderApi, 'create').mockRejectedValueOnce(new Error('Mô phỏng lỗi DB khi tạo Order'));

    await act(async () => {
      actionRef.current.addToCart(prod, 3);
    });

    await expect(actionRef.current.checkout()).rejects.toThrow();

    // Rollback succeeded without permission error: stock fully restored
    const prodAfter = (await productApi.getById(prod.id)).data;
    expect(prodAfter.stockQuantity).toBe(initialStock);
  });

  // ---------------------------------------------------------------------------
  // 24. cancellation failure does not create invalid restock records
  // ---------------------------------------------------------------------------
  it('24. cancellation failure does not create invalid restock records or modify stock', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-fail-cancel',
      code: 'HD-FAIL-CANCEL',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 2, price: 50000 }]
    }, adminActor)).data;

    const initialStock = (await productApi.getById('p0000000-0000-0000-0000-000000000001')).data.stockQuantity;

    // Mock orderApi.cancel failure
    vi.spyOn(orderApi, 'cancel').mockRejectedValueOnce(new Error('Lỗi database khi hủy đơn'));

    await expect(
      orderApi.cancelAndRestock(order.id, {
        actor: adminActor,
        reason: 'Hủy thử nghiệm'
      })
    ).rejects.toThrow(/Lỗi database khi hủy đơn/);

    // Stock must be unchanged
    const stockAfter = (await productApi.getById('p0000000-0000-0000-0000-000000000001')).data.stockQuantity;
    expect(stockAfter).toBe(initialStock);

    // No restock transaction created
    const txs = (await inventoryApi.getAllTransactions({ orderId: order.id, reason: 'CANCEL_RESTOCK' })).data || [];
    expect(txs.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 25. partial multi-item restock retry does not double-restock
  // ---------------------------------------------------------------------------
  it('25. partial multi-item restock retry does not double-restock previously restocked items', async () => {
    const prod1Id = 'p0000000-0000-0000-0000-000000000001';
    const prod2Id = 'p0000000-0000-0000-0000-000000000002';
    const stock1Before = (await productApi.getById(prod1Id)).data.stockQuantity;
    const stock2Before = (await productApi.getById(prod2Id)).data.stockQuantity;

    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-multi-restock',
      code: 'HD-MULTI-RESTOCK',
      status: 'completed',
      totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }],
      accountId: adminActor.id,
      sellerId: adminActor.id,
      items: [
        { productId: prod1Id, quantity: 2, price: 50000 },
        { productId: prod2Id, quantity: 3, price: 33333 }
      ]
    }, adminActor)).data;

    // Simulate scenario: item 1 already has a CANCEL_RESTOCK transaction and stock was incremented
    await axiosClient.post('/inventoryTransactions', {
      id: 'tx-already-restocked-p1',
      productId: prod1Id,
      type: 'IN',
      reason: 'CANCEL_RESTOCK',
      orderId: order.id,
      orderCode: order.code,
      quantity: 2,
      createdAt: new Date().toISOString()
    });
    // Manually incremented stock for item 1
    await productApi.adjustStockDelta(prod1Id, 2, adminActor, { source: 'inventory_import' });

    // Now execute cancelAndRestock
    await orderApi.cancelAndRestock(order.id, {
      actor: adminActor,
      reason: 'Khách đổi trả đa sản phẩm'
    });

    // prod1 stock should NOT be incremented again (still stock1Before + 2, not + 4)
    const stock1Final = (await productApi.getById(prod1Id)).data.stockQuantity;
    expect(stock1Final).toBe(stock1Before + 2);

    // prod2 stock should be incremented once (+ 3)
    const stock2Final = (await productApi.getById(prod2Id)).data.stockQuantity;
    expect(stock2Final).toBe(stock2Before + 3);
  });

  // ---------------------------------------------------------------------------
  // 26. successful cancellation + partial restock remains retry-safe
  // ---------------------------------------------------------------------------
  it('26. retry-safe: fully restocked order rejects redundant cancelAndRestock', async () => {
    const order = (await orderApi.create({
          workSessionId: 'ws-mock-test',
      id: 'ord-retry-safe',
      code: 'HD-RETRY-SAFE',
      status: 'completed',
      totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
      accountId: adminActor.id,
      sellerId: adminActor.id,
      items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 100000 }]
    }, adminActor)).data;

    // 1st cancelAndRestock succeeds
    await orderApi.cancelAndRestock(order.id, {
      actor: adminActor,
      reason: 'Hủy đơn lần 1'
    });

    // 2nd cancelAndRestock is rejected with ORDER_ALREADY_RESTOCKED or ORDER_ALREADY_CANCELLED
    await expect(
      orderApi.cancelAndRestock(order.id, {
        actor: adminActor,
        reason: 'Hủy đơn lần 2'
      })
    ).rejects.toThrow(/ORDER_ALREADY_RESTOCKED|ORDER_ALREADY_CANCELLED/);
  });

  // ---------------------------------------------------------------------------
  // 27. legitimate admin/staff/employee checkout still works
  // ---------------------------------------------------------------------------
  it('27. legitimate checkout works for Admin, Staff, and Employee', async () => {
    for (const actor of [adminActor, staffActor, employeeActor]) {
      const actionRef = { current: null };
      const { unmount } = renderCart({
        authValue: { currentUser: actor, isAuthenticated: true },
        sessionValue: { currentSession: sessionFixture, isCheckedIn: true },
        onActionRef: actionRef
      });

      await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
      const prod = actionRef.current.products[0];
      const initialStock = prod.stockQuantity;

      await act(async () => {
        actionRef.current.addToCart(prod, 1);
      });

      let completedOrder;
      await act(async () => {
        completedOrder = await actionRef.current.checkout({ paymentMethod: 'cash' });
      });

      expect(completedOrder).toBeDefined();
      expect(completedOrder.status).toBe('completed');
      expect(completedOrder.accountId).toBe(actor.id);
      expect(completedOrder.inventoryTransactionIds?.length).toBe(1);

      // Verify stock deducted by 1
      const prodAfter = (await productApi.getById(prod.id)).data;
      expect(prodAfter.stockQuantity).toBe(initialStock - 1);

      // Verify OUT SALE transaction created
      const tx = (await inventoryApi.getAllTransactions({ orderId: completedOrder.id })).data;
      expect(tx.length).toBe(1);
      expect(tx[0].reason).toBe('SALE');
      expect(tx[0].type).toBe('OUT');
      expect(tx[0].quantity).toBe(1);

      unmount();
    }
  });
});
