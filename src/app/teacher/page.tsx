import Link from "next/link";
import NoticeFeed from "@/components/dashboard/NoticeFeed";
import Badge from "@/components/ui/Badge";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";

const teacherMenus = [
  { href: "/owner/students", title: "학생 목록", description: "학생 기본 정보를 확인하고 상담 준비 흐름을 정리합니다." },
  { href: "/owner/consult/requests", title: "상담 요청", description: "보호자 요청을 빠르게 검토해 수업 운영에 반영합니다." },
  { href: "/owner/consult/calendar", title: "상담 캘린더", description: "확정 일정과 운영 시간을 한눈에 확인합니다." },
  { href: "/announcements", title: "전체 공지", description: "학원 공지를 확인해 수업 안내에 즉시 활용합니다." },
] as const;

const teacherSummaryCards = [
  {
    title: "오늘 수업/상담",
    description: "오늘 진행 일정과 상담 흐름을 하나로 묶어 보여주는 카드가 준비 중입니다.",
  },
  {
    title: "공지",
    description: "수업 운영에 필요한 최신 공지 요약 노출을 고도화하고 있습니다.",
  },
  {
    title: "학생 목록",
    description: "반별 학생 현황을 빠르게 파악할 수 있는 요약 정보를 준비 중입니다.",
  },
  {
    title: "운영 준비",
    description: "수업 전 체크가 필요한 지표를 서비스형 카드로 곧 제공합니다.",
  },
] as const;

export default function TeacherDashboardPage() {
  return (
    <PageShell
      title="교사 대시보드"
      subtitle="수업 운영과 상담 대응을 한 흐름으로 연결해 더 안정적으로 관리할 수 있습니다."
      maxWidthClassName="max-w-5xl"
    >
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {teacherSummaryCards.map((card) => (
            <SectionCard key={card.title} variant="soft">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--text)]">{card.title}</h2>
                <Badge variant="neutral">준비 중</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.description}</p>
            </SectionCard>
          ))}
        </section>

        <SectionCard>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--text)]">빠른 실행</h2>
            <p className="text-xs text-[var(--muted)]">필요한 업무를 바로 시작하실 수 있습니다.</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {teacherMenus.map((menu) => (
              <Link key={menu.href} href={menu.href} className="block">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]">
                  <h3 className="text-base font-semibold text-[var(--text)]">{menu.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{menu.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <NoticeFeed title="최근 공지/알림" />
      </div>
    </PageShell>
  );
}
