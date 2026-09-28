import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, hasPermission, assertPermission } from '../utils/permissions';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { productApi } from '../api/productApi';
import { categoryApi } from '../api/categoryApi';
import { inventoryApi } from '../api/inventoryApi';
import { orderApi } from '../api/orderApi';
import { workSessionApi } from '../api/workSessionApi';
import { activityLogApi } from '../api/activityLogApi';

describe('Phase 6A: Authoritative RBAC & Permission Integrity Hardening Tests', () => {
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
    employeeId: 'staff-002',
    permissions: [],
    isActive: true,
  };

  const employee1Actor = {
    id: 'acc-emp-1',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên Thu Ngân A',
    employeeCode: 'NV003',
    employeeId: 'staff-003',
    permissions: [],
    isActive: true,
  };

  const employee2Actor = {
    id: 'acc-emp-2',
    role: ROLES.EMPLOYEE,
    name: 'Nhân viên B',
    employeeCode: 'NV004',
    employeeId: 'staff-004',
    permissions: [],
    isActive: true,
  };

  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  // =========================================================================
  // 1. ADMIN FULL OPERATIONAL ACCESS
  // =========================================================================
  describe('1. Admin Full Operational Access', () => {
    it('1.1. Admin can create POS sales orders without being blocked', async () => {
      const orderPayload = {
        id: 'ord-admin-01',
        code: 'HD-ADM-01',
        totalAmount: 150000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 150000 }],
        paymentMethod: 'cash',
      };

      const res = await orderApi.create(orderPayload, adminActor);
      expect(res.data.status).toBe('completed');
      expect(res.data.accountId).toBe(adminActor.id);
      expect(res.data.sellerId).toBe(adminActor.id);
    });

    it('1.2. Admin can cancel any order without 15-minute restriction', async () => {
      // Create an older order (e.g. 60 minutes ago)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const oldOrder = {
        id: 'ord-old-admin',
        code: 'HD-OLD-ADM',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 100000, items: [{ productId: 'p4', quantity: 100000, price: 1 }],
        status: 'completed',
        createdAt: oneHourAgo,
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 100000 }],
      };
      await orderApi.create(oldOrder, adminActor);

      const cancelRes = await orderApi.cancel(oldOrder.id, {
        actor: adminActor,
        reason: 'Quản trị viên hủy đơn hàng cũ theo yêu cầu khách hàng',
        order: oldOrder,
        currentSessionId: 'ws-active-1',
      });

      expect(cancelRes.data.status).toBe('cancelled');
      expect(cancelRes.data.cancelledBy).toBe(adminActor.id);
    });

    it('1.3. Admin can perform inventory adjustments and void transactions', async () => {
      const txRes = await inventoryApi.createTransaction({
        type: 'ADJUST',
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 5,
        reason: 'Kiểm kê định kỳ Admin',
      }, adminActor);

      expect(txRes.data.id).toBeDefined();

      const voidRes = await inventoryApi.voidTransaction(txRes.data.id, adminActor);
      expect(voidRes.data.isVoided).toBe(true);
      expect(voidRes.data.voidedBy).toBe(adminActor.id);
    });

    it('1.4. Admin can create, close, and cancel work sessions', async () => {
      const wsRes = await workSessionApi.create({
        id: 'ws-adm-test',
        date: '2026-11-20',
        shiftType: 'daily',
        name: 'Ca thử nghiệm Admin',
        status: 'active',
        initialCash: 500000,
      }, adminActor);

      expect(wsRes.data.id).toBe('ws-adm-test');

      const closeRes = await workSessionApi.closeSession('ws-adm-test', {
        actualCash: 500000,
        closeNote: 'Admin đóng ca kiểm thử',
        actor: adminActor,
      });
      expect(closeRes.status).toBe('closed');
      expect(closeRes.closedBy).toBe(adminActor.id);

      // Create planned session and cancel it
      const plannedWs = await workSessionApi.create({
        id: 'ws-adm-cancel-test',
        date: '2026-11-21',
        shiftType: 'daily',
        name: 'Ca hủy Admin',
        status: 'planned',
      }, adminActor);

      const cancelWsRes = await workSessionApi.cancelSession(plannedWs.data.id, {
        reason: 'Hủy kế hoạch ca',
        actor: adminActor,
      });
      expect(cancelWsRes.status).toBe('cancelled');
    });

    it('1.5. Admin can create, update accounts and modify roles/permissions', async () => {
      const newAccRes = await accountApi.create({
        id: 'acc-new-staff',
        username: 'staff_candidate',
        email: 'candidate@shop.vn',
        role: ROLES.STAFF,
        password: 'password123',
        pin: '123456',
        isActive: true,
      }, adminActor);

      expect(newAccRes.data.id).toBe('acc-new-staff');

      // Admin updates role to employee
      const patchRes = await accountApi.patch('acc-new-staff', {
        role: ROLES.EMPLOYEE,
      }, adminActor);
      expect(patchRes.data.role).toBe(ROLES.EMPLOYEE);
    });
  });

  // =========================================================================
  // 2. STAFF BOUNDARY ENFORCEMENT
  // =========================================================================
  describe('2. Staff Boundary Enforcement', () => {
    it('2.1. Staff can create and update products and categories', async () => {
      const catRes = await categoryApi.create({
        id: 'cat-staff-01',
        name: 'Danh mục Staff Tạo',
        code: 'CAT-STAFF',
        isActive: true,
      }, staffActor);
      expect(catRes.data.id).toBe('cat-staff-01');

      const prodRes = await productApi.create({
        id: 'prod-staff-01',
        name: 'Sản phẩm Staff Tạo',
        sku: 'SKU-STAFF-01',
        price: 25000,
        categoryId: 'cat-staff-01',
        isActive: true,
      }, staffActor);
      expect(prodRes.data.id).toBe('prod-staff-01');

      const updateProdRes = await productApi.update('prod-staff-01', {
        ...prodRes.data,
        name: 'Sản phẩm Staff Sửa Tên',
      }, staffActor);
      expect(updateProdRes.data.name).toBe('Sản phẩm Staff Sửa Tên');
    });

    it('2.2. Staff can import, export, and adjust inventory', async () => {
      const importRes = await inventoryApi.createTransaction({
        type: 'IN',
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: 15,
        reason: 'Nhập hàng nhà cung cấp',
      }, staffActor);
      expect(importRes.data.type).toBe('IN');

      const adjustRes = await inventoryApi.createTransaction({
        type: 'ADJUST',
        productId: 'p0000000-0000-0000-0000-000000000001',
        quantity: -2,
        reason: 'Hàng hỏng định kỳ',
      }, staffActor);
      expect(adjustRes.data.type).toBe('ADJUST');
    });

    it('2.3. Staff can manage employee personnel records in staffApi', async () => {
      const staffEmp = await staffApi.create({
        id: 'stf-new-emp',
        employeeCode: 'NV888',
        name: 'Nhân viên Mới Staff Tạo',
        employmentStatus: 'active',
        isActive: true,
      }, staffActor);
      expect(staffEmp.data.id).toBe('stf-new-emp');

      const updateEmp = await staffApi.patch('stf-new-emp', {
        name: 'Nhân viên Đã Cập Nhật',
      }, staffActor);
      expect(updateEmp.data.name).toBe('Nhân viên Đã Cập Nhật');
    });

    it('2.4. Staff can view and close work sessions', async () => {
      const wsRes = await workSessionApi.create({
        id: 'ws-staff-test',
        date: '2026-11-22',
        shiftType: 'daily',
        name: 'Ca Staff Quản lý',
        status: 'active',
        initialCash: 200000,
      }, staffActor);
      expect(wsRes.data.id).toBe('ws-staff-test');

      const closeRes = await workSessionApi.closeSession('ws-staff-test', {
        actualCash: 200000,
        closeNote: 'Staff đóng ca cuối ngày',
        actor: staffActor,
      });
      expect(closeRes.status).toBe('closed');
    });

    it('2.5. Staff CANNOT view account list via accountApi.getAll(params, actor)', () => {
      expect(() => {
        accountApi.getAll({}, staffActor);
      }).toThrow(/PERMISSION_DENIED/);
    });

    it('2.6. Staff CANNOT view another user\'s account details via accountApi.getById', async () => {
      // Seed staff account first so self-view succeeds
      await accountApi.create({
        id: staffActor.id,
        email: 'staff@shop.vn',
        role: ROLES.STAFF,
        isActive: true,
      }, adminActor);

      // Trying to view admin account is denied
      expect(() => {
        accountApi.getById(adminActor.id, staffActor);
      }).toThrow(/PERMISSION_DENIED/);

      // But Staff CAN view their own account details
      const ownRes = await accountApi.getById(staffActor.id, staffActor);
      expect(ownRes.data.id).toBe(staffActor.id);
    });

    it('2.7. Staff CANNOT modify roles or grant permissions on accounts', () => {
      expect(() => {
        accountApi.patch(staffActor.id, { role: ROLES.ADMIN }, staffActor);
      }).toThrow(/PERMISSION_DENIED/);

      expect(() => {
        accountApi.update(staffActor.id, { role: ROLES.ADMIN }, staffActor);
      }).toThrow(/PERMISSION_DENIED/);
    });

    it('2.8. Staff CANNOT delete products or categories (soft delete / deactivate only)', () => {
      // Staff does not have PRODUCT_DELETE or CATEGORY_DELETE permissions
      expect(hasPermission(staffActor, PERMISSIONS.PRODUCT_DELETE)).toBe(false);
      expect(hasPermission(staffActor, PERMISSIONS.CATEGORY_DELETE)).toBe(false);

      expect(() => {
        assertPermission(staffActor, PERMISSIONS.PRODUCT_DELETE);
      }).toThrow(/PERMISSION_DENIED/);

      expect(() => {
        assertPermission(staffActor, PERMISSIONS.CATEGORY_DELETE);
      }).toThrow(/PERMISSION_DENIED/);
    });
  });

  // =========================================================================
  // 3. EMPLOYEE BOUNDARY ENFORCEMENT
  // =========================================================================
  describe('3. Employee Boundary Enforcement', () => {
    it('3.1. Employee can view products, categories, and inventory', () => {
      expect(hasPermission(employee1Actor, PERMISSIONS.PRODUCT_VIEW)).toBe(true);
      expect(hasPermission(employee1Actor, PERMISSIONS.CATEGORY_VIEW)).toBe(true);
      expect(hasPermission(employee1Actor, PERMISSIONS.INVENTORY_VIEW)).toBe(true);
    });

    it('3.2. Employee can create own order and cashier identity is bound to actor', async () => {
      const order = {
        id: 'ord-emp1-legit',
        code: 'HD-E1-01',
        totalAmount: 50000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
      };

      const res = await orderApi.create(order, employee1Actor);
      expect(res.data.status).toBe('completed');
      expect(res.data.accountId).toBe(employee1Actor.id);
      expect(res.data.sellerId).toBe(employee1Actor.id);
      expect(res.data.employeeId).toBe(employee1Actor.employeeId);
    });

    it('3.3. Employee CANNOT create order impersonating another cashier', () => {
      // Trying to specify another accountId
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          accountId: employee2Actor.id,
          totalAmount: 50000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
        }, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);

      // Trying to specify another sellerId
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          sellerId: employee2Actor.id,
          totalAmount: 50000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
        }, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);

      // Trying to specify another employeeId
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test',
          employeeId: employee2Actor.employeeId,
          totalAmount: 50000, items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
        }, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);
    });

    it('3.4. Employee can cancel own order within the 15-minute window in current session', async () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const order = {
        id: 'ord-emp1-fresh',
        code: 'HD-E1-FRESH',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
        status: 'completed',
        createdAt: fiveMinsAgo,
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
      };
      await orderApi.create(order, employee1Actor);

      const cancelRes = await orderApi.cancel(order.id, {
        actor: employee1Actor,
        reason: 'Khách đổi ý hủy đơn trong ca',
        order,
        currentSessionId: 'ws-active-1',
      });

      expect(cancelRes.data.status).toBe('cancelled');
      expect(cancelRes.data.cancelledBy).toBe(employee1Actor.id);
    });

    it('3.5. Employee CANNOT cancel own order after 15 minutes', async () => {
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const order = {
        id: 'ord-emp1-expired',
        code: 'HD-E1-EXP',
        accountId: employee1Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
        status: 'completed',
        createdAt: twentyMinsAgo,
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 50000 }],
      };
      await orderApi.create(order, employee1Actor);

      expect(() => {
        orderApi.cancel(order.id, {
          actor: employee1Actor,
          reason: 'Khách đòi hủy đơn muộn',
          order,
          currentSessionId: 'ws-active-1',
        });
      }).toThrow(/15 phút/);
    });

    it('3.6. Employee CANNOT cancel another cashier\'s order even within 15 minutes', async () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const order = {
        id: 'ord-emp2-recent',
        code: 'HD-E2-REC',
        accountId: employee2Actor.id,
        sellerId: employee2Actor.id,
        workSessionId: 'ws-active-1',
        totalAmount: 70000, items: [{ productId: 'p4', quantity: 70000, price: 1 }],
        status: 'completed',
        createdAt: fiveMinsAgo,
        items: [{ productId: 'p0000000-0000-0000-0000-000000000001', quantity: 1, price: 70000 }],
      };
      await orderApi.create(order, employee2Actor);

      expect(() => {
        orderApi.cancel(order.id, {
          actor: employee1Actor,
          reason: 'Hủy hộ đồng nghiệp',
          order,
          currentSessionId: 'ws-active-1',
        });
      }).toThrow(/CANCEL_DENIED|PERMISSION_DENIED/);
    });

    it('3.7. Employee CANNOT perform inventory adjustments or void transactions', async () => {
      expect(() => {
        inventoryApi.createTransaction({
          type: 'ADJUST',
          productId: 'p0000000-0000-0000-0000-000000000001',
          quantity: 1,
        }, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);

      expect(() => {
        inventoryApi.createTransaction({
          type: 'IN',
          productId: 'p0000000-0000-0000-0000-000000000001',
          quantity: 5,
        }, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);

      expect(() => {
        inventoryApi.voidTransaction('inv-tx-01', employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);
    });

    it('3.8. Employee CANNOT create, close, or cancel work sessions', async () => {
      expect(() => {
        workSessionApi.create({
          date: '2026-11-25',
          shiftType: 'daily',
        }, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);

      await expect(
        workSessionApi.closeSession('ws-active-1', {
          actualCash: 500000,
          actor: employee1Actor,
        })
      ).rejects.toThrow(/PERMISSION_DENIED/);

      await expect(
        workSessionApi.cancelSession('ws-active-1', {
          reason: 'Nhân viên hủy ca',
          actor: employee1Actor,
        })
      ).rejects.toThrow(/PERMISSION_DENIED/);
    });

    it('3.9. Employee CANNOT add or modify other employees\' session member records', async () => {
      // Cannot add another employee to session
      await expect(
        workSessionApi.createMember({
          workSessionId: 'ws-active-1',
          accountId: employee2Actor.id,
          registerId: 'POS02',
        }, employee1Actor)
      ).rejects.toThrow(/PERMISSION_DENIED/);

      // Create an existing member record for employee2 by staff/admin
      const emp2Member = await workSessionApi.createMember({
        id: 'wsm_emp2_session',
        workSessionId: 'ws-active-1',
        accountId: employee2Actor.id,
        registerId: 'POS02',
        attendanceStatus: 'present',
      }, staffActor);

      // Cannot check out another employee
      await expect(
        workSessionApi.checkOut(emp2Member.data.id, employee1Actor)
      ).rejects.toThrow(/PERMISSION_DENIED/);

      // Cannot update working status of another employee
      await expect(
        workSessionApi.updateWorkingStatus(emp2Member.data.id, 'offline', employee1Actor)
      ).rejects.toThrow(/PERMISSION_DENIED/);
    });

    it('3.10. Employee CANNOT browse general activity logs (restricted to own logs)', async () => {
      // General activity log query without filter or for other users is rejected
      expect(() => {
        activityLogApi.getAll({}, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);

      expect(() => {
        activityLogApi.getAll({ actorId: employee2Actor.id }, employee1Actor);
      }).toThrow(/PERMISSION_DENIED/);

      // Querying own activity log with explicit actorId succeeds
      const ownLogsRes = await activityLogApi.getAll({ actorId: employee1Actor.id }, employee1Actor);
      expect(Array.isArray(ownLogsRes.data)).toBe(true);
    });
  });

  // =========================================================================
  // 4. FAIL-CLOSED BEHAVIOR & INTEGRITY
  // =========================================================================
  describe('4. Fail-closed Behavior & Integrity', () => {
    it('4.1. Missing actor on protected mutation throws NOT_AUTHENTICATED', async () => {
      expect(() => {
        orderApi.create({
          workSessionId: 'ws-mock-test', totalAmount: 10000 }, null);
      }).toThrow(/NOT_AUTHENTICATED/);

      await expect(
        workSessionApi.closeSession('ws-active-1', { actualCash: 1000, actor: null })
      ).rejects.toThrow(/NOT_AUTHENTICATED/);

      await expect(
        workSessionApi.cancelSession('ws-active-1', { actor: null })
      ).rejects.toThrow(/NOT_AUTHENTICATED/);

      expect(() => {
        assertPermission(null, PERMISSIONS.PRODUCT_VIEW);
      }).toThrow(/NOT_AUTHENTICATED/);
    });

    it('4.2. Unknown role has 0 permissions (fail closed)', () => {
      const invalidRoles = ['super_admin', 'manager', 'guest', '', null, undefined];
      invalidRoles.forEach((role) => {
        const fakeActor = { id: 'acc-fake', role, permissions: [] };
        Object.values(PERMISSIONS).forEach((perm) => {
          expect(hasPermission(fakeActor, perm)).toBe(false);
        });
      });
    });

    it('4.3. Unknown permission key returns false for all actors (even admin)', () => {
      const unknownKey = 'system.nuclear_override';
      expect(hasPermission(adminActor, unknownKey)).toBe(false);
      expect(hasPermission(staffActor, unknownKey)).toBe(false);
      expect(hasPermission(employee1Actor, unknownKey)).toBe(false);

      expect(() => {
        assertPermission(adminActor, unknownKey);
      }).toThrow(/PERMISSION_DENIED/);
    });

    it('4.4. Account with explicit deniedPermissions cannot exercise those permissions', () => {
      const restrictedAdmin = {
        ...adminActor,
        deniedPermissions: [PERMISSIONS.ORDER_CANCEL, PERMISSIONS.INVENTORY_ADJUST],
      };

      expect(hasPermission(restrictedAdmin, PERMISSIONS.ORDER_CANCEL)).toBe(false);
      expect(hasPermission(restrictedAdmin, PERMISSIONS.INVENTORY_ADJUST)).toBe(false);
      // Other permissions still allowed
      expect(hasPermission(restrictedAdmin, PERMISSIONS.PRODUCT_VIEW)).toBe(true);
      expect(hasPermission(restrictedAdmin, PERMISSIONS.ACCOUNT_VIEW)).toBe(true);

      const restrictedStaff = {
        ...staffActor,
        deniedPermissions: [PERMISSIONS.PRODUCT_CREATE],
      };

      expect(hasPermission(restrictedStaff, PERMISSIONS.PRODUCT_CREATE)).toBe(false);
      expect(hasPermission(restrictedStaff, PERMISSIONS.PRODUCT_UPDATE)).toBe(true);
    });

    it('4.5. Non-admin attempting to escalate role ceiling is strictly blocked', () => {
      const privilegedEmployee = {
        ...employee1Actor,
        permissions: [PERMISSIONS.ACCOUNT_VIEW, PERMISSIONS.ORDER_CANCEL_MANAGEMENT],
      };

      // Role ceiling takes precedence: employee cannot have account.view or order.cancel_management
      expect(hasPermission(privilegedEmployee, PERMISSIONS.ACCOUNT_VIEW)).toBe(false);
      expect(hasPermission(privilegedEmployee, PERMISSIONS.ORDER_CANCEL_MANAGEMENT)).toBe(false);
    });
  });
});
