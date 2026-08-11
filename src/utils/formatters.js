/**
 * Formats a numeric amount into Vietnamese Dong currency string.
 * Example: 35000 -> "35.000 đ"
 *
 * @param {number|string} amount
 * @returns {string} Formatted VND currency string
 */
export const formatVND = (amount) => {
  const num = Number(amount);
  if (isNaN(num)) return '0 đ';
  return `${new Intl.NumberFormat('vi-VN').format(num)} đ`;
};

/**
 * Formats an ISO date timestamp string into a readable local Vietnamese date-time string.
 * Example: "2026-08-01T08:00:00.000Z" -> "01/08/2026, 15:00"
 *
 * @param {string} isoString
 * @returns {string} Formatted local date-time string
 */
export const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
