import { useState, useEffect, useCallback } from 'react';
import { staffApi } from '../api/staffApi';
import { accountApi } from '../api/accountApi';
import { validatePin } from '../utils/validate';
import { toast } from 'react-toastify';
import { useAuth } from './useAuth';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';

export const useStaff = () => {
  const { currentUser } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await staffApi.getAll();
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách nhân viên:', err);
      setError('Không thể tải danh sách nhân viên');
      toast.error('Lỗi khi tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dữ liệu khi mount, đúng pattern "Synchronizing with an external system" (react.dev)
    fetchStaff();
  }, [fetchStaff]);

  // Tạo nhân viên mới kèm tài khoản đăng nhập (1 form gộp UI, 2 lệnh ghi tuần tự ở data model)
  const createStaffWithAccount = async (formData) => {
    try {
      if (!formData.name || !formData.name.trim()) {
        toast.error('Vui lòng nhập tên nhân viên');
        return false;
      }

      const pinErr = validatePin(formData.pin);
      if (pinErr) {
        toast.error(pinErr);
        return false;
      }

      // 1. Chuẩn bị mã nhân viên
      let employeeCode = formData.employeeCode?.trim();
      if (!employeeCode) {
        employeeCode = await staffApi.generateEmployeeCode();
      } else {
        // Kiểm tra trùng mã
        const existingRes = await staffApi.getByCode(employeeCode);
        if (Array.isArray(existingRes.data) && existingRes.data.length > 0) {
          toast.error(`Mã nhân viên "${employeeCode}" đã tồn tại trên hệ thống`);
          return false;
        }
      }

      const staffId = `staff-${Date.now()}`;
      const now = new Date().toISOString();

      // 2. Tạo bản ghi Staff trước (con người)
      const staffRecord = {
        id: staffId,
        employeeCode,
        name: formData.name.trim(),
        phone: formData.phone?.trim() || '',
        hireDate: formData.hireDate || now.slice(0, 10),
        isActive: formData.isActive !== undefined ? Boolean(formData.isActive) : true,
        employmentStatus: formData.employmentStatus || 'working',
        createdAt: now,
        updatedAt: now
      };
      const createdStaffRes = await staffApi.create(staffRecord, currentUser || undefined);
      const actualStaffId = createdStaffRes?.data?.id || staffId;

      // 3. Tạo bản ghi Account sau (dùng ID thực tế vừa được tạo/gán của Staff)
      // NOTE: PIN đang lưu plain text do môi trường demo/localStorage. Cần hash khi có backend thật.
      const accountRecord = {
        id: `acc-staff-${Date.now()}`,
        employeeId: actualStaffId,
        role: formData.role || 'employee',
        email: null,
        password: null,
        pin: String(formData.pin).trim(),
        permissions: Array.isArray(formData.permissions) ? formData.permissions : [],
        isActive: formData.isActive !== undefined ? Boolean(formData.isActive) : true,
        createdAt: now,
        updatedAt: now
      };
      await accountApi.create(accountRecord, currentUser || undefined);

      logActivity({
        actor: currentUser,
        action: ACTIVITY_ACTIONS.EMPLOYEE_CREATED,
        entityType: 'staff',
        entityId: actualStaffId,
      });

      toast.success(`Thêm nhân viên ${staffRecord.name} (${staffRecord.employeeCode}) thành công!`);
      await fetchStaff();
      return true;
    } catch (err) {
      console.error('Lỗi khi tạo nhân viên và tài khoản:', err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Thêm nhân viên thất bại. Vui lòng thử lại.');
      }
      return false;
    }
  };

  // Cập nhật thông tin nhân viên và tài khoản
  const updateStaffWithAccount = async (staffId, formData) => {
    try {
      if (!formData.name || !formData.name.trim()) {
        toast.error('Tên nhân viên không được để trống');
        return false;
      }

      if (formData.pin && String(formData.pin).trim()) {
        const pinErr = validatePin(formData.pin);
        if (pinErr) {
          toast.error(pinErr);
          return false;
        }
      }

      const now = new Date().toISOString();

      // 1. Cập nhật Staff
      const staffPatch = {
        name: formData.name.trim(),
        phone: formData.phone?.trim() || '',
        hireDate: formData.hireDate,
        isActive: Boolean(formData.isActive),
        employmentStatus: formData.employmentStatus,
        updatedAt: now
      };
      if (formData.employeeCode) {
        staffPatch.employeeCode = formData.employeeCode.trim();
      }
      await staffApi.patch(staffId, staffPatch, currentUser || undefined);

      // 2. Cập nhật Account liên kết
      const accRes = await accountApi.getByEmployeeId(staffId);
      const accList = Array.isArray(accRes.data) ? accRes.data : [];
      if (accList.length > 0) {
        const acc = accList[0];
        const accPatch = {
          permissions: Array.isArray(formData.permissions) ? formData.permissions : (acc.permissions || []),
          isActive: Boolean(formData.isActive),
          updatedAt: now
        };
        if (formData.role) {
          accPatch.role = formData.role;
        }
        if (formData.pin && String(formData.pin).trim()) {
          // NOTE: PIN đang lưu plain text do môi trường demo. Cần hash khi có backend thật.
          accPatch.pin = String(formData.pin).trim();
        }
        await accountApi.patch(acc.id, accPatch, currentUser || undefined);

        const wasActive = acc.isActive;
        const willBeActive = Boolean(formData.isActive);
        if (wasActive && !willBeActive) {
          logActivity({ actor: currentUser, action: ACTIVITY_ACTIONS.EMPLOYEE_DEACTIVATED, entityType: 'staff', entityId: staffId });
        } else {
          logActivity({ actor: currentUser, action: ACTIVITY_ACTIONS.EMPLOYEE_UPDATED, entityType: 'staff', entityId: staffId });
        }

        const oldPermissions = Array.isArray(acc.permissions) ? acc.permissions : [];
        const newPermissions = accPatch.permissions;
        const permissionsChanged =
          oldPermissions.length !== newPermissions.length ||
          !oldPermissions.every(p => newPermissions.includes(p));
        if (permissionsChanged) {
          logActivity({
            actor: currentUser,
            action: ACTIVITY_ACTIONS.PERMISSION_CHANGED,
            entityType: 'account',
            entityId: acc.id,
            metadata: { before: oldPermissions, after: newPermissions },
          });
        }

        if (accPatch.pin) {
          logActivity({
            actor: currentUser,
            action: ACTIVITY_ACTIONS.PIN_CHANGED,
            entityType: 'account',
            entityId: acc.id,
          });
        }
      }

      toast.success('Cập nhật thông tin nhân viên thành công!');
      await fetchStaff();
      return true;
    } catch (err) {
      console.error('Lỗi khi cập nhật nhân viên:', err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Cập nhật nhân viên thất bại');
      }
      return false;
    }
  };

  // Toggle trạng thái hoạt động (isActive) của nhân viên và tài khoản
  const toggleStaffActive = async (staffId, currentIsActive) => {
    try {
      const nextIsActive = !currentIsActive;
      const now = new Date().toISOString();

      if (!nextIsActive) {
        await staffApi.softDelete(staffId, currentUser || undefined);
      } else {
        await staffApi.updateStatus(staffId, { isActive: true, employmentStatus: 'working' }, currentUser || undefined);
      }

      const accRes = await accountApi.getByEmployeeId(staffId);
      const accList = Array.isArray(accRes.data) ? accRes.data : [];
      if (accList.length > 0) {
        await accountApi.patch(accList[0].id, {
          isActive: nextIsActive,
          updatedAt: now
        }, currentUser || undefined);
      }

      logActivity({
        actor: currentUser,
        action: currentIsActive ? ACTIVITY_ACTIONS.EMPLOYEE_DEACTIVATED : ACTIVITY_ACTIONS.EMPLOYEE_UPDATED,
        entityType: 'staff',
        entityId: staffId,
      });

      toast.success(`Đã ${nextIsActive ? 'kích hoạt' : 'vô hiệu hóa'} nhân viên thành công!`);
      await fetchStaff();
      return true;
    } catch (err) {
      console.error('Lỗi khi đổi trạng thái nhân viên:', err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Không thể thay đổi trạng thái nhân viên');
      }
      return false;
    }
  };

  return {
    staffList,
    loading,
    error,
    refetch: fetchStaff,
    createStaffWithAccount,
    updateStaffWithAccount,
    toggleStaffActive
  };
};

export default useStaff;
