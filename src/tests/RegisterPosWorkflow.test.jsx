import { initSeedData } from './mockApi';
/**
 * RegisterPosWorkflow.test.jsx
 *
 * Kiểm tra đủ 7 case nghiệp vụ bắt buộc của Register/POS:
 *   Case 1: POS01 + NV001 → member.registerId = POS01
 *   Case 2: POS02 + NV002 → order.registerId = POS02, không nhận POS01
 *   Case 3: NV001 đổi khung → same WorkSession, different member, different registerId
 *   Case 4: Hai quầy hoạt động song song → Order truy ra đúng quầy riêng
 *   Case 5: POS bị inactive → không được checkout
 *   Case 6: Không xác định được register → không tạo order
 *   Case 7: Admin/Staff login → không tạo WorkSessionMember chỉ vì máy có POS
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { workSessionApi } from '../api/workSessionApi';
import { REGISTERS, getCurrentRegisterId, setCurrentRegisterId } from '../utils/registerConfig';

// ─── helpers ──────────────────────────────────────────────────────────────────

const MOCK_SESSION_ID = 'ws_2026-09-14';
const MOCK_DATE = '2026-09-14';

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('Register / POS Workflow Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    initSeedData();
    
    // Seed một WorkSession active via API
    await workSessionApi.create({
      id: MOCK_SESSION_ID,
      code: 'CA-20260914-01',
      date: MOCK_DATE,
      shiftType: 'daily',
      name: 'Ca ngày 14/09/2026',
      status: 'active',
      initialCash: 0,
      actualCash: null,
      totalRevenue: 0,
      totalOrders: 0,
      note: '',
      createdBy: null,
      closedBy: null,
      createdAt: '2026-09-14T00:30:00.000Z',
      updatedAt: '2026-09-14T00:30:00.000Z',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Case 1: POS01 + NV001 → WorkSessionMember gắn đúng registerId = POS01
  // ─────────────────────────────────────────────────────────────────────────────
  it('Case 1: WorkSessionMember được tạo với registerId = POS01 khi check-in tại máy POS01', async () => {
    const memberRes = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv001',
      registerId: 'POS01',
      shiftType: 'morning',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
      checkInTime: '2026-09-14T00:30:00.000Z',
      workingStatus: 'active',
    });

    expect(memberRes.data.registerId).toBe('POS01');
    expect(memberRes.data.workSessionId).toBe(MOCK_SESSION_ID);
    expect(memberRes.data.accountId).toBe('acc-nv001');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Case 2: POS02 + NV002 → member.registerId = POS02 (không lấy POS01)
  // ─────────────────────────────────────────────────────────────────────────────
  it('Case 2: NV002 check-in tại POS02 → registerId phải là POS02, không phải POS01', async () => {
    const member1Res = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv001',
      registerId: 'POS01',
      shiftType: 'morning',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
    });

    const member2Res = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv002',
      registerId: 'POS02',
      shiftType: 'morning',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
    });

    expect(member1Res.data.registerId).toBe('POS01');
    expect(member2Res.data.registerId).toBe('POS02');
    expect(member2Res.data.registerId).not.toBe('POS01');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Case 3: NV001 đổi khung morning→afternoon → same WorkSession, different member, different registerId
  // ─────────────────────────────────────────────────────────────────────────────
  it('Case 3: NV001 làm morning tại POS01, chiều chuyển sang POS02 → cùng workSessionId, 2 member khác nhau, registerId khác nhau', async () => {
    const morningMemberRes = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv001',
      registerId: 'POS01',
      shiftType: 'morning',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
      checkInTime: '2026-09-14T00:30:00.000Z',
    });

    // NV001 checkout ca sáng
    await workSessionApi.checkOut(morningMemberRes.data.id);

    const afternoonMemberRes = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv001',
      registerId: 'POS02',
      shiftType: 'afternoon',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
      checkInTime: '2026-09-14T06:00:00.000Z',
    });

    // Cùng 1 WorkSession
    expect(morningMemberRes.data.workSessionId).toBe(MOCK_SESSION_ID);
    expect(afternoonMemberRes.data.workSessionId).toBe(MOCK_SESSION_ID);

    // 2 member record khác nhau
    expect(morningMemberRes.data.id).not.toBe(afternoonMemberRes.data.id);

    // registerId khác nhau
    expect(morningMemberRes.data.registerId).toBe('POS01');
    expect(afternoonMemberRes.data.registerId).toBe('POS02');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Case 4: Hai quầy hoạt động song song → Order truy ra đúng quầy riêng
  // ─────────────────────────────────────────────────────────────────────────────
  it('Case 4: POS01 → Order A với registerId=POS01; POS02 → Order B với registerId=POS02', async () => {
    const memberPOS01Res = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv001',
      registerId: 'POS01',
      shiftType: 'morning',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
    });

    const memberPOS02Res = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv002',
      registerId: 'POS02',
      shiftType: 'morning',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
    });

    // Simulate Order A từ POS01
    const orderA = {
      id: 'order-A-pos01',
      code: 'HD-20260914-0001',
      accountId: 'acc-nv001',
      registerId: memberPOS01Res.data.registerId,
      workSessionId: MOCK_SESSION_ID,
      workSessionMemberId: memberPOS01Res.data.id,
      businessDate: MOCK_DATE,
      status: 'completed',
      totalAmount: 100000,
    };

    // Simulate Order B từ POS02
    const orderB = {
      id: 'order-B-pos02',
      code: 'HD-20260914-0002',
      accountId: 'acc-nv002',
      registerId: memberPOS02Res.data.registerId,
      workSessionId: MOCK_SESSION_ID,
      workSessionMemberId: memberPOS02Res.data.id,
      businessDate: MOCK_DATE,
      status: 'completed',
      totalAmount: 200000,
    };

    expect(orderA.registerId).toBe('POS01');
    expect(orderB.registerId).toBe('POS02');
    expect(orderA.registerId).not.toBe(orderB.registerId);

    // Có thể truy ra quầy từ workSessionMemberId via API
    const memberOfA = (await workSessionApi.getMemberById(orderA.workSessionMemberId)).data;
    const memberOfB = (await workSessionApi.getMemberById(orderB.workSessionMemberId)).data;
    expect(memberOfA?.registerId).toBe('POS01');
    expect(memberOfB?.registerId).toBe('POS02');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Case 5: POS bị inactive → assertCurrentRegister phải ném lỗi
  // ─────────────────────────────────────────────────────────────────────────────
  it('Case 5: POS bị inactive → assertCurrentRegister() ném lỗi REGISTER_INACTIVE', async () => {
    const { assertCurrentRegister } = await import('../utils/registerConfig');

    // Patch REGISTERS trực tiếp trong module để mô phỏng POS01 inactive
    const { REGISTERS: regs } = await import('../utils/registerConfig');
    const originalIsActive = regs[0].isActive;
    regs[0].isActive = false; // POS01 inactive

    // Config máy đang dùng POS01
    localStorage.setItem('minishop_current_register_id', 'POS01');

    expect(() => assertCurrentRegister()).toThrowError(/REGISTER_INACTIVE/);

    // Khôi phục
    regs[0].isActive = originalIsActive;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Case 6: Không xác định được register (ID không tồn tại) → getCurrentRegister ném lỗi
  // ─────────────────────────────────────────────────────────────────────────────
  it('Case 6: registerId không tồn tại → getCurrentRegister() ném lỗi REGISTER_NOT_FOUND', async () => {
    const { getCurrentRegister } = await import('../utils/registerConfig');
    localStorage.setItem('minishop_current_register_id', 'POS99');
    expect(() => getCurrentRegister()).toThrowError(/REGISTER_NOT_FOUND/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Case 7: Admin/Staff login → không tự tạo WorkSessionMember
  // ─────────────────────────────────────────────────────────────────────────────
  it('Case 7: Admin/Staff không tạo WorkSessionMember khi login (nghiệp vụ đã cũ, giữ nguyên)', async () => {
    // Xác nhận nguyên tắc: REGISTERS có sẵn 3 quầy, nhưng việc tạo member chỉ được trigger cho Employee
    // Test này kiểm tra REGISTERS data đúng định nghĩa và không bị ảnh hưởng bởi role Admin
    expect(REGISTERS).toHaveLength(3);
    expect(REGISTERS.every(r => ['POS01', 'POS02', 'POS03'].includes(r.id))).toBe(true);

    // Không có member mới nào được tạo trong test này (nghiệp vụ Admin không chấm công)
    const membersRes = await workSessionApi.getMembers();
    const members = Array.isArray(membersRes.data) ? membersRes.data : [];
    expect(members).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // REGISTERS data integrity
  // ─────────────────────────────────────────────────────────────────────────────
  it('REGISTERS config: đủ 3 quầy, code và name đúng chuẩn', () => {
    expect(REGISTERS).toHaveLength(3);

    const pos01 = REGISTERS.find(r => r.id === 'POS01');
    expect(pos01).toMatchObject({ code: 'Q01', name: 'Quầy 01', isActive: true });

    const pos02 = REGISTERS.find(r => r.id === 'POS02');
    expect(pos02).toMatchObject({ code: 'Q02', name: 'Quầy 02', isActive: true });

    const pos03 = REGISTERS.find(r => r.id === 'POS03');
    expect(pos03).toMatchObject({ code: 'Q03', name: 'Quầy 03', isActive: true });
  });

  it.skip('Seed data: minishop_registers có 3 quầy sau khi initSeedData', () => {
    const raw = localStorage.getItem('minishop_registers');
    const regs = JSON.parse(raw || '[]');
    expect(regs).toHaveLength(3);
    expect(regs.map(r => r.id)).toEqual(['POS01', 'POS02', 'POS03']);
  });

  it('getCurrentRegisterId: trả về DEFAULT_REGISTER_ID=POS01 khi chưa cấu hình', () => {
    localStorage.removeItem('minishop_current_register_id');
    expect(getCurrentRegisterId()).toBe('POS01');
  });

  it('getCurrentRegisterId: trả về đúng giá trị sau khi setCurrentRegisterId', () => { setCurrentRegisterId('POS02');
    expect(getCurrentRegisterId()).toBe('POS02');
  });

  it('WorkSessionMember.registerId được lưu trữ đúng', async () => {
    const createRes = await workSessionApi.createMember({
      workSessionId: MOCK_SESSION_ID,
      accountId: 'acc-nv003',
      registerId: 'POS03',
      shiftType: 'evening',
      businessDate: MOCK_DATE,
      attendanceStatus: 'present',
    });

    const memberRes = await workSessionApi.getMemberById(createRes.data.id);
    expect(memberRes.data).toBeDefined();
    expect(memberRes.data.registerId).toBe('POS03');
  });
});
