import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { reportApi } from '../api/reportApi';
import {
  calculateShiftWorkDuration,
  calculateDailyWorkSummary,
  calculateMonthlyWorkSummary,
  isTimeInRestPeriod,
} from '../utils/reportCalculations';
import { workSessionApi } from '../api/workSessionApi';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';

import { ROLES } from '../utils/permissions';

describe('WorkSession Reporting & End-of-Day Audit Test Suite (Items 1 to 36)', () => {
  const adminActor = {
    id: 'acc-admin-rep',
    employeeId: null,
    role: ROLES.ADMIN,
    name: 'Quản trị viên',
    email: 'admin@shop.vn',
    isActive: true,
  };

  const staffActor = {
    id: 'acc-staff-rep',
    employeeId: 'st-staff-rep',
    role: ROLES.STAFF,
    name: 'Quản lý Cửa Hàng',
    employeeCode: 'NVSTAFF',
    isActive: true,
  };

  const employeeA = {
    id: 'acc-emp-a',
    employeeId: 'st-emp-a',
    role: ROLES.EMPLOYEE,
    name: 'Nguyễn Anh',
    employeeCode: 'NV001',
    isActive: true,
  };

  const employeeB = {
    id: 'acc-emp-b',
    employeeId: 'st-emp-b',
    role: ROLES.EMPLOYEE,
    name: 'Trần Bình',
    employeeCode: 'NV002',
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. DAILY WORK REPORT (Items 1 to 9)
  // =========================================================================
  describe('1. DAILY WORK REPORT (Items 1 to 9)', () => {
    it('1. Employee daily report shows correct work duration (e.g. 07:35 to 12:00 = 4h25 = 265 mins)', () => {
      const member = {
        id: 'm1',
        workSessionId: 'ws1',
        accountId: 'acc-emp-a',
        shiftType: 'morning',
        checkInTime: '2026-09-10T00:35:00.000Z', // 07:35 VN
        checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN
        isLate: true,
        lateMinutes: 5,
      };
      const session = {
        id: 'ws1',
        code: 'CA-20260910-01',
        date: '2026-09-10',
        shiftType: 'morning',
        status: 'closed',
      };

      const result = calculateShiftWorkDuration(member, session, '2026-09-10');
      expect(result.durationMinutes).toBe(265);
      expect(result.durationFormatted.formatted).toBe('4h25');
      expect(result.isLate).toBe(true);
      expect(result.lateMinutes).toBe(5);
    });

    it('2. Multiple shifts on the same day are combined correctly (Morning 4h25 + Afternoon 5h30 = 9h55 = 595 mins)', () => {
      const dateStr = '2026-09-10';
      const sessions = [
        { id: 'ws-morn', code: 'CA-20260910-01', date: dateStr, shiftType: 'morning', status: 'closed' },
        { id: 'ws-aft', code: 'CA-20260910-02', date: dateStr, shiftType: 'afternoon', status: 'closed' },
      ];
      const members = [
        {
          id: 'm-morn',
          workSessionId: 'ws-morn',
          accountId: 'acc-emp-a',
          shiftType: 'morning',
          checkInTime: '2026-09-10T00:35:00.000Z', // 07:35 VN
          checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN
          isLate: true,
          lateMinutes: 5,
        },
        {
          id: 'm-aft',
          workSessionId: 'ws-aft',
          accountId: 'acc-emp-a',
          shiftType: 'afternoon',
          checkInTime: '2026-09-10T06:00:00.000Z', // 13:00 VN
          checkOutTime: '2026-09-10T11:30:00.000Z', // 18:30 VN
          isLate: false,
          lateMinutes: 0,
        },
      ];
      const staffList = [{ id: 'st-emp-a', employeeCode: 'NV001', name: 'Nguyễn Anh' }];
      const accountList = [{ id: 'acc-emp-a', employeeId: 'st-emp-a', role: 'employee' }];

      const summary = calculateDailyWorkSummary({
        dateStr,
        accountId: 'acc-emp-a',
        employeeId: 'st-emp-a',
        members,
        sessions,
        orders: [],
        staffList,
        accountList,
      });

      expect(summary.shiftsCount).toBe(2);
      expect(summary.totalWorkMinutes).toBe(595); // 265 + 330
      expect(summary.totalWorkDuration.formatted).toBe('9h55');
    });

    it('3. Fixed rest periods (12:00-13:00 and 18:30-19:00) are excluded from total duration', () => {
      const dateStr = '2026-09-10';
      const sessions = [
        { id: 'ws-morn', code: 'CA-20260910-01', date: dateStr, shiftType: 'morning', status: 'closed' },
        { id: 'ws-aft', code: 'CA-20260910-02', date: dateStr, shiftType: 'afternoon', status: 'closed' },
        { id: 'ws-eve', code: 'CA-20260910-03', date: dateStr, shiftType: 'evening', status: 'closed' },
      ];
      const members = [
        {
          id: 'm-morn',
          workSessionId: 'ws-morn',
          accountId: 'acc-emp-a',
          shiftType: 'morning',
          checkInTime: '2026-09-10T00:35:00.000Z', // 07:35 VN
          checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN (265 mins)
        },
        {
          id: 'm-aft',
          workSessionId: 'ws-aft',
          accountId: 'acc-emp-a',
          shiftType: 'afternoon',
          checkInTime: '2026-09-10T06:00:00.000Z', // 13:00 VN
          checkOutTime: '2026-09-10T11:30:00.000Z', // 18:30 VN (330 mins)
        },
        {
          id: 'm-eve',
          workSessionId: 'ws-eve',
          accountId: 'acc-emp-a',
          shiftType: 'evening',
          checkInTime: '2026-09-10T12:00:00.000Z', // 19:00 VN
          checkOutTime: '2026-09-10T15:00:00.000Z', // 22:00 VN (180 mins)
        },
      ];
      const staffList = [{ id: 'st-emp-a', employeeCode: 'NV001', name: 'Nguyễn Anh' }];
      const accountList = [{ id: 'acc-emp-a', employeeId: 'st-emp-a', role: 'employee' }];

      const summary = calculateDailyWorkSummary({
        dateStr,
        accountId: 'acc-emp-a',
        members,
        sessions,
        orders: [],
        staffList,
        accountList,
      });

      // Total should be 265 + 330 + 180 = 775 minutes = 12h55
      // (NOT 07:35 -> 22:00 which would be 14h25)
      expect(summary.totalWorkMinutes).toBe(775);
      expect(summary.totalWorkDuration.formatted).toBe('12h55');
    });

    it('4 & 5. Check-in and check-out times directly affect total duration', () => {
      // Checked in late at 08:00 (instead of 07:30) and checked out early at 11:30 (instead of 12:00)
      const member = {
        id: 'm1',
        workSessionId: 'ws1',
        accountId: 'acc-emp-a',
        shiftType: 'morning',
        checkInTime: '2026-09-10T01:00:00.000Z', // 08:00 VN
        checkOutTime: '2026-09-10T04:30:00.000Z', // 11:30 VN
      };
      const session = {
        id: 'ws1',
        date: '2026-09-10',
        shiftType: 'morning',
        status: 'closed',
      };

      const result = calculateShiftWorkDuration(member, session, '2026-09-10');
      // 08:00 to 11:30 = 3 hours 30 mins = 210 mins
      expect(result.durationMinutes).toBe(210);
      expect(result.durationFormatted.formatted).toBe('3h30');
    });

    it('6. Late information is shown correctly in Daily Work Report', () => {
      const dateStr = '2026-09-10';
      const sessions = [{ id: 'ws-morn', date: dateStr, shiftType: 'morning', status: 'closed' }];
      const members = [
        {
          id: 'm-morn',
          workSessionId: 'ws-morn',
          accountId: 'acc-emp-a',
          shiftType: 'morning',
          checkInTime: '2026-09-10T00:45:00.000Z', // 07:45 VN
          checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN
          isLate: true,
          lateMinutes: 15,
        },
      ];

      const summary = calculateDailyWorkSummary({
        dateStr,
        accountId: 'acc-emp-a',
        members,
        sessions,
        staffList: [{ id: 'st-emp-a', employeeCode: 'NV001', name: 'Nguyễn Anh' }],
        accountList: [{ id: 'acc-emp-a', employeeId: 'st-emp-a', role: 'employee' }],
      });

      expect(summary.isLate).toBe(true);
      expect(summary.totalLateMinutes).toBe(15);
    });

    it('7, 8 & 9. Completed order count, sales amount, and cancelled orders exclusion follow accounting rules', () => {
      const dateStr = '2026-09-10';
      const orders = [
        { id: 'o1', code: 'HD001', accountId: 'acc-emp-a', totalAmount: 468000, status: 'completed', businessDate: dateStr, createdAt: '2026-09-10T02:12:15.000Z' },
        { id: 'o2', code: 'HD002', accountId: 'acc-emp-a', totalAmount: 625000, status: 'completed', businessDate: dateStr, createdAt: '2026-09-10T02:45:32.000Z' },
        { id: 'o3', code: 'HD003', accountId: 'acc-emp-a', totalAmount: 300000, status: 'cancelled', businessDate: dateStr, createdAt: '2026-09-10T03:00:00.000Z' }, // Cancelled
        { id: 'o4', code: 'HD004', accountId: 'acc-emp-b', totalAmount: 1000000, status: 'completed', businessDate: dateStr, createdAt: '2026-09-10T03:15:00.000Z' }, // Other seller
      ];

      const summary = calculateDailyWorkSummary({
        dateStr,
        accountId: 'acc-emp-a',
        members: [],
        sessions: [],
        orders,
        staffList: [{ id: 'st-emp-a', employeeCode: 'NV001', name: 'Nguyễn Anh' }],
        accountList: [{ id: 'acc-emp-a', employeeId: 'st-emp-a', role: 'employee' }],
      });

      expect(summary.completedOrderCount).toBe(2);
      expect(summary.totalSalesAmount).toBe(1093000); // 468,000 + 625,000
    });
  });

  // =========================================================================
  // 2. MONTHLY WORK REPORT (Items 10 to 14)
  // =========================================================================
  describe('2. MONTHLY WORK REPORT (Items 10 to 14)', () => {
    it('10, 11, 12, 13 & 14. Daily durations and sales are summed correctly across multiple days in a month without duplicate time', () => {
      const monthStr = '2026-09';
      const sessions = [
        { id: 'ws-01', date: '2026-09-01', shiftType: 'morning', status: 'closed' },
        { id: 'ws-02', date: '2026-09-02', shiftType: 'afternoon', status: 'closed' },
        { id: 'ws-03', date: '2026-09-03', shiftType: 'morning', status: 'closed' },
      ];
      const members = [
        // 01/09: 07:30 to 12:00 = 270 mins (4h30)
        { id: 'm-01', workSessionId: 'ws-01', accountId: 'acc-emp-a', shiftType: 'morning', checkInTime: '2026-09-01T00:30:00.000Z', checkOutTime: '2026-09-01T05:00:00.000Z' },
        // 02/09: 13:00 to 18:30 = 330 mins (5h30)
        { id: 'm-02', workSessionId: 'ws-02', accountId: 'acc-emp-a', shiftType: 'afternoon', checkInTime: '2026-09-02T06:00:00.000Z', checkOutTime: '2026-09-02T11:30:00.000Z' },
        // 03/09: 07:30 to 12:00 = 270 mins (4h30)
        { id: 'm-03', workSessionId: 'ws-03', accountId: 'acc-emp-a', shiftType: 'morning', checkInTime: '2026-09-03T00:30:00.000Z', checkOutTime: '2026-09-03T05:00:00.000Z' },
      ];
      const orders = [
        { id: 'o-01', accountId: 'acc-emp-a', totalAmount: 500000, status: 'completed', businessDate: '2026-09-01', createdAt: '2026-09-01T03:00:00.000Z' },
        { id: 'o-02', accountId: 'acc-emp-a', totalAmount: 700000, status: 'completed', businessDate: '2026-09-02', createdAt: '2026-09-02T07:00:00.000Z' },
        { id: 'o-03', accountId: 'acc-emp-a', totalAmount: 800000, status: 'completed', businessDate: '2026-09-03', createdAt: '2026-09-03T02:00:00.000Z' },
      ];
      const staffList = [{ id: 'st-emp-a', employeeCode: 'NV001', name: 'Nguyễn Anh' }];
      const accountList = [{ id: 'acc-emp-a', employeeId: 'st-emp-a', role: 'employee' }];

      const monthlySummary = calculateMonthlyWorkSummary({
        monthStr,
        accountId: 'acc-emp-a',
        members,
        sessions,
        orders,
        staffList,
        accountList,
      });

      expect(monthlySummary.totalWorkingDays).toBe(3);
      expect(monthlySummary.totalWorkMinutes).toBe(870); // 270 + 330 + 270 = 870 mins = 14h30
      expect(monthlySummary.totalWorkDuration.formatted).toBe('14h30');
      expect(monthlySummary.totalCompletedOrders).toBe(3);
      expect(monthlySummary.totalSalesAmount).toBe(2000000); // 500k + 700k + 800k
      expect(monthlySummary.dailyBreakdown.length).toBe(3);
    });
  });

  // =========================================================================
  // 3. SALES DETAIL & SALES DURING REST PERIODS (Items 15 to 18)
  // =========================================================================
  describe('3. SALES DETAIL & SALES DURING REST PERIODS (Items 15 to 18)', () => {
    it('15, 16, 17 & 18. Exact sale timestamp, seller, product quantities, and sales during rest periods (12:00-13:00) are preserved', () => {
      const restPeriodSaleTime = '2026-09-10T05:25:30.000Z'; // 12:25:30 VN
      expect(isTimeInRestPeriod(restPeriodSaleTime)).toBe(true);

      const orders = [
        {
          id: 'ord-rest-1',
          code: 'HD00125',
          accountId: 'acc-emp-a',
          workSessionId: 'ws-morn',
          totalAmount: 468000,
          status: 'completed',
          businessDate: '2026-09-10',
          createdAt: restPeriodSaleTime,
          items: [
            { productId: 'p1', productName: 'Abbott Grow 900g', quantity: 2, price: 200000 },
            { productId: 'p2', productName: 'Vinamilk Yogurt', quantity: 4, price: 17000 },
          ],
        },
      ];

      const staffList = [{ id: 'st-emp-a', employeeCode: 'NV001', name: 'Nguyễn Anh' }];
      const accountList = [{ id: 'acc-emp-a', employeeId: 'st-emp-a', role: 'employee' }];

      const summary = calculateDailyWorkSummary({
        dateStr: '2026-09-10',
        accountId: 'acc-emp-a',
        members: [],
        sessions: [],
        orders,
        staffList,
        accountList,
      });

      expect(summary.salesDetails.length).toBe(1);
      const sale = summary.salesDetails[0];
      expect(sale.orderCode).toBe('HD00125');
      expect(sale.createdAt).toBe(restPeriodSaleTime);
      expect(sale.seller.employeeCode).toBe('NV001');
      expect(sale.seller.employeeName).toBe('Nguyễn Anh');
      expect(sale.items.length).toBe(2);
      expect(sale.items[0].productName).toBe('Abbott Grow 900g');
      expect(sale.items[0].quantity).toBe(2);
      expect(sale.items[1].productName).toBe('Vinamilk Yogurt');
      expect(sale.items[1].quantity).toBe(4);
      expect(sale.totalAmount).toBe(468000);
      expect(sale.isRestPeriodSale).toBe(true);
    });
  });

  // =========================================================================
  // 4. END-OF-DAY AUDIT (Items 19 to 24)
  // =========================================================================
  describe('4. END-OF-DAY AUDIT (Items 19 to 24)', () => {
    it('19, 20, 21, 22, 23 & 24. Generates complete End-of-Day Audit non-mutatively with store totals, employee summaries, traceable sales, and activity logs', async () => {
      const dateStr = '2026-09-10';

      const staffResA = await staffApi.create({ id: 'st-aud-a', employeeCode: 'NV001', name: 'Nguyễn Anh', isActive: true });
      const staffResB = await staffApi.create({ id: 'st-aud-b', employeeCode: 'NV002', name: 'Trần Bình', isActive: true });

      const accResA = await accountApi.create({ id: 'acc-aud-a', employeeId: staffResA.data.id, role: 'employee', pin: '123456', isActive: true });
      const accResB = await accountApi.create({ id: 'acc-aud-b', employeeId: staffResB.data.id, role: 'employee', pin: '123456', isActive: true });

      const sessRes = await workSessionApi.create({ id: 'ws-aud-1', code: 'CA-20260910-01', date: dateStr, shiftType: 'morning', status: 'closed' });

      await workSessionApi.createMember({
        id: 'm-aud-a',
        workSessionId: sessRes.data.id,
        accountId: accResA.data.id,
        shiftType: 'morning',
        businessDate: dateStr,
        checkInTime: '2026-09-10T00:35:00.000Z', // 07:35 VN
        checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN
        isLate: true,
        lateMinutes: 5,
        attendanceStatus: 'completed',
      });

      await workSessionApi.createMember({
        id: 'm-aud-b',
        workSessionId: sessRes.data.id,
        accountId: accResB.data.id,
        shiftType: 'morning',
        businessDate: dateStr,
        checkInTime: '2026-09-10T00:30:00.000Z', // 07:30 VN
        checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN
        isLate: false,
        lateMinutes: 0,
        attendanceStatus: 'completed',
      });

      await orderApi.create({
        id: 'ord-aud-1',
        code: 'HD-AUD-01',
        accountId: accResA.data.id,
        workSessionId: sessRes.data.id,
        totalAmount: 468000,
        status: 'completed',
        businessDate: dateStr,
        createdAt: '2026-09-10T02:12:15.000Z', // 09:12 VN
        items: [{ productId: 'p1', productName: 'Abbott Grow', quantity: 2, price: 234000 }],
      }, accResA.data);

      await orderApi.create({
        id: 'ord-aud-2',
        code: 'HD-AUD-02',
        accountId: accResB.data.id,
        workSessionId: sessRes.data.id,
        totalAmount: 625000,
        status: 'completed',
        businessDate: dateStr,
        createdAt: '2026-09-10T03:45:00.000Z', // 10:45 VN
        items: [{ productId: 'p2', productName: 'Aptamil', quantity: 1, price: 625000 }],
      }, accResB.data);

      // Fetch via reportApi as Admin
      const auditRes = await reportApi.getEndOfDayAudit({ date: dateStr, actor: adminActor });
      expect(auditRes.success).toBe(true);
      const audit = auditRes.data;

      // 19. Store-wide totals
      expect(audit.storeOverview.totalSessions).toBe(1);
      expect(audit.storeOverview.totalCompletedOrders).toBe(2);
      expect(audit.storeOverview.totalSalesRevenue).toBe(1093000);

      // 20 & 21. Employee work and sales summaries
      expect(audit.employeeSummaries.length).toBe(2);
      const summaryA = audit.employeeSummaries.find(e => e.employee.employeeCode === 'NV001');
      expect(summaryA.completedOrderCount).toBe(1);
      expect(summaryA.totalSalesAmount).toBe(468000);
      expect(summaryA.totalWorkMinutes).toBe(265);

      // 22. Traceable sales
      expect(audit.salesDetails.length).toBe(2);
      expect(audit.salesDetails[0].seller.employeeCode).toBe('NV001');
      expect(audit.salesDetails[1].seller.employeeCode).toBe('NV002');

      // 23. Consistency View
      expect(audit.consistency.isConsistent).toBe(true);
      expect(audit.consistency.completedOrdersCount).toBe(2);

      // 24. Historical data remains intact (no mutations)
      const sessionAfter = (await workSessionApi.getById('ws-aud-1')).data;
      expect(sessionAfter).toBeDefined();
    });
  });

  // =========================================================================
  // 5. DATA SCOPE & ISOLATION (Items 25 to 31)
  // =========================================================================
  describe('5. DATA SCOPE & ACCESS ISOLATION (Items 25 to 31)', () => {
    it('25. Admin can view all employee reports and store-wide audit', async () => {
      const dailyRes = await reportApi.getAllDailyWorkReports({ date: '2026-09-10', actor: adminActor });
      expect(dailyRes.success).toBe(true);
      expect(Array.isArray(dailyRes.data)).toBe(true);

      const auditRes = await reportApi.getEndOfDayAudit({ date: '2026-09-10', actor: adminActor });
      expect(auditRes.success).toBe(true);
    });

    it('26. Staff can view employee operational work reports and End-of-Day Audit', async () => {
      const dailyRes = await reportApi.getAllDailyWorkReports({ date: '2026-09-10', actor: staffActor });
      expect(dailyRes.success).toBe(true);

      const auditRes = await reportApi.getEndOfDayAudit({ date: '2026-09-10', actor: staffActor });
      expect(auditRes.success).toBe(true);
    });

    it('27 & 28. Employee can view only their own daily and monthly report', async () => {
      const empRes = await reportApi.getDailyWorkReport({ date: '2026-09-10', actor: employeeA });
      expect(empRes.success).toBe(true);
      expect(empRes.data.employee.accountId).toBe(employeeA.id);

      const monthRes = await reportApi.getMonthlyWorkReport({ month: '2026-09', actor: employeeA });
      expect(monthRes.success).toBe(true);
      expect(monthRes.data.employee.accountId).toBe(employeeA.id);
    });

    it('29, 30 & 31. Employee is strictly isolated from other employees reports and cannot bypass via query params', async () => {
      // 1. Employee trying to view all daily reports -> REJECTED
      await expect(
        reportApi.getAllDailyWorkReports({ date: '2026-09-10', actor: employeeA })
      ).rejects.toThrow(/PERMISSION_DENIED/i);

      // 2. Employee trying to view End-of-Day Audit -> REJECTED
      await expect(
        reportApi.getEndOfDayAudit({ date: '2026-09-10', actor: employeeA })
      ).rejects.toThrow(/PERMISSION_DENIED/i);

      // 3. Employee passing another employee's ID in parameters -> automatically overridden to own identity
      const manipulatedRes = await reportApi.getDailyWorkReport({
        date: '2026-09-10',
        employeeId: employeeB.employeeId, // attempted spoofing
        accountId: employeeB.id,
        actor: employeeA,
      });

      expect(manipulatedRes.data.employee.accountId).toBe(employeeA.id);
      expect(manipulatedRes.data.employee.employeeCode).toBe('NV001'); // strictly employeeA
    });
  });

  // =========================================================================
  // 6. REGRESSION TESTS (Items 32 to 36)
  // =========================================================================
  describe('6. REGRESSION INTEGRITY (Items 32 to 36)', () => {
    it('32 & 33. Existing WorkSession and Auth APIs continue to function normally', async () => {
      const activeSessions = (await workSessionApi.getActiveSessions()).data;
      expect(Array.isArray(activeSessions)).toBe(true);

      const staffList = (await staffApi.getAll()).data;
      expect(Array.isArray(staffList)).toBe(true);
    });

    it('34, 35 & 36. Existing order and inventory APIs remain unmodified', async () => {
      const orders = (await orderApi.getAll()).data;
      expect(Array.isArray(orders)).toBe(true);

      const transactions = (await inventoryApi.getAllTransactions()).data;
      expect(Array.isArray(transactions)).toBe(true);
    });
  });

  // =========================================================================
  // 7. UI COMPONENT RENDERING & TAB VISIBILITY TESTS
  // =========================================================================
  describe('7. UI COMPONENT RENDERING & ACCESS ISOLATION', () => {
    it('Renders ReportPage for Employee with Daily & Monthly tabs and hides End-of-Day Audit tab', async () => {
      const { renderWithProviders } = await import('./testUtils');
      const { default: ReportPage } = await import('../pages/Reports/ReportPage');
      const { screen, waitFor } = await import('@testing-library/react');

      renderWithProviders(<ReportPage />, {
        auth: {
          currentUser: employeeA,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          loading: false,
          can: () => false,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Báo cáo & Kiểm toán Ca làm việc/i)).toBeTruthy();
      });

      expect(screen.getByText(/Báo cáo Ngày/i)).toBeTruthy();
      expect(screen.getByText(/Báo cáo Tháng/i)).toBeTruthy();
      // Audit tab must NOT be visible to employee
      expect(screen.queryByText(/Kiểm toán Cuối ngày/i)).toBeNull();
    });

    it('Renders ReportPage for Admin/Staff with full access including End-of-Day Audit tab', async () => {
      const { renderWithProviders } = await import('./testUtils');
      const { default: ReportPage } = await import('../pages/Reports/ReportPage');
      const { screen, waitFor, fireEvent, act } = await import('@testing-library/react');

      renderWithProviders(<ReportPage />, {
        auth: {
          currentUser: adminActor,
          isAuthenticated: true,
          isAdmin: true,
          isStaff: false,
          loading: false,
          can: () => true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Báo cáo & Kiểm toán Ca làm việc/i)).toBeTruthy();
      }, { timeout: 4000 });

      expect(screen.getByText(/Báo cáo Ngày/i)).toBeTruthy();
      expect(screen.getByText(/Báo cáo Tháng/i)).toBeTruthy();
      expect(screen.getByText(/Kiểm toán Cuối ngày/i)).toBeTruthy();

      // Click on Audit tab
      const auditBtn = screen.getByRole('button', { name: /Kiểm toán Cuối ngày/i });
      await act(async () => {
        fireEvent.click(auditBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/Tổng quan hoạt động/i)).toBeTruthy();
      }, { timeout: 4000 });
    });
  });
});
