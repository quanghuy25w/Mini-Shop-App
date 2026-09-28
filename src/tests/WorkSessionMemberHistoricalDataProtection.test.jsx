import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { workSessionApi } from '../api/workSessionApi';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';
import { orderApi } from '../api/orderApi';
import { reportApi } from '../api/reportApi';
import axiosClient from '../api/axiosClient';

import { ROLES } from '../utils/permissions';

describe('WorkSessionMember Historical Data Protection Test Suite (Phase 10 Requirements)', () => {
  const adminActor = {
    id: 'acc-admin-hist',
    employeeId: null,
    role: ROLES.ADMIN,
    name: 'Quáº£n trá»‹ viÃªn',
    email: 'admin@shop.vn',
    isActive: true,
  };

  const staffActor = {
    id: 'acc-staff-hist',
    employeeId: 'st-staff-hist',
    role: ROLES.STAFF,
    name: 'Quáº£n lÃ½ Ca',
    employeeCode: 'NVSTAFF',
    isActive: true,
  };

  const employeeActor = {
    id: 'acc-emp-hist',
    employeeId: 'st-emp-hist',
    role: ROLES.EMPLOYEE,
    name: 'NhÃ¢n viÃªn A',
    employeeCode: 'NV001',
    isActive: true,
  };

  beforeEach(async () => {
    // Step 1: clear all (both real localStorage and in-memory store)
    localStorage.clear();
    // Step 2: re-seed base data (categories, products, staff, accounts from db.json)
    initSeedData();
    // Step 3: reset WorkSession-related collections to empty so this test controls them
    localStorage.setItem('minishop_workSessions', '[]');
    localStorage.setItem('minishop_workSessionMembers', '[]');
    localStorage.setItem('minishop_orders', '[]');
    localStorage.setItem('minishop_activityLogs', '[]');

    // Create baseline staff and accounts
    await staffApi.create({
      id: 'st-emp-hist',
      employeeCode: 'NV001',
      name: 'NhÃ¢n viÃªn A',
      employmentStatus: 'working',
      isActive: true,
    }, adminActor);

    await accountApi.create({
      id: 'acc-emp-hist',
      employeeId: 'st-emp-hist',
      role: 'employee',
      pin: '123456',
      isActive: true,
    }, adminActor);

    // Create baseline historical session
    await workSessionApi.create({
      id: 'ws-hist-001',
      code: 'CA-20260910-01',
      date: '2026-09-10',
      shiftType: 'morning',
      name: 'Ca sÃ¡ng 10/09',
      startTime: '2026-09-10T00:30:00.000Z', // 07:30 VN
      endTime: '2026-09-10T05:00:00.000Z',   // 12:00 VN
      status: 'closed',
      initialCash: 1000000,
      actualCash: 1500000,
      totalRevenue: 500000,
      totalOrders: 1,
    });

    // Create baseline historical member
    await workSessionApi.createMember({
      id: 'wsm-hist-001',
      workSessionId: 'ws-hist-001',
      accountId: 'acc-emp-hist',
      shiftType: 'morning',
      businessDate: '2026-09-10',
      attendanceStatus: 'completed',
      checkInTime: '2026-09-10T00:35:00.000Z', // 07:35 VN
      checkOutTime: '2026-09-10T05:00:00.000Z', // 12:00 VN
      workingStatus: 'offline',
      isLate: true,
      lateMinutes: 5,
      note: 'NhÃ¢n viÃªn ca sÃ¡ng',
    });

    // Create baseline completed order attached to session
    await orderApi.create({
      id: 'ord-hist-001',
      code: 'HD-001',
      workSessionId: 'ws-hist-001',
      accountId: 'acc-emp-hist',
      sellerId: 'acc-emp-hist',
      status: 'completed',
      totalAmount: 500000, items: [{ productId: 'p1', quantity: 2, price: 250000 }],
      businessDate: '2026-09-10',
      createdAt: '2026-09-10T02:00:00.000Z', // 09:00 VN
    }, employeeActor);
  });

  // =========================================================================
  // DELETION PROTECTION (Requirements 1 to 8)
  // =========================================================================
  describe('DELETION PROTECTION', () => {
    it('1. workSessionApi.removeMember(existingHistoricalMember) is rejected', () => {
      expect(() => {
        workSessionApi.removeMember('wsm-hist-001');
      }).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);
    });

    it('2. Admin cannot delete a historical WorkSessionMember', () => {
      expect(() => {
        workSessionApi.removeMember('wsm-hist-001', adminActor);
      }).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);
    });

    it('3. Staff cannot delete a historical WorkSessionMember', () => {
      expect(() => {
        workSessionApi.removeMember('wsm-hist-001', staffActor);
      }).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);
    });

    it('4. Employee cannot delete a historical WorkSessionMember', () => {
      expect(() => {
        workSessionApi.removeMember('wsm-hist-001', employeeActor);
      }).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);
    });

    it('5. Unauthenticated caller cannot delete a historical WorkSessionMember (via API or raw DELETE)', async () => {
      // Direct API method
      expect(() => {
        workSessionApi.removeMember('wsm-hist-001', null);
      }).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);

      // Raw axiosClient DELETE
      await expect(
        axiosClient.delete('/workSessionMembers/wsm-hist-001')
      ).rejects.toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);
    });

    it('6. Attempted deletion does not remove the record from storage', async () => {
      try {
        workSessionApi.removeMember('wsm-hist-001');
      } catch {
        // expected error
      }

      const memberRes = await workSessionApi.getMemberById('wsm-hist-001');
      expect(memberRes.data).toBeDefined();
      expect(memberRes.data.id).toBe('wsm-hist-001');
      expect(memberRes.data.attendanceStatus).toBe('completed');
    });

    it('7. Attempted deletion does not alter WorkSession history', async () => {
      try {
        workSessionApi.removeMember('wsm-hist-001');
      } catch {
        // expected error
      }

      const sessionRes = await workSessionApi.getById('ws-hist-001');
      expect(sessionRes.data.status).toBe('closed');
      expect(sessionRes.data.totalRevenue).toBe(500000);

      const membersRes = await workSessionApi.getMembersBySessionId('ws-hist-001');
      expect(membersRes.data.length).toBe(1);
      expect(membersRes.data[0].id).toBe('wsm-hist-001');
    });

    it('8. Attempted deletion does not alter reporting results', async () => {
      try {
        workSessionApi.removeMember('wsm-hist-001');
      } catch {
        // expected error
      }

      const reportRes = await reportApi.getDailyWorkReport({
        date: '2026-09-10',
        employeeId: 'st-emp-hist',
        actor: adminActor,
      });

      expect(reportRes.data.shiftsParticipated.length).toBe(1);
      expect(reportRes.data.totalWorkMinutes).toBe(265);
      expect(reportRes.data.totalWorkDuration.formatted).toBe('4h25');
      expect(reportRes.data.isLate).toBe(true);
      expect(reportRes.data.totalLateMinutes).toBe(5);
    });
  });

  // =========================================================================
  // EMPLOYEE DEACTIVATION (Requirements 9 to 11)
  // =========================================================================
  describe('EMPLOYEE DEACTIVATION', () => {
    it('9. Deactivating an employee does not delete historical WorkSessionMembers', async () => {
      // Deactivate staff
      await staffApi.patch('st-emp-hist', {
        isActive: false,
        employmentStatus: 'resigned',
        updatedAt: new Date().toISOString(),
      }, adminActor);

      const members = (await workSessionApi.getMembers({ accountId: 'acc-emp-hist' })).data;
      expect(members.length).toBe(1);
      expect(members[0].id).toBe('wsm-hist-001');
    });

    it('10. Deactivating an account does not delete historical WorkSessionMembers', async () => {
      // Deactivate account
      await accountApi.updateStatus('acc-emp-hist', false, adminActor);

      const members = (await workSessionApi.getMembers({ accountId: 'acc-emp-hist' })).data;
      expect(members.length).toBe(1);
      expect(members[0].id).toBe('wsm-hist-001');
    });

    it('11. Historical WorkSessionMember records remain queryable after deactivation', async () => {
      // Deactivate both staff and account
      await staffApi.softDelete('st-emp-hist', adminActor);
      await accountApi.updateStatus('acc-emp-hist', false, adminActor);

      const member = (await workSessionApi.getMemberById('wsm-hist-001')).data;
      expect(member).toBeDefined();
      expect(member.workSessionId).toBe('ws-hist-001');
      expect(member.isLate).toBe(true);
      expect(member.lateMinutes).toBe(5);

      const membersInSession = (await workSessionApi.getMembersBySessionId('ws-hist-001')).data;
      expect(membersInSession.length).toBe(1);
      expect(membersInSession[0].id).toBe('wsm-hist-001');
    });
  });

  // =========================================================================
  // LEGITIMATE UPDATES (Requirements 12 to 15)
  // =========================================================================
  describe('LEGITIMATE UPDATES', () => {
    it('12. Check-in still updates the existing WorkSessionMember', async () => {
      // Create new session & planned member
      await workSessionApi.create({
        id: 'ws-today',
        code: 'CA-20260911-01',
        date: '2026-09-11',
        shiftType: 'morning',
        status: 'planned',
      });

      const createRes = await workSessionApi.createMember({
        id: 'wsm-today-01',
        workSessionId: 'ws-today',
        accountId: 'acc-emp-hist',
        attendanceStatus: 'planned',
        checkInTime: null,
        workingStatus: 'offline',
      });
      expect(createRes.data.attendanceStatus).toBe('planned');

      const checkedIn = await workSessionApi.checkIn('wsm-today-01');
      expect(checkedIn.attendanceStatus).toBe('present');
      expect(checkedIn.checkInTime).not.toBeNull();
      expect(checkedIn.workingStatus).toBe('active');

      const stored = (await workSessionApi.getMemberById('wsm-today-01')).data;
      expect(stored.attendanceStatus).toBe('present');
      expect(stored.workingStatus).toBe('active');
    });

    it('13. Check-out still updates the existing WorkSessionMember', async () => {
      await workSessionApi.create({
        id: 'ws-checkout-test',
        code: 'CA-20260911-02',
        date: '2026-09-11',
        shiftType: 'morning',
        status: 'active',
      });

      await workSessionApi.createMember({
        id: 'wsm-checkout-01',
        workSessionId: 'ws-checkout-test',
        accountId: 'acc-emp-hist',
        attendanceStatus: 'present',
        checkInTime: '2026-09-11T07:30:00.000Z',
        workingStatus: 'active',
      });

      const checkedOut = await workSessionApi.checkOut('wsm-checkout-01');
      expect(checkedOut.attendanceStatus).toBe('completed');
      expect(checkedOut.checkOutTime).not.toBeNull();
      expect(checkedOut.workingStatus).toBe('offline');

      const stored = (await workSessionApi.getMemberById('wsm-checkout-01')).data;
      expect(stored.attendanceStatus).toBe('completed');
      expect(stored.workingStatus).toBe('offline');
    });

    it('14. Working status updates still work (active -> busy -> active)', async () => {
      await workSessionApi.create({
        id: 'ws-status-session',
        code: 'CA-20260912-01',
        date: '2026-09-12',
        shiftType: 'morning',
        status: 'active',
      });

      await workSessionApi.createMember({
        id: 'wsm-status-test',
        workSessionId: 'ws-status-session',
        accountId: 'acc-emp-hist',
        attendanceStatus: 'present',
        workingStatus: 'active',
      });

      await workSessionApi.updateWorkingStatus('wsm-status-test', 'busy');
      let member = (await workSessionApi.getMemberById('wsm-status-test')).data;
      expect(member.workingStatus).toBe('busy');

      await workSessionApi.updateWorkingStatus('wsm-status-test', 'active');
      member = (await workSessionApi.getMemberById('wsm-status-test')).data;
      expect(member.workingStatus).toBe('active');
    });

    it('15. Late information remains stored accurately', async () => {
      await workSessionApi.create({
        id: 'ws-late-session',
        code: 'CA-20260912-02',
        date: '2026-09-12',
        shiftType: 'morning',
        status: 'active',
      });

      await workSessionApi.createMember({
        id: 'wsm-late-test',
        workSessionId: 'ws-late-session',
        accountId: 'acc-emp-hist',
        attendanceStatus: 'present',
        isLate: true,
        lateMinutes: 25,
      });

      const member = (await workSessionApi.getMemberById('wsm-late-test')).data;
      expect(member.isLate).toBe(true);
      expect(member.lateMinutes).toBe(25);
    });
  });

  // =========================================================================
  // REPORTING & AUDIT INTEGRITY (Requirements 16 to 18)
  // =========================================================================
  describe('REPORTING INTEGRITY', () => {
    it('16. Daily Work Report still includes historical participation after employee deactivation', async () => {
      // Deactivate staff
      await staffApi.softDelete('st-emp-hist', adminActor);

      const reportRes = await reportApi.getDailyWorkReport({
        date: '2026-09-10',
        employeeId: 'st-emp-hist',
        actor: adminActor,
      });

      expect(reportRes.data.shiftsParticipated.length).toBe(1);
      expect(reportRes.data.shiftsParticipated[0].workSessionCode).toBe('CA-20260910-01');
      expect(reportRes.data.totalWorkMinutes).toBe(265);
      expect(reportRes.data.isLate).toBe(true);
      expect(reportRes.data.totalLateMinutes).toBe(5);
    });

    it('17. Monthly Work Report still includes historical participation', async () => {
      const monthlyRes = await reportApi.getMonthlyWorkReport({
        month: '2026-09',
        employeeId: 'st-emp-hist',
        actor: adminActor,
      });

      expect(monthlyRes.data.totalWorkMinutes).toBe(265);
      expect(monthlyRes.data.totalWorkingDays).toBe(1);
      expect(monthlyRes.data.dailyBreakdown.length).toBe(1);
      expect(monthlyRes.data.dailyBreakdown[0].date).toBe('2026-09-10');
      expect(monthlyRes.data.dailyBreakdown[0].shiftsCount).toBe(1);
    });

    it('18. End-of-Day Audit still includes historical participation', async () => {
      const auditRes = await reportApi.getEndOfDayAudit({
        date: '2026-09-10',
        actor: adminActor,
      });

      expect(auditRes.data.employeeSummaries.length).toBe(1);
      expect(auditRes.data.employeeSummaries[0].employee.name).toBe('NhÃ¢n viÃªn A');
      expect(auditRes.data.employeeSummaries[0].shiftsParticipated.length).toBe(1);
      expect(auditRes.data.employeeSummaries[0].shiftsParticipated[0].workSessionCode).toBe('CA-20260910-01');
    });
  });

  // =========================================================================
  // WORKSESSION DELETION INTERACTION (Requirements 19 to 20)
  // =========================================================================
  describe('WORKSESSION DELETION INTERACTION', () => {
    it('19. Existing WorkSession deletion protection remains intact', async () => {
      expect(() => {
        workSessionApi.remove('ws-hist-001', adminActor);
      }).toThrow(/KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);

      await expect(
        axiosClient.delete('/workSessions/ws-hist-001')
      ).rejects.toThrow(/KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);

      const session = (await workSessionApi.getById('ws-hist-001')).data;
      expect(session).toBeDefined();
    });

    it('20. No cascade deletion removes WorkSessionMembers', async () => {
      try {
        workSessionApi.remove('ws-hist-001', adminActor);
      } catch {
        // expected
      }

      try {
        await axiosClient.delete('/workSessions/ws-hist-001');
      } catch {
        // expected
      }

      const members = (await workSessionApi.getMembersBySessionId('ws-hist-001')).data;
      expect(members.length).toBe(1);
      expect(members[0].id).toBe('wsm-hist-001');
    });
  });
});
