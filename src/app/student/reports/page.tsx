"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import { getConcept } from "@/lib/concepts";
import { getConceptNode } from "@/lib/conceptMap";
import { prettyUserError } from "@/lib/errors";
import { fetchPublishedMissions } from "@/lib/missions";
import { getStudentMissionRecommendations, type MissionRecommendationResult } from "@/lib/recommendations";
import {
  formatReportMonth,
  getRecentEnglishTrends,
  getReportSignedUrl,
  listStudentReports,
  type RecentEnglishTrendRow,
  type ReportListItem,
} from "@/lib/reports";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { normalizeUiText } from "@/lib/uiText";
import { normalizeMonthKey } from "@/lib/validators";
import type { GeneratedMission } from "@/types/missions";

type MonthlyAttemptRow = {
  mission_id: string;
  status: "started" | "completed" | "abandoned";
  score: number | null;
  duration_sec: number | null;
  updated_at: string;
  completed_at: string | null;
};

type MonthlySummary = {
  totalStudyDays: number;
  completedMissions: number;
  averageAccuracy: number;
  studyMinutes: number;
  mathScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendedMissions: Array<{ id: string; title: string; concept: string }>;
};

type InsightItem = {
  key: string;
  label: string;
  description: string;
};

const EMPTY_SUMMARY: MonthlySummary = {
  totalStudyDays: 0,
  completedMissions: 0,
  averageAccuracy: 0,
  studyMinutes: 0,
  mathScore: 0,
  strengths: [],
  weaknesses: [],
  recommendedMissions: [],
};

const KOREAN_SUBJECT_LABELS: Record<string, string> = {
  vocab: "영어 어휘",
  reading: "영어 독해",
  grammar: "영어 문법",
  listening: "영어 듣기",
};

const REPORT_COPY = {
  loading: "리포트를 불러오는 중이에요.",
  empty: "아직 발행된 리포트가 없어요.",
  loginRequired: "로그인이 필요합니다.",
  heroFallbackSummary: "이번 달 학습 흐름과 성취를 정리했어요. 아래에서 자세히 확인해 보세요.",
  heroSummaryWithStrength: (label: string) => `${label} 영역에서 특히 잘하고 있어요. 이번 달 학습 흐름과 성취를 아래에서 확인해 보세요.`,
  heroSummaryWithWeakness: (label: string) => `${label} 영역을 조금 더 연습하면 이번 달 학습이 더욱 탄탄해져요.`,
  strengthFallback: "이번 달 강점 영역을 분석 중이에요.",
  weaknessFallback: "이번 달 보완할 영역을 분석 중이에요.",
  recommendationEmpty: "추천할 미션을 준비 중이에요.",
} as const;

const conceptLabelMap: Record<string, string> = {
  percent_comparison: "비율 비교",
  percent_discount: "할인율 계산",
  quadratic_vertex: "이차함수 꼭짓점",
  speed_relationship: "속도·거리·시간 관계",
  vocab: "영어 어휘",
  reading: "영어 독해",
  grammar: "영어 문법",
  listening: "영어 듣기",
};

