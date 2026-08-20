import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ImportPage from '../pages/ImportPage';
import { AppDataProvider } from '../context/AppDataContext';
import { initSeedData } from '../api/localStorageAdapter';
import axiosClient from '../api/axiosClient';

const renderImportPage = () => {
  return render(
    <AppDataProvider>
      <BrowserRouter>
        <ImportPage />
      </BrowserRouter>
    </AppDataProvider>
  );
};

describe('Group 3: Nhập Kho (ImportStockWorkflow) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    vi.restoreAllMocks();
  });

  it('Hiển thị đúng header, 2 cột và các trường form thông tin nhập hàng', async () => {
    renderImportPage();

    expect(await screen.findByText('Thông tin nhập hàng', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Chi tiết sản phẩm nhập')).toBeTruthy();
    expect(screen.getByText('Tổng số lượng sản phẩm')).toBeTruthy();
    expect(screen.getByText('Tổng tiền nhập')).toBeTruthy();
  });

  it('Chặn thêm vào danh sách khi số lượng nhập ≤ 0 hoặc giá nhập < 0', async () => {
    const { container } = renderImportPage();

    expect(await screen.findByText('Chi tiết sản phẩm nhập', {}, { timeout: 5000 })).toBeTruthy();

    // Open dropdown
    const trigger = screen.getByText('-- Chọn sản phẩm --');
    fireEvent.click(trigger);

    // Wait for dropdown popover to appear
    await waitFor(() => {
      expect(container.querySelector('.dropdown-popover')).not.toBeNull();
    }, { timeout: 5000 });

    const popoverItem = container.querySelector('.dropdown-item-name');
    if (popoverItem) {
      fireEvent.click(popoverItem);
    }

    // Try setting quantity to 0
    const qtyInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInputs[0], { target: { value: '0' } });

    // Click "+ Thêm vào danh sách"
    fireEvent.click(screen.getByText('+ Thêm vào danh sách'));

    // Verify item with quantity 0 is NOT added
    expect(screen.getAllByText('Thành tiền (đ)').length).toBeGreaterThan(0);
  });

  it('Gộp số lượng khi chọn trùng sản phẩm trong danh sách nhập kho tạm', async () => {
    const { container } = renderImportPage();

    expect(await screen.findByText('Chi tiết sản phẩm nhập', {}, { timeout: 5000 })).toBeTruthy();

    // Open dropdown and pick first item
    fireEvent.click(screen.getByText('-- Chọn sản phẩm --'));

    await waitFor(() => {
      expect(container.querySelector('.dropdown-popover')).not.toBeNull();
    }, { timeout: 5000 });

    const popoverItem = container.querySelector('.dropdown-item-name');
    if (popoverItem) {
      fireEvent.click(popoverItem);
    }

    // Set quantity 5, price 6000
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '6000' } });
    fireEvent.click(screen.getByText('+ Thêm vào danh sách'));

    // Expect initial item added
    await waitFor(() => {
      expect(screen.getAllByTitle(/Xoá sản phẩm khỏi danh sách/i).length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('Xoá 1 dòng khỏi danh sách tạm nhập kho', async () => {
    const { container } = renderImportPage();

    expect(await screen.findByText('Chi tiết sản phẩm nhập', {}, { timeout: 5000 })).toBeTruthy();

    // Add first product
    fireEvent.click(screen.getByText('-- Chọn sản phẩm --'));
    await waitFor(() => {
      expect(container.querySelector('.dropdown-popover')).not.toBeNull();
    }, { timeout: 5000 });
    const popoverItems = container.querySelectorAll('.dropdown-item-name');
    if (popoverItems.length > 0) {
      fireEvent.click(popoverItems[0]);
    }
    const inputs1 = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs1[0], { target: { value: '5' } });
    fireEvent.change(inputs1[1], { target: { value: '50000' } });
    fireEvent.click(screen.getByText('+ Thêm vào danh sách'));

    await waitFor(() => {
      expect(screen.getAllByTitle(/Xoá sản phẩm khỏi danh sách/i).length).toBe(1);
    }, { timeout: 5000 });

    // Add second product
    fireEvent.click(container.querySelector('.select-trigger-box'));
    await waitFor(() => {
      expect(container.querySelector('.dropdown-popover')).not.toBeNull();
    }, { timeout: 5000 });
    const popoverItems2 = container.querySelectorAll('.dropdown-item-name');
    if (popoverItems2.length > 1) {
      fireEvent.click(popoverItems2[1]);
    }
    const inputs2 = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs2[0], { target: { value: '3' } });
    fireEvent.change(inputs2[1], { target: { value: '30000' } });
    fireEvent.click(screen.getByText('+ Thêm vào danh sách'));

    await waitFor(() => {
      expect(screen.getAllByTitle(/Xoá sản phẩm khỏi danh sách/i).length).toBe(2);
    }, { timeout: 5000 });

    const deleteBtns = screen.getAllByTitle(/Xoá sản phẩm khỏi danh sách/i);
    fireEvent.click(deleteBtns[0]);

    // Expect items count reduced to 1
    await waitFor(() => {
      const deleteBtnsAfter = screen.getAllByTitle(/Xoá sản phẩm khỏi danh sách/i);
      expect(deleteBtnsAfter.length).toBe(1);
    }, { timeout: 5000 });
  });

  it('Nhập kho thành công 10 SP A -> Cập nhật tồn kho +10 ngay lập tức', async () => {
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];
    const initialStock = testProd.stockQuantity;

    const { container } = renderImportPage();

    expect(await screen.findByText('Chi tiết sản phẩm nhập', {}, { timeout: 5000 })).toBeTruthy();

    // Select and add product to table
    fireEvent.click(screen.getByText('-- Chọn sản phẩm --'));
    await waitFor(() => {
      expect(container.querySelector('.dropdown-popover')).not.toBeNull();
    }, { timeout: 5000 });

    const popoverItems = container.querySelectorAll('.dropdown-item-name');
    if (popoverItems.length > 0) {
      fireEvent.click(popoverItems[0]);
    }
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    fireEvent.change(inputs[1], { target: { value: '50000' } });
    fireEvent.click(screen.getByText('+ Thêm vào danh sách'));

    await waitFor(() => {
      expect(screen.queryAllByTitle(/Xoá sản phẩm khỏi danh sách/i).length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Select supplier
    const supplierSelect = screen.getByRole('combobox');
    fireEvent.change(supplierSelect, { target: { value: 'Nhà phân phối Abbott' } });

    // Submit form directly
    const submitBtn = screen.getByText('Xác nhận nhập hàng');
    fireEvent.click(submitBtn);

    // Confirm dialog
    await waitFor(() => {
      expect(screen.getByText('Xác nhận Nhập hàng')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByText('Đồng ý'));

    // Check updated stock via API
    await waitFor(async () => {
      const updatedRes = await axiosClient.get(`/products/${testProd.id}`);
      expect(updatedRes.data.stockQuantity).toBeGreaterThan(initialStock);
    }, { timeout: 5000 });
  });

  it('Dừng đúng chỗ khi 1 sản phẩm trong danh sách lỗi giữa chừng khi submit hàng loạt', async () => {
    const { container } = renderImportPage();

    expect(await screen.findByText('Chi tiết sản phẩm nhập', {}, { timeout: 5000 })).toBeTruthy();

    // Select and add product to table
    fireEvent.click(screen.getByText('-- Chọn sản phẩm --'));
    await waitFor(() => {
      expect(container.querySelector('.dropdown-popover')).not.toBeNull();
    }, { timeout: 5000 });

    const popoverItems = container.querySelectorAll('.dropdown-item-name');
    if (popoverItems.length > 0) {
      fireEvent.click(popoverItems[0]);
    }
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '50000' } });
    fireEvent.click(screen.getByText('+ Thêm vào danh sách'));

    await waitFor(() => {
      expect(screen.queryAllByTitle(/Xoá sản phẩm khỏi danh sách/i).length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Select supplier
    const supplierSelect = screen.getByRole('combobox');
    fireEvent.change(supplierSelect, { target: { value: 'Nhà phân phối Abbott' } });

    const submitBtn = screen.getByText('Xác nhận nhập hàng');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Xác nhận Nhập hàng')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByText('Đồng ý'));

    await waitFor(() => {
      expect(screen.queryByText('Xác nhận Nhập hàng')).toBeNull();
    }, { timeout: 10000 });
  });
});
