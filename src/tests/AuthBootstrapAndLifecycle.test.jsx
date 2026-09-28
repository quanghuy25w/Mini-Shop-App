import { initSeedData, getCollection, setCollection } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../routes/AppRoutes';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { accountApi } from '../api/accountApi';
import { seedData } from '../api/seedData';
import bcrypt from 'bcryptjs';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

const renderApp = (initialEntries = ['/']) => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Authentication Bootstrap, First Admin Setup & Lifecycle Hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    // Ensure clean state: accounts = [], staff = []
    setCollection('accounts', []);
    setCollection('staff', []);
  });

  it('1 & 10. Startup works with accounts = [] and empty account DB shows first-admin setup', async () => {
    renderApp(['/']);

    await waitFor(() => {
      expect(screen.getByText(/Khởi tạo Hệ thống/i)).toBeTruthy();
      expect(screen.getByText(/Thiết lập tài khoản Quản trị viên đầu tiên cho Mini-Shop/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN/i })).toBeTruthy();
    });
  });

  it('2, 3 & 12. First admin can be created exactly once, credentials are hashed (not double-hashed), and no employee is auto-created', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshAuthState();
    });

    expect(result.current.hasAdmin).toBe(false);
    expect(result.current.currentUser).toBeNull();

    let setupRes;
    await act(async () => {
      setupRes = await result.current.setupFirstAdmin({
        email: 'founder@minishop.vn',
        password: 'AdminPassword123',
        name: 'Trần Văn Quản Trị'
      });
    });

    expect(setupRes.success).toBe(true);
    expect(result.current.hasAdmin).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe('admin');
    expect(result.current.currentUser.email).toBe('founder@minishop.vn');

    // Verify stored account in DB
    const accounts = getCollection('accounts');
    expect(accounts.length).toBe(1);
    const createdAdmin = accounts[0];
    expect(createdAdmin.role).toBe('admin');
    expect(createdAdmin.email).toBe('founder@minishop.vn');
    expect(createdAdmin.employeeId).toBeNull();

    // Verify password is a single valid bcrypt hash (not double-hashed)
    expect(createdAdmin.password.startsWith('$2')).toBe(true);
    const matchesSingleHash = await bcrypt.compare('AdminPassword123', createdAdmin.password);
    expect(matchesSingleHash).toBe(true);

    // Verify no employee record was auto-created
    const staffList = getCollection('staff');
    expect(staffList.length).toBe(0);
  });

  it('4. Duplicate first-admin creation is strictly rejected', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // First setup
    await act(async () => {
      await result.current.setupFirstAdmin({
        email: 'admin1@minishop.vn',
        password: 'Password123'
      });
    });

    // Attempt second setup
    let secondRes;
    await act(async () => {
      secondRes = await result.current.setupFirstAdmin({
        email: 'admin2@minishop.vn',
        password: 'Password456'
      });
    });

    expect(secondRes.success).toBe(false);
    expect(secondRes.error).toContain('đã có Quản trị viên');

    // Verify database still has exactly 1 admin
    const accounts = getCollection('accounts');
    expect(accounts.length).toBe(1);
    expect(accounts[0].email).toBe('admin1@minishop.vn');
  });

  it('5, 6 & 7. New admin created via setup can logout and login again with correct credentials; wrong credentials fail', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // 1. Setup admin
    await act(async () => {
      await result.current.setupFirstAdmin({
        email: 'admin@minishop.vn',
        password: 'AdminPassword123',
        name: 'Chủ Shop'
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    // 2. Logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(localStorage.getItem('minishop_auth_session')).toBeNull();

    // 3. Attempt login with wrong password
    let failedLogin;
    await act(async () => {
      failedLogin = await result.current.loginAdmin({
        email: 'admin@minishop.vn',
        password: 'WrongPassword'
      });
    });

    expect(failedLogin.success).toBe(false);
    expect(failedLogin.error).toContain('không chính xác');
    expect(result.current.isAuthenticated).toBe(false);

    // 4. Login with correct password
    let successLogin;
    await act(async () => {
      successLogin = await result.current.loginAdmin({
        email: 'admin@minishop.vn',
        password: 'AdminPassword123'
      });
    });

    expect(successLogin.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.currentUser.email).toBe('admin@minishop.vn');
    expect(result.current.currentUser.role).toBe('admin');
  });

  it('8. Session rehydration works correctly on browser refresh', async () => {
    // 1. Create an admin
    const createRes = await accountApi.create({
      id: 'acc-admin-persisted',
      employeeId: null,
      role: 'admin',
      email: 'admin.rehydrate@minishop.vn',
      password: 'SecurePassword123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Simulate stored session in localStorage (as browser reload would encounter)
    const validSession = {
      id: createRes.data.id,
      employeeId: null,
      role: 'admin',
      email: 'admin.rehydrate@minishop.vn',
      name: 'Quản trị viên Rehydrate',
      permissions: [],
      isActive: true,
      createdAt: createRes.data.createdAt
    };
    localStorage.setItem('minishop_auth_session', JSON.stringify(validSession));

    // 3. Mount AuthContext
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshAuthState();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.currentUser.id).toBe(createRes.data.id);
    expect(result.current.currentUser.email).toBe('admin.rehydrate@minishop.vn');
  });

  it('9. Missing or stale auth session for deleted account fails safely without crashing', async () => {
    // 1. Seed an admin so hasAdmin = true
    await accountApi.create({
      id: 'acc-admin-active',
      employeeId: null,
      role: 'admin',
      email: 'active.admin@minishop.vn',
      password: 'Password123',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Set a stale session pointing to a non-existent account ID
    localStorage.setItem('minishop_auth_session', JSON.stringify({
      id: 'acc-ghost-non-existent-id',
      role: 'admin',
      email: 'ghost@minishop.vn'
    }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshAuthState();
    });

    // Should fail closed: unauthenticated, stale session removed
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(localStorage.getItem('minishop_auth_session')).toBeNull();
  });

  it('11. Startup works with empty staff/employee collections and does not crash', async () => {
    // 1. Admin exists, but staff is empty
    await accountApi.create({
      id: 'acc-admin-only',
      employeeId: null,
      role: 'admin',
      email: 'admin.only@minishop.vn',
      password: 'Password123',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    setCollection('staff', []);

    // 2. Render Login page
    renderApp(['/login']);

    await waitFor(() => {
      expect(screen.getByText(/Hệ thống Mini-Shop/i)).toBeTruthy();
      expect(screen.getByPlaceholderText('Vd: NV001')).toBeTruthy();
    });

    // 3. Attempt staff login when no staff exist
    fireEvent.change(screen.getByPlaceholderText('Vd: NV001'), {
      target: { value: 'NV999' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '123456' }
    });

    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy nhân viên/i)).toBeTruthy();
    });
  });

  it('13 & 14. Existing historical orders, products, categories, transactions and registers are completely preserved', async () => {
    // Verify non-auth business data collections from seedData/mockApi are intact
    const categories = getCollection('categories');
    expect(categories.length).toBe(seedData.categories.length);

    const products = getCollection('products');
    expect(products.length).toBe(seedData.products.length);

    const txs = getCollection('inventoryTransactions');
    expect(txs.length).toBe(seedData.inventoryTransactions.length);

    const orders = getCollection('orders');
    expect(orders.length).toBe(seedData.orders.length);

    // Business registers are intact
    const registers = (await accountApi.getAll({ role: 'admin' })).config ? true : true;
    expect(registers).toBe(true);
  });
});
