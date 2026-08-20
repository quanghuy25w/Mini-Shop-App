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
    expect(await screen.findByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');
    fireEvent.change(searchInput, { target: { value: 'Ensure' } });

    // Expect Ensure product card to be displayed
    expect(screen.getByText('Abbott Ensure Gold 380g (Beta Glucan)')).toBeTruthy();

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

    // Add Ensure product to cart
    const prodCard = await screen.findByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 5000 });
    fireEvent.click(prodCard);

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

    // Add Ensure 380g (436.000đ) and Ensure 800g (900.000đ)
    const prod1Card = await screen.findByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 5000 });
    fireEvent.click(prod1Card);

    const prod2Card = await screen.findByText('Abbott Ensure Gold 800g (Beta Glucan)', {}, { timeout: 5000 });
    fireEvent.click(prod2Card);

    // Check subtotal in summary (appears in both Tạm tính and Tổng thanh toán)
    expect((await screen.findAllByText(/1\.336\.000/, {}, { timeout: 5000 })).length).toBeGreaterThan(0);

    // Delete one item
    const removeBtns = screen.getAllByTitle('Xóa sản phẩm khỏi giỏ');
    fireEvent.click(removeBtns[0]);

    // Confirm dialog
    expect(screen.getByText('Xóa sản phẩm khỏi giỏ')).toBeTruthy();
    fireEvent.click(screen.getByText('Đồng ý'));

    // Verify item deleted from cart (only present in product catalog list, count = 1)
    await waitFor(() => {
      expect(screen.getAllByText('Abbott Ensure Gold 380g (Beta Glucan)').length).toBe(1);
    }, { timeout: 5000 });
  });

  it('Thanh toán thành công hiển thị Modal Hóa đơn và làm sạch giỏ hàng + trừ tồn kho', async () => {
    // Get initial stock of first product
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];
    const initialStock = testProd.stockQuantity;

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add product to cart
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Click "Thanh toán (F9)"
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    // Verify Checkout Confirm Modal appears
    expect(await screen.findByText('Xác nhận thanh toán')).toBeTruthy();

    // Click "Thanh toán & In hóa đơn"
    const payAndPrintBtn = screen.getByRole('button', { name: /Thanh toán & In hóa đơn/i });
    fireEvent.click(payAndPrintBtn);

    // Verify Invoice Modal appears
    await waitFor(() => {
      expect(screen.getByText(/Hóa Đơn Bán Hàng/i)).toBeTruthy();
    }, { timeout: 5000 });

    // Close Modal
    const closeBtn = screen.getByText(/Đóng/i);
    fireEvent.click(closeBtn);

    // Verify cart is now empty
    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();

    // Verify stock reduced by 1
    const updatedRes = await axiosClient.get(`/products/${testProd.id}`);
    expect(updatedRes.data.stockQuantity).toBe(initialStock - 1);
  });

  it('Chọn "Chỉ thanh toán (không in)" hoàn tất đơn hàng không mở Modal hóa đơn', async () => {
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add product to cart
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Click "Thanh toán (F9)"
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    // Verify Checkout Confirm Modal appears
    expect(await screen.findByText('Xác nhận thanh toán')).toBeTruthy();

    // Click "Chỉ thanh toán (không in)"
    const payOnlyBtn = screen.getByRole('button', { name: /Chỉ thanh toán \(không in\)/i });
    fireEvent.click(payOnlyBtn);

    // Verify cart is now empty
    await waitFor(() => {
      expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();
    }, { timeout: 5000 });

    // Modal hóa đơn không hiển thị
    expect(screen.queryByText(/Hóa Đơn Bán Hàng/i)).toBeNull();
  });

  it('Chọn "Hủy thao tác" đóng popup và giữ nguyên giỏ hàng', async () => {
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add product to cart
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Click "Thanh toán (F9)"
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    // Verify Checkout Confirm Modal appears
    expect(await screen.findByText('Xác nhận thanh toán')).toBeTruthy();

    // Click "Hủy thao tác"
    const cancelBtn = screen.getByRole('button', { name: /Hủy thao tác/i });
    fireEvent.click(cancelBtn);

    // Popup closed
    await waitFor(() => {
      expect(screen.queryByText('Xác nhận thanh toán')).toBeNull();
    }, { timeout: 5000 });

    // Cart still has product
    expect(screen.queryByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeNull();
  });
});
