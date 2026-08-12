import { renderHook, act } from '@testing-library/react';
import { CartProvider, CartContext } from '../context/CartContext';
import { AppDataContext } from '../context/AppDataContext';
import { useContext } from 'react';
import { describe, it, expect } from 'vitest';

describe('CartContext totalAmount logic', () => {
  it('Cộng dồn đúng khi thêm, sửa, xóa item', () => {
    const mockProducts = [
      { id: 'p1', name: 'SP 1', sellPrice: 10000, stockQuantity: 100, unit: 'cái' },
      { id: 'p2', name: 'SP 2', sellPrice: 20000, stockQuantity: 50, unit: 'cái' }
    ];

    const wrapper = ({ children }) => (
      <AppDataContext.Provider value={{ products: mockProducts }}>
        <CartProvider>
          {children}
        </CartProvider>
      </AppDataContext.Provider>
    );

    const { result } = renderHook(() => useContext(CartContext), { wrapper });

    // Ban đầu tổng = 0
    expect(result.current.totalAmount).toBe(0);

    // Thêm SP1 x 2
    act(() => {
      result.current.addToCart(mockProducts[0], 2);
    });
    expect(result.current.totalAmount).toBe(20000);

    // Thêm SP2 x 1
    act(() => {
      result.current.addToCart(mockProducts[1], 1);
    });
    expect(result.current.totalAmount).toBe(40000); // 20k + 20k

    // Cập nhật số lượng SP1 thành 5
    act(() => {
      result.current.updateQuantity('p1', 5);
    });
    expect(result.current.totalAmount).toBe(70000); // 5*10k + 20k

    // Xóa SP1
    act(() => {
      result.current.removeFromCart('p1');
    });
    expect(result.current.totalAmount).toBe(20000); // Chỉ còn SP2

    // Clear giỏ hàng
    act(() => {
      result.current.clearCart();
    });
    expect(result.current.totalAmount).toBe(0);
  });
});
