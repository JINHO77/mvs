"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureOwnerAcademy } from "@/lib/academy";
import { prettyUserError } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { isUuid } from "@/lib/validators";

type PageState = "loading" | "ready";

const DEFAULT_ACADEMY_NAME = "MVS (Most Valuable Student)";

export default function OnboardingAcademyPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academyName, setAcademyName] = useState(DEFAULT_ACADEMY_NAME);
  const [userId, setUserId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const logOnceRef = useRef<Set<string>>(new Set());

  const logErrorOnce = (key: string, message: string, cause: unknown, extra?: Record<string, unknown>) => {
    if (logOnceRef.current.has(key)) return;
    logOnceRef.current.add(key);
    console.error(message, toPrettyErrorString(cause), cause, extra ?? {});
  };

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setError(null);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      logErrorOnce("onboarding-academy-session", "Onboarding academy session load failed:", sessionError);
      setError(prettyUserError(sessionError));
      setPageState("ready");
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const uid = session.user.id;
    setUserId(uid);

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("id,role,academy_id,account_status")
      .eq("id", uid)
      .maybeSingle<{ id: string; role: string | null; academy_id: string | null; account_status: string | null }>();

    if (meError) {
      logErrorOnce("onboarding-academy-profile", "Onboarding academy profile load failed:", meError, { userId: uid, academyId: null });
      setError(prettyUserError(meError));
      setPageState("ready");
      return;
    }

    if (me?.role !== "owner") {
      if (me?.role === "teacher") router.replace("/owner");
      else if (me?.role === "student") router.replace("/student");
      else if (me?.role === "parent") router.replace("/parent");
      else router.replace("/onboarding/role");
      return;
    }
    if ((me?.account_status ?? "active") !== "active") {
      router.replace("/onboarding/pending");
      return;
    }

    if (isUuid(me?.academy_id)) {
      router.replace("/owner");
      return;
    }

    setAcademyId(me?.academy_id ?? null);
    setPageState("ready");
    await createAcademy(DEFAULT_ACADEMY_NAME, uid, me?.academy_id ?? null);
  };

  const createAcademy = async (name: string, uid?: string | null, currentAcademyId?: string | null) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const createdAcademyId = await ensureOwnerAcademy(name);
      setAcademyId(createdAcademyId);
      router.replace("/owner/reports");
    } catch (e: unknown) {
      logErrorOnce("onboarding-academy-create", "Onboarding academy auto-create failed:", e, {
        userId: uid ?? userId,
        academyId: currentAcademyId ?? academyId,
      });
      setError(prettyUserError(e));
    } finally {
      setBusy(false);
    }
  };

  if (pageState === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">로딩 중...</main>;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-semibold">학원 설정</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          원장 계정에 학원 정보가 없어 기본 학원 생성을 시도했습니다. 실패한 경우 이름을 확인한 뒤 다시 생성해 주세요.
        </p>
        {error && <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">{error}</div>}
        <label className="mt-4 block text-sm text-[var(--text-muted)]">
          학원 이름
          <input
            type="text"
            value={academyName}
            onChange={(e) => setAcademyName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            maxLength={80}
          />
        </label>
        <button
          type="button"
          onClick={() => void createAcademy(academyName)}
          disabled={busy}
          className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
        >
          {busy ? "설정 중..." : "학원 생성하고 계속"}
        </button>
      </div>
    </main>
  );
}
