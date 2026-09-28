import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

const ProtectedRoute = () => {
  const { isAuthenticated, hasAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Nếu hệ thống chưa có Quản trị viên nào 
  if (hasAdmin === false) {
    return <Navigate to="/setup-admin" replace state={{ from: location }} />;
  }

  // Nếu chưa đăng nhập -> Chuyển về trang đăng nhập
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
