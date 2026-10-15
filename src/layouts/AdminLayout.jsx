import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Package, Tags, LogOut,
  Bell, BellOff, ShoppingBag,
} from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useOrderNotification } from "../context/OrderNotificationContext";
import { supabase } from "../lib/supabaseClient";
import { useOrdersStore } from "../store/ordersStore";

export default function AdminLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const currentPath = location.pathname;
  const { logout } = useAdminAuth();
  const { isMuted, toggleMute } = useOrderNotification();

  // Badge: jumlah produk aktif dengan stok ≤ 10
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    async function fetchLowStock() {
      const { count } = await supabase
        .from("produk")
        .select("id", { count: "exact", head: true })
        .eq("aktif", true)
        .lte("stok", 10);
      setLowStockCount(count || 0);
    }
    fetchLowStock();
  }, []);

  // ── Realtime channel bersama ──────────────────────────────────
  // Setup satu channel untuk seluruh area admin (Sales + Dashboard).
  // Teardown otomatis saat AdminLayout unmount (logout / navigasi keluar admin).
  const setupRealtime   = useOrdersStore(s => s.setupRealtime);
  const teardownRealtime = useOrdersStore(s => s.teardownRealtime);

  useEffect(() => {
    setupRealtime();
    return () => teardownRealtime();
  }, [setupRealtime, teardownRealtime]);




  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  /* ─── Komponen NavLink ─── */
  function NavLink({ to, icon: Icon, label, exact = false }) {
    const isActive = exact ? currentPath === to : currentPath === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
          isActive
            ? "bg-primary text-white shadow-sm"
            : "text-neutral-600 hover:bg-primary/10 hover:text-primary"
        }`}
      >
        <Icon size={18} />
        {label}
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-surface border-r border-neutral-200 shrink-0 flex flex-col">
        {/* Logo + Mute */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
          <span className="font-display text-xl font-extrabold tracking-tight text-primary">
            Clucky<span className="text-secondary">Admin</span>
          </span>
          <button
            onClick={toggleMute}
            title={isMuted ? "Aktifkan notifikasi suara" : "Matikan notifikasi suara"}
            className={`
              p-2 rounded-xl transition-all duration-200 group relative
              ${isMuted
                ? "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                : "bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-600"
              }
            `}
          >
            {isMuted ? <BellOff size={16} /> : <Bell size={16} />}
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-white text-[11px] font-medium px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {isMuted ? "Suara nonaktif" : "Suara aktif"}
            </span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Dasbor */}
          <NavLink to="/admin/dashboard" icon={LayoutDashboard} label="Dasbor" />

          {/* Penjualan */}
          <NavLink to="/admin/sales" icon={ShoppingBag} label="Penjualan" />

          {/* Kategori */}
          <NavLink to="/admin/categories" icon={Tags} label="Kategori" />

          {/* Produk — badge stok rendah langsung di nav item */}
          <Link
            to="/admin/products"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
              currentPath === "/admin/products"
                ? "bg-primary text-white shadow-sm"
                : "text-neutral-600 hover:bg-primary/10 hover:text-primary"
            }`}
          >
            <Package size={18} />
            <span className="flex-1">Produk</span>
            {lowStockCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                currentPath === "/admin/products"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {lowStockCount}
              </span>
            )}
          </Link>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-neutral-200">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-danger hover:bg-red-50"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 max-h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
