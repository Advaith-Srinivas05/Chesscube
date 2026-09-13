import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { withNext } from '../hooks/useNextPath.js';

// Guests are sent to sign in and brought back afterwards.
export default function RequireAuth({ children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return null;
  if (!user) {
    return <Navigate to={withNext('/signin', location.pathname + location.search)} replace />;
  }
  return children;
}
