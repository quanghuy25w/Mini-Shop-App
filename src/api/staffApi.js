import axiosClient from './axiosClient';
import { assertPermission, PERMISSIONS } from '../utils/permissions';

export const staffApi = {
  getAll: (params = {}) => {
    let query = '';
    const searchParams = new URLSearchParams();
    if (params.employeeCode) searchParams.append('employeeCode', params.employeeCode);
    if (params.name) searchParams.append('name', params.name);
    if (params.employmentStatus) searchParams.append('employmentStatus', params.employmentStatus);
    if (typeof params.isActive === 'boolean') searchParams.append('isActive', params.isActive);
    const queryString = searchParams.toString();
    if (queryString) query = `?${queryString}`;
    return axiosClient.get(`/staff${query}`);
  },
  getById: (id) => axiosClient.get(`/staff/${id}`),
  getByCode: (code) => axiosClient.get(`/staff?employeeCode=${code}`),
  create: (data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.EMPLOYEE_MANAGE);
    }
    return axiosClient.post('/staff', data);
  },
  update: (id, data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.EMPLOYEE_MANAGE);
    }
    return axiosClient.put(`/staff/${id}`, data);
  },
  patch: (id, data, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.EMPLOYEE_MANAGE);
    }
    return axiosClient.patch(`/staff/${id}`, data);
  },
  softDelete: (id, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.EMPLOYEE_MANAGE);
    }
    return axiosClient.patch(`/staff/${id}`, { isActive: false, employmentStatus: 'resigned', updatedAt: new Date().toISOString() });
  },
  updateStatus: (id, { employmentStatus, isActive }, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.EMPLOYEE_MANAGE);
    }
    const payload = { updatedAt: new Date().toISOString() };
    if (employmentStatus !== undefined) payload.employmentStatus = employmentStatus;
    if (isActive !== undefined) payload.isActive = isActive;
    return axiosClient.patch(`/staff/${id}`, payload);
  },
  remove: (id, actor) => {
    if (actor !== undefined) {
      assertPermission(actor, PERMISSIONS.EMPLOYEE_MANAGE);
    }
    return axiosClient.delete(`/staff/${id}`);
  },

  generateEmployeeCode: async () => {
    const res = await axiosClient.get('/staff');
    const staffList = Array.isArray(res.data) ? res.data : [];

    let maxNum = 0;
    staffList.forEach(s => {
      if (s.employeeCode && s.employeeCode.startsWith('NV')) {
        const num = parseInt(s.employeeCode.replace('NV', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateNum = maxNum + 1 + attempt;
      const candidateCode = `NV${candidateNum.toString().padStart(3, '0')}`;
      const checkRes = await axiosClient.get(`/staff?employeeCode=${candidateCode}`);
      if (checkRes.data.length === 0) {
        return candidateCode;
      }
    }
    throw new Error('Không thể tạo mã nhân viên duy nhất, vui lòng thử lại.');
  }
};
