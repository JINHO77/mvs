"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("로그??처리 �?..");

  useEffect(() => {
    (async () => {
      try {
        setMsg("콜백 URL ?�인 �?..");

        // 1) 먼�? ?�재 ?�션???��? ?�나 ?�인
        const s1 = await supabase.auth.getSession();
        if (s1.data.session) {
          setMsg("?�션 ?�인?? ?�로???�??�?..");
          await upsertProfileAndGoHome(s1.data.session.user, setMsg, router);
          return;
        }

        // 2) URL??code가 ?�으�??�션?�로 교환(PKCE ?�름)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          setMsg("로그??코드 교환 �?..");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (!data.session) {
            setMsg("코드 교환 ?�에???�션???�습?�다. ?�시 로그?�해주세??");
            setTimeout(() => router.replace("/login"), 1200);
            return;
          }

          setMsg("?�션 ?�성?? ?�로???�??�?..");
          await upsertProfileAndGoHome(data.session.user, setMsg, router);
          return;
        }

        // 3) code???�고 ?�션???�으�? 메일???�앱브라?��?/리다?�렉??문제??가?�성 ??
        setMsg(
          "?�션/코드가 ?�습?�다. 메일???�앱브라?��? 문제?????�어?? 링크�?'브라?��??�서 ?�기'�??�시 ?�도?�주?�요."
        );
        setTimeout(() => router.replace("/login"), 1500);
      } catch (e: any) {
        setMsg("콜백 처리 ?�패: " + (e?.message ?? "unknown error"));
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
    setMsg("?�로???�???�패: " + upsertError.message);
    return;
  }

  setMsg("?�료! ?�으�??�동?�니??..");
  router.replace("/");
}
