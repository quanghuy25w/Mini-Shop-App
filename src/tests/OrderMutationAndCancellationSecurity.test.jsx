import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { ROLES } from '../utils/permissions';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { activityLogApi } from '../api/activityLogApi';


describe('Authoritative Order Mutation & Cancellation Authorization Security Tests', () => {
  const adminActor = {
    id: 'acc-admin',
    role: ROLES.ADMIN,
    name: 'Quản trị viên Admin',
    email: 'admin@shop.vn',
    permissions: [],
    isActive: true,
  };

  const staffActor = {
    id: 'acc-staff',
    role: ROLES.STAFF,
    name: 'Quản lý Cửa Hàng',
    employeeCode: 'NV002',
    permissions: [],
    isActive: true,
  };

  const employee1Actor = {
    id: 'acc-emp-1',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên A',
    employeeCode: 'NV003',
    permissions: [],
    isActive: true,
  };

  const employee2Actor = {
    id: 'acc-emp-2',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên B',
    employeeCode: 'NV004',
    permissions: [],
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  // =========================================================================
  // EMPLOYEE ORDER CANCELLATION TESTS (Items 1 to 7)
  // =========================================================================
  describe('Employee Order Cancellation Rules', () => {
    it('1. Employee can cancel own order within the existing 15-minute window', async () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const order = {
        id: 'ord-emp1-fresh',
        code: 'HD-E1-01',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 100000,
        status: 'completed',
        createdAt: fiveMinsAgo,
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 100000 }],
      };
      await orderApi.create(order, employee1Actor);

      const cancelRes = await orderApi.cancel(order.id, {
        actor: employee1Actor,
        reason: 'Khách đổi ý trả hàng',
        order,
        currentSessionId: 'ws-active-1',
      });

      expect(cancelRes.data.status).toBe('cancelled');
      expect(cancelRes.data.cancelReason).toBe('Khách đổi ý trả hàng');
      expect(cancelRes.data.cancelledBy).toBe(employee1Actor.id);
    });

    it('2. Employee cannot cancel own order after the existing 15-minute window', async () => {
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const order = {
        id: 'ord-emp1-old',
        code: 'HD-E1-02',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 100000,
        status: 'completed',
        createdAt: twentyMinsAgo,
      };
      await orderApi.create(order, employee1Actor);

      expect(() => {
        orderApi.cancel(order.id, {
          actor: employee1Actor,
          reason: 'Hủy đơn muộn',
          order,
          currentSessionId: 'ws-active-1',
        });
      }).toThrowError(/CANCEL_DENIED/);
    });

    it('3. Employee cannot cancel another employee order even if the other order is within 15 minutes', async () => {
      const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const orderOfEmp2 = {
        id: 'ord-emp2-fresh',
        code: 'HD-E2-01',
        accountId: employee2Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 150000,
        status: 'completed',
        createdAt: twoMinsAgo,
      };
      await orderApi.create(orderOfEmp2, employee2Actor);

      // Employee 1 attempts to cancel Employee 2's order
      expect(() => {
        orderApi.cancel(orderOfEmp2.id, {
          actor: employee1Actor,
          reason: 'Hủy hộ đồng nghiệp',
          order: orderOfEmp2,
          currentSessionId: 'ws-active-1',
        });
      }).toThrowError(/CANCEL_DENIED/);
    });

    it('4. Employee cannot bypass ownership by sending another accountId', async () => {
      const orderOfEmp2 = {
        id: 'ord-emp2-bypass1',
        code: 'HD-E2-02',
        accountId: employee2Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 200000,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(orderOfEmp2, employee2Actor);

      expect(() => {
        orderApi.cancel(orderOfEmp2.id, {
          actor: employee1Actor,
          reason: 'Gian lận quyền',
          order: orderOfEmp2,
          currentSessionId: 'ws-active-1',
        });
      }).toThrowError(/CANCEL_DENIED/);
    });

    it('5. Employee cannot bypass ownership by sending another employeeId', async () => {
      const orderOfEmp2 = {
        id: 'ord-emp2-bypass2',
        code: 'HD-E2-03',
        accountId: employee2Actor.id,
        employeeId: 'staff-004',
        workSessionId: 'ws-active-1',
        totalAmount: 250000,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(orderOfEmp2, employee2Actor);

      expect(() => {
        orderApi.cancel(orderOfEmp2.id, {
          actor: employee1Actor,
          reason: 'Thử bypass employeeId',
          order: orderOfEmp2,
          currentSessionId: 'ws-active-1',
        });
      }).toThrowError(/CANCEL_DENIED/);
    });

    it('6. Employee cannot directly change completed Order status to cancelled through generic mutation', async () => {
      const order = {
        id: 'ord-emp1-direct',
        code: 'HD-E1-04',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 100000,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(order, employee1Actor);

      // Attempting updateStatus directly as employee
      expect(() => {
        orderApi.updateStatus(order.id, 'cancelled', employee1Actor);
      }).toThrowError(/PERMISSION_DENIED|ORDER_MUTATION_RESTRICTED/);

      // Attempting patch directly as employee
      expect(() => {
        orderApi.patch(order.id, { status: 'cancelled' }, employee1Actor);
      }).toThrowError(/PERMISSION_DENIED|ORDER_MUTATION_RESTRICTED/);
    });

    it('7. Employee cannot cancel without an authenticated actor', async () => {
      expect(() => {
        orderApi.cancel('ord-1', {
          actor: null,
          reason: 'Hủy ẩn danh',
        });
      }).toThrowError(/NOT_AUTHENTICATED/);
    });
  });

  // =========================================================================
  // STAFF & ADMIN ORDER CANCELLATION TESTS (Items 8 to 11)
  // =========================================================================
  describe('Staff and Admin Management Cancellation Rules', () => {
    it('8. Staff can perform the existing approved management cancellation workflow', async () => {
      const order = {
        id: 'ord-staff-cancel-target',
        code: 'HD-TARGET-01',
        accountId: employee2Actor.id, // Created by employee 2
        workSessionId: 'ws-closed-prev', // Old / closed session
        totalAmount: 500000,
        status: 'completed',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      };
      await orderApi.create(order, adminActor);

      // Staff uses management cancellation
      const res = await orderApi.cancel(order.id, {
        actor: staffActor,
        reason: 'Quản lý duyệt hủy đơn sau đối soát',
        order,
        currentSessionId: 'ws-active-1',
      });

      expect(res.data.status).toBe('cancelled');
      expect(res.data.cancelledBy).toBe(staffActor.id);
      expect(res.data.cancelReason).toBe('Quản lý duyệt hủy đơn sau đối soát');
    });

    it('9. Staff cancellation does not incorrectly use the Employee 15-minute ownership rule', async () => {
      const oldOrder = {
        id: 'ord-old-someone-else',
        code: 'HD-OLD-99',
        accountId: 'acc-other-seller',
        workSessionId: 'ws-old-session',
        totalAmount: 300000,
        status: 'completed',
        createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2 hours ago
      };
      await orderApi.create(oldOrder, adminActor);

      // Staff can cancel older order from different seller
      const res = await orderApi.cancel(oldOrder.id, {
        actor: staffActor,
        reason: 'Hủy đơn lỗi hệ thống ca trước',
        order: oldOrder,
        currentSessionId: 'ws-active-1',
      });

      expect(res.data.status).toBe('cancelled');
    });

    it('10. Staff cannot access Account management through Order mutation', async () => {
      expect(() => {
        orderApi.remove('ord-target', staffActor);
      }).toThrowError(/ORDER_DELETION_RESTRICTED/);
    });

    it('11. Admin retains the existing approved management cancellation/override behavior', async () => {
      const order = {
        id: 'ord-admin-target',
        code: 'HD-ADMIN-01',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 400000,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(order, adminActor);

      const res = await orderApi.cancel(order.id, {
        actor: adminActor,
        reason: 'Admin can thiệp hủy đơn đặc biệt',
        order,
        currentSessionId: 'ws-active-1',
      });

      expect(res.data.status).toBe('cancelled');
      expect(res.data.cancelledBy).toBe(adminActor.id);
    });
  });

  // =========================================================================
  // GENERIC MUTATION & DELETION PROTECTION (Items 12 to 15)
  // =========================================================================
  describe('Generic Mutation & Order Deletion Protection', () => {
    it('12. orderApi.updateStatus without actor is rejected for protected status mutation', async () => {
      expect(() => {
        orderApi.updateStatus('ord-1', 'cancelled');
      }).toThrowError(/NOT_AUTHENTICATED|PERMISSION_DENIED/);
    });

    it('13. orderApi.updateStatus with unauthorized actor is rejected', async () => {
      expect(() => {
        orderApi.updateStatus('ord-1', 'cancelled', employee1Actor);
      }).toThrowError(/PERMISSION_DENIED|ORDER_MUTATION_RESTRICTED/);
    });

    it('14. Generic update/patch cannot bypass cancellation business rules even when called by Admin', async () => {
      // Even Admin calling updateStatus('cancelled') directly is forced to use orderApi.cancel()
      expect(() => {
        orderApi.updateStatus('ord-1', 'cancelled', adminActor);
      }).toThrowError(/ORDER_MUTATION_RESTRICTED/);

      expect(() => {
        orderApi.patch('ord-1', { status: 'cancelled' }, adminActor);
      }).toThrowError(/ORDER_MUTATION_RESTRICTED/);

      expect(() => {
        orderApi.update('ord-1', { status: 'cancelled' }, adminActor);
      }).toThrowError(/ORDER_MUTATION_RESTRICTED/);
    });

    it('15. orderApi.remove cannot silently delete historical Orders', async () => {
      // Admin or Staff attempting permanent deletion of historical orders is blocked
      expect(() => {
        orderApi.remove('ord-hist-1', adminActor);
      }).toThrowError(/ORDER_DELETION_RESTRICTED/);

      expect(() => {
        orderApi.remove('ord-hist-1', staffActor);
      }).toThrowError(/ORDER_DELETION_RESTRICTED/);
    });
  });

  // =========================================================================
  // INVENTORY & AUDIT INTEGRITY (Items 16 to 21)
  // =========================================================================
  describe('Inventory Restitution & Audit Integrity', () => {
    it('16 & 17. Successful cancellation restores exact product quantities and creates compensating IN transaction', async () => {
      const prodRes = await productApi.getById('p0000000-0000-0000-0000-000000000001');
      const prod = prodRes.data;
      const initialStock = prod.stockQuantity;

      // Compensating stock restoration logic
      const restoredStock = initialStock + 3;
      await productApi.updateStock(prod.id, restoredStock, adminActor, {
        source: 'order_cancellation',
        orderCode: 'HD-RESTORE-01',
      });

      const inTx = {
        productId: prod.id,
        type: 'IN',
        quantity: 3,
        unitPrice: prod.sellPrice,
        accountId: adminActor.id,
        workSessionId: 'ws-active-1',
        note: 'Hoàn kho - hủy HD-RESTORE-01',
        createdAt: new Date().toISOString(),
      };
      await inventoryApi.createSystemTransaction(inTx);

      // Verify stock
      const prodAfter = (await productApi.getById(prod.id)).data;
      expect(prodAfter.stockQuantity).toBe(initialStock + 3);

      // Verify transaction IN
      const allTx = (await inventoryApi.getAllTransactions({ type: 'IN' })).data;
      const tx = allTx.find(t => t.note === 'Hoàn kho - hủy HD-RESTORE-01');
      expect(tx).toBeDefined();
      expect(tx.quantity).toBe(3);
    });

    it('18 & 19. Failed cancellation rollback restores stock atomicity without partial residual changes', async () => {
      const prodRes = await productApi.getById('p0000000-0000-0000-0000-000000000001');
      const initialStock = prodRes.data.stockQuantity;

      // Simulate partial adjustment
      await productApi.updateStock(prodRes.data.id, initialStock + 2, adminActor, {
        source: 'order_cancellation',
        orderCode: 'HD-FAIL-01',
      });

      // Rollback step executes
      await productApi.updateStock(prodRes.data.id, initialStock, adminActor, {
        source: 'rollback',
        isSystemRollback: true,
      });

      // Stock is back to exact initial value
      const prodAfterRollback = (await productApi.getById(prodRes.data.id)).data;
      expect(prodAfterRollback.stockQuantity).toBe(initialStock);
    });

    it('20. Successful cancellation creates the correct audit record in activityLogs', async () => {
      const order = {
        id: 'ord-audit-test',
        code: 'HD-AUDIT-99',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 200000,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(order, employee1Actor);

      await orderApi.cancel(order.id, {
        actor: employee1Actor,
        reason: 'Khách hàng yêu cầu hủy đơn',
        order,
        currentSessionId: 'ws-active-1',
      });

      const logs = (await activityLogApi.getAll()).data;
      const cancelLog = logs.find(l => l.action === 'ORDER_CANCELLED' && l.entityId === order.id);
      expect(cancelLog).toBeDefined();
      expect(cancelLog.actorId).toBe(employee1Actor.id);
      expect(cancelLog.metadata.reason).toBe('Khách hàng yêu cầu hủy đơn');
    });

    it('21. Failed/denied cancellation does not create a false successful cancellation audit', async () => {
      const order = {
        id: 'ord-denied-test',
        code: 'HD-DENIED-99',
        accountId: employee2Actor.id, // belongs to employee 2
        workSessionId: 'ws-active-1',
        totalAmount: 100000,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      await orderApi.create(order, employee2Actor);

      const logsBefore = (await activityLogApi.getAll()).data.length;

      // Employee 1 attempts illegal cancellation
      expect(() => {
        orderApi.cancel(order.id, {
          actor: employee1Actor,
          reason: 'Hủy bất hợp pháp',
          order,
          currentSessionId: 'ws-active-1',
        });
      }).toThrowError(/CANCEL_DENIED/);

      const logsAfter = (await activityLogApi.getAll()).data;
      const falseCancelLog = logsAfter.find(l => l.action === 'ORDER_CANCELLED' && l.entityId === order.id);
      expect(falseCancelLog).toBeUndefined();
      expect(logsAfter.length).toBe(logsBefore);
    });
  });

  // =========================================================================
  // ATOMIC CANCEL AND RESTOCK INTEGRATION TESTS
  // =========================================================================
  describe('Atomic cancelAndRestock Unified Method Tests', () => {
    it('22. cancelAndRestock restores product stock, creates CANCEL_RESTOCK transaction with costPrice and preserves product costPrice', async () => {
      const prodRes = await productApi.getById('p0000000-0000-0000-0000-000000000001');
      const prod = prodRes.data;
      const initialStock = prod.stockQuantity;
      const initialCost = prod.costPrice;

      const order = {
        id: 'ord-restock-atomic-1',
        code: 'HD-RESTOCK-01',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 200000,
        status: 'completed',
        createdAt: new Date().toISOString(),
        items: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 2,
          price: prod.price || 436000,
        }],
      };
      await orderApi.create(order, employee1Actor);

      const res = await orderApi.cancelAndRestock(order.id, {
        actor: employee1Actor,
        reason: 'Khách trả hàng ngay sau khi mua',
        currentSessionId: 'ws-active-1',
      });

      expect(res.data.status).toBe('cancelled');
      expect(res.data.cancelReason).toBe('Khách trả hàng ngay sau khi mua');
      expect(res.data.cancelledBy).toBe(employee1Actor.id);

      // Verify stock increased by 2
      const prodAfter = (await productApi.getById(prod.id)).data;
      expect(prodAfter.stockQuantity).toBe(initialStock + 2);
      // Cost price must remain unchanged
      expect(prodAfter.costPrice).toBe(initialCost);

      // Verify transaction IN with reason CANCEL_RESTOCK and unitPrice = costPrice
      const allTx = (await inventoryApi.getAllTransactions({ type: 'IN' })).data;
      const cancelTx = allTx.find(t => t.note && t.note.includes(order.code));
      expect(cancelTx).toBeDefined();
      expect(cancelTx.reason).toBe('CANCEL_RESTOCK');
      expect(cancelTx.quantity).toBe(2);
      expect(cancelTx.unitPrice).toBe(initialCost);
    });

    it('23. Staff cannot cancelAndRestock orders from a previous business date', async () => {
      const yesterday = '2026-09-01';
      const order = {
        id: 'ord-yesterday-staff',
        code: 'HD-YESTERDAY-01',
        accountId: employee1Actor.id,
        workSessionId: 'ws-old-session',
        totalAmount: 150000,
        status: 'completed',
        businessDate: yesterday,
        createdAt: `${yesterday}T10:00:00.000Z`,
        items: [{
          productId: 'p0000000-0000-0000-0000-000000000001',
          productName: 'Ensure',
          quantity: 1,
          price: 150000,
        }],
      };
      await orderApi.create(order, adminActor);

      await expect(
        orderApi.cancelAndRestock(order.id, {
          actor: staffActor,
          reason: 'Staff cố hủy đơn hôm qua',
          currentSessionId: 'ws-active-1',
        })
      ).rejects.toThrowError(/STAFF_SAME_DAY_ONLY|CANCEL_DENIED/);
    });

    it('24. Admin can cancelAndRestock historical orders with adjustments logged on current business date', async () => {
      const prodRes = await productApi.getById('p0000000-0000-0000-0000-000000000001');
      const prod = prodRes.data;
      const initialStock = prod.stockQuantity;

      const yesterday = '2026-09-01';
      const order = {
        id: 'ord-yesterday-admin',
        code: 'HD-YESTERDAY-ADMIN',
        accountId: employee1Actor.id,
        workSessionId: 'ws-old-closed',
        totalAmount: 200000,
        status: 'completed',
        businessDate: yesterday,
        createdAt: `${yesterday}T10:00:00.000Z`,
        items: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 3,
          price: 200000,
        }],
      };
      await orderApi.create(order, adminActor);

      const res = await orderApi.cancelAndRestock(order.id, {
        actor: adminActor,
        reason: 'Admin duyệt hủy điều chỉnh đơn ngày cũ',
        currentSessionId: 'ws-active-1',
      });

      expect(res.data.status).toBe('historical_cancelled');
      const prodAfter = (await productApi.getById(prod.id)).data;
      expect(prodAfter.stockQuantity).toBe(initialStock + 3);
    });
  });
});
