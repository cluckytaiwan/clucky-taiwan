// src/context/AdminAuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AdminAuthContext = createContext(null);

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
      // Tabel "admin" (singular, §7) — whitelist, bukan sekadar cek status login
      const { data, error } = await supabase
        .from("admin")
        .select("user_id")
        .eq("user_id", session.user.id)
        .single();

      // PGRST116 = no rows found (normal case, not an error)
      if (error && error.code !== "PGRST116") {
        console.error("Admin check failed:", error);
      }
      
      setIsAdmin(!error && !!data);
    } catch (err) {
      console.error("Session handling error:", err);
      setIsAdmin(false);
    }
  }

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
