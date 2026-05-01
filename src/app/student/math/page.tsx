"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import BadgeShowcasePanel from "@/components/badges/BadgeShowcasePanel";
import { StatusChip, StudentChip } from "@/components/student/StatusChips";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import WeeklyPathMissionCard from "@/components/student/WeeklyPathMissionCard";
import WeeklyPathHeader from "@/components/student/WeeklyPathHeader";
import { computeCurrentWeekKey, getWeeklyPathWithTheme, type WeeklyPathWithTheme } from "@/lib/weeklyPathTheme";
import { studentMathCopy } from "@/constants/studentMathCopy";
import { getStudentBadgeShowcase } from "@/lib/badges";
import {
  formatCurriculumGradeLabel,
  getEffectiveSchoolGrade,
} from "@/lib/academicYear";
import { getConcept } from "@/lib/concepts";
import { getConceptNode } from "@/lib/conceptMap";
import {
  calculateStreak,
  fetchLatestInProgressAttempt,
  fetchMathHomeFreshUnits,
  fetchMissionsByCategory,
  fetchMathHomeGradeUnits,
  fetchMissionById,
  fetchMissionProgressMap,
  fetchPublishedMissions,
  fetchRecentCompletedMissions,
  fetchStudentMissionRecommendationSignals,
  fetchWeakConceptAnalysis,
  getStudentMissionStats,
  getStudentXpSummary,
} from "@/lib/missions";
import {
  getStudentMissionRecommendations,
  type MissionRecommendationResult,
  type StudentMissionRecommendationBundle,
} from "@/lib/recommendations";
import {
  getTodayMathRecommendation,
  getWeeklyMathPath,
  weeklyPathDifficultySummary,
  type TodayMathRecommendation,
  type WeeklyMathPathResult,
} from "@/lib/mathRecommendations";
import { buildRecommendationHref } from "@/lib/recommendationNavigation";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";
import XpLevelBar from "@/components/XpLevelBar";
import { getLevelDisplay, calcProgress } from "@/lib/xpSystem";
import type { ProfileSchoolLevel } from "@/lib/studentProfile";
import type {
  ConceptMissionRecommendation,
  MathHomeUnitCard,
  MissionProgressSummary,
  MissionRecommendationStatus,
  RecentCompletedMissionSummary,
  StudentMissionRecommendationSignal,
  WeakConceptAnalysis,
} from "@/lib/missions";
import type { BadgeShowcase } from "@/types/badges";
import type { CurriculumUnit, GeneratedMission, StudentXpSummary } from "@/types/missions";

const GRADE_FILTERS = [
  { grade: 3, schoolLevel: "elementary" as const, label: "초3" },
  { grade: 4, schoolLevel: "elementary" as const, label: "초4" },
  { grade: 5, schoolLevel: "elementary" as const, label: "초5" },
  { grade: 6, schoolLevel: "elementary" as const, label: "초6" },
  { grade: 1, schoolLevel: "middle" as const,     label: "중1" },
  { grade: 2, schoolLevel: "middle" as const,     label: "중2" },
  { grade: 3, schoolLevel: "middle" as const,     label: "중3" },
  { grade: 1, schoolLevel: "high" as const,       label: "고1" },
  { grade: 2, schoolLevel: "high" as const,       label: "고2" },
];
type GradeFilter = typeof GRADE_FILTERS[number];
const TODAY_GOAL = 1;
const WEEKLY_GOAL = 5;

const EMPTY_XP_SUMMARY: StudentXpSummary = {
  totalXp: 0,
  level: 1,
  currentLevelXpFloor: 0,
  nextLevelXpTarget: 30,
  xpToNextLevel: 30,
};
const CAREER_SECTION_COPY = {
  sectionTitle: "\uC2E4\uC81C \uC9C1\uC5C5\uC5D0\uC11C \uC4F0\uC774\uB294 \uC218\uD559",
  sectionDescription: "\uAC8C\uC784, \uCE74\uD398, \uB4DC\uB860, \uB85C\uBD07\uCC98\uB7FC \uC2E4\uC81C \uC9C1\uC5C5\uACFC \uC5F0\uACB0\uB41C \uC218\uD559 \uBBF8\uC158\uC744 \uB9CC\uB098 \uBCF4\uC138\uC694.",
  empty: "\uC9C1\uC5C5\uACFC \uC5F0\uACB0\uB41C \uC0C8 \uBBF8\uC158\uC744 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4.",
  filteredEmpty: "\uC120\uD0DD\uD55C \uAD00\uC2EC \uBD84\uC57C\uC5D0 \uB9DE\uB294 \uBBF8\uC158\uC744 \uB354 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4. \uB2E4\uB978 \uD544\uD130\uB3C4 \uC0B4\uD3B4\uBCF4\uC138\uC694.",
  badge: "\uC9C1\uC5C5 \uC5F0\uACB0",
  difficultyLabel: "\uB09C\uC774\uB3C4",
  estimatedLabel: "\uC608\uC0C1",
  minutesLabel: "\uBD84",
  startButtonLabel: "\uC2DC\uC791\uD558\uAE30",
} as const;

const RECOMMENDATION_SECTION_COPY = {
  weakTitle: "\uBCF4\uC644 \uD544\uC694",
  weakDescription: "\uB9C8\uC2A4\uD130\uB9AC \uC810\uC218\uAC00 \uB0AE\uC740 \uB2E8\uC6D0 \uC911\uC2EC\uC73C\uB85C \uB2E4\uC2DC \uD480\uC5B4\uBCFC \uBBF8\uC158\uC744 \uBAA8\uC544\uBD24\uC5B4\uC694.",
  weakEmpty: "\uBCF4\uC644 \uD544\uC694 \uBBF8\uC158\uC744 \uC900\uBE44 \uC911\uC774\uC5D0\uC694.",
  normalTitle: "\uC720\uC9C0 \uD559\uC2B5",
  normalDescription: "\uC9C0\uAE08 \uD750\uB984\uC744 \uC720\uC9C0\uD558\uBA74 \uC88B\uC740 \uB2E8\uC6D0 \uBBF8\uC158\uC774\uC5D0\uC694.",
  normalEmpty: "\uC720\uC9C0 \uD559\uC2B5 \uBBF8\uC158\uC744 \uC900\uBE44 \uC911\uC774\uC5D0\uC694.",
  strongTitle: "\uB3C4\uC804 \uCD94\uCC9C",
  strongDescription: "\uC790\uC2E0\uAC10\uC774 \uB192\uC740 \uB2E8\uC6D0\uC5D0\uC11C \uD55C \uB2E8\uACC4 \uB354 \uB3C4\uC804\uD574 \uBCFC \uBBF8\uC158\uC774\uC5D0\uC694.",
  strongEmpty: "\uB3C4\uC804 \uCD94\uCC9C \uBBF8\uC158\uC744 \uC900\uBE44 \uC911\uC774\uC5D0\uC694.",
} as const;
const CATEGORY_OPTIONS: { label: string; value: string | null }[] = [
  { label: "\uC804\uCCB4", value: null },
  { label: "\uAC8C\uC784", value: "game" },
  { label: "\uB3D9\uBB3C", value: "animal" },
  { label: "\uB85C\uBD07", value: "robot" },
  { label: "\uCE74\uD398/\uCC3D\uC5C5", value: "cafe" },
  { label: "\uCD2C\uC601/\uB4DC\uB860", value: "drone" },
  { label: "\uC774\uB3D9/\uBC30\uB2EC", value: "delivery" },
];

type RecommendationCategory = "not_started" | MissionRecommendationStatus;

type RecommendationItem = {
  mission: GeneratedMission;
  category: RecommendationCategory;
  reason: string;
};


const EMPTY_BADGE_SHOWCASE: BadgeShowcase = {
  totalEarned: 0,
  recentBadges: [],
  showcaseBadges: [],
  nextBadge: null,
};

type MathStudentProfile = {
  school_level: ProfileSchoolLevel | null;
  grade: number | null;
};

function goalLabel(current: number, target: number, doneText: string): string {
  if (current >= target) return doneText;
  return `\uD604\uC7AC ${Math.min(current, target)}/${target}`;
}


function unitMeta(unit: CurriculumUnit): string {
  return formatCurriculumGradeLabel(unit.grade, unit.school_level);
}

function unitMissionCountLine(unit: MathHomeUnitCard): string {
  if (unit.missionCount <= 0) return "\uBBF8\uC158 \uC900\uBE44 \uC911";
  return `\uBBF8\uC158 ${unit.missionCount}\uAC1C`;
}

function pickTodayMission(missions: GeneratedMission[]): GeneratedMission | null {
  if (missions.length === 0) return null;
  const key = new Date().toISOString().slice(0, 10);
  const hash = Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return missions[hash % missions.length] ?? missions[0] ?? null;
}

