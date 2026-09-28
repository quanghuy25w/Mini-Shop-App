import { initSeedData } from './mockApi';
import { getBusinessDate } from '../utils/businessDate';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import WorkSessionListPage from '../pages/WorkSession/WorkSessionListPage';
import { workSessionApi } from '../api/workSessionApi';
import { orderApi } from '../api/orderApi';

import { renderWithProviders, mockDefaultAdmin } from './testUtils';

const renderWorkSessionListPage = () => {
  return renderWithProviders(<WorkSessionListPage />, {
    auth: { currentUser: mockDefaultAdmin, isAuthenticated: true, isAdmin: true, isStaff: false, loading: false }
  });
};

describe('Admin WorkSession Management UI Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  it('Renders WorkSessionListPage with stat cards, toolbar filters and empty state when no session exists', async () => {
    renderWorkSessionListPage();

    expect(await screen.findByText('Quản lý ca làm việc', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Ca đang mở')).toBeTruthy();
    expect(screen.getByText('Nhân sự đang trực')).toBeTruthy();
    expect(screen.getByText('Doanh thu ca hôm nay')).toBeTruthy();
    expect(screen.getByText('Quên ra ca')).toBeTruthy();

    expect(await screen.findByText(/Không có ca làm việc nào khớp với bộ lọc/i, {}, { timeout: 5000 })).toBeTruthy();
  });

  it('Edits initial cash and note of an existing session via WorkSessionFormModal', async () => {
    await workSessionApi.create({
      id: 'ws-edit-1',
      code: 'CA-EDIT-01',
      date: '2026-08-28',
      shiftType: 'morning',
      name: 'Ca Sáng Cần Sửa',
      status: 'planned',
      initialCash: 1000000
    });

    renderWorkSessionListPage();

    expect(await screen.findByText('Ca Sáng Cần Sửa', {}, { timeout: 5000 })).toBeTruthy();
    const editBtn = screen.getByTitle('Sửa ca');
    fireEvent.click(editBtn);

    expect(await screen.findByText(/Chỉnh sửa ca làm việc/i, {}, { timeout: 5000 })).toBeTruthy();

    const cashInput = screen.getByRole('spinbutton');
    fireEvent.change(cashInput, { target: { value: '2500000' } });

    const noteInput = screen.getByPlaceholderText(/ghi chú/i);
    fireEvent.change(noteInput, { target: { value: 'Đã bổ sung tiền lẻ' } });

    const saveBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/2\.500\.000/).length).toBeGreaterThan(0);
    });
  });

  it('Allows Admin to cancel a planned shift', async () => {
    await workSessionApi.create({
      id: 'ws-planned-1',
      code: 'CA-PLANNED-01',
      date: '2026-08-27',
      shiftType: 'afternoon',
      name: 'Ca chiều lên lịch',
      status: 'planned',
      initialCash: 500000
    });

    renderWorkSessionListPage();

    expect(await screen.findByText('Ca chiều lên lịch', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getAllByText('Lên lịch').length).toBeGreaterThan(0);

    const cancelBtn = screen.getByTitle('Hủy ca');
    fireEvent.click(cancelBtn);

    expect(await screen.findAllByText(/Hủy ca/i, {}, { timeout: 5000 })).toBeTruthy();
    const confirmBtn = screen.getByRole('button', { name: /Đồng ý/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('Renders late badge with minutes for staff arriving late to a shift', async () => {
    await workSessionApi.create({
      id: 'ws-late-ui',
      code: 'CA-LATE-01',
      date: '2026-08-28',
      shiftType: 'morning',
      name: 'Ca Sáng Đi Muộn',
      status: 'active'
    });

    await workSessionApi.createMember({
      id: 'wsm-late-1',
      workSessionId: 'ws-late-ui',
      accountId: 'acc-admin-default',
      attendanceStatus: 'present',
      workingStatus: 'idle',
      isLate: true,
      lateMinutes: 35
    });

    renderWorkSessionListPage();

    expect(await screen.findByText('Ca Sáng Đi Muộn', {}, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText(/Muộn 35p/i, {}, { timeout: 5000 })).toBeTruthy();
  });

  it('Filters sessions by search query and shift type', async () => {
    await workSessionApi.create({
      id: 'ws-morn-1',
      code: 'CA-MORN-01',
      date: '2026-08-27',
      shiftType: 'morning',
      name: 'Ca Sáng Trực',
      status: 'active'
    });

    await workSessionApi.create({
      id: 'ws-eve-1',
      code: 'CA-EVE-01',
      date: '2026-08-28',
      shiftType: 'evening',
      name: 'Ca tối Mai',
      status: 'planned'
    });

    renderWorkSessionListPage();

    expect(await screen.findByText('Ca Sáng Trực')).toBeTruthy();
    expect(screen.getByText('Ca tối Mai')).toBeTruthy();

    const searchInput = screen.getByPlaceholderText(/Tìm theo mã ca, tên ca/i);
    fireEvent.change(searchInput, { target: { value: 'Sáng' } });

    await waitFor(() => {
      expect(screen.getByText('Ca Sáng Trực')).toBeTruthy();
      expect(screen.queryByText('Ca tối Mai')).toBeNull();
    });

    fireEvent.change(searchInput, { target: { value: '' } });
    const shiftSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(shiftSelect, { target: { value: 'evening' } });

    await waitFor(() => {
      expect(screen.queryByText('Ca Sáng Trực')).toBeNull();
      expect(screen.getByText('Ca tối Mai')).toBeTruthy();
    });
  });

  it('Calculates live real-time revenue and order count for active open shifts directly from Orders', async () => {
    const todayStr = getBusinessDate(new Date());

    await workSessionApi.create({
      id: 'ws-live-calc-1',
      code: 'CA-LIVE-01',
      date: todayStr,
      shiftType: 'morning',
      name: 'Ca Sáng Trực',
      status: 'active',
      totalRevenue: 0,
      totalOrders: 0,
      initialCash: 1000000
    });

    await orderApi.create({
      id: 'ord-live-1',
      workSessionId: 'ws-live-calc-1',
      status: 'completed',
      totalAmount: 350000, items: [{ productId: 'p4', quantity: 350000, price: 1 }],
      createdAt: new Date().toISOString(),
      businessDate: todayStr
    }, mockDefaultAdmin);

    await orderApi.create({
      id: 'ord-live-2',
      workSessionId: 'ws-live-calc-1',
      status: 'completed',
      totalAmount: 450000, items: [{ productId: 'p4', quantity: 450000, price: 1 }],
      createdAt: new Date().toISOString(),
      businessDate: todayStr
    }, mockDefaultAdmin);

    renderWorkSessionListPage();

    expect(await screen.findByText('Ca Sáng Trực', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getAllByText(/800\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 đơn/).length).toBeGreaterThan(0);

    const revStat = screen.getAllByText(/800\.000/);
    expect(revStat.length).toBeGreaterThanOrEqual(2);
  });
});


