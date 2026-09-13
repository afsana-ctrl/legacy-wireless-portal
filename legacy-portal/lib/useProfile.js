"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";

/**
 * Loads the current session + profile row (role, rep_id).
 * Redirects to /login if there's no session.
 * Returns { loading, user, profile }.
 */
export function useProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!active) return;
      setUser(session.user);

      const { data: profileRow, error } = await supabase
        .from("profiles")
        .select("id, role, rep_id, reps(id, name, phone, email)")
        .eq("id", session.user.id)
        .single();

      if (!active) return;
      if (error) {
        console.error("profile load error", error);
      }
      setProfile(profileRow || null);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  return { loading, user, profile };
}

export async function signOut(router) {
  await supabase.auth.signOut();
  router.replace("/login");
}
