/**
 * setup.js — Vitest global test setup (loaded via vite.config.js setupFiles).
 *
 * Responsibilities:
 * 1. Intercept window.localStorage so tests that manipulate business data keys
 *    route transparently to the in-memory mockApi store (not real localStorage).
 * 2. Mock axiosClient so all API calls in tests route to the in-memory mock.
 * 3. Initialize the in-memory store with seed data before tests begin.
 *
 * IMPORTANT: This file DOES NOT add a production data source. All data lives
 * only in the in-memory store during test execution. Nothing is persisted.
 */
import { vi } from 'vitest';
import {
  handleLocalStorageRequest,
  initSeedData,
  clearStore,
  ALL_STORAGE_KEYS,
  getCollectionByStorageKey,
  setCollectionByStorageKey,
  removeCollectionByStorageKey,
} from './mockApi';

// ─── Bridge: window.localStorage ─────────────────────────────────────────────
//
// Tests that directly manipulate business collections via localStorage
// (e.g.  localStorage.setItem('minishop_products', ...)) are redirected
// into the in-memory store.  Non-business keys (auth session, register id,
// draft orders, etc.) pass through to real JSDOM localStorage.
const _origSetItem    = Storage.prototype.setItem;
const _origGetItem    = Storage.prototype.getItem;
const _origRemoveItem = Storage.prototype.removeItem;
const _origClear      = Storage.prototype.clear;

Storage.prototype.setItem = function (key, value) {
  if (ALL_STORAGE_KEYS.has(key)) {
    setCollectionByStorageKey(key, value);
  } else {
    _origSetItem.call(this, key, value);
  }
};

Storage.prototype.getItem = function (key) {
  if (ALL_STORAGE_KEYS.has(key)) {
    return getCollectionByStorageKey(key);   // returns null when absent (mirrors real LS)
  }
  return _origGetItem.call(this, key);
};

Storage.prototype.removeItem = function (key) {
  if (ALL_STORAGE_KEYS.has(key)) {
    removeCollectionByStorageKey(key);
  } else {
    _origRemoveItem.call(this, key);
  }
};

Storage.prototype.clear = function () {
  _origClear.call(this);
  clearStore();
};

// ─── Seed initial data ────────────────────────────────────────────────────────
initSeedData();

// ─── Mock: axiosClient ────────────────────────────────────────────────────────
vi.mock('../api/axiosClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      get:    vi.fn((url)        => handleLocalStorageRequest('GET',    url)),
      post:   vi.fn((url, data)  => handleLocalStorageRequest('POST',   url, data)),
      put:    vi.fn((url, data)  => handleLocalStorageRequest('PUT',    url, data)),
      patch:  vi.fn((url, data)  => handleLocalStorageRequest('PATCH',  url, data)),
      delete: vi.fn((url)        => handleLocalStorageRequest('DELETE', url)),
      interceptors: {
        response: { use: vi.fn() },
      },
    },
  };
});
