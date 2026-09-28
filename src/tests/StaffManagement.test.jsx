import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StaffList from '../pages/Staff/StaffList';
import { AuthProvider } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';


const renderStaffPage = () => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthProvider>
          <MemoryRouter>
            <StaffList />
          </MemoryRouter>
        </AuthProvider>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Staff Management (StaffList, 1-Form Modal & Detail) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Renders empty state when no staff exists', async () => {
    renderStaffPage();

    await waitFor(() => {
      expect(screen.getByText('Quản lý nhân viên')).toBeTruthy();
      expect(screen.getByText(/Không tìm thấy nhân viên nào phù hợp/i)).toBeTruthy();
    });
  });

  it('Creates Staff and linked Account via single 1-form modal with 6-digit PIN', async () => {
    renderStaffPage();

    await waitFor(() => {
      expect(screen.getByText('Quản lý nhân viên')).toBeTruthy();
    });

    // Click "+ Thêm nhân viên mới"
    const addBtn = screen.getByRole('button', { name: /Thêm nhân viên mới/i });
    fireEvent.click(addBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Thêm nhân viên mới' })).toBeTruthy();
    });

    // Fill 1 form: Staff info + Account PIN
    fireEvent.change(screen.getByPlaceholderText('Vd: Nguyễn Anh'), {
      target: { value: 'Lê Hoàng Nam' }
    });
    fireEvent.change(screen.getByPlaceholderText('Vd: 0901234567'), {
      target: { value: '0912345678' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '654321' }
    });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Tạo nhân viên/i });
    fireEvent.click(submitBtn);

    // Verify staff appears in table
    await waitFor(() => {
      expect(screen.getByText('Lê Hoàng Nam')).toBeTruthy();
      expect(screen.getByText('0912345678')).toBeTruthy();
      expect(screen.getByText('NV001')).toBeTruthy();
    });

    // Verify at data level: Staff record AND Account record were both created separately
    const allStaff = await staffApi.getAll();
    expect(allStaff.data.length).toBe(1);
    const createdStaff = allStaff.data[0];
    expect(createdStaff.name).toBe('Lê Hoàng Nam');
    expect(createdStaff.employeeCode).toBeTruthy();

    const allAccounts = await accountApi.getAll();
    expect(allAccounts.data.length).toBe(1);
    const createdAccount = allAccounts.data[0];
    expect(createdAccount.employeeId).toBe(createdStaff.id);
    expect(createdAccount.role).toBe('staff');
    expect(bcrypt.compareSync('654321', createdAccount.pin)).toBe(true);
    expect(createdAccount.email).toBeNull();
  });

  it('Edits existing staff details and updates state', async () => {
    // 1. Seed staff + account
    const staffRes = await staffApi.create({
      id: 'staff-edit-1',
      employeeCode: 'NV005',
      name: 'Võ Văn C',
      phone: '0988776655',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await accountApi.create({
      id: 'acc-edit-1',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '112233',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderStaffPage();

    await waitFor(() => {
      expect(screen.getByText('Võ Văn C')).toBeTruthy();
    });

    // Click edit button for Võ Văn C
    const row = screen.getByText('Võ Văn C').closest('tr');
    const editBtn = within(row).getByRole('button', { name: /Chỉnh sửa/i });
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chỉnh sửa thông tin nhân viên' })).toBeTruthy();
      expect(screen.getByDisplayValue('Võ Văn C')).toBeTruthy();
    });

    // Change name
    fireEvent.change(screen.getByPlaceholderText('Vd: Nguyễn Anh'), {
      target: { value: 'Võ Văn C (Đã sửa)' }
    });

    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Võ Văn C (Đã sửa)')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Opens staff detail modal and displays staff & linked account info', async () => {
    const staffRes = await staffApi.create({
      id: 'staff-detail-1',
      employeeCode: 'NV009',
      name: 'Đặng Thu Thảo',
      phone: '0933221100',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await accountApi.create({
      id: 'acc-detail-1',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '998877',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    renderStaffPage();

    await waitFor(() => {
      expect(screen.getByText('Đặng Thu Thảo')).toBeTruthy();
    });

    // Click view detail (Eye icon) for Đặng Thu Thảo
    const row = screen.getByText('Đặng Thu Thảo').closest('tr');
    const viewBtn = within(row).getByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText('Hồ sơ nhân viên')).toBeTruthy();
      expect(screen.getByText('Thông tin tài khoản đăng nhập (Account)')).toBeTruthy();
      expect(screen.getByText('acc-detail-1')).toBeTruthy();
    });
  });

  it('Allows staff to login successfully immediately after being created by admin', async () => {
    // 1. Render Staff management page
    renderStaffPage();

    await waitFor(() => {
      expect(screen.getByText('Quản lý nhân viên')).toBeTruthy();
    });

    // 2. Admin opens "+ Thêm nhân viên mới" modal and fills form
    const addBtn = screen.getByRole('button', { name: /Thêm nhân viên mới/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Thêm nhân viên mới' })).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('Vd: Nguyễn Anh'), {
      target: { value: 'Thiên Dũng' }
    });
    fireEvent.change(screen.getByPlaceholderText('Vd: 0901234567'), {
      target: { value: '0912345678' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '123456' }
    });

    const submitBtn = screen.getByRole('button', { name: /Tạo nhân viên/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Thiên Dũng')).toBeTruthy();
    });

    // 3. Verify that Account.employeeId matches the actual created Staff.id
    const allStaff = await staffApi.getAll();
    const createdStaff = allStaff.data.find(s => s.name === 'Thiên Dũng');
    expect(createdStaff).toBeTruthy();
    expect(createdStaff.id).toBeTruthy();

    const allAccounts = await accountApi.getAll();
    const createdAcc = allAccounts.data.find(a => String(a.employeeId) === String(createdStaff.id));
    expect(createdAcc).toBeTruthy();
    expect(createdAcc.employeeId).toBe(createdStaff.id);
    expect(bcrypt.compareSync('123456', createdAcc.pin)).toBe(true);
    expect(createdAcc.role).toBe('staff');
  });
});
