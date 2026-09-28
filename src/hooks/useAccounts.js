import { useState, useEffect, useCallback } from 'react';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { validateEmail, validatePassword, validatePin } from '../utils/validate';
import { toast } from 'react-toastify';
import { useAuth } from './useAuth';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';

export const useAccounts = (currentUserId = null) => {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Lấy danh sách Account và Staff cùng lúc để enrich dữ liệu hiển thị
      const [accRes, staffRes] = await Promise.all([
        accountApi.getAll(),
        staffApi.getAll()
      ]);

      const rawAccounts = Array.isArray(accRes.data) ? accRes.data : [];
      const rawStaff = Array.isArray(staffRes.data) ? staffRes.data : [];

      const enriched = rawAccounts.map((acc) => {
        if ((acc.role === 'staff' || acc.role === 'employee') && acc.employeeId) {
          const matchedStaff = rawStaff.find(s => String(s.id) === String(acc.employeeId));
          return {
            ...acc,
            staffInfo: matchedStaff || null,
            displayName: matchedStaff ? matchedStaff.name : (acc.role === 'staff' ? 'Staff (Chưa gắn hồ sơ)' : 'Nhân viên (Chưa gắn hồ sơ)'),
            displayCode: matchedStaff ? matchedStaff.employeeCode : '-'
          };
        } else {
          return {
            ...acc,
            staffInfo: null,
            displayName: acc.name || acc.email || 'Quản trị viên',
            displayCode: 'ADMIN'
          };
        }
      });

      setAccounts(enriched);
    } catch (err) {
      console.error('Lỗi khi tải danh sách tài khoản:', err);
      setError('Không thể tải danh sách tài khoản');
      toast.error('Lỗi khi tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect 
    fetchAccounts();
  }, [fetchAccounts]);

  // Tạo thêm tài khoản Quản trị viên (Admin) mới
  const createAdminAccount = async ({ email, name, password }) => {
    try {
      const emailErr = validateEmail(email);
      if (emailErr) {
        toast.error(emailErr);
        return false;
      }

      const passErr = validatePassword(password);
      if (passErr) {
        toast.error(passErr);
        return false;
      }

      // Kiểm tra trùng email
      const existingRes = await accountApi.getByEmail(email.trim().toLowerCase());
      if (Array.isArray(existingRes.data) && existingRes.data.length > 0) {
        toast.error(`Email "${email}" đã được sử dụng cho một tài khoản khác`);
        return false;
      }

      const now = new Date().toISOString();
      // NOTE: Password lưu plain text trong môi trường demo/localStorage. Cần hash khi có backend thật.
      const newAdmin = {
        id: `acc-admin-${Date.now()}`,
        employeeId: null, // Admin không có bản ghi Staff
        role: 'admin',
        name: name?.trim() || 'Quản trị viên', // Lưu name trực tiếp cho Admin
        email: email.trim().toLowerCase(),
        password: String(password),
        pin: null,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      await accountApi.create(newAdmin, currentUser || undefined);
      toast.success(`Tạo Quản trị viên ${newAdmin.email} thành công!`);
      await fetchAccounts();
      return true;
    } catch (err) {
      console.error('Lỗi khi tạo Admin mới:', err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Không thể tạo tài khoản Quản trị viên. Vui lòng thử lại.');
      }
      return false;
    }
  };

  // Đổi mật khẩu cho Quản trị viên
  const changeAdminPassword = async (accountId, newPassword) => {
    try {
      const passErr = validatePassword(newPassword);
      if (passErr) {
        toast.error(passErr);
        return false;
      }

      await accountApi.updatePassword(accountId, newPassword, currentUser || undefined);
      logActivity({
        actor: currentUser,
        action: ACTIVITY_ACTIONS.PASSWORD_CHANGED,
        entityType: 'account',
        entityId: accountId,
      });
      toast.success('Đổi mật khẩu Quản trị viên thành công!');
      await fetchAccounts();
      return true;
    } catch (err) {
      console.error('Lỗi khi đổi mật khẩu Admin:', err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Không thể đổi mật khẩu Admin');
      }
      return false;
    }
  };

  // Cấp lại / Reset mã PIN 6 số cho Nhân viên
  const resetStaffPin = async (accountId, newPin) => {
    try {
      const pinErr = validatePin(newPin);
      if (pinErr) {
        toast.error(pinErr);
        return false;
      }

      await accountApi.updatePin(accountId, newPin, currentUser || undefined);
      logActivity({
        actor: currentUser,
        action: ACTIVITY_ACTIONS.PIN_CHANGED,
        entityType: 'account',
        entityId: accountId,
      });
      toast.success('Cấp lại mã PIN 6 số cho nhân viên thành công!');
      await fetchAccounts();
      return true;
    } catch (err) {
      console.error('Lỗi khi cấp lại mã PIN:', err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Không thể cập nhật mã PIN');
      }
      return false;
    }
  };

  // Khóa / Kích hoạt tài khoản (Đồng bộ Staff.isActive nếu là tài khoản Staff)
  const toggleAccountActive = async (account) => {
    try {
      // 1. Kiểm tra an toàn: Không cho phép tự khóa tài khoản Admin đang đăng nhập
      if (currentUserId && String(account.id) === String(currentUserId)) {
        toast.warning('Bạn không thể tự vô hiệu hóa tài khoản Quản trị viên đang đăng nhập của chính mình.');
        return false;
      }

      // 2. Kiểm tra an toàn: Không cho phép khóa Admin duy nhất đang hoạt động
      if (account.role === 'admin' && account.isActive) {
        const activeAdmins = accounts.filter(a => a.role === 'admin' && a.isActive);
        if (activeAdmins.length <= 1) {
          toast.warning('Hệ thống phải duy trì ít nhất một Quản trị viên đang hoạt động.');
          return false;
        }
      }

      const nextIsActive = !account.isActive;
      const now = new Date().toISOString();

      // Cập nhật Account
      await accountApi.updateStatus(account.id, nextIsActive, currentUser || undefined);

      // Nếu là Staff / Employee -> Đồng bộ sang cả bản ghi Staff tương ứng
      if ((account.role === 'staff' || account.role === 'employee') && account.employeeId) {
        await staffApi.patch(account.employeeId, {
          isActive: nextIsActive,
          updatedAt: now
        }, currentUser || undefined);
        logActivity({
          actor: currentUser,
          action: nextIsActive ? ACTIVITY_ACTIONS.EMPLOYEE_UPDATED : ACTIVITY_ACTIONS.EMPLOYEE_DEACTIVATED,
          entityType: 'staff',
          entityId: account.employeeId,
        });
      }

      toast.success(`Đã ${nextIsActive ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản thành công!`);
      await fetchAccounts();
      return true;
    } catch (err) {
      console.error('Lỗi khi đổi trạng thái tài khoản:', err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast.error('Bạn không có quyền thực hiện thao tác này');
      } else {
        toast.error('Không thể thay đổi trạng thái tài khoản');
      }
      return false;
    }
  };

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
    createAdminAccount,
    changeAdminPassword,
    resetStaffPin,
    toggleAccountActive
  };
};

export default useAccounts;
