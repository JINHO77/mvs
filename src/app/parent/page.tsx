"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import ChildLinkCard from "@/components/parent/ChildLinkCard";
import PushSubscribeButton from "@/components/pwa/PushSubscribeButton";
import { supabase } from "@/lib/supabaseClient";
import {
  categoryBadgeClass,
  categoryBorderClass,
  daysAgo,
  formatDaysAgo,
  getCategoryDisplay,
  getPriorityDisplay,
} from "@/lib/announcementDisplay";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConsultStatus = "requested" | "confirmed" | "canceled" | "cancelled" | "done" | "no_show";
type AnnouncementCategory = "general" | "report" | "urgent" | "event" | "schedule" | "consultation" | string;
type AnnouncementPriority = "urgent" | "high" | "normal" | "low" | string;

type LinkedStudent = {
  id: string;
  name: string | null;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
};

type ConsultRow = {
  id: string;
  type: string | null;
  status: ConsultStatus;
  notes: string | null;
  created_at: string;
  requested_start_at: string | null;
  manual_consultation_content: string | null;
  manual_student_name: string | null;
};

type ReportRow = {
  id: string;
  title: string | null;
  report_month: string | null;
  subject: string | null;
  math_pdf_path: string | null;
  created_at: string;
};

type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  category: AnnouncementCategory | null;
  priority: AnnouncementPriority | null;
  requires_ack: boolean | null;
  created_at: string;
  is_read?: boolean;
  // Optional view-provided fields (v_announcements_display)
  category_ko?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  priority_ko?: string | null;
  priority_icon?: string | null;
  priority_weight?: number | null;
  days_ago?: number | null;
  attachment_count?: number | null;
  read_count?: number | null;
  ack_count?: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKo(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}


