import { useEffect, useState } from "react";
import { AuthContext } from "./context";
import { supabase } from "../lib/supabase";

export function AuthProvider({ children }) {
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

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpStaff = async (employeeId, email, password) => {
    // Confirm the Employee ID exists before creating a login account for it
    const { data: employee, error: lookupError } = await supabase
      .from("employees")
      .select("employee_id")
      .eq("employee_id", employeeId)
      .single();
    if (lookupError || !employee) {
      throw new Error("That Employee ID wasn't found. Check with your administrator.");
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      role: "staff",
      employee_id: employeeId,
      email,
    });
    if (profileError) throw profileError;
  };

  const logout = () => supabase.auth.signOut();

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    employeeId: profile?.employee_id ?? null,
    loading,
    login,
    signUpStaff,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