function shortLine(value?: string | null, fallback = "\uD575\uC2EC \uAC1C\uB150\uC744 \uC9E7\uAC8C \uD655\uC778\uD574 \uBCF4\uC138\uC694."): string {
  const text = cleanDisplayText(decodeUnicode(value));
  if (!text) return fallback;
  if (text.length <= 42) return text;
  return `${text.slice(0, 42).trimEnd()}...`;
}

function decodeUnicode(text?: string | null): string {
  if (typeof text !== "string") return "";
  if (!text.includes("\\u")) return text;

  try {
    return JSON.parse(`"${text}"`) as string;
  } catch {
    return text;
  }
}

function cleanDisplayText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\\r\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function missionWhyLine(mission: GeneratedMission | null): string {
  if (!mission) return "\uC624\uB298\uC740 \uC0DD\uD65C \uC18D \uC218\uD559 \uC0C1\uD669\uC744 \uAC00\uBCBD\uAC8C \uD0D0\uAD6C\uD574 \uBD10\uC694.";
  return shortLine(mission.mission_json.scenario, "\uC624\uB298\uC740 \uC0DD\uD65C \uC18D \uC218\uD559 \uC0C1\uD669\uC744 \uAC00\uBCBD\uAC8C \uD0D0\uAD6C\uD574 \uBD10\uC694.");
}

function unitLearningLine(unit: CurriculumUnit): string {
  return shortLine(unit.concept_summary ?? unit.description, "\uC774 \uB2E8\uC6D0\uC5D0\uC11C \uBC30\uC6B0\uB294 \uD575\uC2EC \uAC1C\uB150\uC744 \uC9E7\uAC8C \uC0B4\uD3B4\uBD10\uC694.");
}

function statusText(progress?: MissionProgressSummary): string {
  if (!progress || progress.status === "not_started") return "\uC544\uC9C1 \uC2DC\uC791 \uC804";
  if (progress.status === "completed") return "\uC644\uB8CC";
  const total = progress.totalSteps > 0 ? progress.totalSteps : "-";
  return `\uC9C4\uD589\uC911 \u00B7 ${progress.lastStep}/${total} \uB2E8\uACC4`;
}

function statusBadge(progress?: MissionProgressSummary): { label: string; variant: "neutral" | "info" | "success" } {
  if (!progress || progress.status === "not_started") {
    return { label: "\uC2DC\uC791 \uC804", variant: "neutral" };
  }
  if (progress.status === "completed") {
    return { label: "\uC644\uB8CC", variant: "success" };
  }
  return { label: "\uC9C4\uD589\uC911", variant: "info" };
}

function resumeStatusText(progress?: MissionProgressSummary): string {
  if (!progress || progress.status === "not_started") return "\uC2DC\uC791\uD558\uAE30";
  if (progress.status === "completed") return "\uC644\uB8CC";
  const total = progress.totalSteps > 0 ? progress.totalSteps : "-";
  return `\uC9C4\uD589\uC911 ${progress.lastStep}/${total} \uB2E8\uACC4`;
}

function streakLabel(streakDays: number): string {
  if (streakDays <= 0) return "\uC624\uB298 \uCCAB \uD559\uC2B5\uC744 \uC2DC\uC791\uD574 \uBCFC\uAE4C\uC694?";
  if (streakDays === 1) return "\uC624\uB298 \uCCAB \uD559\uC2B5\uC774\uC5D0\uC694";
  return `${streakDays}\uC77C \uC5F0\uC18D \uD559\uC2B5 \uC911`;
}

function recommendationCategory(signal?: StudentMissionRecommendationSignal): RecommendationCategory {
  if (!signal) return "not_started";
  return signal.recommendationStatus;
}

function recommendationRank(category: RecommendationCategory): number {
  if (category === "not_started") return 1;
  if (category === "in_progress") return 2;
  if (category === "completed_but_struggled") return 3;
  return 4;
}


type RecommendationReasonKind = "same_concept" | "prerequisite" | "next_concept";
function recommendationReason(category: RecommendationCategory, kind: RecommendationReasonKind = "same_concept"): string {
  if (kind === "prerequisite") {
    return "\uC774 \uAC1C\uB150\uC744 \uC774\uD574\uD558\uAE30 \uC804\uC5D0 \uB3C4\uC6C0\uC774 \uB418\uB294 \uAE30\uCD08 \uAC1C\uB150\uC774\uC5D0\uC694";
  }
  if (kind === "next_concept") {
    return "\uC774 \uAC1C\uB150\uC744 \uC798 \uD480\uC5C8\uC73C\uB2C8 \uB2E4\uC74C \uB2E8\uACC4\uC5D0 \uB3C4\uC804\uD574 \uBCFC \uC218 \uC788\uC5B4\uC694";
  }
  if (category === "not_started") {
    return "\uC544\uC9C1 \uC644\uB8CC\uD558\uC9C0 \uC54A\uC740 \uBBF8\uC158\uC774\uC5D0\uC694";
  }
  if (category === "in_progress") {
    return "\uAC19\uC740 \uAC1C\uB150\uC744 \uC774\uC5B4\uC11C \uC5F0\uC2B5\uD560 \uC218 \uC788\uC5B4\uC694";
  }
  if (category === "completed_but_struggled") {
    return "\uD78C\uD2B8\uB97C \uC0AC\uC6A9\uD588\uAC70\uB098 \uD5F7\uAC08\uB9B0 \uB2E8\uACC4\uAC00 \uC788\uC5B4 \uB2E4\uC2DC \uD480\uC5B4\uBCF4\uBA74 \uC88B\uC544\uC694";
  }
  return "\uAC19\uC740 \uAC1C\uB150\uC744 \uB2E4\uB978 \uC0C1\uD669\uC5D0\uC11C \uB2E4\uC2DC \uC5F0\uC2B5\uD560 \uC218 \uC788\uC5B4\uC694";
}

function conceptLabel(conceptId: string): string {
  return getConcept(conceptId)?.label ?? getConceptNode(conceptId)?.displayName ?? "\uD575\uC2EC \uAC1C\uB150";
}

function conceptDescription(conceptId: string, fallback: string): string {
  return getConcept(conceptId)?.description ?? getConceptNode(conceptId)?.shortDescription ?? fallback;
}

function recommendationConceptLabel(label: string | null | undefined): string {
  const normalized = typeof label === "string" ? label.trim() : "";
  if (!normalized || normalized.includes("_")) return "\uD575\uC2EC \uAC1C\uB150";
  return normalized;
}


function recommendationCtaLabel(kind: "start" | "weak" | "normal" | "strong", item?: Pick<MissionRecommendationResult, "factors">): string {
  if (kind === "start" && item && (item.factors.recentConcept || item.factors.recentUnit)) return "\uC774\uC5B4\uC11C \uBCF4\uAE30";
  if (kind === "weak") return "\uAC1C\uB150 \uBCF5\uC2B5";
  if (kind === "normal") return "\uACC4\uC18D \uD559\uC2B5";
  if (kind === "strong") return "\uB3C4\uC804 \uC2DC\uC791";
  return "\uBC14\uB85C \uC2DC\uC791";
}

function recommendationStatusLabel(
  kind: "start" | "weak" | "normal" | "strong",
  item: Pick<MissionRecommendationResult, "factors">,
  progress?: MissionProgressSummary
): string {
  if (progress?.status === "in_progress") return "\uC774\uC5B4\uC11C \uD558\uAE30";
  if (item.factors.completedMission) return "\uBCF5\uC2B5 \uCD94\uCC9C";
  if (kind === "weak") return "\uC57D\uC810 \uBCF4\uC644";
  if (kind === "normal") return "\uC720\uC9C0 \uD559\uC2B5";
  if (kind === "strong") return "\uB3C4\uC804 \uCD94\uCC9C";
  return "\uCC98\uC74C \uC2DC\uC791";
}

function recommendationStatusClass(label: string): string {
  if (label === "\uC774\uC5B4\uC11C \uD558\uAE30") return "border-[rgba(117,191,255,0.28)] bg-[rgba(117,191,255,0.12)] text-[#9FD0FF]";
  if (label === "\uBCF5\uC2B5 \uCD94\uCC9C") return "border-[rgba(231,200,115,0.28)] bg-[rgba(231,200,115,0.12)] text-[#E7C873]";
  if (label === "\uC57D\uC810 \uBCF4\uC644") return "border-[rgba(231,200,115,0.22)] bg-[rgba(231,200,115,0.1)] text-[#E7C873]";
  if (label === "\uC720\uC9C0 \uD559\uC2B5") return "border-[rgba(199,216,255,0.24)] bg-[rgba(199,216,255,0.1)] text-[#C7D8FF]";
  if (label === "\uB3C4\uC804 \uCD94\uCC9C") return "border-[rgba(255,214,117,0.24)] bg-[rgba(255,214,117,0.1)] text-[#633806]";
  return "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]";
}

