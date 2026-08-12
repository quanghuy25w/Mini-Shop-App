import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import App from '../App';
import axiosClient from '../api/axiosClient';

// Tăng timeout vì gọi API thật
const TIMEOUT = 10000;

describe('Export Stock Workflow Tests', () => {
  let container;
  let testProduct;

  beforeAll(async () => {
    // 1. Get a product to test with
    const res = await axiosClient.get('/products');
    const products = res.data;
    testProduct = products.find(p => p.stockQuantity > 0 && p.isActive);
    if (!testProduct) {
      throw new Error("Không có sản phẩm nào có sẵn tồn kho để test");
    }
  });

  it('Verifies the complete Export Stock workflow', async () => {
    const utils = render(<App />);
    container = utils.container;

    // Wait for initial data to load (Dashboard should render)
    await waitFor(() => {
      expect(screen.getByText('Tổng Quan (Dashboard)')).toBeTruthy();
    }, { timeout: TIMEOUT });

    // Click on Export Stock in Sidebar
    const exportLink = screen.getByText('Xuất hàng');
    fireEvent.click(exportLink);

    await waitFor(() => {
      expect(screen.getByText('Xuất Kho (Thủ công)')).toBeTruthy();
    });

    // 1. Load products (happened via context)
    // 2. Select a product
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: testProduct.id } });

    // 3. Verify current stock is displayed
    await waitFor(() => {
      const stockEl = screen.getByText(testProduct.stockQuantity.toString(), { selector: '.stock-row span.font-mono' });
      expect(stockEl).toBeTruthy();
    });

    // 4. Enter a valid quantity
    const quantityInput = screen.getAllByRole('spinbutton')[0]; // Số lượng
    fireEvent.change(quantityInput, { target: { value: '2' } });

    // 5. Verify stock-after-transaction is calculated correctly
    const projectedStock = testProduct.stockQuantity - 2;
    await waitFor(() => {
      expect(screen.getByText(projectedStock.toString(), { selector: '.stock-row.stock-total span.font-mono' })).toBeTruthy();
      expect(screen.getByText('-2', { selector: '.stock-row span.text-brick' })).toBeTruthy();
    });

    // 6. Enter a quantity greater than available stock
    const overQuantity = testProduct.stockQuantity + 5;
    fireEvent.change(quantityInput, { target: { value: overQuantity.toString() } });

    // 7. Verify the validation prevents the transaction (warning appears)
    await waitFor(() => {
      expect(screen.getByText('Cảnh báo: Số lượng xuất vượt quá tồn kho hiện tại!')).toBeTruthy();
    });

    // Reset to valid quantity
    fireEvent.change(quantityInput, { target: { value: '2' } });
    const noteInput = screen.getByPlaceholderText('Lý do xuất kho...');
    fireEvent.change(noteInput, { target: { value: 'Test xuất hàng tự động' } });

    // 8. Click Confirm Export
    const submitBtn = screen.getByText('Xác nhận Xuất Kho');
    fireEvent.click(submitBtn);

    // 9. Verify the confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Xác nhận Xuất Kho', { selector: 'h3' })).toBeTruthy();
      expect(screen.getByText(new RegExp(`Bạn đang chuẩn bị xuất 2 sản phẩm`, 'i'))).toBeTruthy();
    });

    // 10. Confirm the transaction
    const confirmBtn = screen.getByText('Đồng ý', { selector: 'button.btn-submit' });
    fireEvent.click(confirmBtn);

    // 11. Verify the API request succeeds & 13. Verify the transaction appears in /transactions
    // The redirect happens automatically to /transactions
    await waitFor(() => {
      expect(screen.getByText('Lịch sử Giao dịch & Đơn hàng')).toBeTruthy();
    }, { timeout: TIMEOUT });

    // Look for the note in the transaction history
    await waitFor(() => {
      expect(screen.getByText('Test xuất hàng tự động')).toBeTruthy();
    }, { timeout: TIMEOUT });

    // 12. Verify inventory is updated by fetching directly
    const updatedRes = await axiosClient.get(`/products/${testProduct.id}`);
    expect(updatedRes.data.stockQuantity).toBe(projectedStock);
    
    // Test passed successfully
  });
});
