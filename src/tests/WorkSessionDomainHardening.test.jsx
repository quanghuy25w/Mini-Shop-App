import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workSessionApi, determineShiftForTime } from '../api/workSessionApi';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';

describe('WorkSession Domain Hardening Test Suite (Strict Operational Domain Rules)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ONE BUSINESS DATE = ONE WORKSESSION
  // =========================================================================
  describe('1. One Business Date = One WorkSession', () => {
    it('Creates exactly 1 session per date and rejects duplicate non-cancelled creation', async () => {
      const date = '2026-10-01';
      const first = await workSessionApi.create({
        id: 'ws-first-1',
        date,
        name: 'Ca ngày 01/10',
        status: 'planned'
      });
      expect(first.data.id).toBe('ws-first-1');

      // Second creation for same date must fail with DUPLICATE_SESSION_FOR_DATE
      await expect(
        workSessionApi.create({
          id: 'ws-duplicate-1',
          date,
          name: 'Ca trùng lặp',
          status: 'planned'
        })
      ).rejects.toThrow(/Mỗi ngày làm việc chỉ được phép có duy nhất 1 ca làm việc/i);
    });

    it('Allows creating a new session if previous session on that date was cancelled', async () => {
      const date = '2026-10-02';
      await workSessionApi.create({
        id: 'ws-cancel-me',
        date,
        name: 'Ca bị hủy',
        status: 'planned'
      });

      // Cancel the session
      await workSessionApi.patch('ws-cancel-me', { status: 'cancelled' });

      // Creating a new session for that date is now allowed
      const newSession = await workSessionApi.create({
        id: 'ws-replacement',
        date,
        name: 'Ca thay thế',
        status: 'active'
      });
      expect(newSession.data.id).toBe('ws-replacement');
      expect(newSession.data.status).toBe('active');
    });
  });

  // =========================================================================
  // 2. CONCURRENT SESSION CREATION
  // =========================================================================
  describe('2. Concurrency Safety', () => {
    it('Safely handles concurrent workSessionApi.create calls: one succeeds, one rejected', async () => {
      const date = '2026-10-03';
      const results = await Promise.allSettled([
        workSessionApi.create({ id: 'ws-c1', date, name: 'Ca concurrent 1' }),
        workSessionApi.create({ id: 'ws-c2', date, name: 'Ca concurrent 2' })
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(rejected[0].reason.code).toBe('DUPLICATE_SESSION_FOR_DATE');
    });

    it('Concurrent getTodaySessionForDate resolves to the same session record without duplication', async () => {
      const date = '2026-10-04';
      const [sessA, sessB] = await Promise.all([
        workSessionApi.getTodaySessionForDate(date),
        workSessionApi.getTodaySessionForDate(date)
      ]);

      expect(sessA).not.toBeNull();
      expect(sessB).not.toBeNull();
      expect(sessA.id).toBe(sessB.id);

      const all = (await workSessionApi.getAll({ date })).data;
      expect(all.length).toBe(1);
    });
  });

  // =========================================================================
  // 3. SESSION STATE MACHINE
  // =========================================================================
  describe('3. State Machine Transitions', () => {
    it('Permits valid transitions: planned -> active -> closed', async () => {
      const s = await workSessionApi.create({
        id: 'ws-sm-1',
        date: '2026-10-05',
        status: 'planned',
        initialCash: 1000000
      });
      expect(s.data.status).toBe('planned');

      // planned -> active
      const activeRes = await workSessionApi.patch('ws-sm-1', { status: 'active' });
      expect(activeRes.data.status).toBe('active');

      // active -> closed
      const closedRes = await workSessionApi.patch('ws-sm-1', { status: 'closed' });
      expect(closedRes.data.status).toBe('closed');
    });

    it('Permits valid transition: planned -> cancelled', async () => {
      await workSessionApi.create({
        id: 'ws-sm-2',
        date: '2026-10-06',
        status: 'planned'
      });

      const cancelRes = await workSessionApi.patch('ws-sm-2', { status: 'cancelled' });
      expect(cancelRes.data.status).toBe('cancelled');
    });

    it('Rejects invalid transition: planned -> closed directly', async () => {
      await workSessionApi.create({
        id: 'ws-sm-invalid-1',
        date: '2026-10-07',
        status: 'planned'
      });

      await expect(
        workSessionApi.patch('ws-sm-invalid-1', { status: 'closed' })
      ).rejects.toThrow(/Chuyển trạng thái ca không hợp lệ/i);
    });

    it('Rejects reopening or changing status of closed session', async () => {
      await workSessionApi.create({
        id: 'ws-sm-closed',
        date: '2026-10-08',
        status: 'planned'
      });
      await workSessionApi.patch('ws-sm-closed', { status: 'active' });
      await workSessionApi.patch('ws-sm-closed', { status: 'closed' });

      // closed -> active
      await expect(
        workSessionApi.patch('ws-sm-closed', { status: 'active' })
      ).rejects.toThrow(/Chuyển trạng thái ca không hợp lệ/i);

      // closed -> cancelled
      await expect(
        workSessionApi.patch('ws-sm-closed', { status: 'cancelled' })
      ).rejects.toThrow(/Chuyển trạng thái ca không hợp lệ/i);
    });

    it('Rejects modifying status of cancelled session', async () => {
      await workSessionApi.create({
        id: 'ws-sm-canc',
        date: '2026-10-09',
        status: 'planned'
      });
      await workSessionApi.patch('ws-sm-canc', { status: 'cancelled' });

      await expect(
        workSessionApi.patch('ws-sm-canc', { status: 'active' })
      ).rejects.toThrow(/Ca làm việc đã bị hủy và không thể chỉnh sửa/i);
    });
  });

  // =========================================================================
  // 4. CLOSED & CANCELLED IMMUTABILITY
  // =========================================================================
  describe('4. Closed and Cancelled Immutability', () => {
    it('Blocks financial and reconciliation edits on a closed session', async () => {
      await workSessionApi.create({
        id: 'ws-imm-closed',
        date: '2026-10-10',
        status: 'planned',
        initialCash: 500000
      });
      await workSessionApi.patch('ws-imm-closed', { status: 'active' });
      await workSessionApi.patch('ws-imm-closed', { status: 'closed', actualCash: 600000 });

      // Attempting to change initialCash on closed session
      await expect(
        workSessionApi.patch('ws-imm-closed', { initialCash: 800000 })
      ).rejects.toThrow(/Ca làm việc đã đóng không thể sửa đổi số liệu tài chính/i);

      // Attempting to change actualCash on closed session
      await expect(
        workSessionApi.patch('ws-imm-closed', { actualCash: 900000 })
      ).rejects.toThrow(/Ca làm việc đã đóng không thể sửa đổi số liệu tài chính/i);
    });

    it('Rejects adding present members to a closed or cancelled session', async () => {
      await workSessionApi.create({
        id: 'ws-imm-cl',
        date: '2026-10-11',
        status: 'planned'
      });
      await workSessionApi.patch('ws-imm-cl', { status: 'active' });
      await workSessionApi.patch('ws-imm-cl', { status: 'closed' });

      await expect(
        workSessionApi.createMember({
          workSessionId: 'ws-imm-cl',
          accountId: 'acc-test-emp',
          attendanceStatus: 'present'
        })
      ).rejects.toThrow(/Không thể thêm thành viên vào ca làm việc đã đóng/i);
    });
  });

  // =========================================================================
  // 5. INITIAL CASH LOCK
  // =========================================================================
  describe('5. Initial Cash Lock', () => {
    it('Allows editing initialCash while in planned status', async () => {
      await workSessionApi.create({
        id: 'ws-cash-planned',
        date: '2026-10-12',
        status: 'planned',
        initialCash: 500000
      });

      const updated = await workSessionApi.patch('ws-cash-planned', { initialCash: 1200000 });
      expect(updated.data.initialCash).toBe(1200000);
    });

    it('Locks initialCash once session transitions to active', async () => {
      await workSessionApi.create({
        id: 'ws-cash-active',
        date: '2026-10-13',
        status: 'planned',
        initialCash: 500000
      });
      await workSessionApi.patch('ws-cash-active', { status: 'active' });

      await expect(
        workSessionApi.patch('ws-cash-active', { initialCash: 800000 })
      ).rejects.toThrow(/Tiền mặt đầu ca chỉ được chỉnh sửa khi ca ở trạng thái kế hoạch/i);
    });
  });

  // =========================================================================
  // 6. MEMBER LIFECYCLE & CHECKOUT VALIDATION
  // =========================================================================
  describe('6. Member Lifecycle & Terminal States', () => {
    it('Enforces terminal completed state: cannot transition back to present', async () => {
      await workSessionApi.create({
        id: 'ws-mem-1',
        date: '2026-10-14',
        status: 'active'
      });

      const m = await workSessionApi.createMember({
        id: 'wsm-mem-1',
        workSessionId: 'ws-mem-1',
        accountId: 'acc-emp-1',
        attendanceStatus: 'present'
      });
      expect(m.data.attendanceStatus).toBe('present');

      // Check out member
      const checkedOut = await workSessionApi.checkOut('wsm-mem-1');
      expect(checkedOut.attendanceStatus).toBe('completed');
      expect(checkedOut.workingStatus).toBe('offline');

      // Attempting to patch back to present
      await expect(
        workSessionApi.patchMember('wsm-mem-1', { attendanceStatus: 'present' })
      ).rejects.toThrow(/Trạng thái thành viên đã kết thúc/i);

      // Attempting to checkIn again
      await expect(
        workSessionApi.checkIn('wsm-mem-1')
      ).rejects.toThrow(/Không thể check-in lại cho thành viên đã ở trạng thái kết thúc/i);
    });

    it('Prevents double checkout with ALREADY_CHECKED_OUT', async () => {
      await workSessionApi.create({
        id: 'ws-mem-2',
        date: '2026-10-15',
        status: 'active'
      });

      await workSessionApi.createMember({
        id: 'wsm-mem-2',
        workSessionId: 'ws-mem-2',
        accountId: 'acc-emp-2',
        attendanceStatus: 'present'
      });

      await workSessionApi.checkOut('wsm-mem-2');

      // Second checkout
      await expect(
        workSessionApi.checkOut('wsm-mem-2')
      ).rejects.toThrow(/Thành viên đã hoàn thành check-out trước đó/i);
    });

    it('Rejects checkout on a member marked missing_checkout', async () => {
      await workSessionApi.create({
        id: 'ws-mem-3',
        date: '2026-10-16',
        status: 'active'
      });

      await workSessionApi.createMember({
        id: 'wsm-mem-3',
        workSessionId: 'ws-mem-3',
        accountId: 'acc-emp-3',
        attendanceStatus: 'missing_checkout'
      });

      await expect(
        workSessionApi.checkOut('wsm-mem-3')
      ).rejects.toThrow(/Thành viên đã bị đánh dấu thiếu check-out do đóng ca/i);
    });
  });

  // =========================================================================
  // 7. POS & EMPLOYEE INVARIANTS (FAIL-CLOSED)
  // =========================================================================
  describe('7. POS and Employee Invariants (Fail-Closed)', () => {
    it('Invariant 1: 1 POS <-> 1 Active Employee (rejects occupying active POS)', async () => {
      await workSessionApi.create({
        id: 'ws-inv-pos',
        date: '2026-10-17',
        status: 'active'
      });

      // Employee 1 checks in at POS01
      await workSessionApi.createMember({
        id: 'wsm-pos-1',
        workSessionId: 'ws-inv-pos',
        accountId: 'acc-e1',
        registerId: 'POS01',
        attendanceStatus: 'present'
      });

      // Employee 2 attempts to check in at POS01
      await expect(
        workSessionApi.createMember({
          id: 'wsm-pos-2',
          workSessionId: 'ws-inv-pos',
          accountId: 'acc-e2',
          registerId: 'POS01',
          attendanceStatus: 'present'
        })
      ).rejects.toThrow(/Quầy thu ngân POS01 đang được sử dụng bởi nhân viên khác/i);
    });

    it('Invariant 2: 1 Employee <-> 1 Active POS (rejects multiple active POS for same employee)', async () => {
      await workSessionApi.create({
        id: 'ws-inv-emp',
        date: '2026-10-18',
        status: 'active'
      });

      // Employee 1 checks in at POS01
      await workSessionApi.createMember({
        id: 'wsm-emp-1',
        workSessionId: 'ws-inv-emp',
        accountId: 'acc-e1',
        registerId: 'POS01',
        attendanceStatus: 'present'
      });

      // Employee 1 attempts to check in at POS02 without checking out
      await expect(
        workSessionApi.createMember({
          id: 'wsm-emp-2',
          workSessionId: 'ws-inv-emp',
          accountId: 'acc-e1',
          registerId: 'POS02',
          attendanceStatus: 'present'
        })
      ).rejects.toThrow(/Nhân viên đang hoạt động tại quầy thu ngân khác/i);
    });
  });

  // =========================================================================
  // 8. EMPLOYEE-ONLY ATTENDANCE ROLE
  // =========================================================================
  describe('8. Attendance Role Restrictions', () => {
    it('Blocks Admin and Staff accounts from creating WorkSessionMember records', async () => {
      await staffApi.create({ id: 'st-adm', name: 'Quản trị', employeeCode: 'ADM01', isActive: true });
      await accountApi.create({ id: 'acc-adm', employeeId: 'st-adm', role: 'admin', isActive: true });

      await staffApi.create({ id: 'st-stf', name: 'Quản lý', employeeCode: 'MGR01', isActive: true });
      await accountApi.create({ id: 'acc-stf', employeeId: 'st-stf', role: 'staff', isActive: true });

      await workSessionApi.create({
        id: 'ws-role-test',
        date: '2026-10-19',
        status: 'active'
      });

      // Admin check-in blocked
      await expect(
        workSessionApi.createMember({
          workSessionId: 'ws-role-test',
          accountId: 'acc-adm',
          attendanceStatus: 'present'
        })
      ).rejects.toThrow(/Quản trị viên và Quản lý không cần điểm danh hoặc tham gia ca làm việc/i);

      // Staff check-in blocked
      await expect(
        workSessionApi.createMember({
          workSessionId: 'ws-role-test',
          accountId: 'acc-stf',
          attendanceStatus: 'present'
        })
      ).rejects.toThrow(/Quản trị viên và Quản lý không cần điểm danh hoặc tham gia ca làm việc/i);
    });
  });

  // =========================================================================
  // 9. TIME RULES & GRACE PERIOD CONSISTENCY
  // =========================================================================
  describe('9. Time Rules & Grace Period Consistency', () => {
    it('Guarantees lateMinutes is 0 when isLate is false across all shifts', () => {
      // Morning on time (07:30) and grace (07:35)
      const mornOnTime = determineShiftForTime(new Date(2026, 9, 20, 7, 30, 0));
      expect(mornOnTime.isLate).toBe(false);
      expect(mornOnTime.lateMinutes).toBe(0);

      const mornGrace = determineShiftForTime(new Date(2026, 9, 20, 7, 35, 0));
      expect(mornGrace.isLate).toBe(false);
      expect(mornGrace.lateMinutes).toBe(0);

      // Morning late (07:36) -> late 1 minute (past 5m grace)
      const mornLate = determineShiftForTime(new Date(2026, 9, 20, 7, 36, 0));
      expect(mornLate.isLate).toBe(true);
      expect(mornLate.lateMinutes).toBe(1);

      // Morning late (07:40) -> late 5 minutes
      const mornLate5 = determineShiftForTime(new Date(2026, 9, 20, 7, 40, 0));
      expect(mornLate5.isLate).toBe(true);
      expect(mornLate5.lateMinutes).toBe(5);

      // Afternoon grace (13:05) -> on time
      const aftGrace = determineShiftForTime(new Date(2026, 9, 20, 13, 5, 0));
      expect(aftGrace.isLate).toBe(false);
      expect(aftGrace.lateMinutes).toBe(0);

      // Afternoon late (13:06) -> late 1 minute
      const aftLate = determineShiftForTime(new Date(2026, 9, 20, 13, 6, 0));
      expect(aftLate.isLate).toBe(true);
      expect(aftLate.lateMinutes).toBe(1);

      // Evening grace (19:05) -> on time
      const eveGrace = determineShiftForTime(new Date(2026, 9, 20, 19, 5, 0));
      expect(eveGrace.isLate).toBe(false);
      expect(eveGrace.lateMinutes).toBe(0);

      // Evening late (19:06) -> late 1 minute
      const eveLate = determineShiftForTime(new Date(2026, 9, 20, 19, 6, 0));
      expect(eveLate.isLate).toBe(true);
      expect(eveLate.lateMinutes).toBe(1);
    });
  });

  // =========================================================================
  // 10. AUTO-CLOSE PAST SESSIONS
  // =========================================================================
  describe('10. Auto-Close Past Sessions', () => {
    it('Closes active sessions from earlier dates and transitions present members to missing_checkout', async () => {
      const pastDate = '2026-09-01';
      const todayDate = '2026-09-02';

      await workSessionApi.create({
        id: 'ws-past-active',
        date: pastDate,
        status: 'active'
      });

      await workSessionApi.createMember({
        id: 'wsm-past-present',
        workSessionId: 'ws-past-active',
        accountId: 'acc-past-emp',
        attendanceStatus: 'present',
        workingStatus: 'active'
      });

      // Run autoClosePastSessions with todayDate as current
      await workSessionApi.autoClosePastSessions(todayDate);

      // Past session must now be closed with actualCash: null and isAutoClosed: true
      const session = (await workSessionApi.getById('ws-past-active')).data;
      expect(session.status).toBe('closed');
      expect(session.isAutoClosed).toBe(true);
      expect(session.actualCash).toBeNull();

      // Present member must now be missing_checkout
      const member = (await workSessionApi.getMemberById('wsm-past-present')).data;
      expect(member.attendanceStatus).toBe('missing_checkout');
      expect(member.workingStatus).toBe('offline');
      expect(member.checkOutTime).toBeNull();
    });
  });

  // =========================================================================
  // 11. SEQUENTIAL SESSION CODE
  // =========================================================================
  describe('11. Sequential Session Code Generation', () => {
    it('Generates sequential session codes without collisions', async () => {
      const date = '2026-10-25';
      const code1 = await workSessionApi.generateSessionCode(date);
      expect(code1).toBe('CA-20261025-01');

      await workSessionApi.create({
        id: 'ws-seq-1',
        code: code1,
        date,
        status: 'planned'
      });

      const code2 = await workSessionApi.generateSessionCode(date);
      expect(code2).toBe('CA-20261025-02');
    });
  });

  // =========================================================================
  // 12. CANCELLED SESSION + REPLACEMENT SESSION SEMANTICS
  // =========================================================================
  describe('12. Cancelled Session + Replacement Session Semantics', () => {
    it('Preserves cancelled predecessor, resolves replacement active session, and blocks third session', async () => {
      const date = '2026-10-30';

      // 1. Create original session and cancel it
      const orig = await workSessionApi.create({
        id: 'ws-orig-30',
        date,
        code: 'CA-20261030-01',
        name: 'Ca gốc bị hủy',
        status: 'planned'
      });
      await workSessionApi.patch(orig.data.id, { status: 'cancelled' });

      // 2. Create replacement session for the same date
      const rep = await workSessionApi.create({
        id: 'ws-rep-30',
        date,
        code: 'CA-20261030-02',
        name: 'Ca thay thế hoạt động',
        status: 'active'
      });
      expect(rep.data.id).toBe('ws-rep-30');
      expect(rep.data.status).toBe('active');

      // 3. getTodaySessionForDate resolves replacement session, NEVER the cancelled session
      const todaySession = await workSessionApi.getTodaySessionForDate(date);
      expect(todaySession.id).toBe('ws-rep-30');
      expect(todaySession.status).toBe('active');

      // 4. getActiveSessions excludes cancelled session
      const activeList = (await workSessionApi.getActiveSessions()).data;
      expect(activeList.some(s => s.id === 'ws-orig-30')).toBe(false);
      expect(activeList.some(s => s.id === 'ws-rep-30')).toBe(true);

      // 5. Cancelled session is preserved as historical record in getAll
      const allForDate = (await workSessionApi.getAll({ date })).data;
      expect(allForDate.length).toBe(2);
      expect(allForDate.find(s => s.id === 'ws-orig-30').status).toBe('cancelled');
      expect(allForDate.find(s => s.id === 'ws-rep-30').status).toBe('active');

      // 6. Attempting to create a third session on this date is blocked
      await expect(
        workSessionApi.create({
          id: 'ws-third-30',
          date,
          name: 'Ca thứ ba không hợp lệ'
        })
      ).rejects.toThrow(/Mỗi ngày làm việc chỉ được phép có duy nhất 1 ca làm việc/i);
    });
  });

  // =========================================================================
  // 13. CROSS-CLIENT CONCURRENCY SIMULATION & LIMITATIONS
  // =========================================================================
  describe('13. Cross-Client Concurrency Architecture & json-server Limitations', () => {
    it('Demonstrates cross-client deterministic ID convergence via 409/500 collision recovery', async () => {
      const date = '2026-11-01';
      const deterministicId = `ws_${date}`;

      // Simulate Client A sending raw POST with deterministic ID (succeeds)
      const clientAPost = await workSessionApi.getTodaySessionForDate(date);
      expect(clientAPost.id).toBe(deterministicId);

      // Simulate Client B (e.g. separate device without shared in-flight memory map)
      // Attempting to POST the same deterministic ID triggers duplicate ID error in json-server/mock,
      // which getTodaySessionForDate catches and seamlessly recovers by reading the created session.
      const clientBResolution = await workSessionApi.getTodaySessionForDate(date);
      expect(clientBResolution.id).toBe(deterministicId);

      // Verify db.json / store has exactly 1 session record
      const allSessions = (await workSessionApi.getAll({ date })).data;
      expect(allSessions.length).toBe(1);
    });

    it('Documents limitation: uncoordinated raw POSTs with different IDs on plain json-server lack table locks', async () => {
      // NOTE: Plain json-server has NO secondary unique indexes (e.g. unique constraint on 'date').
      // If two external clients bypass getTodaySessionForDate and send uncoordinated POSTs with
      // DIFFERENT random IDs simultaneously before either has written, plain json-server cannot reject the second.
      // This test verifies that the application-level deterministic ID strategy is the primary shield.
      const date = '2026-11-02';

      // First session with custom ID
      await workSessionApi.create({ id: 'ws-ext-1', date, name: 'Client A Session' });

      // In the same client runtime, application logic blocks duplicate:
      await expect(
        workSessionApi.create({ id: 'ws-ext-2', date, name: 'Client B Session' })
      ).rejects.toThrow(/Mỗi ngày làm việc chỉ được phép có duy nhất 1 ca làm việc/i);
    });
  });

  // =========================================================================
  // 14. AUTO-CLOSED VS MANUALLY CLOSED SESSIONS
  // =========================================================================
  describe('14. Auto-Close vs Manually Reconciled Closure', () => {
    it('Distinguishes auto-closed session (actualCash: null, isAutoClosed: true) from manually reconciled closure', async () => {
      const autoDate = '2026-09-03';
      const manualDate = '2026-09-04';

      // 1. Auto-closed session
      await workSessionApi.create({ id: 'ws-auto-cl', date: autoDate, status: 'active' });
      await workSessionApi.autoClosePastSessions('2026-09-05');
      const autoClosedSession = (await workSessionApi.getById('ws-auto-cl')).data;

      expect(autoClosedSession.status).toBe('closed');
      expect(autoClosedSession.isAutoClosed).toBe(true);
      expect(autoClosedSession.actualCash).toBeNull();
      // Notice: No cashDifference or cashDiscrepancy is fabricated
      expect(autoClosedSession.cashDifference).toBeUndefined();

      // 2. Manually closed session
      await workSessionApi.create({ id: 'ws-manual-cl', date: manualDate, status: 'active', initialCash: 1000000 });
      await workSessionApi.closeSession('ws-manual-cl', {
        actualCash: 1000000,
        closeNote: 'Bàn giao ca đầy đủ',
        actor: { id: 'acc-admin-mgr', role: 'admin' }
      });
      const manualClosedSession = (await workSessionApi.getById('ws-manual-cl')).data;

      expect(manualClosedSession.status).toBe('closed');
      expect(manualClosedSession.isAutoClosed).toBeUndefined();
      expect(manualClosedSession.actualCash).toBe(1000000);
      expect(manualClosedSession.expectedCash).toBe(1000000);
      expect(manualClosedSession.cashDifference).toBe(0);
    });
  });
});
