import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';
import { orderApi } from '../api/orderApi';
import { workSessionApi, determineShiftForTime } from '../api/workSessionApi';

import { ROLES } from '../utils/permissions';
import { calculateDailyWorkSummary, calculateMonthlyWorkSummary } from '../utils/reportCalculations';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('WorkSession Daily Lifecycle & Date Transition Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  // =========================================================================
  // GROUP A: Exactly ONE WorkSession per Business Date (Single Daily Session)
  // =========================================================================
  describe('GROUP A: Single WorkSession per Business Date', () => {
    it('A1. First employee login on a business date creates exactly ONE daily WorkSession', async () => {
      vi.useFakeTimers();
      const morningTime = new Date(2026, 8, 10, 7, 30, 0); // 2026-09-10 07:30
      vi.setSystemTime(morningTime);

      const staff = await staffApi.create({ id: 'st-a1', employeeCode: 'NVA1', name: 'Nhân viên A1', isActive: true });
      await accountApi.create({ id: 'acc-a1', employeeId: staff.data.id, role: ROLES.EMPLOYEE, pin: '123456', isActive: true });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.loginStaff({ employeeCode: 'NVA1', pin: '123456' });
      });

      const sessions = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(sessions.length).toBe(1);
      expect(sessions[0].date).toBe('2026-09-10');
      expect(sessions[0].status).toBe('active');
      expect(sessions[0].code).toBe('CA-20260910-01');

      vi.useRealTimers();
    });

    it('A2. Second and third employees logging in at different shifts of the same date join the SAME daily WorkSession', async () => {
      vi.useFakeTimers();
      const morningTime = new Date(2026, 8, 10, 7, 45, 0); // 07:45 Morning
      const afternoonTime = new Date(2026, 8, 10, 13, 15, 0); // 13:15 Afternoon
      const eveningTime = new Date(2026, 8, 10, 19, 10, 0); // 19:10 Evening

      // Create 3 employees
      const s1 = await staffApi.create({ id: 'st-a2-1', employeeCode: 'NVA21', name: 'Staff Morning', isActive: true });
      const s2 = await staffApi.create({ id: 'st-a2-2', employeeCode: 'NVA22', name: 'Staff Afternoon', isActive: true });
      const s3 = await staffApi.create({ id: 'st-a2-3', employeeCode: 'NVA23', name: 'Staff Evening', isActive: true });
      await accountApi.create({ id: 'acc-a2-1', employeeId: s1.data.id, role: ROLES.EMPLOYEE, pin: '111111', isActive: true });
      await accountApi.create({ id: 'acc-a2-2', employeeId: s2.data.id, role: ROLES.EMPLOYEE, pin: '222222', isActive: true });
      await accountApi.create({ id: 'acc-a2-3', employeeId: s3.data.id, role: ROLES.EMPLOYEE, pin: '333333', isActive: true });

      // 1. Staff 1 logs in in Morning
      vi.setSystemTime(morningTime);
      const { result: auth1 } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth1.current.loginStaff({ employeeCode: 'NVA21', pin: '111111' });
      });

      // 2. Staff 2 logs in in Afternoon
      vi.setSystemTime(afternoonTime);
      const { setCurrentRegisterId } = await import('../utils/registerConfig');
      setCurrentRegisterId('POS02');
      const { result: auth2 } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth2.current.loginStaff({ employeeCode: 'NVA22', pin: '222222' });
      });

      // 3. Staff 3 logs in in Evening
      vi.setSystemTime(eveningTime);
      setCurrentRegisterId('POS03');
      const { result: auth3 } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth3.current.loginStaff({ employeeCode: 'NVA23', pin: '333333' });
      });

      // Verify: There is STILL exactly ONE WorkSession for 2026-09-10
      const allSessions = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(allSessions.length).toBe(1);
      const dailySession = allSessions[0];

      // All 3 employees have members in this exact same session
      const members = (await workSessionApi.getMembersBySessionId(dailySession.id)).data;
      expect(members.length).toBe(3);
      expect(members.map(m => m.accountId).sort()).toEqual(['acc-a2-1', 'acc-a2-2', 'acc-a2-3'].sort());

      vi.useRealTimers();
    });

    it('A3. Transitions between morning -> afternoon -> evening do not create new sessions', async () => {
      vi.useFakeTimers();
      const morningTime = new Date(2026, 8, 10, 8, 0, 0);
      vi.setSystemTime(morningTime);

      const staff = await staffApi.create({ id: 'st-a3', employeeCode: 'NVA3', name: 'NV Chuyển Ca', isActive: true });
      await accountApi.create({ id: 'acc-a3', employeeId: staff.data.id, role: ROLES.EMPLOYEE, pin: '123456', isActive: true });

      const { result: auth } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth.current.loginStaff({ employeeCode: 'NVA3', pin: '123456' });
      });

      // Afternoon arrival of same or another staff
      vi.setSystemTime(new Date(2026, 8, 10, 14, 0, 0));
      const aftRes = await workSessionApi.getOrCreateWorkSession(new Date(2026, 8, 10, 14, 0, 0), false);

      // Evening arrival
      vi.setSystemTime(new Date(2026, 8, 10, 20, 0, 0));
      const eveRes = await workSessionApi.getOrCreateWorkSession(new Date(2026, 8, 10, 20, 0, 0), false);

      expect(aftRes.workSession.id).toBe('ws_2026-09-10');
      expect(eveRes.workSession.id).toBe('ws_2026-09-10');

      const sessions = (await workSessionApi.getAll({ date: '2026-09-10' })).data;
      expect(sessions.length).toBe(1);

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // GROUP B: Daily WorkSession Auto-Close on Date Change
  // =========================================================================
  describe('GROUP B: Daily WorkSession Auto-Close on Date Change', () => {
    it('B1. Previous active session is automatically closed when date advances to a new calendar day', async () => {
      vi.useFakeTimers();
      const day1 = new Date(2026, 8, 10, 8, 0, 0); // 2026-09-10
      vi.setSystemTime(day1);

      const staff = await staffApi.create({ id: 'st-b1', employeeCode: 'NVB1', name: 'NV Day 1', isActive: true });
      await accountApi.create({ id: 'acc-b1', employeeId: staff.data.id, role: ROLES.EMPLOYEE, pin: '123456', isActive: true });

      // Staff logs in on Day 1 -> Active daily session
      const { result: auth } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth.current.loginStaff({ employeeCode: 'NVB1', pin: '123456' });
      });

      const day1Session = (await workSessionApi.getAll({ date: '2026-09-10' })).data[0];
      expect(day1Session.status).toBe('active');

      // Date advances to next day 2026-09-11 08:00
      const day2 = new Date(2026, 8, 11, 8, 0, 0);
      vi.setSystemTime(day2);

      // Next day user logs in or getOrCreateWorkSession is called
      await workSessionApi.getOrCreateWorkSession(day2, false);

      // Verify: Day 1 session is now CLOSED
      const day1SessionAfter = (await workSessionApi.getById(day1Session.id)).data;
      expect(day1SessionAfter.status).toBe('closed');
      expect(day1SessionAfter.endTime).toBeDefined();

      vi.useRealTimers();
    });

    it('B2. Auto-close reconciles un-checked-out members to missing_checkout', async () => {
      vi.useFakeTimers();
      const day1Time = new Date(2026, 8, 10, 8, 0, 0);
      vi.setSystemTime(day1Time);

      const staff = await staffApi.create({ id: 'st-b2', employeeCode: 'NVB2', name: 'NV Missing Out', isActive: true });
      await accountApi.create({ id: 'acc-b2', employeeId: staff.data.id, role: ROLES.EMPLOYEE, pin: '123456', isActive: true });

      const { result: auth } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth.current.loginStaff({ employeeCode: 'NVB2', pin: '123456' });
      });

      const membersBefore = (await workSessionApi.getMembers({ accountId: 'acc-b2' })).data;
      expect(membersBefore[0].attendanceStatus).toBe('present');

      // Advance to 2026-09-11
      const day2Time = new Date(2026, 8, 11, 8, 0, 0);
      vi.setSystemTime(day2Time);

      // Trigger auto-close
      await workSessionApi.autoClosePastSessions('2026-09-11');

      const membersAfter = (await workSessionApi.getMembers({ accountId: 'acc-b2' })).data;
      expect(membersAfter[0].attendanceStatus).toBe('missing_checkout');
      expect(membersAfter[0].workingStatus).toBe('offline');
      expect(membersAfter[0].checkOutTime).toBeNull();

      vi.useRealTimers();
    });

    it('B3. Auto-close is idempotent and can be run multiple times safely without side effects', async () => {
      vi.useFakeTimers();
      const day1 = new Date(2026, 8, 10, 8, 0, 0);
      vi.setSystemTime(day1);

      await workSessionApi.create({
        id: 'ws_2026-09-10',
        code: 'CA-20260910-01',
        date: '2026-09-10',
        status: 'active'
      });

      // Run auto-close on 2026-09-11 3 times
      await workSessionApi.autoClosePastSessions('2026-09-11');
      await workSessionApi.autoClosePastSessions('2026-09-11');
      await workSessionApi.autoClosePastSessions('2026-09-11');

      const sess = (await workSessionApi.getById('ws_2026-09-10')).data;
      expect(sess.status).toBe('closed');

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // GROUP C: New Day, New WorkSession Coexistence
  // =========================================================================
  describe('GROUP C: New Day, New WorkSession Coexistence', () => {
    it('C1. Creates fresh daily session for new day while preserving yesterday closed session', async () => {
      vi.useFakeTimers();
      const day1 = new Date(2026, 8, 10, 8, 0, 0);
      vi.setSystemTime(day1);

      const staff = await staffApi.create({ id: 'st-c1', employeeCode: 'NVC1', name: 'NV Liên Ngày', isActive: true });
      const acc = await accountApi.create({ id: 'acc-c1', employeeId: staff.data.id, role: ROLES.EMPLOYEE, pin: '123456', isActive: true });

      // Day 1 login
      const { result: auth1 } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth1.current.loginStaff({ employeeCode: 'NVC1', pin: '123456' });
      });

      // Create an order on Day 1
      await orderApi.create({
        id: 'ord-day1-01',
        code: 'HD-DAY1-01',
        accountId: acc.data.id,
        workSessionId: 'ws_2026-09-10',
        totalAmount: 500000,
        status: 'completed',
        createdAt: day1.toISOString()
      }, acc.data);

      // Advance to Day 2: 2026-09-11 07:30
      const day2 = new Date(2026, 8, 11, 7, 30, 0);
      vi.setSystemTime(day2);

      // Day 2 login
      const { result: auth2 } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth2.current.loginStaff({ employeeCode: 'NVC1', pin: '123456' });
      });

      // Create an order on Day 2
      await orderApi.create({
        id: 'ord-day2-01',
        code: 'HD-DAY2-01',
        accountId: acc.data.id,
        workSessionId: 'ws_2026-09-11',
        totalAmount: 750000,
        status: 'completed',
        createdAt: day2.toISOString()
      }, acc.data);

      // Verify both sessions exist
      const day1Session = (await workSessionApi.getById('ws_2026-09-10')).data;
      const day2Session = (await workSessionApi.getById('ws_2026-09-11')).data;

      expect(day1Session.status).toBe('closed');
      expect(day1Session.date).toBe('2026-09-10');

      expect(day2Session.status).toBe('active');
      expect(day2Session.date).toBe('2026-09-11');

      // Verify orders remain correctly associated
      const allOrders = (await orderApi.getAll()).data;
      const day1Orders = allOrders.filter(o => o.workSessionId === 'ws_2026-09-10');
      const day2Orders = allOrders.filter(o => o.workSessionId === 'ws_2026-09-11');

      expect(day1Orders.length).toBe(1);
      expect(day1Orders[0].id).toBe('ord-day1-01');
      expect(day2Orders.length).toBe(1);
      expect(day2Orders[0].id).toBe('ord-day2-01');

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // GROUP D: Continuous User Experience Across Midnight / Date Change
  // =========================================================================
  describe('GROUP D: Continuous User Experience Across Date Change', () => {
    it('D1. User logged in across midnight stays authenticated without logout', async () => {
      vi.useFakeTimers();
      const beforeMidnight = new Date(2026, 8, 10, 23, 50, 0);
      vi.setSystemTime(beforeMidnight);

      const staff = await staffApi.create({ id: 'st-d1', employeeCode: 'NVD1', name: 'NV Trực Đêm', isActive: true });
      await accountApi.create({ id: 'acc-d1', employeeId: staff.data.id, role: ROLES.EMPLOYEE, pin: '123456', isActive: true });

      const { result: auth } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth.current.loginStaff({ employeeCode: 'NVD1', pin: '123456' });
      });

      expect(auth.current.isAuthenticated).toBe(true);
      expect(auth.current.currentUser.employeeCode).toBe('NVD1');

      // Clock ticks past midnight to 2026-09-11 00:05
      const afterMidnight = new Date(2026, 8, 11, 0, 5, 0);
      vi.setSystemTime(afterMidnight);

      // User state is STILL authenticated!
      expect(auth.current.isAuthenticated).toBe(true);
      expect(auth.current.currentUser.employeeCode).toBe('NVD1');

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // GROUP E: Historical Data & Integrity Protection
  // =========================================================================
  describe('GROUP E: Historical Data & Integrity Protection', () => {
    it('E1. Closing a WorkSession NEVER deletes WorkSessions, Members, Orders, or Inventory Logs', async () => {
      vi.useFakeTimers();
      const day1 = new Date(2026, 8, 10, 8, 0, 0);
      vi.setSystemTime(day1);

      const staff = await staffApi.create({ id: 'st-e1', employeeCode: 'NVE1', name: 'NV Lịch Sử', isActive: true });
      const acc = await accountApi.create({ id: 'acc-e1', employeeId: staff.data.id, role: ROLES.EMPLOYEE, pin: '123456', isActive: true });

      const { result: auth } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await auth.current.loginStaff({ employeeCode: 'NVE1', pin: '123456' });
      });

      await orderApi.create({
        id: 'ord-hist-1',
        code: 'HD-HIST-01',
        accountId: acc.data.id,
        workSessionId: 'ws_2026-09-10',
        totalAmount: 1200000,
        status: 'completed',
        createdAt: day1.toISOString()
      }, acc.data);

      // Date advances and session is auto-closed
      vi.setSystemTime(new Date(2026, 8, 11, 8, 0, 0));
      await workSessionApi.autoClosePastSessions('2026-09-11');

      // Check all records exist
      const allSessions = (await workSessionApi.getAll()).data;
      const allMembers = (await workSessionApi.getMembers()).data;
      const allOrders = (await orderApi.getAll()).data;

      expect(allSessions.some(s => s.id === 'ws_2026-09-10')).toBe(true);
      expect(allMembers.some(m => m.workSessionId === 'ws_2026-09-10')).toBe(true);
      expect(allOrders.some(o => o.workSessionId === 'ws_2026-09-10')).toBe(true);

      // Cannot delete WorkSession or Member
      expect(() => workSessionApi.remove('ws_2026-09-10')).toThrow(/KHÔNG ĐƯỢC PHÉP XÓA/i);
      expect(() => workSessionApi.removeMember(allMembers[0].id)).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED/i);

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // GROUP F: Daily & Monthly Reports and End-of-Day Audit
  // =========================================================================
  describe('GROUP F: Daily & Monthly Work Reports and Audit Compatibility', () => {
    it('F1. Daily staff report accurately computes work durations, sales, and late status for daily WorkSession', async () => {
      const staffList = [{ id: 'st-rep-1', employeeCode: 'NVREP1', name: 'Nhân viên Báo cáo', isActive: true }];
      const accountList = [{ id: 'acc-rep-1', employeeId: 'st-rep-1', role: 'employee', isActive: true }];

      const session = {
        id: 'ws_2026-09-10',
        code: 'CA-20260910-01',
        date: '2026-09-10',
        shiftType: 'daily',
        status: 'closed'
      };

      const member = {
        id: 'wsm-rep-1',
        workSessionId: 'ws_2026-09-10',
        accountId: 'acc-rep-1',
        shiftType: 'morning',
        attendanceStatus: 'present',
        workingStatus: 'offline',
        checkInTime: '2026-09-10T00:30:00.000Z', // 07:30 VN Morning period
        checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN
        isLate: false,
        lateMinutes: 0
      };

      const orders = [
        {
          id: 'ord-rep-1',
          code: 'HD-REP-1',
          workSessionId: 'ws_2026-09-10',
          accountId: 'acc-rep-1',
          totalAmount: 1500000,
          status: 'completed',
          businessDate: '2026-09-10',
          createdAt: '2026-09-10T02:00:00.000Z' // 09:00 VN
        }
      ];

      const report = calculateDailyWorkSummary({
        dateStr: '2026-09-10',
        employeeId: 'st-rep-1',
        accountId: 'acc-rep-1',
        members: [member],
        sessions: [session],
        orders,
        staffList,
        accountList
      });

      expect(report.employee.name).toBe('Nhân viên Báo cáo');
      expect(report.totalSalesAmount).toBe(1500000);
      expect(report.completedOrderCount).toBe(1);
      expect(report.totalWorkMinutes).toBe(270);
      expect(report.shiftsParticipated.length).toBe(1);
    });

    it('F2. Monthly staff report aggregates daily work metrics correctly across multiple days', async () => {
      const staffList = [{ id: 'st-m-1', employeeCode: 'NVM1', name: 'NV Tháng', isActive: true }];
      const accountList = [{ id: 'acc-m-1', employeeId: 'st-m-1', role: 'employee', isActive: true }];

      const sessions = [
        { id: 'ws_2026-09-01', code: 'CA-20260901-01', date: '2026-09-01', shiftType: 'daily', status: 'closed' },
        { id: 'ws_2026-09-02', code: 'CA-20260902-01', date: '2026-09-02', shiftType: 'daily', status: 'closed' }
      ];

      const members = [
        {
          id: 'm1',
          workSessionId: 'ws_2026-09-01',
          accountId: 'acc-m-1',
          shiftType: 'morning',
          attendanceStatus: 'present',
          checkInTime: '2026-09-01T00:30:00.000Z', // 07:30 VN
          checkOutTime: '2026-09-01T05:00:00.000Z'  // 12:00 VN
        },
        {
          id: 'm2',
          workSessionId: 'ws_2026-09-02',
          accountId: 'acc-m-1',
          shiftType: 'afternoon',
          attendanceStatus: 'present',
          checkInTime: '2026-09-02T06:00:00.000Z', // 13:00 VN
          checkOutTime: '2026-09-02T11:30:00.000Z' // 18:30 VN
        }
      ];

      const orders = [
        { id: 'o1', workSessionId: 'ws_2026-09-01', accountId: 'acc-m-1', totalAmount: 1000000, status: 'completed', businessDate: '2026-09-01', createdAt: '2026-09-01T02:00:00.000Z' },
        { id: 'o2', workSessionId: 'ws_2026-09-02', accountId: 'acc-m-1', totalAmount: 2000000, status: 'completed', businessDate: '2026-09-02', createdAt: '2026-09-02T08:00:00.000Z' }
      ];

      const report = calculateMonthlyWorkSummary({
        monthStr: '2026-09',
        employeeId: 'st-m-1',
        accountId: 'acc-m-1',
        sessions,
        members,
        orders,
        staffList,
        accountList
      });

      expect(report.totalSalesAmount).toBe(3000000);
      expect(report.totalCompletedOrders).toBe(2);
      expect(report.totalWorkingDays).toBe(2);
      expect(report.totalWorkMinutes).toBe(600); // 270 + 330
    });
  });

  // =========================================================================
  // GROUP G: Business & Regression Integrity
  // =========================================================================
  describe('GROUP G: Business & Regression Integrity', () => {
    it('G1. Sales transactions during rest periods remain valid and correctly linked', async () => {
      const staffRes = await staffApi.create({ id: 'st-g-rest', employeeCode: 'NVGREST', name: 'NV Nghỉ Trưa', isActive: true });
      const accRes = await accountApi.create({ id: 'acc-g-rest', employeeId: staffRes.data.id, role: ROLES.STAFF, pin: '123456', isActive: true });
      const sessionRes = await workSessionApi.create({
        id: 'ws_2026-09-10',
        code: 'CA-20260910-01',
        date: '2026-09-10',
        shiftType: 'daily',
        status: 'active'
      });

      const restTime = '2026-09-10T12:30:00.000Z';
      const orderPayload = {
        id: 'ord-rest-sale-1',
        code: 'HD-REST-01',
        accountId: accRes.data.id,
        workSessionId: sessionRes.data.id,
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Ensure Gold', quantity: 1, price: 436000 }],
        totalAmount: 436000,
        status: 'completed',
        createdAt: restTime
      };

      const created = await orderApi.create(orderPayload, accRes.data);
      expect(created.data.status).toBe('completed');
      expect(created.data.workSessionId).toBe('ws_2026-09-10');
    });

    it('G2. Employee late calculation adheres to confirmed shift boundary times', () => {
      // Morning late check (07:36 -> late 1m after 5m grace)
      const morn = determineShiftForTime(new Date(2026, 8, 10, 7, 36, 0));
      expect(morn.shiftType).toBe('morning');
      expect(morn.isLate).toBe(true);
      expect(morn.lateMinutes).toBe(1);

      // Afternoon on time (13:00)
      const aft = determineShiftForTime(new Date(2026, 8, 10, 13, 0, 0));
      expect(aft.shiftType).toBe('afternoon');
      expect(aft.isLate).toBe(false);
      expect(aft.lateMinutes).toBe(0);

      // Evening late check (19:20 -> late 15m after 5m grace)
      const eve = determineShiftForTime(new Date(2026, 8, 10, 19, 20, 0));
      expect(eve.shiftType).toBe('evening');
      expect(eve.isLate).toBe(true);
      expect(eve.lateMinutes).toBe(15);
    });
  });
});
