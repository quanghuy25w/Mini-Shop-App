import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import bcrypt from 'bcryptjs';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { workSessionApi } from '../api/workSessionApi';
import { validateEmail, validatePassword, validatePin } from '../utils/validate';
import { hasPermission } from '../utils/permissions';
import { logActivity, ACTIVITY_ACTIONS } from '../utils/activityLogger';
import { getBusinessDate } from '../utils/businessDate';
import { getCurrentRegisterId, REGISTERS } from '../utils/registerConfig';

// eslint-disable-next-line react-refresh/only-export-components -- Context + Provider 
export const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = 'minishop_auth_session';

const verifyAndUpgradeCredential = async (plainText, storedHash, accountId, fieldName) => {
  if (!storedHash) return false;
  // Determine if it's an existing bcrypt hash
  const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$');
  
  if (isBcrypt) {
    return await bcrypt.compare(plainText, storedHash);
  }
  
  // Backward compatibility: compare plaintext and silently upgrade if it matches
  if (plainText === storedHash) {
    try {
      const newHash = await bcrypt.hash(plainText, 10);
      await accountApi.patch(accountId, { [fieldName]: newHash });
    } catch (e) {
      console.warn(`Silently failed to upgrade ${fieldName} hash:`, e);
    }
    return true;
  }
  return false;
};

// Hàm tự động thực hiện Check-in ngay khi đăng nhập thành công
const performAutoCheckIn = async (userSession) => {
  try {
    const accountId = userSession.id;
    const isManager = userSession.role === 'admin' || userSession.role === 'staff';
    const now       = new Date();
    const dateStr   = getBusinessDate(now);

    // Admin & Staff: KHÔNG BAO GIỜ tạo WorkSessionMember (không điểm danh, không chấm công cá nhân)
    // Nhưng vẫn đảm bảo WorkSession của ngày làm việc được tạo/kích hoạt
    if (isManager) {
      const session = await workSessionApi.getTodaySessionForDate(dateStr, now);
      if (!session || session.status === 'cancelled') {
        return { success: false, mode: session?.status === 'cancelled' ? 'session_cancelled' : 'error' };
      }
      return {
        success: true,
        mode: 'manager_no_attendance',
        workSessionId: session.id
      };
    }

    // Role 'employee':
    const isAdmin = false;

    // 1. Xác định + lấy/tạo WorkSession phù hợp theo khung giờ
    const { workSession, isLate, lateMinutes, currentShift, reason } =
      await workSessionApi.getOrCreateWorkSession(now, isAdmin);

    if (!workSession) {
      // Ngoài giờ hoạt động / ca bị huỷ / giờ nghỉ → đăng nhập vẫn thành công, không tạo member mới
      return { success: false, mode: reason || 'out_of_business_hours' };
    }

    const currentFrame = currentShift?.shiftType || 'morning';

    const checkInNow = now.toISOString();

    // Lấy ID quầy hiện tại của máy POS này (không cho Employee tự chọn)
    let registerId = null;
    try {
      registerId = getCurrentRegisterId();
    } catch {
      // Nếu không đọc được config thì để null; lỗi sẽ bị chặn tại checkout
    }

    // 2. Kiểm tra các Invariants (POS & Employee active)
    try {
      const allMembersRes = await workSessionApi.getMembers({ workSessionId: workSession.id });
      const membersInSession = Array.isArray(allMembersRes.data) ? allMembersRes.data : [];
      const activeMembers = membersInSession.filter(m => m.attendanceStatus === 'present');

      // B. INVARIANT 1 - MỘT POS CHỈ CÓ 1 EMPLOYEE ACTIVE
      if (registerId) {
        const otherActiveAtThisPos = activeMembers.find(m => m.registerId === registerId && m.accountId !== accountId);
        if (otherActiveAtThisPos) {
          // Có người khác đang active tại quầy này
          // Dùng staffApi để lấy tên nv (optional), hoặc đơn giản dùng câu báo lỗi chung
          const regName = REGISTERS.find(r => r.id === registerId)?.name || registerId;
          return {
             success: false,
             mode: 'pos_in_use',
             error: `${regName} đang được sử dụng. Vui lòng checkout nhân viên hiện tại trước khi đăng nhập người khác.`
          };
        }
      }

      // C. INVARIANT 2 - MỘT EMPLOYEE CHỈ ACTIVE Ở 1 POS
      const myActiveMembers = activeMembers.filter(m => m.accountId === accountId);
      const activeAtOtherPos = myActiveMembers.find(m => m.registerId && m.registerId !== registerId);
      if (activeAtOtherPos) {
          const otherRegName = REGISTERS.find(r => r.id === activeAtOtherPos.registerId)?.name || activeAtOtherPos.registerId;
          return {
             success: false,
             mode: 'employee_active_elsewhere',
             error: `Nhân viên đang hoạt động tại ${otherRegName}. Vui lòng checkout trước khi chuyển quầy.`
          };
      }

      // D. CHUYỂN KHUNG LÀM VIỆC - 1 EMPLOYEE CÓ THỂ CÓ NHIỀU MEMBER
      const myActiveAtThisPos = myActiveMembers.find(m => m.registerId === registerId || !m.registerId);
      if (myActiveAtThisPos) {
        if (myActiveAtThisPos.shiftType === currentFrame || !myActiveAtThisPos.shiftType) {
          // Đã có membership present trong khung ca này → không tạo thêm
          return { success: true, mode: 'already_present', workSessionId: workSession.id, member: myActiveAtThisPos };
        } else {
          // Khác khung giờ -> checkout member cũ để code bên dưới tạo member mới
          await workSessionApi.checkOut(myActiveAtThisPos.id);
        }
      }
    } catch (e) {
      console.error('Lỗi khi kiểm tra Invariants:', e);
      return {
        success: false,
        error: e?.message || 'Lỗi khi kiểm tra trạng thái quầy và ca làm việc.'
      };
    }
    const createRes = await workSessionApi.createMember({
      workSessionId:    workSession.id,
      accountId:        accountId,
      registerId:       registerId,
      shiftType:        currentFrame,
      businessDate:     dateStr,
      attendanceStatus: 'present',
      checkInTime:      checkInNow,
      checkOutTime:     null,
      workingStatus:    'active',
      isLate:           isLate,
      lateMinutes:      lateMinutes,
      note:             ''
    });

    return {
      success: true,
      mode: 'checked_in',
      isLate,
      lateMinutes,
      workSessionId: workSession.id,
      member: createRes?.data
    };
  } catch (err) {
    console.error('Lỗi khi tự động check-in tại login:', err);
    return { success: false, error: err };
  }
};

