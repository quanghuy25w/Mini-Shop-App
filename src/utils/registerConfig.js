/**
 * registerConfig.js
 *
 * Nguồn sự thật duy nhất (Single Source of Truth) cho cấu hình POS/Quầy bán hàng.
 *
 * CÁCH SỬ DỤNG cho môi trường demo/localStorage/Vercel:
 *  - Mỗi máy POS được phân biệt qua localStorage key `minishop_current_register_id`.
 *  - Để chuyển máy: gọi setCurrentRegisterId('POS02') hoặc sửa thẳng trong
 *    localStorage, rồi reload trang.
 *  - Không hard-code ID quầy ở bất kỳ file nào khác. Luôn gọi getCurrentRegisterId().
 *
 * QUAN TRỌNG:
 *  - Nếu không tìm thấy cấu hình -> ném lỗi rõ ràng, KHÔNG âm thầm fallback sang quầy khác.
 *  - isActive: false -> không cho checkout.
 */

/**
 * registerConfig.js
 *
 * Device-local state for POS terminal identification.
 * The actual list of valid registers comes from db.json via registerApi.
 */

const REGISTER_STORAGE_KEY = 'minishop_current_register_id';

export function getCurrentRegisterId() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem(REGISTER_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  }
  return null;
}

export function setCurrentRegisterId(registerId) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (registerId) {
      localStorage.setItem(REGISTER_STORAGE_KEY, registerId);
    } else {
      localStorage.removeItem(REGISTER_STORAGE_KEY);
    }
  }
}

