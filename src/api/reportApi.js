/**
 * reportApi.js
 * Asynchronous reporting and audit API service.
 * Fetches underlying WorkSessions, Members, Orders, Inventory Transactions, and Activity Logs,
 * enforces role-based data isolation (Admin/Staff/Employee), and returns derived reports.
 * DOES NOT mutate any historical data.
 */

import { workSessionApi } from './workSessionApi';
import { orderApi } from './orderApi';
import { inventoryApi } from './inventoryApi';
import { activityLogApi } from './activityLogApi';
import { staffApi } from './staffApi';
import { accountApi } from './accountApi';
import { registerApi } from './registerApi';
import { productApi } from './productApi';
import {
  calculateDailyWorkSummary,
  calculateMonthlyWorkSummary,
  calculateEndOfDayAudit,
  isOrderOnDate,
} from '../utils/reportCalculations';
import { getBusinessDate } from '../utils/businessDate';
import { ROLES } from '../utils/permissions';

export const reportApi = {
  /**
   * Fetches the Daily Work Report for an employee on a given date (YYYY-MM-DD).
   * Enforces data isolation: Employee role is strictly restricted to own data.
   */
  getDailyWorkReport: async ({ date, employeeId = null, accountId = null, actor }) => {
    if (!actor) {
      const err = new Error('NOT_AUTHENTICATED');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const dateStr = date || getBusinessDate();

    // 1. Enforce Employee Data Scope: strictly use authenticated identity (failsafe override)
    let resolvedEmployeeId = employeeId;
    let resolvedAccountId = accountId;

    if (actor.role === ROLES.EMPLOYEE) {
      resolvedAccountId = actor.id;
      resolvedEmployeeId = actor.employeeId;
    }

    // 2. Fetch required underlying data in parallel
    const [sessionsRes, membersRes, ordersRes, staffRes, accountsRes, logsRes] = await Promise.all([
      workSessionApi.getAll(),
      workSessionApi.getMembers(),
      orderApi.getAll(),
      staffApi.getAll(),
      accountApi.getAll(),
      activityLogApi.getAll(),
    ]);

    const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
    const members = Array.isArray(membersRes.data) ? membersRes.data : [];
    const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    const staffList = Array.isArray(staffRes.data) ? staffRes.data : [];
    const accountList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
    const activityLogs = Array.isArray(logsRes.data) ? logsRes.data : [];

    // If no target employee is specified (e.g. Admin/Staff requesting current user by default)
    if (!resolvedEmployeeId && !resolvedAccountId) {
      resolvedAccountId = actor.id;
      resolvedEmployeeId = actor.employeeId;
    }

    const summary = calculateDailyWorkSummary({
      dateStr,
      employeeId: resolvedEmployeeId,
      accountId: resolvedAccountId,
      actor,
      members,
      sessions,
      orders,
      staffList,
      accountList,
      activityLogs,
    });

    return {
      success: true,
      data: summary,
    };
  },

  /**
   * Fetches all Daily Work Reports for all participating employees on a given date (Admin & Staff only).
   */
  getAllDailyWorkReports: async ({ date, actor }) => {
    if (!actor) {
      const err = new Error('NOT_AUTHENTICATED');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    if (actor.role === ROLES.EMPLOYEE) {
      const err = new Error('PERMISSION_DENIED: Nhân viên chỉ được xem báo cáo cá nhân.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    const dateStr = date || getBusinessDate();

    const [sessionsRes, membersRes, ordersRes, staffRes, accountsRes, logsRes] = await Promise.all([
      workSessionApi.getAll(),
      workSessionApi.getMembers(),
      orderApi.getAll(),
      staffApi.getAll(),
      accountApi.getAll(),
      activityLogApi.getAll(),
    ]);

    const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
    const members = Array.isArray(membersRes.data) ? membersRes.data : [];
    const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    const staffList = Array.isArray(staffRes.data) ? staffRes.data : [];
    const accountList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
    const activityLogs = Array.isArray(logsRes.data) ? logsRes.data : [];

    // Find all staff who have accounts
    const activeAccounts = accountList.filter(a => a.role === ROLES.EMPLOYEE || a.role === ROLES.STAFF);

    const reports = activeAccounts.map(acc => {
      return calculateDailyWorkSummary({
        dateStr,
        employeeId: acc.employeeId,
        accountId: acc.id,
        members,
        sessions,
        orders,
        staffList,
        accountList,
        activityLogs,
      });
    });

    return {
      success: true,
      data: reports,
    };
  },

  /**
   * Fetches the Monthly Work Report for an employee for a given month (YYYY-MM).
   * Enforces data isolation: Employee role is strictly restricted to own data.
   */
  getMonthlyWorkReport: async ({ month, employeeId = null, accountId = null, actor }) => {
    if (!actor) {
      const err = new Error('NOT_AUTHENTICATED');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const monthStr = month || getBusinessDate().slice(0, 7);

    // Enforce Employee Data Scope: strictly use authenticated identity (failsafe override)
    let resolvedEmployeeId = employeeId;
    let resolvedAccountId = accountId;

    if (actor.role === ROLES.EMPLOYEE) {
      resolvedAccountId = actor.id;
      resolvedEmployeeId = actor.employeeId;
    }

    if (!resolvedEmployeeId && !resolvedAccountId) {
      resolvedAccountId = actor.id;
      resolvedEmployeeId = actor.employeeId;
    }

    const [sessionsRes, membersRes, ordersRes, staffRes, accountsRes, logsRes] = await Promise.all([
      workSessionApi.getAll(),
      workSessionApi.getMembers(),
      orderApi.getAll(),
      staffApi.getAll(),
      accountApi.getAll(),
      activityLogApi.getAll(),
    ]);

    const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
    const members = Array.isArray(membersRes.data) ? membersRes.data : [];
    const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    const staffList = Array.isArray(staffRes.data) ? staffRes.data : [];
    const accountList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
    const activityLogs = Array.isArray(logsRes.data) ? logsRes.data : [];

    const summary = calculateMonthlyWorkSummary({
      monthStr,
      employeeId: resolvedEmployeeId,
      accountId: resolvedAccountId,
      actor,
      members,
      sessions,
      orders,
      staffList,
      accountList,
      activityLogs,
    });

    return {
      success: true,
      data: summary,
    };
  },

  /**
   * Fetches the End-of-Day Audit report for a selected business date (Admin & Staff only).
   */
  getEndOfDayAudit: async ({ date, actor }) => {
    if (!actor) {
      const err = new Error('NOT_AUTHENTICATED');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    // Strictly forbidden for Employee role
    if (actor.role === ROLES.EMPLOYEE) {
      const err = new Error('PERMISSION_DENIED: Nhân viên không có quyền xem Kiểm toán Cuối ngày.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    const dateStr = date || getBusinessDate();

    const [
      sessionsRes,
      membersRes,
      ordersRes,
      invRes,
      logsRes,
      staffRes,
      accountsRes,
      registersRes,
      productsRes,
    ] = await Promise.all([
      workSessionApi.getAll(),
      workSessionApi.getMembers(),
      orderApi.getAll(),
      inventoryApi.getAllTransactions(),
      activityLogApi.getAll(),
      staffApi.getAll(),
      accountApi.getAll(),
      registerApi.getAll().catch(() => []),
      productApi.getAll().catch(() => ({ data: [] })),
    ]);

    const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
    const members = Array.isArray(membersRes.data) ? membersRes.data : [];
    const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    const inventoryTransactions = Array.isArray(invRes.data) ? invRes.data : [];
    const activityLogs = Array.isArray(logsRes.data) ? logsRes.data : [];
    const staffList = Array.isArray(staffRes.data) ? staffRes.data : [];
    const accountList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
    const registers = Array.isArray(registersRes) ? registersRes : (Array.isArray(registersRes?.data) ? registersRes.data : []);
    const products = Array.isArray(productsRes?.data) ? productsRes.data : (Array.isArray(productsRes) ? productsRes : []);

    const audit = calculateEndOfDayAudit({
      dateStr,
      sessions,
      members,
      orders,
      inventoryTransactions,
      activityLogs,
      staffList,
      accountList,
      registers,
      products,
    });

    return {
      success: true,
      data: audit,
    };
  },

  /**
   * Fetches detailed sales activity with itemized breakdown and seller identity.
   */
  getSalesActivityDetails: async ({ date, orderId = null, employeeId = null, actor }) => {
    if (!actor) {
      const err = new Error('NOT_AUTHENTICATED');
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    const dateStr = date || getBusinessDate();

    const [ordersRes, staffRes, accountsRes, sessionsRes] = await Promise.all([
      orderApi.getAll(),
      staffApi.getAll(),
      accountApi.getAll(),
      workSessionApi.getAll(),
    ]);

    const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    const staffList = Array.isArray(staffRes.data) ? staffRes.data : [];
    const accountList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
    const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];

    let filtered = allOrders.filter(o => o.status === 'completed');

    if (dateStr) {
      filtered = filtered.filter(o => isOrderOnDate(o, dateStr));
    }

    if (orderId) {
      filtered = filtered.filter(o => o.id === orderId || o.code === orderId);
    }

    // Enforce Employee Data Scope: Employee can only see own orders
    if (actor.role === ROLES.EMPLOYEE) {
      filtered = filtered.filter(o => String(o.accountId) === String(actor.id));
    } else if (employeeId) {
      const acc = accountList.find(a => String(a.employeeId) === String(employeeId) || String(a.id) === String(employeeId));
      if (acc) {
        filtered = filtered.filter(o => String(o.accountId) === String(acc.id));
      }
    }

    const audit = calculateEndOfDayAudit({
      dateStr,
      sessions,
      members: [],
      orders: filtered,
      inventoryTransactions: [],
      activityLogs: [],
      staffList,
      accountList,
    });

    return {
      success: true,
      data: audit.salesDetails,
    };
  },
};
