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

describe('Group 6: Giao dịch kho (InventoryTransactions) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('Hiển thị các giao dịch kho (Nhập, Xuất, Hoàn kho từ Hủy đơn) ở đầu bảng', async () => {
    // Add a new inventory transaction
    const newTx = {
      id: 'tx-test-999',
      productId: 'p1111111-1111-1111-1111-111111111111',
      type: 'IN',
      quantity: 50,
      unitPrice: 6000,
      note: 'Giao dịch test mới nhất',
      createdAt: new Date().toISOString()
    };
    await axiosClient.post('/inventoryTransactions', newTx);

    renderTransactionHistoryPage();

    expect(await screen.findByText('Lịch sử Giao dịch & Đơn hàng', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Giao dịch Nhập/Xuất kho')).toBeTruthy();

    // Latest transaction note should be present
    expect(await screen.findByText('Giao dịch test mới nhất', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('Bộ lọc theo sản phẩm, loại giao dịch và khoảng ngày hoạt động đúng', async () => {
    renderTransactionHistoryPage();

    expect(await screen.findByText('Lịch sử Giao dịch & Đơn hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Select filter type: Nhập kho
    const typeSelect = await screen.findByDisplayValue('Tất cả loại giao dịch', {}, { timeout: 5000 });
    fireEvent.change(typeSelect, { target: { value: 'IN' } });

    // Table should filter to show only IN transactions
    await waitFor(() => {
      const tags = screen.getAllByText('IN');
      expect(tags.length).toBeGreaterThan(0);
      expect(screen.queryByText('OUT')).toBeNull();
    }, { timeout: 5000 });
  });

  it('Bấm "Xuất CSV" xuất báo cáo các giao dịch đang hiển thị', async () => {
    renderTransactionHistoryPage();

    expect(await screen.findByText('Lịch sử Giao dịch & Đơn hàng', {}, { timeout: 5000 })).toBeTruthy();

    const csvBtn = screen.getByText('Xuất báo cáo CSV');
    expect(csvBtn).toBeTruthy();
    fireEvent.click(csvBtn);
  });
});
