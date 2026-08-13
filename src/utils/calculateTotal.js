/**
 * Tính tổng tiền giao dịch kho (nhập/xuất kho)
 * @param {number|string} quantity Số lượng
 * @param {number|string} unitPrice Đơn giá
 * @returns {number} Tổng tiền (quantity * unitPrice), trả về 0 nếu không hợp lệ
 */
export const calculateTotalAmount = (quantity, unitPrice) => {
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (isNaN(q) || q <= 0 || isNaN(p) || p < 0) return 0;
  return q * p;
};
