import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './testUtils';
import AppRoutes from '../routes/AppRoutes';
import DashboardPage from '../pages/DashboardPage';
import ActivityLogPage from '../pages/ActivityLogPage';
import { ROLES, PERMISSIONS, hasPermission, assertPermission } from '../utils/permissions';
import { accountApi } from '../api/accountApi';
import { orderApi } from '../api/orderApi';
import { activityLogApi } from '../api/activityLogApi';


describe('Confirmed Permissions: Staff Audit Logs & Employee Own Sales (Issue #2)', () => {
  const adminActor = {
    id: 'acc-admin-main',
    role: ROLES.ADMIN,
    name: 'Quản trị viên',
    email: 'admin@shop.vn',
    permissions: [],
    isActive: true,
  };

  const staffActor = {
    id: 'acc-staff-manager',
    role: ROLES.STAFF,
    name: 'Quản lý Cửa Hàng',
    employeeCode: 'NV001',
    employeeId: 'staff-001',
    permissions: [],
    isActive: true,
  };

  const employee1Actor = {
    id: 'acc-emp-1',
    role: ROLES.EMPLOYEE,
    name: 'Nguyễn Văn A',
    employeeCode: 'NV002',
    employeeId: 'staff-002',
    permissions: [],
    isActive: true,
  };

  const employee2Actor = {
    id: 'acc-emp-2',
    role: ROLES.EMPLOYEE,
    name: 'Trần Thị B',
    employeeCode: 'NV003',
    employeeId: 'staff-003',
    permissions: [],
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  // =========================================================================
  // 1. STAFF PERMISSIONS & AUDIT LOG VISIBILITY
  // =========================================================================
  describe('Rule 1: Staff Employee Activity & Audit Logs Access', () => {
    it('1. Staff can view employee activity and operational audit logs', async () => {
      // Seed activity logs from employee operations
      await activityLogApi.create({
        id: 'log-login-1',
        actorId: employee1Actor.id,
        actorRole: employee1Actor.role,
        action: 'LOGIN',
        entityType: 'auth',
        entityId: employee1Actor.id,
        timestamp: new Date().toISOString(),
      });

      await activityLogApi.create({
        id: 'log-checkin-1',
        actorId: employee1Actor.id,
        actorRole: employee1Actor.role,
        action: 'CHECK_IN',
        entityType: 'workSession',
        workSessionId: 'ws-01',
        timestamp: new Date().toISOString(),
      });

      await activityLogApi.create({
        id: 'log-order-1',
        actorId: employee1Actor.id,
        actorRole: employee1Actor.role,
        action: 'ORDER_CREATED',
        entityType: 'order',
        entityId: 'ord-101',
        metadata: { totalAmount: 150000 },
        timestamp: new Date().toISOString(),
      });

      // Staff has ACTIVITY_LOG_VIEW permission
      expect(hasPermission(staffActor, PERMISSIONS.ACTIVITY_LOG_VIEW)).toBe(true);

      // Staff can access and view ActivityLogPage
      renderWithProviders(<ActivityLogPage />, {
        auth: {
          currentUser: staffActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: true,
          isEmployee: false,
          can: (k) => hasPermission(staffActor, k),
        },
      });

      await waitFor(() => {
        expect(screen.getAllByText('Lịch sử hoạt động').length).toBeGreaterThan(0);
        expect(screen.getByText('Check-in ca')).toBeTruthy();
        expect(screen.getByText('Tạo đơn hàng')).toBeTruthy();
      });
    });

    it('2. Staff can navigate to /activity-logs route', async () => {
      renderWithProviders(<AppRoutes />, {
        auth: {
          currentUser: staffActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: true,
          isEmployee: false,
          hasAdmin: true,
          can: (k) => hasPermission(staffActor, k),
        },
        route: '/activity-logs',
      });

      await waitFor(() => {
        expect(screen.getAllByText('Lịch sử hoạt động').length).toBeGreaterThan(0);
      });
    });

    it('3. Staff CANNOT manage, create, update or delete Accounts', async () => {
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_VIEW)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_MANAGE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_CREATE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_UPDATE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_DELETE)).toBe(false);

      // Attempting account mutations with Staff actor throws PERMISSION_DENIED
      expect(() => {
        assertPermission(staffActor, PERMISSIONS.ACCOUNT_CREATE);
      }).toThrowError('PERMISSION_DENIED');

      expect(() => {
        accountApi.create({ email: 'new@shop.vn', role: 'employee' }, staffActor);
      }).toThrow();

      expect(() => {
        accountApi.remove('acc-target', staffActor);
      }).toThrow();
    });

    it('4. Staff CANNOT change permissions', async () => {
      expect(hasPermission(staffActor, PERMISSIONS.PERMISSION_VIEW)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.PERMISSION_MANAGE)).toBe(false);

      expect(() => {
        assertPermission(staffActor, PERMISSIONS.PERMISSION_MANAGE);
      }).toThrowError('PERMISSION_DENIED');

      expect(() => {
        accountApi.patch('acc-target', { permissions: ['inventory.import'] }, staffActor);
      }).toThrow();
    });

    it('5. Staff CANNOT access PIN/password administration for another user', async () => {
      expect(() => {
        accountApi.updatePin('acc-other', '123456', staffActor);
      }).toThrow();

      expect(() => {
        accountApi.updatePassword('acc-other', 'newpass123', staffActor);
      }).toThrow();
    });
  });

  // =========================================================================
  // 2. EMPLOYEE SALES PERFORMANCE & DATA ISOLATION
  // =========================================================================
  describe('Rule 2: Employee Own Sales Performance Visibility & Data Isolation', () => {
    it('1 & 2. Employee can view today and this week own sales performance and order counts', async () => {
      const now = new Date();
      const todayIso = now.toISOString();

      // Employee 1 creates 2 completed orders today (100k + 200k = 300k)
      await orderApi.create({
        id: 'ord-emp1-today1',
        code: 'HD001',
        accountId: employee1Actor.id,
        employeeId: employee1Actor.employeeId,
        totalAmount: 100000,
        status: 'completed',
        createdAt: todayIso,
        items: [{ productId: 'p1', productName: 'Bút', quantity: 2, price: 50000 }],
      }, employee1Actor);

      await orderApi.create({
        id: 'ord-emp1-today2',
        code: 'HD002',
        accountId: employee1Actor.id,
        employeeId: employee1Actor.employeeId,
        totalAmount: 200000,
        status: 'completed',
        createdAt: todayIso,
        items: [{ productId: 'p2', productName: 'Vở', quantity: 4, price: 50000 }],
      }, employee1Actor);

      renderWithProviders(<DashboardPage />, {
        auth: {
          currentUser: employee1Actor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          isEmployee: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Tổng Quan (Dashboard)')).toBeTruthy();
        expect(screen.getByText(/Hiệu suất bán hàng cá nhân của Nguyễn Văn A/)).toBeTruthy();
      });

      // Today KPI card checks
      expect(screen.getByText('Doanh số hôm nay')).toBeTruthy();
      expect(screen.getAllByText(/300\.000/).length).toBeGreaterThan(0);
      expect(screen.getByText('2 đơn hàng hôm nay')).toBeTruthy();

      // This Week KPI card checks
      expect(screen.getByText('Doanh số tuần này')).toBeTruthy();
      expect(screen.getAllByText(/300\.000/).length).toBeGreaterThan(0);
      expect(screen.getByText('2 đơn hàng tuần này')).toBeTruthy();
    });

    it('3. Employee CANNOT view another employee sales data on Dashboard', async () => {
      const now = new Date();
      const todayIso = now.toISOString();

      // Employee 1 has 1 order of 50.000đ
      await orderApi.create({
        id: 'ord-emp1',
        code: 'HD-EMP1',
        accountId: employee1Actor.id,
        employeeId: employee1Actor.employeeId,
        totalAmount: 50000,
        status: 'completed',
        createdAt: todayIso,
      }, employee1Actor);

      // Employee 2 (different employee) has 1 order of 5.000.000đ
      await orderApi.create({
        id: 'ord-emp2',
        code: 'HD-EMP2',
        accountId: employee2Actor.id,
        employeeId: employee2Actor.employeeId,
        totalAmount: 5000000,
        status: 'completed',
        createdAt: todayIso,
      }, employee2Actor);

      // Render as Employee 1
      renderWithProviders(<DashboardPage />, {
        auth: {
          currentUser: employee1Actor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          isEmployee: true,
        },
      });

      await waitFor(() => {
        expect(screen.getAllByText(/50\.000/).length).toBeGreaterThan(0);
      });

      // Must NOT see Employee 2's 5.000.000đ
      expect(screen.queryByText(/5\.000\.000/)).toBeNull();
      expect(screen.queryByText(/5\.050\.000/)).toBeNull();

      // Must NOT see Employee 2's order code in recent orders
      expect(screen.queryByText('HD-EMP2')).toBeNull();
      expect(screen.getByText('HD-EMP1')).toBeTruthy();
    });

    it('4. Changing employeeId in route/query param does NOT leak another employee sales', async () => {
      const now = new Date();
      const todayIso = now.toISOString();

      await orderApi.create({
        id: 'ord-emp1',
        code: 'HD-E1',
        accountId: employee1Actor.id,
        totalAmount: 80000,
        status: 'completed',
        createdAt: todayIso,
      }, employee1Actor);

      await orderApi.create({
        id: 'ord-emp2',
        code: 'HD-E2',
        accountId: employee2Actor.id,
        totalAmount: 999000,
        status: 'completed',
        createdAt: todayIso,
      }, employee2Actor);

      // Query param attempt: /?employeeId=staff-003 or /?accountId=acc-emp-2
      renderWithProviders(<DashboardPage />, {
        auth: {
          currentUser: employee1Actor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          isEmployee: true,
        },
        route: '/?employeeId=staff-003&accountId=acc-emp-2',
      });

      await waitFor(() => {
        expect(screen.getAllByText(/80\.000/).length).toBeGreaterThan(0);
      });

      expect(screen.queryByText(/999\.000/)).toBeNull();
      expect(screen.queryByText('HD-E2')).toBeNull();
    });

    it('5. Cancelled orders are excluded from completed sales calculations', async () => {
      const now = new Date();
      const todayIso = now.toISOString();

      // 1 completed order (120k)
      await orderApi.create({
        id: 'ord-completed',
        code: 'HD-OK',
        accountId: employee1Actor.id,
        totalAmount: 120000,
        status: 'completed',
        createdAt: todayIso,
      }, employee1Actor);

      // 1 cancelled order (500k)
      await orderApi.create({
        id: 'ord-cancelled',
        code: 'HD-CANCEL',
        accountId: employee1Actor.id,
        totalAmount: 500000,
        status: 'cancelled',
        createdAt: todayIso,
      }, employee1Actor);

      renderWithProviders(<DashboardPage />, {
        auth: {
          currentUser: employee1Actor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          isEmployee: true,
        },
      });

      await waitFor(() => {
        expect(screen.getAllByText(/120\.000/).length).toBeGreaterThan(0);
      });

      // 500k cancelled order is NOT added into sales total
      expect(screen.queryByText(/620\.000/)).toBeNull();
      expect(screen.queryByText(/500\.000/)).toBeNull();
      expect(screen.getByText('1 đơn hàng hôm nay')).toBeTruthy();
    });
  });

  // =========================================================================
  // 3. ADMIN ACCESS PRESERVATION
  // =========================================================================
  describe('Rule 3: Admin Full Access Preservation', () => {
    it('Admin retains full system access and store-wide dashboard overview', async () => {
      renderWithProviders(<DashboardPage />, {
        auth: {
          currentUser: adminActor,
          isAuthenticated: true,
          isAdmin: true,
          isStaff: false,
          isEmployee: false,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Sản phẩm đang bán')).toBeTruthy();
        expect(screen.getByText('Tổng giá trị tồn kho')).toBeTruthy();
        expect(screen.getByText('Doanh thu 7 ngày')).toBeTruthy();
        expect(screen.getByText('Đơn hàng 7 ngày')).toBeTruthy();
      });
    });
  });
});