// Hàm tự động thực hiện Check-out khi đăng xuất
const performAutoCheckOut = async (accountId) => {
  if (!accountId) return { checkedOut: false };
  try {
    const membersRes = await workSessionApi.getMembers({ accountId, attendanceStatus: 'present' });
    const activeMembers = Array.isArray(membersRes.data) ? membersRes.data : [];
    let checkedOut = false;
    let workSessionId = null;
    for (const member of activeMembers) {
      await workSessionApi.checkOut(member.id);
      checkedOut = true;
      workSessionId = member.workSessionId;
    }
    return { checkedOut, workSessionId };
  } catch (err) {
    console.error('Lỗi khi tự động check-out tại logout:', err);
    return { checkedOut: false };
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAdmin, setHasAdmin] = useState(null); // null = loading, true/false = checked
  const [loading, setLoading] = useState(true);

  // Khôi phục phiên làm việc và kiểm tra Admin trong hệ thống
  const checkAuthState = useCallback(async () => {
    try {
      // 1. Kiểm tra hệ thống đã có tài khoản Admin nào chưa
      const adminAccountsRes = await accountApi.getAll({ role: 'admin' });
      const adminList = Array.isArray(adminAccountsRes.data) ? adminAccountsRes.data : [];
      const adminExists = adminList.some(a => a.role === 'admin');
      setHasAdmin(adminExists);

      // Nếu hệ thống hoàn toàn chưa có Admin, lập tức dọn sạch stale session
      if (!adminExists) {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
        setCurrentUser(null);
        return;
      }

      // 2. Khôi phục session từ localStorage nếu có
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (rawSession) {
          try {
            const savedSession = JSON.parse(rawSession);
            if (savedSession && savedSession.id && savedSession.role) {
              if (savedSession.role === 'admin') {
                // Xác thực lại tài khoản Admin còn tồn tại và đang hoạt động
                try {
                  const accRes = await accountApi.getById(savedSession.id);
                  const acc = accRes.data;
                  if (acc && acc.role === 'admin' && acc.isActive) {
                    setCurrentUser({
                      id: acc.id,
                      employeeId: null,
                      role: 'admin',
                      email: acc.email,
                      name: savedSession.name || 'Quản trị viên',
                      permissions: acc.permissions || [],
                      isActive: acc.isActive,
                      createdAt: acc.createdAt
                    });
                  } else {
                    localStorage.removeItem(AUTH_STORAGE_KEY);
                    setCurrentUser(null);
                  }
                } catch {
                  localStorage.removeItem(AUTH_STORAGE_KEY);
                  setCurrentUser(null);
                }
              } else if ((savedSession.role === 'staff' || savedSession.role === 'employee') && savedSession.employeeId) {
                // Xác thực lại tài khoản Nhân viên và Staff
                try {
                  const [accRes, staffRes] = await Promise.all([
                    accountApi.getById(savedSession.id),
                    staffApi.getById(savedSession.employeeId)
                  ]);
                  const acc = accRes.data;
                  const staff = staffRes.data;

                  if (acc && staff && acc.isActive && staff.isActive) {
                    setCurrentUser({
                      id: acc.id,
                      employeeId: staff.id,
                      role: acc.role || savedSession.role || 'employee',
                      name: staff.name,
                      employeeCode: staff.employeeCode,
                      permissions: acc.permissions || [],
                      isActive: acc.isActive,
                      staffInfo: {
                        id: staff.id,
                        employeeCode: staff.employeeCode,
                        name: staff.name,
                        phone: staff.phone,
                        hireDate: staff.hireDate,
                        isActive: staff.isActive,
                        employmentStatus: staff.employmentStatus
                      }
                    });
                  } else {
                    localStorage.removeItem(AUTH_STORAGE_KEY);
                    setCurrentUser(null);
                  }
                } catch {
                  localStorage.removeItem(AUTH_STORAGE_KEY);
                  setCurrentUser(null);
                }
              }
            }
          } catch (parseError) {
            console.error('Lỗi khi khôi phục session:', parseError);
            localStorage.removeItem(AUTH_STORAGE_KEY);
            setCurrentUser(null);
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi kiểm tra auth state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const init = async () => {
      if (!isCancelled) {
        await checkAuthState();
      }
    };
    init();
    return () => {
      isCancelled = true;
    };
  }, [checkAuthState]);

  // Thiết lập Quản trị viên đầu tiên khi hệ thống chưa có Admin
  const setupFirstAdmin = async ({ email, password, name }) => {
    try {
      const emailErr = validateEmail(email);
      if (emailErr) return { success: false, error: emailErr };

      const passErr = validatePassword(password);
      if (passErr) return { success: false, error: passErr };

      const existingAdminsRes = await accountApi.getAll({ role: 'admin' });
      const existingAdmins = Array.isArray(existingAdminsRes.data) ? existingAdminsRes.data : [];
      if (existingAdmins.length > 0) {
        return { success: false, error: 'Hệ thống đã có Quản trị viên. Không thể tạo thêm ở màn hình này.' };
      }

      const newAdmin = {
        employeeId: null,
        role: 'admin',
        email: email.trim().toLowerCase(),
        password: await bcrypt.hash(String(password), 10),
        pin: null,
        permissions: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await accountApi.create(newAdmin);
      const createdAccount = res.data;

      const userSession = {
        id: createdAccount.id,
        employeeId: null,
        role: 'admin',
        email: createdAccount.email,
        name: (name && typeof name === 'string' ? name.trim() : '') || 'Quản trị viên',
        permissions: [],
        isActive: true,
        createdAt: createdAccount.createdAt
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
      }

      // Tự động Check-in ca làm việc cho Admin
      const checkInResult = await performAutoCheckIn(userSession);
      if (checkInResult?.mode === 'checked_in') {
        logActivity({
          actor: userSession,
          action: ACTIVITY_ACTIONS.CHECK_IN,
          entityType: 'workSession',
          workSessionId: checkInResult.workSessionId,
        });
      }

      setCurrentUser(userSession);
      setHasAdmin(true);

      return { success: true, user: userSession };
    } catch (error) {
      console.error('Lỗi khi thiết lập Quản trị viên đầu tiên:', error);
      return { success: false, error: 'Không thể khởi tạo tài khoản Quản trị viên. Vui lòng thử lại.' };
    }
  };

  // Đăng nhập dành cho Quản trị viên (Email + Password)
  const loginAdmin = async ({ email, password }) => {
    try {
      const emailErr = validateEmail(email);
      if (emailErr) return { success: false, error: emailErr };

      if (!password) {
        return { success: false, error: 'Vui lòng nhập mật khẩu' };
      }

      const res = await accountApi.getAll({ role: 'admin' });
      const adminList = Array.isArray(res.data) ? res.data : [];

      const normalizedEmail = email.trim().toLowerCase();
      const matchedAdmin = adminList.find(
        a => a.email && a.email.toLowerCase() === normalizedEmail
      );

      if (!matchedAdmin) {
        logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'admin' } });
        return { success: false, error: 'Email hoặc mật khẩu không chính xác' };
      }

      const isValidPassword = await verifyAndUpgradeCredential(String(password), matchedAdmin.password, matchedAdmin.id, 'password');
      if (!isValidPassword) {
        logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'admin' } });
        return { success: false, error: 'Email hoặc mật khẩu không chính xác' };
      }

      if (!matchedAdmin.isActive) {
        logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'admin' } });
        return { success: false, error: 'Tài khoản Quản trị viên đã bị khóa hoặc ngừng hoạt động' };
      }

      const userSession = {
        id: matchedAdmin.id,
        employeeId: null,
        role: 'admin',
        email: matchedAdmin.email,
        name: 'Quản trị viên',
        permissions: matchedAdmin.permissions || [],
        isActive: true,
        createdAt: matchedAdmin.createdAt
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
      }

      // Tự động Check-in ngay lúc đăng nhập cho Admin
      const checkInResult = await performAutoCheckIn(userSession);
      if (checkInResult?.mode === 'checked_in') {
        logActivity({
          actor: userSession,
          action: ACTIVITY_ACTIONS.CHECK_IN,
          entityType: 'workSession',
          workSessionId: checkInResult.workSessionId,
        });
      }

      logActivity({
        actor: userSession,
        action: ACTIVITY_ACTIONS.LOGIN,
        entityType: 'auth',
        entityId: userSession.id,
      });

      setCurrentUser(userSession);
      return { success: true, user: userSession };
    } catch (error) {
      console.error('Lỗi khi đăng nhập Admin:', error);
      return { success: false, error: 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.' };
    }
  };

  // Đăng nhập dành cho Nhân viên (Employee Code hoặc Employee Name + PIN đúng 6 chữ số)
  const loginStaff = async ({ employeeCode, code, name, identifier, pin }) => {
    try {
      const isExplicitNameOnly = Boolean(name && !employeeCode && !code && !identifier);
      const rawInput = identifier ?? (employeeCode !== undefined && employeeCode !== null && employeeCode !== ''
        ? employeeCode
        : (code !== undefined && code !== null && code !== ''
          ? code
          : name));
      const inputIdentifier = String(rawInput ?? '').trim();

      if (!inputIdentifier) {
        return { success: false, error: 'Vui lòng nhập mã nhân viên hoặc tên nhân viên' };
      }

      const pinErr = validatePin(pin);
      if (pinErr) {
        return { success: false, error: pinErr };
      }

      const normalizedPin = String(pin).trim();

      // 1. Lấy danh sách Staff và Account
      const [staffRes, accountsRes] = await Promise.all([
        staffApi.getAll(),
        accountApi.getAll()
      ]);
      const staffList = Array.isArray(staffRes.data) ? staffRes.data : [];
      const allAccounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];

      let matchedStaff = null;
      let validAccount = null;

      if (isExplicitNameOnly) {
        // Chỉ định tìm kiếm theo tên
        const matchingStaff = staffList.filter(
          s => s.name && s.name.trim().toLowerCase() === inputIdentifier.toLowerCase()
        );

        if (matchingStaff.length === 0) {
          // Fallback sang Employee Code
          const staffByCode = staffList.find(
            s => s.employeeCode && s.employeeCode.trim().toUpperCase() === inputIdentifier.toUpperCase()
          );
          if (staffByCode) {
            const acc = allAccounts.find(
              a => String(a.employeeId) === String(staffByCode.id) && (a.role === 'staff' || a.role === 'employee')
            );
            if (!acc) {
              logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
              return { success: false, error: 'Nhân viên chưa được cấp tài khoản đăng nhập' };
            }
            const isPinValid = await verifyAndUpgradeCredential(normalizedPin, acc.pin, acc.id, 'pin');
            if (!isPinValid) {
              logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
              return { success: false, error: 'Mã nhân viên hoặc mã PIN 6 số không chính xác' };
            }
            matchedStaff = staffByCode;
            validAccount = acc;
          } else {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
            return { success: false, error: 'Không tìm thấy nhân viên với thông tin này' };
          }
        } else {
          // Tìm các candidate có PIN khớp với Account
          const candidates = [];
          for (const staff of matchingStaff) {
            const acc = allAccounts.find(
              a => String(a.employeeId) === String(staff.id) && (a.role === 'staff' || a.role === 'employee')
            );
            if (acc) {
              const isPinValid = await verifyAndUpgradeCredential(normalizedPin, acc.pin, acc.id, 'pin');
              if (isPinValid) {
                candidates.push({ staff, account: acc });
              }
            }
          }

          if (candidates.length === 0) {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
            return { success: false, error: 'Mã nhân viên hoặc mã PIN 6 số không chính xác' };
          }

          if (candidates.length > 1) {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff', reason: 'ambiguous_credentials' } });
            return { success: false, error: 'Thông tin đăng nhập bị trùng lặp. Vui lòng đăng nhập bằng Mã nhân viên (Employee Code).' };
          }

          matchedStaff = candidates[0].staff;
          validAccount = candidates[0].account;
        }
      } else {
        // Tìm theo Employee Code trước (ưu tiên)
        const staffByCode = staffList.find(
          s => s.employeeCode && s.employeeCode.trim().toUpperCase() === inputIdentifier.toUpperCase()
        );

        if (staffByCode) {
          const acc = allAccounts.find(
            a => String(a.employeeId) === String(staffByCode.id) && (a.role === 'staff' || a.role === 'employee')
          );
          if (!acc) {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
            return { success: false, error: 'Nhân viên chưa được cấp tài khoản đăng nhập' };
          }
          const isPinValid = await verifyAndUpgradeCredential(normalizedPin, acc.pin, acc.id, 'pin');
          if (!isPinValid) {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
            return { success: false, error: 'Mã nhân viên hoặc mã PIN 6 số không chính xác' };
          }
          matchedStaff = staffByCode;
          validAccount = acc;
        } else {
          // Không tìm thấy theo Code -> Tìm theo Name
          const matchingStaff = staffList.filter(
            s => s.name && s.name.trim().toLowerCase() === inputIdentifier.toLowerCase()
          );

          if (matchingStaff.length === 0) {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
            return { success: false, error: 'Không tìm thấy nhân viên với thông tin này' };
          }

          const candidates = [];
          for (const staff of matchingStaff) {
            const acc = allAccounts.find(
              a => String(a.employeeId) === String(staff.id) && (a.role === 'staff' || a.role === 'employee')
            );
            if (acc) {
              const isPinValid = await verifyAndUpgradeCredential(normalizedPin, acc.pin, acc.id, 'pin');
              if (isPinValid) {
                candidates.push({ staff, account: acc });
              }
            }
          }

          if (candidates.length === 0) {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
            return { success: false, error: 'Mã nhân viên hoặc mã PIN 6 số không chính xác' };
          }

          if (candidates.length > 1) {
            logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff', reason: 'ambiguous_credentials' } });
            return { success: false, error: 'Thông tin đăng nhập bị trùng lặp. Vui lòng đăng nhập bằng Mã nhân viên (Employee Code).' };
          }

          matchedStaff = candidates[0].staff;
          validAccount = candidates[0].account;
        }
      }

      if (!matchedStaff.isActive) {
        logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
        return { success: false, error: 'Hồ sơ nhân viên đang ở trạng thái không hoạt động' };
      }

      if (!validAccount.isActive) {
        logActivity({ actor: null, action: ACTIVITY_ACTIONS.LOGIN_FAILED, entityType: 'auth', metadata: { attemptedRole: 'staff' } });
        return { success: false, error: 'Tài khoản nhân viên đã bị vô hiệu hóa' };
      }

      const userRole = validAccount.role || 'employee';

      const userSession = {
        id: validAccount.id,
        employeeId: matchedStaff.id,
        role: userRole,
        name: matchedStaff.name,
        employeeCode: matchedStaff.employeeCode,
        permissions: validAccount.permissions || [],
        isActive: true,
        staffInfo: {
          id: matchedStaff.id,
          employeeCode: matchedStaff.employeeCode,
          name: matchedStaff.name,
          phone: matchedStaff.phone,
          hireDate: matchedStaff.hireDate,
          isActive: matchedStaff.isActive,
          employmentStatus: matchedStaff.employmentStatus
        }
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
      }

      // Tự động Check-in ngay lúc đăng nhập cho Staff theo khung giờ ca làm việc
      const checkInResult = await performAutoCheckIn(userSession);

      if (!checkInResult.success && (checkInResult.mode === 'pos_in_use' || checkInResult.mode === 'employee_active_elsewhere')) {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
        return { success: false, error: checkInResult.error };
      }

      if (checkInResult?.mode === 'checked_in') {
        logActivity({
          actor: userSession,
          action: ACTIVITY_ACTIONS.CHECK_IN,
          entityType: 'workSession',
          workSessionId: checkInResult.workSessionId,
        });
      }

      logActivity({
        actor: userSession,
        action: ACTIVITY_ACTIONS.LOGIN,
        entityType: 'auth',
        entityId: userSession.id,
      });

      setCurrentUser(userSession);
      return { success: true, user: userSession, checkIn: checkInResult };
    } catch (error) {
      console.error('Lỗi khi đăng nhập Staff:', error);
      return { success: false, error: 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.' };
    }
  };

  // Đăng xuất khỏi hệ thống: tự động Check-out trước khi xóa session
  const logout = async () => {
    const actor = currentUser;
    if (actor?.id) {
      const checkOutResult = await performAutoCheckOut(actor.id);
      if (checkOutResult?.checkedOut) {
        logActivity({
          actor,
          action: ACTIVITY_ACTIONS.CHECK_OUT,
          entityType: 'workSession',
          workSessionId: checkOutResult.workSessionId,
        });
      }
      logActivity({
        actor,
        action: ACTIVITY_ACTIONS.LOGOUT,
        entityType: 'auth',
        entityId: actor.id,
      });
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setCurrentUser(null);
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isAdmin: currentUser?.role === 'admin',
        isStaff: currentUser?.role === 'staff',
        isEmployee: currentUser?.role === 'employee',
        role: currentUser?.role || null,
        hasAdmin,
        loading,
        setupFirstAdmin,
        loginAdmin,
        loginStaff,
        logout,
        refreshAuthState: checkAuthState,
        can: (key) => hasPermission(currentUser, key)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- Context + Provider chung file, nợ kỹ thuật đã biết, để tách sau
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      currentUser: null,
      isAuthenticated: false,
      isAdmin: false,
      isStaff: false,
      isEmployee: false,
      role: null,
      hasAdmin: true,
      loading: false,
      setupFirstAdmin: async () => ({ success: false }),
      loginAdmin: async () => ({ success: false }),
      loginStaff: async () => ({ success: false }),
      logout: () => ({ success: true }),
      refreshAuthState: async () => {},
      can: () => false
    };
  }
  return context;
};
