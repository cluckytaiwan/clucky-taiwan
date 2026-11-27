import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { OrderNotificationProvider } from "./context/OrderNotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthGateModal from "./components/AuthGateModal";
import { Toaster } from "react-hot-toast";
import VariantBottomSheet from "./components/VariantBottomSheet";

// Halaman publik — diload langsung (critical path)
import HomePage from "./pages/public/HomePage";
import CheckoutPage from "./pages/public/CheckoutPage";
import OrderStatusPage from "./pages/public/OrderStatusPage";
import ProductDetailPage from "./pages/public/ProductDetailPage";
import LoginPage from "./pages/public/LoginPage";
import ProfilePage from "./pages/public/ProfilePage";

// Halaman pengelola — lazy loaded agar tidak masuk bundle publik
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminSales = lazy(() => import("./pages/admin/AdminSales"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminTodayOrders = lazy(() => import("./pages/admin/AdminTodayOrders"));
const AdminAccounts = lazy(() => import("./pages/admin/AdminAccounts"));

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center font-body text-neutral-500">
      Memuat...
    </div>
  );
}

/** Pintu masuk /admin: Admin → Pesanan Hari Ini, Owner → Dasbor Laporan. */
function AdminHome() {
  const { role } = useAuth();
  return <Navigate to={role === "owner" ? "dashboard" : "pesanan"} replace />;
}

/** Notifikasi pesanan baru hanya untuk Admin (Owner tidak memproses pesanan). */
function StaffShell({ children }) {
  const { role } = useAuth();
  return <OrderNotificationProvider enabled={role === "admin"}>{children}</OrderNotificationProvider>;
}

const withSuspense = (el) => <Suspense fallback={<AdminFallback />}>{el}</Suspense>;
const only = (roles, el) => (
  <ProtectedRoute roles={roles} redirectTo="/admin/login">{withSuspense(el)}</ProtectedRoute>
);

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            background: '#333',
            color: '#fff',
          },
        }}
        containerStyle={{ top: 16, right: 16 }}
      />
      <AuthProvider>
        <VariantBottomSheet />
        <AuthGateModal />
        <Routes>
          {/* Halaman Publik — katalog bisa dilihat tanpa login */}
          <Route path="/" element={<HomePage />} />
          <Route path="/produk/:id" element={<ProductDetailPage />} />
          <Route path="/masuk" element={<LoginPage />} />

          {/* Khusus pelanggan yang sudah login */}
          <Route
            path="/checkout"
            element={<ProtectedRoute roles={["pelanggan"]}><CheckoutPage /></ProtectedRoute>}
          />
          <Route
            path="/profil"
            element={<ProtectedRoute roles={["pelanggan"]}><ProfilePage /></ProtectedRoute>}
          />
          <Route
            path="/cek-pesanan"
            element={<ProtectedRoute roles={["pelanggan"]}><OrderStatusPage /></ProtectedRoute>}
          />

          {/* Area pengelola */}
          <Route
            path="/admin/login"
            element={withSuspense(<AdminLogin />)}
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin", "owner"]} redirectTo="/admin/login">
                <StaffShell>
                  {withSuspense(<AdminLayout />)}
                </StaffShell>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminHome />} />
            {/* Admin: operasional */}
            <Route path="pesanan" element={only(["admin"], <AdminTodayOrders />)} />
            <Route path="categories" element={only(["admin", "owner"], <AdminCategories />)} />
            <Route path="products" element={only(["admin", "owner"], <AdminProducts />)} />
            {/* Owner: laporan, penjualan (hanya baca), akun admin */}
            <Route path="dashboard" element={only(["owner"], <AdminDashboard />)} />
            <Route path="sales" element={only(["owner"], <AdminSales />)} />
            <Route path="akun" element={only(["owner"], <AdminAccounts />)} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
