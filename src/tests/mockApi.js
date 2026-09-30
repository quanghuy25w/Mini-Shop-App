/**
 * mockApi.js — Test-only in-memory API mock.
 *
 * This file is used ONLY by Vitest tests. It is not imported by any production code.
 * It models the current API architecture (axiosClient → json-server → db.json)
 * using an in-memory store seeded from db.json via seedData.js.
 *
 * Rules:
 * - No business rules are enforced here (no WorkSession guards, no permission checks).
 * - Data is isolated in memory; nothing is written to localStorage in production.
 * - Store is stored on globalThis.__MINISHOP_TEST_STORE__ so that setup.js and individual
 *   test suites always access the exact same in-memory store instance within jsdom.
 */
import { seedData } from '../api/seedData';

const getActualSeedData = () => {
  return seedData?.products ? seedData : (seedData?.default || {});
};

const getStore = () => {
  if (!globalThis.__MINISHOP_TEST_STORE__) {
    globalThis.__MINISHOP_TEST_STORE__ = {};
  }
  return globalThis.__MINISHOP_TEST_STORE__;
};

// Resource key → localStorage-style storage key mapping
const STORAGE_KEYS = {
  categories: 'minishop_categories',
  products: 'minishop_products',
  inventoryTransactions: 'minishop_inventoryTransactions',
  orders: 'minishop_orders',
  staff: 'minishop_staff',
  accounts: 'minishop_accounts',
  workSessions: 'minishop_workSessions',
  workSessionMembers: 'minishop_workSessionMembers',
  activityLogs: 'minishop_activityLogs',
};

/**
 * Reset the entire in-memory store back to empty. Used by localStorage.clear() bridge.
 */
export const clearStore = () => {
  globalThis.__MINISHOP_TEST_STORE__ = {};
};

/**
 * Seed the in-memory store from db.json (via seedData.js).
 * Only seeds a collection if it is not already present (guards against overwriting
 * data that a test's beforeEach explicitly set before calling initSeedData).
 */
export const initSeedData = () => { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('minishop_current_register_id', 'POS01');
  const store = getStore();
  const actualData = seedData?.products ? seedData : (seedData?.default || {});
  const shouldSeedKey = (storageKey) => !Object.prototype.hasOwnProperty.call(store, storageKey);

  const seed = (storageKey, data) => {
    if (shouldSeedKey(storageKey)) {
      store[storageKey] = JSON.stringify(Array.isArray(data) ? data : (data || []));
    }
  };

  seed(STORAGE_KEYS.categories, actualData.categories);
      const syntheticProducts = [
      { id: 'p-200K', name: 'Mock 200K', price: 200000, sellPrice: 200000, stockQuantity: 9999, isActive: true },
      { id: 'p-100K', name: 'Mock 100K', price: 100000, sellPrice: 100000, stockQuantity: 9999, isActive: true },
      { id: 'p-150K', name: 'Mock 150K', price: 150000, sellPrice: 150000, stockQuantity: 9999, isActive: true },
      { id: 'p-50K', name: 'Mock 50K', price: 50000, sellPrice: 50000, stockQuantity: 9999, isActive: true },
{ id: 'p1', name: 'Product 1', price: 250000, sellPrice: 250000, stockQuantity: 100, isActive: true },
      { id: 'p2', name: 'Product 2', price: 150000, sellPrice: 150000, stockQuantity: 100, isActive: true },
      { id: 'p3', name: 'Product 3', price: 50000, sellPrice: 50000, stockQuantity: 100, isActive: true },
      { id: 'product-1', name: 'Product A', price: 100000, sellPrice: 100000, stockQuantity: 100, isActive: true },
      { id: 'product-2', name: 'Product B', price: 50000, sellPrice: 50000, stockQuantity: 100, isActive: true },
      { id: 'P001', name: 'P001', price: 100000, sellPrice: 100000, stockQuantity: 100, isActive: true },
      { id: 'p4', name: 'Product 1 VND', price: 1, sellPrice: 1, stockQuantity: 99999999, isActive: true }
    ];
    seed(STORAGE_KEYS.products, [...(actualData.products || []), ...syntheticProducts]);
  seed(STORAGE_KEYS.inventoryTransactions, actualData.inventoryTransactions);
  seed(STORAGE_KEYS.orders, actualData.orders);
  seed(STORAGE_KEYS.staff, []);
  seed(STORAGE_KEYS.accounts, []);
  seed(STORAGE_KEYS.workSessions, []);
  seed(STORAGE_KEYS.workSessionMembers, []);
  seed(STORAGE_KEYS.activityLogs, []);
};