const conceptDescriptionMap: Record<string, { strength: string; weakness: string; recommendation: string }> = {
  percent_comparison: {
    strength: "두 양을 비교하는 비율 계산에서 정확하게 풀고 있어요. 잘하고 있어요!",
    weakness: "두 양을 비교하는 비율 계산에서 실수가 있어요. 조금 더 연습해 봐요.",
    recommendation: "할인·비율 관련 실생활 비율 계산 문제를 풀면서 비율 감각을 키워보세요.",
  },
  percent_discount: {
    strength: "할인율과 정가·판매가 계산에서 정확하게 풀고 있어요. 실생활에서도 바로 쓸 수 있어요!",
    weakness: "할인율과 정가·판매가 계산에서 실수가 있어요. 조금 더 연습해 봐요.",
    recommendation: "할인율과 판매가, 정가의 관계를 실생활 문제로 연습해 보는 것이 좋아요.",
  },
  quadratic_vertex: {
    strength: "이차함수 꼭짓점의 의미를 잘 이해하고, 식에서 꼭짓점을 찾는 능력이 뛰어나요!",
    weakness: "이차함수 꼭짓점을 식에서 찾는 부분에서 어려움이 있어요.",
    recommendation: "꼭짓점을 찾는 연습과 함께 이차함수 그래프를 그려보며 감각을 키워보세요.",
  },
  speed_relationship: {
    strength: "속도, 거리, 시간의 관계를 정확하게 파악하고 풀고 있어요. 대단해요!",
    weakness: "속도, 거리, 시간의 관계를 파악하는 부분에서 어려움이 있어요.",
    recommendation: "실생활 상황을 활용한 속도·거리·시간 연습 문제를 꾸준히 풀어보는 것이 좋아요.",
  },
  vocab: {
    strength: "다양한 영어 어휘를 잘 이해하고, 문맥에서 의미를 파악하는 능력이 뛰어나요!",
    weakness: "영어 어휘 범위를 좀 더 넓히면 독해 실력이 빠르게 올라갈 거예요.",
    recommendation: "매일 새로운 어휘를 문맥 안에서 학습하는 습관을 들여보세요.",
  },
  reading: {
    strength: "글의 흐름을 잘 파악하고, 영어 지문에서 핵심 내용을 찾는 능력이 좋아요!",
    weakness: "영어 지문의 전체 흐름을 파악하는 부분에서 어려움이 있어요.",
    recommendation: "짧은 글부터 시작해서 영어 지문 읽는 속도와 이해력을 키우는 연습을 해보세요.",
  },
  grammar: {
    strength: "문장 구조와 영어 문법 규칙을 잘 이해하고 적용하고 있어요!",
    weakness: "문장 구조와 영어 문법 규칙을 적용하는 부분에서 어려움이 있어요.",
    recommendation: "자주 틀리는 문법 포인트를 중심으로 반복 연습하면 빠르게 향상될 거예요.",
  },
  listening: {
    strength: "영어 듣기에서 영어 발음과 표현을 잘 이해하고 있어요. 훌륭해요!",
    weakness: "영어 듣기에서 영어 발음과 표현을 이해하는 부분에서 어려움이 있어요.",
    recommendation: "짧은 영어 대화를 반복해서 들으며 표현을 익히는 연습을 해보세요.",
  },
};

function displayText(value: unknown, fallback = ""): string {
  const text = normalizeUiText(value);
  return text || fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => displayText(value)).filter(Boolean)));
}

function conceptLabel(value: string): string {
  const normalized = displayText(value);
  if (!normalized) return "알 수 없는 개념";

  const concept = getConcept(normalized);
  if (concept?.label) return displayText(concept.label, "알 수 없는 개념");

  const conceptNode = getConceptNode(normalized);
  if (conceptNode?.displayName) return displayText(conceptNode.displayName, "알 수 없는 개념");

  return displayText(conceptLabelMap[normalized], normalized);
}

