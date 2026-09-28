import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Giả lập axios.create để chúng ta có thể kiểm tra xem nó được gọi với tham số nào
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn((config) => ({
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        defaults: config,
        interceptors: { response: { use: vi.fn() } }
      }))
    }
  };
});

describe('axiosClient API base URL resolution', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses http://localhost:3001 by default', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    await import('../api/axiosClient');
    // Because axios.create is mocked, we need to inspect the calls
    expect(axios.create).toHaveBeenCalled();
    const lastCall = axios.create.mock.calls[axios.create.mock.calls.length - 1][0];
    expect(lastCall.baseURL).toBe('http://localhost:3001');
  });

  it.skip('uses VITE_API_BASE_URL if configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://192.168.1.100:3001');
    await import('../api/axiosClient');
    const lastCall = axios.create.mock.calls[axios.create.mock.calls.length - 1][0];
    expect(lastCall.baseURL).toBe('http://192.168.1.100:3001');
  });
});
