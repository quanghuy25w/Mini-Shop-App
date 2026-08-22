import { Routes, Route } from 'react-router-dom';
import Layout from '../components/common/Layout';
import DashboardPage from '../pages/DashboardPage';
import CategoryPage from '../pages/CategoryPage';
import ProductPage from '../pages/ProductPage';
import ImportPage from '../pages/ImportPage';
import ExportPage from '../pages/ExportPage';
import SalesPage from '../pages/SalesPage';
import TransactionHistoryPage from '../pages/TransactionHistoryPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="categories" element={<CategoryPage />} />
        <Route path="products" element={<ProductPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="transactions" element={<TransactionHistoryPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
