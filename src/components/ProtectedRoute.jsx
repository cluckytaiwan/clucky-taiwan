// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Menahan halaman agar hanya tampil untuk peran yang diizinkan.
 * Dipakai di App: rute /admin untuk admin & owner, rute pelanggan (mis. checkout)
 * untuk akun yang sudah login.
 * Props:
 *   roles      — daftar peran yang diizinkan, mis. ["admin", "owner"]
 *   redirectTo — tujuan bila belum login (default /masuk; staf → /admin/login)
 * Hasil: halaman, atau dialihkan ke halaman masuk / beranda sesuai peran.
 * Ini hanya pembatas tampilan; data tetap dijaga RLS di database.
 */
export default function ProtectedRoute({ children, roles, redirectTo = "/masuk" }) {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  if (loading || (session && role === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center font-body text-neutral-500">
        Memuat...
      </div>
    );
  }
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={redirectTo === "/masuk" ? `/masuk?next=${next}` : redirectTo} replace />;
  }
  if (roles && !roles.includes(role)) {
    // Login tetapi peran tidak cocok: staf diarahkan ke areanya, lainnya ke beranda
    if (role === "admin") return <Navigate to="/admin/pesanan" replace />;
    if (role === "owner") return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
}
