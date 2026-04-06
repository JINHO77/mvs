"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { isUuid } from "@/lib/validators";

type StudentStatus = "active" | "pending" | "blocked" | "withdrawn";
type StatusFilter = "all" | StudentStatus;

type StudentRow = {
  id: string;
  academy_id: string | null;
  email: string | null;
  name: string | null;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
  student_no: string | null;
  account_status: StudentStatus | null;
  created_at: string;
};

type PendingStudentRow = {
  id: string;
  name: string | null;
  email: string | null;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
  created_at: string;
};

function levelLabel(level: string | null): string {
  if (level === "elem") return "초";
  if (level === "mid") return "중";
  if (level === "high") return "고";
  return "-";
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

function statusBadgeClass(status: StudentStatus): string {
  if (status === "pending") return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]";
  if (status === "blocked") return "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]";
  if (status === "withdrawn") return "border-[var(--text-muted)] bg-[var(--card-soft)] text-[var(--text-muted)]";
  return "border-[var(--success-text)] bg-[var(--success-bg)] text-[var(--success-text)]";
}

function statusLabel(status: StudentStatus): string {
  if (status === "pending") return "승인대기";
  if (status === "blocked") return "차단";
  if (status === "withdrawn") return "탈퇴";
  return "활성";
}

export default function OwnerStudentsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [ownerAcademyId, setOwnerAcademyId] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [pendingStudents, setPendingStudents] = useState<PendingStudentRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

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
      setError(toPrettyErrorString(sessionError));
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role, account_status, academy_id")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null; account_status: string | null; academy_id: string | null }>();
    if (meError) {
      setError(toPrettyErrorString(meError));
      setLoading(false);
      return;
    }
    if (me?.role !== "owner") {
      router.replace("/");
      return;
    }
    if ((me?.account_status ?? "active") !== "active") {
      router.replace("/login");
      return;
    }

    setOwnerAcademyId(isUuid(me?.academy_id) ? me.academy_id : null);

    await refreshLists();
    setLoading(false);
  };

  const refreshLists = async () => {
    const [studentsRes, pendingRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,academy_id,email,name,school_level,grade,class_label,student_no,account_status,created_at")
        .eq("role", "student")
        .order("created_at", { ascending: false })
        .returns<StudentRow[]>(),
      supabase
        .from("profiles")
        .select("id,name,email,school_level,grade,class_label,created_at")
        .eq("role", "student")
        .eq("account_status", "pending")
        .order("created_at", { ascending: false })
        .returns<PendingStudentRow[]>(),
    ]);

    if (studentsRes.error) {
      console.error("Owner students load failed:", toPrettyErrorString(studentsRes.error), studentsRes.error);
      setError(toPrettyErrorString(studentsRes.error));
      return;
    }
    if (pendingRes.error) {
      console.error("Owner pending students load failed:", toPrettyErrorString(pendingRes.error), pendingRes.error);
      setError(toPrettyErrorString(pendingRes.error));
      return;
    }

    setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
    setPendingStudents(Array.isArray(pendingRes.data) ? pendingRes.data : []);
  };

  const updateStatus = async (studentId: string, status: StudentStatus) => {
    setError(null);
    setSuccess(null);
    setBusyId(studentId);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ account_status: status })
        .eq("id", studentId)
        .eq("role", "student");
      if (updateError) throw updateError;
      await refreshLists();
      setSuccess(`상태를 ${statusLabel(status)}로 변경했습니다.`);
    } catch (e: unknown) {
      console.error("Owner student status update failed:", toPrettyErrorString(e), e);
      setError(toPrettyErrorString(e));
    } finally {
      setBusyId(null);
    }
  };

  const linkStudentToAcademy = async (studentId: string) => {
    if (!isUuid(ownerAcademyId)) {
      setError("학원 소속 정보가 없습니다. 먼저 학원 설정을 완료해 주세요.");
      return;
    }
    if (!window.confirm("선택한 학생을 현재 원장님의 학원 소속으로 연결할까요?")) return;

    setError(null);
    setSuccess(null);
    setBusyId(studentId);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ academy_id: ownerAcademyId })
        .eq("id", studentId)
        .eq("role", "student")
        .is("academy_id", null);
      if (updateError) throw updateError;

      setStudents((prev) => prev.map((row) => (row.id === studentId ? { ...row, academy_id: ownerAcademyId } : row)));
      setSuccess("학생 학원 소속을 연결했습니다.");
    } catch (e: unknown) {
      console.error("Owner student academy link failed:", toPrettyErrorString(e), e);
      setError(toPrettyErrorString(e));
    } finally {
      setBusyId(null);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return students.filter((row) => {
      const status = (row.account_status ?? "active") as StudentStatus;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        row.name ?? "",
        row.email ?? "",
        row.school_level ?? "",
        row.grade != null ? String(row.grade) : "",
        row.class_label ?? "",
        row.student_no ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [students, statusFilter, keyword]);

  if (loading) {
    return <PageShell maxWidthClassName="max-w-6xl">로딩 중...</PageShell>;
  }

  return (
    <PageShell title="학생 관리" subtitle="승인대기 확인 및 학생 계정 상태를 관리합니다." maxWidthClassName="max-w-6xl">
      <SectionCard>
        {error && (
          <div className="mb-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">
            {success}
          </div>
        )}

        {!isUuid(ownerAcademyId) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">
            <div>학원 소속 정보가 없어 학생 연결을 진행할 수 없습니다.</div>
            <Link href="/onboarding/academy" className="rounded-lg border border-[var(--accent)] px-2 py-1 text-xs font-semibold">
              학원 설정으로 이동
            </Link>
          </div>
        )}

        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
          <div className="text-sm text-[var(--text-muted)]">승인대기</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{pendingStudents.length}명</div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">승인 대기 목록</h2>
          {pendingStudents.length === 0 ? (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--card-soft)] p-3 text-sm text-[var(--text-muted)]">
              승인 대기 학생이 없습니다.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {pendingStudents.map((row) => (
                <div key={row.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-semibold text-[var(--text)]">{row.name?.trim() || row.id.slice(0, 8)}</div>
                    <div className="text-xs text-[var(--text-muted)]">{row.email ?? "-"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{`${levelLabel(row.school_level)} ${row.grade ?? "-"} / ${row.class_label?.trim() || "-"}`}</div>
                    <div className="text-xs text-[var(--text-muted)]">가입: {formatDate(row.created_at)}</div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="w-full rounded-lg border border-[var(--success-text)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success-text)] disabled:opacity-60 sm:w-auto"
                      onClick={() => void updateStatus(row.id, "active")}
                      disabled={busyId === row.id}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-[var(--danger-text)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)] disabled:opacity-60 sm:w-auto"
                      onClick={() => void updateStatus(row.id, "blocked")}
                      disabled={busyId === row.id}
                    >
                      차단
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              type="text"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder="이름/이메일/학년/반 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <select
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">전체</option>
              <option value="active">active</option>
              <option value="pending">pending</option>
              <option value="blocked">blocked</option>
              <option value="withdrawn">withdrawn</option>
            </select>
          </div>

          <div className="mt-2 text-xs text-[var(--text-muted)]">표시: {filteredStudents.length} / 전체: {students.length}</div>

          <div className="mt-3 space-y-2">
            {filteredStudents.length === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card-soft)] p-3 text-sm text-[var(--text-muted)]">
                조건에 맞는 학생이 없습니다.
              </div>
            ) : (
              filteredStudents.map((row) => {
                const status = (row.account_status ?? "active") as StudentStatus;
                return (
                  <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{row.name?.trim() || row.id.slice(0, 8)}</div>
                        <div className="text-xs text-[var(--text-muted)]">{row.email ?? "-"}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.academy_id ? (
                          <span className="inline-flex rounded-full border border-[var(--success-text)] bg-[var(--success-bg)] px-2 py-0.5 text-xs text-[var(--success-text)]">
                            소속 설정됨
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-[var(--danger-text)] bg-[var(--danger-bg)] px-2 py-0.5 text-xs text-[var(--danger-text)]">
                            소속 미설정
                          </span>
                        )}
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      {`${levelLabel(row.school_level)} ${row.grade ?? "-"}학년 ${row.class_label?.trim() || "-"}반`}
                      {row.student_no?.trim() ? ` / 학번 ${row.student_no.trim()}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">가입: {formatDate(row.created_at)}</div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      {!row.academy_id && (
                        <button
                          type="button"
                          className="w-full rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)] disabled:opacity-60 sm:w-auto"
                          onClick={() => void linkStudentToAcademy(row.id)}
                          disabled={busyId === row.id || !isUuid(ownerAcademyId)}
                        >
                          {busyId === row.id ? "처리 중..." : "학원 소속 연결"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="w-full rounded-lg border border-[var(--success-text)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success-text)] disabled:opacity-60 sm:w-auto"
                        onClick={() => void updateStatus(row.id, "active")}
                        disabled={busyId === row.id}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)] disabled:opacity-60 sm:w-auto"
                        onClick={() => void updateStatus(row.id, "pending")}
                        disabled={busyId === row.id}
                      >
                        대기
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-[var(--danger-text)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)] disabled:opacity-60 sm:w-auto"
                        onClick={() => void updateStatus(row.id, "blocked")}
                        disabled={busyId === row.id}
                      >
                        차단
                      </button>
                      {status !== "withdrawn" ? (
                        <button
                          type="button"
                          className="w-full rounded-lg border border-[var(--text-muted)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)] disabled:opacity-60 sm:w-auto"
                          onClick={() => void updateStatus(row.id, "withdrawn")}
                          disabled={busyId === row.id}
                        >
                          탈퇴 처리
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded-lg border border-[var(--success-text)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success-text)] disabled:opacity-60 sm:w-auto"
                          onClick={() => void updateStatus(row.id, "active")}
                          disabled={busyId === row.id}
                        >
                          복구
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
