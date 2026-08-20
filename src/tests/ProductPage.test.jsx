import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import ProductPage from '../pages/ProductPage';
import { AppDataProvider } from '../context/AppDataContext';
import { initSeedData } from '../api/localStorageAdapter';
import axiosClient from '../api/axiosClient';

const renderProductPage = () => {
  return render(
    <AppDataProvider>
      <BrowserRouter>
        <ProductPage />
      </BrowserRouter>
    </AppDataProvider>
  );
};

describe('Group 2: Sản phẩm (ProductPage) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('Hiện cảnh báo khi giá bán < giá vốn nhưng vẫn cho phép lưu sản phẩm', async () => {
    const { container } = renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 5000 })).toBeTruthy();

    // Open Add Product modal
    fireEvent.click(screen.getByText('Thêm sản phẩm'));

    await waitFor(() => {
      expect(screen.getByText(/Thêm sản phẩm mới/i)).toBeTruthy();
    });

    // Fill form fields by name attribute
    const nameInput = container.querySelector('input[name="name"]');
    fireEvent.change(nameInput, { target: { value: 'Sản Phẩm Cảnh Báo Giá' } });

    const categorySelect = container.querySelector('select[name="categoryId"]');
    fireEvent.change(categorySelect, { target: { value: 'c1111111-1111-1111-1111-111111111111' } });

    const costInput = container.querySelector('input[name="costPrice"]');
    fireEvent.change(costInput, { target: { value: '50000' } });

    const sellInput = container.querySelector('input[name="sellPrice"]');
    fireEvent.change(sellInput, { target: { value: '30000' } });

    // Expect warning alert text
    expect(screen.getByText(/Cảnh báo: Giá bán đang nhỏ hơn hoặc bằng giá vốn!/i)).toBeTruthy();

    // Click Submit
    fireEvent.click(screen.getByText('Lưu'));

    // Expect saved product to appear in list
    await waitFor(() => {
      expect(screen.getByText('Sản Phẩm Cảnh Báo Giá')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Xóa sản phẩm thực hiện xóa mềm (isActive = false, không xóa khỏi DB)', async () => {
    renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 5000 })).toBeTruthy();

    // Click delete on first product e.g. "Abbott Ensure Gold 380g (Beta Glucan)"
    const deleteBtns = screen.getAllByTitle('Xóa');
    fireEvent.click(deleteBtns[0]);

    // Expect confirm dialog
    expect(screen.getByText('Xác nhận xóa')).toBeTruthy();

    // Confirm deletion
    fireEvent.click(screen.getByText('Đồng ý'));

    // Product should disappear from the active products list UI
    await waitFor(() => {
      expect(screen.queryByText('Abbott Ensure Gold 380g (Beta Glucan)')).toBeNull();
    }, { timeout: 5000 });

    // Check localStorage directly: item still exists in db but isActive === false
    const productsInStorage = JSON.parse(localStorage.getItem('minishop_products'));
    const testProd = productsInStorage.find(p => p.name === 'Abbott Ensure Gold 380g (Beta Glucan)');
    expect(testProd).toBeTruthy();
    expect(testProd.isActive).toBe(false);
  });

  it('Xuất báo cáo CSV dữ liệu đang hiển thị', async () => {
    renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 5000 })).toBeTruthy();

    const csvBtn = screen.getByText('Xuất CSV');
    expect(csvBtn).toBeTruthy();
    fireEvent.click(csvBtn);
  });
});
