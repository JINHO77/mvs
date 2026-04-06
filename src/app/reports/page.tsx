"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

export default function ReportsLandingPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Reports redirect session error:", toPrettyErrorString(sessionError));
        return;
      }
      if (!session) {
        router.replace(isDevMode ? "/dev-login" : "/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null }>();
      if (error) {
        console.error("Reports redirect profile error:", toPrettyErrorString(error));
        return;
      }
      if (!mounted) return;

      const role = profile?.role ?? "";
      if (role === "owner") {
        router.replace("/owner/reports");
      } else if (role === "student") {
        router.replace("/student/reports");
      } else if (role === "parent") {
        router.replace("/parent/reports");
      } else {
        router.replace("/");
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [isDevMode, router]);

  return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">리포트로 이동 중...</main>;
}
