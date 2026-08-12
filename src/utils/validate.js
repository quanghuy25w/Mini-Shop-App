export const validateStock = (quantity, stockQuantity) => {
  if (quantity === undefined || quantity === null) return "Số lượng không hợp lệ";
  if (typeof quantity !== 'number' || isNaN(quantity)) return "Số lượng phải là số";
  if (quantity <= 0) return "Số lượng phải lớn hơn 0";
  if (quantity > stockQuantity) return `Không thể xuất ${quantity} sản phẩm vì tồn kho hiện tại chỉ còn ${stockQuantity}`;
  return null; // Hợp lệ
};
