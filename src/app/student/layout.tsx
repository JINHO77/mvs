"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopBar from "@/components/common/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

type GateState = "loading" | "active";

function isMissingAccountStatusError(error: unknown): boolean {
  const pretty = toPrettyErrorString(error).toLowerCase();
  return pretty.includes("account_status") && (
    pretty.includes("does not exist")
    || pretty.includes("column")
    || pretty.includes("42703")
  );
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // /student/weekend/* 는 로그인 없이도 미션 내용 열람 가능
  const isWeekendPath = pathname?.startsWith("/student/weekend") ?? false;
  // /student/onboarding/* 는 승인 대기(pending) 상태에서도 접근 허용
  const isOnboardingPath = pathname?.startsWith("/student/onboarding") ?? false;
  const [gateState, setGateState] = useState<GateState>("loading");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          if (isWeekendPath) {
            // 주말 챌린지는 로그인 없어도 열람 가능 (XP 저장은 불가)
            if (mounted) setGateState("active");
            return;
          }
          router.replace(process.env.NEXT_PUBLIC_DEV_MODE === "true" ? "/dev-login" : "/login");
          return;
        }

        let role = "";
        let status = "active";

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("role, account_status")
          .eq("id", session.user.id)
          .maybeSingle<{ role: string | null; account_status: string | null }>();

        if (profileError) {
          if (!isMissingAccountStatusError(profileError)) {
            console.error("Student layout profile load failed:", toPrettyErrorString(profileError), profileError);
            router.replace("/");
            return;
          }

          const { data: fallbackRow, error: fallbackError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle<{ role: string | null }>();

          if (fallbackError || !fallbackRow) {
            console.error("Student layout role fallback failed:", toPrettyErrorString(fallbackError), fallbackError);
            router.replace("/");
            return;
          }

          role = (fallbackRow.role ?? "").trim();
          status = "active";
        } else {
          role = (profileRow?.role ?? "").trim();
          status = (profileRow?.account_status ?? "active").trim();
        }

        if (role !== "student") {
          router.replace("/");
          return;
        }

        if (status === "pending" && !isOnboardingPath) {
          router.replace("/onboarding/pending");
          return;
        }

        if (status === "blocked" || status === "withdrawn") {
          router.replace("/onboarding/blocked");
          return;
        }

        if (!mounted) return;
        setGateState("active");
      } catch (e: unknown) {
        console.error("Student layout gate failed:", toPrettyErrorString(e), e);
        if (!mounted) return;
        router.replace("/");
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [router, isWeekendPath, isOnboardingPath]);

  if (gateState === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">로딩 중...</main>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <TopBar logoHref="/student" />
      {children}
    </div>
  );
}
