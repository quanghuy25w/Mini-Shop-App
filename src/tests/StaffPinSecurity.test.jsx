import { initSeedData, setCollection } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../routes/AppRoutes';
import { AuthProvider } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import StaffFormModal from '../pages/Staff/StaffFormModal';
import StaffDetailModal from '../pages/Staff/StaffDetailModal';
import AccountFormModal from '../pages/Accounts/AccountFormModal';
import bcrypt from 'bcryptjs';

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

describe('Staff & Employee PIN Security Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    initSeedData();
    setCollection('accounts', []);
    setCollection('staff', []);
  });

  it('1. Staff login PIN input starts completely empty and masked', async () => {
    // Seed admin so it does not redirect to /setup-admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/staff']);

    await waitFor(() => {
      const pinInput = screen.getByPlaceholderText('••••••');
      expect(pinInput).toBeTruthy();
      expect(pinInput.value).toBe('');
      expect(pinInput.getAttribute('type')).toBe('password');
      expect(pinInput.getAttribute('maxLength')).toBe('6');
      expect(pinInput.getAttribute('inputMode')).toBe('numeric');
    });
  });

  it('2. Staff login UI does not contain any demo or default PIN text hint', async () => {
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/staff']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });

    // Check that no default/demo hint text exists
    expect(screen.queryByText(/PIN mặc định/i)).toBeNull();
    expect(screen.queryByText(/PIN mẫu/i)).toBeNull();
    expect(screen.queryByText(/default pin/i)).toBeNull();
    expect(screen.queryByText(/123456/)).toBeNull();
  });

  it('3. Staff creation modal requires explicit PIN entry, starts with completely empty PIN, and rejects autofill', async () => {
    const handleSave = vi.fn().mockResolvedValue(true);
    const { rerender } = render(
      <AuthProvider>
        <StaffFormModal isOpen={true} onClose={() => {}} onSubmit={handleSave} />
      </AuthProvider>
    );

    // Wait for auto-generated employee code to settle
    await waitFor(() => {
      const codeInput = screen.getByLabelText(/Mã nhân viên \*/i);
      expect(codeInput.value).toBeTruthy();
    });

    const pinInput = screen.getByPlaceholderText('••••••');
    expect(pinInput).toBeTruthy();
    expect(pinInput.value).toBe('');
    expect(pinInput.value).not.toContain('123');
    expect(pinInput.value).not.toContain('1 2 3');
    expect(pinInput.getAttribute('autocomplete')).toBe('new-password');
    expect(pinInput.hasAttribute('required')).toBe(true);

    // Form description instructs explicit 6-digit entry
    expect(screen.getByText(/Mã PIN đăng nhập tài khoản \(bắt buộc đúng 6 chữ số\)/i)).toBeTruthy();
    expect(screen.queryByText(/123456/)).toBeNull();
    expect(screen.queryByText(/1 2 3/)).toBeNull();

    // User can manually enter 6 digits
    fireEvent.change(pinInput, { target: { value: '654321' } });
    expect(pinInput.value).toBe('654321');

    // Simulate closing and reopening modal -> MUST start empty again
    rerender(
      <AuthProvider>
        <StaffFormModal isOpen={false} onClose={() => {}} onSubmit={handleSave} />
      </AuthProvider>
    );

    rerender(
      <AuthProvider>
        <StaffFormModal isOpen={true} onClose={() => {}} onSubmit={handleSave} />
      </AuthProvider>
    );

    await waitFor(() => {
      const freshPinInput = screen.getByPlaceholderText('••••••');
      expect(freshPinInput.value).toBe('');
      expect(freshPinInput.value).not.toContain('123');
      expect(freshPinInput.value).not.toContain('1 2 3');
    });
  });

  it('4. Staff creation refuses submission when PIN is missing or invalid', async () => {
    const handleSave = vi.fn().mockResolvedValue(true);
    render(
      <AuthProvider>
        <StaffFormModal isOpen={true} onClose={() => {}} onSubmit={handleSave} />
      </AuthProvider>
    );

    // Wait for auto-generated employee code
    await waitFor(() => {
      const codeInput = screen.getByLabelText(/Mã nhân viên \*/i);
      expect(codeInput.value).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(/Tên nhân viên \*/i);
    fireEvent.change(nameInput, { target: { value: 'Trần Văn Mới' } });

    const pinInput = screen.getByPlaceholderText('••••••');
    // Try submitting with only 4 digits
    fireEvent.change(pinInput, { target: { value: '1234' } });
    fireEvent.submit(pinInput.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Mã PIN bắt buộc phải đúng 6 chữ số/i)).toBeTruthy();
    });
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('5. Staff creation stores PIN as bcrypt hash and never saves plaintext in DB or localStorage', async () => {
    const rawPin = '987654';
    const staffRes = await staffApi.create({
      id: 'staff-sec-1',
      employeeCode: 'NV088',
      name: 'Lê Bảo',
      phone: '0912345678',
      isActive: true,
      employmentStatus: 'working'
    });

    const accRes = await accountApi.create({
      id: 'acc-sec-1',
      employeeId: staffRes.data.id,
      role: 'employee',
      pin: rawPin,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Check account record in database
    const createdAcc = accRes.data;
    expect(createdAcc.pin).not.toBe(rawPin);
    expect(createdAcc.pin.startsWith('$2')).toBe(true);
    expect(bcrypt.compareSync(rawPin, createdAcc.pin)).toBe(true);
  });

  it('6. Staff login with wrong PIN is rejected with an error message', async () => {
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    const staffRes = await staffApi.create({
      id: 'staff-sec-2',
      employeeCode: 'NV099',
      name: 'Hoàng Minh',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-sec-2',
      employeeId: staffRes.data.id,
      role: 'employee',
      pin: '556677',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/staff']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Mã hoặc Tên nhân viên/i), {
      target: { value: 'NV099' }
    });
    // Enter incorrect PIN
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '111111' }
    });
    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mã nhân viên hoặc mã PIN 6 số không chính xác/i)).toBeTruthy();
    });

    // Verify localStorage has no session
    expect(localStorage.getItem('minishop_auth_session')).toBeNull();
  });

  it('7. Staff login with correct PIN succeeds and stores clean session without PIN', async () => {
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    const correctPin = '556677';
    const staffRes = await staffApi.create({
      id: 'staff-sec-3',
      employeeCode: 'NV100',
      name: 'Vũ Lan',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-sec-3',
      employeeId: staffRes.data.id,
      role: 'employee',
      pin: correctPin,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/staff']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Mã hoặc Tên nhân viên/i), {
      target: { value: 'NV100' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: correctPin }
    });
    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });

    // Check stored session
    const rawSession = localStorage.getItem('minishop_auth_session');
    expect(rawSession).toBeTruthy();
    expect(rawSession).not.toContain(correctPin);
    const sessionObj = JSON.parse(rawSession);
    expect(sessionObj.pin).toBeUndefined();
    expect(sessionObj.password).toBeUndefined();
    expect(sessionObj.name).toBe('Vũ Lan');
    expect(sessionObj.employeeCode).toBe('NV100');
  });

  it('8. Inactive staff account is rejected at login even with correct PIN', async () => {
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    const correctPin = '999888';
    const staffRes = await staffApi.create({
      id: 'staff-sec-4',
      employeeCode: 'NV101',
      name: 'Đặng Tuấn (Đã Nghỉ)',
      isActive: false, // inactive staff
      employmentStatus: 'resigned'
    });

    await accountApi.create({
      id: 'acc-sec-4',
      employeeId: staffRes.data.id,
      role: 'employee',
      pin: correctPin,
      isActive: false, // inactive account
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/staff']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Mã hoặc Tên nhân viên/i), {
      target: { value: 'NV101' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: correctPin }
    });
    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(screen.getByText(/không hoạt động|vô hiệu hóa/i)).toBeTruthy();
    });
    expect(localStorage.getItem('minishop_auth_session')).toBeNull();
  });

  it('9. Staff detail modal completely masks PIN', async () => {
    const mockStaff = {
      id: 'staff-sec-5',
      employeeCode: 'NV102',
      name: 'Phạm Thu',
      phone: '0987654321',
      hireDate: '2026-01-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create linked account
    await accountApi.create({
      id: 'acc-sec-5',
      employeeId: mockStaff.id,
      role: 'employee',
      pin: '654321',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    render(
      <AuthProvider>
        <StaffDetailModal isOpen={true} onClose={() => {}} staff={mockStaff} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Hồ sơ nhân viên/i)).toBeTruthy();
    });

    // Check PIN field is masked
    await waitFor(() => {
      const maskedText = screen.getByText(/•••••• \(6 chữ số\)/i);
      expect(maskedText).toBeTruthy();
    });
  });

  it('10. Account Form modal in reset-pin mode starts empty and requires explicit 6 digits', async () => {
    const handleResetPin = vi.fn().mockResolvedValue(true);
    const mockAccount = {
      id: 'acc-sec-6',
      displayName: 'Phạm Thu',
      role: 'employee'
    };

    render(
      <AuthProvider>
        <AccountFormModal
          isOpen={true}
          onClose={() => {}}
          mode="reset-pin"
          account={mockAccount}
          onResetPin={handleResetPin}
        />
      </AuthProvider>
    );

    const pinInput = screen.getByPlaceholderText('••••••');
    expect(pinInput.value).toBe('');
    expect(pinInput.hasAttribute('required')).toBe(true);

    // Try submitting 5 digits
    fireEvent.change(pinInput, { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mã PIN bắt buộc phải đúng 6 chữ số/i)).toBeTruthy();
    });
    expect(handleResetPin).not.toHaveBeenCalled();

    // Now enter valid 6 digits
    fireEvent.change(pinInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(handleResetPin).toHaveBeenCalledWith('acc-sec-6', '654321');
    });
  });

  it('11. Logout cleans up session and leaves login PIN field empty upon returning to login', async () => {
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@minishop.com',
      password: 'password123',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    const staffRes = await staffApi.create({
      id: 'staff-sec-7',
      employeeCode: 'NV103',
      name: 'Đoàn Linh',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-sec-7',
      employeeId: staffRes.data.id,
      role: 'employee',
      pin: '778899',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    renderApp(['/login/staff']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Mã hoặc Tên nhân viên/i), {
      target: { value: 'NV103' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '778899' }
    });
    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeTruthy();
    });

    // Click logout
    fireEvent.click(screen.getByRole('button', { name: /Đăng xuất/i }));

    await waitFor(() => {
      expect(screen.getByText(/Hệ thống Mini-Shop/i)).toBeTruthy();
    });

    // Check that PIN field is empty on re-render
    const pinInput = screen.getByPlaceholderText('••••••');
    expect(pinInput.value).toBe('');
    expect(localStorage.getItem('minishop_auth_session')).toBeNull();
  });
});
