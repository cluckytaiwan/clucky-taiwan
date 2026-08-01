// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function ProtectedRoute({ children }) {
  const { session, isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-body text-neutral-500">
        Memuat...
      </div>
    );
  }
  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
