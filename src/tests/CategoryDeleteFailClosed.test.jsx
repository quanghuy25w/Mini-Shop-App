import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { categoryApi } from '../api/categoryApi';
import axiosClient from '../api/axiosClient';


describe('Category Deactivation Fail-Closed Safety', () => {
  const adminActor = { role: 'admin' };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Case 1: Should FAIL CLOSED (abort) if /products fetch fails due to a network/generic error', async () => {
    const categoryId = 'c1111111-1111-1111-1111-111111111111';
    
    // Check initial state
    const catBefore = await categoryApi.getById(categoryId);
    expect(catBefore.data.isActive).not.toBe(false);

    // Spy and mock to throw a generic network error on /products
    const originalGet = axiosClient.get;
    vi.spyOn(axiosClient, 'get').mockImplementation((url, config) => {
      if (url === '/products') {
        return Promise.reject(new Error('Network Error: Failed to fetch products'));
      }
      return originalGet(url, config);
    });

    // The deactivation MUST reject instead of silently swallowing the error
    await expect(categoryApi.remove(categoryId, adminActor)).rejects.toThrow('Network Error: Failed to fetch products');

    // Restore so we can check DB
    axiosClient.get.mockRestore();

    // Verify the category was NOT deactivated (still isActive !== false)
    const catAfter = await categoryApi.getById(categoryId);
    expect(catAfter.data.isActive).not.toBe(false);
  });

  it('Case 2: Should succeed if /products fetch succeeds and NO active products exist', async () => {
    // We create a brand new category with no products
    const res = await categoryApi.create({
      id: 'c-test-empty',
      name: 'Empty Category',
      isActive: true
    }, adminActor);
    const categoryId = res.data.id;

    // Deactivation should succeed
    const removeRes = await categoryApi.remove(categoryId, adminActor);
    expect(removeRes.data.isActive).toBe(false);

    // Verify in DB
    const catAfter = await categoryApi.getById(categoryId);
    expect(catAfter.data.isActive).toBe(false);
  });

  it('Case 3: Should block with CATEGORY_HAS_ACTIVE_PRODUCTS if active products exist', async () => {
    const categoryId = 'c1111111-1111-1111-1111-111111111111'; // Milk category, has active products in seed data
    
    await expect(categoryApi.remove(categoryId, adminActor))
      .rejects.toThrow('CATEGORY_HAS_ACTIVE_PRODUCTS');

    // Verify the category was NOT deactivated
    const catAfter = await categoryApi.getById(categoryId);
    expect(catAfter.data.isActive).not.toBe(false);
  });
});
