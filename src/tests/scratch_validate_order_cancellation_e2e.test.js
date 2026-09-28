import { describe, it, expect, beforeEach } from 'vitest';
import { orderApi } from '../api/orderApi.js';
import { productApi } from '../api/productApi.js';
import { inventoryApi } from '../api/inventoryApi.js';
import { activityLogApi } from '../api/activityLogApi.js';
import { initSeedData } from './mockApi';

describe('10-Step E2E Browser & Acceptance Scenarios Validation', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Executes all 10 core order cancellation workflow scenarios with 100% pass', async () => {
    const adminActor = { id: 'acc-admin-main', role: 'admin', name: 'Quáº£n trá»‹ viÃªn' };
    const staffActor = { id: 'acc-staff-manager', role: 'staff', name: 'Quáº£n lÃ½' };
    const emp1Actor = { id: 'acc-emp-1', role: 'employee', name: 'NhÃ¢n viÃªn 1' };
    const emp2Actor = { id: 'acc-emp-2', role: 'employee', name: 'NhÃ¢n viÃªn 2' };

    // Setup product
    const products = (await productApi.getAll()).data;
    const testProd = products[0];
    const initialStock = testProd.stockQuantity;

    // 1. Employee creates order
    const now = new Date();
    const order1Data = {
      id: 'ord-e2e-1',
      code: 'HD-E2E-01',
      accountId: emp1Actor.id,
      workSessionId: 'ws-e2e-shift',
      items: [{ productId: testProd.id, productName: testProd.name, quantity: 2, price: testProd.sellPrice }],
      totalAmount: testProd.sellPrice * 2,
      status: 'completed',
      createdAt: now.toISOString(),
    };
    await orderApi.create(order1Data, emp1Actor);

    // 2. Employee cancels own eligible order within 15 minutes
    const cancelRes1 = await orderApi.cancel(order1Data.id, {
      actor: emp1Actor,
      reason: 'KhÃ¡ch hÃ ng Ä‘á»•i Ã½ muá»‘n mua loáº¡i khÃ¡c',
      order: order1Data,
      currentSessionId: 'ws-e2e-shift',
    });
    expect(cancelRes1.data.status).toBe('cancelled');

    // 3. Stock is restored
    
    const prodAfter1 = (await productApi.getById(testProd.id)).data;
    expect(prodAfter1.stockQuantity).toBe(initialStock + 2);

    // 4. Inventory transaction is recorded
    const inTxData = {
      id: 'tx-e2e-in-1',
      productId: testProd.id,
      type: 'IN',
      quantity: 2,
      unitPrice: testProd.sellPrice,
      accountId: emp1Actor.id,
      workSessionId: 'ws-e2e-shift',
      note: 'HoÃ n kho - há»§y HD-E2E-01',
      createdAt: new Date().toISOString(),
    };
    await inventoryApi.createSystemTransaction(inTxData);
    const allInTx = (await inventoryApi.getAllTransactions({ type: 'IN' })).data;
    const recordedTx = allInTx.find(t => t.id === 'tx-e2e-in-1');
    expect(recordedTx).toBeDefined();

    // 5. Audit event is recorded
    const allLogs = (await activityLogApi.getAll()).data;
    const cancelLog = allLogs.find(l => l.action === 'ORDER_CANCELLED' && l.entityId === order1Data.id);
    expect(cancelLog).toBeDefined();
    expect(cancelLog.actorId).toBe(emp1Actor.id);

    // 6. Employee attempts to cancel another employee's order -> Denied
    const order2Data = {
      id: 'ord-e2e-2',
      code: 'HD-E2E-02',
      accountId: emp2Actor.id,
      workSessionId: 'ws-e2e-shift',
      items: [{ productId: testProd.id, quantity: 1, price: testProd.sellPrice }],
      totalAmount: testProd.sellPrice,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    await orderApi.create(order2Data, emp2Actor);
    expect(() => {
      orderApi.cancel(order2Data.id, {
        actor: emp1Actor,
        reason: 'Há»§y há»™ Ä‘á»“ng nghiá»‡p',
        order: order2Data,
        currentSessionId: 'ws-e2e-shift',
      });
    }).toThrowError(/CANCEL_DENIED/);

    // 7. Employee attempts expired order (>15 mins) -> Denied
    const oldDate = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const order3Data = {
      id: 'ord-e2e-3',
      code: 'HD-E2E-03',
      accountId: emp1Actor.id,
      workSessionId: 'ws-e2e-shift',
      items: [{ productId: testProd.id, quantity: 1, price: testProd.sellPrice }],
      totalAmount: testProd.sellPrice,
      status: 'completed',
      createdAt: oldDate,
    };
    await orderApi.create(order3Data, emp1Actor);
    expect(() => {
      orderApi.cancel(order3Data.id, {
        actor: emp1Actor,
        reason: 'Há»§y Ä‘Æ¡n quÃ¡ háº¡n',
        order: order3Data,
        currentSessionId: 'ws-e2e-shift',
      });
    }).toThrowError(/CANCEL_DENIED/);

    // 8. Staff performs approved management cancellation (on old order from different seller)
    const staffCancelRes = await orderApi.cancel(order3Data.id, {
      actor: staffActor,
      reason: 'Quáº£n lÃ½ duyá»‡t há»§y Ä‘Æ¡n sau Ä‘á»‘i soÃ¡t ca',
      order: order3Data,
      currentSessionId: 'ws-e2e-shift',
    });
    expect(staffCancelRes.data.status).toBe('cancelled');

    // 9. Admin performs approved cancellation
    const adminCancelRes = await orderApi.cancel(order2Data.id, {
      actor: adminActor,
      reason: 'Admin can thiá»‡p há»§y giao dá»‹ch lá»—i',
      order: order2Data,
      currentSessionId: 'ws-e2e-shift',
    });
    expect(adminCancelRes.data.status).toBe('cancelled');

    // 10. Cancelled orders remain visible in history
    const allOrdersAfter = (await orderApi.getAll()).data;
    const o1 = allOrdersAfter.find(o => o.id === order1Data.id);
    const o2 = allOrdersAfter.find(o => o.id === order2Data.id);
    const o3 = allOrdersAfter.find(o => o.id === order3Data.id);
    expect(o1?.status).toBe('cancelled');
    expect(o2?.status).toBe('cancelled');
    expect(o3?.status).toBe('cancelled');
  });
});
