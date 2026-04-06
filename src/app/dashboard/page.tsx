"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

type Role = "owner" | "teacher" | "parent" | "student";

const roleToPath: Record<Role, string> = {
  owner: "/owner",
  teacher: "/teacher",
  parent: "/parent",
  student: "/student",
};

function isMissingAccountStatusError(error: unknown): boolean {
  const pretty = toPrettyErrorString(error).toLowerCase();
  return pretty.includes("account_status") && (
    pretty.includes("does not exist")
    || pretty.includes("column")
    || pretty.includes("42703")
  );
}

export default function DashboardRoutePage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setError(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(toPrettyErrorString(sessionError));
        return;
      }

      if (!session) {
        router.replace(isDevMode ? "/dev-login" : "/login");
        return;
      }

      let role = "";
      let status = "active";

      const { data: me, error: roleError } = await supabase
        .from("profiles")
        .select("role, account_status")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null; account_status: string | null }>();

      if (roleError) {
        if (!isMissingAccountStatusError(roleError)) {
          console.error("Dashboard role/account_status load failed:", toPrettyErrorString(roleError), roleError);
          setError(toPrettyErrorString(roleError));
          return;
        }

        const { data: fallbackMe, error: fallbackError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle<{ role: string | null }>();

        if (fallbackError) {
          console.error("Dashboard role fallback load failed:", toPrettyErrorString(fallbackError), fallbackError);
          setError(toPrettyErrorString(fallbackError));
          return;
        }

        role = (fallbackMe?.role ?? "").trim();
        status = "active";
      } else {
        role = (me?.role ?? "").trim();
        status = (me?.account_status ?? "active").trim();
      }

      if (role === "student" && status === "pending") {
        router.replace("/onboarding/pending");
        return;
      }
      if (role === "student" && (status === "blocked" || status === "withdrawn")) {
        router.replace("/onboarding/blocked");
        return;
      }
      if (status !== "active") {
        router.replace("/login");
        return;
      }
      if (role === "owner" || role === "teacher" || role === "parent" || role === "student") {
        router.replace(roleToPath[role]);
        return;
      }

      router.replace("/onboarding/role");
    };

    void run();
  }, [isDevMode, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
        <h1 className="text-xl font-semibold">대시보드로 이동 중...</h1>
        {error && <p className="mt-3 text-sm text-[var(--danger-text)]">{error}</p>}
      </div>
    </main>
  );
}
