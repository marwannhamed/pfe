import { Navigate } from 'react-router-dom';

/** Payments live under Billing → Payments tab (single workflow). */
export default function PaymentsPage() {
  return <Navigate to="/admin/billing?tab=payments" replace />;
}
