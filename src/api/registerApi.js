import axiosClient from './axiosClient';
import dbData from '../../db.json';

let _cachedRegisters = Array.isArray(dbData?.registers) ? [...dbData.registers] : [];

export const registerApi = {
  getAll: async () => {
    try {
      const res = await axiosClient.get('/registers');
      const data = res?.data !== undefined ? res.data : res;
      if (Array.isArray(data)) {
        _cachedRegisters = data;
      }
      return data;
    } catch {
      return _cachedRegisters;
    }
  },
  getSyncRegisters: () => _cachedRegisters,
  setCachedRegisters: (regs) => { _cachedRegisters = regs; }
};
