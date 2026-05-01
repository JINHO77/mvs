"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import { getLinkedStudentCountForGuardian } from "@/lib/parentGuard";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type Relation = "parent" | "guardian" | "other";

type ClaimResult =
  | { ok: true; student_id: string }
  | { ok: false; reason: "CODE_NOT_FOUND" | "CODE_ALREADY_USED" | "CODE_EXPIRED" | string };

type RedeemResult = {
  success?: boolean;
  student_id?: string;
  student_name?: string;
  relation?: string;
  already_linked?: boolean;
  error?: string;
};

function prettyClaimReason(reason: string): string {
  switch (reason) {
    case "CODE_NOT_FOUND":
      return "유효하지 않거나 존재하지 않는 코드예요.";
    case "CODE_ALREADY_USED":
      return "이미 사용된 코드예요.";
    case "CODE_EXPIRED":
      return "만료된 코드예요.";
    default:
      return `연결에 실패했어요: ${reason}`;
  }
}

function ParentLinkOnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [autoFocusInput, setAutoFocusInput] = useState(true);
  const [relation, setRelation] = useState<Relation>("parent");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [guardianId, setGuardianId] = useState<string | null>(null);

  // searchParams는 effect 안에서만 읽기 (Turbopack Suspense 호환).
  // 초기 render는 항상 ""로 시작 → ?code= 가 있으면 effect로 prefill.
  useEffect(() => {
    const fromUrl = searchParams.get("code");
    if (!fromUrl) return;
    const cleaned = fromUrl.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (cleaned) {
      setCode(cleaned);
      setAutoFocusInput(false);
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.replace(isDevMode ? "/dev-login" : "/login");
          return;
        }

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle<{ role: string | null }>();
        if (profileError) throw profileError;

        if ((profileRow?.role ?? "") !== "parent") {
          router.replace("/");
          return;
        }

        const linkedCount = await getLinkedStudentCountForGuardian(session.user.id);
        if (linkedCount > 0) {
          router.replace("/parent");
          return;
        }

        if (mounted) setGuardianId(session.user.id);
      } catch (e: unknown) {
        if (!mounted) return;
        setMessage({ type: "error", text: toPrettyErrorString(e) });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void initialize();
    return () => {
      mounted = false;
    };
  }, [isDevMode, router]);

  const submit = async () => {
    setMessage(null);
    const trimmed = code.trim().toUpperCase();

    if (trimmed.length !== 6 && trimmed.length !== 8) {
      setMessage({ type: "error", text: "코드는 6자리 또는 8자리예요" });
      return;
    }

    if (!guardianId) {
      setMessage({ type: "error", text: "세션이 만료됐어요. 다시 로그인해 주세요." });
      return;
    }

    setSubmitting(true);
    try {
      let studentName: string | undefined;

      if (trimmed.length === 8) {
        // 학원 OWNER 발급 8자리 코드
        const { data, error } = await supabase.rpc("claim_student_link_code", {
          p_code: trimmed,
          p_relation: relation,
        });
        if (error) throw error;

        const result = data as ClaimResult;
        if (!result?.ok) {
          setMessage({ type: "error", text: prettyClaimReason(result?.reason ?? "UNKNOWN") });
          return;
        }
      } else {
        // 학생 본인 발급 6자리 코드
        const { data, error } = await supabase.rpc("redeem_guardian_invitation", {
          p_guardian_id: guardianId,
          p_invitation_code: trimmed,
          p_relation: relation,
        });
        if (error) throw error;

        const result = data as RedeemResult | null;
        if (!result?.success) {
          setMessage({ type: "error", text: result?.error ?? "유효하지 않거나 만료된 코드예요." });
          return;
        }
        studentName = result.student_name;
      }

      const linkedCount = await getLinkedStudentCountForGuardian(guardianId);
      if (linkedCount === 0) {
        setMessage({ type: "error", text: "연결된 자녀를 찾지 못했어요. 잠시 후 다시 시도해 주세요." });
        return;
      }

      setMessage({ type: "success", text: `${studentName ?? "자녀"}와 연결됐어요!` });
      setCode("");
      setTimeout(() => router.replace("/parent"), 1500);
    } catch (e: unknown) {
      console.error("[parent/onboarding/link] submit failed", e);
      setMessage({ type: "error", text: toPrettyErrorString(e) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        불러오는 중...
      </main>
    );
  }

  const submitDisabled = submitting || (code.length !== 6 && code.length !== 8);

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <MvsHeaderLogo href="/parent" size="md" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">👨‍👩‍👧 자녀 연결하기</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          학원 또는 자녀에게서 받은 코드를 입력하면 자동으로 연결돼요.
        </p>

        <label className="mt-6 block text-sm text-[var(--text)]">연결코드 (6자리 또는 8자리)</label>
        <input
          type="text"
          inputMode="text"
          lang="en"
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] placeholder:tracking-normal placeholder:text-base focus:ring-2 focus:ring-[var(--accent)]"
          value={code}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            setCode(v.slice(0, 8));
          }}
          onCompositionEnd={(e) => {
            // 한글 IME가 켜진 상태에서 자모가 합쳐졌을 때 안전망
            const raw = (e.target as HTMLInputElement).value;
            const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
            setCode(cleaned);
          }}
          placeholder="예: K7M3PQ 또는 ABC12345"
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocusInput}
        />
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
          💡 <strong className="text-[var(--text)]">학원에서 받은 코드</strong>: 8자리 (예: ABC12345)<br />
          💡 <strong className="text-[var(--text)]">자녀가 마이페이지에서 발급한 코드</strong>: 6자리 (예: K7M3PQ)<br />
          ⌨️ 알파벳이 안 들어가면 한/영 키로 영문 모드로 전환해 주세요.
        </div>

        <label className="mt-4 block text-sm text-[var(--text)]">자녀와의 관계</label>
        <select
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={relation}
          onChange={(e) => setRelation(e.target.value as Relation)}
        >
          <option value="parent">부모</option>
          <option value="guardian">보호자</option>
          <option value="other">기타</option>
        </select>

        <button
          type="button"
          className="mt-5 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
          onClick={() => void submit()}
          disabled={submitDisabled}
        >
          {submitting ? "연결 중..." : "자녀 연결하기"}
        </button>

        {message && (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm ${
              message.type === "success"
                ? "border-[var(--success-text)] bg-[var(--success-bg)] text-[var(--success-text)]"
                : "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
            }`}
          >
            {message.type === "success" ? "✅" : "⚠️"} {message.text}
          </div>
        )}

        <details className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
            연결코드를 모르겠어요
          </summary>
          <div className="mt-3 space-y-2 text-xs leading-5 text-[var(--text-muted)]">
            <p>
              📱 <strong className="text-[var(--text)]">자녀가 직접 발급</strong>: 자녀에게 ''마이페이지 → 보호자 초대 코드 받기''를 클릭해 6자리 코드를 받아 알려달라고 하세요.
            </p>
            <p>
              🏫 <strong className="text-[var(--text)]">학원에서 발급</strong>: 자녀가 다니는 학원에 문의하면 8자리 학생 등록 코드를 받을 수 있어요.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}

export default function ParentLinkOnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
          불러오는 중...
        </main>
      }
    >
      <ParentLinkOnboardingPageInner />
    </Suspense>
  );
}
