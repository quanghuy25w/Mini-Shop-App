import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';
import { workSessionApi, determineShiftForTime } from '../api/workSessionApi';


const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('Staff Login & WorkSession Redesign Tests (Requirements A, B, C)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1 & 2. Đăng nhập bằng Employee Code + PIN & Xác định đúng Staff
  // =========================================================================
  it('1 & 2. Authenticates Staff using Employee Code + PIN and correctly identifies Staff entity', async () => {
    // 1. Khởi tạo Staff
    const staffRes = await staffApi.create({
      id: 'staff-001',
      employeeCode: 'NV001',
      name: 'Nguyễn Văn Anh',
      phone: '0901112233',
      hireDate: '2026-08-01',
      isActive: true,
      employmentStatus: 'working'
    });

    // 2. Khởi tạo Account liên kết với Staff qua employeeId
    await accountApi.create({
      id: 'acc-001',
      employeeId: staffRes.data.id,
      role: 'staff',
      pin: '123456',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // A. Đăng nhập sai Employee Code
    let failCodeRes;
    await act(async () => {
      failCodeRes = await result.current.loginStaff({
        employeeCode: 'NV999',
        pin: '123456'
      });
    });
    expect(failCodeRes.success).toBe(false);
    expect(failCodeRes.error).toContain('Không tìm thấy nhân viên');

    // B. Đăng nhập đúng Employee Code nhưng sai PIN
    let failPinRes;
    await act(async () => {
      failPinRes = await result.current.loginStaff({
        employeeCode: 'NV001',
        pin: '654321'
      });
    });
    expect(failPinRes.success).toBe(false);
    expect(failPinRes.error).toContain('không chính xác');

    // C. Đăng nhập đúng Employee Code + đúng PIN
    let okRes;
    await act(async () => {
      okRes = await result.current.loginStaff({
        employeeCode: 'NV001',
        pin: '123456'
      });
    });

    expect(okRes.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUser.name).toBe('Nguyễn Văn Anh');
    expect(result.current.currentUser.employeeCode).toBe('NV001');
    expect(result.current.currentUser.employeeId).toBe('staff-001');
  });

  // =========================================================================
  // 3 & 4. Tự động Check-in khi login thành công & Lưu checkInTime chính xác
  // =========================================================================
  it('3 & 4. Auto check-in on login and stores accurate checkInTime', async () => {
    // Giả lập thời điểm đăng nhập lúc 07:15 sáng (trong khung giờ ca sáng)
    const mockLoginTime = new Date(2026, 8, 7, 7, 15, 0); // 07/09/2026 07:15:00
    vi.useFakeTimers();
    vi.setSystemTime(mockLoginTime);

    const staffRes = await staffApi.create({
      id: 'staff-002',
      employeeCode: 'NV002',
      name: 'Trần Thị Bình',
      isActive: true
    });

    await accountApi.create({
      id: 'acc-002',
      employeeId: staffRes.data.id,
      role: 'employee',
      pin: '222222',
      isActive: true
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginStaff({
        employeeCode: 'NV002',
        pin: '222222'
      });
    });

    // Kiểm tra WorkSessionMember tự động được tạo
    const membersRes = await workSessionApi.getMembers({ accountId: 'acc-002' });
    expect(membersRes.data.length).toBe(1);

    const member = membersRes.data[0];
    expect(member.attendanceStatus).toBe('present');
    expect(member.checkInTime).toBe(mockLoginTime.toISOString());
    expect(member.checkOutTime).toBeNull();
    expect(member.isLate).toBe(false);
    expect(member.lateMinutes).toBe(0);

    vi.useRealTimers();
  });

  // =========================================================================
  // 5. Xác định đúng ca dựa trên ngày và thời gian
  // =========================================================================
  it('5. Correctly determines shift definition for Morning, Afternoon, Evening and Out-of-hours', () => {
    // Ca sáng (07:30 - 12:00, cửa sổ 07:00 - 12:29)
    const morning = new Date(2026, 8, 7, 7, 30, 0);
    const morningShift = determineShiftForTime(morning);
    expect(morningShift.shiftType).toBe('morning');
    expect(morningShift.shiftDef.name).toBe('Ca sáng');

    // Ca chiều (13:00 - 18:30, cửa sổ 12:30 - 18:29)
    const afternoon = new Date(2026, 8, 7, 13, 15, 0);
    const afternoonShift = determineShiftForTime(afternoon);
    expect(afternoonShift.shiftType).toBe('afternoon');
    expect(afternoonShift.shiftDef.name).toBe('Ca chiều');

    // Ca tối (19:00 - 22:00, cửa sổ 18:30 - 22:30)
    const evening = new Date(2026, 8, 7, 19, 0, 0);
    const eveningShift = determineShiftForTime(evening);
    expect(eveningShift.shiftType).toBe('evening');
    expect(eveningShift.shiftDef.name).toBe('Ca tối');

    // Ngoài giờ hoạt động (< 07:00 hoặc > 22:30)
    const midnight = new Date(2026, 8, 7, 3, 0, 0);
    expect(determineShiftForTime(midnight)).toBeNull();
  });

  // =========================================================================
  // 6 & 7. WorkSession tự động tạo khi người đầu tiên login & người tiếp theo tham gia cùng ca
  // =========================================================================
  it('6 & 7. First staff creates WorkSession, subsequent staff joins the existing WorkSession (1 session per date + shift)', async () => {
    const morningTime1 = new Date(2026, 8, 7, 7, 0, 0); // 07:00 NV002
    const morningTime2 = new Date(2026, 8, 7, 7, 25, 0); // 07:25 NV001

    vi.useFakeTimers();

    // 1. Tạo 2 Staff và Account
    const s1 = await staffApi.create({ id: 's-001', employeeCode: 'NV001', name: 'NV 001', isActive: true });
    const s2 = await staffApi.create({ id: 's-002', employeeCode: 'NV002', name: 'NV 002', isActive: true });
    await accountApi.create({ id: 'acc-s1', employeeId: s1.data.id, role: 'employee', pin: '111111', isActive: true });
    await accountApi.create({ id: 'acc-s2', employeeId: s2.data.id, role: 'employee', pin: '222222', isActive: true });

    // 2. NV002 login lúc 07:00 (người đầu tiên)
    vi.setSystemTime(morningTime1);
    const { result: auth2 } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await auth2.current.loginStaff({ employeeCode: 'NV002', pin: '222222' });
    });

    // Xác nhận: WorkSession đã được tự động tạo
    const sessionsAfterFirst = await workSessionApi.getAll();
    expect(sessionsAfterFirst.data.length).toBe(1);
    const session = sessionsAfterFirst.data[0];
    expect(session.date).toBe('2026-09-07');
    expect(session.status).toBe('active');

    // 3. NV001 login lúc 07:25 (người thứ hai cùng ca)
    vi.setSystemTime(morningTime2);
    const { setCurrentRegisterId } = await import('../utils/registerConfig');
    setCurrentRegisterId('POS02');
    
    const { result: auth1 } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await auth1.current.loginStaff({ employeeCode: 'NV001', pin: '111111' });
    });

    // Xác nhận: KHÔNG tạo thêm WorkSession mới, vẫn chỉ có 1 session duy nhất
    const sessionsAfterSecond = await workSessionApi.getAll();
    expect(sessionsAfterSecond.data.length).toBe(1);
    expect(sessionsAfterSecond.data[0].id).toBe(session.id);

    // Xác nhận: Cả 2 nhân viên đều có WorkSessionMember trong cùng 1 ca này
    const members = await workSessionApi.getMembersBySessionId(session.id);
    expect(members.data.length).toBe(2);

    const m2 = members.data.find(m => m.accountId === 'acc-s2');
    const m1 = members.data.find(m => m.accountId === 'acc-s1');
    expect(m2).toBeDefined();
    expect(m1).toBeDefined();
    expect(m2.checkInTime).toBe(morningTime1.toISOString());
    expect(m1.checkInTime).toBe(morningTime2.toISOString());

    vi.useRealTimers();
  });

  // =========================================================================
  // 8. Không có khái niệm phân ca cố định cho nhân viên
  // =========================================================================
  it('8. Staff is NOT fixed to a shift: can work morning today, afternoon tomorrow', async () => {
    vi.useFakeTimers();

    const s = await staffApi.create({ id: 's-flex', employeeCode: 'NV005', name: 'NV Linh Hoạt', isActive: true });
    await accountApi.create({ id: 'acc-flex', employeeId: s.data.id, role: 'employee', pin: '555555', isActive: true });

    // Ngày 1: Đăng nhập Ca sáng
    vi.setSystemTime(new Date(2026, 8, 7, 7, 20, 0));
    const { result: authDay1 } = renderHook(() => useAuth(), { wrapper });
    let resDay1;
    await act(async () => {
      resDay1 = await authDay1.current.loginStaff({ employeeCode: 'NV005', pin: '555555' });
    });
    expect(resDay1.success).toBe(true);

    // Ca sáng kết thúc, check-out
    act(() => {
      authDay1.current.logout();
    });

    // Ngày 2: Cùng nhân viên đó đăng nhập Ca chiều (13:00)
    vi.setSystemTime(new Date(2026, 8, 8, 13, 0, 0));
    const { result: authDay2 } = renderHook(() => useAuth(), { wrapper });
    let resDay2;
    await act(async () => {
      resDay2 = await authDay2.current.loginStaff({ employeeCode: 'NV005', pin: '555555' });
    });
    expect(resDay2.success).toBe(true);

    // Kiểm tra nhân viên này đã tham gia ca chiều ngày 2 hoàn toàn bình thường
    const flexMembers = await workSessionApi.getMembers({ accountId: 'acc-flex' });
    expect(flexMembers.data.length).toBe(2);

    vi.useRealTimers();
  });

  // =========================================================================
  // 9. Phân biệt Đúng giờ và Đi muộn X phút
  // =========================================================================
  it('9. Distinguishes On-time (checkIn <= start) and Late (checkIn > start, lateMinutes = delta)', async () => {
    vi.useFakeTimers();

    // Ca sáng bắt đầu lúc 07:30
    // NV002 login lúc 07:00 -> Đúng giờ (isLate = false, lateMinutes = 0)
    const onTimeLogin = new Date(2026, 8, 7, 7, 0, 0);
    vi.setSystemTime(onTimeLogin);

    const sEarly = await staffApi.create({ id: 's-early', employeeCode: 'NV010', name: 'NV Đúng Giờ', isActive: true });
    await accountApi.create({ id: 'acc-early', employeeId: sEarly.data.id, role: 'employee', pin: '101010', isActive: true });

    const { result: authEarly } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await authEarly.current.loginStaff({ employeeCode: 'NV010', pin: '101010' });
    });

    const mEarly = (await workSessionApi.getMembers({ accountId: 'acc-early' })).data[0];
    expect(mEarly.isLate).toBe(false);
    expect(mEarly.lateMinutes).toBe(0);

    // NV003 login lúc 07:45 -> Đi muộn 10 phút sau grace (isLate = true, lateMinutes = 10)
    const lateLogin = new Date(2026, 8, 7, 7, 45, 0);
    vi.setSystemTime(lateLogin);

    const sLate = await staffApi.create({ id: 's-late', employeeCode: 'NV011', name: 'NV Đi Muộn', isActive: true });
    await accountApi.create({ id: 'acc-late', employeeId: sLate.data.id, role: 'employee', pin: '111111', isActive: true });

    const { setCurrentRegisterId } = await import('../utils/registerConfig');
    setCurrentRegisterId('POS02');
    const { result: authLate } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await authLate.current.loginStaff({ employeeCode: 'NV011', pin: '111111' });
    });

    const mLate = (await workSessionApi.getMembers({ accountId: 'acc-late' })).data[0];
    expect(mLate.isLate).toBe(true);
    expect(mLate.lateMinutes).toBe(10);

    vi.useRealTimers();
  });

  // =========================================================================
  // 10. WorkSessionMember lưu đúng cấu trúc thông tin tham gia ca thực tế
  // =========================================================================
  it('10. WorkSessionMember structure contains required fields and tracking properties', async () => {
    vi.useFakeTimers();
    const testNow = new Date(2026, 8, 7, 7, 30, 0);
    vi.setSystemTime(testNow);

    const staffRes = await staffApi.create({ id: 's-schema', employeeCode: 'NV099', name: 'NV Kiểm Tra Schema', isActive: true });
    await accountApi.create({ id: 'acc-schema', employeeId: staffRes.data.id, role: 'employee', pin: '999999', isActive: true });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.loginStaff({ employeeCode: 'NV099', pin: '999999' });
    });

    const members = (await workSessionApi.getMembers({ accountId: 'acc-schema' })).data;
    expect(members.length).toBe(1);

    const member = members[0];
    // Các trường bắt buộc theo Mục C5
    expect(member.workSessionId).toBeDefined();
    expect(member.accountId).toBe('acc-schema');
    expect(member.checkInTime).toBe(testNow.toISOString());
    expect(member.checkOutTime).toBeNull();
    expect(member.attendanceStatus).toBe('present');
    expect(typeof member.isLate).toBe('boolean');
    expect(typeof member.lateMinutes).toBe('number');
    expect(member.workingStatus).toBe('active');

    vi.useRealTimers();
  });
});
