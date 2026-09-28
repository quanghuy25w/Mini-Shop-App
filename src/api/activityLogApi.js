import axiosClient from './axiosClient';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

export const activityLogApi = {
  getAll: (filters = {}, actor) => {
    if (actor) {
      if (!hasPermission(actor, PERMISSIONS.ACTIVITY_LOG_VIEW)) {
        if (!filters.actorId || String(filters.actorId) !== String(actor.id)) {
          const err = new Error('PERMISSION_DENIED: Cần quyền "activityLog.view" để xem toàn bộ nhật ký hoạt động.');
          err.code = 'PERMISSION_DENIED';
          err.requiredPermission = PERMISSIONS.ACTIVITY_LOG_VIEW;
          throw err;
        }
      }
    }
    let query = '?';
    if (filters.action) query += `action=${filters.action}&`;
    if (filters.entityType) query += `entityType=${filters.entityType}&`;
    if (filters.actorId) query += `actorId=${filters.actorId}&`;
    return axiosClient.get(`/activityLogs${query}`);
  },
  create: (data) => axiosClient.post('/activityLogs', data),
};
