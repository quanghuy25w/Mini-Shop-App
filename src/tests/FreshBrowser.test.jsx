import { describe, it, expect, beforeEach } from 'vitest';
import { initSeedData } from '../api/localStorageAdapter';
import { seedData } from '../api/seedData';
import axiosClient from '../api/axiosClient';

describe('Fresh Browser / Empty LocalStorage Seed Data Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Automatically populates localStorage with seedData on fresh browser access', async () => {
    expect(localStorage.getItem('minishop_categories')).toBeNull();
    expect(localStorage.getItem('minishop_products')).toBeNull();
    expect(localStorage.getItem('minishop_inventoryTransactions')).toBeNull();
    expect(localStorage.getItem('minishop_orders')).toBeNull();

    // Call initSeedData or handleLocalStorageRequest
    initSeedData();

    expect(localStorage.getItem('minishop_categories')).not.toBeNull();
    expect(localStorage.getItem('minishop_products')).not.toBeNull();
    expect(localStorage.getItem('minishop_inventoryTransactions')).not.toBeNull();
    expect(localStorage.getItem('minishop_orders')).not.toBeNull();

    const categories = JSON.parse(localStorage.getItem('minishop_categories'));
    const products = JSON.parse(localStorage.getItem('minishop_products'));
    const transactions = JSON.parse(localStorage.getItem('minishop_inventoryTransactions'));
    const orders = JSON.parse(localStorage.getItem('minishop_orders'));

    expect(categories.length).toBeGreaterThan(0);
    expect(products.length).toBeGreaterThan(0);
    expect(transactions.length).toBeGreaterThan(0);
    expect(orders.length).toBeGreaterThan(0);
  });

  it('Returns seed data through axiosClient in Demo Mode for all endpoints', async () => {
    const catRes = await axiosClient.get('/categories');
    expect(catRes.data.length).toBe(seedData.categories.length);

    const prodRes = await axiosClient.get('/products');
    expect(prodRes.data.length).toBe(seedData.products.length);

    const txRes = await axiosClient.get('/inventoryTransactions');
    expect(txRes.data.length).toBe(seedData.inventoryTransactions.length);

    const orderRes = await axiosClient.get('/orders');
    expect(orderRes.data.length).toBe(seedData.orders.length);
  });

  it('Persists new data and does not overwrite on subsequent initSeedData calls', async () => {
    // 1. Initial seed
    initSeedData();
    const productsBefore = JSON.parse(localStorage.getItem('minishop_products'));
    const initialCount = productsBefore.length;

    // 2. Add a new product via POST
    const newProduct = {
      id: 'p-test-999',
      name: 'Sản phẩm Test Mới',
      categoryId: seedData.categories[0].id,
      unit: 'Cái',
      costPrice: 10000,
      sellPrice: 15000,
      stockQuantity: 50,
      minStockAlert: 5,
      isActive: true
    };
    await axiosClient.post('/products', newProduct);

    // 3. Verify it was saved
    const productsAfterPost = JSON.parse(localStorage.getItem('minishop_products'));
    expect(productsAfterPost.length).toBe(initialCount + 1);

    // 4. Simulate page reload (calling initSeedData again)
    initSeedData();

    // 5. Verify new product is still present and count is unchanged
    const productsAfterReload = JSON.parse(localStorage.getItem('minishop_products'));
    expect(productsAfterReload.length).toBe(initialCount + 1);
    expect(productsAfterReload.some(p => p.id === 'p-test-999')).toBe(true);
  });
});
