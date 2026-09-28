import { describe, it, expect } from 'vitest';
import { registerApi } from '../api/registerApi';

describe('registerApi', () => {
  it('loads registers from the API successfully', async () => {
    const data = await registerApi.getAll();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(3);
    
    // Verify properties of the first register
    const firstReg = data[0];
    expect(firstReg.id).toBe('POS01');
    expect(firstReg.code).toBe('Q01');
    expect(firstReg.name).toBe('Quầy 01');
    expect(firstReg.description).toBe('Máy POS 01');
    expect(firstReg.isActive).toBe(true);
  });
});
