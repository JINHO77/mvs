"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/common/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { isUuid } from "@/lib/validators";

function isMissingAccountStatusError(error: unknown): boolean {
  const pretty = toPrettyErrorString(error).toLowerCase();
  return pretty.includes("account_status") && (
    pretty.includes("does not exist")
    || pretty.includes("column")
    || pretty.includes("42703")
  );
}

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace(process.env.NEXT_PUBLIC_DEV_MODE === "true" ? "/dev-login" : "/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role, account_status, academy_id")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null; account_status: string | null; academy_id: string | null }>();

      let role = "";
      let status = "active";
      let academyId: string | null = null;

      if (error) {
        if (!isMissingAccountStatusError(error)) {
          console.error("Owner layout profile load failed:", toPrettyErrorString(error), error);
          router.replace("/login");
          return;
        }
        const { data: fallback, error: fallbackError } = await supabase
          .from("profiles")
          .select("role, academy_id")
          .eq("id", session.user.id)
          .maybeSingle<{ role: string | null; academy_id: string | null }>();
        if (fallbackError) {
          console.error("Owner layout role fallback failed:", toPrettyErrorString(fallbackError), fallbackError);
          router.replace("/login");
          return;
        }
        role = (fallback?.role ?? "").trim();
        academyId = fallback?.academy_id ?? null;
      } else {
        role = (data?.role ?? "").trim();
        status = (data?.account_status ?? "active").trim();
        academyId = data?.academy_id ?? null;
      }

      if (role !== "owner" && role !== "teacher") {
        router.replace("/");
        return;
      }
      if (status !== "active") {
        router.replace("/login");
        return;
      }
      if (role === "owner" && !isUuid(academyId)) {
        router.replace("/onboarding/academy");
        return;
      }

      if (!mounted) return;
      setReady(true);
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!ready) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">로딩 중...</main>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <TopBar logoHref="/owner" />
      {children}
    </div>
  );
}