function recommendationMetaLine(mission: Pick<GeneratedMission, "difficulty" | "estimated_minutes">): string {
  return `${difficultyLabel(mission.difficulty)} \u00B7 \uC608\uC0C1 ${displayEstimatedMinutes(mission.estimated_minutes)}\uBD84`;
}

function displayEstimatedMinutes(minutes?: number | null): number {
  if (!minutes) return 7;
  if (minutes >= 15) return 9;
  if (minutes >= 13) return 8;
  if (minutes >= 11) return 7;
  if (minutes >= 9) return 6;
  return Math.max(5, minutes);
}

const recommendationReasonClampStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
} as const;

function recommendationBadge(category: RecommendationCategory): { label: string; variant: "neutral" | "info" | "warning" | "success" } {
  if (category === "not_started") return { label: "\uC0C8\uB85C \uCD94\uCC9C", variant: "neutral" };
  if (category === "in_progress") return { label: "\uC774\uC5B4\uD558\uAE30", variant: "info" };
  if (category === "completed_but_struggled") return { label: "\uBCF5\uC2B5 \uCD94\uCC9C", variant: "warning" };
  return { label: "\uAC1C\uB150 \uC815\uB9AC", variant: "success" };
}

function difficultyRankOf(mission: GeneratedMission): number {
  if (mission.difficulty === "easy") return 0;
  if (mission.difficulty === "normal") return 1;
  return 2;
}

function missionCreatedAtRank(mission: GeneratedMission): number {
  const time = Date.parse(mission.created_at);
  return Number.isFinite(time) ? time : 0;
}

function compareRecommendationItems(a: RecommendationItem, b: RecommendationItem): number {
  const rankDelta = recommendationRank(a.category) - recommendationRank(b.category);
  if (rankDelta !== 0) return rankDelta;

  const createdAtDelta = missionCreatedAtRank(b.mission) - missionCreatedAtRank(a.mission);
  if (createdAtDelta !== 0) return createdAtDelta;

  const difficultyDelta = difficultyRankOf(a.mission) - difficultyRankOf(b.mission);
  if (difficultyDelta !== 0) return difficultyDelta;

  return a.mission.title.localeCompare(b.mission.title, "ko");
}

function difficultyLabel(difficulty: GeneratedMission["difficulty"]): string {
  if (difficulty === "easy") return "\uC26C\uC6C0";
  if (difficulty === "normal") return "\uBCF4\uD1B5";
  return "\uB3C4\uC804";
}
function careerMissionLine(mission: GeneratedMission): string {
  const title = decodeUnicode(mission.title);
  const tags = mission.mission_json.conceptTags ?? [];

  if (title.includes("\uAC8C\uC784") || tags.includes("game")) {
    return "\uAC8C\uC784 \uC6B4\uC601\uC790\uB3C4 \uBCF4\uC0C1\uC744 \uACF5\uD3C9\uD558\uAC8C \uB098\uB20C \uB54C \uC218\uD559\uC744 \uC368\uC694.";
  }
  if (title.includes("\uCE74\uD398") || tags.includes("cafe")) {
    return "\uCE74\uD398 \uC6B4\uC601\uC790\uB294 \uAC00\uACA9 \uC870\uAC74\uC744 \uC2DD\uC73C\uB85C \uC815\uB9AC\uD560 \uC218 \uC788\uC5B4\uC57C \uD574\uC694.";
  }
  if (title.includes("\uB4DC\uB860") || tags.includes("drone")) {
    return "\uB4DC\uB860 \uCD2C\uC601\uAC00\uB294 \uB192\uC774 \uBCC0\uD654\uB97C \uADF8\uB798\uD504\uB85C \uC774\uD574\uD574\uC694.";
  }
  if (title.includes("\uB85C\uBD07") || tags.includes("robot")) {
    return "\uB85C\uBD07 \uC5D4\uC9C0\uB2C8\uC5B4\uB294 \uAC70\uB9AC\uC640 \uC2DC\uAC04\uC744 \uACC4\uC0B0\uD574 \uC6C0\uC9C1\uC784\uC744 \uC124\uACC4\uD574\uC694.";
  }
  if (title.includes("\uCE74\uBA54\uB77C") || tags.includes("creator") || tags.includes("youtube")) {
    return "\uC720\uD29C\uBC84\uB294 \uC7A5\uBE44 \uC2DC\uAC04\uC744 \uBE44\uAD50\uD558\uBA70 \uCD2C\uC601 \uACC4\uD68D\uC744 \uC138\uC6CC\uC694.";
  }
  if (title.includes("\uC544\uC774\uD15C") || tags.includes("app")) {
    return "\uC571 \uAC1C\uBC1C\uC790\uB294 \uC544\uC774\uD15C \uBE44\uC6A9 \uAD6C\uC870\uB97C \uC2DD\uC73C\uB85C \uC0DD\uAC01\uD560 \uC218 \uC788\uC5B4\uC694.";
  }

  return "\uC2E4\uC81C \uC9C1\uC5C5 \uD658\uACBD\uC5D0\uC11C\uB3C4 \uC218\uD559\uC73C\uB85C \uC0C1\uD669\uC744 \uD310\uB2E8\uD558\uACE0 \uACC4\uD68D\uD574\uC694.";
}

function difficultyBadgeTone(difficulty: GeneratedMission["difficulty"]): string {
  if (difficulty === "easy") return "border-[rgba(122,210,164,0.35)] bg-[rgba(122,210,164,0.12)] text-[#085041]";
  if (difficulty === "normal") return "border-[rgba(117,191,255,0.35)] bg-[rgba(117,191,255,0.12)] text-[#185FA5]";
  return "border-[rgba(255,214,117,0.35)] bg-[rgba(255,214,117,0.12)] text-[#633806]";
}

