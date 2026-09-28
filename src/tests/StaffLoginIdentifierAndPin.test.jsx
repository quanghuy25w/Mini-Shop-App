import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import StaffLogin from '../pages/Login/StaffLogin';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';


const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('Staff Login Identifier & PIN Resolution Tests (Issue #1)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  // =========================================================================
  // PASS TESTS
  // =========================================================================

  it('PASS: Employee Code + correct PIN logs in successfully', async () => {
    const s1 = await staffApi.create({
      id: 'staff-nv1',
      employeeCode: 'NV001',
      name: 'Nguyễn Văn A',
      phone: '0901111111',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-nv1',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        employeeCode: 'NV001',
        pin: '123456'
      });
    });

    expect(res.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUser.name).toBe('Nguyễn Văn A');
    expect(result.current.currentUser.employeeCode).toBe('NV001');
    expect(result.current.currentUser.employeeId).toBe('staff-nv1');
  });

  it('PASS: Employee Name + correct PIN logs in successfully', async () => {
    const s1 = await staffApi.create({
      id: 'staff-nv1',
      employeeCode: 'NV001',
      name: 'Nguyễn Văn A',
      phone: '0901111111',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-nv1',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        name: 'Nguyễn Văn A',
        pin: '123456'
      });
    });

    expect(res.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUser.name).toBe('Nguyễn Văn A');
    expect(result.current.currentUser.employeeCode).toBe('NV001');
    expect(result.current.currentUser.employeeId).toBe('staff-nv1');
  });

  it('PASS: Duplicate name + first employee PIN -> logs into first account', async () => {
    // NV001 - Anh - PIN 123456
    const s1 = await staffApi.create({
      id: 'staff-001',
      employeeCode: 'NV001',
      name: 'Anh',
      phone: '0901000001',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working'
    });
    await accountApi.create({
      id: 'acc-001',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    // NV002 - Anh - PIN 654321
    const s2 = await staffApi.create({
      id: 'staff-002',
      employeeCode: 'NV002',
      name: 'Anh',
      phone: '0901000002',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working'
    });
    await accountApi.create({
      id: 'acc-002',
      employeeId: s2.data.id,
      role: 'staff',
      pin: '654321',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        name: 'Anh',
        pin: '123456'
      });
    });

    expect(res.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUser.name).toBe('Anh');
    expect(result.current.currentUser.employeeCode).toBe('NV001');
    expect(result.current.currentUser.employeeId).toBe('staff-001');
    expect(result.current.currentUser.id).toBe('acc-001');
  });

  it('PASS: Duplicate name + second employee PIN -> logs into second account', async () => {
    // NV001 - Anh - PIN 123456
    const s1 = await staffApi.create({
      id: 'staff-001',
      employeeCode: 'NV001',
      name: 'Anh',
      phone: '0901000001',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working'
    });
    await accountApi.create({
      id: 'acc-001',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    // NV002 - Anh - PIN 654321
    const s2 = await staffApi.create({
      id: 'staff-002',
      employeeCode: 'NV002',
      name: 'Anh',
      phone: '0901000002',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working'
    });
    await accountApi.create({
      id: 'acc-002',
      employeeId: s2.data.id,
      role: 'staff',
      pin: '654321',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        name: 'Anh',
        pin: '654321'
      });
    });

    expect(res.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUser.name).toBe('Anh');
    expect(result.current.currentUser.employeeCode).toBe('NV002');
    expect(result.current.currentUser.employeeId).toBe('staff-002');
    expect(result.current.currentUser.id).toBe('acc-002');
  });

  // =========================================================================
  // FAIL TESTS
  // =========================================================================

  it('FAIL: Employee Code + wrong PIN fails', async () => {
    const s1 = await staffApi.create({
      id: 'staff-nv1',
      employeeCode: 'NV001',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-nv1',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        employeeCode: 'NV001',
        pin: '654321'
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('không chính xác');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('FAIL: Employee Name + wrong PIN fails', async () => {
    const s1 = await staffApi.create({
      id: 'staff-nv1',
      employeeCode: 'NV001',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-nv1',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        name: 'Anh',
        pin: '999999'
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('không chính xác');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('FAIL: Non-existing employee code fails', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        employeeCode: 'NV999',
        pin: '123456'
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Không tìm thấy nhân viên');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('FAIL: Non-existing employee name fails', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        name: 'Người Không Tồn Tại',
        pin: '123456'
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Không tìm thấy nhân viên');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('FAIL: Empty identifier fails', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        employeeCode: '',
        pin: '123456'
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Vui lòng nhập/i);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('FAIL: Empty PIN fails', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        employeeCode: 'NV001',
        pin: ''
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Mã PIN');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('FAIL: Duplicate name + PIN belonging to neither employee fails', async () => {
    const s1 = await staffApi.create({
      id: 'staff-001',
      employeeCode: 'NV001',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-001',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    const s2 = await staffApi.create({
      id: 'staff-002',
      employeeCode: 'NV002',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-002',
      employeeId: s2.data.id,
      role: 'staff',
      pin: '654321',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        name: 'Anh',
        pin: '888888'
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('không chính xác');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('FAIL: Duplicate name + same PIN on multiple accounts rejects without silently selecting one', async () => {
    const s1 = await staffApi.create({
      id: 'staff-001',
      employeeCode: 'NV001',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-001',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    const s2 = await staffApi.create({
      id: 'staff-002',
      employeeCode: 'NV002',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-002',
      employeeId: s2.data.id,
      role: 'staff',
      pin: '123456', // Identical PIN
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let res;
    await act(async () => {
      res = await result.current.loginStaff({
        name: 'Anh',
        pin: '123456'
      });
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('trùng lặp');
    expect(result.current.isAuthenticated).toBe(false);
  });

  // =========================================================================
  // UI COMPONENT INTEGRATION
  // =========================================================================

  it('UI: Allows Staff login with Name + PIN resolving duplicate name accurately', async () => {
    // Setup 2 staff with same name "Anh"
    const s1 = await staffApi.create({
      id: 'staff-ui-1',
      employeeCode: 'NV001',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-ui-1',
      employeeId: s1.data.id,
      role: 'staff',
      pin: '111222',
      isActive: true
    });

    const s2 = await staffApi.create({
      id: 'staff-ui-2',
      employeeCode: 'NV002',
      name: 'Anh',
      isActive: true
    });
    await accountApi.create({
      id: 'acc-ui-2',
      employeeId: s2.data.id,
      role: 'staff',
      pin: '333444',
      isActive: true
    });

    let currentAuth;
    const TestComponent = () => {
      currentAuth = useAuth();
      return (
        <MemoryRouter>
          <StaffLogin />
        </MemoryRouter>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Enter name "Anh" and second employee's PIN "333444"
    fireEvent.change(screen.getByPlaceholderText('Vd: NV001'), {
      target: { value: 'Anh' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: '333444' }
    });

    fireEvent.click(screen.getByRole('button', { name: /BẮT ĐẦU CA LÀM VIỆC/i }));

    await waitFor(() => {
      expect(currentAuth.isAuthenticated).toBe(true);
      expect(currentAuth.currentUser.employeeCode).toBe('NV002');
      expect(currentAuth.currentUser.name).toBe('Anh');
    });
  });
});
