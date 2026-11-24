// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

/**
 * Menahan halaman admin agar hanya tampil untuk admin yang sudah login.
 * Dipakai di App untuk membungkus semua rute /admin.
 * Hasil: halaman admin, atau dialihkan ke /admin/login.
 * Ini hanya pembatas tampilan; data tetap dijaga RLS di database.
 */
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
