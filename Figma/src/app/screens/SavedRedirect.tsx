import { Navigate } from 'react-router';

export function SavedRedirect() {
  return <Navigate to="/app/mytrips" replace />;
}
