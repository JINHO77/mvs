"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import { PARENT_LINK_ONBOARDING_TEXT } from "@/constants/parentLinkOnboarding.ko";
import { getLinkedStudentCountForGuardian } from "@/lib/parentGuard";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type ClaimResult =
  | { ok: true; student_id: string }
  | { ok: false; reason: "CODE_NOT_FOUND" | "CODE_ALREADY_USED" | "CODE_EXPIRED" | string };

export default function ParentLinkOnboardingPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [relation, setRelation] = useState<string>("guardian");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        const role = profileRow?.role ?? "";
        if (role !== "parent") {
          router.replace("/");
          return;
        }

        const linkedCount = await getLinkedStudentCountForGuardian(session.user.id);
        if (linkedCount > 0) {
          router.replace("/parent");
          return;
        }
      } catch (e: unknown) {
        if (!mounted) return;
        setError(toPrettyErrorString(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void initialize();
    return () => {
      mounted = false;
    };
  }, [isDevMode, router]);

  const prettyReason = (reason: string) => {
    if (reason === "CODE_ALREADY_USED") {
      return "이미 사용된 연결 코드입니다.";
    }
    if (reason === "CODE_EXPIRED") {
      return "만료된 연결 코드입니다.";
    }

    switch (reason) {
      case "CODE_NOT_FOUND":
        return "연결코드를 찾을 수 없습니다.";
      case "CODE_ALREADY_USED":
        return "이미 사용된 연결코드입니다.";
      case "CODE_EXPIRED":
        return "만료된 연결코드입니다.";
      default:
        return `${PARENT_LINK_ONBOARDING_TEXT.failedPrefix}: ${reason}`;
    }
  };

  const submit = async () => {
    setError(null);
    setMessage(null);
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setError(PARENT_LINK_ONBOARDING_TEXT.codeTooShort);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: claimError } = await supabase.rpc("claim_student_link_code", {
        p_code: trimmed,
        p_relation: relation,
      });
      if (claimError) throw claimError;

      const result = data as ClaimResult;
      if (!result?.ok) {
        setError(prettyReason(result?.reason ?? "UNKNOWN"));
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace(isDevMode ? "/dev-login" : "/login");
        return;
      }

      const linkedCount = await getLinkedStudentCountForGuardian(session.user.id);
      if (linkedCount > 0) {
        setMessage(PARENT_LINK_ONBOARDING_TEXT.success);
        setTimeout(() => {
          router.replace("/parent");
        }, 600);
      } else {
        setError(`${PARENT_LINK_ONBOARDING_TEXT.failedPrefix}: linked student not found`);
      }
    } catch (e: unknown) {
      console.error("Parent onboarding link failed:", toPrettyErrorString(e), e);
      setError(toPrettyErrorString(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        {PARENT_LINK_ONBOARDING_TEXT.submitting}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <MvsHeaderLogo href="/parent" size="md" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">{PARENT_LINK_ONBOARDING_TEXT.title}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{PARENT_LINK_ONBOARDING_TEXT.subtitle}</p>

        <label className="mt-5 block text-sm text-[var(--text)]">{PARENT_LINK_ONBOARDING_TEXT.codeLabel}</label>
        <input
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={PARENT_LINK_ONBOARDING_TEXT.codePlaceholder}
          autoCapitalize="characters"
          autoCorrect="off"
        />

        <label className="mt-4 block text-sm text-[var(--text)]">{PARENT_LINK_ONBOARDING_TEXT.relationLabel}</label>
        <select
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
        >
          <option value="guardian">{PARENT_LINK_ONBOARDING_TEXT.relationGuardian}</option>
          <option value="mother">{PARENT_LINK_ONBOARDING_TEXT.relationMother}</option>
          <option value="father">{PARENT_LINK_ONBOARDING_TEXT.relationFather}</option>
        </select>

        <button
          type="button"
          className="mt-5 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? PARENT_LINK_ONBOARDING_TEXT.submitting : PARENT_LINK_ONBOARDING_TEXT.submit}
        </button>

        {message && (
          <div className="mt-4 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3">
          <p className="text-sm font-medium text-[var(--text)]">{PARENT_LINK_ONBOARDING_TEXT.helpTitle}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{PARENT_LINK_ONBOARDING_TEXT.helpDescription}</p>
        </div>
      </div>
    </main>
  );
}
