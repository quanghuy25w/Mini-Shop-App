import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AdminRoute from '../components/auth/AdminRoute';
import PermissionRoute from '../components/auth/PermissionRoute';
import { PERMISSIONS } from '../utils/permissions';
import SetupAdmin from '../pages/Login/SetupAdmin';
import LoginPage from '../pages/Login/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import CategoryPage from '../pages/CategoryPage';
import ProductPage from '../pages/ProductPage';
import ImportPage from '../pages/ImportPage';
import ExportPage from '../pages/ExportPage';
import SalesPage from '../pages/SalesPage';
import TransactionHistoryPage from '../pages/TransactionHistoryPage';
import StaffList from '../pages/Staff/StaffList';
import AccountList from '../pages/Accounts/AccountList';
import WorkSessionListPage from '../pages/WorkSession/WorkSessionListPage';
import ActivityLogPage from '../pages/ActivityLogPage';
import ReportPage from '../pages/Reports/ReportPage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth & Setup Routes */}
      <Route path="/setup-admin" element={<SetupAdmin />} />
      <Route path="/login" element={<LoginPage defaultRole="staff" />} />
      <Route path="/login/staff" element={<LoginPage defaultRole="staff" />} />
      <Route path="/login/admin" element={<LoginPage defaultRole="admin" />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          
          <Route element={<PermissionRoute permission={PERMISSIONS.CATEGORY_VIEW} />}>
            <Route path="categories" element={<CategoryPage />} />
          </Route>

          <Route element={<PermissionRoute permission={PERMISSIONS.PRODUCT_VIEW} />}>
            <Route path="products" element={<ProductPage />} />
          </Route>

          <Route element={<PermissionRoute permission={PERMISSIONS.ORDER_CREATE} />}>
            <Route path="sales" element={<SalesPage />} />
          </Route>

          <Route element={<PermissionRoute permission={PERMISSIONS.ORDER_VIEW} />}>
            <Route path="transactions" element={<TransactionHistoryPage />} />
          </Route>

          <Route element={<PermissionRoute permission={PERMISSIONS.REPORT_VIEW} />}>
            <Route path="reports" element={<ReportPage />} />
          </Route>

          {/* Inventory Import & Export Routes (Requires Permissions) */}
          <Route element={<PermissionRoute permission={PERMISSIONS.INVENTORY_IMPORT} />}>
            <Route path="import" element={<ImportPage />} />
          </Route>
          <Route element={<PermissionRoute permission={PERMISSIONS.INVENTORY_EXPORT} />}>
            <Route path="export" element={<ExportPage />} />
          </Route>

          {/* Staff Operations Routes (Admin + Staff) */}
          <Route element={<PermissionRoute permission={PERMISSIONS.EMPLOYEE_VIEW} />}>
            <Route path="staff" element={<StaffList />} />
          </Route>
          <Route element={<PermissionRoute permission={PERMISSIONS.WORK_SESSION_MANAGE} />}>
            <Route path="work-sessions" element={<WorkSessionListPage />} />
          </Route>
          <Route element={<PermissionRoute permission={PERMISSIONS.ACTIVITY_LOG_VIEW} />}>
            <Route path="activity-logs" element={<ActivityLogPage />} />
          </Route>

          {/* Admin-only Routes (Account & System Management) */}
          <Route element={<AdminRoute />}>
            <Route path="accounts" element={<AccountList />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;

