 import { activityLogApi } from '../api/activityLogApi';
import { generateId } from './generateId';

export const ACTIVITY_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_DEACTIVATED: 'EMPLOYEE_DEACTIVATED',
  PERMISSION_CHANGED: 'PERMISSION_CHANGED',
  PIN_CHANGED: 'PIN_CHANGED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PRODUCT_CREATE: 'CREATE',
  PRODUCT_UPDATE: 'UPDATE',
  PRODUCT_DEACTIVATE: 'DEACTIVATE',
  CATEGORY_CREATE: 'CREATE',
  CATEGORY_UPDATE: 'UPDATE',
  CATEGORY_DEACTIVATE: 'DEACTIVATE',
  INVENTORY_IMPORT: 'IMPORT',
  INVENTORY_EXPORT: 'EXPORT',
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  SESSION_CLOSED: 'SESSION_CLOSED',
};

export const logActivity = ({ actor, action, entityType, entityId = null, workSessionId = null, metadata = null }) => {
  try {
    const res = activityLogApi.create({
      id: generateId(),
      actorId: actor?.id || null,
      actorRole: actor?.role || null,
      action,
      entityType,
      entityId,
      workSessionId,
      timestamp: new Date().toISOString(),
      metadata,
    });
    if (res && res.catch) res.catch(err => console.error('[ActivityLog] Error:', action, err));
  } catch (e) {
    console.error('[ActivityLog] Error:', action, e);
  }
};