function conceptDescription(value: string, tone: "strength" | "weakness" | "recommendation"): string {
  const normalized = displayText(value);
  const label = conceptLabel(normalized);

  if (!normalized) {
    if (tone === "strength") return "이번 달 학습에서 잘하고 있는 영역이에요!";
    if (tone === "weakness") return "알 수 없는 개념이지만 조금 더 연습해 봐요.";
    return "새로운 미션을 풀면서 실력을 키워보세요.";
  }

  const preset = conceptDescriptionMap[normalized];
  if (preset) return displayText(preset[tone]);

  const concept = getConcept(normalized);
  if (concept) {
    if (tone === "strength") {
      return `${label} 개념을 잘 이해하고 있어요. 이번 달에도 꾸준히 잘하고 있어요!`;
    }
    if (tone === "weakness") {
      return displayText(concept.recommendation, `${label} 개념을 조금 더 연습해 봐요.`);
    }
    return displayText(concept.recommendation, `${label} 개념을 중심으로 실력을 키우는 미션을 풀어보세요.`);
  }

  const conceptNode = getConceptNode(normalized);
  if (conceptNode) {
    if (tone === "strength") {
      return `${label} 개념을 잘 이해하고 있어요. 꾸준히 실력이 쌓이고 있어요!`;
    }
    if (tone === "weakness") {
      return displayText(conceptNode.shortDescription, `${label} 개념을 좀 더 연습해 봐요.`);
    }
    return `${label} 개념을 중심으로 실력을 키우는 미션을 풀어보세요.`;
  }

  if (tone === "strength") return `${label} 개념을 잘 이해하고 있어요. 이번 달에도 꾸준히 잘하고 있어요!`;
  if (tone === "weakness") return `${label} 개념을 좀 더 집중해서 연습하면 실력이 빠르게 올라갈 거예요.`;
  return `${label} 개념을 중심으로 실력을 키우는 미션을 풀어보세요.`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTone(value: number): string {
  if (value >= 85) return "bg-[#7DD3A8]";
  if (value >= 70) return "bg-[var(--accent)]";
  return "bg-[#FF8A8A]";
}

function scoreCaption(value: number): string {
  if (value >= 85) return "매우 잘하고 있어요!";
  if (value >= 70) return "꾸준히 잘하고 있어요";
  return "조금 더 연습해 봐요";
}

function formatCreatedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function monthRange(monthKey: string): { startIso: string; endIso: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function kstDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function missionConceptLabel(mission: GeneratedMission): string {
  return displayText(
    mission.mission_json.mainConcept || mission.mission_json.conceptTags?.[0] || mission.title,
    displayText(mission.title, "알 수 없는 개념")
  );
}

function readStatusBadges(item: ReportListItem): { student: string; parent: string } {
  return {
    student: item.student_read ? "학생 확인 완료" : "학생 미확인",
    parent:
      item.parent_total_count === 0
        ? "보호자 연결 없음"
        : item.parent_all_read
          ? "보호자 확인 완료"
          : "보호자 미확인",
  };
}

async function fetchMonthlySummary(monthKey: string): Promise<MonthlySummary> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error(REPORT_COPY.loginRequired);

  const { startIso, endIso } = monthRange(monthKey);
  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("mission_id,status,score,duration_sec,updated_at,completed_at")
    .eq("student_id", session.user.id)
    .gte("updated_at", startIso)
    .lt("updated_at", endIso)
    .returns<MonthlyAttemptRow[]>();
  if (attemptsRes.error) throw attemptsRes.error;

  const attempts = attemptsRes.data ?? [];
  if (attempts.length === 0) return EMPTY_SUMMARY;

  const studyDays = new Set(attempts.map((row) => kstDateKey(row.updated_at)).filter(Boolean)).size;
  const completedMissionIds = new Set(
    attempts
      .filter((row) => row.status === "completed" && row.completed_at && row.completed_at >= startIso && row.completed_at < endIso)
      .map((row) => row.mission_id)
  );
  const scoredAttempts = attempts.filter((row) => typeof row.score === "number");
  const averageAccuracy = scoredAttempts.length > 0
    ? clampScore(scoredAttempts.reduce((sum, row) => sum + (row.score ?? 0), 0) / scoredAttempts.length)
    : 0;
  const studyMinutes = Math.round(attempts.reduce((sum, row) => sum + (row.duration_sec ?? 0), 0) / 60);

  const allPublished = await fetchPublishedMissions(96);
  const attemptedMissionIds = Array.from(new Set(attempts.map((row) => row.mission_id)));
  const missionMap = new Map(allPublished.map((mission) => [mission.id, mission]));

  const conceptScores = new Map<string, { total: number; count: number }>();
  for (const row of attempts) {
    const mission = missionMap.get(row.mission_id);
    if (!mission || typeof row.score !== "number") continue;
    const concept = missionConceptLabel(mission);
    const previous = conceptScores.get(concept) ?? { total: 0, count: 0 };
    previous.total += row.score;
    previous.count += 1;
    conceptScores.set(concept, previous);
  }

  const rankedConcepts = Array.from(conceptScores.entries())
    .map(([concept, stats]) => ({
      concept,
      average: stats.count > 0 ? stats.total / stats.count : 0,
      count: stats.count,
    }))
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      return b.count - a.count;
    });

  const strengths = rankedConcepts
    .filter((item) => item.average >= 80)
    .slice(0, 3)
    .map((item) => item.concept);

  const weaknesses = rankedConcepts
    .slice()
    .sort((a, b) => a.average - b.average)
    .filter((item) => item.average < 80)
    .slice(0, 3)
    .map((item) => item.concept);

  const weakConceptSet = new Set(weaknesses);
  const recommendedMissions = allPublished
    .filter((mission) => !attemptedMissionIds.includes(mission.id))
    .filter((mission) => weakConceptSet.has(missionConceptLabel(mission)))
    .slice(0, 2)
    .map((mission) => ({
      id: mission.id,
      title: mission.title,
      concept: missionConceptLabel(mission),
    }));

  return {
    totalStudyDays: studyDays,
    completedMissions: completedMissionIds.size,
    averageAccuracy,
    studyMinutes,
    mathScore: averageAccuracy,
    strengths,
    weaknesses,
    recommendedMissions,
  };
}

