/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import mockData from '../data/mockData.json';

const STORAGE_KEY = 'MINI_SHOP_DATA_V1';

export const ShopContext = createContext(null);

const getInitialData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.categories) &&
        Array.isArray(parsed.products) &&
        Array.isArray(parsed.inventory) &&
        Array.isArray(parsed.transactions) &&
        Array.isArray(parsed.orders)
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error reading MINI_SHOP_DATA_V1 from localStorage:', error);
  }
  return mockData;
};

export function ShopProvider({ children }) {
  const [shopData, setShopData] = useState(getInitialData);

  // Real-time auto-sync state updates to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shopData));
    } catch (error) {
      console.error('Error persisting MINI_SHOP_DATA_V1 to localStorage:', error);
    }
  }, [shopData]);

  // Helper method: export current state as JSON file download
  const exportJsonBackup = () => {
    const jsonString = JSON.stringify(shopData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `mini_shop_backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper method: restore state & localStorage back to initial mockData.json
  const resetToDefault = () => {
    setShopData(mockData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData));
    } catch (error) {
      console.error('Error resetting MINI_SHOP_DATA_V1 in localStorage:', error);
    }
  };

  const value = {
    shopData,
    setShopData,
    categories: shopData.categories || [],
    products: shopData.products || [],
    inventory: shopData.inventory || [],
    transactions: shopData.transactions || [],
    orders: shopData.orders || [],
    orderItems: shopData.orderItems || [],
    exportJsonBackup,
    resetToDefault,
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
}

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
