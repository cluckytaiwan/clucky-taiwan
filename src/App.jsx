import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { OrderNotificationProvider } from "./context/OrderNotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster } from "react-hot-toast";
import VariantBottomSheet from "./components/VariantBottomSheet";

// Halaman publik — diload langsung (critical path)
import HomePage from "./pages/public/HomePage";

// Halaman publik selain beranda — lazy agar kunjungan pertama (beranda) lebih ringan
const CheckoutPage = lazy(() => import("./pages/public/CheckoutPage"));
const OrderStatusPage = lazy(() => import("./pages/public/OrderStatusPage"));
const ProductDetailPage = lazy(() => import("./pages/public/ProductDetailPage"));

// Halaman admin — lazy loaded agar tidak masuk bundle publik
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminSales = lazy(() => import("./pages/admin/AdminSales"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));

function AdminFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center font-body text-neutral-500">
      Memuat...
    </div>
  );
}

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
        containerStyle={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      />
      <VariantBottomSheet />
      <AdminAuthProvider>
        <Routes>
          {/* Halaman Publik */}
          <Route path="/" element={<HomePage />} />
          <Route path="/produk/:id" element={<Suspense fallback={<AdminFallback />}><ProductDetailPage /></Suspense>} />
          <Route path="/checkout" element={<Suspense fallback={<AdminFallback />}><CheckoutPage /></Suspense>} />
          <Route path="/cek-pesanan" element={<Suspense fallback={<AdminFallback />}><OrderStatusPage /></Suspense>} />

          {/* Halaman Admin — dibungkus Suspense untuk lazy load */}
          <Route
            path="/admin/login"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminLogin />
              </Suspense>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <OrderNotificationProvider>
                  <Suspense fallback={<AdminFallback />}>
                    <AdminLayout />
                  </Suspense>
                </OrderNotificationProvider>
              </ProtectedRoute>
            }
          >
            {/* Index redirect: /admin → /admin/dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="sales" element={<AdminSales />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="products" element={<AdminProducts />} />

          </Route>
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
