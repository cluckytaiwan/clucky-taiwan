// src/pages/admin/AdminLogin.jsx
import { useEffect, useState } from "react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { useNavigate } from "react-router-dom";
import heroImg from "../../assets/hero.jpg";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  // Tema admin lama (abu-abu & hijau sebelum audit UI). Dipasang di <body> agar toast
  // dan popup yang dirender di luar layout ikut. Halaman publik tetap memakai palet baru.
  useEffect(() => {
    document.body.classList.add("admin-legacy");
    return () => document.body.classList.remove("admin-legacy");
  }, []);

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const err = await login(email, password);
    setLoading(false);
    if (err) {
      setError("Email atau password salah");
    } else {
      navigate("/admin/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImg})` }}
      />
      {/* Overlay to improve readability */}
      <div className="absolute inset-0 bg-black/60" />
      
      <form
        onSubmit={handleSubmit}
        className="bg-surface rounded-2xl shadow-sm border border-neutral-200 p-6 w-full max-w-sm space-y-4 relative z-10"
      >
        <h1 className="text-xl font-bold font-display text-neutral-900 text-center">Admin Clucky Taiwan</h1>
        <div>
          <label className="text-sm font-medium text-neutral-900">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-900">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
