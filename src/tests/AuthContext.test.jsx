import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';


const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext & Authentication Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Initializes with hasAdmin = false and unauthenticated state when DB has no admins', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshAuthState();
    });

    expect(result.current.hasAdmin).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
  });

  it('Allows setting up the first Admin and auto-logs in without storing password in session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let setupRes;
    await act(async () => {
      setupRes = await result.current.setupFirstAdmin({
        email: 'admin@minishop.com',
        password: 'AdminPassword123',
        name: 'Chủ Cửa Hàng'
      });
    });

    expect(setupRes.success).toBe(true);
    expect(result.current.hasAdmin).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.currentUser.email).toBe('admin@minishop.com');
    expect(result.current.currentUser.employeeId).toBeNull();

    // Verify session persisted to localStorage does NOT contain password or pin
    const saved = JSON.parse(localStorage.getItem('minishop_auth_session') || '[]');
    expect(saved.email).toBe('admin@minishop.com');
    expect(saved.role).toBe('admin');
    expect(saved.password).toBeUndefined();
    expect(saved.pin).toBeUndefined();
  });

  it('Prevents setting up another first Admin if an Admin already exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.setupFirstAdmin({
        email: 'admin1@minishop.com',
        password: 'AdminPassword123'
      });
    });

    let secondSetup;
    await act(async () => {
      secondSetup = await result.current.setupFirstAdmin({
        email: 'admin2@minishop.com',
        password: 'AdminPassword456'
      });
    });

    expect(secondSetup.success).toBe(false);
    expect(secondSetup.error).toContain('đã có Quản trị viên');
  });

  it('Authenticates Admin with email and password, does not store password in session', async () => {
    // 1. Create an admin
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@shop.com',
      password: 'mypassword',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // 2. Login with wrong password
    let failedRes;
    await act(async () => {
      failedRes = await result.current.loginAdmin({
        email: 'admin@shop.com',
        password: 'wrongpassword'
      });
    });
    expect(failedRes.success).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);

    // 3. Login with correct password
    let successRes;
    await act(async () => {
      successRes = await result.current.loginAdmin({
        email: 'admin@shop.com',
        password: 'mypassword'
      });
    });
    expect(successRes.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isStaff).toBe(false);
    expect(result.current.currentUser.role).toBe('admin');

    // Verify localStorage session has no password
    const saved = JSON.parse(localStorage.getItem('minishop_auth_session') || '[]');
    expect(saved.password).toBeUndefined();
    expect(saved.pin).toBeUndefined();
  });

  it('Authenticates Staff with Name + 6-digit PIN, does not store PIN in session', async () => {
    // 1. Create Staff record
    const staffRes = await staffApi.create({
      id: 'staff-101',
      employeeCode: 'NV001',
      name: 'Nguyễn Anh',
      phone: '0988888888',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Create Staff Account
    await accountApi.create({
      id: 'acc-staff-101',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '123456',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // 3. Login with wrong PIN
    let wrongPinRes;
    await act(async () => {
      wrongPinRes = await result.current.loginStaff({
        name: 'Nguyễn Anh',
        pin: '654321'
      });
    });
    expect(wrongPinRes.success).toBe(false);
    expect(wrongPinRes.error).toContain('không chính xác');

    // 4. Login with invalid PIN length
    let invalidLenRes;
    await act(async () => {
      invalidLenRes = await result.current.loginStaff({
        name: 'Nguyễn Anh',
        pin: '12345'
      });
    });
    expect(invalidLenRes.success).toBe(false);
    expect(invalidLenRes.error).toContain('6 chữ số');

    // 5. Login with correct Name + 6-digit PIN
    let loginOkRes;
    await act(async () => {
      loginOkRes = await result.current.loginStaff({
        name: 'Nguyễn Anh',
        pin: '123456'
      });
    });
    expect(loginOkRes.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isStaff).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.currentUser.name).toBe('Nguyễn Anh');
    expect(result.current.currentUser.employeeCode).toBe('NV001');
    expect(result.current.currentUser.employeeId).toBe('staff-101');

    // Verify localStorage session has no PIN or password
    const saved = JSON.parse(localStorage.getItem('minishop_auth_session') || '[]');
    expect(saved.pin).toBeUndefined();
    expect(saved.password).toBeUndefined();
  });

  it('Rejects Staff login only when isActive is false, employmentStatus is purely descriptive', async () => {
    const staffRes = await staffApi.create({
      id: 'staff-102',
      employeeCode: 'NV002',
      name: 'Trần Bình',
      phone: '0977777777',
      hireDate: '2026-08-01',
      isActive: false, // Inactive
      employmentStatus: 'resigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await accountApi.create({
      id: 'acc-staff-102',
      employeeId: staffRes.data.id,
      role: 'staff',
      email: null,
      password: null,
      pin: '654321',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let loginRes;
    await act(async () => {
      loginRes = await result.current.loginStaff({
        name: 'Trần Bình',
        pin: '654321'
      });
    });

    expect(loginRes.success).toBe(false);
    expect(loginRes.error).toContain('không hoạt động');
  });

  it('Logs out and clears session from localStorage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.setupFirstAdmin({
        email: 'owner@shop.com',
        password: 'Password123'
      });
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('minishop_auth_session')).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(localStorage.getItem('minishop_auth_session')).toBeNull();
  });
});
