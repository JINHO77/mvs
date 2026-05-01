"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import HomeLink from "@/components/common/HomeLink";
import { supabase } from "@/lib/supabaseClient";

type ClaimResult =
  | { ok: true; student_id: string }
  | { ok: false; reason: "CODE_NOT_FOUND" | "CODE_ALREADY_USED" | "CODE_EXPIRED" | string };

type PreviewResult =
  | {
      ok: true;
      student_id: string;
      student_name: string | null;
      expires_at: string;
      used_at: string | null;
      status: "ACTIVE" | "EXPIRED" | "USED";
    }
  | { ok: false; reason: "CODE_NOT_FOUND" | string };

type PreviewStatus = "idle" | "loading" | "ready" | "error";
type ResultTone = "success" | "error" | "info";

function formatExpiryDate(value: string | null): string {
  if (!value) return "유효기간: 7일";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "유효기간: 7일";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}까지 사용 가능`;
}

function LinkStudentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const codeFromQuery = searchParams.get("code")?.trim().toUpperCase() ?? "";
  const redirectTarget = codeFromQuery ? `/link-student?code=${encodeURIComponent(codeFromQuery)}` : "/link-student";

  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [code, setCode] = useState(codeFromQuery);
  const [relation, setRelation] = useState("guardian");
  const [submitting, setSubmitting] = useState(false);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<ResultTone>("info");
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewExpiry, setPreviewExpiry] = useState<string | null>(null);
  const [previewCodeStatus, setPreviewCodeStatus] = useState<"ACTIVE" | "EXPIRED" | "USED" | null>(null);
  const [homeCtaVisible, setHomeCtaVisible] = useState(false);

  useEffect(() => {
    setCode(codeFromQuery);
  }, [codeFromQuery]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        router.replace(isDevMode ? "/dev-login" : `/login?role=parent&redirectTo=${encodeURIComponent(redirectTarget)}`);
        return;
      }

      const session = data.session;
      if (!session) {
        setSessionReady(false);
        setLoading(false);
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null }>();

      setRole(profileRow?.role ?? null);
      setSessionReady(true);
      setLoading(false);
    })();
  }, [isDevMode, redirectTarget, router]);

  useEffect(() => {
    if (!sessionReady) return;

    const normalized = code.trim().toUpperCase();
    if (normalized.length < 6) {
      setPreviewStatus("idle");
      setPreviewName(null);
      setPreviewExpiry(null);
      setPreviewCodeStatus(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewStatus("loading");

      const { data, error } = await supabase.rpc("preview_student_link_code", {
        p_code: normalized,
      });

      if (cancelled) return;

      if (error) {
        setPreviewStatus("error");
        return;
      }

      const result = data as PreviewResult;
      if (!result?.ok) {
        setPreviewStatus("error");
        setPreviewName(null);
        setPreviewExpiry(null);
        setPreviewCodeStatus(null);
        return;
      }

      setPreviewStatus("ready");
      setPreviewName(result.student_name?.trim() || "학생");
      setPreviewExpiry(result.expires_at);
      setPreviewCodeStatus(result.status);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, sessionReady]);

  const setResult = (title: string, message: string, tone: ResultTone) => {
    setResultTitle(title);
    setResultMessage(message);
    setResultTone(tone);
  };

  const submit = async () => {
    setHomeCtaVisible(false);
    setResultTitle(null);
    setResultMessage(null);

    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setResult("연결 코드를 확인해 주세요.", "예: ABCD1234", "error");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("claim_student_link_code", {
        p_code: trimmed,
        p_relation: relation,
      });

      if (error) {
        setResult("연결에 실패했어요.", error.message, "error");
        return;
      }

      const result = data as ClaimResult;
      if (!result?.ok) {
        if (result.reason === "CODE_EXPIRED") {
          setResult("만료된 코드입니다.", "새 QR 또는 연결 코드를 요청해 주세요.", "error");
          setPreviewCodeStatus("EXPIRED");
          return;
        }
        if (result.reason === "CODE_ALREADY_USED") {
          setResult("이미 사용된 코드입니다.", "이 코드는 최초 1회 연결용으로만 사용할 수 있어요.", "error");
          setPreviewCodeStatus("USED");
          return;
        }
        if (result.reason === "CODE_NOT_FOUND") {
          setResult("코드를 찾을 수 없어요.", "입력한 코드 또는 QR을 다시 확인해 주세요.", "error");
          return;
        }

        setResult("연결에 실패했어요.", result.reason, "error");
        return;
      }

      setPreviewCodeStatus("USED");
      setResult(
        "자녀 연결이 완료되었어요.",
        "이제 학부모 대시보드에서 리포트와 알림을 확인할 수 있어요.",
        "success",
      );
      setHomeCtaVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        로딩 중...
      </main>
    );
  }

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
        <div className="mx-auto w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <MvsHeaderLogo href="/" size="md" />
            <HomeLink fallbackHref="/" />
          </div>

          <h1 className="text-2xl font-semibold">자녀 연결하기</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            자녀 연결을 위해 먼저 학부모 계정이 필요해요.
            <br />
            학부모 로그인 또는 계정 만들기 후 연결을 이어갈 수 있어요.
          </p>

          {codeFromQuery && (
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text)]">
              연결 코드를 확인했어요: <span className="font-semibold tracking-[0.18em]">{codeFromQuery}</span>
              <div className="mt-2 text-xs text-[var(--text-muted)]">로그인 후 자동으로 이 코드가 유지됩니다.</div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href={`/login?role=parent&redirectTo=${encodeURIComponent(redirectTarget)}`}
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-center text-sm font-semibold text-[var(--bg)]"
            >
              학부모 로그인
            </Link>
            <Link
              href={`/signup?role=parent&redirectTo=${encodeURIComponent(redirectTarget)}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-center text-sm font-semibold text-[var(--text)]"
            >
              학부모 계정 만들기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const statusPanel =
    previewCodeStatus === "EXPIRED"
      ? {
          title: "만료된 코드입니다.",
          description: "새 QR 또는 연결 코드를 요청해 주세요.",
          className: "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
        }
      : previewCodeStatus === "USED"
        ? {
            title: "이미 사용된 코드입니다.",
            description: "이 코드는 최초 1회 연결용으로만 사용할 수 있어요.",
            className: "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
          }
        : {
            title: previewName ? `${previewName} 학생과 연결할 준비가 되었어요.` : "연결 코드를 확인 중이에요.",
            description:
              previewStatus === "loading"
                ? "코드 정보를 불러오고 있어요."
                : "로그인된 학부모 계정으로 자녀 연결을 진행할 수 있어요.",
            className: "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text)]",
          };

  return (
    <main className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <MvsHeaderLogo href="/" size="md" />
          <HomeLink fallbackHref="/" />
        </div>

        <h1 className="text-2xl font-semibold">자녀 연결하기</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">학부모 계정으로 로그인한 뒤 자녀 연결 코드를 입력하거나 QR을 스캔해 주세요.</p>

        {role !== "parent" && (
          <div className="mt-5 rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            학부모 계정으로 로그인한 뒤 자녀를 연결할 수 있어요.
          </div>
        )}

        {code.trim().length >= 6 && (
          <div className={`mt-5 rounded-2xl border p-4 ${statusPanel.className}`}>
            <div className="text-sm font-semibold">{statusPanel.title}</div>
            <div className="mt-1 text-sm opacity-90">{statusPanel.description}</div>
            {previewName && previewCodeStatus !== "USED" && previewCodeStatus !== "EXPIRED" && (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)]">
                학생 이름: {previewName}
              </div>
            )}
            <div className="mt-3 text-xs opacity-80">{formatExpiryDate(previewExpiry)}</div>
            <div className="mt-1 text-xs opacity-80">연결 코드는 최초 1회 연결에만 사용돼요.</div>
          </div>
        )}

        <label className="mb-2 mt-6 block text-sm text-[var(--text-muted)]">연결 코드</label>
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="예: ABCD1234"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
        />

        <label className="mb-2 mt-4 block text-sm text-[var(--text-muted)]">관계 선택</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
        >
          <option value="guardian">보호자</option>
          <option value="mother">어머니</option>
          <option value="father">아버지</option>
        </select>

        <button
          type="button"
          className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
          onClick={() => void submit()}
          disabled={role !== "parent" || submitting || previewCodeStatus === "EXPIRED" || previewCodeStatus === "USED"}
        >
          {submitting ? "연결 중..." : "자녀 연결하기"}
        </button>

        {resultTitle && (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm ${
              resultTone === "success"
                ? "border-[var(--success-text)] bg-[var(--success-bg)] text-[var(--success-text)]"
                : resultTone === "error"
                  ? "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
                  : "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text)]"
            }`}
          >
            <div className="font-semibold">{resultTitle}</div>
            <div className="mt-1">{resultMessage}</div>
          </div>
        )}

        {homeCtaVisible && (
          <button
            type="button"
            className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
            onClick={() => router.push("/parent")}
          >
            학부모 대시보드로 이동
          </button>
        )}
      </div>
    </main>
  );
}

export default function LinkStudentPage() {
  return (
    <Suspense>
      <LinkStudentPageInner />
    </Suspense>
  );
}
