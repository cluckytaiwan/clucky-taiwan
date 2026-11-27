// src/pages/public/LoginPage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Halaman Masuk dan Daftar untuk pelanggan.
 * Dibuka dari tombol Masuk di beranda atau dari AuthGateModal; setelah berhasil,
 * pelanggan dikembalikan ke halaman asal (?next=). Akun admin/owner yang masuk di
 * sini diarahkan ke area pengelola.
 */
export default function LoginPage() {
  const { session, role, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState(params.get("mode") === "daftar" ? "daftar" : "masuk");
  const [form, setForm] = useState({ nama: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Setelah login & peran terbaca: arahkan sesuai peran
  useEffect(() => {
    if (!session || !role) return;
    if (role === "admin") navigate("/admin/pesanan", { replace: true });
    else if (role === "owner") navigate("/admin/dashboard", { replace: true });
    else navigate(next.startsWith("/") ? next : "/", { replace: true });
  }, [session, role, next, navigate]);

  function validate() {
    const e = {};
    if (mode === "daftar" && form.nama.trim().length < 3) e.nama = "Nama minimal 3 karakter";
    if (!EMAIL_REGEX.test(form.email.trim())) e.email = "Format email tidak valid";
    if (mode === "daftar" && form.password.length < 8) e.password = "Kata sandi minimal 8 karakter";
    if (mode === "masuk" && !form.password) e.password = "Kata sandi wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setServerError("");
    setNotice("");
    if (loading || !validate()) return;
    setLoading(true);
    if (mode === "masuk") {
      const err = await signIn(form.email.trim(), form.password);
      if (err) setServerError("Email atau password salah");
    } else {
      const { error, needsConfirmation } = await signUp(form.nama, form.email.trim(), form.password);
      if (error) {
        setServerError(/registered|already/i.test(error.message) ? "Email sudah terdaftar" : "Pendaftaran gagal, coba lagi");
      } else if (needsConfirmation) {
        setNotice("Pendaftaran berhasil. Cek email kamu untuk konfirmasi, lalu masuk.");
        toast.success("Pendaftaran berhasil! Cek email untuk konfirmasi.", { duration: 5000 });
        setMode("masuk");
      } else {
        // Langsung masuk: halaman akan dialihkan, toast tetap tampil (Toaster global di App)
        toast.success(`Pendaftaran berhasil! Selamat datang, ${form.nama.trim()}.`, { duration: 4000 });
      }
    }
    setLoading(false);
  }

  const field = "w-full mt-1 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 block text-center font-display text-2xl font-extrabold tracking-tight text-primary">
          Clucky<span className="text-secondary">Taiwan</span>
        </Link>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1" role="tablist">
            {[["masuk", "Masuk"], ["daftar", "Daftar"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => { setMode(key); setErrors({}); setServerError(""); setNotice(""); }}
                className={`rounded-lg py-2 font-body text-sm font-semibold transition-colors ${
                  mode === key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === "daftar" && (
              <div>
                <label htmlFor="nama" className="text-sm font-semibold text-neutral-800">Nama lengkap</label>
                <input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className={field} placeholder="Contoh: Budi Santoso" autoComplete="name" />
                {errors.nama && <p className="mt-1 text-xs text-danger">{errors.nama}</p>}
              </div>
            )}
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-neutral-800">Email</label>
              <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="nama@email.com" autoComplete="email" />
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-semibold text-neutral-800">Kata sandi</label>
              <input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} placeholder={mode === "daftar" ? "Minimal 8 karakter" : "Kata sandi"} autoComplete={mode === "daftar" ? "new-password" : "current-password"} />
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password}</p>}
            </div>
            {serverError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-danger">{serverError}</p>}
            {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-sm text-emerald-700">{notice}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3 font-body font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
              {loading ? "Memproses..." : mode === "masuk" ? "Masuk" : "Daftar"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center font-body text-xs text-neutral-500">
          Pengelola toko? <Link to="/admin/login" className="font-semibold text-primary underline underline-offset-2">Login Pengelola</Link>
        </p>
      </div>
    </div>
  );
}
