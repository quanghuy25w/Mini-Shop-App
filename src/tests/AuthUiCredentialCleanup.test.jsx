import { initSeedData, setCollection } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../routes/AppRoutes';
import { AuthProvider } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';

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

describe('Authentication UI & Default Credential Cleanup Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    setCollection('accounts', []);
    setCollection('staff', []);
  });

  it('1. Login email input starts empty', async () => {
    // Seed an admin so app routes to /login instead of /setup-admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'realadmin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/admin']);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/Email Quản trị viên/i);
      expect(emailInput).toBeTruthy();
      expect(emailInput.value).toBe('');
    });
  });

  it('2. Login password/PIN input starts empty', async () => {
    // Seed admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'realadmin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Check Admin Password field starts empty
    const { unmount } = renderApp(['/login/admin']);
    await waitFor(() => {
      const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
      expect(passwordInput.value).toBe('');
    });
    unmount();

    // Check Staff PIN field starts empty
    renderApp(['/login/staff']);
    await waitFor(() => {
      const codeInput = screen.getByLabelText(/Mã hoặc Tên nhân viên/i);
      const pinInput = screen.getByPlaceholderText('••••••');
      expect(codeInput.value).toBe('');
      expect(pinInput.value).toBe('');
    });
  });

  it('3. No demo account is injected into the form', async () => {
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'realadmin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/admin']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ĐĂNG NHẬP QUẢN TRỊ/i })).toBeTruthy();
    });

    const emailInput = screen.getByLabelText(/Email Quản trị viên/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);

    expect(emailInput.value).not.toBe('admin@minishop.com');
    expect(emailInput.value).not.toBe('admin@example.com');
    expect(emailInput.value).toBe('');
    expect(passwordInput.value).not.toBe('password123');
    expect(passwordInput.value).not.toBe('123456');
    expect(passwordInput.value).toBe('');
  });

  it('4. First Admin Setup fields start empty', async () => {
    // No accounts in DB -> routes to /setup-admin
    renderApp(['/setup-admin']);

    await waitFor(() => {
      expect(screen.getByText(/Khởi tạo Hệ thống/i)).toBeTruthy();
    });

    const emailInput = screen.getByLabelText(/Email Quản trị viên \*/i);
    const nameInput = screen.getByLabelText(/Tên chủ cửa hàng/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu \*$/i);
    const confirmInput = screen.getByLabelText(/Xác nhận mật khẩu \*/i);

    expect(emailInput.value).toBe('');
    expect(nameInput.value).toBe('');
    expect(passwordInput.value).toBe('');
    expect(confirmInput.value).toBe('');
  });

  it('5. Creating the first admin requires explicit user input', async () => {
    renderApp(['/setup-admin']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN/i })).toBeTruthy();
    });

    const emailInput = screen.getByLabelText(/Email Quản trị viên \*/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu \*$/i);
    const confirmInput = screen.getByLabelText(/Xác nhận mật khẩu \*/i);
    const submitBtn = screen.getByRole('button', { name: /TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN/i });

    // Inputs have required attribute
    expect(emailInput.hasAttribute('required')).toBe(true);
    expect(passwordInput.hasAttribute('required')).toBe(true);
    expect(confirmInput.hasAttribute('required')).toBe(true);

    // Verify submitting empty form does not create any account
    fireEvent.click(submitBtn);

    const accountsRes = await accountApi.getAll({ role: 'admin' });
    expect(accountsRes.data.length).toBe(0);
  });

  it('6. No plaintext password/PIN is written to localStorage upon login or setup', async () => {
    renderApp(['/setup-admin']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Email Quản trị viên \*/i), {
      target: { value: 'explicit.admin@minishop.com' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu \*$/i), {
      target: { value: 'SecretPass999' }
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu \*/i), {
      target: { value: 'SecretPass999' }
    });

    fireEvent.click(screen.getByRole('button', { name: /TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });

    // Inspect localStorage
    const rawSession = localStorage.getItem('minishop_auth_session');
    expect(rawSession).toBeTruthy();
    expect(rawSession).not.toContain('SecretPass999');

    const sessionObj = JSON.parse(rawSession);
    expect(sessionObj.password).toBeUndefined();
    expect(sessionObj.pin).toBeUndefined();
  });

  it('7. Auth session restoration does not populate login credentials into form state', async () => {
    // 1. Create an admin
    const acc = await accountApi.create({
      id: 'acc-stored-admin',
      employeeId: null,
      role: 'admin',
      email: 'stored.admin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // 2. Simulate stored session in localStorage
    localStorage.setItem('minishop_auth_session', JSON.stringify({
      id: acc.data.id,
      employeeId: null,
      role: 'admin',
      email: 'stored.admin@minishop.com',
      name: 'Admin User',
      isActive: true
    }));

    // 3. Render directly at /login/admin
    const { unmount } = renderApp(['/login/admin']);

    // Since authenticated, user is redirected to '/'
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });
    unmount();

    // 4. Now simulate session cleared and rendering login
    localStorage.removeItem('minishop_auth_session');
    renderApp(['/login/admin']);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/Email Quản trị viên/i);
      const passInput = screen.getByLabelText(/^Mật khẩu$/i);
      expect(emailInput.value).toBe('');
      expect(passInput.value).toBe('');
    });
  });

  it('8. Logout does not leave old credentials in the login form', async () => {
    // 1. Seed admin
    await accountApi.create({
      id: 'acc-admin-logout',
      employeeId: null,
      role: 'admin',
      email: 'admin.logout@minishop.com',
      password: 'Password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/admin']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ĐĂNG NHẬP QUẢN TRỊ/i })).toBeTruthy();
    });

    // Enter credentials
    fireEvent.change(screen.getByLabelText(/Email Quản trị viên/i), {
      target: { value: 'admin.logout@minishop.com' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), {
      target: { value: 'Password123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /ĐĂNG NHẬP QUẢN TRỊ/i }));

    // Wait for Dashboard
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });

    // Click logout
    fireEvent.click(screen.getByRole('button', { name: /Đăng xuất/i }));

    // Returned to login page
    await waitFor(() => {
      expect(screen.getByText(/Hệ thống Mini-Shop/i)).toBeTruthy();
    });

    // Switch to Admin tab to check form inputs
    fireEvent.click(screen.getByRole('button', { name: /Quản trị viên/i }));

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/Email Quản trị viên/i);
      const passInput = screen.getByLabelText(/^Mật khẩu$/i);
      expect(emailInput.value).toBe('');
      expect(passInput.value).toBe('');
    });
  });

  it('9. A fresh browser state does not contain old demo credentials', () => {
    expect(localStorage.getItem('minishop_auth_session')).toBeNull();
    expect(localStorage.getItem('minishop_credentials')).toBeNull();
    expect(localStorage.getItem('minishop_admin_email')).toBeNull();
    expect(localStorage.getItem('minishop_admin_password')).toBeNull();
  });

  it('10. Existing valid login behavior still works', async () => {
    // Seed admin
    await accountApi.create({
      id: 'acc-admin-valid',
      employeeId: null,
      role: 'admin',
      email: 'admin.valid@minishop.com',
      password: 'ValidPassword123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Seed staff
    const staff = await staffApi.create({
      id: 'staff-valid-1',
      employeeCode: 'NV009',
      name: 'Nhân Viên Hợp Lệ',
      phone: '0909090909',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-staff-valid',
      employeeId: staff.data.id,
      role: 'staff',
      pin: '654321',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Test Admin login
    const { unmount } = renderApp(['/login/admin']);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ĐĂNG NHẬP QUẢN TRỊ/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Email Quản trị viên/i), {
      target: { value: 'admin.valid@minishop.com' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), {
      target: { value: 'ValidPassword123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /ĐĂNG NHẬP QUẢN TRỊ/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Đăng xuất/i }));
    await waitFor(() => {
      expect(screen.getByText(/Hệ thống Mini-Shop/i)).toBeTruthy();
    });
    unmount();

    // Test Staff login
    renderApp(['/login/staff']);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Mã hoặc Tên nhân viên/i), {
      target: { value: 'NV009' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '654321' }
    });
    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(screen.getByText(/Nhân Viên Hợp Lệ/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });
  });
});
