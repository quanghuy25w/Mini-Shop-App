import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { staffApi } from '../api/staffApi';


describe('Staff Entity API & LocalStorage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Initializes staff storage in demo mode', async () => {
    const res = await staffApi.getAll();
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBe(0);
  });

  it('Performs CRUD operations on Staff entity', async () => {
    const newStaff = {
      id: 'staff-001',
      employeeCode: 'NV001',
      name: 'Nguyễn Văn A',
      phone: '0901234567',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // CREATE
    const createRes = await staffApi.create(newStaff);
    expect(createRes.data.id).toBe('staff-001');
    expect(createRes.data.employeeCode).toBe('NV001');
    expect(createRes.data.employmentStatus).toBe('working');

    // GET ALL
    const allRes = await staffApi.getAll();
    expect(allRes.data.length).toBe(1);
    expect(allRes.data[0].name).toBe('Nguyễn Văn A');

    // GET BY ID
    const getRes = await staffApi.getById('staff-001');
    expect(getRes.data.name).toBe('Nguyễn Văn A');

    // UPDATE / PUT
    const updatedStaff = { ...newStaff, name: 'Nguyễn Văn B' };
    const updateRes = await staffApi.update('staff-001', updatedStaff);
    expect(updateRes.data.name).toBe('Nguyễn Văn B');

    // PATCH (e.g. status change)
    const patchRes = await staffApi.patch('staff-001', { employmentStatus: 'on_leave', isActive: false });
    expect(patchRes.data.employmentStatus).toBe('on_leave');
    expect(patchRes.data.isActive).toBe(false);

    // SOFT DELETE
    const softRes = await staffApi.softDelete('staff-001');
    expect(softRes.data.employmentStatus).toBe('resigned');
    expect(softRes.data.isActive).toBe(false);
  });

  it('Generates sequential employee codes (NV001, NV002, ...)', async () => {
    const code1 = await staffApi.generateEmployeeCode();
    expect(code1).toBe('NV001');

    await staffApi.create({
      id: 's-1',
      employeeCode: 'NV001',
      name: 'Nhân viên 1',
      phone: '0912345678',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const code2 = await staffApi.generateEmployeeCode();
    expect(code2).toBe('NV002');
  });
});
