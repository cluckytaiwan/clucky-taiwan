// src/components/AuthGateModal.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn, X } from "lucide-react";
import { useAuthGateStore } from "../store/authGateStore";

/**
 * Jendela "Masuk dulu" untuk tamu yang mencoba memesan (menambah keranjang / checkout).
 * Tombolnya membawa pelanggan ke halaman Masuk/Daftar lalu kembali ke halaman semula.
 */
export default function AuthGateModal() {
  const { isOpen, message, closeGate } = useAuthGateStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;
  const next = encodeURIComponent(location.pathname + location.search);

  function go(mode) {
    closeGate();
    navigate(`/masuk?${mode === "daftar" ? "mode=daftar&" : ""}next=${next}`);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={closeGate}
          aria-label="Tutup"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
        >
          <X size={16} />
        </button>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LogIn size={22} />
        </div>
        <h2 id="auth-gate-title" className="text-center font-display text-lg font-bold text-neutral-900">
          Masuk untuk memesan
        </h2>
        <p className="mt-1 text-center font-body text-sm text-neutral-500">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => go("masuk")}
            className="w-full rounded-xl bg-primary py-3 font-body font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Masuk
          </button>
          <button
            onClick={() => go("daftar")}
            className="w-full rounded-xl border border-neutral-200 py-3 font-body font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            Daftar akun baru
          </button>
        </div>
        <p className="mt-3 text-center font-body text-xs text-neutral-500">
          Menu tetap bisa dilihat tanpa akun.
        </p>
      </div>
    </div>
  );
}
