/**
 * costing.js
 * Utility functions for inventory costing calculations (Mini-Shop).
 * Implements weighted average cost calculation (Giá vốn bình quân gia quyền).
 */

/**
 * Tính giá vốn bình quân gia quyền khi nhập hàng (PURCHASE hoặc OPENING).
 * Công thức chuẩn:
 * costPrice' = (oldQty * oldCost + inQty * inPrice) / (oldQty + inQty)
 * 
 * @param {number} oldQty - Số lượng tồn kho hiện tại (trước khi nhập)
 * @param {number} oldCost - Giá vốn hiện tại của sản phẩm
 * @param {number} inQty - Số lượng nhập mới
 * @param {number} inPrice - Đơn giá nhập mới của lô hàng
 * @returns {number} Giá vốn bình quân mới (đã làm tròn số nguyên gần nhất)
 */
export function calculateWeightedAverageCost(oldQty = 0, oldCost = 0, inQty = 0, inPrice = 0) {
  const currentQty = Math.max(0, Number(oldQty) || 0);
  const currentCost = Math.max(0, Number(oldCost) || 0);
  const incomingQty = Math.max(0, Number(inQty) || 0);
  const incomingPrice = Math.max(0, Number(inPrice) || 0);

  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) {
    return incomingPrice || currentCost || 0;
  }

  // Nếu trước đó chưa có tồn kho, giá vốn chính là giá của lần nhập này
  if (currentQty === 0) {
    return Math.round(incomingPrice);
  }

  const totalValue = (currentQty * currentCost) + (incomingQty * incomingPrice);
  return Math.round(totalValue / totalQty);
}
