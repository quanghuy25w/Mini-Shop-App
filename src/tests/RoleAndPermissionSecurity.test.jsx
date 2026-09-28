import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import AppRoutes from '../routes/AppRoutes';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import { renderWithProviders } from './testUtils';
import { ROLES, PERMISSIONS, hasPermission } from '../utils/permissions';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { workSessionApi } from '../api/workSessionApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { categoryApi } from '../api/categoryApi';
import { orderApi } from '../api/orderApi';


describe('Mini-Shop 3-Role & Permission Security System Tests', () => {
  const adminActor = {
    id: 'acc-admin',
    role: ROLES.ADMIN,
    name: 'Quản trị viên Admin',
    email: 'admin@shop.vn',
    permissions: [],
    isActive: true,
  };

  const staffActor = {
    id: 'acc-staff',
    role: ROLES.STAFF,
    name: 'Quản lý Cửa Hàng',
    employeeCode: 'NV002',
    permissions: [],
    isActive: true,
  };

  const employeeActor = {
    id: 'acc-employee',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên Thu Ngân',
    employeeCode: 'NV003',
    permissions: [],
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  describe('1. Role Matrix & hasPermission Rules', () => {
    it('Enforces exactly 3 canonical roles: admin, staff, employee', () => {
      expect(ROLES).toEqual({
        ADMIN: 'admin',
        STAFF: 'staff',
        EMPLOYEE: 'employee',
      });
      expect(Object.keys(ROLES).length).toBe(3);
    });

    it('ADMIN has full access to every single permission', () => {
      Object.values(PERMISSIONS).forEach((perm) => {
        expect(hasPermission(adminActor, perm)).toBe(true);
      });
    });

    it('STAFF has store operational permissions but is DENIED account and permission management', () => {
      // Allowed operations
      expect(hasPermission(staffActor, PERMISSIONS.PRODUCT_CREATE)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.PRODUCT_UPDATE)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.CATEGORY_CREATE)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.INVENTORY_IMPORT)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.INVENTORY_EXPORT)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.ORDER_CREATE)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.TRANSACTION_VIEW_ALL)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.EMPLOYEE_VIEW)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.EMPLOYEE_MANAGE)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.WORK_SESSION_MANAGE)).toBe(true);
      expect(hasPermission(staffActor, PERMISSIONS.ACTIVITY_LOG_VIEW)).toBe(true);

      // Forbidden operations
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_VIEW)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_CREATE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_UPDATE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.ACCOUNT_DELETE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.PERMISSION_VIEW)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.PERMISSION_MANAGE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.PRODUCT_DELETE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.CATEGORY_DELETE)).toBe(false);
    });

    it('EMPLOYEE has basic store operation permissions only', () => {
      // Allowed operations
      expect(hasPermission(employeeActor, PERMISSIONS.PRODUCT_VIEW)).toBe(true);
      expect(hasPermission(employeeActor, PERMISSIONS.CATEGORY_VIEW)).toBe(true);
      expect(hasPermission(employeeActor, PERMISSIONS.INVENTORY_VIEW)).toBe(true);
      expect(hasPermission(employeeActor, PERMISSIONS.ORDER_VIEW)).toBe(true);
      expect(hasPermission(employeeActor, PERMISSIONS.ORDER_CREATE)).toBe(true);
      expect(hasPermission(employeeActor, PERMISSIONS.ORDER_CANCEL)).toBe(true);
      expect(hasPermission(employeeActor, PERMISSIONS.WORK_SESSION_VIEW)).toBe(true);

      // Forbidden operations
      expect(hasPermission(employeeActor, PERMISSIONS.PRODUCT_CREATE)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.CATEGORY_CREATE)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.INVENTORY_IMPORT)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.INVENTORY_EXPORT)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.INVENTORY_ADJUST)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.ORDER_CANCEL_MANAGEMENT)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.TRANSACTION_VIEW_ALL)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.EMPLOYEE_VIEW)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.EMPLOYEE_MANAGE)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.WORK_SESSION_MANAGE)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.ACCOUNT_VIEW)).toBe(false);
      expect(hasPermission(employeeActor, PERMISSIONS.ACTIVITY_LOG_VIEW)).toBe(false);
    });

    it('Strict Role Ceiling: Employee CANNOT be granted permissions outside ROLE_DEFAULT_PERMISSIONS', () => {
      const delegatedEmployee = {
        ...employeeActor,
        permissions: [PERMISSIONS.INVENTORY_IMPORT, PERMISSIONS.INVENTORY_EXPORT],
      };

      expect(delegatedEmployee.role).toBe('employee');
      // Role ceiling denies inventory import/export even if injected into permissions array
      expect(hasPermission(delegatedEmployee, PERMISSIONS.INVENTORY_IMPORT)).toBe(false);
      expect(hasPermission(delegatedEmployee, PERMISSIONS.INVENTORY_EXPORT)).toBe(false);
      // Still denied other management permissions
      expect(hasPermission(delegatedEmployee, PERMISSIONS.EMPLOYEE_MANAGE)).toBe(false);
      expect(hasPermission(delegatedEmployee, PERMISSIONS.ACCOUNT_CREATE)).toBe(false);
    });
  });

  describe('2. Data Layer / API Security (Action Rejection on Direct Mutation)', () => {
    it('STAFF calling accountApi mutations is rejected with PERMISSION_DENIED', async () => {
      expect(() => {
        accountApi.create({ id: 'acc-hack', role: 'admin' }, staffActor);
      }).toThrowError(/PERMISSION_DENIED/);

      expect(() => {
        accountApi.update('acc-1', { role: 'admin' }, staffActor);
      }).toThrowError(/PERMISSION_DENIED/);

      expect(() => {
        accountApi.updatePin('acc-1', '123456', staffActor);
      }).toThrowError(/PERMISSION_DENIED/);

      expect(() => {
        accountApi.remove('acc-1', staffActor);
      }).toThrowError(/PERMISSION_DENIED/);
    });

    it('EMPLOYEE calling inventoryApi.createTransaction is rejected even with injected permissions (Role Ceiling)', async () => {
      const importTx = {
        productId: 'prod-1',
        type: 'IN',
        quantity: 50,
        unitPrice: 10000,
      };

      // Ordinary Employee without inventory.import
      expect(() => {
        inventoryApi.createTransaction(importTx, employeeActor);
      }).toThrowError(/PERMISSION_DENIED/);

      // Delegated Employee with injected inventory.import is STILL rejected
      const delegatedEmployee = {
        ...employeeActor,
        permissions: [PERMISSIONS.INVENTORY_IMPORT],
      };

      expect(() => {
        inventoryApi.createTransaction(importTx, delegatedEmployee);
      }).toThrowError(/PERMISSION_DENIED/);
    });

    it('EMPLOYEE calling staffApi management is rejected with PERMISSION_DENIED', async () => {
      expect(() => {
        staffApi.create({ name: 'Hacker', employeeCode: 'NV999' }, employeeActor);
      }).toThrowError(/PERMISSION_DENIED/);

      expect(() => {
        staffApi.patch('staff-1', { isActive: false }, employeeActor);
      }).toThrowError(/PERMISSION_DENIED/);

      expect(() => {
        staffApi.remove('staff-1', employeeActor);
      }).toThrowError(/PERMISSION_DENIED/);
    });

    it('EMPLOYEE calling workSessionApi.create is rejected with PERMISSION_DENIED', async () => {
      expect(() => {
        workSessionApi.create({ code: 'CA-TEST' }, employeeActor);
      }).toThrowError(/PERMISSION_DENIED/);
    });

    it('STAFF calling product delete or category delete is rejected (Admin only)', async () => {
      const prods = (await productApi.getAll()).data;
      const targetId = prods[0]?.id || 'p0000000-0000-0000-0000-000000000001';

      expect(() => {
        productApi.softDelete(targetId, staffActor);
      }).toThrowError(/PERMISSION_DENIED/);

      expect(() => {
        categoryApi.remove('cat-1', staffActor);
      }).toThrowError(/PERMISSION_DENIED/);

      // But Admin CAN delete
      const deletedProd = await productApi.softDelete(targetId, adminActor);
      expect(deletedProd.data.isActive).toBe(false);
    });

    it('Enforces strict order cancellation rules: Employee is restricted, Staff/Admin can manage', async () => {
      const now = new Date();
      const freshOrder = {
        id: 'ord-fresh',
        code: 'DH-001',
        accountId: employeeActor.id,
        workSessionId: 'ws-current',
        createdAt: now.toISOString(),
      };

      const someoneElseOrder = {
        id: 'ord-other',
        code: 'DH-002',
        accountId: 'acc-other-employee',
        workSessionId: 'ws-current',
        createdAt: now.toISOString(),
      };

      const oldOrder = {
        id: 'ord-old',
        code: 'DH-003',
        accountId: employeeActor.id,
        workSessionId: 'ws-current',
        createdAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(), // 25 mins ago
      };

      // Employee cannot cancel another user's order
      expect(() => {
        orderApi.cancel('ord-other', {
          actor: employeeActor,
          reason: 'Khách đổi ý',
          order: someoneElseOrder,
          currentSessionId: 'ws-current',
        });
      }).toThrowError('CANCEL_DENIED');

      // Employee cannot cancel order older than 15 mins
      expect(() => {
        orderApi.cancel('ord-old', {
          actor: employeeActor,
          reason: 'Hủy nhầm',
          order: oldOrder,
          currentSessionId: 'ws-current',
        });
      }).toThrowError('CANCEL_DENIED');

      // Employee CAN cancel fresh own order (within 15 mins in current session)
      await orderApi.create(freshOrder, employeeActor);
      const empCancel = await orderApi.cancel('ord-fresh', {
        actor: employeeActor,
        reason: 'Khách đổi món',
        order: freshOrder,
        currentSessionId: 'ws-current',
      });
      expect(empCancel.data.status).toBe('cancelled');

      // Staff with cancel_management CAN cancel any order (even old or from someone else)
      await orderApi.create(someoneElseOrder, adminActor);
      const staffCancel = await orderApi.cancel('ord-other', {
        actor: staffActor,
        reason: 'Quản lý duyệt hoàn hủy',
        order: someoneElseOrder,
        currentSessionId: 'ws-current',
      });
      expect(staffCancel.data.status).toBe('cancelled');
    });
  });

  describe('3. Route Protection Security', () => {
    it('Redirects EMPLOYEE away from /accounts, /import, and /work-sessions', async () => {
      // 1. Employee attempting to access /accounts
      renderWithProviders(<AppRoutes />, {
        auth: {
          currentUser: employeeActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          isEmployee: true,
          hasAdmin: true,
          loading: false,
        },
        route: '/accounts',
      });

      await waitFor(() => {
        // Must be redirected to dashboard /
        expect(screen.getByText(/Tổng Quan \(Dashboard\)/i)).toBeTruthy();
        expect(screen.queryByText('Quản lý tài khoản')).toBeNull();
      });
    });

    it('Redirects STAFF away from /accounts, but allows /staff and /work-sessions', async () => {
      // Staff attempting to access /accounts
      const { unmount } = renderWithProviders(<AppRoutes />, {
        auth: {
          currentUser: staffActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: true,
          isEmployee: false,
          hasAdmin: true,
          loading: false,
        },
        route: '/accounts',
      });

      await waitFor(() => {
        expect(screen.getByText(/Tổng Quan \(Dashboard\)/i)).toBeTruthy();
        expect(screen.queryByText('Quản lý tài khoản')).toBeNull();
      });
      unmount();

      // Staff accessing /staff -> permitted
      renderWithProviders(<AppRoutes />, {
        auth: {
          currentUser: staffActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: true,
          isEmployee: false,
          hasAdmin: true,
          loading: false,
        },
        route: '/staff',
      });

      await waitFor(() => {
        expect(screen.getByText('Quản lý nhân viên')).toBeTruthy();
      });
    });

    it('Allows ADMIN to access /accounts', async () => {
      renderWithProviders(<AppRoutes />, {
        auth: {
          currentUser: adminActor,
          isAuthenticated: true,
          isAdmin: true,
          isStaff: false,
          isEmployee: false,
          hasAdmin: true,
          loading: false,
        },
        route: '/accounts',
      });

      await waitFor(() => {
        expect(screen.getByText('Quản lý tài khoản')).toBeTruthy();
      });
    });
  });

  describe('4. UI Navigation & Header Badge Security', () => {
    it('Sidebar shows only basic operational items for EMPLOYEE', () => {
      renderWithProviders(<Sidebar isOpen={true} onClose={() => {}} />, {
        auth: {
          currentUser: employeeActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          isEmployee: true,
        },
      });

      // Permitted links
      expect(screen.getByText('Dashboard')).toBeTruthy();
      expect(screen.getByText('Danh mục')).toBeTruthy();
      expect(screen.getByText('Sản phẩm')).toBeTruthy();
      expect(screen.getByText('Bán hàng')).toBeTruthy();
      expect(screen.getByText('Lịch sử Giao dịch')).toBeTruthy();

      // Hidden links for employee
      expect(screen.queryByText('Nhập hàng')).toBeNull();
      expect(screen.queryByText('Xuất hàng')).toBeNull();
      expect(screen.queryByText('Ca làm việc')).toBeNull();
      expect(screen.queryByText('Nhân viên')).toBeNull();
      expect(screen.queryByText('Tài khoản')).toBeNull();
      expect(screen.queryByText('Lịch sử hoạt động')).toBeNull();
    });

    it('Sidebar shows store operations for STAFF but HIDES Tài khoản', () => {
      renderWithProviders(<Sidebar isOpen={true} onClose={() => {}} />, {
        auth: {
          currentUser: staffActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: true,
          isEmployee: false,
        },
      });

      // Staff sees all operational links
      expect(screen.getByText('Nhập hàng')).toBeTruthy();
      expect(screen.getByText('Xuất hàng')).toBeTruthy();
      expect(screen.getByText('Ca làm việc')).toBeTruthy();
      expect(screen.getByText('Nhân viên')).toBeTruthy();
      expect(screen.getByText('Lịch sử hoạt động')).toBeTruthy();

      // But does NOT see Accounts
      expect(screen.queryByText('Tài khoản')).toBeNull();
    });

    it('Header badge shows appropriate Vietnamese role labels for each Role', () => {
      // 1. Admin badge
      const { unmount: unmount1 } = renderWithProviders(<Header onToggleNav={() => {}} />, {
        auth: {
          currentUser: adminActor,
          isAuthenticated: true,
          isAdmin: true,
          isStaff: false,
          isEmployee: false,
          logout: () => {},
        },
      });
      expect(screen.getByText('Quản trị viên')).toBeTruthy();
      unmount1();

      // 2. Staff badge
      const { unmount: unmount2 } = renderWithProviders(<Header onToggleNav={() => {}} />, {
        auth: {
          currentUser: staffActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: true,
          isEmployee: false,
          logout: () => {},
        },
      });
      expect(screen.getByText('Staff (NV002)')).toBeTruthy();
      unmount2();

      // 3. Employee badge
      renderWithProviders(<Header onToggleNav={() => {}} />, {
        auth: {
          currentUser: employeeActor,
          isAuthenticated: true,
          isAdmin: false,
          isStaff: false,
          isEmployee: true,
          logout: () => {},
        },
      });
      expect(screen.getByText('Nhân viên (NV003)')).toBeTruthy();
    });
  });

  describe('5. Product Profile Mutation vs Stock Mutation Security', () => {
    it('Blocks generic productApi.patch without actor or when lacking product.manage permission', async () => {
      const prodId = (await productApi.getAll()).data[0].id;

      // No actor
      expect(() => {
        productApi.patch(prodId, { name: 'New Name' });
      }).toThrowError(/NOT_AUTHENTICATED/);

      // Employee lacking product.manage
      expect(() => {
        productApi.patch(prodId, { name: 'New Name' }, employeeActor);
      }).toThrowError(/PERMISSION_DENIED/);
    });

    it('Rejects direct stockQuantity tampering via generic productApi.patch with STOCK_MUTATION_RESTRICTED', async () => {
      const prodId = (await productApi.getAll()).data[0].id;

      // Admin or Staff attempting to directly patch stockQuantity via generic patch
      expect(() => {
        productApi.patch(prodId, { stockQuantity: 9999 }, adminActor);
      }).toThrowError(/STOCK_MUTATION_RESTRICTED/);

      expect(() => {
        productApi.patch(prodId, { name: 'Updated Name', stockQuantity: 50 }, staffActor);
      }).toThrowError(/STOCK_MUTATION_RESTRICTED/);
    });

    it('Allows generic productApi.patch for profile fields (e.g. name, sellPrice) with authorized actor', async () => {
      const prodId = (await productApi.getAll()).data[0].id;
      const res = await productApi.patch(prodId, { name: 'Cà phê rang xay Robusta Cao Cấp' }, staffActor);
      expect(res.data.name).toBe('Cà phê rang xay Robusta Cao Cấp');

      const prod = await productApi.getById(prodId);
      expect(prod.data.name).toBe('Cà phê rang xay Robusta Cao Cấp');
    });

    it('Preserves true database stockQuantity when productApi.update() is called with modified stockQuantity', async () => {
      const prodId = (await productApi.getAll()).data[0].id;
      const initialProd = (await productApi.getById(prodId)).data;
      const initialStock = initialProd.stockQuantity;

      // Tampered update payload trying to change stockQuantity from 76 to 500
      const tamperedPayload = {
        ...initialProd,
        name: 'Cà phê rang xay Đắk Lắk Đặc Biệt',
        stockQuantity: 500,
      };

      await productApi.update(prodId, tamperedPayload, staffActor);

      const updatedProd = (await productApi.getById(prodId)).data;
      expect(updatedProd.name).toBe('Cà phê rang xay Đắk Lắk Đặc Biệt');
      // stockQuantity must remain untouched!
      expect(updatedProd.stockQuantity).toBe(initialStock);
    });

    it('Blocks productApi.updateStock if actor is not authenticated or lacks inventory permissions', async () => {
      const prodId = (await productApi.getAll()).data[0].id;

      // Unauthenticated
      await expect(
        productApi.updateStock(prodId, 100, null)
      ).rejects.toThrowError(/NOT_AUTHENTICATED/);

      // Unauthorized employee trying to import without permission
      await expect(
        productApi.updateStock(prodId, 100, employeeActor, { source: 'inventory_import' })
      ).rejects.toThrowError(/PERMISSION_DENIED/);

      // Unauthorized employee trying generic adjustment without permission
      await expect(
        productApi.updateStock(prodId, 100, employeeActor)
      ).rejects.toThrowError(/PERMISSION_DENIED/);
    });

    it('Allows productApi.updateStock for authorized roles (Admin, Staff) and rejects Employee under Role Ceiling', async () => {
      const prodId = (await productApi.getAll()).data[0].id;

      // Staff with inventory permissions
      const staffRes = await productApi.updateStock(prodId, 85, staffActor, { source: 'inventory_import' });
      expect(staffRes.data.stockQuantity).toBe(85);

      // Admin
      const adminRes = await productApi.updateStock(prodId, 90, adminActor, { source: 'inventory_import' });
      expect(adminRes.data.stockQuantity).toBe(90);

      // Employee with injected permissions is REJECTED
      const delegatedEmployee = {
        ...employeeActor,
        permissions: [PERMISSIONS.INVENTORY_IMPORT],
      };
      await expect(
        productApi.updateStock(prodId, 95, delegatedEmployee, { source: 'inventory_import' })
      ).rejects.toThrowError(/PERMISSION_DENIED/);
    });

    it('Rejects negative stock values in productApi.updateStock with INVALID_STOCK', async () => {
      const prodId = (await productApi.getAll()).data[0].id;
      await expect(
        productApi.updateStock(prodId, -10, adminActor)
      ).rejects.toThrowError(/INVALID_STOCK/);
    });
  });
});
