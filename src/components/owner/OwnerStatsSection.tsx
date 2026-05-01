"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import { getSchoolLevelFullLabel } from "@/lib/schoolLevel";
import {
  getOwnerStatsBundle,
  type OwnerStatsGroupKpiRow,
  type StudentXpByPeriodRow,
  type StudentXpSummaryRow,
} from "@/lib/ownerStats";
import { toPrettyErrorString } from "@/lib/supabaseError";

type Period = "week" | "month" | "lastMonth" | "term1" | "term2" | "schoolYear" | "total";

const PERIOD_OPTIONS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
  { value: "lastMonth", label: "지난 달" },
  { value: "term1", label: "1학기" },
  { value: "term2", label: "2학기" },
  { value: "schoolYear", label: "학년도" },
  { value: "total", label: "전체" },
];

const PERIOD_TO_KEY: Record<Period, keyof StudentXpByPeriodRow> = {
  week: "xp_this_week",
  month: "xp_this_month",
  lastMonth: "xp_last_month",
  term1: "xp_term1",
  term2: "xp_term2",
  schoolYear: "xp_school_year",
  total: "xp_total",
};

// PostgREST가 numeric을 string으로 보내는 경우가 있어 number로 강제 변환한 뒤 검사한다.
function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n == null) return "-";
  return Math.round(n).toLocaleString("ko-KR");
}

function formatDecimal(value: unknown, digits = 1): string {
  const n = toFiniteNumber(value);
  if (n == null) return "-";
  return n.toFixed(digits);
}

function getRankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function getStudentXpForPeriod(row: StudentXpByPeriodRow, period: Period): number {
  const key = PERIOD_TO_KEY[period];
  const value = row[key];
  return typeof value === "number" ? value : 0;
}

function getSchoolGradeLabel(level: string | null, grade: number | null): string {
  const levelLabel = getSchoolLevelFullLabel(level);
  if (grade == null) return levelLabel;
  if (levelLabel === "미입력") return `${grade}학년`;
  return `${levelLabel} ${grade}학년`;
}

