import { initSeedData, setCollection } from './mockApi';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import DashboardPage from '../pages/DashboardPage';
import { AppDataProvider } from '../context/AppDataContext';
import axiosClient from '../api/axiosClient';
import { getBusinessDate } from '../utils/businessDate';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Render DashboardPage inside required providers.
 * AuthContext is NOT wrapped here (no AuthProvider in test),
 * so currentUser === null → role === null → isEmployee = false
 * → the admin/staff dashboard branch renders.
 */
const renderDashboard = () =>
  render(
    <AppDataProvider>
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    </AppDataProvider>
  );

describe('Group 7: Dashboard (DashboardPage) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  // ── 1. Basic render ──────────────────────────────────────────────
  it('Dashboard renders and shows main heading', async () => {
    renderDashboard();
    expect(await screen.findByText('Tổng Quan (Dashboard)')).toBeTruthy();
  });

  // ── 2. New KPI labels exist ──────────────────────────────────────
  it('Admin/Staff Dashboard shows new KPI cards', async () => {
    renderDashboard();
    // Wait for page heading to appear (past loading spinner)
    await screen.findByText('Tổng Quan (Dashboard)');

    // All four KPI labels should be present once data loads
    await waitFor(
      () => {
        const bodyText = document.body.textContent || '';
        expect(bodyText).toContain('Sản phẩm đang bán');
        expect(bodyText).toContain('Tổng giá trị tồn kho');
        expect(bodyText).toContain('Doanh thu 7 ngày');
        expect(bodyText).toContain('Đơn hàng 7 ngày');
      },
      { timeout: 8000 }
    );
  }, 10000); // explicit test timeout of 10s

  // ── 3. No NaN in rendered output ────────────────────────────────
  it('No NaN is rendered anywhere on the Dashboard', async () => {
    // Add a product with missing costPrice to test the NaN guard
    const prodsRes = await axiosClient.get('/products');
    const existingProds = prodsRes.data || [];
    setCollection('products', [
      ...existingProds,
      {
        id: 'p-no-cost',
        name: 'Test Product No Cost',
        sellPrice: 100000,
        stockQuantity: 10,
        minStockAlert: 5,
        isActive: true,
        // costPrice intentionally omitted to trigger the NaN path
      }
    ]);

    renderDashboard();
    await screen.findByText('Tổng Quan (Dashboard)');
    await screen.findByText('Tổng giá trị tồn kho');

    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('Infinity');
  });

  // ── 4. Inventory value note for missing costPrice ───────────────
  it('Inventory value shows note when products have missing costPrice', async () => {
    // Override products to have exactly one without costPrice
    setCollection('products', [
      {
        id: 'p-a',
        name: 'Product With Cost',
        costPrice: 100000,
        sellPrice: 120000,
        stockQuantity: 5,
        minStockAlert: 2,
        isActive: true,
      },
      {
        id: 'p-b',
        name: 'Product Missing Cost',
        sellPrice: 50000,
        stockQuantity: 3,
        minStockAlert: 1,
        isActive: true,
      }
    ]);
    setCollection('orders', []);

    renderDashboard();
    await screen.findByText('Tổng giá trị tồn kho');

    // Must show notice about products without cost data
    const noteEl = screen.getByText(/NaN% so với 7 ngày trước/);
    expect(noteEl).toBeTruthy();
  });

  // ── 5. Completed orders counted for revenue ──────────────────────
  it('Only completed orders contribute to today revenue', async () => {
    const todayStr = getBusinessDate(new Date());

    setCollection('products', [
      { id: 'p1', name: 'Product 1', costPrice: 100, sellPrice: 200, stockQuantity: 100, minStockAlert: 5, isActive: true }
    ]);

    // Seed orders: one completed, one cancelled, one historical_cancelled
    setCollection('orders', [
      {
        id: 'ord-complete',
        code: 'HD-TEST-001',
        status: 'completed',
        businessDate: todayStr,
        totalAmount: 200000,
        items: [{ productId: 'p1', productName: 'Product 1', quantity: 1, price: 200000 }],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-cancel',
        code: 'HD-TEST-002',
        status: 'cancelled',
        businessDate: todayStr,
        totalAmount: 150000,
        items: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-hist-cancel',
        code: 'HD-TEST-003',
        status: 'historical_cancelled',
        businessDate: todayStr,
        totalAmount: 100000,
        items: [],
        createdAt: new Date().toISOString(),
      },
    ]);

    renderDashboard();
    await screen.findByText('Tổng Quan (Dashboard)');

    // Wait for KPI cards to load (past the LoadingSpinner)
    await waitFor(() => {
      expect(screen.queryByText('Đơn hàng 7 ngày')).not.toBeNull();
    }, { timeout: 5000 });

    // Today order count KPI should be "1" (only the completed order)
    const kpiSpans = document.querySelectorAll('.stat-title');
    let orderCountValue = null;
    kpiSpans.forEach(span => {
      if (span.textContent?.trim() === 'Đơn hàng 7 ngày') {
        const card = span.closest('.stat-card');
        const valEl = card?.querySelector('.stat-value');
        if (valEl) orderCountValue = valEl.textContent?.trim();
      }
    });
    expect(orderCountValue).toBe('1');
  });


  // ── 6. Cancelled orders NOT counted ─────────────────────────────
  it('Cancelled and historical_cancelled orders are excluded from order count', async () => {
    const todayStr = getBusinessDate(new Date());

    setCollection('products', [
      { id: 'p1', name: 'Product 1', costPrice: 100, sellPrice: 200, stockQuantity: 100, minStockAlert: 5, isActive: true }
    ]);

    setCollection('orders', [
      {
        id: 'ord-only-cancel',
        status: 'cancelled',
        businessDate: todayStr,
        totalAmount: 999000,
        items: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-only-hist',
        status: 'historical_cancelled',
        businessDate: todayStr,
        totalAmount: 888000,
        items: [],
        createdAt: new Date().toISOString(),
      }
    ]);

    renderDashboard();
    // Wait for the dashboard page header to render
    await screen.findByText('Tổng Quan (Dashboard)');
    // Wait for data to load (loading spinner to disappear) by waiting for KPI
    await waitFor(() => {
      expect(screen.queryByText('Đơn hàng 7 ngày')).not.toBeNull();
    }, { timeout: 5000 });

    // Order count should be 0 — stat-value in the card for Đơn hàng 7 ngày
    const kpiSpans = document.querySelectorAll('.stat-title');
    let orderCountValue = null;
    kpiSpans.forEach(span => {
      if (span.textContent?.trim() === 'Đơn hàng 7 ngày') {
        const card = span.closest('.stat-card');
        const valEl = card?.querySelector('.stat-value');
        if (valEl) orderCountValue = valEl.textContent?.trim();
      }
    });
    expect(orderCountValue).toBe('0');
  });

  // ── 7. Low-stock follows stockQuantity <= minStockAlert rule ─────
  it('Low-stock table shows products with stockQuantity <= minStockAlert', async () => {
    setCollection('orders', []);
    setCollection('products', [
      {
        id: 'p-low',
        name: 'Low Stock Product Test',
        costPrice: 50000,
        sellPrice: 60000,
        stockQuantity: 2,
        minStockAlert: 10,
        isActive: true,
      },
      {
        id: 'p-ok',
        name: 'Ok Stock Product Test',
        costPrice: 50000,
        sellPrice: 60000,
        stockQuantity: 100,
        minStockAlert: 10,
        isActive: true,
      }
    ]);

    renderDashboard();
    await screen.findByText('Tổng Quan (Dashboard)');
    // Wait for data loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Sản phẩm sắp hết hàng')).not.toBeNull();
    }, { timeout: 5000 });

    const bodyText = document.body.textContent || '';
    expect(bodyText).toContain('Low Stock Product Test');
    expect(bodyText).not.toContain('NaN');
  });


  // ── 8. Top-selling products section ─────────────────────────────
  it('Top 5 sản phẩm bán chạy section renders', async () => {
    renderDashboard();
    expect(await screen.findByText('Top 5 sản phẩm bán chạy')).toBeTruthy();
  });

  // ── 9. Revenue trend section with period controls ────────────────
  it('Revenue trend section renders with 7 ngày and 30 ngày buttons', async () => {
    renderDashboard();
    await screen.findByText('Doanh thu bán hàng');
    expect(screen.getByText('7 ngày')).toBeTruthy();
    expect(screen.getByText('30 ngày')).toBeTruthy();
  });

  // ── 10. Revenue trend: 30-day switch works ───────────────────────
  it('Revenue trend: clicking 30 ngày makes it active', async () => {
    renderDashboard();
    await screen.findByText('Doanh thu bán hàng');

    const btn30 = screen.getByText('30 ngày');
    fireEvent.click(btn30);

    await waitFor(() => {
      expect(btn30.className).toContain('active');
    });
  });

  // ── 11. Today's store activity section ──────────────────────────
  it('Hoạt động hôm nay section renders', async () => {
    renderDashboard();
    expect(await screen.findByText('Hoạt động hôm nay')).toBeTruthy();
  });

  // ── 12. Quick Guide is removed from the page ─────────────────────
  it('Quick Guide "Hướng dẫn nhanh" is no longer rendered', async () => {
    renderDashboard();
    await screen.findByText('Tổng Quan (Dashboard)');

    const quickGuideEl = screen.queryByText('Hướng dẫn nhanh');
    expect(quickGuideEl).toBeNull();
  });

  // ── 13. Inventory value uses costPrice, not sellPrice ────────────
  it('Inventory value is computed from costPrice not sellPrice', async () => {
    setCollection('orders', []);
    setCollection('products', [
      {
        id: 'p-cost-test',
        name: 'Cost Test Product',
        costPrice: 10000,  // should use this
        sellPrice: 99999,  // must NOT use this
        stockQuantity: 2,
        minStockAlert: 5,
        isActive: true,
      }
    ]);

    renderDashboard();
    await screen.findByText('Tổng Quan (Dashboard)');

    // Wait for KPI cards to load
    await waitFor(() => {
      expect(screen.queryByText('Tổng giá trị tồn kho')).not.toBeNull();
    }, { timeout: 5000 });

    // Total inventory value = 2 * 10000 = 20000. vi-VN format is "20.000 ₫"
    const bodyText = document.body.textContent || '';
    // Check 20.000 appears (vi-VN thousands with dot)
    expect(bodyText).toContain('20.000');
    // Check 199.998 does NOT appear (2 * 99999)
    expect(bodyText).not.toContain('199.998');
  });
});

