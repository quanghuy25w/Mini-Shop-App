import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { accountApi } from '../api/accountApi';

import { validatePin, validateEmail, validatePassword } from '../utils/validate';

describe('Account Entity API & LocalStorage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Initializes account storage in demo mode', async () => {
    const res = await accountApi.getAll();
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBe(0);
  });

  it('Checks hasAdmin correctly when empty and when admin exists', async () => {
    expect(await accountApi.hasAdmin()).toBe(false);

    // Create Admin account (employeeId is null)
    await accountApi.create({
      id: 'acc-admin-1',
      employeeId: null,
      role: 'admin',
      email: 'admin@gmail.com',
      password: 'password123',
      pin: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    expect(await accountApi.hasAdmin()).toBe(true);
  });

  it('Performs CRUD operations for Staff Account with 6-digit PIN', async () => {
    const staffAccount = {
      id: 'acc-staff-1',
      employeeId: 'staff-001',
      role: 'staff',
      email: null,
      password: null,
      pin: '123456',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // CREATE
    const createRes = await accountApi.create(staffAccount);
    expect(createRes.data.role).toBe('staff');
    expect(createRes.data.employeeId).toBe('staff-001');
    expect(bcrypt.compareSync('123456', createRes.data.pin)).toBe(true);

    // GET BY EMPLOYEE ID
    const byEmp = await accountApi.getByEmployeeId('staff-001');
    expect(byEmp.data.length).toBe(1);
    expect(byEmp.data[0].id).toBe('acc-staff-1');

    // UPDATE PIN with 6 digits
    await accountApi.updatePin('acc-staff-1', '654321');
    const updatedAcc = await accountApi.getById('acc-staff-1');
    expect(bcrypt.compareSync('654321', updatedAcc.data.pin)).toBe(true);

    // REJECT invalid PIN length
    await expect(accountApi.updatePin('acc-staff-1', '12345')).rejects.toThrow('Mã PIN phải đúng 6 chữ số');
    await expect(accountApi.updatePin('acc-staff-1', 'abcdef')).rejects.toThrow('Mã PIN phải đúng 6 chữ số');
  });

  it('Validates PIN correctly with validatePin', () => {
    expect(validatePin('123456')).toBeNull();
    expect(validatePin('000000')).toBeNull();
    expect(validatePin('999999')).toBeNull();
    expect(validatePin('12345')).toBe('Mã PIN bắt buộc phải đúng 6 chữ số');
    expect(validatePin('1234567')).toBe('Mã PIN bắt buộc phải đúng 6 chữ số');
    expect(validatePin('12345a')).toBe('Mã PIN bắt buộc phải đúng 6 chữ số');
    expect(validatePin('')).toBe('Mã PIN không được để trống');
    expect(validatePin(null)).toBe('Mã PIN không được để trống');
  });

  it('Validates Email and Password correctly', () => {
    expect(validateEmail('admin@gmail.com')).toBeNull();
    expect(validateEmail('invalid-email')).toBe('Email không đúng định dạng');
    expect(validateEmail('')).toBe('Email không được để trống');

    expect(validatePassword('123456')).toBeNull();
    expect(validatePassword('12345')).toBe('Mật khẩu phải có ít nhất 6 ký tự');
    expect(validatePassword('')).toBe('Mật khẩu không được để trống');
  });
});
