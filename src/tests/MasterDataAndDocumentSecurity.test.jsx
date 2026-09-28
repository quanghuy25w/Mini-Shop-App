import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { productApi } from '../api/productApi';
import { categoryApi } from '../api/categoryApi';
import { inventoryApi } from '../api/inventoryApi';
import { orderApi } from '../api/orderApi';

import SalesPage from '../pages/SalesPage';
import ProductFormModal from '../components/product/ProductFormModal';
import { renderWithProviders, mockDefaultAdmin } from './testUtils';
import { getBusinessDate } from '../utils/businessDate';

describe('Part 7: Master Data & Document Security Tests (P3)', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  describe('Product SKU & Barcode Validation & Search', () => {
    it('Enforces unique SKU and Barcode in ProductFormModal validation', () => {
      const existingProducts = [
        { id: 'p-1', name: 'Trà Xanh 0 Độ', sku: 'SP-TRA-01', barcode: '893500111222', isActive: true },
        { id: 'p-2', name: 'Nước Ngọt Coca', sku: 'SP-COCA-01', barcode: '893500333444', isActive: true },
      ];
      const categories = [{ id: 'c-1', name: 'Đồ uống' }];
      const handleSubmit = vi.fn();

      const { container } = renderWithProviders(
        <ProductFormModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={handleSubmit}
          products={existingProducts}
          categories={categories}
        />
      );

      // Attempt 1: Duplicate SKU
      const nameInput = container.querySelector('input[name="name"]');
      const categorySelect = container.querySelector('select[name="categoryId"]');
      const skuInput = container.querySelector('input[name="sku"]');
      const submitBtn = screen.getByRole('button', { name: /Lưu/i });

      fireEvent.change(nameInput, { target: { value: 'Trà Oolong' } });
      fireEvent.change(categorySelect, { target: { value: 'c-1' } });
      fireEvent.change(skuInput, { target: { value: 'SP-TRA-01' } }); // duplicate
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Mã SKU đã tồn tại/i)).toBeTruthy();
      expect(handleSubmit).not.toHaveBeenCalled();

      // Attempt 2: Duplicate Barcode
      fireEvent.change(skuInput, { target: { value: 'SP-OOLONG-01' } });
      const barcodeInput = container.querySelector('input[name="barcode"]');
      fireEvent.change(barcodeInput, { target: { value: '893500111222' } }); // duplicate barcode
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Mã vạch \(Barcode\) đã tồn tại/i)).toBeTruthy();
      expect(handleSubmit).not.toHaveBeenCalled();

      // Attempt 3: Valid unique SKU & Barcode -> Success
      fireEvent.change(barcodeInput, { target: { value: '893500999888' } });
      fireEvent.click(submitBtn);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.calls[0][0].sku).toBe('SP-OOLONG-01');
      expect(handleSubmit.mock.calls[0][0].barcode).toBe('893500999888');
    });

    it('Prioritizes barcode exact match, then SKU exact match in POS Search', async () => {
      // Create products with distinct barcodes and SKUs
      const p1 = {
        id: 'p-search-1',
        name: 'Cà phê Highlands Đen',
        sku: 'SKU-CF-01',
        barcode: '893600111111',
        costPrice: 10000,
        sellPrice: 20000,
        stockQuantity: 50,
        isActive: true,
        categoryId: 'c1111111-1111-1111-1111-111111111111'
      };
      const p2 = {
        id: 'p-search-2',
        name: 'Cà phê Highlands Sữa',
        sku: 'SKU-CF-02',
        barcode: '893600222222',
        costPrice: 12000,
        sellPrice: 25000,
        stockQuantity: 50,
        isActive: true,
        categoryId: 'c1111111-1111-1111-1111-111111111111'
      };

      await productApi.create(p1, mockDefaultAdmin);
      await productApi.create(p2, mockDefaultAdmin);

      renderWithProviders(<SalesPage />);

      const searchInput = await screen.findByPlaceholderText(/Tìm kiếm sản phẩm/i, {}, { timeout: 5000 });

      // Scan barcode: 893600111111 -> should add Highlands Đen to cart directly
      fireEvent.change(searchInput, { target: { value: '893600111111' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getAllByText(/Cà phê Highlands Đen/i).length).toBeGreaterThan(0);
      });

      // Enter SKU: SKU-CF-02 -> should add Highlands Sữa to cart directly
      fireEvent.change(searchInput, { target: { value: 'SKU-CF-02' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getAllByText(/Cà phê Highlands Sữa/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Product Reactivation and Category Soft-Delete Safety', () => {
    it('Reactivates a deactivated product via productApi.reactivate', async () => {
      const prod = {
        id: 'p-reactivate-1',
        name: 'Sản phẩm thử nghiệm',
        sku: 'SP-TEST-01',
        costPrice: 5000,
        sellPrice: 10000,
        stockQuantity: 0,
        isActive: true
      };
      await productApi.create(prod, mockDefaultAdmin);

      // Deactivate
      await productApi.softDelete('p-reactivate-1', mockDefaultAdmin);
      let getRes = await productApi.getById('p-reactivate-1');
      expect(getRes.data.isActive).toBe(false);

      // Reactivate
      await productApi.reactivate('p-reactivate-1', mockDefaultAdmin);
      getRes = await productApi.getById('p-reactivate-1');
      expect(getRes.data.isActive).toBe(true);
    });

    it('Blocks deleting category when active products exist, and soft-deletes when empty', async () => {
      // Create category
      await categoryApi.create({
        id: 'cat-safe-1',
        name: 'Danh mục An toàn',
        isActive: true
      }, mockDefaultAdmin);

      // Create active product in this category
      await productApi.create({
        id: 'p-in-cat-1',
        name: 'Sản phẩm trong DM',
        sku: 'SP-CAT-01',
        categoryId: 'cat-safe-1',
        costPrice: 5000,
        sellPrice: 10000,
        stockQuantity: 0,
        isActive: true
      }, mockDefaultAdmin);

      // Attempt category remove -> should throw CATEGORY_HAS_ACTIVE_PRODUCTS
      await expect(
        categoryApi.remove('cat-safe-1', mockDefaultAdmin)
      ).rejects.toThrow(/CATEGORY_HAS_ACTIVE_PRODUCTS/i);

      // Deactivate the product
      await productApi.softDelete('p-in-cat-1', mockDefaultAdmin);

      // Now category remove succeeds and soft-deletes (isActive: false)
      const res = await categoryApi.remove('cat-safe-1', mockDefaultAdmin);
      expect(res.data.isActive).toBe(false);
    });
  });

  describe('Document Safety & Void Transactions', () => {
    it('Marks transaction as isVoided via inventoryApi.voidTransaction without deleting historical record', async () => {
      const tx = await inventoryApi.createTransaction({
        id: 'tx-void-1',
        productId: 'p-search-1',
        type: 'IN',
        quantity: 10,
        unitPrice: 10000
      }, mockDefaultAdmin);

      expect(tx.data.id).toBe('tx-void-1');

      // Void transaction
      const voidRes = await inventoryApi.voidTransaction('tx-void-1', mockDefaultAdmin);
      expect(voidRes.data.isVoided).toBe(true);
      expect(voidRes.data.voidedBy).toBe(mockDefaultAdmin.id);
      expect(voidRes.data.voidedAt).toBeTruthy();
    });
  });

  describe('Order Code Generation Safety', () => {
    it('Generates order codes with businessDate format HD-YYYYMMDD-XXXX and guarantees uniqueness', async () => {
      const today = getBusinessDate(new Date());
      const dateCompact = today.replace(/-/g, '');
      const prefix = `HD-${dateCompact}-`;

      const code1 = await orderApi.generateOrderCode(today);
      expect(code1.startsWith(prefix)).toBe(true);

      // Create an order with code1
      await orderApi.create({
        id: 'ord-gen-1',
        code: code1,
        totalAmount: 100000,
        paymentMethod: 'cash',
        businessDate: today,
        status: 'completed'
      }, mockDefaultAdmin);

      // Next generated code must be different and sequential
      const code2 = await orderApi.generateOrderCode(today);
      expect(code2.startsWith(prefix)).toBe(true);
      expect(code2).not.toBe(code1);
    });
  });
});
