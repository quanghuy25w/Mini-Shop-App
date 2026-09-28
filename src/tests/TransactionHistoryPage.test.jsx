import { initSeedData } from './mockApi';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TransactionHistoryPage from '../pages/TransactionHistoryPage';

import axiosClient from '../api/axiosClient';
import { renderWithProviders } from './testUtils';
import { getBusinessDate } from '../utils/businessDate';

describe('TransactionHistoryPage Comprehensive Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('1. Hiển thị tab Giao dịch kho mặc định và chuyển sang tab Đơn hàng', async () => {
    renderWithProviders(<TransactionHistoryPage />);

    // Kiểm tra tiêu đề trang
    expect(await screen.findByText('Lịch sử giao dịch và đơn hàng')).toBeTruthy();
    expect(screen.getByText(/Giao dịch nhập\/Xuất kho/i)).toBeTruthy();

    // Chuyển sang tab Đơn hàng
    const ordersTabBtn = screen.getByRole('button', { name: /Đơn hàng Bán/i });
    fireEvent.click(ordersTabBtn);

    // Chờ danh sách đơn hàng xuất hiện
    expect(await screen.findByText(/Mã HĐ/i)).toBeTruthy();
  });

  it('2. Nhân viên (Employee) chỉ thấy đơn hàng của chính mình khi không có quyền xem tất cả', async () => {
    // Tạo 1 đơn của Employee A và 1 đơn của Employee B
    const today = getBusinessDate();
    const orderA = {
      id: 'ord-emp-a',
      code: 'HD-EMP-A',
      accountId: 'acc-emp-a',
      workSessionId: 'ws-active-default',
      totalAmount: 100000,
      status: 'completed',
      businessDate: today,
      createdAt: new Date().toISOString(),
      items: [{ productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Ensure', quantity: 1, price: 100000 }]
    };
    const orderB = {
      id: 'ord-emp-b',
      code: 'HD-EMP-B',
      accountId: 'acc-emp-b',
      workSessionId: 'ws-active-default',
      totalAmount: 200000,
      status: 'completed',
      businessDate: today,
      createdAt: new Date().toISOString(),
      items: [{ productId: 'p0000000-0000-0000-0000-000000000001', productName: 'Ensure', quantity: 2, price: 100000 }]
    };

    await axiosClient.post('/orders', orderA);
    await axiosClient.post('/orders', orderB);

    const employeeAuth = {
      currentUser: { id: 'acc-emp-a', role: 'employee', name: 'Nhân viên A' },
      isAuthenticated: true,
      isAdmin: false,
    };

    renderWithProviders(<TransactionHistoryPage />, { auth: employeeAuth });

    // Chuyển tab Đơn hàng
    const ordersTabBtn = screen.getByRole('button', { name: /Đơn hàng Bán/i });
    fireEvent.click(ordersTabBtn);

    expect(await screen.findByText('HD-EMP-A')).toBeTruthy();
    expect(screen.queryByText('HD-EMP-B')).toBeNull();
  });

  it('3. Nhân viên có thể hủy đơn của mình trong vòng 15 phút và hoàn kho', async () => {
    const today = getBusinessDate();
    const prods = await axiosClient.get('/products');
    const targetProd = prods.data[0];
    const initialStock = targetProd.stockQuantity;

    const order = {
      id: 'ord-emp-cancel-ok',
      code: 'HD-CANCEL-OK',
      accountId: 'acc-emp-test',
      workSessionId: 'ws-active-default',
      totalAmount: targetProd.price || 436000,
      status: 'completed',
      businessDate: today,
      createdAt: new Date().toISOString(), // Fresh within 15m
      items: [{ productId: targetProd.id, productName: targetProd.name, quantity: 2, price: targetProd.price || 436000 }]
    };

    await axiosClient.post('/orders', order);

    const employeeAuth = {
      currentUser: { id: 'acc-emp-test', role: 'employee', name: 'Nhân viên Test' },
      isAuthenticated: true,
      isAdmin: false,
    };

    renderWithProviders(<TransactionHistoryPage />, { auth: employeeAuth });

    const ordersTabBtn = screen.getByRole('button', { name: /Đơn hàng Bán/i });
    fireEvent.click(ordersTabBtn);

    expect(await screen.findByText('HD-CANCEL-OK')).toBeTruthy();

    // Nút Hủy đơn hiển thị
    const cancelBtn = screen.getByRole('button', { name: /Hủy đơn/i });
    fireEvent.click(cancelBtn);

    // Modal xác nhận xuất hiện
    expect(await screen.findByText('Xác nhận Hủy Đơn')).toBeTruthy();

    // Nhập lý do hủy
    const reasonInput = screen.getByPlaceholderText(/Nhập lý do hủy đơn/i);
    fireEvent.change(reasonInput, { target: { value: 'Khách đổi ý muốn lấy loại khác' } });

    // Xác nhận hủy
    const confirmBtn = screen.getByRole('button', { name: 'Đồng ý' });
    fireEvent.click(confirmBtn);

    // Chờ đơn hàng chuyển sang Đã hủy
    await waitFor(() => {
      expect(screen.getByText('Đã hủy')).toBeTruthy();
    }, { timeout: 5000 });

    // Kiểm tra kho đã được hoàn +2
    const prodAfter = (await axiosClient.get(`/products/${targetProd.id}`)).data;
    expect(prodAfter.stockQuantity).toBe(initialStock + 2);
  });
});