export default function OwnerStatsSection() {
  const [groupKpi, setGroupKpi] = useState<OwnerStatsGroupKpiRow[]>([]);
  const [byPeriod, setByPeriod] = useState<StudentXpByPeriodRow[]>([]);
  const [summary, setSummary] = useState<StudentXpSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>("month");
  const [schoolLevelFilter, setSchoolLevelFilter] = useState<"" | "elementary" | "middle" | "high">("");
  const [gradeFilter, setGradeFilter] = useState<"" | string>("");
  const [awardsMode, setAwardsMode] = useState(false);
  const [awardsTopN, setAwardsTopN] = useState(5);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const leaderboardRef = useRef<HTMLDivElement>(null);

  const loadStats = async (markRefreshing: boolean) => {
    if (markRefreshing) setRefreshing(true);
    try {
      const bundle = await getOwnerStatsBundle();
      setGroupKpi(bundle.groupKpi);
      setByPeriod(bundle.byPeriod);
      setSummary(bundle.summary);
      setLastFetchedAt(new Date());
      setError(null);
    } catch (e: unknown) {
      console.error("Owner stats load failed:", toPrettyErrorString(e), e);
      setError(toPrettyErrorString(e));
    } finally {
      setLoading(false);
      if (markRefreshing) setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const bundle = await getOwnerStatsBundle();
        if (!active) return;
        setGroupKpi(bundle.groupKpi);
        setByPeriod(bundle.byPeriod);
        setSummary(bundle.summary);
        setLastFetchedAt(new Date());
      } catch (e: unknown) {
        if (!active) return;
        console.error("Owner stats load failed:", toPrettyErrorString(e), e);
        setError(toPrettyErrorString(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const summaryMap = useMemo(() => {
    return new Map(summary.map((row) => [row.student_id, row]));
  }, [summary]);

  const overallKpi = useMemo(() => {
    const totalActive = groupKpi.reduce((sum, g) => sum + (g.active_this_month ?? 0), 0);
    const totalXp = groupKpi.reduce((sum, g) => sum + (g.group_total_xp ?? 0), 0);
    const totalStudents = groupKpi.reduce((sum, g) => sum + (g.student_count ?? 0), 0);
    let weightedLevelSum = 0;
    let weightedDenom = 0;
    for (const g of groupKpi) {
      if (g.avg_level != null && g.student_count > 0) {
        weightedLevelSum += g.avg_level * g.student_count;
        weightedDenom += g.student_count;
      }
    }
    const avgLevel = weightedDenom > 0 ? weightedLevelSum / weightedDenom : null;
    const topStudent = summary[0] ?? null;
    return { totalActive, totalXp, totalStudents, avgLevel, topStudent };
  }, [groupKpi, summary]);

  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    for (const row of byPeriod) {
      if (!schoolLevelFilter || row.school_level === schoolLevelFilter) {
        if (row.grade != null) set.add(row.grade);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [byPeriod, schoolLevelFilter]);

  const leaderboardRows = useMemo(() => {
    const filtered = byPeriod.filter((row) => {
      if (schoolLevelFilter && row.school_level !== schoolLevelFilter) return false;
      if (gradeFilter && String(row.grade ?? "") !== gradeFilter) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = getStudentXpForPeriod(a, period);
      const bv = getStudentXpForPeriod(b, period);
      if (bv !== av) return bv - av;
      return (b.xp_total ?? 0) - (a.xp_total ?? 0);
    });
    return sorted;
  }, [byPeriod, period, schoolLevelFilter, gradeFilter]);

  const handleJumpToGroup = (group: OwnerStatsGroupKpiRow) => {
    setSchoolLevelFilter((group.school_level as "" | "elementary" | "middle" | "high" | null) ?? "");
    setGradeFilter(group.grade != null ? String(group.grade) : "");
    setAwardsMode(false);
    setTimeout(() => leaderboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const renderLevelLabel = (studentId: string) => {
    const s = summaryMap.get(studentId);
    if (!s) return "-";
    const icon = s.current_level_icon ?? "";
    const lvl = s.current_level ?? "-";
    const title = s.current_level_title ?? "";
    return `${icon ? `${icon} ` : ""}${lvl}${title ? ` ${title}` : ""}`.trim();
  };

  if (loading) {
    return (
      <SectionCard header="원장 통계" description="학생 활동·XP 통계를 불러오는 중입니다.">
        <div className="text-sm text-[var(--text-muted)]">로딩 중...</div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard header="원장 통계">
        <div className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
          통계를 불러오지 못했습니다: {error}
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <SectionCard
        header="전체 KPI"
        description="이번 달 활동과 전체 누적 통계입니다."
        rightSlot={
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-60"
              onClick={() => void loadStats(true)}
              disabled={refreshing}
            >
              {refreshing ? "새로고침 중..." : "🔄 새로고침"}
            </button>
            {lastFetchedAt && (
              <span className="text-[11px] text-[var(--text-muted)]">
                업데이트: {lastFetchedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
            <div className="text-xs text-[var(--text-muted)]">활동 학생 (이번 달)</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text)] tabular-nums">
              {formatNumber(overallKpi.totalActive)}
              <span className="ml-1 text-sm font-normal text-[var(--text-muted)]">
                / {formatNumber(overallKpi.totalStudents)}명
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 md:p-5">
            <div className="text-xs text-[var(--accent)]">전체 누적 XP</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--accent)] tabular-nums">
              {formatNumber(overallKpi.totalXp)}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
            <div className="text-xs text-[var(--text-muted)]">평균 레벨</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text)] tabular-nums">
              {formatDecimal(overallKpi.avgLevel, 1)}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 md:p-5">
            <div className="text-xs text-[var(--success-text)]">최고 레벨 학생</div>
            <div className="mt-2 text-base font-semibold text-[var(--success-text)]">
              {overallKpi.topStudent
                ? `${overallKpi.topStudent.current_level_icon ?? ""} ${overallKpi.topStudent.student_name ?? "이름 없음"}`.trim()
                : "-"}
            </div>
            <div className="mt-1 text-xs text-[var(--success-text)] opacity-80 tabular-nums">
              {overallKpi.topStudent
                ? `Lv ${overallKpi.topStudent.current_level ?? "-"} · ${formatNumber(overallKpi.topStudent.total_xp)} XP`
                : ""}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard header="학교급/학년별 통계" description="각 학년별 평균과 활동 현황입니다.">
        {groupKpi.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)]">집계할 학생 데이터가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                  <th className="px-2 py-2 font-medium">학교급</th>
                  <th className="px-2 py-2 font-medium">학년</th>
                  <th className="px-2 py-2 text-right font-medium">인원</th>
                  <th className="px-2 py-2 text-right font-medium">이번달 활동</th>
                  <th className="px-2 py-2 text-right font-medium">평균 XP</th>
                  <th className="px-2 py-2 text-right font-medium">평균 레벨</th>
                  <th className="px-2 py-2 text-right font-medium">최고 XP</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {groupKpi.map((g) => (
                  <tr
                    key={`${g.school_level ?? "none"}-${g.grade ?? "none"}`}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-2 py-2 text-[var(--text)]">{getSchoolLevelFullLabel(g.school_level)}</td>
                    <td className="px-2 py-2 text-[var(--text)]">{g.grade != null ? `${g.grade}학년` : "-"}</td>
                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">{formatNumber(g.student_count)}</td>
                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">{formatNumber(g.active_this_month)}</td>
                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">{formatNumber(g.avg_xp)}</td>
                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">{formatDecimal(g.avg_level, 1)}</td>
                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">{formatNumber(g.max_xp)}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--text)] hover:border-[var(--accent)]"
                        onClick={() => handleJumpToGroup(g)}
                      >
                        상세 보기 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div ref={leaderboardRef}>
        <SectionCard header="학생 리더보드" description="기간·학교급으로 필터링하고, 시상 모드로 발표용 카드를 볼 수 있습니다.">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--card-soft)] p-1 text-xs">
              {PERIOD_OPTIONS.map((opt) => {
                const active = period === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rounded-full px-3 py-1.5 transition ${
                      active
                        ? "bg-[var(--accent)] text-[var(--bg)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                    onClick={() => setPeriod(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--card-soft)] p-1 text-xs">
                {([
                  { value: "", label: "전체" },
                  { value: "elementary", label: "초등" },
                  { value: "middle", label: "중등" },
                  { value: "high", label: "고등" },
                ] as const).map((opt) => {
                  const active = schoolLevelFilter === opt.value;
                  return (
                    <button
                      key={opt.value || "all"}
                      type="button"
                      className={`rounded-full px-3 py-1.5 transition ${
                        active
                          ? "bg-[var(--accent)] text-[var(--bg)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                      onClick={() => {
                        setSchoolLevelFilter(opt.value);
                        setGradeFilter("");
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--card-soft)] p-1 text-xs">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 transition ${
                    gradeFilter === ""
                      ? "bg-[var(--accent)] text-[var(--bg)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                  onClick={() => setGradeFilter("")}
                >
                  전체
                </button>
                {availableGrades.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`rounded-full px-3 py-1.5 transition ${
                      gradeFilter === String(g)
                        ? "bg-[var(--accent)] text-[var(--bg)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                    onClick={() => setGradeFilter(String(g))}
                  >
                    {g}학년
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  awardsMode
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--accent)]"
                }`}
                onClick={() => setAwardsMode((prev) => !prev)}
              >
                🎁 시상 후보 보기
              </button>
              {awardsMode && (
                <label className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  상위
                  <select
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1"
                    value={awardsTopN}
                    onChange={(e) => setAwardsTopN(Number(e.target.value))}
                  >
                    {[3, 5, 10].map((n) => (
                      <option key={n} value={n}>{n}명</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {leaderboardRows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
              조건에 맞는 학생이 없습니다.
            </div>
          ) : awardsMode ? (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {leaderboardRows.slice(0, awardsTopN).map((row, index) => {
                const rank = index + 1;
                const xp = getStudentXpForPeriod(row, period);
                const isPodium = rank <= 3;
                const cardCls = isPodium
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--card)]";
                return (
                  <div key={row.student_id} className={`rounded-3xl border p-5 ${cardCls}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-3xl tabular-nums">{getRankBadge(rank)}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {getSchoolGradeLabel(row.school_level, row.grade)}
                      </div>
                    </div>
                    <div className="mt-3 text-xl font-semibold text-[var(--text)]">
                      {row.student_name ?? "이름 없음"}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">
                      {renderLevelLabel(row.student_id)}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                        <div className="text-[11px] text-[var(--text-muted)]">기간 XP</div>
                        <div className="text-lg font-semibold text-[var(--text)] tabular-nums">{formatNumber(xp)}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                        <div className="text-[11px] text-[var(--text-muted)]">누적 XP</div>
                        <div className="text-lg font-semibold text-[var(--text)] tabular-nums">{formatNumber(row.xp_total)}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                        <div className="text-[11px] text-[var(--text-muted)]">수학</div>
                        <div className="text-base font-semibold text-[var(--text)] tabular-nums">{formatNumber(row.xp_math)}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                        <div className="text-[11px] text-[var(--text-muted)]">영어</div>
                        <div className="text-base font-semibold text-[var(--text)] tabular-nums">{formatNumber(row.xp_english)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                    <th className="px-2 py-2 font-medium">순위</th>
                    <th className="px-2 py-2 font-medium">이름</th>
                    <th className="px-2 py-2 font-medium">학년</th>
                    <th className="px-2 py-2 font-medium">레벨</th>
                    <th className="px-2 py-2 text-right font-medium">기간 XP</th>
                    <th className="px-2 py-2 text-right font-medium">누적 XP</th>
                    <th className="px-2 py-2 text-right font-medium">수학</th>
                    <th className="px-2 py-2 text-right font-medium">영어</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardRows.map((row, index) => {
                    const rank = index + 1;
                    const xp = getStudentXpForPeriod(row, period);
                    return (
                      <tr key={row.student_id} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="px-2 py-2 text-[var(--text)] tabular-nums">{getRankBadge(rank)}</td>
                        <td className="px-2 py-2 text-[var(--text)]">{row.student_name ?? "이름 없음"}</td>
                        <td className="px-2 py-2 text-[var(--text-muted)]">
                          {getSchoolGradeLabel(row.school_level, row.grade)}
                        </td>
                        <td className="px-2 py-2 text-[var(--text)]">{renderLevelLabel(row.student_id)}</td>
                        <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums">{formatNumber(xp)}</td>
                        <td className="px-2 py-2 text-right text-[var(--text-muted)] tabular-nums">{formatNumber(row.xp_total)}</td>
                        <td className="px-2 py-2 text-right text-[var(--text-muted)] tabular-nums">{formatNumber(row.xp_math)}</td>
                        <td className="px-2 py-2 text-right text-[var(--text-muted)] tabular-nums">{formatNumber(row.xp_english)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
