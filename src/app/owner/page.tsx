"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import OwnerStatsSection from "@/components/owner/OwnerStatsSection";
import {
  getOwnerMonthlyReportCoverage,
  getOwnerReportStats,
  listOwnerReports,
  type OwnerMonthlyReportCoverage,
  type OwnerReportStats,
} from "@/lib/reports";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type TaskCounts = {
  approvalsPending: number;
  consultationRequested: number;
  reportMissing: number;
  parentUnread: number;
};

type TaskCard = {
  key: keyof TaskCounts;
  href: string;
  title: string;
  description: string;
  toneClassName: string;
};

type QuickActionGroup = {
  title: string;
  items: Array<{
    href: string;
    title: string;
    description: string;
  }>;
};

const taskCards: TaskCard[] = [
  {
    key: "consultationRequested",
    href: "/owner/consult/requests",
    title: "상담 요청",
    description: "확인되지 않은 요청을 처리합니다.",
    toneClassName: "border-[var(--success-text)] bg-[var(--success-bg)]",
  },
  {
    key: "approvalsPending",
    href: "/owner/approvals",
    title: "가입 승인 대기",
    description: "신규 학생 계정을 확인합니다.",
    toneClassName: "border-[var(--accent)] bg-[var(--accent-soft)]",
  },
  {
    key: "reportMissing",
    href: "/owner/reports?status=missing",
    title: "리포트 누락",
    description: "이번 달 미작성 학생을 확인합니다.",
    toneClassName: "border-[var(--danger-text)] bg-[var(--danger-bg)]",
  },
  {
    key: "parentUnread",
    href: "/owner/reports?status=parent-unread",
    title: "학부모 미열람",
    description: "아직 열지 않은 리포트를 확인합니다.",
    toneClassName: "border-[var(--accent)] bg-[var(--card-soft)]",
  },
];

const quickActionGroups: QuickActionGroup[] = [
  {
    title: "학생/학부모 관리",
    items: [
      { href: "/owner/approvals", title: "승인 관리", description: "가입 승인·차단을 처리합니다." },
      { href: "/owner/students", title: "학생 관리", description: "학생 상태와 학부모 연결을 관리합니다." },
      { href: "/owner/generate-link-code", title: "학부모 연결 코드", description: "연결 코드를 발급합니다." },
    ],
  },
  {
    title: "운영/소통",
    items: [
      { href: "/owner/consult/requests", title: "상담 요청", description: "상담 요청을 빠르게 확인합니다." },
      { href: "/owner/consult/calendar", title: "상담 캘린더", description: "일정과 확정 현황을 확인합니다." },
      { href: "/owner/announcements/new", title: "알리미 작성", description: "학생·학부모에게 알림을 보냅니다." },
    ],
  },
  {
    title: "학습 관리",
    items: [{ href: "/owner/reports", title: "리포트 관리", description: "월별 성취도 리포트를 입력합니다." }],
  },
];

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatNumber(value: number | null, suffix = ""): string {
  if (value == null) return "-";
  return `${value}${suffix}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "-";
  return `${value}%`;
}

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState<OwnerReportStats>({
    totalStudents: 0,
    monthlyReportsSent: 0,
    monthlyReportsRead: 0,
    monthlyReadRate: 0,
  });
  const [coverage, setCoverage] = useState<OwnerMonthlyReportCoverage | null>(null);
  const [tasks, setTasks] = useState<TaskCounts>({
    approvalsPending: 0,
    consultationRequested: 0,
    reportMissing: 0,
    parentUnread: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const monthKey = currentMonthKey();
        const [statsResult, coverageResult, reportsResult, approvalsResult, consultResult] = await Promise.all([
          getOwnerReportStats(),
          getOwnerMonthlyReportCoverage(),
          listOwnerReports({ month: monthKey }),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("account_status", "pending"),
          supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
        ]);

        if (!active) return;
        if (approvalsResult.error) throw approvalsResult.error;
        if (consultResult.error) throw consultResult.error;

        const parentUnread = reportsResult.filter(
          (item) => item.parent_total_count > 0 && item.parent_read_count < item.parent_total_count
        ).length;

        setStats(statsResult);
        setCoverage(coverageResult);
        setTasks({
          approvalsPending: approvalsResult.count ?? 0,
          consultationRequested: consultResult.count ?? 0,
          reportMissing: coverageResult.missingStudents ?? 0,
          parentUnread,
        });
      } catch (error: unknown) {
        console.error("Owner dashboard load failed:", toPrettyErrorString(error), error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const kpiCards = useMemo(
    () => [
      {
        title: "이번 달 리포트 발송",
        value: formatNumber(stats.monthlyReportsSent, "건"),
        description: "이번 달 등록된 리포트 수입니다.",
      },
      {
        title: "리포트 열람률",
        value: formatPercent(stats.monthlyReadRate),
        description: "학생·학부모 열람 기준입니다.",
      },
      {
        title: "이번 달 대상 학생",
        value: formatNumber(coverage?.totalStudents ?? null, "명"),
        description: "리포트 관리 대상 학생 수입니다.",
      },
      {
        title: "작성 완료",
        value: formatNumber(coverage?.reportedStudents ?? null, "명"),
        description: "이번 달 리포트 작성 완료 수입니다.",
      },
    ],
    [coverage?.reportedStudents, coverage?.totalStudents, stats.monthlyReadRate, stats.monthlyReportsSent]
  );

  return (
    <PageShell
      title="원장 홈"
      subtitle="오늘 처리할 일부터 운영 현황, 빠른 실행까지 한 화면에서 확인합니다."
      maxWidthClassName="max-w-6xl"
      contentClassName="space-y-5 md:space-y-6"
    >
      <SectionCard header="오늘 처리할 일" description="지금 확인하고 처리해야 할 항목입니다.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {taskCards.map((card) => {
            const isConsultHighlighted = card.key === "consultationRequested" && tasks.consultationRequested >= 1;
            const toneClassName = isConsultHighlighted
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : card.toneClassName;
            return (
            <Link
              key={card.key}
              href={card.href}
              className={`block rounded-2xl border p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg md:p-5 ${toneClassName}`}
            >
              <div className="text-sm font-medium text-[var(--text)]">{card.title}</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] md:text-4xl">
                {loading ? "-" : tasks[card.key]}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{card.description}</p>
            </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard header="운영 현황" description="이번 달 리포트·열람 현황입니다.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {kpiCards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5 lg:p-6">
              <div className="text-sm text-[var(--text-muted)]">{card.title}</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
                {loading ? "-" : card.value}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{card.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard header="빠른 실행" description="자주 쓰는 메뉴를 업무 흐름에 맞춰 정리했습니다.">
        <div className="space-y-5">
          {quickActionGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-base font-semibold text-[var(--text)] md:text-lg">{group.title}</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-lg md:p-5 lg:p-6"
                  >
                    <h4 className="text-base font-semibold text-[var(--text)]">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <OwnerStatsSection />
    </PageShell>
  );
}
