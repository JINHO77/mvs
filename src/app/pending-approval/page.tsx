"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "@/components/common/PublicHeader";
import { supabase } from "@/lib/supabaseClient";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      supabase
        .from("profiles")
        .select("name, account_status, role")
        .eq("id", user.id)
        .maybeSingle<{ name: string | null; account_status: string; role: string }>()
        .then(({ data: profile }) => {
          if (!profile) {
            router.replace("/login?error=no_profile");
            return;
          }
          // 이미 승인된 경우 → 바로 이동
          if (profile.account_status === "active") {
            const dest = profile.role === "owner" || profile.role === "teacher"
              ? "/owner"
              : profile.role === "parent"
                ? "/parent"
                : "/student";
            router.replace(dest);
            return;
          }
          setName(profile.name);
        });
    });
  }, [router]);

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <PublicHeader />
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow)] text-center">
          <div className="text-5xl">⏳</div>
          <h1 className="mt-5 text-2xl font-semibold text-[var(--text)]">승인 대기 중</h1>
          {name && (
            <p className="mt-2 text-base text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text)]">{name}</span> 학생
            </p>
          )}
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            가입이 완료되었어요.
            <br />
            원장님의 승인이 완료되면 로그인할 수 있어요.
            <br />
            승인 후 이 페이지를 다시 방문하거나 새로 로그인해 주세요.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:opacity-60"
              onClick={() => router.refresh()}
            >
              승인 상태 확인
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
              onClick={handleSignOut}
              disabled={loading}
            >
              {loading ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
