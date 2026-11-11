import { Navigate, useParams } from 'react-router-dom';

/**
 * /spaces/:id used to render the signed-in space page, which reads
 * GET /spaces/:id — a route guests may not call — so visitors saw an empty
 * page. The guest map already opens a published space from ?space_id=.
 */
export default function PublicOfficePage() {
  const { id } = useParams();
  return <Navigate to={id ? `/map?space_id=${encodeURIComponent(id)}` : '/map'} replace />;
}
