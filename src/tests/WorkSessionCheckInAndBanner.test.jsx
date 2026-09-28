import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import WorkSessionBanner from '../components/workSession/WorkSessionBanner';
import Header from '../components/common/Header';
import TransactionHistoryPage from '../pages/TransactionHistoryPage';
import { workSessionApi } from '../api/workSessionApi';
import { accountApi } from '../api/accountApi';
import { staffApi } from '../api/staffApi';
import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';

import { renderWithProviders, mockDefaultActiveSession, mockDefaultMember } from './testUtils';

describe('Group Stage 5: Auto Check-in Architecture, Banners & Audit History Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  it('Renders warning WorkSessionBanner when Staff is logged in outside active operational shift hours', async () => {
    renderWithProviders(<WorkSessionBanner />, {
      auth: {
        currentUser: {
          id: 'acc-staff-noshift',
          role: 'staff',
          name: 'Nhân Viên Tự Do'
        },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: true
      },
      session: {
        currentSession: null,
        currentMember: null,
        activeSessions: [],
        isCheckedIn: false,
        workingStatus: 'offline'
      }
    });

    expect(screen.getByText(/Hiện chưa có ca làm việc đang mở/i)).toBeTruthy();
    expect(screen.getByText(/Ngoài giờ hoạt động, giao dịch bị tạm khóa/i)).toBeTruthy();
  });

  it('Renders success WorkSessionBanner when checked in and toggles working status (active <-> busy)', async () => {
    const updateWorkingStatusMock = vi.fn();

    renderWithProviders(<WorkSessionBanner />, {
      session: {
        currentSession: mockDefaultActiveSession,
        currentMember: mockDefaultMember,
        activeSessions: [mockDefaultActiveSession],
        isCheckedIn: true,
        workingStatus: 'active',
        updateWorkingStatus: updateWorkingStatusMock
      }
    });

    expect(screen.getByText(/Ca trực:/i)).toBeTruthy();
    expect(screen.getByText(/Hoạt động/i)).toBeTruthy();

    // Bấm toggle status sang bận
    const toggleBtn = screen.getByRole('button', { name: /Chuyển Đang bán/i });
    fireEvent.click(toggleBtn);

    expect(updateWorkingStatusMock).toHaveBeenCalledWith('busy');
  });

  it('Renders shift badge in Header: shows "Chưa vào ca" when not checked in and shift code when checked in', async () => {
    // 1. Khi chưa check-in
    const { unmount } = renderWithProviders(<Header />, {
      session: {
        currentSession: null,
        currentMember: null,
        isCheckedIn: false,
        workingStatus: 'offline'
      }
    });

    expect(screen.getByText('Chưa vào ca')).toBeTruthy();
    unmount();

    // 2. Khi đã check-in
    renderWithProviders(<Header />, {
      session: {
        currentSession: mockDefaultActiveSession,
        currentMember: mockDefaultMember,
        isCheckedIn: true,
        workingStatus: 'active'
      }
    });

    expect(screen.getByText(mockDefaultActiveSession.code)).toBeTruthy();
    expect(screen.getByText('(Hoạt động)')).toBeTruthy();
  });

  it('Renders "Người thực hiện" / "Người bán" and "Ca làm việc" in TransactionHistoryPage for both tabs', async () => {
    // 1. Tạo 1 Staff và Account
    await staffApi.create({
      id: 'staff-audit-1',
      employeeCode: 'NV888',
      name: 'Vũ Minh Tuấn',
      phone: '0988888888',
      employmentStatus: 'working',
      isActive: true
    });

    await accountApi.create({
      id: 'acc-audit-1',
      employeeId: 'staff-audit-1',
      role: 'staff',
      pin: '888888',
      isActive: true
    });

    // 2. Tạo 1 Ca làm việc
    await workSessionApi.create({
      id: 'ws-audit-1',
      code: 'CA-AUDIT-88',
      date: '2026-08-28',
      shiftType: 'morning',
      name: 'Ca Sáng Audit',
      status: 'active'
    });

    // 3. Tạo 1 Transaction kho gắn accountId và workSessionId
    await inventoryApi.createTransaction(
      {
        id: 'tx-audit-1',
        productId: 'p0000000-0000-0000-0000-000000000001',
        type: 'IN',
        quantity: 50,
        unitPrice: 300000,
        accountId: 'acc-audit-1',
        workSessionId: 'ws-audit-1',
        note: 'Nhập hàng có kiểm toán',
        createdAt: new Date().toISOString()
      },
      { id: 'acc-audit-1', role: 'staff', permissions: ['inventory.import'] }
    );

    // 4. Tạo 1 Order bán hàng gắn accountId và workSessionId
    await orderApi.create({
      id: 'ord-audit-1',
      code: 'HD-AUDIT-88',
      items: [
        { productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Abbott Ensure Gold', quantity: 1, price: 436000 }
      ],
      totalAmount: 436000,
      accountId: 'acc-audit-1',
      workSessionId: 'ws-audit-1',
      status: 'completed',
      createdAt: new Date().toISOString()
    }, { id: 'acc-audit-1', role: 'staff' });

    renderWithProviders(<TransactionHistoryPage />);

    // TAB 1: Giao dịch kho
    expect(await screen.findByText('Giao dịch nhập/Xuất kho', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Người thực hiện')).toBeTruthy();
    expect(screen.getAllByText('Ca làm việc').length).toBeGreaterThan(0);

    // Kiểm tra thông tin hiển thị đúng tên nhân viên Vũ Minh Tuấn và mã ca CA-AUDIT-88
    expect(await screen.findByText(/Vũ Minh Tuấn/i, {}, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText('CA-AUDIT-88', {}, { timeout: 5000 })).toBeTruthy();

    // TAB 2: Đơn hàng Bán
    const ordersTab = screen.getByRole('button', { name: /Đơn hàng Bán \(Sales\)/i });
    fireEvent.click(ordersTab);

    expect(await screen.findByText('HD-AUDIT-88', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Người bán')).toBeTruthy();
    expect(screen.getByText(/Vũ Minh Tuấn/i)).toBeTruthy();
    expect(screen.getAllByText('CA-AUDIT-88').length).toBeGreaterThan(0);
  });
});

