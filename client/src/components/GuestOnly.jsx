import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNextPath } from '../hooks/useNextPath.js';

// Auth pages: once someone is signed in (including by finishing the form on this page), move on to ?next=.
export default function GuestOnly({ children }) {
  const { user, status } = useAuth();
  const next = useNextPath();

  if (status === 'loading') return null;
  if (user) return <Navigate to={next} replace />;
  return children;
}
