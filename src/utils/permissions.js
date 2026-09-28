export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  EMPLOYEE: 'employee',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Quản trị viên',
  [ROLES.STAFF]: 'Staff (Quản lý cửa hàng)',
  [ROLES.EMPLOYEE]: 'Nhân viên',
};

export const PERMISSIONS = {
  // Sản phẩm
  PRODUCT_VIEW: 'product.view',
  PRODUCT_MANAGE: 'product.manage',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',

  // Danh mục
  CATEGORY_VIEW: 'category.view',
  CATEGORY_MANAGE: 'category.manage',
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_DELETE: 'category.delete',

  // Tồn kho
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_IMPORT: 'inventory.import',
  INVENTORY_EXPORT: 'inventory.export',
  INVENTORY_ADJUST: 'inventory.adjust',

  // Đơn hàng & Giao dịch
  ORDER_VIEW: 'order.view',
  ORDER_CREATE: 'order.create',
  ORDER_CANCEL: 'order.cancel',
  ORDER_CANCEL_MANAGEMENT: 'order.cancel_management',
  TRANSACTION_VIEW_ALL: 'transaction.view_all',

  // Quản lý Nhân sự (con người)
  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_MANAGE: 'employee.manage',

  // Ca làm việc
  WORK_SESSION_VIEW: 'workSession.view',
  WORK_SESSION_MANAGE: 'workSession.manage',

  // Quản trị Hệ thống Tài khoản & Phân quyền (Chỉ ADMIN)
  ACCOUNT_VIEW: 'account.view',
  ACCOUNT_MANAGE: 'account.manage',
  ACCOUNT_CREATE: 'account.create',
  ACCOUNT_UPDATE: 'account.update',
  ACCOUNT_DELETE: 'account.delete',

  PERMISSION_VIEW: 'permission.view',
  PERMISSION_MANAGE: 'permission.manage',

  // Báo cáo & Kiểm toán
  REPORT_VIEW: 'report.view',
  ACTIVITY_LOG_VIEW: 'activityLog.view',
};

// BẢNG QUYỀN MẶC ĐỊNH CHO TỪNG ROLE

export const ROLE_DEFAULT_PERMISSIONS = {
  // 1. ADMIN: Toàn quyền hệ thống (xử lý đặc biệt trong hasPermission)
  [ROLES.ADMIN]: Object.values(PERMISSIONS),

  // 2. STAFF: Cấp quản lý/vận hành cửa hàng
  // Có toàn bộ quyền nghiệp vụ cửa hàng, nhưng KHÔNG CÓ account.*, permission.*, và không xóa vĩnh viễn
  [ROLES.STAFF]: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_MANAGE,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,

    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_UPDATE,

    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_IMPORT,
    PERMISSIONS.INVENTORY_EXPORT,
    PERMISSIONS.INVENTORY_ADJUST,

    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_CANCEL_MANAGEMENT,
    PERMISSIONS.TRANSACTION_VIEW_ALL,

    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_MANAGE,

    PERMISSIONS.WORK_SESSION_VIEW,
    PERMISSIONS.WORK_SESSION_MANAGE,

    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.ACTIVITY_LOG_VIEW,
  ],

  // 3. EMPLOYEE: Nhân viên trực tiếp vận hành bán hàng
  // Chỉ có quyền xem sản phẩm/danh mục/tồn kho và tạo đơn bán hàng
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.INVENTORY_VIEW,

    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_CANCEL, // hủy đơn cá nhân tuân thủ nghiêm ngặt quy tắc 15 phút

    PERMISSIONS.WORK_SESSION_VIEW,
  ],
};

/**
 * Kiểm tra xem actor có quyền `key` hay không dựa trên:
 * 1. Role ADMIN luôn trả về true (Full Access)
 * 2. Quyền mặc định theo Role (ROLE_DEFAULT_PERMISSIONS)
 * 3. Quyền được cấp riêng cho Account trong mảng actor.permissions
 *
 * @param {Object} actor - User object ({ role, permissions: [] })
 * @param {string} key - Permission key
 * @returns {boolean}
 */
export const hasPermission = (actor, key) => {
  if (!actor || !key) return false;

  // Tài khoản bị vô hiệu hóa (deactivated/inactive) không có bất kỳ quyền nào
  if (actor.isActive === false || actor.staffInfo?.isActive === false) {
    return false;
  }

  // Quyền không tồn tại trong hệ thống (unknown/invalid permission) luôn trả về false
  if (!Object.values(PERMISSIONS).includes(key)) {
    return false;
  }

  // Kiểm tra quyền bị thu hồi riêng (deniedPermissions) nếu có
  if (Array.isArray(actor.deniedPermissions) && actor.deniedPermissions.includes(key)) {
    return false;
  }

  const role = String(actor.role || '').trim().toLowerCase();

  // Admin có toàn quyền hệ thống (đối với các quyền hợp lệ trong hệ thống)
  if (role === ROLES.ADMIN) return true;

  // Kiểm tra quyền mặc định của Role (Trần quyền - Role Ceiling)
  const rolePermissions = ROLE_DEFAULT_PERMISSIONS[role] || [];
  if (!rolePermissions.includes(key)) {
    return false; // Trần role: không thể cấp thêm quyền ngoài bảng quyền mặc định của vai trò
  }

  return true;
};

/**
 * Xác thực quyền của actor đối với thao tác `key`.
 * Ném lỗi PERMISSION_DENIED nếu actor không có quyền.
 *
 * @param {Object} actor - User object
 * @param {string} key - Permission key
 * @throws {Error} PERMISSION_DENIED
 */
export const assertPermission = (actor, key) => {
  if (!actor) {
    const err = new Error('NOT_AUTHENTICATED');
    err.code = 'NOT_AUTHENTICATED';
    throw err;
  }

  if (actor.isActive === false || actor.staffInfo?.isActive === false) {
    const err = new Error('ACCOUNT_INACTIVE: Tài khoản đã bị vô hiệu hóa.');
    err.code = 'ACCOUNT_INACTIVE';
    throw err;
  }

  if (!hasPermission(actor, key)) {
    const err = new Error(`PERMISSION_DENIED: Cần quyền "${key}" để thực hiện thao tác này.`);
    err.code = 'PERMISSION_DENIED';
    err.requiredPermission = key;
    throw err;
  }
};

