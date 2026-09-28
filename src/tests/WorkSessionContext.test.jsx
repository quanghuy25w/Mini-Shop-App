import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionProvider } from '../context/WorkSessionContext';
import { useWorkSession } from '../hooks/useWorkSession';
import { workSessionApi } from '../api/workSessionApi';


const TestComponent = () => {
  const {
    currentSession,
    currentMember,
    activeSessions,
    isCheckedIn,
    workingStatus,
    loading,
    checkInSession,
    checkOut,
    updateWorkingStatus
  } = useWorkSession();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="isCheckedIn">{String(isCheckedIn)}</div>
      <div data-testid="workingStatus">{workingStatus}</div>
      <div data-testid="currentSessionId">{currentSession?.id || 'none'}</div>
      <div data-testid="currentSessionStatus">{currentSession?.status || 'none'}</div>
      <div data-testid="currentMemberId">{currentMember?.id || 'none'}</div>
      <div data-testid="currentAttendanceStatus">{currentMember?.attendanceStatus || 'none'}</div>
      <div data-testid="activeSessionsCount">{activeSessions.length}</div>

      <button onClick={() => checkInSession('ws-active-1')}>CheckIn Session 1</button>
      <button onClick={() => checkOut()}>CheckOut</button>
      <button onClick={() => updateWorkingStatus('busy')}>Set Busy</button>
      <button onClick={() => updateWorkingStatus('idle')}>Set Idle</button>
    </div>
  );
};

const renderWithContext = (authValue = {}) => {
  const defaultAuth = {
    currentUser: { id: 'acc-emp-1', role: 'employee', name: 'Nguyễn Anh' },
    isAuthenticated: true,
    isAdmin: false,
    isStaff: false,
    isEmployee: true,
    loading: false,
    ...authValue
  };

  return render(
    <AuthContext.Provider value={defaultAuth}>
      <WorkSessionProvider>
        <TestComponent />
      </WorkSessionProvider>
    </AuthContext.Provider>
  );
};

describe('WorkSessionContext & useWorkSession Tests (State Management)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Renders initial state correctly when unauthenticated', async () => {
    renderWithContext({ currentUser: null, isAuthenticated: false });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('isCheckedIn').textContent).toBe('false');
    expect(screen.getByTestId('workingStatus').textContent).toBe('offline');
    expect(screen.getByTestId('currentSessionId').textContent).toBe('none');
  });

  it('Loads existing active session and membership on mount for logged-in user', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Tạo sẵn 1 active session và 1 present member
    await workSessionApi.create({
      id: 'ws-init-1',
      code: `CA-${today.replace(/-/g, '')}-01`,
      date: today,
      shiftType: 'daily',
      name: 'Ca hôm nay',
      status: 'active'
    });

    await workSessionApi.createMember({
      id: 'm-init-1',
      workSessionId: 'ws-init-1',
      accountId: 'acc-emp-1',
      attendanceStatus: 'present',
      workingStatus: 'idle',
      checkInTime: `${today}T08:00:00.000Z`
    });

    renderWithContext();

    await waitFor(() => {
      expect(screen.getByTestId('isCheckedIn').textContent).toBe('true');
    });

    expect(screen.getByTestId('workingStatus').textContent).toBe('idle');
    expect(screen.getByTestId('currentSessionId').textContent).toBe('ws-init-1');
    expect(screen.getByTestId('currentMemberId').textContent).toBe('m-init-1');
    expect(screen.getByTestId('currentAttendanceStatus').textContent).toBe('present');
  });

  it('Automatically resolves active session for Admin on mount without WorkSessionMember', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await workSessionApi.create({
      id: 'ws-active-1',
      code: `CA-${today.replace(/-/g, '')}-01`,
      date: today,
      shiftType: 'daily',
      name: 'Ca hôm nay',
      status: 'active'
    });

    renderWithContext({
      currentUser: { id: 'acc-admin-1', role: 'admin', name: 'Quản trị viên' },
      isAdmin: true,
      isEmployee: false
    });

    await waitFor(() => {
      expect(screen.getByTestId('isCheckedIn').textContent).toBe('true');
    });

    expect(screen.getByTestId('workingStatus').textContent).toBe('active');
    expect(screen.getByTestId('currentSessionId').textContent).toBe('ws-active-1');
    expect(screen.getByTestId('currentMemberId').textContent).toBe('none');
  });

  it('Updates workingStatus (idle <-> busy) smoothly', async () => {
    await workSessionApi.create({
      id: 'ws-active-1',
      code: 'CA-20260827-01',
      status: 'active'
    });

    await workSessionApi.createMember({
      id: 'm-active-1',
      workSessionId: 'ws-active-1',
      accountId: 'acc-emp-1',
      attendanceStatus: 'present',
      workingStatus: 'idle'
    });

    renderWithContext();

    await waitFor(() => {
      expect(screen.getByTestId('workingStatus').textContent).toBe('idle');
    });

    // Chuyển sang busy
    const busyBtn = screen.getByText('Set Busy');
    await act(async () => {
      busyBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('workingStatus').textContent).toBe('busy');
    });

    // Chuyển lại về idle
    const idleBtn = screen.getByText('Set Idle');
    await act(async () => {
      idleBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('workingStatus').textContent).toBe('idle');
    });
  });

  it('Performs Check-out and resets isCheckedIn to false and workingStatus to offline', async () => {
    await workSessionApi.create({
      id: 'ws-active-1',
      code: 'CA-20260827-01',
      status: 'active'
    });

    await workSessionApi.createMember({
      id: 'm-active-1',
      workSessionId: 'ws-active-1',
      accountId: 'acc-emp-1',
      attendanceStatus: 'present',
      workingStatus: 'idle'
    });

    renderWithContext();

    await waitFor(() => {
      expect(screen.getByTestId('isCheckedIn').textContent).toBe('true');
    });

    // Bấm CheckOut
    const checkOutBtn = screen.getByText('CheckOut');
    await act(async () => {
      checkOutBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('isCheckedIn').textContent).toBe('false');
    });

    expect(screen.getByTestId('workingStatus').textContent).toBe('offline');
    expect(screen.getByTestId('currentSessionId').textContent).toBe('none');
  });
});
