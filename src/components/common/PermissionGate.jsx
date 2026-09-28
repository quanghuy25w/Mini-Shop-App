import { useAuth } from '../../hooks/useAuth';

const PermissionGate = ({ permission, children, fallback = null }) => {
  const { can } = useAuth();
  return can(permission) ? children : fallback;
};

export default PermissionGate;

