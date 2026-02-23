"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "owner" | "teacher" | "parent" | "student";

const roleToPath: Record<Role, string> = {
  owner: "/owner",
  teacher: "/teacher",
  parent: "/parent",
  student: "/student",
};

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
        setError(`?�션 ?�인 ?�패: ${sessionError.message}`);
        return;
      }

      if (!session) {
        router.replace(isDevMode ? "/dev-login" : "/login");
        return;
      }

      const { data: me, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null }>();

      if (roleError) {
        setError(`권한 ?�인 ?�패: ${roleError.message}`);
        return;
      }

      const role = (me?.role ?? "").trim();
      if (role === "owner" || role === "teacher" || role === "parent" || role === "student") {
        router.replace(roleToPath[role]);
        return;
      }

      router.replace("/onboarding/role");
    };

    void run();
  }, [isDevMode, router]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#1E1E26] bg-[#121218] p-6 text-center">
        <h1 className="text-xl font-semibold">?�?�보?�로 ?�동 �?..</h1>
        {error && <p className="mt-3 text-sm text-[#FFB4B4]">{error}</p>}
      </div>
    </main>
  );
}
