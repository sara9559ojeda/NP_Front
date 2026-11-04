import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from '../api/types';
import { Loading } from '../components/Feedback';
import { ForbiddenPage } from '../pages/ErrorPages';
import { useAuth } from './AuthContext';

/** Route guard: anonymous users go to login; users with another role see "access restricted". */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading />;
  if (status === 'anonymous' || !user) {
    return <Navigate to="/iniciar-sesion" replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) return <ForbiddenPage />;
  return <>{children}</>;
}
