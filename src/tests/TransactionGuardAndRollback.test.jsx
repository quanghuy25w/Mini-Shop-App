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

// Component Ä‘á»ƒ test useCart vÃ  useInventory
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

    // Thá»­ checkout khi chÆ°a Ä‘Äƒng nháº­p
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

    // ThÃªm vÃ o giá» hÃ ng
    await act(async () => {
      actionRef.current.addToCart(testProd, 2);
    });

    // Thá»±c hiá»‡n checkout
    let createdOrder = null;
    await act(async () => {
      createdOrder = await actionRef.current.checkout();
    });

    expect(createdOrder).not.toBeNull();
    expect(createdOrder.accountId).toBe('acc-seller-1');
    expect(createdOrder.workSessionId).toBe('ws-active-100');

    // Kiá»ƒm tra Order lÆ°u trÃªn DB/localStorage cÃ³ Ä‘Ãºng accountId vÃ  workSessionId
    const orderRes = await orderApi.getById(createdOrder.id);
    expect(orderRes.data.accountId).toBe('acc-seller-1');
    expect(orderRes.data.workSessionId).toBe('ws-active-100');

    // Kiá»ƒm tra transaction OUT táº¡o ra cÃ³ Ä‘á»§ accountId vÃ  workSessionId
    const txRes = await inventoryApi.getAllTransactions({ type: 'OUT' });
    const matchingTx = txRes.data.find(t => t.note && t.note.includes(createdOrder.code));
    expect(matchingTx).toBeDefined();
    expect(matchingTx.accountId).toBe('acc-seller-1');
    expect(matchingTx.workSessionId).toBe('ws-active-100');
    expect(matchingTx.quantity).toBe(2);

    // Kiá»ƒm tra stock Ä‘Ã£ trá»«
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

    // ThÃªm 2 sáº£n pháº©m vÃ o giá»
    await act(async () => {
      actionRef.current.addToCart(prod1, 1);
      actionRef.current.addToCart(prod2, 1);
    });

    const initialOrders = await orderApi.getAll();
    const initialOrderCount = initialOrders.data.length;

    // Track ID cá»§a order vá»«a táº¡o Ä‘á»ƒ xÃ¡c nháº­n viá»‡c hoÃ n tÃ¡c
    let createdOrderId = null;
    const originalCreateOrder = orderApi.create;
    vi.spyOn(orderApi, 'create').mockImplementation(async (orderData, actor) => {
      const res = await originalCreateOrder(orderData, actor);
      createdOrderId = res.data.id;
      return res;
    });

    // Giáº£ láº­p lá»—i á»Ÿ productApi.updateStock khi trá»« sáº£n pháº©m thá»© 2
    let callCount = 0;
    const originalUpdateStock = productApi.updateStock;
    vi.spyOn(productApi, 'deductStockForCheckout').mockImplementation(async (id, newStock, actor, ctx) => {
      callCount++;
      if (id === prod2.id && callCount > 1) {
        throw new Error('Máº¡ng giÃ¡n Ä‘oáº¡n mÃ´ phá»ng!');
      }
      return originalUpdateStock(id, newStock, actor, ctx);
    });

    // Thá»±c hiá»‡n checkout -> Pháº£i throw vÃ  rollback
    await expect(actionRef.current.checkout()).rejects.toThrow();

    // Verify: tá»“n kho cá»§a prod1 Ä‘Æ°á»£c phá»¥c há»“i nguyÃªn váº¹n
    const prod1After = await productApi.getById(prod1.id);
    expect(prod1After.data.stockQuantity).toBe(initialStock1);

    // Verify: Theo thá»© tá»± má»›i (trá»« kho trÆ°á»›c, táº¡o Ä‘Æ¡n sau), khi trá»« kho lá»—i thÃ¬ KHÃ”NG táº¡o Ä‘Æ¡n
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

    // importStock bá»‹ cháº·n
    await expect(
      actionRef.current.importStock(testProd.id, 5, 100000, 'Test nháº­p')
    ).rejects.toThrow();

    // exportStock bá»‹ cháº·n
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

    // 1. NHáº¬P KHO (IN)
    await act(async () => {
      await actionRef.current.importStock(testProd.id, 10, 200000, 'Nháº­p hÃ ng ca sÃ¡ng');
    });

    // Kiá»ƒm tra transaction IN cÃ³ accountId vÃ  workSessionId
    const inTxRes = await inventoryApi.getAllTransactions({ type: 'IN' });
    const matchingInTx = inTxRes.data.find(t => t.note === 'Nháº­p hÃ ng ca sÃ¡ng');
    expect(matchingInTx).toBeDefined();
    expect(matchingInTx.accountId).toBe('acc-importer-1');
    expect(matchingInTx.workSessionId).toBe('ws-active-200');
    expect(matchingInTx.quantity).toBe(10);

    // Kiá»ƒm tra tá»“n kho tÄƒng +10
    const prodAfterIn = await productApi.getById(testProd.id);
    expect(prodAfterIn.data.stockQuantity).toBe(initialStock + 10);

    // 2. XUáº¤T KHO (OUT)
    await act(async () => {
      await actionRef.current.exportStock(testProd.id, 3, 'Xuáº¥t chuyá»ƒn kho');
    });

    // Kiá»ƒm tra transaction OUT cÃ³ accountId vÃ  workSessionId
    const outTxRes = await inventoryApi.getAllTransactions({ type: 'OUT' });
    const matchingOutTx = outTxRes.data.find(t => t.note === 'Xuáº¥t chuyá»ƒn kho');
    expect(matchingOutTx).toBeDefined();
    expect(matchingOutTx.accountId).toBe('acc-importer-1');
    expect(matchingOutTx.workSessionId).toBe('ws-active-200');
    expect(matchingOutTx.quantity).toBe(3);

    // Kiá»ƒm tra tá»“n kho giáº£m -3
    const prodAfterOut = await productApi.getById(testProd.id);
    expect(prodAfterOut.data.stockQuantity).toBe(initialStock + 10 - 3);
  });

  it('Flags outOfShift: true on orders and transactions executed past shift official end time', async () => {
    const actionRef = { current: null };
    const authVal = { currentUser: { id: 'acc-late-seller', role: 'staff', permissions: ['inventory.import'] }, isAuthenticated: true };
    // Ca sÃ¡ng (morning) cÃ³ giá» káº¿t thÃºc chÃ­nh thá»©c 12:00
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

    // Mock Date hiá»‡n táº¡i lÃ  22:45 (sau giá» Ä‘Ã³ng cá»­a 22:00)
    const mockLateDate = new Date(2026, 7, 28, 22, 45, 0);
    vi.setSystemTime(mockLateDate);

    // 1. Checkout Ä‘Æ¡n hÃ ng bÃ¡n sau giá» ca
    await act(async () => {
      actionRef.current.addToCart(testProd);
    });

    let createdOrder;
    await act(async () => {
      createdOrder = await actionRef.current.checkout();
    });

    expect(createdOrder).toBeDefined();
    expect(createdOrder.outOfShift).toBe(true);

    // 2. Nháº­p kho sau giá» ca
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

