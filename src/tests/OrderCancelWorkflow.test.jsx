import { initSeedData } from './mockApi';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TransactionHistoryPage from '../pages/TransactionHistoryPage';

import { inventoryApi } from '../api/inventoryApi';
import { orderApi } from '../api/orderApi';
import axiosClient from '../api/axiosClient';
import { renderWithProviders, mockDefaultAdmin, mockDefaultActiveSession } from './testUtils';

const renderTransactionHistoryPage = (options) => {
  return renderWithProviders(<TransactionHistoryPage />, options);
};

describe('Group 5: Hủy đơn (OrderCancelWorkflow) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  it('Hiển thị danh sách Hóa đơn bán hàng và sắp xếp HĐ mới lên đầu', async () => {
    const newOrder = {
      id: 'ord-test-cancel-1',
      code: 'HD99999',
      items: [
        { productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Abbott Ensure Gold 380g (Beta Glucan)', quantity: 2, price: 436000 }
      ],
      totalAmount: 872000, items: [{ productId: 'p4', quantity: 872000, price: 1 }],
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    await axiosClient.post('/orders', newOrder);

    renderTransactionHistoryPage();

    // Switch to Orders tab
    expect(await screen.findByText(/Lịch sử giao dịch/i, {}, { timeout: 5000 })).toBeTruthy();
    const ordersTab = await screen.findByText('Đơn hàng Bán (Sales)', {}, { timeout: 5000 });
    fireEvent.click(ordersTab);

    // Verify HD99999 is displayed at the top of the list
    expect(await screen.findByText('HD99999', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('Chặn hủy đơn hàng khi người dùng chưa check-in vào ca làm việc', async () => {
    const prods = await axiosClient.get('/products');
    const testProd = prods.data[0];
    const initialStock = testProd.stockQuantity;

    const newOrder = {
      id: 'ord-test-guard-1',
      code: 'HD77777',
      items: [
        { productId: testProd.id, productName: testProd.name, quantity: 2, price: testProd.sellPrice }
      ],
      totalAmount: testProd.sellPrice * 2,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    await axiosClient.post('/orders', newOrder);

    // Render với session = unauthenticated / not checked in
    renderTransactionHistoryPage({
      session: {
        currentSession: null,
        currentMember: null,
        isCheckedIn: false,
        workingStatus: 'offline',
        loading: false
      }
    });

    const ordersTab = await screen.findByText('Đơn hàng Bán (Sales)', {}, { timeout: 5000 });
    fireEvent.click(ordersTab);

    expect(await screen.findByText('HD77777', {}, { timeout: 5000 })).toBeTruthy();

    const cancelBtns = await screen.findAllByRole('button', { name: /Hủy đơn/i }, { timeout: 5000 });
    fireEvent.click(cancelBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Xác nhận Hủy Đơn')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Đồng ý'));

    // Đơn hàng KHÔNG bị hủy
    const checkOrder = await axiosClient.get('/orders/ord-test-guard-1');
    expect(checkOrder.data.status).toBe('completed');

    // Tồn kho không đổi
    const checkProd = await axiosClient.get(`/products/${testProd.id}`);
    expect(checkProd.data.stockQuantity).toBe(initialStock);
  });

  it('Bấm "Hủy đơn" khi đã check-in chuyển trạng thái thành "Đã hủy", hoàn kho và gắn accountId + workSessionId của ca hiện tại', async () => {
    const prods = await axiosClient.get('/products');
    const testProd = prods.data[0];
    const initialStock = testProd.stockQuantity;

    const newOrder = {
      id: 'ord-test-cancel-2',
      code: 'HD88888',
      accountId: 'acc-old-seller',
      workSessionId: 'ws-old-closed',
      items: [
        { productId: testProd.id, productName: testProd.name, quantity: 2, price: testProd.sellPrice }
      ],
      totalAmount: testProd.sellPrice * 2,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    await axiosClient.post('/orders', newOrder);

    renderTransactionHistoryPage();

    // Click "Đơn hàng Bán (Sales)" tab
    expect(await screen.findByText(/Lịch sử giao dịch/i, {}, { timeout: 5000 })).toBeTruthy();
    const ordersTab = await screen.findByText('Đơn hàng Bán (Sales)', {}, { timeout: 5000 });
    fireEvent.click(ordersTab);

    expect(await screen.findByText('HD88888', {}, { timeout: 5000 })).toBeTruthy();

    // Click "Hủy đơn" button
    const cancelBtns = await screen.findAllByRole('button', { name: /Hủy đơn/i }, { timeout: 5000 });
    fireEvent.click(cancelBtns[0]);

    // Confirm cancel
    await waitFor(() => {
      expect(screen.getByText('Xác nhận Hủy Đơn')).toBeTruthy();
    }, { timeout: 5000 });
    fireEvent.change(screen.getByPlaceholderText(/Nhập lý do hủy đơn/i), {
      target: { value: 'Khách đổi ý, hủy đơn theo yêu cầu' }
    });
    fireEvent.click(screen.getByText('Đồng ý'));

    // Status changes to "Đã hủy"
    await waitFor(() => {
      expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Check inventory stock is refunded (+2)
    const updatedRes = await axiosClient.get(`/products/${testProd.id}`);
    expect(updatedRes.data.stockQuantity).toBe(initialStock + 2);

    // Verify transaction hoàn kho được gắn đúng accountId và workSessionId của ca HIỆN TẠI
    const txRes = await inventoryApi.getAllTransactions({ type: 'IN' });
    const returnTx = txRes.data.find(t => t.note && t.note.includes('HD88888'));
    expect(returnTx).toBeDefined();
    expect(returnTx.accountId).toBe(mockDefaultAdmin.id);
    expect(returnTx.workSessionId).toBe(mockDefaultActiveSession.id);

    // Verify new cancel audit fields on Order
    const checkCancelledOrder = await axiosClient.get(`/orders/${newOrder.id}`);
    expect(checkCancelledOrder.data.status).toBe('cancelled');
    expect(checkCancelledOrder.data.cancelReason).toBe('Khách đổi ý, hủy đơn theo yêu cầu');
    expect(checkCancelledOrder.data.cancelledBy).toBe(mockDefaultAdmin.id);
    expect(checkCancelledOrder.data.cancelledWorkSessionId).toBe(mockDefaultActiveSession.id);
  });

  it('Chặn nhân viên hủy đơn hàng không phải do mình tạo (Layer 1 Guard)', async () => {
    const newOrder = {
      id: 'ord-other-staff',
      code: 'HD66666',
      accountId: 'acc-other-user',
      workSessionId: mockDefaultActiveSession.id,
      items: [
        { productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Abbott Ensure Gold', quantity: 1, price: 436000 }
      ],
      totalAmount: 436000, items: [{ productId: 'p4', quantity: 436000, price: 1 }],
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    await axiosClient.post('/orders', newOrder);

    // Mock Employee user
    const employeeActor = { id: 'acc-my-staff', role: 'employee' };
    renderTransactionHistoryPage({
      auth: {
        currentUser: employeeActor,
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
        isEmployee: true,
        loading: false
      }
    });

    const ordersTab = await screen.findByText('Đơn hàng Bán (Sales)', {}, { timeout: 5000 });
    fireEvent.click(ordersTab);

    // Employee không thấy đơn của người khác trên giao diện (Data Isolation)
    expect(screen.queryByText('HD66666')).toBeNull();

    // Gọi trực tiếp API hủy đơn của người khác cũng bị từ chối
    await expect(
      orderApi.cancelAndRestock(newOrder.id, {
        actor: employeeActor,
        reason: 'Hủy trộm đơn của người khác',
        currentSessionId: mockDefaultActiveSession.id,
      })
    ).rejects.toThrowError(/NOT_OWN_ORDER|CANCEL_DENIED/);

    // Đơn hàng vẫn completed
    const checkOrder = await axiosClient.get('/orders/ord-other-staff');
    expect(checkOrder.data.status).toBe('completed');
  });

  it('Chặn nhân viên tự hủy đơn của chính mình khi đã quá 15 phút (Layer 1 Guard)', async () => {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const newOrder = {
      id: 'ord-expired-own',
      code: 'HD55555',
      accountId: 'acc-my-staff-2',
      workSessionId: mockDefaultActiveSession.id,
      items: [
        { productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Abbott Ensure Gold', quantity: 1, price: 436000 }
      ],
      totalAmount: 436000, items: [{ productId: 'p4', quantity: 436000, price: 1 }],
      status: 'completed',
      createdAt: twentyMinsAgo
    };
    await axiosClient.post('/orders', newOrder);

    renderTransactionHistoryPage({
      auth: {
        currentUser: { id: 'acc-my-staff-2', role: 'employee', permissions: [] },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
        isEmployee: true,
        loading: false
      }
    });

    const ordersTab = await screen.findByText('Đơn hàng Bán (Sales)', {}, { timeout: 5000 });
    fireEvent.click(ordersTab);

    const orderCodeCell = await screen.findByText('HD55555', {}, { timeout: 5000 });
    const row = orderCodeCell.closest('tr');
    const cancelBtn = row.querySelector('.btn-cancel-order');
    // Nút Hủy đơn bị ẩn khi đã quá 15 phút
    expect(cancelBtn).toBeNull();

    // Dialog xác nhận KHÔNG được mở lên
    expect(screen.queryByText('Xác nhận Hủy Đơn')).toBeNull();

    // Đơn hàng vẫn completed
    const checkOrder = await axiosClient.get('/orders/ord-expired-own');
    expect(checkOrder.data.status).toBe('completed');
  });

  it('Cho phép nhân viên hủy đơn của chính mình trong ca hiện tại và dưới 15 phút', async () => {
    const testProd = (await axiosClient.get('/products')).data[0];
    const initialStock = testProd.stockQuantity;

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const newOrder = {
      id: 'ord-valid-own',
      code: 'HD44444',
      accountId: 'acc-my-staff-3',
      workSessionId: mockDefaultActiveSession.id,
      items: [
        { productId: testProd.id, productName: testProd.name, quantity: 1, price: testProd.sellPrice }
      ],
      totalAmount: testProd.sellPrice,
      status: 'completed',
      createdAt: fiveMinsAgo
    };
    await axiosClient.post('/orders', newOrder);

    renderTransactionHistoryPage({
      auth: {
        currentUser: { id: 'acc-my-staff-3', role: 'employee', permissions: [] },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
        isEmployee: true,
        loading: false
      }
    });

    const ordersTab = await screen.findByText('Đơn hàng Bán (Sales)', {}, { timeout: 5000 });
    fireEvent.click(ordersTab);

    const orderCodeCell = await screen.findByText('HD44444', {}, { timeout: 5000 });
    const row = orderCodeCell.closest('tr');
    const cancelBtn = row.querySelector('.btn-cancel-order');
    fireEvent.click(cancelBtn);

    // Dialog xác nhận ĐƯỢC mở lên
    await waitFor(() => {
      expect(screen.getByText('Xác nhận Hủy Đơn')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.change(screen.getByPlaceholderText(/Nhập lý do hủy đơn/i), {
      target: { value: 'Khách đổi ý ngay sau khi mua' }
    });
    fireEvent.click(screen.getByText('Đồng ý'));

    // Status changes to "Đã hủy"
    await waitFor(() => {
      expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const checkOrder = await axiosClient.get('/orders/ord-valid-own');
    expect(checkOrder.data.status).toBe('cancelled');
    expect(checkOrder.data.cancelReason).toBe('Khách đổi ý ngay sau khi mua');
    expect(checkOrder.data.cancelledBy).toBe('acc-my-staff-3');

    // Tồn kho được hoàn trả +1
    const checkProd = await axiosClient.get(`/products/${testProd.id}`);
    expect(checkProd.data.stockQuantity).toBe(initialStock + 1);
  });
});
