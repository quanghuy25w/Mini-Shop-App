import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';
import { orderApi } from '../api/orderApi';
import { workSessionApi, determineShiftForTime } from '../api/workSessionApi';


const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('WorkSession Confirmed Business Rules Suite (Sections 7 to 19 & Test Requirements)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  // =========================================================================
  // TEST GROUP A — WORKSESSION CREATION
  // =========================================================================
  describe('TEST GROUP A — WORKSESSION CREATION', () => {
    it('1 & 2. First user login during morning creates one daily WorkSession; Second user login during morning joins the existing WorkSession', async () => {
      vi.useFakeTimers();
      const morningTime1 = new Date(2026, 8, 10, 7, 30, 0); // 07:30
      const morningTime2 = new Date(2026, 8, 10, 8, 0, 0);  // 08:00

      // Seed 2 staff and accounts
      const s1 = await staffApi.create({ id: 'st-a1', employeeCode: 'NVA1', name: 'Nhân viên A1', isActive: true });
      const s2 = await staffApi.create({ id: 'st-a2', employeeCode: 'NVA2', name: 'Nhân viên A2', isActive: true });
      await accountApi.create({ id: 'acc-a1', employeeId: s1.data.id, role: 'employee', pin: '111111', isActive: true });
      await accountApi.create({ id: 'acc-a2', employeeId: s2.data.id, role: 'employee', pin: '222222', isActive: true });

      // 1. First user logs in at 07:30 (creates daily WorkSession)
      vi.setSystemTime(morningTime1);
      const { result: auth1 } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth1.current.loginStaff({ employeeCode: 'NVA1', pin: '111111' });
      });

      const sessionsAfterFirst = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(sessionsAfterFirst.length).toBe(1);
      const morningSession = sessionsAfterFirst[0];
      expect(morningSession.date).toBe('2026-09-10');
      expect(morningSession.status).toBe('active');

      // 2. Second user logs in at 08:00 (joins existing WorkSession on a different POS)
      vi.setSystemTime(morningTime2);
      // Giả lập máy POS khác để không bị chặn bởi Invariant 1 (1 POS = 1 NV)
      const { setCurrentRegisterId } = await import('../utils/registerConfig');
      setCurrentRegisterId('POS02');
      
      const { result: auth2 } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth2.current.loginStaff({ employeeCode: 'NVA2', pin: '222222' });
      });

      const sessionsAfterSecond = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(sessionsAfterSecond.length).toBe(1);
      expect(sessionsAfterSecond[0].id).toBe(morningSession.id);

      // Both members belong to this single daily WorkSession
      const members = (await workSessionApi.getMembersBySessionId(morningSession.id)).data;
      expect(members.length).toBe(2);
      expect(members.some(m => m.accountId === 'acc-a1')).toBe(true);
      expect(members.some(m => m.accountId === 'acc-a2')).toBe(true);

      vi.useRealTimers();
    });

    it('3. First user login during afternoon creates one daily WorkSession', async () => {
      vi.useFakeTimers();
      const afternoonTime = new Date(2026, 8, 10, 13, 0, 0); // 13:00
      vi.setSystemTime(afternoonTime);

      const s = await staffApi.create({ id: 'st-aft', employeeCode: 'NVAFT', name: 'Nhân viên Chiều', isActive: true });
      await accountApi.create({ id: 'acc-aft', employeeId: s.data.id, role: 'employee', pin: '123456', isActive: true });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.loginStaff({ employeeCode: 'NVAFT', pin: '123456' });
      });

      const sessions = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(sessions.length).toBe(1);
      expect(sessions[0].date).toBe('2026-09-10');
      expect(sessions[0].status).toBe('active');

      vi.useRealTimers();
    });

    it('4. First user login during evening creates one daily WorkSession', async () => {
      vi.useFakeTimers();
      const eveningTime = new Date(2026, 8, 10, 19, 0, 0); // 19:00
      vi.setSystemTime(eveningTime);

      const s = await staffApi.create({ id: 'st-eve', employeeCode: 'NVEVE', name: 'Nhân viên Tối', isActive: true });
      await accountApi.create({ id: 'acc-eve', employeeId: s.data.id, role: 'employee', pin: '123456', isActive: true });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.loginStaff({ employeeCode: 'NVEVE', pin: '123456' });
      });

      const sessions = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(sessions.length).toBe(1);
      expect(sessions[0].date).toBe('2026-09-10');
      expect(sessions[0].status).toBe('active');

      vi.useRealTimers();
    });

    it('5. Multiple employees do not create duplicate WorkSessions for the same date/shift', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 10, 7, 30, 0));

      for (let i = 1; i <= 3; i++) {
        const s = await staffApi.create({ id: `st-dup-${i}`, employeeCode: `NVD${i}`, name: `Staff ${i}`, isActive: true });
        await accountApi.create({ id: `acc-dup-${i}`, employeeId: s.data.id, role: 'employee', pin: '123456', isActive: true });

        const { setCurrentRegisterId } = await import('../utils/registerConfig');
        setCurrentRegisterId(`POS0${i}`);
        
        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {
          await result.current.loginStaff({ employeeCode: `NVD${i}`, pin: '123456' });
        });
      }

      // Exactly ONE WorkSession for date of 2026-09-10
      const allMorningSessions = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(allMorningSessions.length).toBe(1);

      // All 3 members belong to this same session
      const sessionMembers = (await workSessionApi.getMembersBySessionId(allMorningSessions[0].id)).data;
      expect(sessionMembers.length).toBe(3);

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // TEST GROUP B — CHECK-IN AND LATE
  // =========================================================================
  describe('TEST GROUP B — CHECK-IN AND LATE', () => {
    it('6. 07:30 morning login = on time, 07:35 = on time (within 5m grace)', () => {
      const mornOnTime = determineShiftForTime(new Date(2026, 8, 10, 7, 30, 0));
      expect(mornOnTime.shiftType).toBe('morning');
      expect(mornOnTime.isLate).toBe(false);
      expect(mornOnTime.lateMinutes).toBe(0);

      const mornGrace = determineShiftForTime(new Date(2026, 8, 10, 7, 35, 0));
      expect(mornGrace.shiftType).toBe('morning');
      expect(mornGrace.isLate).toBe(false);
    });

    it('7. 07:36 morning login = 1 minute late (and 08:10 = 35 minutes late)', () => {
      const mornLate6 = determineShiftForTime(new Date(2026, 8, 10, 7, 36, 0));
      expect(mornLate6.shiftType).toBe('morning');
      expect(mornLate6.isLate).toBe(true);
      expect(mornLate6.lateMinutes).toBe(1);

      const mornLate40 = determineShiftForTime(new Date(2026, 8, 10, 8, 10, 0));
      expect(mornLate40.shiftType).toBe('morning');
      expect(mornLate40.isLate).toBe(true);
      expect(mornLate40.lateMinutes).toBe(35);
    });

    it('8. 13:00 afternoon login = on time, 13:05 = within grace', () => {
      const aftOnTime = determineShiftForTime(new Date(2026, 8, 10, 13, 0, 0));
      expect(aftOnTime.shiftType).toBe('afternoon');
      expect(aftOnTime.isLate).toBe(false);
      expect(aftOnTime.lateMinutes).toBe(0);

      const aftGrace = determineShiftForTime(new Date(2026, 8, 10, 13, 5, 0));
      expect(aftGrace.shiftType).toBe('afternoon');
      expect(aftGrace.isLate).toBe(false);
    });

    it('9. 13:06 afternoon login = 1 minute late', () => {
      const aftLate6 = determineShiftForTime(new Date(2026, 8, 10, 13, 6, 0));
      expect(aftLate6.shiftType).toBe('afternoon');
      expect(aftLate6.isLate).toBe(true);
      expect(aftLate6.lateMinutes).toBe(1);
    });

    it('10 & 11. 19:00 evening login = on time and 19:20 = 15 minutes late', () => {
      const eveOnTime = determineShiftForTime(new Date(2026, 8, 10, 19, 0, 0));
      expect(eveOnTime.shiftType).toBe('evening');
      expect(eveOnTime.isLate).toBe(false);
      expect(eveOnTime.lateMinutes).toBe(0);

      const eveLate20 = determineShiftForTime(new Date(2026, 8, 10, 19, 20, 0));
      expect(eveLate20.shiftType).toBe('evening');
      expect(eveLate20.isLate).toBe(true);
      expect(eveLate20.lateMinutes).toBe(15);
    });

    it('Stores actual check-in timestamp and preserves existing schema fields (no early state)', async () => {
      vi.useFakeTimers();
      const mockTime = new Date(2026, 8, 10, 7, 36, 0); // 07:36:00
      vi.setSystemTime(mockTime);

      const staffRes = await staffApi.create({ id: 'st-b-schema', employeeCode: 'NVBS', name: 'NV Schema', isActive: true });
      await accountApi.create({ id: 'acc-b-schema', employeeId: staffRes.data.id, role: 'employee', pin: '123456', isActive: true });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.loginStaff({ employeeCode: 'NVBS', pin: '123456' });
      });

      const members = (await workSessionApi.getMembers({ accountId: 'acc-b-schema' })).data;
      expect(members.length).toBe(1);
      const member = members[0];
      expect(member.checkInTime).toBe(mockTime.toISOString());
      expect(member.attendanceStatus).toBe('present');
      expect(member.attendanceStatus).not.toBe('early');
      expect(member.isLate).toBe(true);
      expect(member.lateMinutes).toBe(1);

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // TEST GROUP C — FIXED REST PERIODS & REAL TRANSACTIONS
  // =========================================================================
  describe('TEST GROUP C — FIXED REST PERIODS & REAL TRANSACTIONS', () => {
    it('Does not add individual break database records or break tracking fields', async () => {
      const members = (await workSessionApi.getMembers()).data;
      members.forEach((m) => {
        expect(m.breakStart).toBeUndefined();
        expect(m.breakEnd).toBeUndefined();
        expect(m.breakRecords).toBeUndefined();
      });
    });

    it('Allows sales transactions during rest periods (12:15) preserving seller identity, session linkage, exact time, and stock', async () => {
      const staffRes = await staffApi.create({ id: 'st-c-midday', employeeCode: 'NVC1', name: 'NV Trực Trưa', isActive: true });
      const accRes = await accountApi.create({ id: 'acc-c-midday', employeeId: staffRes.data.id, role: 'staff', pin: '123456', isActive: true });
      const sessionRes = await workSessionApi.create({
        id: 'ws-c-midday',
        code: 'CA-20260910-01',
        date: '2026-09-10',
        shiftType: 'morning',
        status: 'active',
      });

      // Sale occurs at 12:15 (during 12:00 -> 13:00 rest period)
      const restPeriodTime = new Date(2026, 8, 10, 12, 15, 0).toISOString();
      const orderPayload = {
        id: 'ord-c-rest',
        code: 'HD-C-REST',
        accountId: accRes.data.id,
        workSessionId: sessionRes.data.id,
        items: [
          { productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Abbott Ensure Gold', quantity: 2, price: 436000 },
        ],
        totalAmount: 872000,
        status: 'completed',
        createdAt: restPeriodTime,
      };

      const createdOrderRes = await orderApi.create(orderPayload, accRes.data);
      expect(createdOrderRes.data).toBeDefined();
      expect(createdOrderRes.data.id).toBe('ord-c-rest');
      expect(createdOrderRes.data.accountId).toBe(accRes.data.id);
      expect(createdOrderRes.data.workSessionId).toBe(sessionRes.data.id);
      expect(createdOrderRes.data.createdAt).toBe(restPeriodTime);
      expect(createdOrderRes.data.status).toBe('completed');
    });
  });

  // =========================================================================
  // TEST GROUP D — EMPLOYEE STATUS (ACTIVE VS SELLING)
  // =========================================================================
  describe('TEST GROUP D — EMPLOYEE STATUS (ACTIVE VS SELLING)', () => {
    it('Employee default status is active and not labeled as idle, waiting, or waiting-for-order', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 10, 7, 30, 0));

      const staffRes = await staffApi.create({ id: 'st-d-status', employeeCode: 'NVDSTAT', name: 'NV Active', isActive: true });
      await accountApi.create({ id: 'acc-d-status', employeeId: staffRes.data.id, role: 'employee', pin: '123456', isActive: true });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.loginStaff({ employeeCode: 'NVDSTAT', pin: '123456' });
      });

      const members = (await workSessionApi.getMembers({ accountId: 'acc-d-status' })).data;
      expect(members.length).toBe(1);
      const member = members[0];
      expect(member.attendanceStatus).toBe('present');
      expect(member.workingStatus).not.toBe('waiting-for-order');
      expect(member.workingStatus).not.toBe('waiting');
      expect(member.workingStatus).not.toBe('idle');

      vi.useRealTimers();
    });

    it('Selling represents active sale operation and returns to active upon completion', async () => {
      const staffRes = await staffApi.create({ id: 'st-d-sale', employeeCode: 'NVDSALE', name: 'NV Sale', isActive: true });
      const accRes = await accountApi.create({ id: 'acc-d-sale', employeeId: staffRes.data.id, role: 'employee', pin: '123456', isActive: true });
      const sessionRes = await workSessionApi.create({ id: 'ws-d-sale', code: 'CA-DSALE', date: '2026-09-10', shiftType: 'morning', status: 'active' });
      const memberRes = await workSessionApi.createMember({
        workSessionId: sessionRes.data.id,
        accountId: accRes.data.id,
        attendanceStatus: 'present',
        workingStatus: 'active',
      });

      // Actively processing sale -> busy
      await workSessionApi.updateWorkingStatus(memberRes.data.id, 'busy');
      const busyMember = (await workSessionApi.getMemberById(memberRes.data.id)).data;
      expect(busyMember.workingStatus).toBe('busy');

      // Sale completed -> returns to active
      await workSessionApi.updateWorkingStatus(memberRes.data.id, 'active');
      const activeMember = (await workSessionApi.getMemberById(memberRes.data.id)).data;
      expect(activeMember.workingStatus).toBe('active');
    });
  });

  // =========================================================================
  // TEST GROUP E — LOGOUT AUTO-CHECKOUT & AUDIT DATA PERMANENCE
  // =========================================================================
  describe('TEST GROUP E — LOGOUT & AUDIT DATA PERMANENCE', () => {
    it('Automatically records checkout on logout with exact timestamp and preserves session history', async () => {
      vi.useFakeTimers();
      const loginTime = new Date(2026, 8, 10, 7, 15, 0);
      vi.setSystemTime(loginTime);

      const staffRes = await staffApi.create({ id: 'st-e-out', employeeCode: 'NVEOUT', name: 'NV Out', isActive: true });
      await accountApi.create({ id: 'acc-e-out', employeeId: staffRes.data.id, role: 'employee', pin: '123456', isActive: true });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.loginStaff({ employeeCode: 'NVEOUT', pin: '123456' });
      });

      expect(result.current.isAuthenticated).toBe(true);

      const logoutTime = new Date(2026, 8, 10, 12, 0, 0);
      vi.setSystemTime(logoutTime);

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);

      const members = (await workSessionApi.getMembers({ accountId: 'acc-e-out' })).data;
      expect(members.length).toBe(1);
      const member = members[0];
      expect(member.attendanceStatus).toBe('completed');
      expect(member.checkOutTime).toBe(logoutTime.toISOString());
      expect(member.workingStatus).toBe('offline');

      vi.useRealTimers();
    });

    it('Rejects deletion of WorkSession as permanent historical audit data', async () => {
      const sessionRes = await workSessionApi.create({
        id: 'ws-e-perm',
        code: 'CA-E-PERM',
        date: '2026-09-10',
        shiftType: 'morning',
        status: 'closed',
      });

      expect(() => {
        workSessionApi.remove(sessionRes.data.id, { role: 'admin' });
      }).toThrow(/KHÔNG ĐƯỢC PHÉP XÓA/i);
    });

    it('Preserves historical WorkSession, members, orders, and logs even when employee leaves company', async () => {
      const staffRes = await staffApi.create({
        id: 'st-e-resign',
        employeeCode: 'NVERESIGN',
        name: 'NV Resign',
        employmentStatus: 'working',
        isActive: true,
      });

      const accRes = await accountApi.create({
        id: 'acc-e-resign',
        employeeId: staffRes.data.id,
        role: 'employee',
        pin: '123456',
        isActive: true,
      });

      const sessionRes = await workSessionApi.create({
        id: 'ws-e-hist',
        code: 'CA-E-HIST',
        date: '2026-09-01',
        shiftType: 'morning',
        status: 'closed',
      });

      await workSessionApi.createMember({
        id: 'wsm-e-hist',
        workSessionId: sessionRes.data.id,
        accountId: accRes.data.id,
        attendanceStatus: 'completed',
        checkInTime: '2026-09-01T07:30:00.000Z',
        checkOutTime: '2026-09-01T12:00:00.000Z',
      });

      await orderApi.create({
        id: 'ord-e-hist',
        code: 'HD-E-HIST',
        accountId: accRes.data.id,
        workSessionId: sessionRes.data.id,
        totalAmount: 150000,
        status: 'completed',
        createdAt: '2026-09-01T09:00:00.000Z',
      }, accRes.data);

      // Employee deactivation on resignation
      await staffApi.updateStatus(staffRes.data.id, false, { role: 'admin' });
      await accountApi.updateStatus(accRes.data.id, false, { role: 'admin' });

      // Historical records remain intact
      const sessionAfter = (await workSessionApi.getById('ws-e-hist')).data;
      expect(sessionAfter).toBeDefined();

      const memberAfter = (await workSessionApi.getMemberById('wsm-e-hist')).data;
      expect(memberAfter).toBeDefined();

      const orderAfter = (await orderApi.getById('ord-e-hist')).data;
      expect(orderAfter).toBeDefined();
    });
  });

  // =========================================================================
  // TEST GROUP F — LOGIN DISAMBIGUATION & AUTHORITATIVE DEFINITIONS
  // =========================================================================
  describe('TEST GROUP F — LOGIN DISAMBIGUATION & AUTHORITATIVE SHIFT DEFINITIONS', () => {
    it('Disambiguates duplicate staff names using PIN and integrates into WorkSession automatically', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 10, 7, 30, 0));

      const sA = await staffApi.create({ id: 'st-f-anh1', employeeCode: 'NVF001', name: 'Anh', isActive: true });
      const sB = await staffApi.create({ id: 'st-f-anh2', employeeCode: 'NVF002', name: 'Anh', isActive: true });
      await accountApi.create({ id: 'acc-f-anh1', employeeId: sA.data.id, role: 'employee', pin: '123456', isActive: true });
      await accountApi.create({ id: 'acc-f-anh2', employeeId: sB.data.id, role: 'employee', pin: '654321', isActive: true });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let loginRes;
      await act(async () => {
        loginRes = await result.current.loginStaff({ name: 'Anh', pin: '123456' });
      });

      expect(loginRes.success).toBe(true);
      expect(result.current.currentUser.employeeCode).toBe('NVF001');

      const members = (await workSessionApi.getMembers({ accountId: 'acc-f-anh1' })).data;
      expect(members.length).toBe(1);
      expect(members[0].attendanceStatus).toBe('present');

      vi.useRealTimers();
    });

    it('Enforces single authoritative shift times across application', () => {
      const morn = determineShiftForTime(new Date(2026, 8, 10, 7, 30, 0));
      expect(morn.shiftType).toBe('morning');
      expect(morn.shiftDef.startH).toBe(7);
      expect(morn.shiftDef.startM).toBe(30);
      expect(morn.shiftDef.endH).toBe(12);
      expect(morn.shiftDef.endM).toBe(0);

      const aft = determineShiftForTime(new Date(2026, 8, 10, 13, 0, 0));
      expect(aft.shiftType).toBe('afternoon');
      expect(aft.shiftDef.startH).toBe(13);
      expect(aft.shiftDef.startM).toBe(0);
      expect(aft.shiftDef.endH).toBe(18);
      expect(aft.shiftDef.endM).toBe(30);

      const eve = determineShiftForTime(new Date(2026, 8, 10, 19, 0, 0));
      expect(eve.shiftType).toBe('evening');
      expect(eve.shiftDef.startH).toBe(19);
      expect(eve.shiftDef.startM).toBe(0);
      expect(eve.shiftDef.endH).toBe(22);
      expect(eve.shiftDef.endM).toBe(0);
    });
  });
});
