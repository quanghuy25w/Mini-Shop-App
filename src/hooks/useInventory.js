import { useContext } from 'react';
import { AppDataContext } from '../context/AppDataContext';
import { AuthContext } from '../context/AuthContext';
import { WorkSessionContext } from '../context/WorkSessionContext';
import { inventoryApi, INVENTORY_TYPES, INVENTORY_REASONS } from '../api/inventoryApi';
import { productApi } from '../api/productApi';
import { isOutOfShift } from '../api/workSessionApi';
import { generateId } from '../utils/generateId';
import { getBusinessDate } from '../utils/businessDate';
import { calculateWeightedAverageCost } from '../utils/costing';
import { validateStock } from '../utils/validate';

export const useInventory = () => {
  const { refreshProducts } = useContext(AppDataContext);
  const authContext = useContext(AuthContext);
  const workSessionContext = useContext(WorkSessionContext);

  const currentUser = authContext?.currentUser;
  const currentSession = workSessionContext?.currentSession;
  const currentMember = workSessionContext?.currentMember;
  const isCheckedIn = workSessionContext?.isCheckedIn;

  const assertAuthAndShift = (action = 'thao tác kho') => {
    if (!currentUser?.id) {
      throw new Error(`Vui lòng đăng nhập để thực hiện ${action}.`);
    }
    const isManager = currentUser?.role === 'admin' || currentUser?.role === 'staff';
    const isNotCheckedIn = isManager
      ? (!isCheckedIn || !currentSession?.id || currentSession?.status !== 'active')
      : (!isCheckedIn || !currentSession?.id || currentMember?.attendanceStatus !== 'present');

    if (isNotCheckedIn) {
      throw new Error(`Bạn chưa check-in vào ca làm việc nào. Vui lòng check-in trước khi ${action}.`);
    }
  };

  /**
   * Nhập kho theo lô nhiều sản phẩm atomic (All-or-Nothing).
   * Cập nhật tồn kho và giá vốn bình quân gia quyền cho từng sản phẩm.
   */
  const importStockBatch = async (items = [], commonData = {}) => {
    assertAuthAndShift('nhập kho');

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Danh sách sản phẩm nhập không được để trống.");
    }

    // 1. Pre-validate toàn bộ danh sách và nạp dữ liệu sản phẩm mới nhất từ API
    const validatedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);

      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Dòng ${i + 1}: Số lượng nhập phải lớn hơn 0.`);
      }
      if (isNaN(price) || price < 0) {
        throw new Error(`Dòng ${i + 1}: Đơn giá nhập không được âm.`);
      }

      let freshProduct;
      try {
        const prodRes = await productApi.getById(item.productId);
        freshProduct = prodRes?.data;
      } catch {
        throw new Error(`Dòng ${i + 1}: Sản phẩm không tồn tại (ID: ${item.productId}).`);
      }

      if (!freshProduct) {
        throw new Error(`Dòng ${i + 1}: Sản phẩm không tồn tại.`);
      }

      validatedItems.push({
        ...item,
        quantity: qty,
        unitPrice: price,
        product: freshProduct,
      });
    }

    const outOfShiftFlag = isOutOfShift(currentSession);
    const reason = commonData.reason || INVENTORY_REASONS.PURCHASE;
    const rollbackSteps = [];

    try {
      // 2. Thực hiện tuần tự ghi nhận giao dịch, cập nhật tồn kho và tính giá vốn bình quân
      for (const valItem of validatedItems) {
        const product = valItem.product;
        const oldQty = Number(product.stockQuantity) || 0;
        const oldCost = Number(product.costPrice) || 0;
        const inQty = valItem.quantity;
        const inPrice = valItem.unitPrice;

        const newQty = oldQty + inQty;
        const newCost = calculateWeightedAverageCost(oldQty, oldCost, inQty, inPrice);

        // Tạo chuỗi ghi chú đầy đủ
        const noteParts = [];
        if (commonData.receiptCode) noteParts.push(`[Phiếu ${commonData.receiptCode}]`);
        if (commonData.supplier) noteParts.push(`NCC: ${commonData.supplier}`);
        if (commonData.note) noteParts.push(commonData.note);
        if (valItem.note) noteParts.push(valItem.note);
        const fullNote = noteParts.join(' ').trim();

        // 2a. Tạo transaction kho
        const txData = {
          id: generateId(),
          productId: valItem.productId,
          type: INVENTORY_TYPES.IN,
          reason,
          quantity: inQty,
          unitPrice: inPrice,
          accountId: currentUser.id,
          workSessionId: currentSession?.id || null,
          businessDate: getBusinessDate(),
          outOfShift: outOfShiftFlag,
          note: fullNote,
          createdAt: new Date().toISOString()
        };

        const txRes = await inventoryApi.createTransaction(txData, currentUser);
        const createdTx = txRes.data;
        rollbackSteps.push({ type: 'TRANSACTION', id: createdTx.id });

        // 2b. Cập nhật tồn kho
        await productApi.updateStock(valItem.productId, newQty, currentUser, {
          source: 'inventory_import',
          transactionId: createdTx.id
        });
        rollbackSteps.push({ type: 'STOCK_DELTA', productId: valItem.productId, delta: inQty, stock: oldQty });

        // 2c. Cập nhật giá vốn bình quân nếu là nhập mua hoặc tồn đầu
        if (reason === INVENTORY_REASONS.PURCHASE || reason === INVENTORY_REASONS.OPENING) {
          await productApi.patch(valItem.productId, { costPrice: newCost }, currentUser);
          rollbackSteps.push({ type: 'COST', productId: valItem.productId, costPrice: oldCost });
        }
      }

      // 3. Hoàn tất thành công: cập nhật lại cache dữ liệu
      await refreshProducts();
      return { success: true, count: validatedItems.length };
    } catch (error) {
      // Rollback toàn bộ các bước đã thực hiện
      for (let i = rollbackSteps.length - 1; i >= 0; i--) {
        const step = rollbackSteps[i];
        try {
          if (step.type === 'COST') {
            await productApi.patch(step.productId, { costPrice: step.costPrice }, currentUser);
          } else if (step.type === 'STOCK_DELTA') {
            await productApi.adjustStockDelta(step.productId, -step.delta, currentUser, {
              source: 'inventory_import'
            });
          } else if (step.type === 'STOCK') {
            await productApi.updateStock(step.productId, step.stock, currentUser, { source: 'inventory_import' });
          } else if (step.type === 'TRANSACTION') {
            await inventoryApi.removeTransaction(step.id, currentUser, { source: 'inventory_import' });
          }
        } catch (rbError) {
          console.error("Lỗi khi rollback import batch:", rbError);
        }
      }

      if (error?.code === 'PERMISSION_DENIED' || error?.cause?.code === 'PERMISSION_DENIED') {
        throw new Error("Bạn không có quyền nhập kho", { cause: error });
      }
      throw new Error(error?.message || "Có lỗi xảy ra khi nhập kho, đã hoàn tác dữ liệu.", { cause: error });
    }
  };

  /**
   * Xuất kho theo lô nhiều sản phẩm atomic (All-or-Nothing).
   * Kiểm tra tồn kho mới nhất trên database trước khi xuất.
   */
  const exportStockBatch = async (items = [], commonData = {}) => {
    assertAuthAndShift('xuất kho');

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Danh sách sản phẩm xuất không được để trống.");
    }

    // 1. Pre-validate toàn bộ danh sách và kiểm tra số lượng tồn kho mới nhất
    const validatedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty = Number(item.quantity);

      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Dòng ${i + 1}: Số lượng xuất phải lớn hơn 0.`);
      }

      let freshProduct;
      try {
        const prodRes = await productApi.getById(item.productId);
        freshProduct = prodRes?.data;
      } catch {
        throw new Error(`Dòng ${i + 1}: Sản phẩm không tồn tại (ID: ${item.productId}).`);
      }

      if (!freshProduct) {
        throw new Error(`Dòng ${i + 1}: Sản phẩm không tồn tại.`);
      }

      const valError = validateStock(qty, freshProduct.stockQuantity);
      if (valError) {
        throw new Error(`Sản phẩm "${freshProduct.name}": ${valError}`);
      }

      validatedItems.push({
        ...item,
        quantity: qty,
        product: freshProduct,
      });
    }

    const outOfShiftFlag = isOutOfShift(currentSession);
    
    // Map reason enum
    let exportReason = INVENTORY_REASONS.INTERNAL;
    if (commonData.reason === 'Hỏng hóc / Hết hạn' || commonData.reason === INVENTORY_REASONS.DAMAGE) {
      exportReason = INVENTORY_REASONS.DAMAGE;
    } else if (commonData.reason === INVENTORY_REASONS.ADJUST) {
      exportReason = INVENTORY_REASONS.ADJUST;
    }

    const rollbackSteps = [];

    try {
      // 2. Thực hiện tuần tự xuất kho
      for (const valItem of validatedItems) {
        const product = valItem.product;
        const oldQty = Number(product.stockQuantity) || 0;
        const exportQty = valItem.quantity;
        const newStock = oldQty - exportQty;

        // Tạo chuỗi ghi chú đầy đủ
        const noteParts = [];
        if (commonData.receiptCode) noteParts.push(`[Phiếu ${commonData.receiptCode}]`);
        if (commonData.reason) noteParts.push(`[Lý do: ${commonData.reason}]`);
        if (commonData.destination) noteParts.push(`[Kho xuất: Kho chính -> Nơi nhận: ${commonData.destination}]`);
        if (commonData.note) noteParts.push(commonData.note);
        if (valItem.note) noteParts.push(valItem.note);
        const fullNote = noteParts.join(' ').trim();

        // 2a. Tạo transaction kho OUT
        const txData = {
          id: generateId(),
          productId: valItem.productId,
          type: INVENTORY_TYPES.OUT,
          reason: exportReason,
          quantity: exportQty,
          unitPrice: product.costPrice || 0, // Dùng giá vốn làm đơn giá xuất
          accountId: currentUser.id,
          workSessionId: currentSession?.id || null,
          businessDate: getBusinessDate(),
          outOfShift: outOfShiftFlag,
          note: fullNote,
          createdAt: new Date().toISOString()
        };

        const txRes = await inventoryApi.createTransaction(txData, currentUser);
        const createdTx = txRes.data;
        rollbackSteps.push({ type: 'TRANSACTION', id: createdTx.id });

        // 2b. Cập nhật tồn kho
        await productApi.updateStock(valItem.productId, newStock, currentUser, {
          source: 'inventory_export',
          transactionId: createdTx.id
        });
        rollbackSteps.push({ type: 'STOCK_DELTA', productId: valItem.productId, delta: exportQty, stock: oldQty });
      }

      // 3. Hoàn tất thành công: cập nhật lại cache
      await refreshProducts();
      return { success: true, count: validatedItems.length };
    } catch (error) {
      // Rollback toàn bộ các bước đã thực hiện
      for (let i = rollbackSteps.length - 1; i >= 0; i--) {
        const step = rollbackSteps[i];
        try {
          if (step.type === 'STOCK_DELTA') {
            await productApi.adjustStockDelta(step.productId, +step.delta, currentUser, {
              source: 'inventory_export'
            });
          } else if (step.type === 'STOCK') {
            await productApi.updateStock(step.productId, step.stock, currentUser, { source: 'inventory_export' });
          } else if (step.type === 'TRANSACTION') {
            await inventoryApi.removeTransaction(step.id, currentUser, { source: 'inventory_export' });
          }
        } catch (rbError) {
          console.error("Lỗi khi rollback export batch:", rbError);
        }
      }

      if (error?.code === 'PERMISSION_DENIED' || error?.cause?.code === 'PERMISSION_DENIED') {
        throw new Error("Bạn không có quyền xuất kho", { cause: error });
      }
      throw new Error(error?.message || "Có lỗi xảy ra khi xuất kho, đã hoàn tác dữ liệu.", { cause: error });
    }
  };

  // Helper single item import
  const importStock = async (productId, quantity, unitPrice, note) => {
    return importStockBatch([{ productId, quantity, unitPrice, note }]);
  };

  // Helper single item export
  const exportStock = async (productId, quantity, note) => {
    return exportStockBatch([{ productId, quantity, note }]);
  };

  return { importStock, exportStock, importStockBatch, exportStockBatch };
};
