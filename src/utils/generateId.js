import { v4 as uuidv4 } from 'uuid';

/**
 * @returns {string} Chuỗi UUID
 */
export const generateId = () => {
  return uuidv4();
};
