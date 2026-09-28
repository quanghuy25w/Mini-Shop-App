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

export const REGISTERS = [
  {
    id: 'POS01',
    code: 'Q01',
    name: 'Quầy 01',
    deviceName: 'Máy POS 01',
    isActive: true,
  },
  {
    id: 'POS02',
    code: 'Q02',
    name: 'Quầy 02',
    deviceName: 'Máy POS 02',
    isActive: true,
  },
  {
    id: 'POS03',
    code: 'Q03',
    name: 'Quầy 03',
    deviceName: 'Máy POS 03',
    isActive: true,
  },
];

/** localStorage key lưu ID quầy hiện tại của máy này */
const REGISTER_STORAGE_KEY = 'minishop_current_register_id';

/** ID quầy mặc định khi máy chưa được cấu hình */
const DEFAULT_REGISTER_ID = 'POS01';

/**
 * Lấy ID quầy hiện tại của máy POS này.
 * Đọc từ localStorage; nếu chưa có thì dùng DEFAULT_REGISTER_ID.
 * @returns {string} registerId, ví dụ 'POS01'
 */
export function getCurrentRegisterId() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem(REGISTER_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  }
  return DEFAULT_REGISTER_ID;
}

/**
 * Đặt ID quầy cho máy POS này.
 * @param {string} registerId - Một trong 'POS01' | 'POS02' | 'POS03'
 * @throws {Error} nếu registerId không hợp lệ
 */
export function setCurrentRegisterId(registerId) {
  const reg = REGISTERS.find(r => r.id === registerId);
  if (!reg) {
    throw new Error(`INVALID_REGISTER: Không tồn tại quầy bán hàng với ID "${registerId}".`);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(REGISTER_STORAGE_KEY, registerId);
  }
}

/**
 * Lấy thông tin đầy đủ của quầy hiện tại.
 * @returns {{ id, code, name, deviceName, isActive }}
 * @throws {Error} nếu không xác định được quầy hoặc quầy bị vô hiệu
 */
export function getCurrentRegister() {
  const id = getCurrentRegisterId();
  const reg = REGISTERS.find(r => r.id === id);
  if (!reg) {
    const err = new Error(
      `REGISTER_NOT_FOUND: Không tìm thấy cấu hình quầy bán hàng với ID "${id}". ` +
      `Vui lòng kiểm tra cài đặt POS hoặc liên hệ quản trị viên.`
    );
    err.code = 'REGISTER_NOT_FOUND';
    throw err;
  }
  return reg;
}

/**
 * Kiểm tra quầy hiện tại có thể hoạt động không.
 * Ném lỗi nếu không xác định được hoặc quầy bị inactive.
 * @returns {{ id, code, name, deviceName, isActive }}
 */
export function assertCurrentRegister() {
  const reg = getCurrentRegister(); // ném nếu không tìm thấy
  if (!reg.isActive) {
    const err = new Error(
      `REGISTER_INACTIVE: Quầy bán hàng "${reg.name}" (${reg.id}) đang bị vô hiệu hóa. ` +
      `Không thể thực hiện giao dịch. Vui lòng liên hệ quản trị viên.`
    );
    err.code = 'REGISTER_INACTIVE';
    err.registerId = reg.id;
    throw err;
  }
  return reg;
}
