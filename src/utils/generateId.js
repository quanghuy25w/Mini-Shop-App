import { v4 as uuidv4 } from 'uuid';

/**
 * Sinh chuỗi ID độc nhất (UUID v4)
 * @returns {string} Chuỗi UUID
 */
export const generateId = () => {
  return uuidv4();
};
