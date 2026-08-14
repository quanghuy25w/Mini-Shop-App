import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import CategoryPage from '../pages/CategoryPage';
import { AppDataProvider } from '../context/AppDataContext';
import { initSeedData } from '../api/localStorageAdapter';
import axiosClient from '../api/axiosClient';

const renderCategoryPage = () => {
  return render(
    <AppDataProvider>
      <BrowserRouter>
        <CategoryPage />
      </BrowserRouter>
    </AppDataProvider>
  );
};

describe('Group 1: Danh mục (CategoryPage) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('Validate tên danh mục trống khi tạo mới', async () => {
    renderCategoryPage();

    expect(await screen.findByText('Quản lý Danh mục', {}, { timeout: 5000 })).toBeTruthy();

    // Click "+ Thêm danh mục"
    const addBtn = screen.getByText('+ Thêm danh mục');
    fireEvent.click(addBtn);

    // Modal opens
    expect(screen.getByText('Thêm Danh mục mới')).toBeTruthy();

    // Submit form with empty name
    const submitBtn = screen.getByText('Lưu');
    fireEvent.click(submitBtn);

    // Expect error text
    expect(screen.getByText('Tên danh mục không được để trống')).toBeTruthy();
  });

  it('Báo lỗi khi tạo danh mục trùng tên (không phân biệt chữ hoa/thường)', async () => {
    renderCategoryPage();

    expect(await screen.findByText('Quản lý Danh mục', {}, { timeout: 5000 })).toBeTruthy();
    
    // Wait for categories table to be populated
    await waitFor(() => {
      expect(screen.getByText('Đồ uống')).toBeTruthy();
    }, { timeout: 5000 });

    // Click "+ Thêm danh mục"
    fireEvent.click(screen.getByText('+ Thêm danh mục'));

    // Input duplicate category name in lowercase "đồ uống"
    const input = screen.getByPlaceholderText('Nhập tên danh mục');
    fireEvent.change(input, { target: { value: 'đồ uống' } });

    fireEvent.click(screen.getByText('Lưu'));

    // Expect error text
    await waitFor(() => {
      expect(screen.getByText('Tên danh mục đã tồn tại')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Chặn xóa danh mục ĐANG CÓ sản phẩm active', async () => {
    renderCategoryPage();

    expect(await screen.findByText('Quản lý Danh mục', {}, { timeout: 5000 })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByTitle('Xóa').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Category "Đồ uống" (first row) has active products in seedData
    const deleteBtns = screen.getAllByTitle('Xóa');
    fireEvent.click(deleteBtns[0]);

    // Expect ConfirmDialog blocking deletion
    await waitFor(() => {
      expect(screen.getByText(/Không thể xóa vì còn \d+ sản phẩm thuộc danh mục này\./i)).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Cho phép xóa danh mục KHÔNG CÓ sản phẩm active', async () => {
    // Add a dummy category with no products
    await axiosClient.post('/categories', {
      id: 'cat-empty-test',
      name: 'Danh Mục Rỗng Test',
      description: 'Mô tả test'
    });

    renderCategoryPage();

    expect(await screen.findByText('Danh Mục Rỗng Test', {}, { timeout: 5000 })).toBeTruthy();

    // Find delete button for this new category
    const deleteBtns = screen.getAllByTitle('Xóa');
    const lastDeleteBtn = deleteBtns[deleteBtns.length - 1];
    fireEvent.click(lastDeleteBtn);

    // Confirm dialog should ask confirmation with canDelete=true
    await waitFor(() => {
      expect(screen.getByText(/Bạn có chắc chắn muốn xóa danh mục "Danh Mục Rỗng Test" không\?/i)).toBeTruthy();
    }, { timeout: 5000 });

    // Click "Đồng ý"
    const confirmBtn = screen.getByText('Đồng ý');
    fireEvent.click(confirmBtn);

    // Verify it is removed from list
    await waitFor(() => {
      expect(screen.queryByText('Danh Mục Rỗng Test')).toBeNull();
    }, { timeout: 5000 });
  });
});
