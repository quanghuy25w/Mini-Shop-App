import { createContext, useState, useEffect, useCallback } from 'react';
import { workSessionApi } from '../api/workSessionApi';
import { useAuth } from '../hooks/useAuth';

import { getBusinessDate } from '../utils/businessDate';

// eslint-disable-next-line react-refresh/only-export-components
export const WorkSessionContext = createContext(null);

export const WorkSessionProvider = ({ children }) => {
  const { currentUser } = useAuth();

  const [currentSession, setCurrentSession] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Làm mới và đồng bộ toàn bộ dữ liệu ca làm việc của người dùng hiện tại
  const refreshSessions = useCallback(async () => {
    if (!currentUser?.id) {
      setCurrentSession(null);
      setCurrentMember(null);
      setActiveSessions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Tải danh sách tất cả các ca đang mở (active)
      const activeRes = await workSessionApi.getActiveSessions();
      const allActive = Array.isArray(activeRes.data) ? activeRes.data : [];
      setActiveSessions(allActive);

      const isManager = currentUser.role === 'admin' || currentUser.role === 'staff';

      // 2. Đối với Admin & Staff: Lấy WorkSession của ngày hiện tại, KHÔNG tạo/tìm WorkSessionMember
      if (isManager) {
        const now = new Date();
        const dateStr = getBusinessDate(now);
        const session = await workSessionApi.getTodaySessionForDate(dateStr, now);
        if (session && session.status === 'active') {
          setCurrentSession(session);
        } else {
          setCurrentSession(null);
        }
        setCurrentMember(null);
        return;
      }

      // 3. Đối với Nhân viên (Employee): Tìm ca và bản ghi thành viên mà currentUser đang trực tiếp có mặt (present)
      let activeMembership = await workSessionApi.getUserActiveMembership(currentUser.id);

      if (activeMembership && activeMembership.session && activeMembership.member) {
        setCurrentSession(activeMembership.session);
        setCurrentMember(activeMembership.member);
      } else {
        setCurrentSession(null);
        setCurrentMember(null);
      }
    } catch (err) {
      console.error('[WorkSessionContext] Lỗi khi tải dữ liệu ca làm việc:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect 
    refreshSessions();
  }, [refreshSessions]);

  // Tự động phát hiện chuyển ca theo vòng đời React khi người dùng đang đăng nhập mà không cần refresh trình duyệt
  useEffect(() => {
    if (!currentUser?.id) return;

    const interval = setInterval(() => {
      refreshSessions();
    }, 30000);

    const handleFocus = () => {
      refreshSessions();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser?.id, refreshSessions]);

  // Check-in theo ID bản ghi thành viên (memberId)
  const checkIn = async (memberId) => {
    try {
      const updatedMember = await workSessionApi.checkIn(memberId);
      await refreshSessions();
      return { success: true, member: updatedMember };
    } catch (error) {
      console.error('[WorkSessionContext] Lỗi khi check-in:', error);
      return { success: false, error: error.message || 'Không thể check-in vào ca làm việc' };
    }
  };

  // Check-in trực tiếp theo ID ca làm việc (sessionId)
  const checkInSession = async (sessionId) => {
    if (!currentUser?.id) {
      return { success: false, error: 'Vui lòng đăng nhập trước khi check-in' };
    }

    try {
      // 1. Kiểm tra đã có bản ghi member của currentUser trong ca này chưa
      const membersRes = await workSessionApi.getMembers({
        workSessionId: sessionId,
        accountId: currentUser.id
      });
      const members = Array.isArray(membersRes.data) ? membersRes.data : [];

      let targetMember = members[0];

      if (targetMember) {
        // Nếu đã có bản ghi -> Gọi hàm checkIn
        const updatedMember = await workSessionApi.checkIn(targetMember.id);
        await refreshSessions();
        return { success: true, member: updatedMember };
      } else {
        // Domain Rule: Không ai được tự tạo member mới thông qua hàm này.
        // - Admin/Staff: Không chấm công
        // - Employee: Phải dùng luồng đăng nhập (performAutoCheckIn)
        if (currentUser.role === 'admin' || currentUser.role === 'staff') {
          return {
            success: false,
            error: 'Quản trị viên và Quản lý không cần điểm danh hoặc tham gia ca làm việc.'
          };
        }

        return {
          success: false,
          error: 'Không thể tự vào ca làm việc này.'
        };
      }
    } catch (error) {
      console.error('[WorkSessionContext] Lỗi khi check-in theo ca:', error);
      return { success: false, error: error.message || 'Không thể check-in vào ca' };
    }
  };

  // Check-out cá nhân khỏi ca hiện tại
  const checkOut = async () => {
    if (!currentMember?.id) {
      return { success: false, error: 'Bạn chưa tham gia ca làm việc nào để rời ca' };
    }

    try {
      const updatedMember = await workSessionApi.checkOut(currentMember.id);
      setCurrentSession(null);
      setCurrentMember(null);
      await refreshSessions();
      return { success: true, member: updatedMember };
    } catch (error) {
      console.error('[WorkSessionContext] Lỗi khi check-out:', error);
      return { success: false, error: error.message || 'Không thể rời ca làm việc' };
    }
  };

  // Cập nhật trạng thái nghiệp vụ tức thời (idle <-> busy)
  const updateWorkingStatus = async (status) => {
    if (!currentMember?.id) return;
    try {
      // Cập nhật lạc quan (optimistic) trên state local
      setCurrentMember(prev => prev ? { ...prev, workingStatus: status } : null);
      await workSessionApi.updateWorkingStatus(currentMember.id, status);
    } catch (error) {
      console.error('[WorkSessionContext] Lỗi khi cập nhật trạng thái làm việc:', error);
    }
  };

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'staff';
  const isCheckedIn = isManager
    ? Boolean(currentSession && currentSession.status === 'active')
    : Boolean(
        currentSession &&
        currentMember &&
        currentMember.attendanceStatus === 'present' &&
        currentSession.status === 'active'
      );

  const workingStatus = isCheckedIn ? (currentMember?.workingStatus || 'active') : 'offline';

  // registerId của quầy mà nhân viên đang làm tại thời điểm này.
  // Lấy từ currentMember (đã được ghi khi check-in), không đọc lại từ localStorage.
  const currentRegisterId = currentMember?.registerId || null;

  return (
    <WorkSessionContext.Provider
      value={{
        currentSession,
        currentMember,
        currentRegisterId,
        activeSessions,
        isCheckedIn,
        workingStatus,
        loading,
        checkIn,
        checkInSession,
        checkOut,
        updateWorkingStatus,
        refreshSessions
      }}
    >
      {children}
    </WorkSessionContext.Provider>
  );
};