export default function StudentReportsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReportListItem[]>([]);
  const [summary, setSummary] = useState<MonthlySummary>(EMPTY_SUMMARY);
  const [trendRows, setTrendRows] = useState<RecentEnglishTrendRow[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reportRecommendations, setReportRecommendations] = useState<MissionRecommendationResult[]>([]);

  const currentReport = items[0] ?? null;
  const previousReports = items.slice(1);

  const englishScore = useMemo(() => {
    if (!currentReport?.english_metrics) return 0;
    const values = [
      currentReport.english_metrics.vocab,
      currentReport.english_metrics.reading,
      currentReport.english_metrics.grammar,
      currentReport.english_metrics.listening,
    ].filter((value): value is number => typeof value === "number");
    if (values.length === 0) return 0;
    return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [currentReport]);

  const englishMetricItems = useMemo(() => {
    if (!currentReport?.english_metrics) return [];
    return (Object.entries(KOREAN_SUBJECT_LABELS) as Array<[string, string]>)
      .map(([key, label]) => ({
        key,
        label: displayText(label),
        value: clampScore((currentReport.english_metrics as unknown as Record<string, number>)?.[key] ?? 0),
      }));
  }, [currentReport]);

  const strengthItems = useMemo(() => {
    const result = uniqueNonEmpty(summary.strengths);
    if (result.length >= 3) return result.slice(0, 3);
    const englishStrong = englishMetricItems
      .filter((item) => item.value >= 80)
      .map((item) => item.key);
    return uniqueNonEmpty([...result, ...englishStrong]).slice(0, 3);
  }, [englishMetricItems, summary.strengths]);

  const weaknessItems = useMemo(() => {
    const result = uniqueNonEmpty(summary.weaknesses);
    if (result.length >= 3) return result.slice(0, 3);
    const englishWeak = englishMetricItems
      .filter((item) => item.value > 0 && item.value < 80)
      .sort((a, b) => a.value - b.value)
      .map((item) => item.key);
    return uniqueNonEmpty([...result, ...englishWeak]).slice(0, 3);
  }, [englishMetricItems, summary.weaknesses]);

  const strengthInsightItems = useMemo<InsightItem[]>(() => (
    strengthItems.map((item) => ({
      key: item,
      label: displayText(conceptLabel(item), "알 수 없는 개념"),
      description: displayText(conceptDescription(item, "strength")),
    }))
  ), [strengthItems]);

  const weaknessInsightItems = useMemo<InsightItem[]>(() => (
    weaknessItems.map((item) => ({
      key: item,
      label: displayText(conceptLabel(item), "알 수 없는 개념"),
      description: displayText(conceptDescription(item, "weakness")),
    }))
  ), [weaknessItems]);

  const recommendedMissionItems = useMemo(() => (
    reportRecommendations.map((item) => ({
      id: item.mission.id,
      title: displayText(item.mission.title, "추천 미션"),
      conceptLabel: displayText(item.conceptLabel, "알 수 없는 개념"),
      reason: displayText(item.reason, conceptDescription(item.conceptId ?? "", "recommendation")),
    }))
  ), [reportRecommendations]);

  const heroSummary = useMemo(() => {
    const note = displayText(currentReport?.english_metrics?.note);
    if (note) return note;
    const topStrength = strengthInsightItems[0]?.label;
    if (topStrength) return REPORT_COPY.heroSummaryWithStrength(topStrength);
    const topWeakness = weaknessInsightItems[0]?.label;
    if (topWeakness) return REPORT_COPY.heroSummaryWithWeakness(topWeakness);
    return REPORT_COPY.heroFallbackSummary;
  }, [currentReport?.english_metrics?.note, strengthInsightItems, weaknessInsightItems]);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Student reports session failed:", toPrettyErrorString(sessionError), sessionError);
      setError(prettyUserError(sessionError));
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    try {
      const [rows, recommendationBundle] = await Promise.all([
        listStudentReports(session.user.id),
        getStudentMissionRecommendations(session.user.id),
      ]);
      setItems(rows);
      setReportRecommendations(
        (recommendationBundle.weakConceptRecommendations.length > 0
          ? recommendationBundle.weakConceptRecommendations
          : recommendationBundle.allRanked.filter((item) => !item.factors.completedMission)).slice(0, 2)
      );

      const latest = rows[0] ?? null;
      if (latest) {
        const monthKey = normalizeMonthKey(latest.month);
        const [nextSummary, nextTrendRows] = await Promise.all([
          monthKey ? fetchMonthlySummary(monthKey) : Promise.resolve(EMPTY_SUMMARY),
          getRecentEnglishTrends(latest.id),
        ]);
        setSummary(nextSummary);
        setTrendRows(nextTrendRows);
      } else {
        setSummary(EMPTY_SUMMARY);
        setTrendRows([]);
      }
    } catch (e: unknown) {
      console.error("Student reports load failed:", toPrettyErrorString(e), e);
      setError(prettyUserError(e));
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      setTrendRows([]);
      setReportRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const openPdf = async (reportId: string) => {
    try {
      setDownloadingId(reportId);
      const url = await getReportSignedUrl(reportId, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      console.error("Student reports download failed:", toPrettyErrorString(e), e);
      setError(prettyUserError(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const heroTitle = currentReport ? `${formatReportMonth(currentReport.month)} 학습 리포트` : "학습 리포트";
  const statusBadges = currentReport ? readStatusBadges(currentReport) : null;

  return (
    <PageShell maxWidthClassName="max-w-6xl" contentClassName="mt-0">
      <div className="space-y-6">
        {loading && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
            {REPORT_COPY.loading}
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            {displayText(error)}
          </div>
        )}
        {!loading && !error && !currentReport && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
            {REPORT_COPY.empty}
          </div>
        )}

        {!loading && !error && currentReport && (
          <>
            <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] md:p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs uppercase tracking-[0.26em] text-[var(--accent)]/75">Learning Report</p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl">
                    {displayText(heroTitle, "학습 리포트")}
                  </h1>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
                    {displayText(heroSummary, REPORT_COPY.heroFallbackSummary)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${currentReport.student_read ? "border-[#7DD3A8] bg-[rgba(125,211,168,0.12)] text-[#7DD3A8]" : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                      {`학생 ${displayText(statusBadges?.student)}`}
                    </span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${currentReport.parent_all_read ? "border-[#7DD3A8] bg-[rgba(125,211,168,0.12)] text-[#7DD3A8]" : "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]"}`}>
                      {displayText(statusBadges?.parent)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void openPdf(currentReport.id)}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95 md:w-auto"
                >
                  {downloadingId === currentReport.id ? "다운로드 중..." : "리포트 다운로드"}
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "총 학습일", value: `${summary.totalStudyDays}일`, hint: "이번 달 학습한 날의 합계예요." },
                { label: "완료 미션", value: `${summary.completedMissions}개`, hint: "완료로 기록된 미션 수예요." },
                { label: "평균 정확도", value: `${summary.averageAccuracy}%`, hint: "문제를 푼 평균 정답률이에요." },
                { label: "학습 시간", value: `${summary.studyMinutes}분`, hint: "이번 달 학습에 사용한 시간이에요." },
              ].map((card) => (
                <article key={card.label} className="min-h-[160px] rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
                  <p className="text-sm font-medium text-[var(--text-muted)]">{card.label}</p>
                  <p className="mt-5 text-3xl font-semibold tracking-tight text-[var(--text)]">{card.value}</p>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">{card.hint}</p>
                </article>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
                <h2 className="text-lg font-semibold text-[var(--text)]">학습 과목별 성취도</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">수학과 영어 학습 성취도를 한눈에 확인할 수 있어요.</p>
                <div className="mt-6 space-y-5">
                  {[
                    { label: "수학 성취도", value: summary.mathScore },
                    { label: "영어 성취도", value: englishScore },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[var(--text)]">{row.label}</p>
                        <p className="text-sm font-semibold text-[var(--text)]">{row.value}%</p>
                      </div>
                      <div className="mt-3 h-3 rounded-full bg-[var(--card-soft)]">
                        <div className={`h-3 rounded-full ${scoreTone(row.value)}`} style={{ width: `${row.value}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">{scoreCaption(row.value)}</p>
                    </div>
                  ))}
                </div>
                {englishMetricItems.length > 0 && (
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {englishMetricItems.map((item) => (
                      <div key={item.key} className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
                        <p className="text-xs text-[var(--text-muted)]">{displayText(item.label)}</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--text)]">{item.value}%</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
                <h2 className="text-lg font-semibold text-[var(--text)]">최근 영어 추이</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">최근 리포트 기준으로 영어 성취도 변화를 확인해 보세요.</p>
                {trendRows.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
                    이전 리포트가 아직 없어요.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {trendRows.map((row) => {
                      const values = [row.vocab, row.reading, row.grammar, row.listening].filter((value): value is number => typeof value === "number");
                      const average = values.length > 0 ? clampScore(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
                      return (
                        <div key={row.report_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-[var(--text)]">{displayText(formatReportMonth(row.report_month), row.report_month)}</p>
                            <p className="text-sm font-semibold text-[var(--text)]">{average}%</p>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-[var(--card-soft)]">
                            <div className={`h-2 rounded-full ${scoreTone(average)}`} style={{ width: `${average}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
                <h2 className="text-lg font-semibold text-[var(--text)]">강점 / 보완 영역</h2>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(125,211,168,0.3)] bg-[rgba(125,211,168,0.06)] p-4">
                    <p className="text-sm font-semibold text-[#1f6a3f]">강점 개념</p>
                    <div className="mt-3 space-y-3">
                      {strengthInsightItems.length > 0 ? strengthInsightItems.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-[rgba(125,211,168,0.25)] bg-[rgba(125,211,168,0.1)] p-3">
                          <span className="inline-flex rounded-full border border-[rgba(125,211,168,0.4)] bg-[rgba(125,211,168,0.15)] px-3 py-1 text-xs font-medium text-[#1f6a3f]">
                            {displayText(item.label, "알 수 없는 개념")}
                          </span>
                          <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#2d7a4f]">{displayText(item.description)}</p>
                        </div>
                      )) : <p className="text-xs text-[#2d7a4f]">{REPORT_COPY.strengthFallback}</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(212,83,126,0.25)] bg-[rgba(212,83,126,0.05)] p-4">
                    <p className="text-sm font-semibold text-[var(--accent)]">보완 개념</p>
                    <div className="mt-3 space-y-3">
                      {weaknessInsightItems.length > 0 ? weaknessInsightItems.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-[rgba(212,83,126,0.2)] bg-[rgba(212,83,126,0.08)] p-3">
                          <span className="inline-flex rounded-full border border-[rgba(212,83,126,0.3)] bg-[rgba(212,83,126,0.1)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                            {displayText(item.label, "알 수 없는 개념")}
                          </span>
                          <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{displayText(item.description)}</p>
                        </div>
                      )) : <p className="text-xs text-[var(--text-muted)]">{REPORT_COPY.weaknessFallback}</p>}
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
                <h2 className="text-lg font-semibold text-[var(--text)]">추천 미션</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">이번 달 보완이 필요한 개념을 중심으로 미션을 추천해 드려요.</p>
                {recommendedMissionItems.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
                    {REPORT_COPY.recommendationEmpty}
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {recommendedMissionItems.map((mission) => (
                      <div key={mission.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--text)]">{mission.title}</p>
                            <div className="mt-3 space-y-2">
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">개념</p>
                                <span className="mt-1 inline-flex rounded-full border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]">
                                  {mission.conceptLabel}
                                </span>
                              </div>
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">추천 이유</p>
                                <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{mission.reason}</p>
                              </div>
                            </div>
                          </div>
                          <Link
                            href={`/student/math/mission/${mission.id}`}
                            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white"
                          >
                            시작하기
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>

            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text)]">이전 리포트</h2>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">이전 리포트를 보면서 학습 성장을 확인해 보세요.</p>
                </div>
              </div>
              {previousReports.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
                  이전 리포트가 아직 없어요.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {previousReports.map((item) => {
                    const badges = readStatusBadges(item);
                    return (
                      <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                        <p className="text-sm font-semibold text-[var(--text)]">{displayText(formatReportMonth(item.month), item.month)}</p>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">{`발행일: ${formatCreatedDate(item.created_at)}`}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${item.student_read ? "border-[#7DD3A8] bg-[rgba(125,211,168,0.12)] text-[#1f6a3f]" : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                            {`학생 ${displayText(badges.student)}`}
                          </span>
                          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                            {displayText(badges.parent)}
                          </span>
                        </div>
                        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                          <Link
                            href={`/reports/${item.id}`}
                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                          >
                            리포트 보기
                          </Link>
                          <button
                            type="button"
                            onClick={() => void openPdf(item.id)}
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                          >
                            {downloadingId === item.id ? "다운로드 중..." : "PDF 다운로드"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}