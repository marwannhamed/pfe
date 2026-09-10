import { Navigate } from 'react-router-dom';

/** Public space discovery is the guest map — keep /spaces as a friendly alias. */
export default function PublicSpacesPage() {
  return <Navigate to="/map" replace />;
}