/**
 * Get a collection by resource short-name (e.g. 'products').
 * Returns an array (empty if not seeded).
 */
export const getCollection = (resourceName) => {
  const store = getStore();
  const storageKey = STORAGE_KEYS[resourceName];
  if (!storageKey) return [];
  const raw = store[storageKey];
  return raw ? JSON.parse(raw) : [];
};

/**
 * Set (replace) a collection by resource short-name.
 */
export const setCollection = (resourceName, data) => {
  const store = getStore();
  const storageKey = STORAGE_KEYS[resourceName];
  if (storageKey) {
    store[storageKey] = JSON.stringify(data);
  }
};

/**
 * Clear a single collection by resource short-name.
 * After clearing, initSeedData() will re-seed it.
 */
export const clearCollection = (resourceName) => {
  const store = getStore();
  const storageKey = STORAGE_KEYS[resourceName];
  if (storageKey) {
    delete store[storageKey];
  }
};

/**
 * Directly set a collection by its full storage key (e.g. 'minishop_products').
 * Used by the localStorage.setItem bridge in setup.js.
 */
export const setCollectionByStorageKey = (storageKey, data) => {
  const store = getStore();
  store[storageKey] = typeof data === 'string' ? data : JSON.stringify(data);
};

/**
 * Get a collection by its full storage key.
 * Used by the localStorage.getItem bridge in setup.js.
 */
export const getCollectionByStorageKey = (storageKey) => {
  const store = getStore();
  const raw = store[storageKey];
  if (raw === undefined) return null;          // mirrors localStorage.getItem(absent key) → null
  return raw;                                  // caller receives JSON string
};

/**
 * Delete a collection by its full storage key.
 * Used by the localStorage.removeItem bridge in setup.js.
 */
export const removeCollectionByStorageKey = (storageKey) => {
  const store = getStore();
  delete store[storageKey];
};

// Set of all storage keys that are managed by this mock
export const ALL_STORAGE_KEYS = new Set(Object.values(STORAGE_KEYS));

// Simple UUID-style ID generator for POST auto-id
let _idSeq = 0;
const generateId = () => `mock-id-${Date.now()}-${++_idSeq}`;

/**
 * Main request handler — mirrors json-server CRUD semantics.
 * Does NOT enforce any business rules (no WorkSession guards, no permission checks).
 */
