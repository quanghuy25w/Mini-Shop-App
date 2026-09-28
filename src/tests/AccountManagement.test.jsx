import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountList from '../pages/Accounts/AccountList';
import { AuthProvider } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';


const renderAccountPage = () => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthProvider>
          <MemoryRouter>
            <AccountList />
          </MemoryRouter>
        </AuthProvider>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Account Management (AccountList, Create Admin, Reset PIN & Change Pass) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Renders accounts list with both Admin and Staff accounts', async () => {
    // 1. Seed admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      name: 'Admin Tổng',
      email: 'admin1@minishop.com',
      password: 'password123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Seed staff + staff account
    const staffRes = await staffApi.create({
      id: 'staff-acc-1',
      employeeCode: 'NV010',
      name: 'Trần Văn Nhân',
      phone: '0901112233',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await accountApi.create({
      id: 'acc-staff-10',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '123456',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByText('Quản lý tài khoản')).toBeTruthy();
      expect(screen.getByText('Admin Tổng')).toBeTruthy();
      expect(screen.getByText('Trần Văn Nhân')).toBeTruthy();
      expect(screen.getByText('Email + Mật khẩu')).toBeTruthy();
      expect(screen.getByText('Tên + PIN (6 số)')).toBeTruthy();
    });
  });

  it('Allows creating an additional Admin account from modal', async () => {
    // Seed initial admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      name: 'Admin Chính',
      email: 'admin1@minishop.com',
      password: 'password123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByText('Quản lý tài khoản')).toBeTruthy();
    });

    // Click "+ Tạo Quản trị viên mới"
    const addBtn = screen.getByRole('button', { name: /Tạo Quản trị viên mới/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tạo Quản trị viên/i })).toBeTruthy();
    });

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('admin2@minishop.com'), {
      target: { value: 'admin2@minishop.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Vd: Nguyễn Văn A'), {
      target: { value: 'Quản lý Ca Tối' }
    });
    fireEvent.change(screen.getByPlaceholderText('Tối thiểu 6 ký tự'), {
      target: { value: 'NewAdminPass123' }
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập lại mật khẩu'), {
      target: { value: 'NewAdminPass123' }
    });

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Tạo Quản trị viên' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Quản lý Ca Tối')).toBeTruthy();
      expect(screen.getByText('admin2@minishop.com')).toBeTruthy();
    });

    // Verify at DB level: employeeId is null, role is admin, name is saved directly
    const res = await accountApi.getByEmail('admin2@minishop.com');
    expect(res.data.length).toBe(1);
    expect(res.data[0].employeeId).toBeNull();
    expect(res.data[0].role).toBe('admin');
    expect(res.data[0].name).toBe('Quản lý Ca Tối');
  });

  it('Allows resetting PIN (6 digits) for a Staff account', async () => {
    const staffRes = await staffApi.create({
      id: 'staff-pin-1',
      employeeCode: 'NV020',
      name: 'Hoàng Thị Mai',
      phone: '0909998877',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const accRes = await accountApi.create({
      id: 'acc-staff-20',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '123456',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByText('Hoàng Thị Mai')).toBeTruthy();
    });

    // Click Reset PIN button for Hoàng Thị Mai
    const row = screen.getByText('Hoàng Thị Mai').closest('tr');
    const resetPinBtn = within(row).getByRole('button', { name: /Cấp lại PIN/i });
    fireEvent.click(resetPinBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Cấp lại mã PIN cho: Hoàng Thị Mai/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '888999' }
    });

    const updateBtn = screen.getByRole('button', { name: /Cập nhật/i });
    fireEvent.click(updateBtn);

    await waitFor(async () => {
      const updatedAcc = await accountApi.getById(accRes.data.id);
      expect(bcrypt.compareSync('888999', updatedAcc.data.pin)).toBe(true);
    });
  });

  it('Toggles active state and synchronizes with Staff.isActive', async () => {
    const staffRes = await staffApi.create({
      id: 'staff-sync-1',
      employeeCode: 'NV030',
      name: 'Ngô Thanh Vân',
      phone: '0911223344',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const accRes = await accountApi.create({
      id: 'acc-staff-30',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '111222',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByText('Ngô Thanh Vân')).toBeTruthy();
    });

    // Click lock button for Ngô Thanh Vân
    const row = screen.getByText('Ngô Thanh Vân').closest('tr');
    const lockBtn = within(row).getByRole('button', { name: /Khóa/i });
    fireEvent.click(lockBtn);

    await waitFor(() => {
      expect(screen.getByText('Khóa tài khoản truy cập')).toBeTruthy();
    });

    // Confirm lock (ConfirmDialog button has text "Đồng ý")
    const confirmBtn = screen.getByRole('button', { name: 'Đồng ý' });
    fireEvent.click(confirmBtn);

    await waitFor(async () => {
      const updatedAcc = await accountApi.getById(accRes.data.id);
      expect(updatedAcc.data.isActive).toBe(false);

      // Verify Staff.isActive synchronized
      const updatedStaff = await staffApi.getById(staffRes.data.id);
      expect(updatedStaff.data.isActive).toBe(false);
    });
  });
});
