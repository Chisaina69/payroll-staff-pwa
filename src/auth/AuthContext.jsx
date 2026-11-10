import { useEffect, useState } from "react";
import { AuthContext } from "./context";
import { supabase } from "../lib/supabase";
import {
  loginWithEmployeeId,
  logout as logoutFromSupabase,
} from "../lib/paydayAuth";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("Unable to load profile:", error.message);
      return null;
    }

    return data;
  }

  useEffect(() => {
    // Check for an existing session on first load (e.g. page refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) setProfile(await loadProfile(session.user.id));
      setLoading(false);
    });

    // Keep user/profile in sync whenever auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        setProfile(session?.user ? await loadProfile(session.user.id) : null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (identifier, password) => {
    if (identifier.includes("@")) {
      const { error } = await supabase.auth.signInWithPassword({
        email: identifier.trim(),
        password,
      });
      if (error) throw error;
      return;
    }

    await loginWithEmployeeId(identifier, password);
  };

  const logout = () => logoutFromSupabase();

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    employeeId: profile?.employee_id ?? null,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider };
