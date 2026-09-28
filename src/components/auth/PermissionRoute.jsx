import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';
import { toast } from 'react-toastify';
import { useEffect, useRef } from 'react';

const PermissionRoute = ({ permission }) => {
  const { isAuthenticated, hasAdmin, loading, can } = useAuth();
  const location = useLocation();
  const notifiedRef = useRef(false);

  const hasAccess = can(permission);

  useEffect(() => {
    if (!loading && isAuthenticated && !hasAccess && !notifiedRef.current) {
      toast.warning('Bạn không có quyền truy cập trang này.');
      notifiedRef.current = true;
    }
  }, [loading, isAuthenticated, hasAccess]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (hasAdmin === false) {
    return <Navigate to="/setup-admin" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default PermissionRoute;
