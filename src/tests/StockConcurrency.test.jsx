import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { productApi } from '../api/productApi';


describe('Stock Concurrency and Lost Update Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
    
  });

  it('should prevent lost updates and correctly deduct stock when multiple updates happen concurrently', async () => {
    // We simulate two POS terminals (or two concurrent operations) 
    // running the stock deduction retry loop that is implemented in useCart.js.
    // In a real scenario, this happens across different browser tabs/devices.
    
    const productId = 'p0000000-0000-0000-0000-000000000001'; // 50 stock in seed
    
    // Fetch initial stock
    const initialRes = await productApi.getById(productId);
    const initialStock = initialRes.data.stockQuantity;
    expect(initialStock).toBeGreaterThan(5);

    const saleAmountA = 2;
    const saleAmountB = 3;
    const expectedFinalStock = initialStock - saleAmountA - saleAmountB;

    // Simulate the checkout retry loop from useCart.js
    const simulateCheckoutStockDeduction = async (qty) => {
      let attempts = 0;
      let lastErr = null;

      while (attempts <= 3) {
        if (attempts > 0) {
          const backoff = Math.floor(Math.random() * 50) + 10;
          await new Promise(resolve => setTimeout(resolve, backoff));
        }

        const pRes = await productApi.getById(productId);
        const currentProd = pRes.data;
        const currentStock = currentProd.stockQuantity;
        const expectedVersion = typeof currentProd.stockVersion === 'number' ? currentProd.stockVersion : 0;
        
        const newStock = currentStock - qty;
        
        try {
          await productApi.updateStock(productId, newStock, { id: 'acc-admin', role: 'admin' }, {
             source: 'pos_checkout',
             expectedVersion
          });
          return true; // Success
        } catch (err) {
          if (err.code === 'OCC_CONFLICT') {
            attempts++;
            lastErr = err;
          } else {
            throw err;
          }
        }
      }
      throw new Error('Failed after retries', { cause: lastErr });
    };

    // Fire both concurrent requests
    await Promise.all([
      simulateCheckoutStockDeduction(saleAmountA, 'terminal_A'),
      simulateCheckoutStockDeduction(saleAmountB, 'terminal_B')
    ]);

    // Verify final stock
    const finalRes = await productApi.getById(productId);
    const finalStock = finalRes.data.stockQuantity;

    // On the old code without OCC, the first update would be lost (overwritten by the second).
    // The final stock would just be (initial - saleAmountB).
    // On the new code, the retry loop catches the OCC_CONFLICT and retries,
    // so BOTH sales are properly subtracted.
    expect(finalStock).toBe(expectedFinalStock);
  });
});