function consultStatusSummaryLabel(consults: ConsultRow[]): string {
  if (consults.some((c) => c.status === "confirmed")) return "일정 확정";
  if (consults.some((c) => c.status === "requested")) return "검토 중";
  if (consults.length === 0) return "신청 없음";
  return "내역 있음";
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

// ─── statusConfig (상담 상태별 설정) ──────────────────────────────────────────

type StatusConfigEntry = {
  label: string;
  color: string;
  icon: string;
  message: string;
  messageColor: string;
};

const statusConfig: Record<string, StatusConfigEntry> = {
  requested: {
    label: "검토 중",
    icon: "⏳",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    message: "원장님이 확인 중이에요. 일정이 확정되면 알려드릴게요.",
    messageColor: "text-amber-600 dark:text-amber-400",
  },
  confirmed: {
    label: "일정 확정",
    icon: "✅",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    message: "상담 일정이 확정됐어요. 예약하신 날짜에 꼭 참석해 주세요.",
    messageColor: "text-green-600 dark:text-green-400",
  },
  canceled: {
    label: "취소됨",
    icon: "✕",
    color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    message: "상담이 취소됐어요. 다시 신청하시려면 새 상담 신청을 눌러주세요.",
    messageColor: "text-gray-500 dark:text-gray-400",
  },
  cancelled: {
    label: "취소됨",
    icon: "✕",
    color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    message: "상담이 취소됐어요. 다시 신청하시려면 새 상담 신청을 눌러주세요.",
    messageColor: "text-gray-500 dark:text-gray-400",
  },
  done: {
    label: "상담 완료",
    icon: "🎉",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    message: "상담이 완료됐어요. 이용해 주셔서 감사합니다.",
    messageColor: "text-blue-600 dark:text-blue-400",
  },
  no_show: {
    label: "미참석",
    icon: "⚠️",
    color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    message: "예약 시간에 참석하지 않으셨어요. 다시 신청하시거나 원장님께 문의해 주세요.",
    messageColor: "text-red-500 dark:text-red-400",
  },
};

function consultCards(
  consults: ConsultRow[],
  router: ReturnType<typeof import("next/navigation").useRouter>
) {
  return consults.map((c) => {
    const st: StatusConfigEntry = statusConfig[c.status] ?? {
      label: c.status,
      icon: "📋",
      color: "bg-gray-100 text-gray-500",
      message: "",
      messageColor: "text-gray-400",
    };
    const typeLabel =
      c.type === "phone" ? "전화 상담" : c.type === "in_person" ? "대면 상담" : "화상 상담";
    const typeIcon =
      c.type === "phone" ? "📞" : c.type === "in_person" ? "🏫" : "💻";

    return (
      <div
        key={c.id}
        className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 flex flex-col gap-2.5"
      >
        {/* 상단: 상태 배지 + 유형 + 날짜 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>
              {st.icon} {st.label}
            </span>
            <span className="text-sm font-medium text-[var(--text)]">
              {typeIcon} {typeLabel}
            </span>
          </div>
          <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
            {new Date(c.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
          </span>
        </div>

        {/* 상태 안내 문구 */}
        {st.message && (
          <div className={`flex items-start gap-1.5 text-xs ${st.messageColor}`}>
            <span className="mt-0.5 flex-shrink-0">💬</span>
            <p>{st.message}</p>
          </div>
        )}

        {/* 상담 내용 미리보기 */}
        {c.manual_consultation_content && (
          <p className="text-sm text-[var(--text-muted)] line-clamp-1 pl-1 border-l-2 border-[var(--border)]">
            {c.manual_consultation_content}
          </p>
        )}

        {/* 희망 일시 */}
        {c.requested_start_at && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span>📅</span>
            <span>
              희망일:{" "}
              {new Date(c.requested_start_at).toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </span>
            {c.status === "confirmed" && (
              <span className="text-green-500 font-medium">(확정)</span>
            )}
          </div>
        )}

        {/* confirmed 강조 박스 */}
        {c.status === "confirmed" && (
          <div className="mt-1 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-700 dark:text-green-400 font-medium">
            ✅ 상담이 확정됐어요! 예약 날짜를 꼭 확인해 주세요.
          </div>
        )}

        {/* no_show 재신청 유도 */}
        {c.status === "no_show" && (
          <div className="mt-1 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            ⚠️ 미참석으로 처리됐어요.{" "}
            <button
              type="button"
              onClick={() => router.push("/parent/consultation/new")}
              className="underline font-medium hover:opacity-80"
            >
              다시 신청하기 →
            </button>
          </div>
        )}

        {/* canceled 재신청 유도 */}
        {(c.status === "canceled" || c.status === "cancelled") && (
          <div className="mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            새 상담이 필요하시면{" "}
            <button
              type="button"
              onClick={() => router.push("/parent/consultation/new")}
              className="underline font-medium hover:opacity-80"
            >
              다시 신청하기 →
            </button>
          </div>
        )}
      </div>
    );
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParentDashboardPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [activeConsults, setActiveConsults] = useState<ConsultRow[]>([]);
  const [totalConsultCount, setTotalConsultCount] = useState(0);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [guardianId, setGuardianId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialize() {
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

      setGuardianId(session.user.id);

      // 연결된 자녀 목록
      const { data: links, error: linksError } = await supabase
        .from("student_guardians")
        .select("student_id")
        .eq("guardian_id", session.user.id)
        .returns<Array<{ student_id: string | null }>>();

      if (linksError) throw linksError;

      const linkedIds = Array.from(
        new Set(
          (links ?? [])
            .map((r) => r.student_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      );

      if (linkedIds.length === 0) {
        router.replace("/parent/onboarding/link");
        return;
      }

      const [studentsRes, activeConsultsRes, totalConsultRes, announcementsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,name,school_level,grade,class_label")
          .in("id", linkedIds)
          .returns<LinkedStudent[]>(),
        supabase
          .from("consultation_requests")
          .select("id,type,status,notes,created_at,requested_start_at,manual_consultation_content,manual_student_name")
          .eq("guardian_id", session.user.id)
          .in("status", ["requested", "confirmed"])
          .order("created_at", { ascending: false })
          .limit(3)
          .returns<ConsultRow[]>(),
        supabase
          .from("consultation_requests")
          .select("id", { count: "exact", head: true })
          .eq("guardian_id", session.user.id),
        // SECURITY: read from the base table — RLS policy
        // `announcements_select_visible_targets` enforces visibility per user.
        // The `v_announcements_display` view bypasses RLS unless created
        // WITH (security_invoker = on), so we don't trust it for reads.
        supabase
          .from("announcements")
          .select("id,title,body,category,priority,requires_ack,created_at,published_at")
          .eq("is_deleted", false)
          .lte("published_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(20)
          .returns<AnnouncementRow[]>(),
      ]);

      if (studentsRes.error) throw studentsRes.error;

      const loadedStudents = studentsRes.data ?? [];
      setStudents(loadedStudents);
      setActiveConsults(activeConsultsRes.data ?? []);
      setTotalConsultCount(totalConsultRes.count ?? 0);

      // RLS on the base table is the sole visibility gate. No fallback path —
      // if it errors, surface the failure rather than degrading to a leaky source.
      const announcementsData = announcementsRes.data ?? [];

      // Side-load read state for this user, merge `is_read` into each row.
      const announcementIds = announcementsData
        .map((a) => a.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      let withRead: AnnouncementRow[] = announcementsData;
      if (announcementIds.length > 0) {
        const { data: reads } = await supabase
          .from("announcement_reads")
          .select("announcement_id,read_at")
          .eq("user_id", session.user.id)
          .in("announcement_id", announcementIds);
        const readSet = new Set(
          (reads ?? [])
            .filter((r): r is { announcement_id: string; read_at: string | null } =>
              !!r && typeof r.announcement_id === "string" && r.read_at != null
            )
            .map((r) => r.announcement_id)
        );
        withRead = announcementsData.map((a) => ({ ...a, is_read: readSet.has(a.id) }));
      }
      setAnnouncements(withRead);

      // 리포트 — 첫 번째 자녀 기준
      const primaryStudentId = linkedIds[0];
      if (primaryStudentId) {
        const { data: reportsData } = await supabase
          .from("reports")
          .select("id,title,report_month,subject,math_pdf_path,created_at")
          .eq("student_id", primaryStudentId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(6)
          .returns<ReportRow[]>();
        setReports(reportsData ?? []);
      }

      // 전체 알리미 수 — base 테이블의 RLS가 가시성을 자동 처리.
      const countResult = await supabase
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", false)
        .lte("published_at", new Date().toISOString());
      setUnreadCount(countResult.count ?? 0);
    } catch {
      setError("정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }


  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell title="학부모 대시보드" maxWidthClassName="max-w-5xl">
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-[var(--text-muted)]">불러오는 중…</p>
        </div>
      </PageShell>
    );
  }

  const consultationAlerts = announcements.filter((a) => a.category === "consultation");
  const generalAlerts = announcements.filter((a) => a.category !== "consultation");
  const unreadConsultationCount = consultationAlerts.filter((a) => !a.is_read).length;
  const unreadGeneralCount = generalAlerts.filter((a) => !a.is_read).length;

  return (
    <PageShell
      title="학부모 대시보드"
      subtitle="자녀의 학습 리포트를 확인하고 상담과 알림을 한 번에 관리하세요."
      maxWidthClassName="max-w-5xl"
      actions={
        <Link
          href="/parent/account"
          className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          👤 내 정보
        </Link>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}

        {/* ── 상단 요약 바 ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="연결 자녀" value={`${students.length}명`} />
          <SummaryCard label="전체 알리미" value={`${unreadCount}건`} />
          {/* 상담 상태 카드 — 진행 중 수 + 상태 힌트 */}
          <div className="flex flex-col gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
            <span className="text-[11px] text-[var(--text-muted)]">진행 중 상담</span>
            <span className="text-xl font-bold text-[var(--text)]">{activeConsults.length}건</span>
            {activeConsults.some((c) => c.status === "confirmed") && (
              <span className="text-[11px] text-green-500">✅ 확정된 일정 있음</span>
            )}
            {!activeConsults.some((c) => c.status === "confirmed") &&
              activeConsults.some((c) => c.status === "requested") && (
              <span className="text-[11px] text-amber-500">⏳ 검토 중</span>
            )}
            {activeConsults.length === 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">진행 중 없음</span>
            )}
          </div>
        </div>

        {/* ── 중간 2열: 상담 + 리포트 ─────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

          {/* ── 📋 상담 요청 ─────────────────────────────────────────── */}
          <SectionCard>
            <div className="space-y-3">
              {/* 섹션 헤더 */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">📋 상담 요청</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">진행 중인 상담만 표시돼요</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/consult/request")}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[#0b1220] shadow-md transition-all hover:opacity-90 active:scale-95"
                >
                  <span className="text-base leading-none">+</span>
                  새 상담 신청
                </button>
              </div>

              {activeConsults.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-8">
                  <span className="text-3xl">💬</span>
                  <p className="text-sm font-medium text-[var(--text-muted)]">진행 중인 상담이 없어요</p>
                  <button
                    type="button"
                    onClick={() => router.push("/consult/request")}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#0b1220] transition-opacity hover:opacity-90"
                  >
                    + 상담 신청하기
                  </button>
                </div>
              ) : (
                consultCards(activeConsults, router)
              )}

              <button
                type="button"
                onClick={() => router.push("/parent/consultation")}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                전체 상담 내역 보기
                {totalConsultCount > 0 && (
                  <span className="rounded-full bg-[var(--card-soft)] px-1.5 py-0.5 text-xs font-medium">
                    총 {totalConsultCount}건
                  </span>
                )}
                <span>→</span>
              </button>
            </div>
          </SectionCard>

          {/* ── 📊 이번 달 리포트 ─────────────────────────────────────── */}
          <SectionCard
            header="이번 달 리포트"
            description="등록된 학습 리포트를 확인하세요."
          >
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] py-10 text-center">
                  <p className="text-sm text-[var(--text-muted)]">이번 달 리포트가 아직 없어요.</p>
                  <p className="text-xs text-[var(--text-muted)]">원장님이 등록하면 여기에 표시돼요.</p>
                </div>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/reports/${r.id}`)}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 transition-colors hover:border-[var(--accent)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 text-2xl">📊</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">
                          {r.title ?? `${r.report_month ?? ""} 리포트`}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {r.report_month ?? ""}
                          {r.subject ? ` · ${r.subject === "math" ? "수학" : r.subject === "english" ? "영어" : r.subject}` : ""}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); router.push(`/reports/${r.id}`); }}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#0b1220] transition hover:opacity-90"
                    >
                      📊 리포트 보기
                    </button>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── 💬 상담 알림 (별도 섹션, 가장 위) ─────────────────────────── */}
        {consultationAlerts.length > 0 && (
          <SectionCard>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--text)]">💬 상담 알림</h2>
                  {unreadConsultationCount > 0 && (
                    <span className="inline-flex animate-pulse items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {unreadConsultationCount}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/announcements?category=consultation")}
                  className="text-xs font-medium text-[var(--accent)] transition hover:underline"
                >
                  전체 보기 →
                </button>
              </div>
              <div className="space-y-2">
                {consultationAlerts.slice(0, 3).map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    onClick={() => router.push(`/announcements/${a.id}`)}
                  />
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── 📣 일반 알리미 ─────────────────────────────────────────── */}
        <SectionCard>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--text)]">📣 일반 알리미</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">최근 공지사항과 중요 안내</p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/announcements?exclude_category=consultation")}
                className="text-xs font-medium text-[var(--accent)] transition hover:underline"
              >
                전체 보기 →
              </button>
            </div>

            {generalAlerts.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] py-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">등록된 알리미가 없어요.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {generalAlerts.slice(0, 3).map((a) => (
                    <AnnouncementCard
                      key={a.id}
                      announcement={a}
                      onClick={() => router.push(`/announcements/${a.id}`)}
                    />
                  ))}
                </div>

                {generalAlerts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => router.push("/announcements?exclude_category=consultation")}
                    className="w-full rounded-xl border border-[var(--border)] py-2.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    + {generalAlerts.length - 3}개 더 보기
                  </button>
                )}
              </>
            )}
          </div>
        </SectionCard>

        {guardianId && (
          <SectionCard>
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">👶 자녀 추가 연결</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  자녀가 마이페이지에서 발급받은 6자리 초대 코드로 연결할 수 있어요.
                </p>
              </div>
              <ChildLinkCard guardianId={guardianId} onLinked={() => void initialize()} />
            </div>
          </SectionCard>
        )}

        <SectionCard>
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">🔔 알림 설정</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                자녀의 새 리포트·상담 답변·중요 공지를 푸시로 받아보세요.
                <br />
                iPhone은 ''홈 화면에 추가'' 후에만 작동해요.
              </p>
            </div>
            <PushSubscribeButton />
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}

function AnnouncementCard({
  announcement,
  onClick,
}: {
  announcement: AnnouncementRow;
  onClick: () => void;
}) {
  const cat = getCategoryDisplay(announcement.category);
  const pri = getPriorityDisplay(announcement.priority);
  const icon = announcement.category_icon || cat.icon;
  const categoryLabel = announcement.category_ko || cat.ko;
  const priorityLabel = announcement.priority_ko || pri.ko;
  const priorityIcon = announcement.priority_icon || pri.icon;
  const showPriorityChip = announcement.priority === "urgent" || announcement.priority === "high";
  const ago = typeof announcement.days_ago === "number"
    ? announcement.days_ago
    : daysAgo(announcement.created_at);
  const attachmentCount = announcement.attachment_count ?? 0;
  const previewBody = announcement.body?.replace(/\/reports\/[a-z0-9-]+/g, "").trim() || "";

  const isRead = announcement.is_read === true;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block w-full rounded-xl border p-4 text-left transition-all hover:border-[var(--accent)] ${categoryBorderClass(announcement.category, announcement.priority)} ${
        isRead
          ? "opacity-60 hover:opacity-100"
          : "shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-[var(--accent)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-2xl leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {!isRead && (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                aria-label="안 읽음"
              />
            )}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryBadgeClass(announcement.category)}`}>
              {categoryLabel}
            </span>
            {showPriorityChip && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-300">
                {priorityIcon} {priorityLabel}
              </span>
            )}
            {attachmentCount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                📎 {attachmentCount}
              </span>
            )}
            {announcement.requires_ack && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                확인 필요
              </span>
            )}
          </div>
          <p
            className={`line-clamp-1 text-sm ${
              isRead ? "font-medium text-[var(--text-muted)]" : "font-bold text-[var(--text)]"
            }`}
          >
            {announcement.title}
          </p>
          {previewBody && (
            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">{previewBody}</p>
          )}
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatDaysAgo(ago)}</p>
        </div>
      </div>
    </button>
  );
}
