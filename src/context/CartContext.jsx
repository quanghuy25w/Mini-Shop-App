import { createContext, useState, useContext, useMemo } from 'react';
import { AppDataContext } from './AppDataContext';
import { toast } from 'react-toastify';
import { validateStock } from '../utils/validate';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { products } = useContext(AppDataContext);
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (product, quantity = 1) => {
    const dbProduct = products.find(p => p.id === product.id);
    if (!dbProduct) return;
    
    setCartItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const newQty = currentQty + quantity;

      const error = validateStock(newQty, dbProduct.stockQuantity);
      if (error) {
        toast.error(`Không thể thêm. Chỉ còn ${dbProduct.stockQuantity} sản phẩm trong kho!`);
        return prev;
      }

      if (existing) {
        return prev.map(item => 
          item.productId === product.id ? { ...item, quantity: newQty } : item
        );
      } else {
        return [...prev, { 
          productId: product.id, 
          productName: product.name, 
          quantity, 
          price: product.sellPrice,
          unit: product.unit
        }];
      }
    });
  };

  const updateQuantity = (productId, quantity) => {
    const dbProduct = products.find(p => p.id === productId);
    if (!dbProduct) return;

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const error = validateStock(quantity, dbProduct.stockQuantity);
    if (error) {
      toast.error(`Chỉ còn ${dbProduct.stockQuantity} sản phẩm trong kho!`);
      return;
    }

    setCartItems(prev => prev.map(item => 
      item.productId === productId ? { ...item, quantity } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => setCartItems([]);

  const restoreCart = (items = []) => {
    setCartItems(items);
  };

  const totalAmount = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity * item.price, 0);
  }, [cartItems]);

  return (
    <CartContext.Provider value={{
      cartItems,
      setCartItems,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      restoreCart,
      totalAmount
    }}>
      {children}
    </CartContext.Provider>
  );
};
