import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';
import { toast } from 'react-toastify';
import { useEffect, useRef } from 'react';

const AdminRoute = () => {
  const { isAuthenticated, isAdmin, hasAdmin, loading } = useAuth();
  const location = useLocation();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!loading && isAuthenticated && !isAdmin && !notifiedRef.current) {
      toast.warning('Bạn không có quyền truy cập khu vực quản trị này.');
      notifiedRef.current = true;
    }
  }, [loading, isAuthenticated, isAdmin]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (hasAdmin === false) {
    return <Navigate to="/setup-admin" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
