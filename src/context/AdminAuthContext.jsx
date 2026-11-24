// src/context/AdminAuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AdminAuthContext = createContext(null);

/**
 * Menyimpan status login admin untuk seluruh halaman admin.
 * Dipasang sekali di App; dipakai ProtectedRoute dan halaman login.
 * Hasil: session (sudah login?) dan isAdmin (terdaftar sebagai admin?).
 */
export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
      setLoading(false);
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSession(session) {
    setSession(session);
    if (!session) {
      setIsAdmin(false);
      return;
    }

    try {
      // Login saja belum cukup: akun harus terdaftar di tabel admin (daftar akun yang diizinkan)
      const { data, error } = await supabase
        .from("admin")
        .select("user_id")
        .eq("user_id", session.user.id)
        .single();

      // PGRST116 = data tidak ditemukan, artinya akun ini memang bukan admin
      if (error && error.code !== "PGRST116") {
        console.error("Admin check failed:", error);
      }
      
      setIsAdmin(!error && !!data);
    } catch (err) {
      console.error("Session handling error:", err);
      setIsAdmin(false);
    }
  }

  // Password dicek oleh Supabase Auth; aplikasi ini tidak menyimpan password sendiri
  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AdminAuthContext.Provider value={{ session, isAdmin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);
