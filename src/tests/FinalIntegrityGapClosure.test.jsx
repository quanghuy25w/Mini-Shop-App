import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosClient from '../api/axiosClient';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { workSessionApi } from '../api/workSessionApi';
import { registerApi } from '../api/registerApi';
import { calculateSessionReconciliation } from '../utils/reconciliation';

vi.mock('../api/axiosClient');

describe('Final Integrity Gap Closure Pass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Completed order creation is self-protecting (cannot bypass invariants)', () => {
    const adminActor = { id: 'acc-admin', role: 'admin', isActive: true };

    it('rejects order with empty items even without explicit context flags', async () => {
      expect(() => {
        orderApi.create({
          status: 'completed',
          items: [],
          workSessionId: 'ws-1',
          registerId: 'POS01',
          totalAmount: 100000,
        }, adminActor);
      }).toThrow(/phải có ít nhất 1 sản phẩm/i);
    });

    it('rejects order without workSessionId when selling context is enforced', async () => {
      expect(() => {
        orderApi.create({
          status: 'completed',
          items: [{ productId: 'p1', productName: 'Bút bi', quantity: 1, price: 10000 }],
          registerId: 'POS01',
          totalAmount: 10000,
        }, adminActor, { requireSellingContext: true });
      }).toThrow(/bắt buộc phải gắn với ca làm việc/i);
    });

    it('rejects order when totalAmount does not match item calculations when strict totals is enforced', async () => {
      expect(() => {
        orderApi.create({
          status: 'completed',
          items: [{ productId: 'p1', productName: 'Bút bi', quantity: 2, price: 10000 }],
          workSessionId: 'ws-1',
          registerId: 'POS01',
          totalAmount: 999999, // Mismatched total
        }, adminActor, { requireStrictTotals: true });
      }).toThrow(/không khớp với giá trị sản phẩm tính toán/i);
    });
  });

  describe('2. Inventory system transactions are strictly locked down against generic fabrication', () => {
    const adminActor = { id: 'acc-admin', role: 'admin', isActive: true };

    it('synchronously rejects SALE transaction when orderCode / orderId is missing', () => {
      expect(() => {
        inventoryApi.createTransaction({
          type: 'OUT',
          reason: 'SALE',
          productId: 'prod-1',
          quantity: 2,
        }, adminActor);
      }).toThrow('INVALID_TRANSACTION_CONTEXT');
    });

    it('synchronously rejects CANCEL_RESTOCK transaction when orderCode / orderId is missing', () => {
      expect(() => {
        inventoryApi.createTransaction({
          type: 'IN',
          reason: 'CANCEL_RESTOCK',
          productId: 'prod-1',
          quantity: 2,
        }, adminActor);
      }).toThrow('INVALID_TRANSACTION_CONTEXT');
    });

    it('rejects direct SALE transaction if referenced order does not exist', async () => {
      axiosClient.get.mockResolvedValueOnce({ data: [] }); // No orders in db

      await expect(
        inventoryApi.createTransaction({
          type: 'OUT',
          reason: 'SALE',
          orderCode: 'HD-999999',
          productId: 'prod-1',
          quantity: 1,
        }, adminActor)
      ).rejects.toThrow('INVALID_TRANSACTION_CONTEXT');
    });

    it('rejects direct SALE transaction if order status is not completed', async () => {
      axiosClient.get.mockResolvedValueOnce({
        data: [{
          id: 'ord-pending',
          code: 'HD-PENDING',
          status: 'pending',
          items: [{ productId: 'prod-1', quantity: 1 }],
        }]
      });

      await expect(
        inventoryApi.createTransaction({
          type: 'OUT',
          reason: 'SALE',
          orderCode: 'HD-PENDING',
          productId: 'prod-1',
          quantity: 1,
        }, adminActor)
      ).rejects.toThrow('INVALID_TRANSACTION_CONTEXT');
    });

    it('rejects direct SALE transaction if item quantity does not match order item quantity', async () => {
      axiosClient.get.mockResolvedValueOnce({
        data: [{
          id: 'ord-ok',
          code: 'HD-OK',
          status: 'completed',
          items: [{ productId: 'prod-1', quantity: 2 }],
        }]
      });

      await expect(
        inventoryApi.createTransaction({
          type: 'OUT',
          reason: 'SALE',
          orderCode: 'HD-OK',
          productId: 'prod-1',
          quantity: 5, // mismatch
        }, adminActor)
      ).rejects.toThrow('INVALID_TRANSACTION_CONTEXT');
    });

    it('rejects duplicate direct SALE transaction for the same order and product', async () => {
      axiosClient.get
        .mockResolvedValueOnce({
          data: [{
            id: 'ord-dup',
            code: 'HD-DUP',
            status: 'completed',
            items: [{ productId: 'prod-1', quantity: 2 }],
          }]
        })
        .mockResolvedValueOnce({
          data: [{
            id: 'tx-existing',
            type: 'OUT',
            reason: 'SALE',
            orderCode: 'HD-DUP',
            productId: 'prod-1',
          }]
        });

      await expect(
        inventoryApi.createTransaction({
          type: 'OUT',
          reason: 'SALE',
          orderCode: 'HD-DUP',
          productId: 'prod-1',
          quantity: 2,
        }, adminActor)
      ).rejects.toThrow('DUPLICATE_TRANSACTION');
    });

    it('rejects direct CANCEL_RESTOCK transaction if order status is not cancelled', async () => {
      axiosClient.get.mockResolvedValueOnce({
        data: [{
          id: 'ord-not-cancelled',
          code: 'HD-NOT-CANCELLED',
          status: 'completed',
          items: [{ productId: 'prod-1', quantity: 1 }],
        }]
      });

      await expect(
        inventoryApi.createTransaction({
          type: 'IN',
          reason: 'CANCEL_RESTOCK',
          orderCode: 'HD-NOT-CANCELLED',
          productId: 'prod-1',
          quantity: 1,
        }, adminActor)
      ).rejects.toThrow('INVALID_TRANSACTION_CONTEXT');
    });
  });

  describe('3. Protected mutations fail closed when actor is null', () => {
    it('accountApi.update throws NOT_AUTHENTICATED when actor is null', () => {
      expect(() => {
        accountApi.update('acc-1', { name: 'New Name' }, null);
      }).toThrow('NOT_AUTHENTICATED');
    });

    it('staffApi.create throws NOT_AUTHENTICATED when actor is null', () => {
      expect(() => {
        staffApi.create({ name: 'New Staff' }, null);
      }).toThrow('NOT_AUTHENTICATED');
    });

    it('staffApi.update throws NOT_AUTHENTICATED when actor is null', () => {
      expect(() => {
        staffApi.update('st-1', { name: 'Staff Updated' }, null);
      }).toThrow('NOT_AUTHENTICATED');
    });

    it('staffApi.remove throws NOT_AUTHENTICATED when actor is null', () => {
      expect(() => {
        staffApi.remove('st-1', null);
      }).toThrow('NOT_AUTHENTICATED');
    });

    it('workSessionApi.update throws NOT_AUTHENTICATED when actor is null', () => {
      expect(() => {
        workSessionApi.update('ws-1', { note: 'Updated' }, null);
      }).toThrow('NOT_AUTHENTICATED');
    });

    it('workSessionApi.createMember throws NOT_AUTHENTICATED when actor is null', async () => {
      await expect(
        workSessionApi.createMember({ accountId: 'acc-1', workSessionId: 'ws-1' }, null)
      ).rejects.toThrow('NOT_AUTHENTICATED');
    });

    it('inventoryApi.createTransaction throws NOT_AUTHENTICATED when actor is null', () => {
      expect(() => {
        inventoryApi.createTransaction({ type: 'IN', reason: 'PURCHASE', productId: 'p1', quantity: 1 }, null);
      }).toThrow('NOT_AUTHENTICATED');
    });
  });

  describe('4. Register source of truth and dynamic validation', () => {
    const adminActor = { id: 'acc-admin', role: 'admin', isActive: true };

    it('rejects order with unknown registerId not present in canonical registers', () => {
      expect(() => {
        orderApi.create({
          status: 'completed',
          items: [{ productId: 'p1', price: 10000, quantity: 1 }],
          workSessionId: 'ws-1',
          registerId: 'POS-FABRICATED-99',
          totalAmount: 10000,
        }, adminActor);
      }).toThrow(/không tồn tại trong hệ thống/i);
    });

    it('dynamically recognizes new register added to canonical register collection', async () => {
      const originalRegisters = registerApi.getSyncRegisters();
      try {
        registerApi.setCachedRegisters([
          ...originalRegisters,
          { id: 'POS-NEW-99', name: 'Quầy lưu động 99', isActive: true }
        ]);

        axiosClient.get.mockImplementation(url => {
          if (url.includes('/products/')) {
            return Promise.resolve({ data: { id: 'p1', isActive: true, price: 10000 } });
          }
          if (url.includes('/registers')) {
            return Promise.resolve({ data: registerApi.getSyncRegisters() });
          }
          return Promise.resolve({ data: [] });
        });
        axiosClient.post.mockResolvedValue({ data: { id: 'ord-dyn-pos' } });

        const res = await orderApi.create({
          status: 'completed',
          items: [{ productId: 'p1', price: 10000, quantity: 1 }],
          workSessionId: 'ws-1',
          registerId: 'POS-NEW-99',
          totalAmount: 10000,
        }, adminActor);

        expect(res.data.id).toBe('ord-dyn-pos');
      } finally {
        registerApi.setCachedRegisters(originalRegisters);
      }
    });

    it('reconciliation.calculateSessionReconciliation does not fabricate POS01 for unassigned orders', () => {
      const session = {
        id: 'ws-test',
        code: 'CA-TEST',
        date: '2026-09-24',
        status: 'active',
        initialCash: 1000000,
        posInitialCash: { POS01: 500000, POS02: 500000 },
      };
      const orders = [
        {
          id: 'ord-no-pos',
          workSessionId: 'ws-test',
          status: 'completed',
          paymentMethod: 'cash',
          totalAmount: 50000,
          registerId: null, // No register
        }
      ];

      const recon = calculateSessionReconciliation({
        session,
        orders,
        registers: [
          { id: 'POS01', name: 'Quầy 1', isActive: true },
          { id: 'POS02', name: 'Quầy 2', isActive: true },
        ],
      });

      // Total store cash sales must include the 50,000đ
      expect(recon.cashSales).toBe(50000);
      // But POS01 and POS02 cash sales must NOT falsely absorb the unassigned order
      expect(recon.posBreakdown.POS01.cashSales).toBe(0);
      expect(recon.posBreakdown.POS02.cashSales).toBe(0);
    });
  });
});
