import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { workSessionApi, determineShiftForTime, isOutOfShift } from '../api/workSessionApi';


describe('WorkSession & Member API Tests (Data Layer)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Initializes empty workSessions and workSessionMembers in demo mode', async () => {
    const sessionsRes = await workSessionApi.getAll();
    expect(Array.isArray(sessionsRes.data)).toBe(true);
    expect(sessionsRes.data.length).toBe(0);

    const membersRes = await workSessionApi.getMembers();
    expect(Array.isArray(membersRes.data)).toBe(true);
    expect(membersRes.data.length).toBe(0);
  });

  it('Performs CRUD on WorkSession entity with date, shiftType, and cash fields', async () => {
    const newSession = {
      id: 'ws-001',
      code: 'CA-20260827-01',
      date: '2026-08-27',
      shiftType: 'morning',
      name: 'Ca sáng thứ 5',
      startTime: '2026-08-27T08:00:00.000Z',
      endTime: null,
      status: 'planned',
      initialCash: 1000000,
      actualCash: null,
      totalRevenue: 0,
      totalOrders: 0,
      note: 'Ghi chú ca',
      createdBy: 'acc-admin-1'
    };

    // CREATE
    const createRes = await workSessionApi.create(newSession);
    expect(createRes.data.id).toBe('ws-001');
    expect(createRes.data.date).toBe('2026-08-27');
    expect(createRes.data.shiftType).toBe('morning');
    expect(createRes.data.status).toBe('planned');
    expect(createRes.data.initialCash).toBe(1000000);

    // GET ALL & BY ID
    const allRes = await workSessionApi.getAll();
    expect(allRes.data.length).toBe(1);

    const getRes = await workSessionApi.getById('ws-001');
    expect(getRes.data.name).toBe('Ca sáng thứ 5');

    // QUERY FILTER (date, shiftType, status)
    const filterRes = await workSessionApi.getAll({ date: '2026-08-27', shiftType: 'morning', status: 'planned' });
    expect(filterRes.data.length).toBe(1);

    const filterNone = await workSessionApi.getAll({ date: '2026-08-28' });
    expect(filterNone.data.length).toBe(0);

    // UPDATE / PUT
    const updated = { ...newSession, name: 'Ca sáng chỉnh sửa' };
    const updateRes = await workSessionApi.update('ws-001', updated);
    expect(updateRes.data.name).toBe('Ca sáng chỉnh sửa');

    // PATCH
    const patchRes = await workSessionApi.patch('ws-001', { status: 'active' });
    expect(patchRes.data.status).toBe('active');

    // DELETE: WorkSession is immutable historical audit data and cannot be deleted (Rule 13)
    expect(() => workSessionApi.remove('ws-001')).toThrow(/KHÔNG ĐƯỢC PHÉP XÓA/i);
    const afterDelete = await workSessionApi.getAll();
    expect(afterDelete.data.length).toBe(1);
  });

  it('Generates sequential session codes for date (CA-YYYYMMDD-01, ...)', async () => {
    const code1 = await workSessionApi.generateSessionCode('2026-08-27');
    expect(code1).toBe('CA-20260827-01');

    await workSessionApi.create({
      id: 'ws-1',
      code: 'CA-20260827-01',
      date: '2026-08-27',
      shiftType: 'morning',
      name: 'Ca 1'
    });

    const code2 = await workSessionApi.generateSessionCode('2026-08-27');
    expect(code2).toBe('CA-20260827-02');
  });

  it('Performs CRUD on WorkSessionMember entity using accountId and saves isLate / lateMinutes', async () => {
    const member = {
      id: 'wsm-001',
      workSessionId: 'ws-001',
      accountId: 'acc-staff-1',
      attendanceStatus: 'present',
      checkInTime: new Date().toISOString(),
      checkOutTime: null,
      workingStatus: 'idle',
      isLate: true,
      lateMinutes: 15,
      note: 'Nhân viên trực ca'
    };

    // CREATE MEMBER
    const createRes = await workSessionApi.createMember(member);
    expect(createRes.data.id).toBe('wsm-001');
    expect(createRes.data.accountId).toBe('acc-staff-1');
    expect(createRes.data.attendanceStatus).toBe('present');
    expect(createRes.data.isLate).toBe(true);
    expect(createRes.data.lateMinutes).toBe(15);

    // GET BY SESSION ID & ACCOUNT ID
    const bySession = await workSessionApi.getMembersBySessionId('ws-001');
    expect(bySession.data.length).toBe(1);

    const byAccount = await workSessionApi.getMembersByAccountId('acc-staff-1');
    expect(byAccount.data.length).toBe(1);

    // PATCH MEMBER
    const patchRes = await workSessionApi.patchMember('wsm-001', { workingStatus: 'busy' });
    expect(patchRes.data.workingStatus).toBe('busy');

    // REMOVE MEMBER: WorkSessionMember is historical audit data and cannot be deleted
    expect(() => workSessionApi.removeMember('wsm-001')).toThrow(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÔNG ĐƯỢC PHÉP XÓA/i);
    const afterRemove = await workSessionApi.getMembers();
    expect(afterRemove.data.length).toBe(1);
  });

  it('Handles Check-in, update working status, and Check-out workflows properly', async () => {
    // 1. Tạo session
    await workSessionApi.create({
      id: 'ws-test',
      code: 'CA-20260827-01',
      date: '2026-08-27',
      shiftType: 'morning',
      name: 'Ca sáng',
      status: 'active'
    });

    // 2. Tạo member
    await workSessionApi.createMember({
      id: 'wsm-test',
      workSessionId: 'ws-test',
      accountId: 'acc-staff-1',
      attendanceStatus: 'present',
      workingStatus: 'idle'
    });

    // 3. UPDATE WORKING STATUS (idle -> busy)
    const busyMember = await workSessionApi.updateWorkingStatus('wsm-test', 'busy');
    expect(busyMember.workingStatus).toBe('busy');

    // 4. CHECK-OUT
    const checkedOutMember = await workSessionApi.checkOut('wsm-test');
    expect(checkedOutMember.attendanceStatus).toBe('completed');
    expect(checkedOutMember.workingStatus).toBe('offline');
    expect(checkedOutMember.checkOutTime).not.toBeNull();
  });

  it('Retrieves active membership correctly for an account', async () => {
    await workSessionApi.create({
      id: 'ws-active',
      code: 'CA-20260827-01',
      status: 'active'
    });

    await workSessionApi.createMember({
      id: 'm-act',
      workSessionId: 'ws-active',
      accountId: 'acc-staff-active',
      attendanceStatus: 'present',
      workingStatus: 'idle'
    });

    const membership = await workSessionApi.getUserActiveMembership('acc-staff-active');
    expect(membership).not.toBeNull();
    expect(membership.session.id).toBe('ws-active');
    expect(membership.member.id).toBe('m-act');

    const none = await workSessionApi.getUserActiveMembership('acc-unknown');
    expect(none).toBeNull();
  });

  // ==========================================
  // SHIFT AUTO-GENERATION & BUSINESS RULE TESTS
  // ==========================================
  describe('determineShiftForTime Business Rules & Grace Period Tests', () => {
    it('Correctly classifies Morning shift (07:00 - 11:59)', () => {
      // 07:15 (Tiền-grace) -> sáng, isLate: false, isEarly: true
      const earlyMorning = new Date(2026, 7, 28, 7, 15, 0);
      const resEarly = determineShiftForTime(earlyMorning);
      expect(resEarly).not.toBeNull();
      expect(resEarly.shiftType).toBe('morning');
      expect(resEarly.isLate).toBe(false);
      expect(resEarly.lateMinutes).toBe(0);

      // 07:30 (Đúng giờ) -> sáng, isLate: false
      const onTimeMorning = new Date(2026, 7, 28, 7, 30, 0);
      const resOnTime = determineShiftForTime(onTimeMorning);
      expect(resOnTime.shiftType).toBe('morning');
      expect(resOnTime.isLate).toBe(false);

      // 07:35 (Trong grace 5p) -> sáng, isLate: false
      const graceMorning = new Date(2026, 7, 28, 7, 35, 0);
      const resGrace = determineShiftForTime(graceMorning);
      expect(resGrace.shiftType).toBe('morning');
      expect(resGrace.isLate).toBe(false);

      // 07:36 (Trễ sau grace) -> sáng, isLate: true, lateMinutes: 1
      const lateMorning = new Date(2026, 7, 28, 7, 36, 0);
      const resLate = determineShiftForTime(lateMorning);
      expect(resLate.shiftType).toBe('morning');
      expect(resLate.isLate).toBe(true);
      expect(resLate.lateMinutes).toBe(1);

      // 08:00 (Trễ 25 phút sau grace) -> sáng, isLate: true, lateMinutes: 25
      const late30 = new Date(2026, 7, 28, 8, 0, 0);
      const resLate30 = determineShiftForTime(late30);
      expect(resLate30.shiftType).toBe('morning');
      expect(resLate30.isLate).toBe(true);
      expect(resLate30.lateMinutes).toBe(25);
    });

    it('Correctly identifies lunch rest period (12:00 - 12:59)', () => {
      const lunchTime = new Date(2026, 7, 28, 12, 15, 0);
      const resLunch = determineShiftForTime(lunchTime);
      expect(resLunch.isRestPeriod).toBe(true);
      expect(resLunch.shiftType).toBeNull();
      expect(resLunch.restLabel).toBe('Nghỉ trưa');
    });

    it('Correctly classifies Afternoon shift (13:00 - 18:29)', () => {
      // 13:00 (Đúng giờ) -> chiều, isLate: false
      const onTimeAfternoon = new Date(2026, 7, 28, 13, 0, 0);
      const resOnTime = determineShiftForTime(onTimeAfternoon);
      expect(resOnTime.shiftType).toBe('afternoon');
      expect(resOnTime.isLate).toBe(false);

      // 13:05 (Trong grace 5p) -> chiều, isLate: false
      const graceAfternoon = new Date(2026, 7, 28, 13, 5, 0);
      const resGrace = determineShiftForTime(graceAfternoon);
      expect(resGrace.shiftType).toBe('afternoon');
      expect(resGrace.isLate).toBe(false);

      // 13:45 (Trễ 40 phút sau grace) -> chiều, isLate: true, lateMinutes: 40
      const lateAfternoon = new Date(2026, 7, 28, 13, 45, 0);
      const resLate = determineShiftForTime(lateAfternoon);
      expect(resLate.shiftType).toBe('afternoon');
      expect(resLate.isLate).toBe(true);
      expect(resLate.lateMinutes).toBe(40);
    });

    it('Correctly identifies dinner rest period (18:30 - 18:59)', () => {
      const dinnerTime = new Date(2026, 7, 28, 18, 45, 0);
      const resDinner = determineShiftForTime(dinnerTime);
      expect(resDinner.isRestPeriod).toBe(true);
      expect(resDinner.shiftType).toBeNull();
      expect(resDinner.restLabel).toBe('Nghỉ tối');
    });

    it('Correctly classifies Evening shift (19:00 - 22:30)', () => {
      // 19:00 (Đúng giờ) -> tối, isLate: false
      const onTimeEvening = new Date(2026, 7, 28, 19, 0, 0);
      const resOnTime = determineShiftForTime(onTimeEvening);
      expect(resOnTime.shiftType).toBe('evening');
      expect(resOnTime.isLate).toBe(false);

      // 19:30 (Trễ 25 phút sau grace) -> tối, isLate: true, lateMinutes: 25
      const lateEvening = new Date(2026, 7, 28, 19, 30, 0);
      const resLate = determineShiftForTime(lateEvening);
      expect(resLate.shiftType).toBe('evening');
      expect(resLate.isLate).toBe(true);
      expect(resLate.lateMinutes).toBe(25);
    });

    it('Returns null for out-of-business hours (< 07:00 or > 22:30)', () => {
      // 06:30 (Quá sớm)
      const tooEarly = new Date(2026, 7, 28, 6, 30, 0);
      expect(determineShiftForTime(tooEarly)).toBeNull();

      // 23:00 (Quá muộn)
      const tooLate = new Date(2026, 7, 28, 23, 0, 0);
      expect(determineShiftForTime(tooLate)).toBeNull();

      // 03:00 đêm
      const night = new Date(2026, 7, 28, 3, 0, 0);
      expect(determineShiftForTime(night)).toBeNull();
    });
  });

  describe('isOutOfShift Transaction Flag Tests', () => {
    it('Detects transaction against store operating hours 07:30 - 22:00', () => {
      const session = { status: 'active' };
      // 11:55: within store hours
      expect(isOutOfShift(session, new Date(2026, 7, 28, 11, 55))).toBe(false);
      // 12:15: within store hours (rest period sale)
      expect(isOutOfShift(session, new Date(2026, 7, 28, 12, 15))).toBe(false);
      // 20:00: within store hours
      expect(isOutOfShift(session, new Date(2026, 7, 28, 20, 0))).toBe(false);

      // 06:30: before opening 07:30
      expect(isOutOfShift(session, new Date(2026, 7, 28, 6, 30))).toBe(true);
      // 22:45: past closing 22:00
      expect(isOutOfShift(session, new Date(2026, 7, 28, 22, 45))).toBe(true);
    });
  });

  describe('getOrCreateWorkSession and Concurrency Tests', () => {
    it('Creates new session with deterministic ID and exemption for Admin', async () => {
      const morningTime = new Date(2026, 7, 28, 8, 15, 0); // 08:15 (Trễ 40p sau grace đối với Staff)

      // 1. Staff login trễ
      const staffRes = await workSessionApi.getOrCreateWorkSession(morningTime, false);
      expect(staffRes.workSession).not.toBeNull();
      expect(staffRes.workSession.date).toBe('2026-08-28');
      expect(staffRes.isLate).toBe(true);
      expect(staffRes.lateMinutes).toBe(40);

      // 2. Admin login: luôn isLate = false
      const adminRes = await workSessionApi.getOrCreateWorkSession(morningTime, true);
      expect(adminRes.workSession.id).toBe(staffRes.workSession.id);
      expect(adminRes.isLate).toBe(false);
      expect(adminRes.lateMinutes).toBe(0);
    });

    it('Handles concurrent login requests safely without duplicating sessions (Race Condition Test)', async () => {
      const afternoonTime = new Date(2026, 7, 28, 13, 10, 0);

      // Gọi đồng thời 5 requests cùng lúc
      const results = await Promise.all([
        workSessionApi.getOrCreateWorkSession(afternoonTime, false),
        workSessionApi.getOrCreateWorkSession(afternoonTime, false),
        workSessionApi.getOrCreateWorkSession(afternoonTime, true),
        workSessionApi.getOrCreateWorkSession(afternoonTime, false),
        workSessionApi.getOrCreateWorkSession(afternoonTime, true)
      ]);

      // Tất cả đều thành công và trỏ về đúng 1 session ID duy nhất
      const sessionIds = results.map(r => r.workSession.id);
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(1);

      // Kiểm tra DB chỉ có đúng 1 session được tạo cho ngày đó
      const allSessions = await workSessionApi.getAll();
      expect(allSessions.data.filter(s => s.date === '2026-08-28').length).toBe(1);
    });

    it('Returns out_of_business_hours when called during closed hours', async () => {
      const midnight = new Date(2026, 7, 28, 23, 45, 0);
      const res = await workSessionApi.getOrCreateWorkSession(midnight, false);
      expect(res.workSession).toBeNull();
      expect(res.reason).toBe('out_of_business_hours');
    });
  });
});


