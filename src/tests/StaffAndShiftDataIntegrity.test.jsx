import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { workSessionApi } from '../api/workSessionApi';
import { staffApi } from '../api/staffApi';
import { renderHook, act } from '@testing-library/react';
import useStaff from '../hooks/useStaff';
import { AuthContext } from '../context/AuthContext';

import * as registerConfig from '../utils/registerConfig';

describe('Staff and Shift Data Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Case 1: Shift computes and persists isEarly correctly', async () => {
    // 07:15 VN time is early (before 07:30)
    const earlyTime = new Date('2023-10-10T07:15:00+07:00');
    const { workSession, isEarly: earlyIsEarly, isLate: earlyIsLate, lateMinutes: earlyLate } = await workSessionApi.getOrCreateWorkSession(earlyTime, false);
    
    expect(earlyIsEarly).toBe(true);

    const member1Res = await workSessionApi.createMember({
      workSessionId: workSession.id,
      accountId: 'acc-1',
      shiftType: 'morning',
      businessDate: '2023-10-10',
      attendanceStatus: 'present',
      checkInTime: earlyTime.toISOString(),
      isLate: earlyIsLate,
      lateMinutes: earlyLate,
      isEarly: earlyIsEarly
    });
    
    const dbMember1 = await workSessionApi.getMemberById(member1Res.data.id);
    expect(dbMember1.data.isEarly).toBe(true);

    // 07:35 VN time is not early
    const lateTime = new Date('2023-10-10T07:35:00+07:00');
    const { isEarly: lateIsEarly, isLate: lateIsLate, lateMinutes: lateLate } = await workSessionApi.getOrCreateWorkSession(lateTime, false);
    
    expect(lateIsEarly).toBe(false);

    const member2Res = await workSessionApi.createMember({
      workSessionId: workSession.id,
      accountId: 'acc-2',
      shiftType: 'morning',
      businessDate: '2023-10-10',
      attendanceStatus: 'present',
      checkInTime: lateTime.toISOString(),
      isLate: lateIsLate,
      lateMinutes: lateLate,
      isEarly: lateIsEarly
    });

    const dbMember2 = await workSessionApi.getMemberById(member2Res.data.id);
    expect(dbMember2.data.isEarly).toBe(false);
  });

  it('Case 2: Cash reconciliation matches registerConfig exactly without hardcoding', async () => {
    // We will verify that closing a session uses the REGISTERS from config.
    // We can spy on axiosClient.patch when closeSession is called and check posBreakdown keys.
    const axiosClient = (await import('../api/axiosClient')).default;
    const patchSpy = vi.spyOn(axiosClient, 'patch');

    const now = new Date('2023-10-11T09:00:00+07:00');
    const { workSession } = await workSessionApi.getOrCreateWorkSession(now, true);
    
    // Close the session
    await workSessionApi.closeSession(workSession.id, { actualCash: 0, closeNote: 'Test', actor: { id: 'admin1', role: 'admin' } });
    
    const patchCall = patchSpy.mock.calls.find(call => call[0] === `/workSessions/${workSession.id}` && call[1].status === 'closed');
    expect(patchCall).toBeDefined();
    
    const posBreakdownKeys = Object.keys(patchCall[1].posBreakdown).sort();
    const activeRegistersFromConfig = registerConfig.REGISTERS.filter(r => r.isActive).map(r => r.id).sort();
    
    expect(posBreakdownKeys).toEqual(activeRegistersFromConfig);
  });

  it('Case 3: toggleStaffActive correctly syncs employmentStatus', async () => {
    const adminActor = { id: 'admin-1', role: 'admin' };
    
    // Create a staff member
    const res = await staffApi.create({
      id: 'staff-test-toggle',
      employeeCode: 'NVTEST',
      name: 'Test Staff',
      isActive: true,
      employmentStatus: 'working'
    }, adminActor);
    const staffId = res.data.id;

    // We will use renderHook with a mocked AuthContext providing the admin user
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ currentUser: adminActor }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useStaff(), { wrapper });

    // 1. Deactivate
    await act(async () => {
      await result.current.toggleStaffActive(staffId, true);
    });

    // Verify DB
    let dbStaff = await staffApi.getById(staffId);
    expect(dbStaff.data.isActive).toBe(false);
    expect(dbStaff.data.employmentStatus).toBe('resigned');

    // 2. Reactivate
    await act(async () => {
      await result.current.toggleStaffActive(staffId, false);
    });

    // Verify DB
    dbStaff = await staffApi.getById(staffId);
    expect(dbStaff.data.isActive).toBe(true);
    expect(dbStaff.data.employmentStatus).toBe('working');
  });
});
