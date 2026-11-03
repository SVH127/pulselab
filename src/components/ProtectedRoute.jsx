import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function ProtectedRoute({ unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return null;
  if (!isAuthenticated) return unauthenticatedElement || <Navigate to="/login" replace />;

  return <Outlet />;
}
