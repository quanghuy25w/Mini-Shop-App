import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../routes/AppRoutes';
import { AuthProvider } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';


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

describe('Auth Routes, ProtectedRoute & Login UI Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Redirects to /setup-admin when no Admin exists', async () => {
 localStorage.setItem('minishop_accounts', '[]');
    renderApp(['/']);

    await waitFor(() => {
      expect(screen.getByText(/Khởi tạo Hệ thống/i)).toBeTruthy();
      expect(screen.getByText(/TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN/i)).toBeTruthy();
    });
  });

  it('Allows setting up first Admin from UI and enters Dashboard', async () => {
 localStorage.setItem('minishop_accounts', '[]');
    renderApp(['/setup-admin']);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@minishop.com')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('admin@minishop.com'), {
      target: { value: 'admin@minishop.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Tối thiểu 6 ký tự'), {
      target: { value: 'Password123' }
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập lại mật khẩu'), {
      target: { value: 'Password123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN/i }));

    await waitFor(() => {
      // Should now be inside Dashboard Layout, showing logout button
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Redirects unauthenticated user to /login when Admin exists', async () => {
    // Seed an admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@shop.com',
      password: 'password123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderApp(['/']);

    await waitFor(() => {
      expect(screen.getByText(/Hệ thống Mini-Shop/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });
  });

  it('Performs Staff login from UI with Employee Code + PIN', async () => {
    // 1. Seed admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@shop.com',
      password: 'password123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Seed staff + staff account
    const staffRes = await staffApi.create({
      id: 'staff-01',
      employeeCode: 'NV001',
      name: 'Nguyễn Anh',
      phone: '0901234567',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await accountApi.create({
      id: 'acc-staff-01',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '123456',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderApp(['/login']);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Vd: NV001')).toBeTruthy();
    });

    // Nhập Employee Code: NV001
    fireEvent.change(screen.getByPlaceholderText('Vd: NV001'), {
      target: { value: 'NV001' }
    });

    // Nhận diện và hiển thị tên nhân viên: Nguyễn Anh
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Anh')).toBeTruthy();
      expect(screen.getByText('NV001')).toBeTruthy();
    });

    // Nhập PIN 6 số
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '123456' }
    });

    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(screen.getByText(/Nguyễn Anh/i)).toBeTruthy();
      expect(screen.getByText(/(Staff|Nhân viên) \(NV001\)/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });
  });

  it('Performs Admin login from UI and logs out', async () => {
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@shop.com',
      password: 'password123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderApp(['/login/admin']);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('admin@minishop.com')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('admin@minishop.com'), {
      target: { value: 'admin@shop.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), {
      target: { value: 'password123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /ĐĂNG NHẬP QUẢN TRỊ/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });

    // Click logout
    const logoutBtn = screen.getByRole('button', { name: /Đăng xuất/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByText(/Hệ thống Mini-Shop/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });
  });

  it('E2E: Newly created staff logs in via StaffLogin UI and enters dashboard', async () => {
    // 1. Seed admin
    await accountApi.create({
      id: 'acc-admin-main',
      employeeId: null,
      role: 'admin',
      email: 'admin@shop.com',
      password: 'password123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Create staff record and account using staffApi & accountApi
    const staffRes = await staffApi.create({
      id: 'staff-auto-gen-id',
      employeeCode: 'NV088',
      name: 'Thiên Dũng',
      phone: '0912345678',
      hireDate: '2026-08-26',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const actualStaffId = staffRes.data.id;

    await accountApi.create({
      id: 'acc-staff-auto-id',
      employeeId: actualStaffId,
      role: 'staff',
      email: null,
      password: null,
      pin: '123456',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 3. User navigates to /login/staff
    renderApp(['/login/staff']);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Vd: NV001')).toBeTruthy();
    });

    // 4. Fill form with "NV088" and PIN "123456"
    fireEvent.change(screen.getByPlaceholderText('Vd: NV001'), {
      target: { value: 'NV088' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '123456' }
    });

    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    // 5. Must log in successfully and enter Dashboard
    await waitFor(() => {
      expect(screen.getByText(/Thiên Dũng/i)).toBeTruthy();
      expect(screen.getByText(/(Staff|Nhân viên) \(NV088\)/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });
  });
});
