import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { workSessionApi } from '../api/workSessionApi';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';
import { orderApi } from '../api/orderApi';
import { reportApi } from '../api/reportApi';
import axiosClient from '../api/axiosClient';

import { ROLES } from '../utils/permissions';

describe('Chrome / Browser End-to-End Workflow Validation (Items 1 to 11)', () => {
  const adminActor = {
    id: 'acc-admin-val',
    employeeId: null,
    role: ROLES.ADMIN,
    name: 'Quản trị viên',
    email: 'admin@shop.vn',
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Performs complete 11-step lifecycle validation', async () => {
    // 1. Setup Employee & Account (Login as Employee NV001)
    const staffRes = await staffApi.create({
      id: 'st-val-001',
      employeeCode: 'NV001',
      name: 'Nguyễn Văn A',
      employmentStatus: 'working',
      isActive: true,
    }, adminActor);

    const accRes = await accountApi.create({
      id: 'acc-val-001',
      employeeId: staffRes.data.id,
      role: 'employee',
      pin: '123456',
      isActive: true,
    }, adminActor);

    const employeeActor = {
      id: accRes.data.id,
      employeeId: staffRes.data.id,
      role: ROLES.EMPLOYEE,
      name: 'Nguyễn Văn A',
      employeeCode: 'NV001',
      isActive: true,
    };

    // 2. WorkSession & WorkSessionMember is created normally
    const fixedTime = new Date(2026, 8, 11, 8, 30, 0); // 08:30 AM local time
    const { workSession, isLate, lateMinutes } = await workSessionApi.getOrCreateWorkSession(fixedTime, false);
    expect(workSession).toBeDefined();
    expect(workSession.date).toBe('2026-09-11');
    expect(workSession.status).toBe('active');

    const memberRes = await workSessionApi.createMember({
      id: 'wsm-val-001',
      workSessionId: workSession.id,
      accountId: employeeActor.id,
      shiftType: 'morning',
      businessDate: '2026-09-11',
      attendanceStatus: 'present',
      checkInTime: fixedTime.toISOString(),
      checkOutTime: null,
      workingStatus: 'active',
      isLate,
      lateMinutes,
    });
    expect(memberRes.data.id).toBe('wsm-val-001');

    // 3. Check-in is recorded
    const checkInRes = await workSessionApi.checkIn('wsm-val-001');
    expect(checkInRes.attendanceStatus).toBe('present');
    expect(checkInRes.checkInTime).toBe(fixedTime.toISOString());
    expect(checkInRes.workingStatus).toBe('active');

    // Record an order in this session
    await orderApi.create({
      id: 'ord-val-001',
      code: 'HD-VAL-001',
      workSessionId: workSession.id,
      accountId: employeeActor.id,
      sellerId: employeeActor.id,
      status: 'completed',
      totalAmount: 350000,
      businessDate: '2026-09-11',
      items: [{ productId: 'p1', quantity: 1, price: 350000 }],
      createdAt: '2026-09-11T09:30:00+07:00',
    }, employeeActor);

    // 4. WorkSessionMember remains after checkout
    const checkOutRes = await workSessionApi.checkOut('wsm-val-001');
    expect(checkOutRes.attendanceStatus).toBe('completed');
    expect(checkOutRes.checkOutTime).not.toBeNull();
    expect(checkOutRes.workingStatus).toBe('offline');

    // Simulate shift end timestamp (07:30 to 12:00 VN)
    await workSessionApi.patchMember('wsm-val-001', {
      shiftType: 'morning',
      checkInTime: '2026-09-11T07:30:00+07:00',
      checkOutTime: '2026-09-11T12:00:00+07:00',
    });

    const memberAfterCheckout = (await workSessionApi.getMemberById('wsm-val-001')).data;
    expect(memberAfterCheckout).toBeDefined();
    expect(memberAfterCheckout.attendanceStatus).toBe('completed');

    // 5 & 6. Historical WorkSessionMember remains after date change / session auto-close
    await workSessionApi.autoClosePastSessions('2026-09-12');

    const memberAfterLogout = (await workSessionApi.getMemberById('wsm-val-001')).data;
    expect(memberAfterLogout).toBeDefined();
    expect(memberAfterLogout.id).toBe('wsm-val-001');

    // 7. Deactivating the employee does not remove the historical record
    await staffApi.softDelete(staffRes.data.id, adminActor);
    await accountApi.updateStatus(accRes.data.id, false, adminActor);

    const memberAfterDeactivation = (await workSessionApi.getMemberById('wsm-val-001')).data;
    expect(memberAfterDeactivation).toBeDefined();
    expect(memberAfterDeactivation.id).toBe('wsm-val-001');

    const allMembersInDb = (await workSessionApi.getMembers()).data;
    expect(allMembersInDb.some(m => m.id === 'wsm-val-001')).toBe(true);

    // 8. Daily report still shows the historical work
    const dailyReport = await reportApi.getDailyWorkReport({
      date: '2026-09-11',
      employeeId: staffRes.data.id,
      actor: adminActor,
    });
    expect(dailyReport.data.shiftsParticipated.length).toBe(1);
    expect(dailyReport.data.shiftsParticipated[0].workSessionId).toBe(workSession.id);
    expect(dailyReport.data.totalWorkMinutes).toBeGreaterThan(0);
    expect(dailyReport.data.totalSalesAmount).toBe(350000);

    // 9. Monthly report still includes the historical work
    const monthlyReport = await reportApi.getMonthlyWorkReport({
      month: '2026-09',
      employeeId: staffRes.data.id,
      actor: adminActor,
    });
    expect(monthlyReport.data.totalWorkMinutes).toBeGreaterThan(0);
    expect(monthlyReport.data.totalWorkingDays).toBe(1);
    expect(monthlyReport.data.totalSalesAmount).toBe(350000);

    // 10. End-of-Day Audit still sees the participation
    const auditReport = await reportApi.getEndOfDayAudit({
      date: '2026-09-11',
      actor: adminActor,
    });
    expect(auditReport.data.employeeSummaries.some(e => e.employee.employeeId === staffRes.data.id)).toBe(true);
    expect(auditReport.data.storeOverview.totalSalesRevenue).toBe(350000);

    // 11. No normal UI or API action can delete the WorkSessionMember
    expect(() => workSessionApi.removeMember('wsm-val-001')).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÔNG ĐƯỢC PHÉP XÓA/i);
    expect(() => workSessionApi.removeMember('wsm-val-001', adminActor)).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÔNG ĐƯỢC PHÉP XÓA/i);
    await expect(axiosClient.delete('/workSessionMembers/wsm-val-001')).rejects.toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÔNG ĐƯỢC PHÉP XÓA/i);

    // Confirm underlying data still remains completely intact
    const finalStoredMember = (await workSessionApi.getMemberById('wsm-val-001')).data;
    expect(finalStoredMember).toBeDefined();
    expect(finalStoredMember.id).toBe('wsm-val-001');
  });
});
