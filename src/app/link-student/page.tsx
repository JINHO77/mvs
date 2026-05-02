"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import HomeLink from "@/components/common/HomeLink";
import QrScannerModal from "@/components/parent/QrScannerModal";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

type Relation = "parent" | "guardian" | "mother" | "father" | "other";

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

type LinkedChild = {
  studentId: string;
  name: string;
  relation: Relation;
  schoolLevel: string | null;
  grade: number | null;
};

type StudentProfileRow = {
  name: string | null;
  school_level: string | null;
  grade: number | null;
};

function gradeLabel(schoolLevel: string | null | undefined, grade: number | null | undefined): string {
  if (!schoolLevel || grade == null) return "";
  if (schoolLevel === "elementary") return `초등학교 ${grade}학년`;
  if (schoolLevel === "middle") return `중학교 ${grade}학년`;
  if (schoolLevel === "high") return `고등학교 ${grade}학년`;
  return `${grade}학년`;
}

function formatExpiryDate(value: string | null): string {
  if (!value) return "유효기간: 7일";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "유효기간: 7일";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}까지 사용 가능`;
}

function relationLabel(relation: Relation): string {
  switch (relation) {
    case "parent":
      return "부모";
    case "mother":
      return "어머니";
    case "father":
      return "아버지";
    case "guardian":
      return "보호자";
    case "other":
      return "기타";
    default:
      return "보호자";
  }
}

function sanitizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function LinkStudentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const codeFromQuery = sanitizeCode(searchParams.get("code") ?? "");
  const redirectTarget = codeFromQuery
    ? `/link-student?code=${encodeURIComponent(codeFromQuery)}`
    : "/link-student";

  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [code, setCode] = useState(codeFromQuery);
  const [relation, setRelation] = useState<Relation>("parent");
  const [submitting, setSubmitting] = useState(false);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<ResultTone>("info");
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewExpiry, setPreviewExpiry] = useState<string | null>(null);
  const [previewCodeStatus, setPreviewCodeStatus] = useState<"ACTIVE" | "EXPIRED" | "USED" | null>(null);
  const [linkedChild, setLinkedChild] = useState<LinkedChild | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (codeFromQuery) setCode(codeFromQuery);
  }, [codeFromQuery]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        router.replace(
          isDevMode ? "/dev-login" : `/login?role=parent&redirectTo=${encodeURIComponent(redirectTarget)}`,
        );
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

      if (!mounted) return;
      setRole(profileRow?.role ?? null);
      setSessionReady(true);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [isDevMode, redirectTarget, router]);

  // 8자리 코드만 사전 미리보기 (preview RPC). 6자리는 redeem 응답으로 사후 확인.
  useEffect(() => {
    if (!sessionReady) return;

    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 8) {
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

  const fetchStudentProfile = async (studentId: string): Promise<StudentProfileRow | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("name, school_level, grade")
      .eq("id", studentId)
      .maybeSingle<StudentProfileRow>();
    if (error) {
      console.warn("[link-student] fetch student profile failed", error);
      return null;
    }
    return data ?? null;
  };

  const submit = async () => {
    setLinkedChild(null);
    setResultTitle(null);
    setResultMessage(null);

    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6 && trimmed.length !== 8) {
      setResult("연결 코드를 확인해 주세요.", "코드는 6자리 또는 8자리예요.", "error");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setResult("세션이 만료됐어요.", "다시 로그인한 뒤 시도해 주세요.", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (trimmed.length === 8) {
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
        const fallbackName = previewName?.trim() || "자녀";
        const studentId = result.student_id;
        const profile = await fetchStudentProfile(studentId);
        const studentName = profile?.name?.trim() || fallbackName;
        setLinkedChild({
          studentId,
          name: studentName,
          relation,
          schoolLevel: profile?.school_level ?? null,
          grade: profile?.grade ?? null,
        });
        setResult(
          `${studentName}와 연결되었어요!`,
          "이제 학부모 대시보드에서 리포트와 알림을 확인할 수 있어요.",
          "success",
        );
      } else {
        const { data, error } = await supabase.rpc("redeem_guardian_invitation", {
          p_guardian_id: session.user.id,
          p_invitation_code: trimmed,
          p_relation: relation,
        });
        if (error) {
          setResult("연결에 실패했어요.", error.message, "error");
          return;
        }

        const result = data as RedeemResult | null;
        if (!result?.success) {
          setResult("연결에 실패했어요.", result?.error ?? "유효하지 않거나 만료된 코드예요.", "error");
          return;
        }

        const fallbackName = result.student_name?.trim() || "자녀";
        const studentId = result.student_id ?? "";
        const profile = studentId ? await fetchStudentProfile(studentId) : null;
        const studentName = profile?.name?.trim() || fallbackName;
        setLinkedChild({
          studentId,
          name: studentName,
          relation,
          schoolLevel: profile?.school_level ?? null,
          grade: profile?.grade ?? null,
        });
        setResult(
          result.already_linked ? `${studentName}는 이미 연결되어 있어요.` : `${studentName}와 연결되었어요!`,
          "이제 학부모 대시보드에서 리포트와 알림을 확인할 수 있어요.",
          "success",
        );
      }
    } catch (e: unknown) {
      console.error("[link-student] submit failed", e);
      setResult("연결에 실패했어요.", toPrettyErrorString(e), "error");
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

          <h1 className="text-2xl font-semibold">👨‍👩‍👧 자녀 연결하기</h1>
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

  const showPreviewPanel = code.trim().length === 8;
  const previewPanel =
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
            title: previewName ? `이 학생이 맞나요? — ${previewName}` : "연결 코드를 확인 중이에요.",
            description:
              previewStatus === "loading"
                ? "코드 정보를 불러오고 있어요."
                : previewStatus === "ready"
                  ? "맞으면 아래 \"자녀 연결하기\"를 눌러주세요."
                  : "코드 정보를 확인할 수 없어요.",
            className: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]",
          };

  const submitDisabled =
    role !== "parent" ||
    submitting ||
    (code.trim().length !== 6 && code.trim().length !== 8) ||
    previewCodeStatus === "EXPIRED" ||
    previewCodeStatus === "USED" ||
    !!linkedChild;

  return (
    <main className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <MvsHeaderLogo href="/" size="md" />
          <HomeLink fallbackHref="/" />
        </div>

        <h1 className="text-2xl font-semibold">👨‍👩‍👧 자녀 연결하기</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          학원 또는 자녀에게서 받은 코드를 입력하거나 QR을 스캔해 주세요.
        </p>

        {role !== "parent" && (
          <div className="mt-5 rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            학부모 계정으로 로그인한 뒤 자녀를 연결할 수 있어요.
          </div>
        )}

        {showPreviewPanel && (
          <div className={`mt-5 rounded-2xl border p-4 ${previewPanel.className}`}>
            <div className="text-sm font-semibold">{previewPanel.title}</div>
            <div className="mt-1 text-sm opacity-90">{previewPanel.description}</div>
            <div className="mt-3 text-xs opacity-80">{formatExpiryDate(previewExpiry)}</div>
            <div className="mt-1 text-xs opacity-80">연결 코드는 최초 1회 연결에만 사용돼요.</div>
          </div>
        )}

        <label className="mb-2 mt-6 block text-sm text-[var(--text-muted)]">연결 코드</label>
        <input
          type="text"
          inputMode="text"
          lang="en"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] placeholder:tracking-normal placeholder:text-base focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="예: K7M3PQ"
          value={code}
          onChange={(e) => setCode(sanitizeCode(e.target.value))}
          onCompositionEnd={(e) => setCode(sanitizeCode((e.target as HTMLInputElement).value))}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
        >
          📷 QR 스캔하기
        </button>

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
          💡 <strong className="text-[var(--text)]">기본 코드</strong>: 6자리 (예: K7M3PQ) — 자녀 또는 학원에서 받은 코드<br />
          📦 <strong className="text-[var(--text)]">기존 8자리 코드</strong>도 입력 가능해요 (만료 전까지 호환)<br />
          ⌨️ 알파벳이 안 들어가면 한/영 키로 영문 모드로 전환해 주세요.
        </div>

        <label className="mb-2 mt-4 block text-sm text-[var(--text-muted)]">자녀와의 관계</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={relation}
          onChange={(e) => setRelation(e.target.value as Relation)}
        >
          <option value="parent">부모</option>
          <option value="mother">어머니</option>
          <option value="father">아버지</option>
          <option value="guardian">보호자</option>
          <option value="other">기타</option>
        </select>

        <button
          type="button"
          className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
          onClick={() => void submit()}
          disabled={submitDisabled}
        >
          {submitting ? "연결 중..." : "자녀 연결하기"}
        </button>

        {linkedChild && (
          <div className="mt-4 rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 text-sm text-[var(--success-text)]">
            <div className="text-base font-semibold">✅ 연결되었어요!</div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-14 shrink-0 opacity-80">학생</dt>
                <dd className="font-semibold">{linkedChild.name}</dd>
              </div>
              {gradeLabel(linkedChild.schoolLevel, linkedChild.grade) && (
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 opacity-80">학년</dt>
                  <dd>{gradeLabel(linkedChild.schoolLevel, linkedChild.grade)}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-14 shrink-0 opacity-80">관계</dt>
                <dd>{relationLabel(linkedChild.relation)}</dd>
              </div>
            </dl>
          </div>
        )}

        {resultTitle && !linkedChild && (
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

        {linkedChild && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)]"
              onClick={() => router.push("/parent")}
            >
              학부모 대시보드로 이동
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
              onClick={() => {
                setCode("");
                setLinkedChild(null);
                setResultTitle(null);
                setResultMessage(null);
                setPreviewCodeStatus(null);
                setPreviewName(null);
                setPreviewExpiry(null);
              }}
            >
              다른 자녀 연결하기
            </button>
          </div>
        )}

        <details className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
            코드를 모르겠어요
          </summary>
          <div className="mt-3 space-y-2 text-xs leading-5 text-[var(--text-muted)]">
            <p>
              📱 <strong className="text-[var(--text)]">자녀가 직접 발급</strong>: 자녀에게 마이페이지 → 보호자 초대 코드 받기를 눌러 6자리 코드를 받아 알려달라고 하세요.
            </p>
            <p>
              🏫 <strong className="text-[var(--text)]">학원에서 발급</strong>: 자녀가 다니는 학원에 문의하면 연결 코드 또는 QR을 받을 수 있어요.
            </p>
          </div>
        </details>
      </div>

      {scannerOpen && (
        <QrScannerModal
          onResult={(scanned) => {
            setCode(scanned);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </main>
  );
}

export default function LinkStudentPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
          로딩 중...
        </main>
      }
    >
      <LinkStudentPageInner />
    </Suspense>
  );
}
