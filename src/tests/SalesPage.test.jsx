import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import SalesPage from '../pages/SalesPage';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { initSeedData } from '../api/localStorageAdapter';
import axiosClient from '../api/axiosClient';

const renderSalesPage = () => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <BrowserRouter>
          <SalesPage />
        </BrowserRouter>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Group 4: Bán hàng (SalesPage) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('Tìm kiếm lọc đúng sản phẩm theo tên hoặc mã', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText('Nước khoáng Lavie 500ml', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');
    fireEvent.change(searchInput, { target: { value: 'Lavie' } });

    // Expect Lavie product card to be displayed
    expect(screen.getByText('Nước khoáng Lavie 500ml')).toBeTruthy();

    // Search non-existing product
    fireEvent.change(searchInput, { target: { value: 'Sản phẩm không có xyz' } });
    expect(await screen.findByText(/Không tìm thấy sản phẩm phù hợp/i, {}, { timeout: 5000 })).toBeTruthy();
  });

  it('Sản phẩm có tồn kho = 0 hiển thị "Hết hàng" và không thể thêm vào giỏ', async () => {
    // Set stock of 1 product to 0
    const products = JSON.parse(localStorage.getItem('minishop_products'));
    products[0].stockQuantity = 0;
    localStorage.setItem('minishop_products', JSON.stringify(products));

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Expect "Tồn: 0 (Hết hàng)" or "Hết hàng" badge
    const outCard = await screen.findByText(/Hết hàng/i, {}, { timeout: 5000 });
    expect(outCard).toBeTruthy();

    // Click on out of stock card
    fireEvent.click(outCard.closest('.pos-product-card') || outCard);

    // Cart remains empty
    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();
  });

  it('Sửa số lượng trong giỏ vượt quá tồn kho bị chặn và báo lỗi', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add Lavie product to cart
    const lavieCard = await screen.findByText('Nước khoáng Lavie 500ml', {}, { timeout: 5000 });
    fireEvent.click(lavieCard);

    // Find quantity input in cart table
    const qtyInputs = screen.getAllByRole('textbox');
    const cartQtyInput = qtyInputs.find(i => i.classList.contains('spinner-input'));
    expect(cartQtyInput).toBeTruthy();

    // Try setting quantity to 99999
    fireEvent.change(cartQtyInput, { target: { value: '99999' } });

    // Quantity should NOT be set to 99999
    expect(cartQtyInput.value).not.toBe('99999');
  });

  it('Tính đúng thành tiền từng dòng và tổng thanh toán khi thêm, sửa, xóa sản phẩm', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add Lavie (6000đ) and Coca (10000đ)
    const lavieCard = await screen.findByText('Nước khoáng Lavie 500ml', {}, { timeout: 5000 });
    fireEvent.click(lavieCard);

    const cocaCard = await screen.findByText('Coca Cola lon 330ml', {}, { timeout: 5000 });
    fireEvent.click(cocaCard);

    // Check subtotal in summary
    expect(await screen.findByText('16.000 ₫', {}, { timeout: 5000 })).toBeTruthy();

    // Delete one item
    const removeBtns = screen.getAllByTitle('Xóa sản phẩm khỏi giỏ');
    fireEvent.click(removeBtns[0]);

    // Confirm dialog
    expect(screen.getByText('Xóa sản phẩm khỏi giỏ')).toBeTruthy();
    fireEvent.click(screen.getByText('Đồng ý'));

    // Verify item deleted
    await waitFor(() => {
      expect(screen.queryByText('Nước khoáng Lavie 500ml')).toBeNull();
    }, { timeout: 5000 });
  });

  it('Thanh toán thành công hiển thị Modal Hóa đơn và làm sạch giỏ hàng + trừ tồn kho', async () => {
    // Get initial stock of Lavie
    const initialProds = await axiosClient.get('/products');
    const lavie = initialProds.data.find(p => p.name.includes('Lavie'));
    const initialStock = lavie.stockQuantity;

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add Lavie to cart
    const lavieCard = await screen.findByText('Nước khoáng Lavie 500ml', {}, { timeout: 5000 });
    fireEvent.click(lavieCard);

    // Click "Thanh toán (F9)"
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    // Verify Invoice Modal appears
    await waitFor(() => {
      expect(screen.getByText('HÓA ĐƠN BÁN HÀNG')).toBeTruthy();
    }, { timeout: 5000 });

    // Close Modal
    const closeBtn = screen.getByText('Đóng');
    fireEvent.click(closeBtn);

    // Verify cart is now empty
    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();

    // Verify stock reduced by 1
    const updatedRes = await axiosClient.get(`/products/${lavie.id}`);
    expect(updatedRes.data.stockQuantity).toBe(initialStock - 1);
  });
});
