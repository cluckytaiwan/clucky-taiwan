// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useCartStore } from "../store/cartStore";

const AuthContext = createContext(null);

/**
 * Status login untuk seluruh aplikasi (pelanggan, admin, dan owner).
 * Dipasang sekali di App. Hasil:
 *   session — sudah login?
 *   role    — 'owner' | 'admin' | 'pelanggan' | null (belum login)
 *   nama    — nama tampilan akun
 * Peran dibaca dari tabel admin: akun yang tercatat di sana berperan sesuai kolom
 * role-nya; akun lain yang sudah login adalah pelanggan. Ini hanya untuk tampilan;
 * hak akses data yang sebenarnya dijaga RLS di database.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [nama, setNama] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function applySession(next) {
      if (!active) return;
      setSession(next);
      if (!next) {
        setRole(null);
        setNama("");
        useCartStore.getState().reset();
        return;
      }
      try {
        const [{ data: adminRow }, { data: profil }] = await Promise.all([
          supabase.from("admin").select("role, nama").eq("user_id", next.user.id).maybeSingle(),
          supabase.from("profil").select("nama").eq("user_id", next.user.id).maybeSingle(),
        ]);
        if (!active) return;
        const r = adminRow?.role ?? "pelanggan";
        setRole(r);
        setNama(adminRow?.nama || profil?.nama || next.user.email?.split("@")[0] || "");
        // Keranjang hanya untuk pelanggan; staf tidak berbelanja
        if (r === "pelanggan") useCartStore.getState().loadCart(next.user.id);
        else useCartStore.getState().reset();
      } catch (err) {
        console.error("Gagal membaca peran akun:", err);
        if (active) setRole("pelanggan");
      }
    }

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      await applySession(s);
      if (active) setLoading(false);
    });

    // Jangan memanggil query Supabase langsung di dalam callback ini (bisa menahan
    // proses auth); tunda ke giliran berikutnya.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => applySession(s), 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Password dicek oleh Supabase Auth; aplikasi ini tidak menyimpan password sendiri
  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  /** Daftar akun pelanggan baru. Nama disimpan lewat data pendaftaran → tabel profil. */
  async function signUp(namaLengkap, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nama: namaLengkap.trim() } },
    });
    return { error, needsConfirmation: !error && !data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isStaff = role === "admin" || role === "owner";

  return (
    <AuthContext.Provider value={{ session, role, nama, isStaff, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
