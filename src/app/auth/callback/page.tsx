"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("로그인 처리 중...");

  useEffect(() => {
    void (async () => {
      try {
        setMsg("콜백 URL 확인 중...");

        // 1) 먼저 현재 세션 존재 여부 확인
        const s1 = await supabase.auth.getSession();
        if (s1.data.session) {
          setMsg("세션 확인됨. 프로필 처리 중...");
          await upsertProfileAndGoHome(s1.data.session.user, setMsg, router);
          return;
        }

        // 2) URL의 code를 세션으로 교환(PKCE)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          setMsg("로그인 코드 교환 중...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (!data.session) {
            setMsg("코드 교환 후 세션이 없습니다. 다시 로그인해 주세요.");
            setTimeout(() => router.replace("/login"), 1200);
            return;
          }

          setMsg("세션 생성됨. 프로필 처리 중...");
          await upsertProfileAndGoHome(data.session.user, setMsg, router);
          return;
        }

        // 3) code도 세션도 없으면 메일 앱/브라우저 이동 이슈 가능
        setMsg(
          "세션/코드가 없습니다. 메일 앱 이동 문제일 수 있어요. 링크를 브라우저에서 다시 열어 주세요."
        );
        setTimeout(() => router.replace("/login"), 1500);
      } catch (e: unknown) {
        setMsg("콜백 처리 실패: " + (e instanceof Error ? e.message : "unknown error"));
      }
    })();
  }, [router]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#1E1E26] bg-[#121218] p-6 text-[#B8B8C3]">
        {msg}
      </div>
    </main>
  );
}

async function upsertProfileAndGoHome(
  user: { id: string; email?: string | null },
  setMsg: (s: string) => void,
  router: ReturnType<typeof useRouter>
) {
  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    setMsg("프로필 생성 실패: " + upsertError.message);
    return;
  }

  setMsg("완료! 잠시 후 이동합니다...");
  router.replace("/");
}