export const handleLocalStorageRequest = (method, url, body = null) => {
  const store = getStore();
  // Lazy seed on first request if store is completely empty
  if (Object.keys(store).length === 0) {
    initSeedData();
  }

  // Parse URL: /resource or /resource/id
  const [path, queryString] = url.split('?');
  const parts = path.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];
  const queryParams = new URLSearchParams(queryString || '');

  // Registers are served from db.json seed data (read-only in mock)
  const isRegisters = resource === 'registers';
  if (!STORAGE_KEYS[resource] && !isRegisters) {
    return Promise.reject(new Error(`Unknown resource: ${resource}`));
  }

  const actualData = getActualSeedData();

  if (method === 'GET') {
    const DEFAULT_REGISTERS = [
      { id: 'POS01', code: 'Q01', name: 'Quầy 01', description: 'Máy POS 01', isActive: true },
      { id: 'POS02', code: 'Q02', name: 'Quầy 02', description: 'Máy POS 02', isActive: true },
      { id: 'POS03', code: 'Q03', name: 'Quầy 03', description: 'Máy POS 03', isActive: true },
      { id: 'p4', name: 'Product 1 VND', price: 1, sellPrice: 1, stockQuantity: 99999999, isActive: true }
    ];
    let items = isRegisters
      ? JSON.parse(JSON.stringify((actualData.registers && actualData.registers.length > 0) ? actualData.registers : DEFAULT_REGISTERS))
      : getCollection(resource);

    if (id) {
      const item = items.find(x => String(x.id) === String(id));
      if (!item) {
        return Promise.reject({ response: { status: 404, statusText: 'Not Found' } });
      }
      return Promise.resolve({ data: JSON.parse(JSON.stringify(item)) });
    } else {
      // Apply all non-meta query params as equality filters (mirrors json-server)
      for (const [key, value] of queryParams.entries()) {
        if (['_sort', '_order', '_limit', '_page', '_embed', '_expand'].includes(key)) continue;
        items = items.filter(x => String(x[key]) === String(value));
      }
      return Promise.resolve({ data: JSON.parse(JSON.stringify(items)) });
    }
  }

  if (method === 'POST') {
    if (isRegisters) {
      return Promise.reject(new Error('Cannot POST to registers (read-only in mock)'));
    }
    const items = getCollection(resource);
    if (body?.id !== undefined && items.some(x => String(x.id) === String(body.id))) {
      return Promise.reject({
        response: { status: 500, statusText: 'Internal Server Error', data: 'Insert failed, duplicate id' },
        message: 'Insert failed, duplicate id'
      });
    }
    // Auto-generate id if not provided (mirrors json-server behavior)
    const newRecord = { ...body, id: body?.id !== undefined ? body.id : generateId() };
    items.push(newRecord);
    setCollection(resource, items);
    return Promise.resolve({ data: JSON.parse(JSON.stringify(newRecord)) });
  }

  if (method === 'PUT') {
    if (isRegisters) {
      return Promise.reject(new Error('Cannot PUT to registers (read-only in mock)'));
    }
    const items = getCollection(resource);
    const index = items.findIndex(x => String(x.id) === String(id));
    if (index !== -1) {
      items[index] = { ...body };
      setCollection(resource, items);
      return Promise.resolve({ data: JSON.parse(JSON.stringify(items[index])) });
    }
    return Promise.reject({ response: { status: 404, statusText: 'Not Found' } });
  }

  if (method === 'PATCH') {
    if (isRegisters) {
      return Promise.reject(new Error('Cannot PATCH to registers (read-only in mock)'));
    }
    const items = getCollection(resource);
    const index = items.findIndex(x => String(x.id) === String(id));
    if (index !== -1) {
      items[index] = { ...items[index], ...body };
      setCollection(resource, items);
      return Promise.resolve({ data: JSON.parse(JSON.stringify(items[index])) });
    }
    return Promise.reject({ response: { status: 404, statusText: 'Not Found' } });
  }

  if (method === 'DELETE') {
    if (isRegisters) {
      return Promise.reject(new Error('Cannot DELETE from registers (read-only in mock)'));
    }

    if (resource === 'workSessions') {
      const msg = 'KHÔNG ĐƯỢC PHÉP XÓA: Dữ liệu ca làm việc là bản ghi lịch sử không thể xóa.';
      const err = new Error(`${msg} (403)`);
      err.code = 'WORKSESSION_DELETION_RESTRICTED';
      err.response = {
        status: 403,
        statusText: 'Forbidden',
        data: {
          error: 'WORKSESSION_DELETION_RESTRICTED',
          message: msg,
        }
      };
      return Promise.reject(err);
    }

    if (resource === 'workSessionMembers') {
      const msg = 'KHÔNG ĐƯỢC PHÉP XÓA: Dữ liệu nhân sự trực ca lịch sử không thể xóa (WORKSESSION_MEMBER_DELETION_RESTRICTED).';
      const err = new Error(`${msg} (403)`);
      err.code = 'WORKSESSION_MEMBER_DELETION_RESTRICTED';
      err.response = {
        status: 403,
        statusText: 'Forbidden',
        data: {
          error: 'WORKSESSION_MEMBER_DELETION_RESTRICTED',
          message: msg,
        }
      };
      return Promise.reject(err);
    }

    const items = getCollection(resource);
    const index = items.findIndex(x => String(x.id) === String(id));
    if (index !== -1) {
      items.splice(index, 1);
      setCollection(resource, items);
      return Promise.resolve({ data: {} });
    }
    return Promise.reject({ response: { status: 404, statusText: 'Not Found' } });
  }

  return Promise.reject(new Error(`Unsupported method: ${method}`));
};


