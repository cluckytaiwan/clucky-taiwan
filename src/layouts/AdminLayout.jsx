import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Tags, LogOut } from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAdminAuth();
  const currentPath = location.pathname;

  const navs = [
    { name: "Dasbor Pesanan", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Kategori", path: "/admin/categories", icon: Tags },
    { name: "Produk", path: "/admin/products", icon: Package },
  ];

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-surface border-r border-neutral-200 shrink-0 flex flex-col">
        <div className="p-6 border-b border-neutral-200">
          <span className="font-display text-xl font-extrabold tracking-tight text-primary">
            Clucky<span className="text-secondary">Admin</span>
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navs.map((nav) => {
            const Icon = nav.icon;
            const isActive = currentPath === nav.path;
            return (
              <Link
                key={nav.path}
                to={nav.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-neutral-600 hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <Icon size={18} />
                {nav.name}
              </Link>
            );
          })}
        </nav>
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
