export const validateStock = (quantity, stockQuantity) => {
  if (quantity === undefined || quantity === null) return "Số lượng không hợp lệ";
  if (typeof quantity !== 'number' || isNaN(quantity)) return "Số lượng phải là số";
  if (quantity <= 0) return "Số lượng phải lớn hơn 0";
  if (quantity > stockQuantity) return `Không thể xuất ${quantity} sản phẩm vì tồn kho hiện tại chỉ còn ${stockQuantity}`;
  return null; // Hợp lệ
};

export const validatePin = (pin) => {
  if (!pin && pin !== 0) return "Mã PIN không được để trống";
  const pinStr = String(pin).trim();
  if (!/^\d{6}$/.test(pinStr)) return "Mã PIN bắt buộc phải đúng 6 chữ số";
  return null; // Hợp lệ
};

export const validateEmail = (email) => {
  if (!email || !String(email).trim()) return "Email không được để trống";
  const emailStr = String(email).trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailStr)) return "Email không đúng định dạng";
  return null; // Hợp lệ
};

export const validatePassword = (password) => {
  if (!password) return "Mật khẩu không được để trống";
  if (String(password).length < 6) return "Mật khẩu phải có ít nhất 6 ký tự";
  return null; // Hợp lệ
};