function careerMissionFilterLabel(mission: GeneratedMission): string {
  const source = [
    decodeUnicode(mission.title),
    decodeUnicode(mission.mission_json.scenario),
    decodeUnicode(mission.mission_json.mainConcept),
    ...(mission.mission_json.conceptTags ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (
    source.includes("\uAC8C\uC784") ||
    source.includes("\uC544\uC774\uD15C") ||
    source.includes("\uBCF4\uC0C1") ||
    source.includes("game")
  ) {
    return "\uAC8C\uC784";
  }
  if (
    source.includes("\uAC15\uC544\uC9C0") ||
    source.includes("\uACE0\uC591\uC774") ||
    source.includes("\uB3D9\uBB3C") ||
    source.includes("\uC218\uC758\uC0AC") ||
    source.includes("\uBC18\uB824") ||
    source.includes("animal")
  ) {
    return "\uB3D9\uBB3C";
  }
  if (source.includes("\uB85C\uBD07") || source.includes("robot")) {
    return "\uB85C\uBD07";
  }
  if (
    source.includes("\uCE74\uD398") ||
    source.includes("\uC74C\uB8CC") ||
    source.includes("\uCC3D\uC5C5") ||
    source.includes("\uAC00\uACA9") ||
    source.includes("cafe")
  ) {
    return "\uCE74\uD398/\uCC3D\uC5C5";
  }
  if (
    source.includes("\uB4DC\uB860") ||
    source.includes("\uCD2C\uC601") ||
    source.includes("\uCE74\uBA54\uB77C") ||
    source.includes("\uC720\uD29C\uBE0C") ||
    source.includes("\uC720\uD29C\uBC84") ||
    source.includes("drone") ||
    source.includes("camera") ||
    source.includes("creator") ||
    source.includes("youtube")
  ) {
    return "\uCD2C\uC601/\uB4DC\uB860";
  }
  if (
    source.includes("\uBC30\uB2EC") ||
    source.includes("\uC774\uB3D9") ||
    source.includes("\uC5EC\uD589") ||
    source.includes("\uD0DD\uC2DC") ||
    source.includes("\uC694\uAE08") ||
    source.includes("\uC790\uC804\uAC70") ||
    source.includes("\uB2EC\uB9AC\uAE30")
  ) {
    return "\uC774\uB3D9/\uBC30\uB2EC";
  }

  return "\uC804\uCCB4";
}

export default function StudentMathPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<GradeFilter>(GRADE_FILTERS[1]!); // 초4 기본값
  const [gradeUnits, setGradeUnits] = useState<MathHomeUnitCard[]>([]);
  const [freshUnits, setFreshUnits] = useState<MathHomeUnitCard[]>([]);
  const [missions, setMissions] = useState<GeneratedMission[]>([]);
  const [careerMissions, setCareerMissions] = useState<GeneratedMission[]>([]);
  const [resumeMission, setResumeMission] = useState<GeneratedMission | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, MissionProgressSummary>>({});
  const [recentCompletedMissions, setRecentCompletedMissions] = useState<RecentCompletedMissionSummary[]>([]);
  const [recommendationSignals, setRecommendationSignals] = useState<Record<string, StudentMissionRecommendationSignal>>({});
  const [weakConceptAnalysis, setWeakConceptAnalysis] = useState<WeakConceptAnalysis[]>([]);
  const [todayCompletedCount, setTodayCompletedCount] = useState(0);
  const [weeklyCompletedCount, setWeeklyCompletedCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [xpSummary, setXpSummary] = useState<StudentXpSummary>(EMPTY_XP_SUMMARY);
  const [xpStatus, setXpStatus] = useState<{
    total_xp: number;
    level: number;
    daily_streak: number;
    total_missions: number;
    badge_count: number;
  } | null>(null);
  const [badgeShowcase, setBadgeShowcase] = useState<BadgeShowcase>(EMPTY_BADGE_SHOWCASE);
  const [studentProfile, setStudentProfile] = useState<MathStudentProfile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [recommendationBundle, setRecommendationBundle] = useState<StudentMissionRecommendationBundle | null>(null);
  const [weeklyMathPath, setWeeklyMathPath] = useState<WeeklyMathPathResult | null>(null);
  const [todayRecommendation, setTodayRecommendation] = useState<TodayMathRecommendation | null>(null);
  const [weeklyMathPathError, setWeeklyMathPathError] = useState<string | null>(null);
  const [weeklyPathNotice, setWeeklyPathNotice] = useState<string | null>(null);
  const [weeklyPathTheme, setWeeklyPathTheme] = useState<WeeklyPathWithTheme | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setWeeklyPathNotice(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const missionRows = await fetchPublishedMissions(48);
        const missionProgress = await fetchMissionProgressMap(
          missionRows.map((mission) => mission.id),
          Object.fromEntries(missionRows.map((mission) => [mission.id, mission.mission_json.steps.length]))
        );

        let nextResumeMission: GeneratedMission | null = null;
        let nextRecentCompletedMissions: RecentCompletedMissionSummary[] = [];
        let nextRecommendationSignals: Record<string, StudentMissionRecommendationSignal> = {};
        let nextWeakConceptAnalysis: WeakConceptAnalysis[] = [];
        let nextTodayCompletedCount = 0;
        let nextWeeklyCompletedCount = 0;
        let nextStreakDays = 0;
        let nextXpSummary: StudentXpSummary = EMPTY_XP_SUMMARY;
        let nextBadgeShowcase: BadgeShowcase = EMPTY_BADGE_SHOWCASE;
        let nextStudentProfile: MathStudentProfile | null = null;
        let nextRecommendationBundle: StudentMissionRecommendationBundle | null = null;
        let nextWeeklyMathPath: WeeklyMathPathResult | null = null;
        let nextTodayRecommendation: TodayMathRecommendation | null = null;
        let nextWeeklyMathPathError: string | null = null;
        let nextWeeklyPathTheme: WeeklyPathWithTheme | null = null;

        if (user?.id) {
          // XP 현황 비차단 조회
          void (async () => {
            try {
              const { data } = await supabase
                .from("v_student_xp_status")
                .select("total_xp, level, daily_streak, total_missions, badge_count")
                .eq("student_id", user.id)
                .single();
              if (data) setXpStatus(data);
            } catch { /* 뷰 미존재 시 무시 */ }
          })();

          const [latestAttempt, completedRows, stats, xp, badgeRes, signals, weakAnalysis, profileResult, recommendationBundleResult] = await Promise.allSettled([
            fetchLatestInProgressAttempt(user.id),
            fetchRecentCompletedMissions(3),
            getStudentMissionStats("math"),
            getStudentXpSummary("math"),
            getStudentBadgeShowcase(user.id, "math"),
            fetchStudentMissionRecommendationSignals(),
            fetchWeakConceptAnalysis(missionRows, 3),
            supabase.from("profiles").select("school_level,grade").eq("id", user.id).single<MathStudentProfile>(),
            getStudentMissionRecommendations(user.id),
          ]);

          if (latestAttempt.status === "fulfilled" && latestAttempt.value) {
            const resumeCandidate = await fetchMissionById(latestAttempt.value.mission_id);
            nextResumeMission = resumeCandidate?.subject === "math" ? resumeCandidate : null;
          }

          if (completedRows.status === "fulfilled") nextRecentCompletedMissions = completedRows.value;
          if (signals.status === "fulfilled") nextRecommendationSignals = signals.value;
          if (weakAnalysis.status === "fulfilled") nextWeakConceptAnalysis = weakAnalysis.value;
          if (stats.status === "fulfilled") {
            nextTodayCompletedCount = stats.value.todayCompletedCount;
            nextWeeklyCompletedCount = stats.value.weeklyCompletedCount;
            nextStreakDays = calculateStreak(stats.value.completedDates);
          }
          if (xp.status === "fulfilled") nextXpSummary = xp.value;
          if (badgeRes.status === "fulfilled") nextBadgeShowcase = badgeRes.value;
          if (recommendationBundleResult.status === "fulfilled") {
            nextRecommendationBundle = recommendationBundleResult.value;
          } else {
            const reason = recommendationBundleResult.reason;
            if (reason?.message === "Failed to fetch") {
              console.error("[추천시스템] 네트워크 오류: Supabase 연결 실패. .env.local 확인 필요");
            } else {
              console.error("[추천시스템] 로드 실패:", toPrettyErrorString(reason), reason);
            }
          }
          if (profileResult.status === "fulfilled" && !profileResult.value.error) {
            nextStudentProfile = profileResult.value.data;
          }

          try {
            const [path, recommendation, theme] = await Promise.all([
              getWeeklyMathPath(user.id),
              getTodayMathRecommendation(user.id),
              getWeeklyPathWithTheme(user.id, "math", computeCurrentWeekKey()).catch(() => null),
            ]);
            nextWeeklyMathPath = path;
            nextTodayRecommendation = recommendation;
            nextWeeklyPathTheme = theme;
          } catch (weeklyPathLoadError) {
            console.error("Student math weekly path load failed:", toPrettyErrorString(weeklyPathLoadError), weeklyPathLoadError);
            nextWeeklyMathPathError = "추천 경로를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.";
          }
        }

        if (!mounted) return;
        setMissions(missionRows);
        setResumeMission(nextResumeMission);
        setProgressMap(missionProgress);
        setRecentCompletedMissions(nextRecentCompletedMissions);
        setRecommendationSignals(nextRecommendationSignals);
        setWeakConceptAnalysis(nextWeakConceptAnalysis);
        setTodayCompletedCount(nextTodayCompletedCount);
        setWeeklyCompletedCount(nextWeeklyCompletedCount);
        setStreakDays(nextStreakDays);
        setXpSummary(nextXpSummary);
        setBadgeShowcase(nextBadgeShowcase);
        setStudentProfile(nextStudentProfile);
        setRecommendationBundle(nextRecommendationBundle);
        setWeeklyMathPath(nextWeeklyMathPath);
        setTodayRecommendation(nextTodayRecommendation);
        setWeeklyMathPathError(nextWeeklyMathPathError);
        setWeeklyPathTheme(nextWeeklyPathTheme);
      } catch (e: unknown) {
        console.error("Student math load failed:", toPrettyErrorString(e), e);
        if (!mounted) return;
        setError(studentMathCopy.loadError);
        setMissions([]);
        setResumeMission(null);
        setProgressMap({});
        setRecentCompletedMissions([]);
        setRecommendationSignals({});
        setWeakConceptAnalysis([]);
        setTodayCompletedCount(0);
        setWeeklyCompletedCount(0);
        setStreakDays(0);
        setXpSummary(EMPTY_XP_SUMMARY);
        setBadgeShowcase(EMPTY_BADGE_SHOWCASE);
        setStudentProfile(null);
        setRecommendationBundle(null);
        setWeeklyMathPath(null);
        setTodayRecommendation(null);
        setWeeklyMathPathError(null);
        setWeeklyPathTheme(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSections = async () => {
      setSectionLoading(true);
      setSectionError(null);
      try {
        const [nextGradeUnits, nextFreshUnits] = await Promise.all([
          fetchMathHomeGradeUnits(selectedFilter.grade, selectedFilter.schoolLevel),
          fetchMathHomeFreshUnits(4),
        ]);

        if (!mounted) return;
        setGradeUnits(nextGradeUnits);
        setFreshUnits(nextFreshUnits);
      } catch (e: unknown) {
        console.error("Student math section load failed:", toPrettyErrorString(e), e);
        if (!mounted) return;
        setSectionError(studentMathCopy.loadError);
        setGradeUnits([]);
        setFreshUnits([]);
      } finally {
        if (mounted) setSectionLoading(false);
      }
    };

    void loadSections();
    return () => {
      mounted = false;
    };
  }, [selectedFilter]);

  useEffect(() => {
    let mounted = true;

    const loadCategoryMissions = async () => {
      try {
        const next = await fetchMissionsByCategory(selectedCategory, "math", 6);
        if (!mounted) return;
        setCareerMissions(next);
      } catch (e: unknown) {
        console.error("Career missions load failed:", toPrettyErrorString(e), e);
        if (!mounted) return;
        setCareerMissions([]);
      }
    };

    void loadCategoryMissions();
    return () => {
      mounted = false;
    };
  }, [selectedCategory]);

  const fallbackTodayMission = useMemo(() => pickTodayMission(missions), [missions]);
  const effectiveStudentGrade = useMemo(
    () => getEffectiveSchoolGrade(studentProfile?.school_level ?? null, studentProfile?.grade ?? null),
    [studentProfile?.grade, studentProfile?.school_level]
  );
  const currentGradeUnitIds = useMemo(() => new Set(gradeUnits.map((unit) => unit.id)), [gradeUnits]);
  const todayMission = todayRecommendation?.step.mission ?? fallbackTodayMission;
  const todayProgress = todayRecommendation?.step.progress ?? (todayMission ? progressMap[todayMission.id] : undefined);
  const todayStatusBadge = statusBadge(todayProgress);
  const resumeProgress = resumeMission ? progressMap[resumeMission.id] : undefined;
  const todayMinutes = todayRecommendation?.step.estimatedMinutes ?? displayEstimatedMinutes(todayMission?.estimated_minutes);
  const weeklySteps = weeklyMathPath?.steps ?? [];
  const weeklyPathSummary = weeklySteps.length > 0 ? weeklyPathDifficultySummary(weeklySteps) : null;
  const recommendedReasonStep = todayRecommendation?.step ?? weeklySteps[0] ?? null;
  const recommendedStep = todayRecommendation?.step ?? (weeklyMathPath && weeklyMathPath.recommendedIndex >= 0 ? weeklyMathPath.steps[weeklyMathPath.recommendedIndex] ?? null : null);
  const nextRouteHref = recommendedStep?.missionId ? buildRecommendationHref("math", recommendedStep.missionId) ?? "/student/math" : "/student/math";

  const getMissionCategory = useMemo(
    () => (mission: GeneratedMission): RecommendationCategory => recommendationCategory(recommendationSignals[mission.id]),
    [recommendationSignals]
  );

  const replayRecommendationPool = useMemo(() => {
    return missions
      .filter((mission) => {
        const category = getMissionCategory(mission);
        return category !== "not_started";
      })
      .map((mission) => {
        const category = getMissionCategory(mission);
        return {
          mission,
          category,
          reason: recommendationReason(category),
        } satisfies RecommendationItem;
      })
      .sort(compareRecommendationItems);
  }, [getMissionCategory, missions]);

  const nextRecommendationConcept =
    topWeakConceptFromList(weakConceptAnalysis)?.concept ??
    resumeMission?.mission_json.mainConcept ??
    todayMission?.mission_json.mainConcept ??
    null;

  const topWeakConcept = weakConceptAnalysis[0] ?? null;

  const mapRecommendationGroup = useMemo(() => {
    return (group: ConceptMissionRecommendation, kind: RecommendationReasonKind): RecommendationItem[] => {
      const missionById = new Map(missions.map((mission) => [mission.id, mission]));
      return group.missionIds
        .map((missionId) => missionById.get(missionId) ?? null)
        .filter((mission): mission is GeneratedMission => mission !== null)
        .map((mission) => {
          const category = getMissionCategory(mission);
          return {
            mission,
            category,
            reason: recommendationReason(category, kind),
          } satisfies RecommendationItem;
        });
    };
  }, [getMissionCategory, missions]);

  const weakConceptMissions = useMemo(() => {
    if (!topWeakConcept) return [];
    return mapRecommendationGroup(
      { concept: topWeakConcept.concept, missionIds: topWeakConcept.recommendedMissionIds },
      "same_concept"
    );
  }, [mapRecommendationGroup, topWeakConcept]);

  const prerequisiteConceptGroups = useMemo(() => {
    if (!topWeakConcept) return [];
    const usedMissionIds = new Set(weakConceptMissions.map(({ mission }) => mission.id));
    return topWeakConcept.prerequisiteRecommendations
      .map((group) => ({
        concept: group.concept,
        items: mapRecommendationGroup(
          {
            concept: group.concept,
            missionIds: group.missionIds.filter((missionId) => !usedMissionIds.has(missionId)),
          },
          "prerequisite"
        ),
      }))
      .filter((group) => group.items.length > 0)
      .slice(0, 2);
  }, [mapRecommendationGroup, topWeakConcept, weakConceptMissions]);

  const nextRecommendations = useMemo(() => {
    const excludedMissionIds = new Set<string>();
    if (resumeMission) excludedMissionIds.add(resumeMission.id);
    weakConceptMissions.forEach(({ mission }) => excludedMissionIds.add(mission.id));
    prerequisiteConceptGroups.forEach((group) => group.items.forEach(({ mission }) => excludedMissionIds.add(mission.id)));

    const sameConceptPool = nextRecommendationConcept
      ? missions.filter(
          (mission) =>
            mission.mission_json.mainConcept === nextRecommendationConcept && !excludedMissionIds.has(mission.id)
        )
      : [];

    const rankedSameConcept = sameConceptPool
      .map((mission) => {
        const category = getMissionCategory(mission);
        return {
          mission,
          category,
          reason: recommendationReason(category, "same_concept"),
        } satisfies RecommendationItem;
      })
      .sort(compareRecommendationItems);

    if (rankedSameConcept.length > 0) {
      return rankedSameConcept.slice(0, 3);
    }

    const nextConceptIds = nextRecommendationConcept ? getConceptNode(nextRecommendationConcept)?.next ?? [] : [];
    const nextConceptPool = nextConceptIds.length
      ? missions.filter(
          (mission) =>
            typeof mission.mission_json.mainConcept === "string" &&
            nextConceptIds.includes(mission.mission_json.mainConcept) &&
            !excludedMissionIds.has(mission.id)
        )
      : [];

    const rankedNextConcept = nextConceptPool
      .map((mission) => {
        const category = getMissionCategory(mission);
        return {
          mission,
          category,
          reason: recommendationReason(category, "next_concept"),
        } satisfies RecommendationItem;
      })
      .sort(compareRecommendationItems);

    if (rankedNextConcept.length > 0) {
      return rankedNextConcept.slice(0, 3);
    }

    return missions
      .filter((mission) => getMissionCategory(mission) === "not_started")
      .filter((mission) => !excludedMissionIds.has(mission.id))
      .filter((mission) => (currentGradeUnitIds.size === 0 ? true : currentGradeUnitIds.has(mission.unit_id)))
      .sort((a, b) => {
        const createdAtDelta = missionCreatedAtRank(b) - missionCreatedAtRank(a);
        if (createdAtDelta !== 0) return createdAtDelta;
        const difficultyDelta = difficultyRankOf(a) - difficultyRankOf(b);
        if (difficultyDelta !== 0) return difficultyDelta;
        return a.title.localeCompare(b.title, "ko");
      })
      .slice(0, 3)
      .map((mission) => ({
        mission,
        category: "not_started" as const,
        reason: recommendationReason("not_started", "next_concept"),
      }));
  }, [
    currentGradeUnitIds,
    missions,
    nextRecommendationConcept,
    prerequisiteConceptGroups,
    resumeMission,
    weakConceptMissions,
    getMissionCategory,
  ]);


  const replayRecommendations = useMemo(() => {
    const excludedMissionIds = new Set<string>();
    weakConceptMissions.forEach(({ mission }) => excludedMissionIds.add(mission.id));
    prerequisiteConceptGroups.forEach((group) => group.items.forEach(({ mission }) => excludedMissionIds.add(mission.id)));
    nextRecommendations.forEach(({ mission }) => excludedMissionIds.add(mission.id));

    return replayRecommendationPool.filter(({ mission }) => !excludedMissionIds.has(mission.id)).slice(0, 3);
  }, [nextRecommendations, prerequisiteConceptGroups, replayRecommendationPool, weakConceptMissions]);
  const strongestRecommendationLabel =
    recommendationBundle?.masteryRecommendations.strong[0]?.conceptLabel ??
    (nextRecommendationConcept ? conceptLabel(nextRecommendationConcept) : "다음 추천 개념");
  const weakConceptLabel = topWeakConcept ? conceptLabel(topWeakConcept.concept) : "복습이 필요한 개념";

  useEffect(() => {
    if (!effectiveStudentGrade) return;

    const nextFilter =
      GRADE_FILTERS.find(
        (f) => f.grade === effectiveStudentGrade.grade && f.schoolLevel === effectiveStudentGrade.schoolLevel
      ) ??
      GRADE_FILTERS.find((f) => f.schoolLevel === effectiveStudentGrade.schoolLevel) ??
      GRADE_FILTERS[6]!; // 중3 fallback

    setSelectedFilter(nextFilter);
  }, [effectiveStudentGrade]);

  return (

    <PageShell
      title={studentMathCopy.title}
      subtitle={studentMathCopy.subtitle}
      maxWidthClassName="max-w-6xl"
    >
      {loading && (<div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">수학 홈을 불러오는 중...</div>)}
      {error && (<div className="rounded-2xl border border-[#6A2B2B] bg-[#2A1414] px-4 py-3 text-sm text-[#FFB4B4]">{error}</div>)}
      <SectionCard
        header="오늘의 추천"
        description="학생이 지금 바로 해야 할 문제를 가장 먼저 보여줘요."
        rightSlot={
          recommendedStep?.missionId ? (
            <Link
              href={nextRouteHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)]"
            >
              {weeklyMathPath?.completionMessage ? "다음 루트 시작하기" : "바로 시작"}
            </Link>
          ) : null
        }
      >
        {weeklyMathPathError ? (
          <div className="rounded-3xl border border-[#6A2B2B] bg-[#2A1414] p-5 text-sm text-[#FFB4B4]">{weeklyMathPathError}</div>
        ) : recommendedStep?.missionId ? (
          <div className="rounded-[30px] border border-[rgba(255,214,117,0.24)] bg-[var(--card)] p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">{`${recommendedStep.weekdayLabel}요일 추천`}</Badge>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${difficultyBadgeTone(recommendedStep.difficulty)}`}>
                    {difficultyLabel(recommendedStep.difficulty)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[rgba(255,214,117,0.28)] bg-[rgba(255,214,117,0.12)] px-3 py-1 text-[11px] font-medium text-[#72243E]">
                    +{recommendedStep.rewardXp} XP
                  </span>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">오늘 할 문제</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl">{recommendedStep.cleanedTitle}</h2>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{recommendedStep.weekdayLabel}요일</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{recommendedStep.unitName}</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{`STEP ${recommendedStep.stepOrder}`}</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">예상 {recommendedStep.estimatedMinutes}분</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{recommendedStep.status}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{recommendedStep.recommendationReason}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href={nextRouteHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95"
                  >
                    {weeklyMathPath?.completionMessage ? "다음 루트 시작하기" : "바로 시작"}
                  </Link>
                  <p className="text-xs text-[var(--text-muted)]">
                    {todayRecommendation?.selectionReason === "today"
                      ? "오늘 요일에 맞춘 추천이에요."
                      : todayRecommendation?.selectionReason === "completed_week"
                        ? weeklyMathPath?.rotatedFromPathKey
                          ? "이번 주 루트를 모두 완료해서 다음 루트로 자동 전환했어요."
                          : "이번 주 추천을 모두 완료했어요."
                        : todayRecommendation?.selectionReason === "previous_incomplete"
                          ? "오늘 단계로 가기 전에 먼저 끝내야 할 문제를 보여줘요."
                          : "오늘 단계가 없거나 이미 끝나서 이번 주 첫 미완료 문제를 보여줘요."}
                  </p>
                </div>
              </div>
              <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[var(--card-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">추천 포인트</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-[11px] text-[var(--text-muted)]">단원</p>
                    <p className="mt-1 font-semibold text-[var(--text)]">{recommendedStep.unitName}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-[11px] text-[var(--text-muted)]">난이도 흐름</p>
                    <p className="mt-1 text-[var(--text)]">{weeklyPathSummary ?? "easy -> normal -> hard"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-[11px] text-[var(--text-muted)]">진행 상태</p>
                    <p className="mt-1 text-[var(--text)]">{weeklyMathPath ? `${weeklyMathPath.completedCount}/${weeklyMathPath.steps.length} 완료` : "추천 경로 확인 중"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card-soft)] p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--accent)]/8 blur-3xl" />
            <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-4xl shadow-sm">
                📐
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-[var(--text)]">아직 추천 경로가 없어요</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                  수학 미션을 처음 시작하는 중이에요. 아래 단원을 탐색해서 바로 시작하거나, 첫 미션을 골라보세요!
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href="#units"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
                  >
                    <span>단원 탐색하기</span>
                    <span className="opacity-70">→</span>
                  </a>
                  <a
                    href="#recommended"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                  >
                    추천 미션 보기
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        header="이번 주 학습 루트"
        description="월요일부터 금요일까지, 쉬움에서 도전까지 이어지는 주간 흐름이에요."
      >
        {weeklyMathPathError ? (
          <div className="rounded-3xl border border-[#6A2B2B] bg-[#2A1414] p-5 text-sm text-[#FFB4B4]">{weeklyMathPathError}</div>
        ) : weeklySteps.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card-soft)] p-6">
            <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-[var(--accent)]/6 blur-3xl" />
            <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-3xl shadow-sm">
                🗓️
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--text)]">이번 주 학습 루트를 준비하고 있어요</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">첫 미션을 완료하면 맞춤 주간 루트가 자동으로 생성돼요.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <WeeklyPathHeader theme={weeklyPathTheme} loading={loading} />
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">난이도 흐름: {weeklyPathSummary ?? "easy -> normal -> hard"}</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{weeklyMathPath?.completedCount ?? 0}개 완료</span>
              {weeklyMathPath?.recommendedIndex !== undefined && weeklyMathPath.recommendedIndex >= 0 && weeklySteps[weeklyMathPath.recommendedIndex] && (
                <span className="rounded-full border border-[#3B6D11] bg-[#EAF3DE] px-3 py-1 text-[#27500A] dark:border-[rgba(255,214,117,0.4)] dark:bg-[rgba(255,214,117,0.12)] dark:text-[#FFE7A6]">
                  오늘 강조: {weeklySteps[weeklyMathPath.recommendedIndex]?.weekdayLabel}요일
                </span>
              )}
            </div>
            {weeklyMathPath?.completionMessage && recommendedStep?.missionId && (
              <div className="flex flex-col gap-3 rounded-2xl border border-[#7ED6A5]/30 bg-[#7ED6A5]/10 px-4 py-4 text-sm text-[#D8FBE6] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">이번 주 완료</p>
                  <p className="mt-1 text-xs text-[#D8FBE6]/80">{weeklyMathPath.completionMessage}</p>
                </div>
                <Link
                  href={nextRouteHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95"
                >
                  다음 루트 시작하기
                </Link>
              </div>
            )}
            {weeklyPathNotice && (
              <div className="rounded-2xl border border-[rgba(255,214,117,0.28)] bg-[rgba(255,214,117,0.10)] px-4 py-3 text-sm text-[#72243E]">
                {weeklyPathNotice}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {weeklySteps.map((step) => (
                <WeeklyPathMissionCard
                  key={`${step.stepOrder}:${step.missionId}`}
                  step={step}
                  href={buildRecommendationHref("math", step.missionId)}
                  difficultyLabel={difficultyLabel(step.difficulty)}
                  minuteLabel="분"
                  onLockedAttempt={(message) => setWeeklyPathNotice(message)}
                />
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        header="추천 이유"
        description="왜 이 문제를 지금 추천하는지, 생활과 시험, 사고력 연결까지 함께 보여줘요."
      >
        {!recommendedReasonStep ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5 text-sm text-[var(--text-muted)]">
            추천 이유는 경로가 준비되면 함께 보여드릴게요.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">단원명</p>
              <p className="mt-3 text-lg font-semibold text-[var(--text)]">{recommendedReasonStep.unitName}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{recommendedReasonStep.recommendationReason}</p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">일상 연결</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text)]">{recommendedReasonStep.dailyConnection}</p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">시험 연결</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text)]">{recommendedReasonStep.examConnection}</p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">사고력 연결</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text)]">{recommendedReasonStep.thinkingConnection}</p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--text)]">수학 학습 대시보드</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">오늘의 미션, 성장 흐름, 다음 학습 포인트를 한눈에 볼 수 있어요.</p>
            </div>
            <StatusChip
              variant={todayStatusBadge.variant === "success" ? "success" : todayStatusBadge.variant === "info" ? "info" : "muted"}
              className={todayStatusBadge.variant === "success" ? "shadow-[0_0_0_1px_rgba(122,210,164,0.25)]" : ""}
            >
              {todayStatusBadge.label}
            </StatusChip>
          </div>
          <div className="mt-4">
            {xpStatus ? (() => {
              const lv   = getLevelDisplay(xpStatus.level);
              const prog = calcProgress(xpStatus.total_xp, xpStatus.level);
              return (
                <XpLevelBar
                  level={xpStatus.level}
                  levelName={lv.name}
                  levelEmoji={lv.emoji}
                  levelColor={lv.color}
                  totalXp={xpStatus.total_xp}
                  nextLevelXp={prog.nextXp}
                  nextLevelName={getLevelDisplay(xpStatus.level + 1).name}
                  progressPct={prog.pct}
                  dailyStreak={xpStatus.daily_streak}
                  totalMissions={xpStatus.total_missions}
                  badgeCount={xpStatus.badge_count}
                />
              );
            })() : (
              <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">오늘 완료 미션</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{todayCompletedCount}개</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--text-muted)]">오늘 목표</p>
                <Badge variant={todayCompletedCount >= TODAY_GOAL ? "success" : "info"}>
                  {todayCompletedCount >= TODAY_GOAL ? "달성" : `${todayCompletedCount}/${TODAY_GOAL}`}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--text)]">{goalLabel(todayCompletedCount, TODAY_GOAL, "오늘 목표 달성")}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--text-muted)]">이번 주 목표</p>
                <Badge variant={weeklyCompletedCount >= WEEKLY_GOAL ? "success" : "neutral"}>
                  {Math.min(weeklyCompletedCount, WEEKLY_GOAL)}/{WEEKLY_GOAL}
                </Badge>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--card-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                  style={{ width: `${Math.min(100, (weeklyCompletedCount / WEEKLY_GOAL) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--text)]">{goalLabel(weeklyCompletedCount, WEEKLY_GOAL, "이번 주 목표 달성")}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">복습이 필요한 개념</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{weakConceptLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">정확도를 끌어올리기 좋은 복습 흐름이에요.</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">다음 추천 개념</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{strongestRecommendationLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">지금 흐름을 살려 다음 단계로 이어 가 보세요.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip variant="info">오늘 {todayCompletedCount}개 완료</StatusChip>
            <StatusChip variant="muted">이번 주 {weeklyCompletedCount}/{WEEKLY_GOAL}</StatusChip>
            <StudentChip variant="today">{streakLabel(streakDays)}</StudentChip>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">하루 {todayMinutes}분 정도로 핵심 개념을 차분히 점검해 보세요.</p>
          <p className="mt-2 text-sm text-[var(--text)]">오늘의 학습 포인트: {missionWhyLine(todayMission)}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{statusText(todayProgress)}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">최근 학습 {recentCompletedMissions.length}개</p>
          <div className="mt-4">
            <Link
              href={todayMission ? `/student/math/mission/${todayMission.id}` : "/student/math"}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] md:w-auto"
            >
              {todayMission ? `${cleanDisplayText(decodeUnicode(todayMission.title))} 시작하기` : "미션 시작하기"}
            </Link>
          </div>
        </div>
      </SectionCard>
      <SectionCard header="수학 배지" description="획득한 배지와 다음 목표를 한눈에 확인해 보세요.">
        <BadgeShowcasePanel
          showcase={badgeShowcase}
          emptyTitle="아직 획득한 수학 배지가 없어요."
          emptyBody="수학 미션을 완료하면 첫 배지부터 자연스럽게 열려요. 단원 탐험과 연속 정답으로 진행도를 쌓아 보세요."
          sectionTone="amber"
        />
      </SectionCard>

      <SectionCard header={studentMathCopy.gradeSectionTitle} description={studentMathCopy.gradeSectionDescription}>
        {effectiveStudentGrade && (
          <p className="mb-3 text-xs text-[var(--text-muted)]">{`\uD604\uC7AC \uD45C\uC2DC \uD559\uB144: ${effectiveStudentGrade.label}`}</p>
        )}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {GRADE_FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm ${
                selectedFilter.label === filter.label
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]"
              }`}
              onClick={() => setSelectedFilter(filter)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {sectionLoading ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{"\uBD88\uB7EC\uC624\uB294 \uC911..."}</div>
          ) : sectionError ? (
            <div className="rounded-2xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{sectionError}</div>
          ) : gradeUnits.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{studentMathCopy.noUnits}</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {gradeUnits.map((unit) => (
                <Link
                  key={unit.id}
                  href={`/student/math/${unit.id}`}
                  className="group block rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.22)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">{unitMeta(unit)}</p>
                      <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[var(--text)]">{cleanDisplayText(decodeUnicode(unit.unit_name))}</h3>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                      {unitMissionCountLine(unit)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-[var(--text-muted)]">
                    {cleanDisplayText(decodeUnicode(unit.description)) || "\uAC1C\uB150 \uAE30\uBC18 \uD0D0\uAD6C \uBBF8\uC158"}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-[var(--text)]">{"\uC774 \uB2E8\uC6D0\uC5D0\uC11C \uBC30\uC6B0\uB294 \uAC83: "}{unitLearningLine(unit)}</p>
                  <span className="mt-4 inline-flex items-center text-sm font-semibold text-[var(--accent)]">{studentMathCopy.unitExploreLabel}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
      
      <SectionCard header={studentMathCopy.freshSectionTitle} description={studentMathCopy.freshSectionDescription}>
        {sectionLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{"\uBD88\uB7EC\uC624\uB294 \uC911..."}</div>
        ) : sectionError ? (
          <div className="rounded-2xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{sectionError}</div>
        ) : freshUnits.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{studentMathCopy.noFreshUnits}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {freshUnits.map((unit) => (
              <Link
                key={unit.id}
                href={`/student/math/${unit.id}`}
                className="group block rounded-3xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(117,191,255,0.08),rgba(255,255,255,0.02))] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="info">{studentMathCopy.newBadge}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">{unitMeta(unit)}</span>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                    {unitMissionCountLine(unit)}
                  </span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-[var(--text)]">{cleanDisplayText(decodeUnicode(unit.unit_name))}</h3>
                <p className="mt-3 line-clamp-2 text-sm text-[var(--text-muted)]">{cleanDisplayText(decodeUnicode(unit.description)) || "\uCD5C\uADFC \uBBF8\uC158\uC774 \uCD94\uAC00\uB41C \uB2E8\uC6D0\uC744 \uBA3C\uC800 \uC0B4\uD3B4\uBCF4\uC138\uC694."}</p>
                <p className="mt-3 text-xs leading-5 text-[var(--text)]">{"\uC774 \uB2E8\uC6D0\uC5D0\uC11C \uBC30\uC6B0\uB294 \uAC83: "}{unitLearningLine(unit)}</p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
      
      <SectionCard header={studentMathCopy.careerSectionTitle} description={studentMathCopy.careerSectionDescription}>
        <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {CATEGORY_OPTIONS.map((opt) => {
            const selected = selectedCategory === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedCategory(opt.value)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--accent)]/60 hover:text-[var(--text)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {sectionLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{"\uBD88\uB7EC\uC624\uB294 \uC911..."}</div>
        ) : sectionError ? (
          <div className="rounded-2xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{sectionError}</div>
        ) : careerMissions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            {selectedCategory !== null ? CAREER_SECTION_COPY.filteredEmpty : CAREER_SECTION_COPY.empty}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {careerMissions.map((mission) => (
              <div
                key={mission.id}
                className="flex h-full min-h-[220px] flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.22)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{CAREER_SECTION_COPY.badge}</Badge>
                    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                      {careerMissionFilterLabel(mission)}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">{`${CAREER_SECTION_COPY.difficultyLabel} ${difficultyLabel(mission.difficulty)}`}</span>
                    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">{`${CAREER_SECTION_COPY.estimatedLabel} ${displayEstimatedMinutes(mission.estimated_minutes)}${CAREER_SECTION_COPY.minutesLabel}`}</span>
                  </div>
                </div>
                <h3 className="mt-4 line-clamp-2 text-base font-semibold leading-6 text-[var(--text)]">{cleanDisplayText(decodeUnicode(mission.title))}</h3>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{shortLine(mission.mission_json.scenario, careerMissionLine(mission))}</p>
                <div className="mt-auto pt-5">
                  <Link
                    href={`/student/math/mission/${mission.id}`}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95"
                  >
                    {CAREER_SECTION_COPY.startButtonLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard header={studentMathCopy.resumeTitle} description={studentMathCopy.resumeDescription}>
        {!resumeMission ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{"\uC774\uC5B4\uC11C \uD560 \uBBF8\uC158\uC774 \uC5C6\uC5B4\uC694."}</div>
        ) : (
          <Link href={`/student/math/mission/${resumeMission.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">{cleanDisplayText(decodeUnicode(resumeMission.title))}</h3>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${recommendationStatusClass(resumeStatusText(resumeProgress) === "\uC644\uB8CC" ? "\uBCF5\uC2B5 \uCD94\uCC9C" : "\uC774\uC5B4\uC11C \uD558\uAE30")}`}>
                {resumeStatusText(resumeProgress) === "\uC644\uB8CC" ? "\uBCF5\uC2B5 \uCD94\uCC9C" : "\uC774\uC5B4\uC11C \uD558\uAE30"}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--text-muted)]">{recommendationMetaLine(resumeMission)}</p>
              <p className="text-xs text-[var(--text-muted)]">{resumeStatusText(resumeProgress)}</p>
            </div>
          </Link>
        )}
      </SectionCard>
      <SectionCard
        header={RECOMMENDATION_SECTION_COPY.weakTitle}
        description={RECOMMENDATION_SECTION_COPY.weakDescription}
      >
        {!(recommendationBundle?.masteryRecommendations.weak.length) ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            {RECOMMENDATION_SECTION_COPY.weakEmpty}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recommendationBundle.masteryRecommendations.weak.map((item) => {
              const statusLabel = recommendationStatusLabel("weak", item, progressMap[item.mission.id]);
              return (
                <Link key={item.mission.id} href={`/student/math/mission/${item.mission.id}`} className="group block">
                  <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning">{RECOMMENDATION_SECTION_COPY.weakTitle}</Badge>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${recommendationStatusClass(statusLabel)}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-3 max-w-full text-[12px] font-medium text-[#E7C873]/80" style={recommendationReasonClampStyle}>
                        {recommendationConceptLabel(item.conceptLabel)}
                      </p>
                      <h3 className="mt-3 text-sm font-semibold text-[var(--text)]">
                        {cleanDisplayText(decodeUnicode(item.mission.title))}
                      </h3>
                      <p className="mt-3 text-sm leading-5 text-[var(--text-muted)]" style={recommendationReasonClampStyle}>
                        {item.reason}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[var(--text-muted)]">{recommendationMetaLine(item.mission)}</p>
                      <span className="inline-flex w-full items-center justify-center rounded-full bg-[var(--warning-border)] px-4 py-2.5 text-sm font-semibold text-white transition group-hover:brightness-105 sm:w-auto">
                        {recommendationCtaLabel("weak", item)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        header={RECOMMENDATION_SECTION_COPY.normalTitle}
        description={RECOMMENDATION_SECTION_COPY.normalDescription}
      >
        {!(recommendationBundle?.masteryRecommendations.normal.length) ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            {RECOMMENDATION_SECTION_COPY.normalEmpty}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recommendationBundle.masteryRecommendations.normal.map((item) => {
              const statusLabel = recommendationStatusLabel("normal", item, progressMap[item.mission.id]);
              return (
                <Link key={item.mission.id} href={`/student/math/mission/${item.mission.id}`} className="group block">
                  <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.22)]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{RECOMMENDATION_SECTION_COPY.normalTitle}</Badge>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${recommendationStatusClass(statusLabel)}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-3 max-w-full text-[12px] font-medium text-[var(--text-muted)]/85" style={recommendationReasonClampStyle}>
                        {"\uAC1C\uB150 \u00B7 "}{recommendationConceptLabel(item.conceptLabel)}
                      </p>
                      <h3 className="mt-3 text-sm font-semibold text-[var(--text)]">
                        {cleanDisplayText(decodeUnicode(item.mission.title))}
                      </h3>
                      <p className="mt-3 text-sm leading-5 text-[var(--text-muted)]" style={recommendationReasonClampStyle}>
                        {item.reason}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[var(--text-muted)]">{recommendationMetaLine(item.mission)}</p>
                      <span className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition group-hover:brightness-105 sm:w-auto">
                        {recommendationCtaLabel("normal", item)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        header={RECOMMENDATION_SECTION_COPY.strongTitle}
        description={RECOMMENDATION_SECTION_COPY.strongDescription}
      >
        {!(recommendationBundle?.masteryRecommendations.strong.length) ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            {RECOMMENDATION_SECTION_COPY.strongEmpty}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recommendationBundle.masteryRecommendations.strong.map((item) => {
              const statusLabel = recommendationStatusLabel("strong", item, progressMap[item.mission.id]);
              return (
                <Link key={item.mission.id} href={`/student/math/mission/${item.mission.id}`} className="group block">
                  <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[rgba(255,214,117,0.24)] bg-[linear-gradient(180deg,rgba(255,214,117,0.08),rgba(255,255,255,0.02))] p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">{RECOMMENDATION_SECTION_COPY.strongTitle}</Badge>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${recommendationStatusClass(statusLabel)}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-3 max-w-full text-[12px] font-medium text-[#633806]/85" style={recommendationReasonClampStyle}>
                        {"\uAC1C\uB150 \u00B7 "}{recommendationConceptLabel(item.conceptLabel)}
                      </p>
                      <h3 className="mt-3 text-sm font-semibold text-[var(--text)]">
                        {cleanDisplayText(decodeUnicode(item.mission.title))}
                      </h3>
                      <p className="mt-3 text-sm leading-5 text-[var(--text-muted)]" style={recommendationReasonClampStyle}>
                        {item.reason}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[var(--text-muted)]">{recommendationMetaLine(item.mission)}</p>
                      <span className="inline-flex w-full items-center justify-center rounded-full bg-[#FFD675] px-4 py-2.5 text-sm font-semibold text-[#2A1E06] transition group-hover:brightness-105 sm:w-auto">
                        {recommendationCtaLabel("strong", item)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
      <SectionCard className="hidden" header={studentMathCopy.weakTitle} description={studentMathCopy.weakDescription}>
        {!topWeakConcept ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{"\uC544\uC9C1 \uBD84\uC11D\uD560 \uD480\uC774 \uAE30\uB85D\uC774 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."}</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{"\uC870\uAE08 \uB354 \uC5F0\uC2B5\uD558\uBA74 \uC88B\uC740 \uAC1C\uB150"}</Badge>
                <p className="text-sm text-[var(--text)]">{conceptLabel(topWeakConcept.concept)}: {conceptDescription(topWeakConcept.concept, "\uCD5C\uADFC \uD480\uC774 \uAE30\uB85D\uC744 \uBC14\uD0D5\uC73C\uB85C \uBCF5\uC2B5\uD558\uBA74 \uC88B\uC740 \uAC1C\uB150\uC744 \uACE8\uB790\uC5B4\uC694")}</p>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{"\uCD94\uCC9C \uC774\uC720: \uAC19\uC740 \uAC1C\uB150\uC744 \uB2E4\uB978 \uC0C1\uD669\uC5D0\uC11C \uB2E4\uC2DC \uC5F0\uC2B5\uD560 \uC218 \uC788\uC5B4\uC694"}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{"\uD78C\uD2B8\uB97C \uC0AC\uC6A9\uD588\uAC70\uB098 \uD5F7\uAC08\uB9B0 \uB2E8\uACC4\uAC00 \uC788\uC5B4 \uB2E4\uC2DC \uD480\uC5B4\uBCF4\uBA74 \uC88B\uC544\uC694"}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {weakConceptMissions.map(({ mission, category, reason }) => {
                const badge = recommendationBadge(category);
                return (
                  <Link key={mission.id} href={`/student/math/mission/${mission.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text)]">{cleanDisplayText(decodeUnicode(mission.title))}</h3>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{reason}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
      
      <SectionCard className="hidden" header={studentMathCopy.replayTitle} description={studentMathCopy.replayDescription}>
        {replayRecommendations.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{"\uB2E4\uC2DC \uCD94\uCC9C\uD560 \uBBF8\uC158\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {replayRecommendations.map(({ mission, category, reason }) => {
              const badge = recommendationBadge(category);
              return (
                <Link key={mission.id} href={`/student/math/mission/${mission.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{cleanDisplayText(decodeUnicode(mission.title))}</h3>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{reason}</p>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
      
      <SectionCard className="hidden" header={studentMathCopy.nextTitle} description={studentMathCopy.nextDescription}>
        {nextRecommendations.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{"\uC9C0\uAE08\uC740 \uC0C8\uB85C \uCD94\uCC9C\uD560 \uBBF8\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nextRecommendations.map(({ mission, category, reason }) => {
              const badge = recommendationBadge(category);
              return (
                <Link key={mission.id} href={`/student/math/mission/${mission.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{cleanDisplayText(decodeUnicode(mission.title))}</h3>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{reason}</p>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

function topWeakConceptFromList(items: WeakConceptAnalysis[]): WeakConceptAnalysis | null {
  return items[0] ?? null;
}
















