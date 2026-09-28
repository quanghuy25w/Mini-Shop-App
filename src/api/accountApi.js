import axiosClient from './axiosClient';
import { assertPermission, PERMISSIONS } from '../utils/permissions';
import bcrypt from 'bcryptjs';

export const accountApi = {
  getAll: (params = {}, actor) => {
    if (actor) {
      assertPermission(actor, PERMISSIONS.ACCOUNT_VIEW);
    }
    let query = '';
    const searchParams = new URLSearchParams();
    if (params.role) searchParams.append('role', params.role);
    if (params.email) searchParams.append('email', params.email);
    if (params.employeeId) searchParams.append('employeeId', params.employeeId);
    if (typeof params.isActive === 'boolean') searchParams.append('isActive', params.isActive);
    const queryString = searchParams.toString();
    if (queryString) query = `?${queryString}`;
    return axiosClient.get(`/accounts${query}`);
  },
  getById: (id, actor) => {
    if (actor && String(actor.id) !== String(id)) {
      assertPermission(actor, PERMISSIONS.ACCOUNT_VIEW);
    }
    return axiosClient.get(`/accounts/${id}`);
  },
  getByEmail: (email) => axiosClient.get(`/accounts?email=${encodeURIComponent(email)}`),
  getByEmployeeId: (employeeId) => axiosClient.get(`/accounts?employeeId=${employeeId}`),

  hasAdmin: async () => {
    const res = await axiosClient.get('/accounts?role=admin');
    const admins = Array.isArray(res.data) ? res.data : [];
    return admins.length > 0;
  },

  create: (data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.ACCOUNT_CREATE);
    }
    const payload = { ...data };
    if (payload.password && !payload.password.startsWith('$2')) {
      payload.password = bcrypt.hashSync(payload.password, 10);
    }
    if (payload.pin && !String(payload.pin).startsWith('$2')) {
      payload.pin = bcrypt.hashSync(String(payload.pin), 10);
    }
    return axiosClient.post('/accounts', payload);
  },
  update: (id, data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.ACCOUNT_UPDATE);
      if (actor.role !== 'admin' && (data.role !== undefined || data.permissions !== undefined)) {
        const err = new Error('PERMISSION_DENIED: Chỉ quản trị viên mới có thể thay đổi vai trò hoặc quyền.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
    }
    return axiosClient.put(`/accounts/${id}`, data);
  },
  patch: (id, data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.ACCOUNT_UPDATE);
      if (actor.role !== 'admin' && (data.role !== undefined || data.permissions !== undefined)) {
        const err = new Error('PERMISSION_DENIED: Chỉ quản trị viên mới có thể thay đổi vai trò hoặc quyền.');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
    }
    const payload = { ...data };
    if (payload.password && !payload.password.startsWith('$2')) {
      payload.password = bcrypt.hashSync(payload.password, 10);
    }
    if (payload.pin && !payload.pin.startsWith('$2')) {
      payload.pin = bcrypt.hashSync(String(payload.pin), 10);
    }
    return axiosClient.patch(`/accounts/${id}`, payload);
  },
  
  updatePin: (id, pin, actor) => {
    if (actor !== undefined) {
      if (!actor || String(actor.id) !== String(id)) {
        assertPermission(actor, PERMISSIONS.ACCOUNT_UPDATE);
      }
    }
    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return Promise.reject(new Error('Mã PIN phải đúng 6 chữ số'));
    }
    const hashedPin = bcrypt.hashSync(String(pin), 10);
    return axiosClient.patch(`/accounts/${id}`, {
      pin: hashedPin,
      updatedAt: new Date().toISOString()
    });
  },

  updatePassword: (id, password, actor) => {
    if (actor !== undefined) {
      if (!actor || String(actor.id) !== String(id)) {
        assertPermission(actor, PERMISSIONS.ACCOUNT_UPDATE);
      }
    }
    if (!password || String(password).trim().length < 6) {
      return Promise.reject(new Error('Mật khẩu phải có ít nhất 6 ký tự'));
    }
    const hashedPassword = bcrypt.hashSync(String(password), 10);
    return axiosClient.patch(`/accounts/${id}`, {
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });
  },

  updateStatus: (id, isActive, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.ACCOUNT_UPDATE);
    }
    return axiosClient.patch(`/accounts/${id}`, {
      isActive,
      updatedAt: new Date().toISOString()
    });
  },

  remove: (id, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.ACCOUNT_DELETE);
    }
    return axiosClient.delete(`/accounts/${id}`);
  }
};

