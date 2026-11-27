// src/components/UserMenu.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, LogOut, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Menu akun pelanggan di header: nama + email, Profil Saya, Pesanan Saya, Keluar.
 * Ditutup saat klik di luar atau menekan Esc.
 */
export default function UserMenu() {
  const { nama, email, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (nama || email || "?").trim().charAt(0).toUpperCase();
  const itemClass = "flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-body text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100";

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate("/");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu akun"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-body text-sm font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[110px] truncate font-body text-sm font-semibold text-neutral-700 sm:inline">
          {(nama || "Akun").split(" ")[0]}
        </span>
        <ChevronDown size={14} className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="truncate font-body text-sm font-bold text-neutral-900">{nama}</p>
            <p className="truncate font-body text-xs text-neutral-500">{email}</p>
          </div>
          <Link to="/profil" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <User size={16} /> Profil Saya
          </Link>
          <Link to="/cek-pesanan" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <ClipboardList size={16} /> Pesanan Saya
          </Link>
          <button role="menuitem" onClick={handleSignOut} className={`${itemClass} border-t border-neutral-100 text-danger hover:bg-red-50`}>
            <LogOut size={16} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
