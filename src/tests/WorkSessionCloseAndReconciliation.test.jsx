import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { workSessionApi } from '../api/workSessionApi';
import { orderApi } from '../api/orderApi';

import CloseWorkSessionModal from '../components/workSession/CloseWorkSessionModal';
import WorkSessionListPage from '../pages/WorkSession/WorkSessionListPage';
import { renderWithProviders, mockDefaultAdmin, mockStaffUser, mockEmployeeUser } from './testUtils';

describe('WorkSession Close & Cash Reconciliation Tests (Part 6)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  describe('workSessionApi.closeSession Business Logic', () => {
    it('Calculates expected cash correctly from initialCash + completed cash orders - cancelled cash orders', async () => {
      // 1. Create session with initialCash = 500,000
      await workSessionApi.create({
        id: 'ws-close-test-1',
        code: 'CA-CLOSE-01',
        date: '2026-09-13',
        shiftType: 'morning',
        name: 'Ca Sáng Test Quỹ',
        status: 'active',
        initialCash: 500000
      });

      // 2. Add orders:
      // Order 1: Cash completed = 300,000
      await orderApi.create({
        id: 'ord-c1',
        code: 'HD-C1',
        workSessionId: 'ws-close-test-1',
        paymentMethod: 'cash',
        totalAmount: 300000, items: [{ productId: 'p4', quantity: 300000, price: 1 }],
        status: 'completed'
      }, mockDefaultAdmin);

      // Order 2: Transfer completed = 200,000 (Should NOT count in cash drawer)
      await orderApi.create({
        id: 'ord-t1',
        code: 'HD-T1',
        workSessionId: 'ws-close-test-1',
        paymentMethod: 'transfer',
        totalAmount: 200000, items: [{ productId: 'p4', quantity: 200000, price: 1 }],
        status: 'completed'
      }, mockDefaultAdmin);

      // Order 3: Cash cancelled = 50,000 (Should be deducted from expected cash)
      await orderApi.create({
        id: 'ord-c2',
        code: 'HD-C2',
        workSessionId: 'ws-close-test-1',
        paymentMethod: 'cash',
        totalAmount: 50000, items: [{ productId: 'p4', quantity: 50000, price: 1 }],
        status: 'cancelled'
      }, mockDefaultAdmin);

      // Expected Cash = 500,000 + 300,000 - 50,000 = 750,000

      // Add a present member to verify missing_checkout auto-reconciliation
      await workSessionApi.createMember({
        id: 'wsm-mem-1',
        workSessionId: 'ws-close-test-1',
        accountId: 'acc-emp-1',
        attendanceStatus: 'present',
        workingStatus: 'idle'
      });

      // 3. Close with actualCash = 750,000 (exact match)
      const res = await workSessionApi.closeSession('ws-close-test-1', {
        actualCash: 750000,
        closeNote: 'Khớp tiền hoàn toàn',
        actor: mockDefaultAdmin
      });

      expect(res.status).toBe('closed');
      expect(res.actualCash).toBe(750000);
      expect(res.cashDifference).toBe(0);
      expect(res.totalRevenue).toBe(500000); // completed cash (300k) + completed transfer (200k)
      expect(res.totalOrders).toBe(2);

      // Check member reconciled to missing_checkout
      const members = await workSessionApi.getMembers({ workSessionId: 'ws-close-test-1' });
      const member = members.data.find(m => m.id === 'wsm-mem-1');
      expect(member.attendanceStatus).toBe('missing_checkout');
    });

    it('Rejects closing if cash discrepancy exists and closeNote is empty', async () => {
      await workSessionApi.create({
        id: 'ws-close-diff-1',
        code: 'CA-DIFF-01',
        date: '2026-09-13',
        shiftType: 'morning',
        name: 'Ca Lệch Quỹ',
        status: 'active',
        initialCash: 1000000
      });

      // Actual cash = 900,000 (lệch -100,000)
      await expect(
        workSessionApi.closeSession('ws-close-diff-1', {
          actualCash: 900000,
          closeNote: '',
          actor: mockDefaultAdmin
        })
      ).rejects.toThrow(/DISCREPANCY_NOTE_REQUIRED/i);

      // With closeNote, it succeeds
      const closed = await workSessionApi.closeSession('ws-close-diff-1', {
        actualCash: 900000,
        closeNote: 'Thối nhầm tiền cho khách đơn 01',
        actor: mockDefaultAdmin
      });

      expect(closed.status).toBe('closed');
      expect(closed.actualCash).toBe(900000);
      expect(closed.cashDifference).toBe(-100000);
      expect(closed.note).toContain('Thối nhầm tiền cho khách đơn 01');
    });

    it('Enforces role security: Employee cannot close session, Staff and Admin can', async () => {
      await workSessionApi.create({
        id: 'ws-role-sec-1',
        code: 'CA-SEC-01',
        date: '2026-09-13',
        shiftType: 'morning',
        name: 'Ca Test Quyền',
        status: 'active',
        initialCash: 500000
      });

      // Employee call -> Rejected
      await expect(
        workSessionApi.closeSession('ws-role-sec-1', {
          actualCash: 500000,
          actor: mockEmployeeUser
        })
      ).rejects.toThrow(/PERMISSION_DENIED|Cần quyền/i);

      // Staff call -> Allowed
      const staffRes = await workSessionApi.closeSession('ws-role-sec-1', {
        actualCash: 500000,
        actor: mockStaffUser
      });
      expect(staffRes.status).toBe('closed');
    });
  });

  describe('CloseWorkSessionModal UI Component', () => {
    it('Renders cash calculation, discrepancy alerts, and submits accurately', async () => {
      const mockSession = {
        id: 'ws-modal-1',
        code: 'CA-MODAL-01',
        name: 'Ca Kiểm Tra Modal',
        date: '2026-09-13',
        initialCash: 500000
      };

      const orders = [
        {
          id: 'ord-modal-1',
          code: 'HD-M1',
          workSessionId: 'ws-modal-1',
          paymentMethod: 'cash',
          totalAmount: 250000, items: [{ productId: 'p4', quantity: 250000, price: 1 }],
          status: 'completed',
          businessDate: '2026-09-13'
        }
      ];

      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderWithProviders(
        <CloseWorkSessionModal
          isOpen={true}
          session={mockSession}
          orders={orders}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />,
        { auth: { currentUser: mockDefaultAdmin, isAuthenticated: true } }
      );

      // Wait for calculations to load: Expected Cash = 500k + 250k = 750,000
      expect(await screen.findByText(/Kết toán & Đóng ca làm việc/i, {}, { timeout: 5000 })).toBeTruthy();
      expect(screen.getAllByText(/750\.000/).length).toBeGreaterThan(0);

      // Enter actual cash = 700,000 -> Diff = -50,000 (Thiếu)
      const cashInput = screen.getByRole('spinbutton');
      fireEvent.change(cashInput, { target: { value: '700000' } });

      expect(await screen.findByText(/Thiếu tiền/i)).toBeTruthy();
      expect(screen.getByText(/-50\.000/)).toBeTruthy();

      // Enter reason note
      const noteInput = screen.getByPlaceholderText(/Nhập lý do giải trình chênh lệch/i);
      fireEvent.change(noteInput, { target: { value: 'Lệch 50k do khách mua thiếu tiền' } });

      // Mock closeSession
      vi.spyOn(workSessionApi, 'closeSession').mockResolvedValueOnce({
        id: 'ws-modal-1',
        status: 'closed'
      });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Xác nhận Đóng ca/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('WorkSessionListPage Close Shift Integration', () => {
    it('Opens CloseWorkSessionModal when clicking Đóng ca button on active session', async () => {
      await workSessionApi.create({
        id: 'ws-ui-close-1',
        code: 'CA-UI-01',
        date: '2026-09-13',
        shiftType: 'morning',
        name: 'Ca Mở Cần Đóng',
        status: 'active',
        initialCash: 1000000
      });

      renderWithProviders(<WorkSessionListPage />, {
        auth: { currentUser: mockDefaultAdmin, isAuthenticated: true, isAdmin: true }
      });

      expect(await screen.findByText('Ca Mở Cần Đóng', {}, { timeout: 5000 })).toBeTruthy();

      const closeShiftBtn = screen.getByTitle('Kết toán và đóng ca');
      expect(closeShiftBtn).toBeTruthy();
      fireEvent.click(closeShiftBtn);

      expect(await screen.findByText(/Kết toán & Đóng ca làm việc/i, {}, { timeout: 5000 })).toBeTruthy();
    });
  });
});



