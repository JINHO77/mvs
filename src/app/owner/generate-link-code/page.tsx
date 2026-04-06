"use client";

import QRCode from "react-qr-code";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";

type Student = {
  id: string;
  name: string | null;
  email: string | null;
};

type PageState = "loading" | "ready";

type IssueResult =
  | { ok: true; code: string; expires_at: string }
  | { ok: false; reason?: string };

type StoredCodeEntry = {
  code: string;
  expiresAt: string;
};

type QrModalState = {
  studentId: string;
  studentName: string;
  code: string;
  expiresAt: string;
};

const STORAGE_KEY = "latestStudentLinkCodes";

function buildLinkUrl(code: string): string {
  if (typeof window === "undefined") return `/link-student?code=${encodeURIComponent(code)}`;
  return `${window.location.origin}/link-student?code=${encodeURIComponent(code)}`;
}

function formatExpiryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "유효기간: 7일";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}까지 사용 가능`;
}

export default function GenerateLinkCodePage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [preselectedStudentId, setPreselectedStudentId] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, StoredCodeEntry>>({});
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const studentId = new URLSearchParams(window.location.search).get("studentId");
    setPreselectedStudentId(studentId);

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Record<string, string | StoredCodeEntry>;
      if (!parsed || typeof parsed !== "object") return;

      const normalized = Object.fromEntries(
        Object.entries(parsed).flatMap(([studentIdKey, value]) => {
          if (typeof value === "string") {
            return [[studentIdKey, { code: value, expiresAt: "" } satisfies StoredCodeEntry]];
          }
          if (!value || typeof value.code !== "string") return [];
          return [
            [
              studentIdKey,
              {
                code: value.code,
                expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : "",
              } satisfies StoredCodeEntry,
            ],
          ];
        }),
      );

      setGeneratedCodes(normalized);
    } catch {
      // Ignore stale local storage values.
    }
  }, []);

  const initialize = async () => {
    setPageError(null);

    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setPageError(`세션 확인 실패: ${sessionError.message}`);
      setPageState("ready");
      return;
    }

    const session = data.session;
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<{ role: string }>();

    if (meError) {
      setPageError(`권한 확인 실패: ${meError.message}`);
      setPageState("ready");
      return;
    }

    if (me.role !== "owner" && me.role !== "teacher") {
      router.replace("/");
      return;
    }

    const { data: studentRows, error: studentsError } = await supabase.rpc("list_students");
    if (studentsError) {
      setPageError(`학생 목록 조회 실패: ${studentsError.message}`);
      setPageState("ready");
      return;
    }

    if (!Array.isArray(studentRows)) {
      setPageError("학생 목록 응답 형식이 올바르지 않습니다.");
      setStudents([]);
      setPageState("ready");
      return;
    }

    setStudents(studentRows as Student[]);
    setPageState("ready");
  };

  const writeStoredCodes = (next: Record<string, StoredCodeEntry>) => {
    setGeneratedCodes(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleIssueCode = async (studentId: string) => {
    setActionError(null);
    setBusyStudentId(studentId);

    try {
      const { data, error } = await supabase.rpc("issue_student_link_code", {
        p_student_id: studentId,
        p_days: 7,
      });

      if (error) throw new Error(error.message);

      const result = data as IssueResult;
      if (!result || result.ok !== true || !result.code) {
        throw new Error("코드 발급 결과가 올바르지 않습니다.");
      }

      writeStoredCodes({
        ...generatedCodes,
        [studentId]: {
          code: result.code,
          expiresAt: result.expires_at,
        },
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "코드 발급 중 오류가 발생했습니다.");
    } finally {
      setBusyStudentId(null);
    }
  };

  const copyCode = async (studentId: string) => {
    const issued = generatedCodes[studentId];
    if (!issued?.code) return;

    try {
      await navigator.clipboard.writeText(issued.code);
      setCopiedStudentId(studentId);
      window.setTimeout(() => {
        setCopiedStudentId((prev) => (prev === studentId ? null : prev));
      }, 1200);
    } catch {
      setActionError("코드 복사에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const openQrModal = (student: Student) => {
    const issued = generatedCodes[student.id];
    if (!issued) return;

    setQrModal({
      studentId: student.id,
      studentName: student.name?.trim() || "학생",
      code: issued.code,
      expiresAt: issued.expiresAt,
    });
  };

  if (pageState === "loading") {
    return <PageShell maxWidthClassName="max-w-4xl">로딩 중...</PageShell>;
  }

  const orderedStudents = preselectedStudentId
    ? [
        ...students.filter((student) => student.id === preselectedStudentId),
        ...students.filter((student) => student.id !== preselectedStudentId),
      ]
    : students;

  return (
    <PageShell
      title="학생 연결 코드 발급"
      subtitle="보호자에게 전달할 연결 코드와 QR을 바로 준비할 수 있어요."
      maxWidthClassName="max-w-4xl"
      rightSlot={<HomeLink fallbackHref="/owner" />}
    >
      <SectionCard className="mx-auto w-full max-w-4xl p-6">
        {pageError && (
          <div className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {pageError}
          </div>
        )}

        {actionError && (
          <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {actionError}
          </div>
        )}

        <div className="mt-2 grid grid-cols-1 gap-4">
          {orderedStudents.length === 0 ? (
            <SectionCard className="p-4 text-sm text-[var(--muted)] shadow-none">
              학생 프로필이 없습니다.
            </SectionCard>
          ) : (
            orderedStudents.map((student) => {
              const issuedCode = generatedCodes[student.id];
              const isBusy = busyStudentId === student.id;
              const isPreselected = preselectedStudentId === student.id;

              return (
                <SectionCard key={student.id} className="overflow-hidden p-5 md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-[var(--text)]">{student.name || "이름 없음"}</div>
                        {isPreselected && (
                          <span className="inline-flex items-center rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
                            선택된 학생
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm text-[var(--muted)]">{student.email || "이메일 없음"}</div>
                      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text)]">
                        {issuedCode ? (
                          <>
                            <div className="text-xs text-[var(--text-muted)]">연결 코드</div>
                            <div className="mt-1 font-semibold tracking-[0.22em] text-[var(--text)]">{issuedCode.code}</div>
                            <div className="mt-2 text-xs text-[var(--text-muted)]">{formatExpiryDate(issuedCode.expiresAt)}</div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">발급일로부터 7일 동안 사용할 수 있어요.</div>
                          </>
                        ) : (
                          <span className="text-[var(--text-muted)]">코드를 발급하면 보호자에게 복사하거나 QR로 바로 안내할 수 있어요.</span>
                        )}
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto">
                      <button
                        type="button"
                        className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
                        onClick={() => void handleIssueCode(student.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? "발급 중..." : "코드 발급"}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void copyCode(student.id)}
                        disabled={!issuedCode}
                      >
                        {copiedStudentId === student.id ? "복사됨" : "복사"}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => openQrModal(student)}
                        disabled={!issuedCode}
                      >
                        QR 보기
                      </button>
                    </div>
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>
      </SectionCard>

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,11,20,0.82)] p-4">
          <div className="w-full max-w-md rounded-[30px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[var(--text)]">보호자 연결 QR</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">보호자가 이 QR을 스캔하면 학생 연결 화면으로 이동해요.</p>
            </div>

            <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-white p-5">
              <div className="mx-auto w-full max-w-[280px]">
                <QRCode
                  value={buildLinkUrl(qrModal.code)}
                  size={280}
                  style={{ width: "100%", height: "auto" }}
                  viewBox="0 0 256 256"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-center">
              <div className="text-sm font-medium text-[var(--text)]">{qrModal.studentName}</div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">연결 코드</div>
              <div className="mt-1 font-semibold tracking-[0.22em] text-[var(--text)]">{qrModal.code}</div>
              <div className="mt-3 text-xs text-[var(--text-muted)]">{formatExpiryDate(qrModal.expiresAt)}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">발급일로부터 7일 동안 사용할 수 있어요.</div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)]"
                onClick={() => void copyCode(qrModal.studentId)}
              >
                코드 복사
              </button>
              <button
                type="button"
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
                onClick={() => setQrModal(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
