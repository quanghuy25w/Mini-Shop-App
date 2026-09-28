import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useContext } from 'react';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, AuthContext, useAuth } from '../context/AuthContext';
import { WorkSessionProvider } from '../context/WorkSessionContext';
import { AppDataProvider, AppDataContext } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { useCart } from '../hooks/useCart';
import { useInventory } from '../hooks/useInventory';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';
import { workSessionApi } from '../api/workSessionApi';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { activityLogApi } from '../api/activityLogApi';

import { ROLES } from '../utils/permissions';

const authWrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

// Helper component for POS checkout & Inventory tests
const OperationTester = ({ onActionRef }) => {
  const { addToCart, checkout } = useCart();
  const { importStock, exportStock } = useInventory();
  const { products } = useContext(AppDataContext);

  React.useEffect(() => {
    if (onActionRef) {
      onActionRef.current = {
        addToCart,
        checkout,
        importStock,
        exportStock,
        products
      };
    }
  });

  return <div>Operation Tester Ready</div>;
};

const renderAppWithUser = ({ authUser, onActionRef }) => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthContext.Provider
          value={{
            currentUser: authUser,
            isAuthenticated: Boolean(authUser),
            isAdmin: authUser?.role === 'admin',
            isStaff: authUser?.role === 'staff',
            isEmployee: authUser?.role === 'employee',
            can: () => true
          }}
        >
          <WorkSessionProvider>
            <OperationTester onActionRef={onActionRef} />
          </WorkSessionProvider>
        </AuthContext.Provider>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Manager No-Attendance Workflow & Employee Shift Invariance Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ADMIN LOGIN & SESSION CREATION WITHOUT WORK SESSION MEMBER
  // =========================================================================
  it('1. Admin login creates daily WorkSession with 0 WorkSessionMember records for Admin', async () => {
    vi.useFakeTimers();
    const adminLoginTime = new Date(2026, 8, 12, 8, 0, 0); // 2026-09-12 08:00:00
    vi.setSystemTime(adminLoginTime);

    // Create Admin account
    await accountApi.create({
      id: 'acc-admin-manager',
      role: ROLES.ADMIN,
      email: 'manager.admin@shop.vn',
      password: 'password123',
      isActive: true
    });

    const { result: auth } = renderHook(() => useAuth(), { wrapper: authWrapper });

    let loginRes;
    await act(async () => {
      loginRes = await auth.current.loginAdmin({
        email: 'manager.admin@shop.vn',
        password: 'password123'
      });
    });

    expect(loginRes.success).toBe(true);
    expect(auth.current.isAuthenticated).toBe(true);
    expect(auth.current.isAdmin).toBe(true);

    // Verify 1 daily WorkSession was created
    const sessions = (await workSessionApi.getAll({ date: '2026-09-12' })).data;
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe('ws_2026-09-12');
    expect(sessions[0].status).toBe('active');

    // Verify ZERO WorkSessionMember records were created for Admin
    const adminMembers = (await workSessionApi.getMembers({ accountId: 'acc-admin-manager' })).data;
    expect(adminMembers.length).toBe(0);

    const sessionMembers = (await workSessionApi.getMembersBySessionId('ws_2026-09-12')).data;
    expect(sessionMembers.length).toBe(0);

    // Verify no CHECK_IN activity log was recorded for Admin
    const logs = (await activityLogApi.getAll()).data;
    const checkInLogs = logs.filter(l => l.action === 'CHECK_IN' && l.actorId === 'acc-admin-manager');
    expect(checkInLogs.length).toBe(0);

    vi.useRealTimers();
  });

  // =========================================================================
  // 2. STAFF LOGIN & SESSION CREATION WITHOUT WORK SESSION MEMBER
  // =========================================================================
  it('2. Staff login creates daily WorkSession with 0 WorkSessionMember records for Staff', async () => {
    vi.useFakeTimers();
    const staffLoginTime = new Date(2026, 8, 12, 8, 15, 0); // 2026-09-12 08:15:00
    vi.setSystemTime(staffLoginTime);

    // Create Staff & Account
    const staffRec = await staffApi.create({
      id: 'st-manager-1',
      employeeCode: 'STAFF01',
      name: 'Nguyễn Quản Lý',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-staff-manager',
      employeeId: staffRec.data.id,
      role: ROLES.STAFF,
      pin: '123456',
      isActive: true
    });

    const { result: auth } = renderHook(() => useAuth(), { wrapper: authWrapper });

    let loginRes;
    await act(async () => {
      loginRes = await auth.current.loginStaff({
        employeeCode: 'STAFF01',
        pin: '123456'
      });
    });

    expect(loginRes.success).toBe(true);
    expect(auth.current.isAuthenticated).toBe(true);
    expect(auth.current.isStaff).toBe(true);

    // Verify 1 daily WorkSession exists
    const sessions = (await workSessionApi.getAll({ date: '2026-09-12' })).data;
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe('ws_2026-09-12');
    expect(sessions[0].status).toBe('active');

    // Verify ZERO WorkSessionMember records were created for Staff
    const staffMembers = (await workSessionApi.getMembers({ accountId: 'acc-staff-manager' })).data;
    expect(staffMembers.length).toBe(0);

    const sessionMembers = (await workSessionApi.getMembersBySessionId('ws_2026-09-12')).data;
    expect(sessionMembers.length).toBe(0);

    // Verify no CHECK_IN activity log for Staff
    const logs = (await activityLogApi.getAll()).data;
    const checkInLogs = logs.filter(l => l.action === 'CHECK_IN' && l.actorId === 'acc-staff-manager');
    expect(checkInLogs.length).toBe(0);

    vi.useRealTimers();
  });

  // =========================================================================
  // 3. ADMIN POS SALES CHECKOUT WITHOUT WORK SESSION MEMBER
  // =========================================================================
  it('3. Admin completes POS checkout with no WorkSessionMember, order and transaction carry valid workSessionId', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const sessionId = `ws_${today}`;
    const sessionCode = `CA-${today.replace(/-/g, '')}-01`;

    // Create daily active WorkSession
    await workSessionApi.create({
      id: sessionId,
      code: sessionCode,
      date: today,
      shiftType: 'daily',
      status: 'active'
    });

    const adminUser = {
      id: 'acc-admin-seller',
      role: 'admin',
      name: 'Admin Bán Hàng',
      email: 'admin.seller@shop.vn',
      permissions: []
    };

    const actionRef = { current: null };
    renderAppWithUser({ authUser: adminUser, onActionRef: actionRef });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));

    const testProd = actionRef.current.products[0];
    const initialStock = testProd.stockQuantity;

    // Add item to cart
    await act(async () => {
      actionRef.current.addToCart(testProd, 2);
    });

    // Admin performs checkout
    let createdOrder = null;
    await act(async () => {
      createdOrder = await actionRef.current.checkout();
    });

    expect(createdOrder).toBeDefined();
    expect(createdOrder.accountId).toBe('acc-admin-seller');
    expect(createdOrder.workSessionId).toBe(sessionId);
    expect(createdOrder.status).toBe('completed');

    // Verify DB order record
    const savedOrder = (await orderApi.getById(createdOrder.id)).data;
    expect(savedOrder.accountId).toBe('acc-admin-seller');
    expect(savedOrder.workSessionId).toBe(sessionId);

    // Verify inventory OUT transaction record
    const outTxs = (await inventoryApi.getAllTransactions({ type: 'OUT' })).data;
    const matchingTx = outTxs.find(t => t.note && t.note.includes(createdOrder.code));
    expect(matchingTx).toBeDefined();
    expect(matchingTx.accountId).toBe('acc-admin-seller');
    expect(matchingTx.workSessionId).toBe(sessionId);

    // Verify product stock decremented
    const updatedProd = (await productApi.getById(testProd.id)).data;
    expect(updatedProd.stockQuantity).toBe(initialStock - 2);

    // Verify STILL zero WorkSessionMember records for Admin
    const members = (await workSessionApi.getMembers({ accountId: 'acc-admin-seller' })).data;
    expect(members.length).toBe(0);
  });

  // =========================================================================
  // 4. STAFF INVENTORY IMPORT / EXPORT WITHOUT WORK SESSION MEMBER
  // =========================================================================
  it('4. Staff completes inventory import/export with no WorkSessionMember, transaction carries valid workSessionId', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const sessionId = `ws_${today}`;
    const sessionCode = `CA-${today.replace(/-/g, '')}-01`;

    // Create daily active WorkSession
    await workSessionApi.create({
      id: sessionId,
      code: sessionCode,
      date: today,
      shiftType: 'daily',
      status: 'active'
    });

    const staffUser = {
      id: 'acc-staff-inventory',
      role: 'staff',
      name: 'Staff Kho',
      employeeCode: 'STAFF99',
      permissions: ['inventory.import', 'inventory.export']
    };

    const actionRef = { current: null };
    renderAppWithUser({ authUser: staffUser, onActionRef: actionRef });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));

    const testProd = actionRef.current.products[0];
    const initialStock = testProd.stockQuantity;

    // 1. Staff imports stock
    await act(async () => {
      await actionRef.current.importStock(testProd.id, 10, 150000, 'Staff nhập hàng đợt 1');
    });

    const inTxs = (await inventoryApi.getAllTransactions({ type: 'IN' })).data;
    const matchingIn = inTxs.find(t => t.note === 'Staff nhập hàng đợt 1');
    expect(matchingIn).toBeDefined();
    expect(matchingIn.accountId).toBe('acc-staff-inventory');
    expect(matchingIn.workSessionId).toBe(sessionId);
    expect(matchingIn.quantity).toBe(10);

    const prodAfterIn = (await productApi.getById(testProd.id)).data;
    expect(prodAfterIn.stockQuantity).toBe(initialStock + 10);

    // 2. Staff exports stock
    await act(async () => {
      await actionRef.current.exportStock(testProd.id, 4, 'Staff xuất hàng kiểm tra');
    });

    const outTxs = (await inventoryApi.getAllTransactions({ type: 'OUT' })).data;
    const matchingOut = outTxs.find(t => t.note === 'Staff xuất hàng kiểm tra');
    expect(matchingOut).toBeDefined();
    expect(matchingOut.accountId).toBe('acc-staff-inventory');
    expect(matchingOut.workSessionId).toBe(sessionId);
    expect(matchingOut.quantity).toBe(4);

    const prodAfterOut = (await productApi.getById(testProd.id)).data;
    expect(prodAfterOut.stockQuantity).toBe(initialStock + 10 - 4);

    // Verify STILL zero WorkSessionMember records for Staff
    const members = (await workSessionApi.getMembers({ accountId: 'acc-staff-inventory' })).data;
    expect(members.length).toBe(0);
  });

  // =========================================================================
  // 5. EMPLOYEE BEHAVIOR REMAINS 100% UNCHANGED
  // =========================================================================
  it('5. Employee login/check-in/checkout/late calculation behavior remains 100% unchanged', async () => {
    vi.useFakeTimers();
    // Login at 07:45 (Morning start 07:30 -> 15 mins late)
    const empLoginTime = new Date(2026, 8, 12, 7, 45, 0);
    vi.setSystemTime(empLoginTime);

    const staffRec = await staffApi.create({
      id: 'st-employee-shift',
      employeeCode: 'NV100',
      name: 'Nhân viên Ca',
      isActive: true,
      employmentStatus: 'working'
    });

    await accountApi.create({
      id: 'acc-employee-shift',
      employeeId: staffRec.data.id,
      role: ROLES.EMPLOYEE,
      pin: '654321',
      isActive: true
    });

    const { result: auth } = renderHook(() => useAuth(), { wrapper: authWrapper });

    // 1. Employee logs in
    let loginRes;
    await act(async () => {
      loginRes = await auth.current.loginStaff({
        employeeCode: 'NV100',
        pin: '654321'
      });
    });

    expect(loginRes.success).toBe(true);
    expect(auth.current.isAuthenticated).toBe(true);
    expect(auth.current.isEmployee).toBe(true);

    // Verify WorkSessionMember record created with proper attendance & late info
    const members = (await workSessionApi.getMembers({ accountId: 'acc-employee-shift' })).data;
    expect(members.length).toBe(1);

    const member = members[0];
    expect(member.attendanceStatus).toBe('present');
    expect(member.checkInTime).toBe(empLoginTime.toISOString());
    expect(member.checkOutTime).toBeNull();
    expect(member.isLate).toBe(true);
    expect(member.lateMinutes).toBe(10);
    expect(member.workingStatus).toBe('active');

    // Verify CHECK_IN activity log exists for Employee
    const logs = (await activityLogApi.getAll()).data;
    const checkInLogs = logs.filter(l => l.action === 'CHECK_IN' && l.actorId === 'acc-employee-shift');
    expect(checkInLogs.length).toBe(1);

    // 2. Employee logs out at 12:00
    const logoutTime = new Date(2026, 8, 12, 12, 0, 0);
    vi.setSystemTime(logoutTime);

    await act(async () => {
      await auth.current.logout();
    });

    expect(auth.current.isAuthenticated).toBe(false);

    // Verify WorkSessionMember updated with checkout time and completed status
    const membersAfterLogout = (await workSessionApi.getMembers({ accountId: 'acc-employee-shift' })).data;
    expect(membersAfterLogout.length).toBe(1);
    expect(membersAfterLogout[0].attendanceStatus).toBe('completed');
    expect(membersAfterLogout[0].checkOutTime).toBe(logoutTime.toISOString());
    expect(membersAfterLogout[0].workingStatus).toBe('offline');

    vi.useRealTimers();
  });
});
