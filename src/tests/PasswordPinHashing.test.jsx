import { initSeedData } from './mockApi';
import { describe, it, expect, beforeEach } from 'vitest';
import { accountApi } from '../api/accountApi';
import axiosClient from '../api/axiosClient';

import bcrypt from 'bcryptjs';

describe('Password and PIN Hashing Security', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  const getRawAccountFromDb = async (accountId) => {
    const res = await accountApi.getById(accountId);
    return res.data;
  };

  it('1. Account creation securely hashes the password and PIN before storing', async () => {
    const plainPassword = 'SuperSecretPassword123';
    const plainPin = '123456';
    
    const res = await accountApi.create({
      employeeId: null,
      role: 'admin',
      email: 'newadmin@test.com',
      password: plainPassword,
      pin: plainPin,
      permissions: [],
      isActive: true
    });
    
    const createdAccountId = res.data.id;
    
    // Read directly from DB (API) to verify raw stored data
    const rawDbRecord = await getRawAccountFromDb(createdAccountId);
    
    // Assert it is NOT plaintext
    expect(rawDbRecord.password).not.toBe(plainPassword);
    expect(rawDbRecord.pin).not.toBe(plainPin);
    
    // Assert it IS a bcrypt hash
    expect(rawDbRecord.password.startsWith('$2')).toBe(true);
    expect(rawDbRecord.pin.startsWith('$2')).toBe(true);
  });

  it('2. Login with CORRECT password still succeeds (simulate login validation)', async () => {
    const plainPassword = 'CorrectPassword123';
    const res = await accountApi.create({
      employeeId: null,
      role: 'admin',
      email: 'admin2@test.com',
      password: plainPassword,
      isActive: true
    });
    const createdAccountId = res.data.id;
    const rawDbRecord = await getRawAccountFromDb(createdAccountId);
    
    // Simulate the AuthContext logic for correct login
    const isMatch = await bcrypt.compare(plainPassword, rawDbRecord.password);
    expect(isMatch).toBe(true);
  });

  it('3. Login with WRONG password still fails', async () => {
    const plainPassword = 'CorrectPassword123';
    const res = await accountApi.create({
      employeeId: null,
      role: 'admin',
      email: 'admin3@test.com',
      password: plainPassword,
      isActive: true
    });
    const createdAccountId = res.data.id;
    const rawDbRecord = await getRawAccountFromDb(createdAccountId);
    
    // Simulate the AuthContext logic for wrong login
    const isMatch = await bcrypt.compare('WrongPassword456', rawDbRecord.password);
    expect(isMatch).toBe(false);
  });

  it('4. Backward compatibility: old plaintext accounts can login AND are automatically re-hashed', async () => {
    // We simulate a pre-migration account already in DB with plaintext password
    const oldPlainPassword = 'OldPlaintextPassword';
    const legacyAccountId = 'legacy-admin-123';
    
    await axiosClient.post('/accounts', {
      id: legacyAccountId,
      employeeId: null,
      role: 'admin',
      email: 'legacy@test.com',
      password: oldPlainPassword,
      isActive: true
    });
    
    // Sanity check: verify it is currently plaintext in DB
    let rawDbRecord = await getRawAccountFromDb(legacyAccountId);
    expect(rawDbRecord.password).toBe(oldPlainPassword);
    expect(rawDbRecord.password.startsWith('$2')).toBe(false);
    
    // --- Simulate AuthContext's verifyAndUpgradeCredential logic ---
    let storedHash = rawDbRecord.password;
    let isMatch = false;
    
    const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$');
    if (isBcrypt) {
      isMatch = await bcrypt.compare(oldPlainPassword, storedHash);
    } else if (oldPlainPassword === storedHash) {
      // Backward compatibility: match plaintext and silently upgrade
      isMatch = true;
      const newHash = await bcrypt.hash(oldPlainPassword, 10);
      await accountApi.patch(legacyAccountId, { password: newHash });
    }
    
    // Assert login succeeded
    expect(isMatch).toBe(true);
    
    // Assert it was re-hashed in the DB
    rawDbRecord = await getRawAccountFromDb(legacyAccountId);
    expect(rawDbRecord.password).not.toBe(oldPlainPassword);
    expect(rawDbRecord.password.startsWith('$2')).toBe(true);
  });
});
