 import { describe, it, expect, beforeEach } from 'vitest';
import { orderApi } from '../api/orderApi';
import { productApi } from '../api/productApi';
import { inventoryApi } from '../api/inventoryApi';
import axiosClient from '../api/axiosClient';
import { PERMISSIONS } from '../utils/permissions';

describe('Repair Pass Regression Suite', () => {
  const adminActor = {
    id: 'admin-1',
    role: 'admin',
    name: 'Admin'
  };

  const sellerActor = {
    id: 'seller-1',
    role: 'nhan_vien',
    name: 'Seller',
    permissions: [PERMISSIONS.ORDER_CREATE]
  };

  const genericActor = {
    id: 'generic-1',
    role: 'nhan_vien',
    name: 'Generic',
    permissions: []
  };

  beforeEach(() => {
    localStorage.clear();
    // Seed some products
    const p1 = { id: 'p_repair_1', name: 'Repair Product', price: 100000, sellPrice: 100000, stockQuantity: 50, isActive: true };
    localStorage.setItem('minishop_products', JSON.stringify([p1]));
  });

  it('1. caller-controlled source must not alter authorization', async () => {
    // genericActor doesn't have INVENTORY_ADJUST. Even if we pass source: pos_checkout, it should fail.
    await expect(
      productApi.adjustStockDelta('p_repair_1', -1, genericActor, { source: 'pos_checkout' })
    ).rejects.toThrow('PERMISSION_DENIED');
  });

  it('2. unauthenticated/public create System Transaction must be eliminated', () => {
    expect(inventoryApi.createSystemTransaction).toBeUndefined();
  });

  it('3. unauthoritative direct order creation price path must be removed', async () => {
    // Try to create order with wrong price
    const fakeOrder = {
      id: 'ord_bad_price',
      totalAmount: 50000,
      workSessionId: 'ws_fake',
      items: [{ productId: 'p_repair_1', quantity: 1, price: 50000 }]
    };
    await expect(
      orderApi.create(fakeOrder, sellerActor)
    ).rejects.toThrow('ORDER_PRICE_MISMATCH');
  });

  it('4. missing/unknown products must not be accepted into financial orders', async () => {
    const fakeOrder = {
      id: 'ord_missing',
      totalAmount: 50000,
      workSessionId: 'ws_fake',
      items: [{ productId: 'p_unknown_xyz', quantity: 1, price: 50000 }]
    };
    await expect(
      orderApi.create(fakeOrder, sellerActor)
    ).rejects.toThrow('ORDER_VALIDATION_ERROR: Sản phẩm "p_unknown_xyz" không tồn tại.');
  });
});