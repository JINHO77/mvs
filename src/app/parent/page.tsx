"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { fetchUnreadAnnouncementCount } from "@/lib/announcements";
import { formatReportMonth, listMyReports, type ReportListItem } from "@/lib/reports";
import { supabase } from "@/lib/supabaseClient";
import { normalizeUiText } from "@/lib/uiText";

type SchoolLevel = "elem" | "mid" | "high";
type ConsultStatus = "requested" | "confirmed" | "canceled" | "cancelled" | "done" | "no_show";

type LinkedStudent = {
  id: string;
  name: string | null;
  school_level: SchoolLevel | null;
  grade: number | null;
  class_label: string | null;
};

type ConsultationRequestRow = {
  id: string;
  student_id: string;
  status: ConsultStatus;
  requested_start_at: string;
};

type StudentSummaryCard = {
  student: LinkedStudent;
  latestReport: ReportListItem | null;
  latestConsult: ConsultationRequestRow | null;
};

function displayText(value: unknown, fallback = ""): string {
  const text = normalizeUiText(value);
  return text || fallback;
}

function schoolLevelLabel(level: SchoolLevel | null): string {
  if (level === "elem") return "초등";
  if (level === "mid") return "중등";
  if (level === "high") return "고등";
  return "미정";
}

function formatClassMeta(student: LinkedStudent): string {
  const level = schoolLevelLabel(student.school_level);
  const grade = student.grade != null ? `${student.grade}학년` : "학년 미정";
  const classLabel = student.class_label?.trim() ? `${student.class_label.trim()}반` : "반 미정";
  return `${level} / ${grade} / ${classLabel}`;
}

function formatConsultStatusLabel(status: ConsultStatus | null): string {
  if (status === "confirmed") return "상담 일정 확정";
  if (status === "requested") return "상담 요청 대기 중";
  return "상담 요청 가능";
}

function formatConsultStatusTone(status: ConsultStatus | null): string {
  if (status === "confirmed") return "border-[#7DD3A8] bg-[rgba(125,211,168,0.12)] text-[#7DD3A8]";
  if (status === "requested") return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]";
  return "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]";
}

function latestReportMonth(report: ReportListItem | null): string {
  return report ? formatReportMonth(report.month) : "등록된 리포트가 아직 없어요";
}

function buildStrengthLine(report: ReportListItem | null): string {
  const metrics = report?.english_metrics;
  if (!metrics) return "강점: 리포트가 등록되면 주요 강점을 바로 확인할 수 있어요.";

  const entries = [
    { label: "어휘", value: metrics.vocab ?? 0 },
    { label: "독해", value: metrics.reading ?? 0 },
    { label: "문법", value: metrics.grammar ?? 0 },
    { label: "듣기", value: metrics.listening ?? 0 },
  ].sort((a, b) => b.value - a.value);

  return `강점: ${entries[0]?.label ?? "영어"} 영역이 안정적으로 유지되고 있어요.`;
}

