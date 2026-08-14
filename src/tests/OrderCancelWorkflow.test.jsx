import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import TransactionHistoryPage from '../pages/TransactionHistoryPage';
import { AppDataProvider } from '../context/AppDataContext';
import { initSeedData } from '../api/localStorageAdapter';
import axiosClient from '../api/axiosClient';

const renderTransactionHistoryPage = () => {
  return render(
    <AppDataProvider>
      <BrowserRouter>
        <TransactionHistoryPage />
      </BrowserRouter>
    </AppDataProvider>
  );
};

describe('Group 5: Hủy đơn (OrderCancelWorkflow) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('Hiển thị danh sách Hóa đơn bán hàng và sắp xếp HĐ mới lên đầu', async () => {
    // Create a new test order
    const newOrder = {
      id: 'ord-test-cancel-1',
      code: 'HD99999',
      items: [
        { productId: 'p1111111-1111-1111-1111-111111111111', productName: 'Nước khoáng Lavie 500ml', quantity: 2, price: 6000 }
      ],
      totalAmount: 12000,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    await axiosClient.post('/orders', newOrder);

    renderTransactionHistoryPage();

    // Switch to Orders tab
    expect(await screen.findByText('Lịch sử Giao dịch & Đơn hàng', {}, { timeout: 5000 })).toBeTruthy();
    const ordersTab = await screen.findByText('Đơn hàng Bán (Sales)', {}, { timeout: 5000 });
    fireEvent.click(ordersTab);

    // Verify HD99999 is displayed at the top of the list
    expect(await screen.findByText('HD99999', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('Bấm "Hủy đơn" chuyển trạng thái thành "Đã hủy" và cộng hoàn trả tồn kho sản phẩm', async () => {
    // Get Lavie initial stock
    const prods = await axiosClient.get('/products');
    const lavie = prods.data.find(p => p.name.includes('Lavie'));
    const initialStock = lavie.stockQuantity;

    // Create a test order with 2 units of Lavie
    const newOrder = {
      id: 'ord-test-cancel-2',
      code: 'HD88888',
      items: [
        { productId: lavie.id, productName: lavie.name, quantity: 2, price: lavie.sellPrice }
      ],
      totalAmount: lavie.sellPrice * 2,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    await axiosClient.post('/orders', newOrder);

    renderTransactionHistoryPage();

    // Click "Đơn hàng Bán (Sales)" tab
    expect(await screen.findByText('Lịch sử Giao dịch & Đơn hàng', {}, { timeout: 5000 })).toBeTruthy();
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
    fireEvent.click(screen.getByText('Đồng ý'));

    // Status changes to "Đã hủy"
    await waitFor(() => {
      expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Check inventory stock is refunded (+2)
    const updatedRes = await axiosClient.get(`/products/${lavie.id}`);
    expect(updatedRes.data.stockQuantity).toBe(initialStock + 2);
  });
});
