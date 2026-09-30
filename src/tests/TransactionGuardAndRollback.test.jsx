 import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useContext } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AppDataProvider, AppDataContext } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionContext } from '../context/WorkSessionContext';
import { useCart } from '../hooks/useCart';
import { useInventory } from '../hooks/useInventory';

import { orderApi } from '../api/orderApi';
import { inventoryApi } from '../api/inventoryApi';
import { productApi } from '../api/productApi';

// Component để test useCart và useInventory
const TransactionTester = ({ onActionRef }) => {
  const { cartItems, addToCart, checkout } = useCart();
  const { importStock, exportStock } = useInventory();
  const { products } = useContext(AppDataContext);

  React.useEffect(() => {
    if (onActionRef) {
      onActionRef.current = {
        addToCart,
        checkout,
        importStock,
        exportStock,
        products,
        cartItems
      };
    }
  });

  return <div>Transaction Tester Ready (Cart: {cartItems.length})</div>;
};

const renderWithCustomContexts = ({ authValue, sessionValue, onActionRef }) => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <AuthContext.Provider value={authValue}>
          <WorkSessionContext.Provider value={sessionValue}>
            <TransactionTester onActionRef={onActionRef} />
          </WorkSessionContext.Provider>
        </AuthContext.Provider>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Group Stage 3: Transaction Guard & Rollback Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
    vi.restoreAllMocks();
  });

  it('Blocks useCart.checkout() if user is not logged in', async () => {
    const actionRef = { current: null };
    renderWithCustomContexts({
      authValue: { currentUser: null, isAuthenticated: false },
      sessionValue: { currentSession: null, currentMember: null, isCheckedIn: false },
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current).not.toBeNull());

    // Thử checkout khi chưa đăng nhập
    await expect(actionRef.current.checkout()).rejects.toThrow();
  });

  it('Blocks useCart.checkout() if user is logged in but NOT checked in to an active session', async () => {
    const actionRef = { current: null };
    renderWithCustomContexts({
      authValue: { currentUser: { id: 'acc-1', role: 'staff' }, isAuthenticated: true },
      sessionValue: { currentSession: null, currentMember: null, isCheckedIn: false },
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current).not.toBeNull());

    await expect(actionRef.current.checkout()).rejects.toThrow();
  });

  it('Successfully checkouts when checked in: attaches accountId and workSessionId to Order and OUT transactions', async () => {
    const actionRef = { current: null };
    const authVal = { currentUser: { id: 'acc-seller-1', role: 'staff' }, isAuthenticated: true };
    const sessionVal = {
      currentSession: { id: 'ws-active-100', status: 'active' },
      currentMember: { id: 'wsm-100', accountId: 'acc-seller-1', attendanceStatus: 'present' },
      isCheckedIn: true
    };

    renderWithCustomContexts({
      authValue: authVal,
      sessionValue: sessionVal,
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));

    const testProd = actionRef.current.products[0];
    const initialStock = testProd.stockQuantity;

    // Thêm vào giỏ hàng
    await act(async () => {
      actionRef.current.addToCart(testProd, 2);
    });

    // Thực hiện checkout
    let createdOrder = null;
    await act(async () => {
      createdOrder = await actionRef.current.checkout();
    });

    expect(createdOrder).not.toBeNull();
    expect(createdOrder.accountId).toBe('acc-seller-1');
    expect(createdOrder.workSessionId).toBe('ws-active-100');

    // Kiểm tra Order lưu trên DB/localStorage có đúng accountId và workSessionId
    const orderRes = await orderApi.getById(createdOrder.id);
    expect(orderRes.data.accountId).toBe('acc-seller-1');
    expect(orderRes.data.workSessionId).toBe('ws-active-100');

    // Kiểm tra transaction OUT tạo ra có đủ accountId và workSessionId
    const txRes = await inventoryApi.getAllTransactions({ type: 'OUT' });
    const matchingTx = txRes.data.find(t => t.note && t.note.includes(createdOrder.code));
    expect(matchingTx).toBeDefined();
    expect(matchingTx.accountId).toBe('acc-seller-1');
    expect(matchingTx.workSessionId).toBe('ws-active-100');
    expect(matchingTx.quantity).toBe(2);

    // Kiểm tra stock đã trừ
    const prodAfter = await productApi.getById(testProd.id);
    expect(prodAfter.data.stockQuantity).toBe(initialStock - 2);
  });

  it('Executes 100% atomic rollback on useCart.checkout() if stock deduction fails midway', async () => {
    const actionRef = { current: null };
    const authVal = { currentUser: { id: 'acc-seller-1', role: 'staff' }, isAuthenticated: true };
    const sessionVal = {
      currentSession: { id: 'ws-active-100', status: 'active' },
      currentMember: { id: 'wsm-100', attendanceStatus: 'present' },
      isCheckedIn: true
    };

    renderWithCustomContexts({
      authValue: authVal,
      sessionValue: sessionVal,
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(1));

    const prod1 = actionRef.current.products[0];
    const prod2 = actionRef.current.products[1];
    const initialStock1 = prod1.stockQuantity;

    // Thêm 2 sản phẩm vào giỏ
    await act(async () => {
      actionRef.current.addToCart(prod1, 1);
      actionRef.current.addToCart(prod2, 1);
    });

    const initialOrders = await orderApi.getAll();
    const initialOrderCount = initialOrders.data.length;

    // Track ID của order vừa tạo để xác nhận việc hoàn tác
    let createdOrderId = null;
    const originalCreateOrder = orderApi.create;
    vi.spyOn(orderApi, 'create').mockImplementation(async (orderData, actor) => {
      const res = await originalCreateOrder(orderData, actor);
      createdOrderId = res.data.id;
      return res;
    });

    // Giả lập lỗi ở productApi.updateStock khi trừ sản phẩm thứ 2
    let callCount = 0;
    const originalUpdateStock = productApi.updateStock;
    vi.spyOn(productApi, 'deductStockForCheckout').mockImplementation(async (id, newStock, actor, ctx) => {
      callCount++;
      if (id === prod2.id && callCount > 1) {
        throw new Error('Máº¡ng giÃ¡n Ä‘oáº¡n mÃ´ phá»ng!');
      }
      return originalUpdateStock(id, newStock, actor, ctx);
    });

    // Thực hiện checkout -> Phải throw và rollback
    await expect(actionRef.current.checkout()).rejects.toThrow();

    // Verify: tồn kho của prod1 được phục hồi nguyên vẹn
    const prod1After = await productApi.getById(prod1.id);
    expect(prod1After.data.stockQuantity).toBe(initialStock1);

    // Verify: Theo thứ tự mới (trừ kho trước, tạo đơn sau), khi trừ kho lỗi thì KHÔNG tạo đơn
    expect(createdOrderId).toBeNull();
    const ordersRes = await orderApi.getAll();
    expect(ordersRes.data.length).toBe(initialOrderCount);
  });

  it('Blocks useInventory.importStock() and exportStock() when not checked in', async () => {
    const actionRef = { current: null };
    renderWithCustomContexts({
      authValue: { currentUser: { id: 'acc-1', role: 'staff' }, isAuthenticated: true },
      sessionValue: { currentSession: null, currentMember: null, isCheckedIn: false },
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
    const testProd = actionRef.current.products[0];

    // importStock bị chặn
    await expect(
      actionRef.current.importStock(testProd.id, 5, 100000, 'Test nháº­p')
    ).rejects.toThrow();

    // exportStock bị chặn
    await expect(
      actionRef.current.exportStock(testProd.id, 2, 'Test xuáº¥t')
    ).rejects.toThrow();
  });

  it('Successfully imports and exports stock with accountId and workSessionId when checked in', async () => {
    const actionRef = { current: null };
    const authVal = { currentUser: { id: 'acc-importer-1', role: 'admin' }, isAuthenticated: true };
    const sessionVal = {
      currentSession: { id: 'ws-active-200', status: 'active' },
      currentMember: { id: 'wsm-200', attendanceStatus: 'present' },
      isCheckedIn: true
    };

    renderWithCustomContexts({
      authValue: authVal,
      sessionValue: sessionVal,
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
    const testProd = actionRef.current.products[0];
    const initialStock = testProd.stockQuantity;

    // 1. NHẬP KHO (IN)
    await act(async () => {
      await actionRef.current.importStock(testProd.id, 10, 200000, 'Nháº­p hÃ ng ca sÃ¡ng');
    });

    // Kiểm tra transaction IN có accountId và workSessionId
    const inTxRes = await inventoryApi.getAllTransactions({ type: 'IN' });
    const matchingInTx = inTxRes.data.find(t => t.note === 'Nháº­p hÃ ng ca sÃ¡ng');
    expect(matchingInTx).toBeDefined();
    expect(matchingInTx.accountId).toBe('acc-importer-1');
    expect(matchingInTx.workSessionId).toBe('ws-active-200');
    expect(matchingInTx.quantity).toBe(10);

    // Kiểm tra tồn kho tăng +10
    const prodAfterIn = await productApi.getById(testProd.id);
    expect(prodAfterIn.data.stockQuantity).toBe(initialStock + 10);

    // 2. XUẤT KHO (OUT)
    await act(async () => {
      await actionRef.current.exportStock(testProd.id, 3, 'Xuáº¥t chuyá»ƒn kho');
    });

    // Kiểm tra transaction OUT có accountId và workSessionId
    const outTxRes = await inventoryApi.getAllTransactions({ type: 'OUT' });
    const matchingOutTx = outTxRes.data.find(t => t.note === 'Xuáº¥t chuyá»ƒn kho');
    expect(matchingOutTx).toBeDefined();
    expect(matchingOutTx.accountId).toBe('acc-importer-1');
    expect(matchingOutTx.workSessionId).toBe('ws-active-200');
    expect(matchingOutTx.quantity).toBe(3);

    // Kiểm tra tồn kho giảm -3
    const prodAfterOut = await productApi.getById(testProd.id);
    expect(prodAfterOut.data.stockQuantity).toBe(initialStock + 10 - 3);
  });

  it('Flags outOfShift: true on orders and transactions executed past shift official end time', async () => {
    const actionRef = { current: null };
    const authVal = { currentUser: { id: 'acc-late-seller', role: 'staff', permissions: ['inventory.import'] }, isAuthenticated: true };
    // Ca sáng (morning) có giờ kết thúc chính thức 12:00
    const sessionVal = {
      currentSession: { id: 'ws-morning-late', shiftType: 'morning', status: 'active' },
      currentMember: { id: 'wsm-morning-late', attendanceStatus: 'present' },
      isCheckedIn: true
    };

    renderWithCustomContexts({
      authValue: authVal,
      sessionValue: sessionVal,
      onActionRef: actionRef
    });

    await waitFor(() => expect(actionRef.current?.products?.length).toBeGreaterThan(0));
    const testProd = actionRef.current.products[0];

    // Mock Date hiện tại là 22:45 (sau giờ đóng cửa 22:00)
    const mockLateDate = new Date(2026, 7, 28, 22, 45, 0);
    vi.setSystemTime(mockLateDate);

    // 1. Checkout đơn hàng bán sau giờ ca
    await act(async () => {
      actionRef.current.addToCart(testProd);
    });

    let createdOrder;
    await act(async () => {
      createdOrder = await actionRef.current.checkout();
    });

    expect(createdOrder).toBeDefined();
    expect(createdOrder.outOfShift).toBe(true);

    // 2. Nhập kho sau giờ ca
    await act(async () => {
      await actionRef.current.importStock(testProd.id, 5, 200000, 'Nháº­p bÃ¹ cuá»‘i ca');
    });

    const inTxRes = await inventoryApi.getAllTransactions({ type: 'IN' });
    const lateInTx = inTxRes.data.find(t => t.note === 'Nháº­p bÃ¹ cuá»‘i ca');
    expect(lateInTx).toBeDefined();
    expect(lateInTx.outOfShift).toBe(true);

    vi.useRealTimers();
  });
});