function buildWeaknessLine(report: ReportListItem | null): string {
  const metrics = report?.english_metrics;
  if (!metrics) return "보완: 리포트가 쌓이면 더 구체적인 보완 포인트를 안내해 드릴게요.";

  const entries = [
    { label: "어휘", value: metrics.vocab ?? 0 },
    { label: "독해", value: metrics.reading ?? 0 },
    { label: "문법", value: metrics.grammar ?? 0 },
    { label: "듣기", value: metrics.listening ?? 0 },
  ].sort((a, b) => a.value - b.value);

  return `보완: ${entries[0]?.label ?? "영어"} 영역을 우선 점검해 보세요.`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentCards, setStudentCards] = useState<StudentSummaryCard[]>([]);
  const [recentReports, setRecentReports] = useState<ReportListItem[]>([]);
  const [linkedStudentCount, setLinkedStudentCount] = useState(0);
  const [monthlyReportCount, setMonthlyReportCount] = useState(0);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setLoading(true);
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null }>();

      if (profileError) throw profileError;
      if ((profile?.role ?? "") !== "parent") {
        router.replace("/");
        return;
      }

      const { data: links, error: linksError } = await supabase
        .from("student_guardians")
        .select("student_id")
        .eq("guardian_id", session.user.id)
        .returns<Array<{ student_id: string | null }>>();

      if (linksError) throw linksError;

      const linkedStudentIds = Array.from(
        new Set((links ?? []).map((row) => row.student_id).filter((id): id is string => typeof id === "string" && id.length > 0))
      );
      setLinkedStudentCount(linkedStudentIds.length);

      if (linkedStudentIds.length === 0) {
        setStudentCards([]);
        setRecentReports([]);
        setMonthlyReportCount(0);
        setUnreadAnnouncementCount(0);
        router.replace("/parent/onboarding/link");
        return;
      }

      const [studentsRes, allReports, unreadCount, consultRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,name,school_level,grade,class_label")
          .in("id", linkedStudentIds)
          .returns<LinkedStudent[]>(),
        listMyReports(),
        fetchUnreadAnnouncementCount().catch(() => 0),
        supabase
          .from("consultation_requests")
          .select("id,student_id,status,requested_start_at")
          .eq("guardian_id", session.user.id)
          .in("student_id", linkedStudentIds)
          .order("requested_start_at", { ascending: false })
          .returns<ConsultationRequestRow[]>(),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (consultRes.error) throw consultRes.error;

      const students = studentsRes.data ?? [];
      const reports = allReports.filter((row) => linkedStudentIds.includes(row.student_id));
      const consultRows = consultRes.data ?? [];

      setUnreadAnnouncementCount(typeof unreadCount === "number" ? unreadCount : 0);
      setRecentReports(reports.slice(0, 4));

      const monthKey = currentMonthKey();
      setMonthlyReportCount(reports.filter((row) => row.month.startsWith(monthKey)).length);

      const latestReportByStudent = new Map<string, ReportListItem>();
      for (const row of reports) {
        if (!latestReportByStudent.has(row.student_id)) latestReportByStudent.set(row.student_id, row);
      }

      const latestConsultByStudent = new Map<string, ConsultationRequestRow>();
      for (const row of consultRows) {
        if (!latestConsultByStudent.has(row.student_id)) latestConsultByStudent.set(row.student_id, row);
      }

      const nextCards: StudentSummaryCard[] = students
        .sort((a, b) => displayText(a.name).localeCompare(displayText(b.name), "ko"))
        .map((student) => ({
          student,
          latestReport: latestReportByStudent.get(student.id) ?? null,
          latestConsult: latestConsultByStudent.get(student.id) ?? null,
        }));

      setStudentCards(nextCards);
    } catch {
      setError("학부모 정보를 불러오지 못했어요.");
      setStudentCards([]);
      setRecentReports([]);
      setLinkedStudentCount(0);
      setMonthlyReportCount(0);
      setUnreadAnnouncementCount(0);
    } finally {
      setLoading(false);
    }
  };

  const latestReportCard = studentCards.find((card) => card.latestReport) ?? studentCards[0] ?? null;
  const consultStatus = useMemo(() => {
    if (studentCards.some((card) => card.latestConsult?.status === "confirmed")) return "confirmed" as const;
    if (studentCards.some((card) => card.latestConsult?.status === "requested")) return "requested" as const;
    return null;
  }, [studentCards]);
  const consultButtonLabel =
    studentCards.length === 1 ? `${displayText(studentCards[0]?.student.name, "자녀")} 상담 요청하기` : "상담 요청하기";
  const consultStudentMeta = latestReportCard ? formatClassMeta(latestReportCard.student) : "연결된 자녀 정보를 확인하는 중이에요.";
  const consultGuideLine =
    consultStatus === "confirmed"
      ? "상담 일정이 확정되었어요. 상담 전 자녀의 최근 리포트를 함께 확인해 보세요."
      : consultStatus === "requested"
        ? "상담 요청을 확인 중이에요. 필요하면 리포트를 먼저 보고 상담 내용을 정리해 두세요."
        : "최근 리포트를 바탕으로 학습 방향이나 보완 영역을 상담으로 바로 이어갈 수 있어요.";
  const summaryItems = [
    { label: "연결 자녀", value: loading ? "-" : `${linkedStudentCount}명` },
    { label: "이번 달 리포트", value: loading ? "-" : `${monthlyReportCount}건` },
    { label: "상담 상태", value: loading ? "-" : formatConsultStatusLabel(consultStatus) },
  ];
  const consultTags =
    consultStatus === "confirmed"
      ? ["상담 일정 확정", "리포트 함께 보기", "상담 준비"]
      : consultStatus === "requested"
        ? ["요청 접수", "상담 내용 정리", "리포트 검토"]
        : ["학습 점검", "보완 상담", "진도 상담"];

  return (
    <PageShell
      title="학부모 대시보드"
      subtitle="자녀의 학습 리포트를 확인하고 필요한 상담과 알림을 한 번에 관리하세요."
      maxWidthClassName="max-w-6xl"
    >
      <div className="parent-dashboard space-y-6">
        {error ? (
          <SectionCard>
            <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
              {error}
            </div>
          </SectionCard>
        ) : null}

        <section className="summary-bar">
          <div className="flex flex-wrap gap-3 rounded-3xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="flex min-w-[160px] flex-1 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3"
              >
                <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                <span className="text-sm font-semibold text-[var(--text)]">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="top-section">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard header="이번 달 리포트" description="공식 학습 요약을 먼저 확인하고 필요한 다음 행동으로 이어가세요.">
              <div className="min-h-[220px] overflow-hidden break-keep rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--text)]">{displayText(latestReportCard?.student.name, "자녀")}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {latestReportCard ? formatClassMeta(latestReportCard.student) : "연결된 자녀 정보를 확인하는 중이에요."}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        {latestReportMonth(latestReportCard?.latestReport ?? null)}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                      <p className="line-clamp-1 text-sm text-[var(--text)]">{buildStrengthLine(latestReportCard?.latestReport ?? null)}</p>
                      <p className="mt-2 line-clamp-1 text-sm text-[var(--text-muted)]">{buildWeaknessLine(latestReportCard?.latestReport ?? null)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
                      onClick={() => {
                        if (latestReportCard?.latestReport) router.push(`/reports/${latestReportCard.latestReport.id}`);
                        else router.push("/parent/reports");
                      }}
                    >
                      리포트 보기
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm font-medium text-[var(--text-muted)]"
                      onClick={() => router.push("/parent/reports")}
                    >
                      전체 리포트 보기
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard header="상담 요청" description="자녀 정보와 최근 리포트를 바탕으로 바로 상담을 이어가세요.">
              <div className="min-h-[220px] overflow-hidden break-keep rounded-3xl border border-[var(--accent)]/35 bg-[linear-gradient(160deg,rgba(74,163,255,0.11),rgba(255,255,255,0.03))] p-6 shadow-[var(--shadow)]">
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--text)]">{displayText(latestReportCard?.student.name, "자녀")}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">{consultStudentMeta}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${formatConsultStatusTone(consultStatus)}`}>
                        {formatConsultStatusLabel(consultStatus)}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-sm text-[var(--text)]">{consultGuideLine}</p>

                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-4 text-sm text-[var(--text-muted)]">
                      {latestReportCard?.latestReport
                        ? `${formatReportMonth(latestReportCard.latestReport.month)} 리포트를 기준으로 상담을 준비할 수 있어요.`
                        : "최신 리포트가 아직 없어도 자녀 학습 상담은 바로 요청할 수 있어요."}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {consultTags.map((topic) => (
                        <span key={topic} className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-xs text-[var(--text-muted)]">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-sm font-semibold text-[var(--bg)]"
                      onClick={() => router.push("/consult/request")}
                    >
                      {consultButtonLabel}
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
                      onClick={() => router.push("/consult/request")}
                    >
                      상담 내역 보기
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </section>

        <section className="bottom-section">
          <SectionCard header="알리미" description="중요 공지, 리포트 등록, 상담 상태를 한눈에 확인하세요.">
            <div className="min-h-[220px] overflow-hidden break-keep rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">미확인 알리미 {loading ? "-" : unreadAnnouncementCount}건</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                    최근 등록된 리포트와 상담 상태, 중요한 공지를 빠르게 확인할 수 있어요.
                  </p>
                </div>
                <Link
                  href="/announcements"
                  className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
                >
                  전체 알리미 보기
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {recentReports.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
                    최근 알림으로 보여줄 리포트가 아직 없어요.
                  </div>
                ) : (
                  recentReports.map((row) => (
                    <Link
                      key={row.id}
                      href={`/reports/${row.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm transition hover:border-[var(--accent)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--text)]">{displayText(row.student_name, "학생")} 리포트가 등록되었어요.</p>
                        <p className="mt-1 text-[var(--text-muted)]">{formatReportMonth(row.month)}</p>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">보기</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </SectionCard>
        </section>
      </div>
    </PageShell>
  );
}
