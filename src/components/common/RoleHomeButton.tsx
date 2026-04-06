"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRole = "student" | "parent" | "owner";

export default function RoleHomeButton() {
  const router = useRouter();
  const [role, setRole] = useState<ProfileRole | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRole = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session || !mounted) {
        if (mounted) setRole(null);
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null }>();

      if (profileError || !mounted) {
        if (mounted) setRole(null);
        return;
      }

      if (profileRow?.role === "student" || profileRow?.role === "parent" || profileRow?.role === "owner") {
        setRole(profileRow.role);
        return;
      }

      setRole(null);
    };

    void loadRole();
    return () => {
      mounted = false;
    };
  }, []);

  const homeHref = useMemo(() => {
    if (role === "student") return "/student";
    if (role === "parent") return "/parent";
    if (role === "owner") return "/owner";
    return null;
  }, [role]);

  if (!role || !homeHref) return null;

  return (
    <button
      type="button"
      className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)]"
      onClick={() => router.push(homeHref)}
    >
      🏠 홈으로
    </button>
  );
}
