import { describe, it, expect, beforeEach } from 'vitest';
import axiosClient from '../api/axiosClient';
import { workSessionApi } from '../api/workSessionApi';
import { inventoryApi } from '../api/inventoryApi';
import { initSeedData } from './mockApi';

describe('Server DELETE Protection & Historical Data Integrity Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('1. Raw DELETE /workSessions/:id rejects with HTTP 403 and Vietnamese error message', async () => {
    // Setup a session
    await workSessionApi.create({
      id: 'ws-protect-001',
      code: 'CA-TEST-001',
      date: '2026-09-01',
      shiftType: 'morning',
      name: 'Ca Kiá»ƒm Thá»­',
      status: 'active',
      initialCash: 1000000,
    });

    let caughtError = null;
    try {
      await axiosClient.delete('/workSessions/ws-protect-001');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.response?.status).toBe(403);
    expect(caughtError.response?.data?.error).toBe('WORKSESSION_DELETION_RESTRICTED');
    expect(caughtError.message).toMatch(/KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);
  });

  it('2. Raw DELETE /workSessionMembers/:id rejects with HTTP 403 and Vietnamese error message', async () => {
    let caughtError = null;
    try {
      await axiosClient.delete('/workSessionMembers/wsm-protect-001');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.response?.status).toBe(403);
    expect(caughtError.response?.data?.error).toBe('WORKSESSION_MEMBER_DELETION_RESTRICTED');
    expect(caughtError.message).toMatch(/WORKSESSION_MEMBER_DELETION_RESTRICTED|KHÃ”NG ÄÆ¯á»¢C PHÃ‰P XÃ“A/i);
  });

  it('3. Attempted DELETE does not remove the workSession record from database', async () => {
    await workSessionApi.create({
      id: 'ws-retain-001',
      code: 'CA-RETAIN-01',
      date: '2026-09-02',
      shiftType: 'morning',
      name: 'Ca Giá»¯ NguyÃªn',
      status: 'active',
      initialCash: 500000,
    });

    try {
      await axiosClient.delete('/workSessions/ws-retain-001');
    } catch {
      // Expected rejection
    }

    const sessionRes = await workSessionApi.getById('ws-retain-001');
    expect(sessionRes.data).toBeDefined();
    expect(sessionRes.data.id).toBe('ws-retain-001');
    expect(sessionRes.data.name).toBe('Ca Giá»¯ NguyÃªn');
  });

  it('4. Existing GET, POST, and PATCH operations on workSessions remain fully functional', async () => {
    // POST
    const createdRes = await workSessionApi.create({
      id: 'ws-crud-001',
      code: 'CA-CRUD-01',
      date: '2026-09-03',
      shiftType: 'afternoon',
      name: 'Ca Thá»­ Nghiá»‡m CRUD',
      status: 'planned',
      initialCash: 2000000,
    });
    expect(createdRes.data.id).toBe('ws-crud-001');

    // GET
    const fetchedRes = await workSessionApi.getById('ws-crud-001');
    expect(fetchedRes.data.initialCash).toBe(2000000);

    // PATCH
    const patchedRes = await workSessionApi.patch('ws-crud-001', {
      note: 'Ghi chÃº cáº­p nháº­t',
      status: 'active',
    });
    expect(patchedRes.data.status).toBe('active');
    expect(patchedRes.data.note).toBe('Ghi chÃº cáº­p nháº­t');
  });

  it('5. Existing allowed DELETE routes (e.g. inventoryTransactions) remain functional', async () => {
    const txData = {
      id: 'tx-allowed-delete-01',
      productId: 'p0000000-0000-0000-0000-000000000001',
      type: 'OUT',
      quantity: 1,
      unitPrice: 10000,
    };
    await inventoryApi.createTransaction(txData);

    // Allowed deletion of in-flight transaction
    const deleteRes = await inventoryApi.removeTransaction('tx-allowed-delete-01', { id: 'acc-admin', role: 'admin' });
    expect(deleteRes.status === 200 || deleteRes.data !== undefined).toBe(true);

    const allTx = (await inventoryApi.getAllTransactions()).data;
    expect(allTx.some((t) => t.id === 'tx-allowed-delete-01')).toBe(false);
  });
});
