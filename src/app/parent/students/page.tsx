"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";

type SchoolLevel = "elem" | "mid" | "high";
type PageState = "loading" | "ready";

type MyStudentRow = {
  student_id: string;
  name: string | null;
  email: string | null;
  school_level: SchoolLevel | null;
  grade: number | null;
  class_label: string | null;
  student_no: string | null;
  relation: string | null;
  linked_at: string | null;
};

type ReportFlagRow = {
  student_id: string;
  month: string;
};

function levelLabel(level: SchoolLevel | null): string {
  if (level === "elem") return "초등";
  if (level === "mid") return "중등";
  if (level === "high") return "고등";
  return "미정";
}

function fmtKst(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatMonth(monthDate: string | null): string {
  if (!monthDate) return "등록된 리포트가 없습니다.";
  const match = monthDate.match(/^(\d{4})-(\d{2})/);
  if (!match) return monthDate;
  return `${match[1]}년 ${Number(match[2])}월`;
}

export default function ParentStudentsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<MyStudentRow[]>([]);
  const [latestReportMonthByStudent, setLatestReportMonthByStudent] = useState<Record<string, string | null>>({});
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMyStudents = async (): Promise<MyStudentRow[]> => {
    const { data, error: listError } = await supabase.rpc("list_my_students");
    if (listError) throw listError;
    return (Array.isArray(data) ? data : []) as MyStudentRow[];
  };

  const loadLatestReports = async (studentIds: string[]) => {
    if (studentIds.length === 0) {
      setLatestReportMonthByStudent({});
      return;
    }

    const { data, error } = await supabase
      .from("reports")
      .select("student_id,month")
      .in("student_id", studentIds)
      .eq("subject", "monthly")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .returns<ReportFlagRow[]>();
    if (error) throw error;

    const nextMap: Record<string, string | null> = {};
    for (const studentId of studentIds) nextMap[studentId] = null;
    for (const row of data ?? []) {
      if (!nextMap[row.student_id]) nextMap[row.student_id] = row.month;
    }
    setLatestReportMonthByStudent(nextMap);
  };

  const initialize = async () => {
    setError(null);

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

      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single<{ role: string }>();
      if (meError) throw meError;
      if (me.role !== "parent") {
        router.replace("/");
        return;
      }

      const nextStudents = await loadMyStudents();
      setStudents(nextStudents);
      await loadLatestReports(nextStudents.map((row) => row.student_id));
    } catch {
      setError("자녀 정보를 불러오지 못했습니다.");
      setStudents([]);
      setLatestReportMonthByStudent({});
    } finally {
      setPageState("ready");
    }
  };

  const handleUnlink = async (student: MyStudentRow) => {
    if (busyStudentId) return;
    const confirmed = window.confirm(`${student.name?.trim() || "학생"} 연결을 해제할까요?`);
    if (!confirmed) return;

    setError(null);
    setBusyStudentId(student.student_id);
    try {
      const { error: unlinkError } = await supabase.rpc("unlink_student", { p_student_id: student.student_id });
      if (unlinkError) throw unlinkError;

      const nextStudents = await loadMyStudents();
      setStudents(nextStudents);
      await loadLatestReports(nextStudents.map((row) => row.student_id));
    } catch {
      setError("연결 해제에 실패했습니다.");
    } finally {
      setBusyStudentId(null);
    }
  };

  if (pageState === "loading") {
    return <PageShell maxWidthClassName="max-w-5xl">로딩 중...</PageShell>;
  }

  return (
    <PageShell
      title="자녀 관리"
      subtitle="연결된 자녀의 학습/안내 상태를 확인하고 필요한 화면으로 바로 이동하세요."
      maxWidthClassName="max-w-5xl"
    >
      <SectionCard
        header="연결된 자녀"
        description="자녀별 최근 리포트 여부와 주요 이동 버튼을 카드로 제공합니다."
        rightSlot={(
          <button
            type="button"
            className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] md:w-auto"
            onClick={() => router.push("/link-student")}
          >
            자녀 추가 연결
          </button>
        )}
      >
        {error ? (
          <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        ) : null}

        {students.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            연결된 자녀가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {students.map((row) => {
              const isBusy = busyStudentId === row.student_id;
              const studentName = row.name?.trim() || "학생";
              const gradeText = row.grade != null ? `${row.grade}학년` : "학년 미정";
              const classText = row.class_label?.trim() ? `${row.class_label.trim()}반` : "반 미정";
              const latestMonth = latestReportMonthByStudent[row.student_id] ?? null;

              return (
                <div key={row.student_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-[var(--text)]">{studentName}</h3>
                      <span className="inline-flex rounded-full border border-[var(--success-text)] bg-[var(--success-bg)] px-2.5 py-1 text-xs text-[var(--success-text)]">
                        연결됨
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">{`${levelLabel(row.school_level)} / ${gradeText} / ${classText}`}</div>
                    <div className="text-sm text-[var(--text-muted)]">최근 리포트: {formatMonth(latestMonth)}</div>
                    <div className="text-xs text-[var(--text-muted)]">관계: {row.relation ?? "-"}</div>
                    <div className="text-xs text-[var(--text-muted)]">연결 시각: {fmtKst(row.linked_at)}</div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text)]"
                      onClick={() => router.push("/parent/reports")}
                    >
                      리포트 보기
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text)]"
                      onClick={() => router.push("/announcements")}
                    >
                      알림 보기
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
                      onClick={() => void handleUnlink(row)}
                      disabled={isBusy}
                    >
                      {isBusy ? "연결 해제 중..." : "연결 해제"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
