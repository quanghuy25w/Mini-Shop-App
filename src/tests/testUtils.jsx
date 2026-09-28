import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionContext } from '../context/WorkSessionContext';
import { hasPermission } from '../utils/permissions';

export const mockDefaultAdmin = {
  id: 'acc-admin-default',
  role: 'admin',
  email: 'admin@minishop.vn',
  name: 'Quản trị viên',
  isActive: true,
  createdAt: new Date().toISOString()
};

export const mockStaffUser = {
  id: 'acc-staff-default',
  role: 'staff',
  email: 'staff@minishop.vn',
  name: 'Nhân viên Quản lý',
  isActive: true,
  createdAt: new Date().toISOString()
};

export const mockEmployeeUser = {
  id: 'acc-emp-default',
  role: 'employee',
  email: 'employee@minishop.vn',
  name: 'Nhân viên Bán hàng',
  isActive: true,
  createdAt: new Date().toISOString()
};

export const mockDefaultActiveSession = {
  id: 'ws-active-default',
  code: 'CA-20260827-01',
  date: new Date().toISOString().slice(0, 10),
  shiftType: 'morning',
  name: 'Ca sáng',
  startTime: new Date().toISOString(),
  endTime: null,
  status: 'active',
  initialCash: 1000000,
  actualCash: null,
  totalRevenue: 0,
  totalOrders: 0,
  createdBy: 'acc-admin-default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const mockDefaultMember = {
  id: 'wsm-active-default',
  workSessionId: 'ws-active-default',
  accountId: 'acc-admin-default',
  attendanceStatus: 'present',
  checkInTime: new Date().toISOString(),
  checkOutTime: null,
  workingStatus: 'idle',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const renderWithProviders = (
  ui,
  {
    auth = { currentUser: mockDefaultAdmin, isAuthenticated: true, isAdmin: true, isStaff: false, loading: false },
    session = {
      currentSession: mockDefaultActiveSession,
      currentMember: mockDefaultMember,
      activeSessions: [mockDefaultActiveSession],
      isCheckedIn: true,
      workingStatus: 'idle',
      loading: false,
      checkIn: async () => ({ success: true }),
      checkInSession: async () => ({ success: true }),
      checkOut: async () => ({ success: true }),
      updateWorkingStatus: async () => ({ success: true }),
      refreshSessions: async () => {}
    },
    route = '/'
  } = {}
) => {
  const effectiveAuth = {
    can: (key) => hasPermission(auth.currentUser, key),
    ...auth
  };

  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthContext.Provider value={effectiveAuth}>
          <WorkSessionContext.Provider value={session}>
            <MemoryRouter initialEntries={[route]}>
              {ui}
            </MemoryRouter>
          </WorkSessionContext.Provider>
        </AuthContext.Provider>
      </CartProvider>
    </AppDataProvider>
  );
};
