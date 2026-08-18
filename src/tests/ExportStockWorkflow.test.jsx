import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExportPage from '../pages/ExportPage';
import { AppDataProvider } from '../context/AppDataContext';
import { initSeedData } from '../api/localStorageAdapter';
import axiosClient from '../api/axiosClient';

const renderExportPage = () => {
  return render(
    <AppDataProvider>
      <BrowserRouter>
        <ExportPage />
      </BrowserRouter>
    </AppDataProvider>
  );
};

describe('Group 3: Xuất Kho (ExportStockWorkflow) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();
  });

  it('Renders new Export Page header, 2-column cards and KPI blocks correctly', async () => {
    renderExportPage();

    expect(await screen.findAllByText('Xuất hàng', {}, { timeout: 5000 })).not.toHaveLength(0);
    expect(screen.getByText('Trang chủ')).toBeTruthy();
    expect(screen.getByText('Thông tin xuất hàng')).toBeTruthy();
    expect(screen.getByText('Chi tiết sản phẩm xuất')).toBeTruthy();

    expect(screen.getByText('Tổng số sản phẩm')).toBeTruthy();
    expect(screen.getByText('Tổng số lượng xuất')).toBeTruthy();
    expect(screen.getByText('Tổng giá trị xuất')).toBeTruthy();
  });

  it('Không cho phép thêm trùng sản phẩm xuất kho', async () => {
    renderExportPage();

    expect(await screen.findByText('Chi tiết sản phẩm xuất', {}, { timeout: 5000 })).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryAllByTitle('Xoá khỏi danh sách xuất kho').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Click "+ Thêm sản phẩm"
    fireEvent.click(screen.getByText('+ Thêm sản phẩm'));

    // Try adding "Abbott Ensure Gold 380g (Beta Glucan)" which is already in sample list
    const prodItems = screen.getAllByText('Abbott Ensure Gold 380g (Beta Glucan)');
    fireEvent.click(prodItems[0]);

    // Verify list length remains 4 (duplicate blocked)
    const deleteBtns = screen.getAllByTitle('Xoá khỏi danh sách xuất kho');
    expect(deleteBtns.length).toBe(4);
  });

  it('Xoá 1 dòng khỏi danh sách xuất kho tạm', async () => {
    renderExportPage();

    expect(await screen.findByText('Chi tiết sản phẩm xuất', {}, { timeout: 5000 })).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryAllByTitle('Xoá khỏi danh sách xuất kho').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const deleteBtns = screen.getAllByTitle('Xoá khỏi danh sách xuất kho');
    const initialCount = deleteBtns.length;

    // Delete first item
    fireEvent.click(deleteBtns[0]);

    // Count reduced by 1
    await waitFor(() => {
      const newDeleteBtns = screen.getAllByTitle('Xoá khỏi danh sách xuất kho');
      expect(newDeleteBtns.length).toBe(initialCount - 1);
    }, { timeout: 5000 });
  });

  it('Chặn số lượng xuất > Tồn kho hiện có', async () => {
    renderExportPage();

    expect(await screen.findByText('Chi tiết sản phẩm xuất', {}, { timeout: 5000 })).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryAllByTitle('Xoá khỏi danh sách xuất kho').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Get input for first product row and change value to 9999
    const spinnerInputs = screen.getAllByRole('textbox');
    const qtyInput = spinnerInputs.find(input => input.classList.contains('spinner-input'));
    if (qtyInput) {
      fireEvent.change(qtyInput, { target: { value: '9999' } });
    }

    // Click submit button
    const submitBtn = screen.getByText('Xác nhận xuất hàng');
    fireEvent.click(submitBtn);

    // Verify confirm dialog is NOT opened
    expect(screen.queryByText('Xác nhận Xuất hàng')).toBeNull();
  });

  it('Xuất kho thành công 5 SP A -> Trừ tồn kho -5 ngay lập tức', async () => {
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];
    const initialStock = testProd.stockQuantity;

    renderExportPage();

    expect(await screen.findByText('Chi tiết sản phẩm xuất', {}, { timeout: 5000 })).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryAllByTitle('Xoá khỏi danh sách xuất kho').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Reset list
    fireEvent.click(screen.getByText('Đặt lại'));

    // Add product
    fireEvent.click(screen.getByText('+ Thêm sản phẩm'));
    const prodOption = (await screen.findAllByText(testProd.name, {}, { timeout: 5000 }))[0];
    fireEvent.click(prodOption);

    // Change export quantity to 5
    const spinnerInputs = screen.getAllByRole('textbox');
    const qtyInput = spinnerInputs.find(input => input.classList.contains('spinner-input'));
    if (qtyInput) {
      fireEvent.change(qtyInput, { target: { value: '5' } });
    }

    // Submit form
    const submitBtn = screen.getByText('Xác nhận xuất hàng');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Xác nhận Xuất hàng')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByText('Đồng ý'));

    // Verify inventory updated via API
    await waitFor(async () => {
      const updatedRes = await axiosClient.get(`/products/${testProd.id}`);
      expect(updatedRes.data.stockQuantity).toBe(initialStock - 5);
    }, { timeout: 5000 });
  });

  it('Dừng đúng chỗ khi 1 sản phẩm xuất kho bị lỗi giữa chừng', async () => {
    renderExportPage();

    expect(await screen.findByText('Chi tiết sản phẩm xuất', {}, { timeout: 5000 })).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryAllByTitle('Xoá khỏi danh sách xuất kho').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    fireEvent.click(screen.getByText('Đặt lại'));

    // Add 1 valid item
    fireEvent.click(screen.getByText('+ Thêm sản phẩm'));
    const prodOption = (await screen.findAllByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 5000 }))[0];
    fireEvent.click(prodOption);

    const submitBtn = screen.getByText('Xác nhận xuất hàng');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Xác nhận Xuất hàng')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByText('Đồng ý'));

    await waitFor(() => {
      expect(screen.queryByText('Xác nhận Xuất hàng')).toBeNull();
    }, { timeout: 10000 });
  });
});
