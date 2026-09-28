import { initSeedData } from './mockApi';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import DashboardPage from '../pages/DashboardPage';
import { AppDataProvider } from '../context/AppDataContext';
import axiosClient from '../api/axiosClient';


const renderDashboardPage = () => {
  return render(
    <AppDataProvider>
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    </AppDataProvider>
  );
};

describe('Group 7: Dashboard (DashboardPage) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('Hiển thị đủ các thẻ KPI: Tổng SP Active, Doanh thu 7 ngày, Tổng giá trị tồn kho', async () => {
    renderDashboardPage();

    expect(await screen.findByText('Tổng Quan (Dashboard)', {}, { timeout: 5000 })).toBeTruthy();

    expect(screen.getByText('Sản phẩm đang bán')).toBeTruthy();
    expect(screen.getByText('Tổng giá trị tồn kho')).toBeTruthy();
    expect(screen.getByText('Doanh thu 7 ngày')).toBeTruthy();
    expect(screen.getByText('Đơn hàng 7 ngày')).toBeTruthy();
  });

  it('Bảng "Sản phẩm sắp hết hàng" chỉ hiện các sản phẩm có 0 < Tồn kho <= minStockAlert', async () => {
    const prodRes = await axiosClient.get('/products');
    const productsInStorage = prodRes.data;
    if (productsInStorage && productsInStorage.length > 0) {
      await axiosClient.patch(`/products/${productsInStorage[0].id}`, { stockQuantity: 5 });
    }

    renderDashboardPage();

    expect(await screen.findByText('Sản phẩm sắp hết hàng', {}, { timeout: 5000 })).toBeTruthy();

    const activeProdsRes = await axiosClient.get('/products');
    const activeProducts = activeProdsRes.data.filter(p => p.isActive);
    const lowStockProds = activeProducts.filter(p => p.stockQuantity <= p.minStockAlert && p.stockQuantity > 0);

    for (const prod of lowStockProds) {
      expect((await screen.findAllByText(prod.name, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    }
  });
});
