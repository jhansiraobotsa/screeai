import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    role: null,
  });

  useEffect(() => {
    // IMPORTANT: Never do async DB calls inside onAuthStateChange —
    // supabase-js awaits all listeners before resolving signInWithPassword,
    // which causes login to hang indefinitely.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Synchronous state update only
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
          // preserve role until re-fetched
          role: session ? prev.role : null,
        }));
      }
    );

    // Bootstrap from existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session,
        loading: false,
      }));
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch role separately whenever user changes (non-blocking)
  useEffect(() => {
    if (!state.user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", state.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setState(prev => ({ ...prev, role: data?.role ?? "user" }));
      });
  }, [state.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const deleteAccount = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Failed to delete account");
    }

    await supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signUp, signOut, resetPassword, changePassword, deleteAccount };
}
