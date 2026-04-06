"use client";

import Link from "next/link";
import BadgeShowcasePanel from "@/components/badges/BadgeShowcasePanel";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import WeeklyPathMissionCard from "@/components/student/WeeklyPathMissionCard";
import { formatCurriculumGradeLabel, getEffectiveSchoolGrade, toCurriculumGradeNumber } from "@/lib/academicYear";
import {
  calculateEnglishGrowthSummaryFromMissions,
  classifyEnglishMissionCategory,
  getEnglishGrowthSummary,
  type EnglishGrowthCategory,
  type EnglishGrowthSummary,
} from "@/lib/englishGrowth";
import { getStudentEnglishBadgeShowcase } from "@/lib/englishBadges";
import {
  getStudentEnglishRecommendations,
  type EnglishRecommendationBundle,
  type EnglishMissionRecommendation,
} from "@/lib/englishRecommendations";
import {
  calculateStreak,
  fetchCurriculumUnitsBySubject,
  fetchMissionProgressMap,
  fetchPublishedMissions,
  getStudentMissionStats,
  getStudentXpSummary,
  type MissionProgressSummary,
} from "@/lib/missions";
import {
  getTodayRecommendation,
  getWeeklyPath,
  weeklyPathDifficultySummary,
  type TodayEnglishRecommendation,
  type WeeklyEnglishPathResult,
} from "@/lib/learningPathRecommendations";
import { buildRecommendationHref } from "@/lib/recommendationNavigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeDisplayText } from "@/lib/uiText";
import type { BadgeShowcase } from "@/types/badges";
import type { ProfileSchoolLevel } from "@/lib/studentProfile";
import type { CurriculumUnit, GeneratedMission, StudentXpSummary } from "@/types/missions";

const GRADE_FILTERS = [4, 5, 6, 7, 8, 9];
const TODAY_GOAL = 1;
const WEEKLY_GOAL = 5;
const EMPTY_XP_SUMMARY: StudentXpSummary = {
  totalXp: 0,
  level: 1,
  currentLevelXpFloor: 0,
  nextLevelXpTarget: 30,
  xpToNextLevel: 30,
};
const EMPTY_GROWTH_SUMMARY: EnglishGrowthSummary = calculateEnglishGrowthSummaryFromMissions([]);

const ENGLISH_COPY = {
  pageTitle: "\uc601\uc5b4 \ud559\uc2b5 \uc2dc\uc791",
  pageSubtitle: "\ub300\ud654, \uc548\ub0b4\ubb38, \uc758\uacac \ud45c\ud604 \uc8fc\uc81c\ub85c \uc601\uc5b4\ub97c \uc774\ud574\ud558\uace0 \ud45c\ud604\ud574 \ubcf4\uc138\uc694.",
  dailyRoutineTitle: "\uc624\ub298\uc758 \uc601\uc5b4 \ub8e8\ud2f4",
  dailyRoutineDescription: "\uc624\ub298 \ub531 5\ubd84\ub9cc \ud574\ubcf4\uc138\uc694. \uc131\uc7a5 \ub370\uc774\ud130\ub97c \ubc14\ud0d5\uc73c\ub85c \uc9c0\uae08 \uac00\uc7a5 \uc911\uc694\ud55c \ud750\ub984\uc744 \uace8\ub790\uc5b4\uc694.",
  dailyRoutineBadge: "\ud558\ub8e8 1\ud68c \ub8e8\ud2f4",
  dailyRoutineMinuteSuffix: "\ubd84 \uc644\uc131",
  dailyRoutineStart: "\uc2dc\uc791\ud558\uae30",
  dailyRoutineFallback: "\uc624\ub298 \ub8e8\ud2f4\uc744 \uc900\ube44 \uc911\uc774\uc5d0\uc694.",
  dailyRoutineProgress: "\ub8e8\ud2f4 \uc9c4\ud589",
  dailyRoutineAlmostDone: "\uac70\uc758 \ub2e4 \uc654\uc5b4\uc694.",
  dailyRoutineDone: "\uc624\ub298\uc758 \uc601\uc5b4 \ub8e8\ud2f4\uc744 \uc644\ub8cc\ud588\uc5b4\uc694.",
  dailyRoutineCompleted: "\uc644\ub8cc",
  heroEyebrow: "\uc624\ub298\uc758 \uc601\uc5b4",
  heroEmptyTitle: "\uc624\ub298 \uc2dc\uc791\ud560 \uc601\uc5b4 \ubbf8\uc158\uc744 \uc900\ube44\ud558\uace0 \uc788\uc5b4\uc694.",
  heroFallbackDescription: "\uc77d\uace0, \ub9d0\ud558\uace0, \ud45c\ud604\ud558\ub294 \ud750\ub984\uc73c\ub85c \uc624\ub298\uc758 \uc601\uc5b4\ub97c \uac00\ubccd\uac8c \uc2dc\uc791\ud574 \ubcf4\uc138\uc694.",
  scenarioFallback: "\uc77c\uc0c1 \uc18d \uc0c1\ud669\uc744 \uc601\uc5b4\ub85c \uc774\ud574\ud558\uace0 \ud45c\ud604\ud558\ub294 \uc5f0\uc2b5\uc774\uc5d0\uc694.",
  startButton: "\uc601\uc5b4 \ud559\uc2b5 \uc2dc\uc791",
  gradeSectionTitle: "\ud559\ub144\ubcc4 \uc601\uc5b4 \ub2e8\uc6d0",
  gradeSectionDescription: "\uc9c0\uae08 \ud559\ub144\uc5d0 \ub9de\ub294 \ub2e8\uc6d0\uc744 \uace0\ub974\uace0 \uc601\uc5b4 \ud45c\ud604\uacfc \uc77d\uae30 \uacfc\uc5c5\uc744 \uc774\uc5b4\uc11c \ud559\uc2b5\ud574 \ubcf4\uc138\uc694.",
  gradeUnitLabelSuffix: "\uc601\uc5b4",
  gradeSectionEmptySuffix: "\ud559\ub144\uc5d0\ub294 \uacf5\uac1c\ub41c \uc601\uc5b4 \ub2e8\uc6d0\uc774 \uc544\uc9c1 \uc5c6\uc5b4\uc694.",
  unitCardFallback: "\uc0c1\ud669\uc744 \uc774\ud574\ud558\uace0 \uc601\uc5b4\ub85c \ud45c\ud604\ud558\ub294 \ub2e8\uc6d0\uc744 \ub9cc\ub098 \ubcf4\uc138\uc694.",
  loading: "\ubd88\ub7ec\uc624\ub294 \uc911...",
  startSectionTitle: "\uc9c0\uae08 \uc2dc\uc791\ud558\uae30 \uc88b\uc740 \uc601\uc5b4 \ubbf8\uc158",
  startSectionDescription: "\uc624\ub298\uc758 \ud750\ub984\uc5d0 \uc798 \ub9de\ub294 \uc601\uc5b4 \ubbf8\uc158\uc744 \uba3c\uc800 \ucd94\ucc9c\ud574 \ub4dc\ub824\uc694.",
  startSectionEmpty: "\ucd94\ucc9c\ud560 \uc601\uc5b4 \ubbf8\uc158\uc744 \uc900\ube44\ud558\uace0 \uc788\uc5b4\uc694.",
  reviewSectionTitle: "\ub2e4\uc2dc \ubcf4\uba74 \uc88b\uc740 \ud45c\ud604",
  reviewSectionDescription: "\uc774\uc804\uc5d0 \ubcf8 \ubbf8\uc158\uc744 \ub2e4\uc2dc \ubcf4\uba70 \ud45c\ud604\uacfc \ubb38\uc7a5 \ud750\ub984\uc744 \uc815\ub9ac\ud574 \ubcf4\uc138\uc694.",
  reviewSectionEmpty: "\ubcf5\uc2b5\ud560 \uc601\uc5b4 \ubbf8\uc158\uc774 \uc544\uc9c1 \uc5c6\uc5b4\uc694.",
  interestSectionTitle: "\uad00\uc2ec \uc8fc\uc81c\ub85c \uc774\uc5b4 \uac00\uae30",
  interestSectionDescription: "\uc88b\uc544\ud558\ub294 \uc8fc\uc81c\uc640 \uc5f0\uacb0\ub41c \uc601\uc5b4 \ubbf8\uc158\uc73c\ub85c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc774\uc5b4 \uac00 \ubcf4\uc138\uc694.",
  interestSectionEmpty: "\uad00\uc2ec \uc8fc\uc81c\uc640 \ub9de\ub294 \uc601\uc5b4 \ubbf8\uc158\uc744 \uc900\ube44\ud558\uace0 \uc788\uc5b4\uc694.",
  startBadge: "\uc9c0\uae08 \ucd94\ucc9c",
  reviewBadge: "\ubcf5\uc2b5 \ucd94\ucc9c",
  interestBadge: "\uad00\uc2ec \uc8fc\uc81c",
  startCta: "\ubc14\ub85c \uc2dc\uc791",
  reviewCta: "\ud45c\ud604 \uc815\ub9ac",
  interestCta: "\ub2e4\uc74c\uc73c\ub85c \uc774\uc5b4 \uac00\uae30",
  error: "\uc601\uc5b4 \ud559\uc2b5 \uc815\ubcf4\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc5b4\uc694.",
  levelLabel: "\uc601\uc5b4 \ub808\ubca8",
  totalXpLabel: "\ucd1d \uc601\uc5b4 XP",
  nextLevelLabel: "\ub2e4\uc74c \ub808\ubca8\uae4c\uc9c0",
  todayGoalTitle: "\uc624\ub298\uc758 \uc601\uc5b4 \uc131\uc7a5",
  todayGoalTarget: "\uc624\ub298 \uc601\uc5b4 1\uac1c \uc644\ub8cc",
  weeklyGoalTarget: "\uc774\ubc88 \uc8fc \uc601\uc5b4 5\uac1c \uc644\ub8cc",
  todayGoalDone: "\uc624\ub298\uc758 \uc601\uc5b4 \ubaa9\ud45c\ub97c \ub2ec\uc131\ud588\uc5b4\uc694.",
  weeklyGoalDone: "\uc774\ubc88 \uc8fc \uc601\uc5b4 \ubaa9\ud45c\ub97c \ub2ec\uc131\ud588\uc5b4\uc694.",
  todayCompleteCount: "\uc624\ub298 \uc644\ub8cc",
  weeklyCompleteCount: "\uc774\ubc88 \uc8fc \uc644\ub8cc",
  growthEyebrow: "English Growth",
  growthDescription: "\uc624\ub298\uc758 \ud45c\ud604\uc744 \uc775\ud788\uba70, \ubbf8\uc158\uc744 \uafb8\uc900\ud788 \uc774\uc5b4 \uac00\ub294 \ud750\ub984 \uc18d\uc5d0\uc11c \uc601\uc5b4 \uc2e4\ub825\uc774 \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc131\uc7a5\ud558\uace0 \uc788\uc5b4\uc694.",
  growthDetail: "XP\uc640 \ubaa9\ud45c \uc9c4\ud589\ub960\uc740 \uc804\ccb4 \uc131\uc7a5 \ud750\ub984\uc744 \ubcf4\uc5ec \uc8fc\uace0, \uc544\ub798 \uc131\uc7a5 \uc9c0\ub3c4\ub294 \uc5b4\ub5a4 \uc601\uc5ed\uc774 \ub354 \ube60\ub974\uac8c \uc131\uc7a5 \uc911\uc778\uc9c0 \uc54c\ub824\uc918\uc694.",
  levelPrefix: "\ub808\ubca8 ",
  xpSuffix: " XP",
  xpRemainingSuffix: " XP \ub0a8\uc74c",
  achieved: "\ub2ec\uc131",
  streakFirst: "\uc624\ub298\uc758 \uc601\uc5b4\ub97c \uac00\ubccd\uac8c \uc2dc\uc791\ud574 \ubcfc\uae4c\uc694?",
  streakToday: "\uc624\ub298 \ucc98\uc74c \uc601\uc5b4\ub97c \uc644\ub8cc\ud588\uc5b4\uc694.",
  streakDaysSuffix: "\uc77c \uc5f0\uc18d \uc601\uc5b4 \ud559\uc2b5 \uc911",
  badgeSectionTitle: "\ub0b4 \uc601\uc5b4 \ubc30\uc9c0",
  badgeSectionDescription: "\ud68c\ud654, \ubb38\ubc95, \uc77d\uae30, \ud45c\ud604, \uafb8\uc900\ud568\uae4c\uc9c0 \uc601\uc5b4 \uc131\ucde8\uc758 \ud750\ub984\uc744 \ud55c\ub208\uc5d0 \ud655\uc778\ud560 \uc218 \uc788\uc5b4\uc694.",
  badgeEmptyTitle: "\uc544\uc9c1 \ud68d\ub4dd\ud55c \ubc30\uc9c0\uac00 \uc5c6\uc5b4\uc694.",
  badgeEmptyBody: "\uc601\uc5b4 \ubbf8\uc158\uc744 \uc644\ub8cc\ud558\uba74 \uccab \ubc30\uc9c0\uac00 \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc5f4\ub824\uc694.",
  badgeRecentTitle: "\ucd5c\uadfc \ud68d\ub4dd\ud55c \ubc30\uc9c0",
  badgeTotalLabel: "\ud68d\ub4dd\ud55c \ubc30\uc9c0",
  badgeLocked: "\ub3c4\uc804 \uc911",
  badgeEarned: "\ud68d\ub4dd \uc644\ub8cc",
  badgeConditionLabel: "\ud68d\ub4dd \uc870\uac74",
  growthMapTitle: "\ub0b4 \uc601\uc5b4 \uc131\uc7a5 \uc9c0\ub3c4",
  growthMapDescription: "\ucd5c\uadfc \uc644\ub8cc\ud55c \uc601\uc5b4 \ubbf8\uc158\uc744 \ubc14\ud0d5\uc73c\ub85c \ud68c\ud654, \ubb38\ubc95, \uc77d\uae30, \ud45c\ud604 \uc131\uc7a5\ub3c4\ub97c \uacc4\uc0b0\ud588\uc5b4\uc694.",
  growthMapFootnote: "\uc810\uc218\uac00 \ub0ae\uc740 \uc601\uc5ed\ub3c4 \ub2e4\uc74c \uc131\uc7a5\uc744 \uc900\ube44\ud558\ub294 \uc911\uc694\ud55c \uad6c\uac04\uc774\uc5d0\uc694. \ud604\uc7ac\uc758 \ud750\ub984\uc744 \ud3b8\uc548\ud558\uac8c \ud655\uc778\ud560 \uc218 \uc788\uc5b4\uc694.",
  strongestLabel: "\uac00\uc7a5 \ube60\ub974\uac8c \uc131\uc7a5 \uc911\uc778 \uc601\uc5ed",
  weakestLabel: "\ub2e4\uc74c\uc73c\ub85c \uc131\uc7a5\ud560 \uc601\uc5ed",
  weakSectionTitle: "\uc9c0\uae08 \ucd94\ucc9c",
  weakSectionDescription: "\uc9c0\uae08 \uc131\uc7a5\uc5d0 \uac00\uc7a5 \ub3c4\uc6c0\uc774 \ub418\ub294 \uc601\uc5b4 \ubbf8\uc158\uc774\uc5d0\uc694.",
  weakSectionEmpty: "\uc131\uc7a5 \uc9c0\ub3c4\ub97c \ubc14\ud0d5\uc73c\ub85c \ucd94\ucc9c\ud560 \uc601\uc5b4 \ubbf8\uc158\uc744 \uc900\ube44\ud558\uace0 \uc788\uc5b4\uc694.",
  weakSectionBadge: "\uc9c0\uae08 \ucd94\ucc9c",
  weakSectionCta: "\uc131\uc7a5 \uc774\uc5b4 \uac00\uae30",
  nextGoalTitle: "\ub2e4\uc74c\uc73c\ub85c \ub3c4\uc804\ud574 \ubcfc \ubaa9\ud45c",
  nextGoalDescription: "\ubc30\uc9c0 \ubaa9\ud45c\uc640 \uc5f0\uacb0\ub41c \ubbf8\uc158\uc744 \ud1b5\ud574 \ub2e4\uc74c \uc131\uc7a5 \ud750\ub984\uc744 \uc774\uc5b4 \uac08 \uc218 \uc788\uc5b4\uc694.",
  nextGoalEmpty: "\ud604\uc7ac \uc774\uc5b4\uc11c \ub3c4\uc804\ud560 \ubc30\uc9c0 \ubaa9\ud45c\ub97c \uc815\ub9ac\ud558\uace0 \uc788\uc5b4\uc694.",
  nextGoalBadge: "\ub2e4\uc74c \ubaa9\ud45c",
  nextGoalCta: "\ubaa9\ud45c \uc774\uc5b4 \uac00\uae30",
  nextGoalRemainingSuffix: "\uac1c \ub0a8\uc558\uc5b4\uc694",
  missionCountLabel: "\uc644\ub8cc \ubbf8\uc158",
  growthLevelSuffix: "\ub2e8\uacc4",
  firstStart: "\ucc98\uc74c \uc2dc\uc791",
  revisit: "\ub2e4\uc2dc \ubcf4\uae30",
  continueStudy: "\uc774\uc5b4\uc11c \ud558\uae30",
  easy: "\uc26c\uc6c0",
  normal: "\ubcf4\ud1b5",
  hard: "\ub3c4\uc804",
  expected: "\uc608\uc0c1",
  minute: "\ubd84",
  itemCountSuffix: "\uac1c",
  earnedCountSuffix: "\uac1c \ud68d\ub4dd",
  categoryConversation: "\ud68c\ud654",
  categoryGrammar: "\ubb38\ubc95",
  categoryReading: "\uc77d\uae30",
  categoryExpression: "\ud45c\ud604",
  categoryGeneral: "\uc601\uc5b4 \ubbf8\uc158",
} as const;


type EnglishProfile = {
  school_level: ProfileSchoolLevel | null;
  grade: number | null;
};

const EMPTY_BADGE_SHOWCASE: BadgeShowcase = {
  totalEarned: 0,
  recentBadges: [],
  showcaseBadges: [],
  nextBadge: null,
};

const RESPONSIVE_SKELETON_KEYS = ["one", "two", "three"];

function displayText(value: unknown, fallback = ""): string {
  const text = normalizeDisplayText(value);
  return text || fallback;
}

function gradeLabel(grade: number): string {
  return formatCurriculumGradeLabel(grade);
}

function difficultyLabel(difficulty: GeneratedMission["difficulty"]): string {
  if (difficulty === "easy") return ENGLISH_COPY.easy;
  if (difficulty === "hard" || difficulty === "challenge") return ENGLISH_COPY.hard;
  return ENGLISH_COPY.normal;
}

function displayEstimatedMinutes(minutes?: number | null): number {
  if (!minutes) return 7;
  if (minutes >= 15) return 9;
  if (minutes >= 13) return 8;
  if (minutes >= 11) return 7;
  if (minutes >= 9) return 6;
  return Math.max(5, minutes);
}

function statusText(progress?: MissionProgressSummary): string {
  if (!progress || progress.status === "not_started") return ENGLISH_COPY.firstStart;
  if (progress.status === "completed") return ENGLISH_COPY.revisit;
  return ENGLISH_COPY.continueStudy;
}

function pickTodayMission(missions: GeneratedMission[]): GeneratedMission | null {
  if (missions.length === 0) return null;
  const key = new Date().toISOString().slice(0, 10);
  const hash = Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return missions[hash % missions.length] ?? missions[0] ?? null;
}

function categoryLabel(category: EnglishGrowthCategory): string {
  if (category === "conversation") return ENGLISH_COPY.categoryConversation;
  if (category === "grammar") return ENGLISH_COPY.categoryGrammar;
  if (category === "reading") return ENGLISH_COPY.categoryReading;
  return ENGLISH_COPY.categoryExpression;
}

function englishMissionCategoryLabel(mission: GeneratedMission): string {
  return categoryLabel(classifyEnglishMissionCategory(mission));
}

function metaLine(mission: GeneratedMission): string {
  return `${englishMissionCategoryLabel(mission)} / ${difficultyLabel(mission.difficulty)} / ${ENGLISH_COPY.expected} ${displayEstimatedMinutes(
    mission.estimated_minutes
  )}${ENGLISH_COPY.minute} / ${missionXpForDifficulty(mission.difficulty)}XP`;
}

function missionXpForDifficulty(value: GeneratedMission["difficulty"]): number {
  return value === "hard" || value === "challenge" ? 15 : 10;
}

function goalLabel(current: number, target: number, doneText: string): string {
  if (current >= target) return doneText;
  return `\ud604\uc7ac ${Math.min(current, target)}/${target}`;
}

function streakLabel(streakDays: number): string {
  if (streakDays <= 0) return ENGLISH_COPY.streakFirst;
  if (streakDays === 1) return ENGLISH_COPY.streakToday;
  return `${streakDays}${ENGLISH_COPY.streakDaysSuffix}`;
}

function growthTone(category: EnglishGrowthCategory): { fill: string; surface: string } {
  if (category === "conversation") return { fill: "from-[#7ED6A5] to-[#9AE6B4]", surface: "border-[#7ED6A5]/30 bg-[#7ED6A5]/8" };
  if (category === "grammar") return { fill: "from-[#F6C76E] to-[#FFD88A]", surface: "border-[#F6C76E]/30 bg-[#F6C76E]/8" };
  if (category === "reading") return { fill: "from-[#7CC9FF] to-[#9BD8FF]", surface: "border-[#7CC9FF]/30 bg-[#7CC9FF]/8" };
  return { fill: "from-[#C8A8FF] to-[#E2C7FF]", surface: "border-[#C8A8FF]/30 bg-[#C8A8FF]/8" };
}

function routineTone(variant: DailyRoutineMissionCard["badgeVariant"]): { chip: string; surface: string } {
  if (variant === "success") return { chip: "border-[#7ED6A5]/30 bg-[#7ED6A5]/10 text-[#D8FBE6]", surface: "border-[#7ED6A5]/20 bg-[#7ED6A5]/6" };
  if (variant === "warning") return { chip: "border-[#F6C76E]/30 bg-[#F6C76E]/10 text-[#FFF2D7]", surface: "border-[#F6C76E]/20 bg-[#F6C76E]/6" };
  return { chip: "border-[#7CC9FF]/30 bg-[#7CC9FF]/10 text-[#DDF4FF]", surface: "border-[#7CC9FF]/20 bg-[#7CC9FF]/6" };
}



function compareRoutineFallbackMissions(a: GeneratedMission, b: GeneratedMission): number {
  const score = (mission: GeneratedMission): number => {
    if (mission.difficulty === "easy") return 0;
    if (mission.difficulty === "normal") return 1;
    if (mission.difficulty === "hard") return 2;
    return 3;
  };

  return score(a) - score(b) || Date.parse(b.created_at) - Date.parse(a.created_at);
}

function buildSafeFallbackRecommendations(args: {
  missions: GeneratedMission[];
  units: CurriculumUnit[];
  preferredGrade: number | null;
  weakestCategory: EnglishGrowthCategory;
}): EnglishMissionRecommendation[] {
  const unitGradeMap = new Map(args.units.map((unit) => [unit.id, unit.grade]));

  return args.missions
    .map((mission) => {
      const missionGrade = mission.unit_id ? unitGradeMap.get(mission.unit_id) ?? null : null;
      const gradeDistance =
        args.preferredGrade !== null && missionGrade !== null ? Math.abs(missionGrade - args.preferredGrade) : 2;
      const category = classifyEnglishMissionCategory(mission);
      const difficultyWeight =
        mission.difficulty === "easy" ? 0 : mission.difficulty === "normal" ? 1 : mission.difficulty === "hard" ? 2 : 3;

      return {
        mission,
        gradeDistance,
        categoryMatch: category === args.weakestCategory ? 0 : 1,
        difficultyWeight,
      };
    })
    .sort((a, b) => {
      return (
        a.gradeDistance - b.gradeDistance ||
        a.categoryMatch - b.categoryMatch ||
        a.difficultyWeight - b.difficultyWeight ||
        Date.parse(b.mission.created_at) - Date.parse(a.mission.created_at)
      );
    })
    .slice(0, 8)
    .map(({ mission }) => ({
      mission,
      reason:
        classifyEnglishMissionCategory(mission) === args.weakestCategory
          ? `${categoryLabel(args.weakestCategory)} 영역을 다시 다지며 핵심 표현을 천천히 익혀 볼 수 있어요.`
          : displayText(mission.mission_json.scenario, ENGLISH_COPY.scenarioFallback),
      matchedTags: mission.interest_tags ?? [],
    }));
}

function buildDailyRoutineCards(
  recommendations: EnglishRecommendationBundle | null,
  missions: GeneratedMission[]
): DailyRoutineMissionCard[] {
  const cards: DailyRoutineMissionCard[] = [];
  const seen = new Set<string>();

  const pushRecommendation = (
    item: EnglishMissionRecommendation | null | undefined,
    badge: string,
    badgeVariant: DailyRoutineMissionCard["badgeVariant"]
  ) => {
    if (!item || seen.has(item.mission.id)) return;
    seen.add(item.mission.id);
    cards.push({
      mission: item.mission,
      reason: displayText(item.reason, displayText(item.mission.mission_json.scenario, ENGLISH_COPY.scenarioFallback)),
      badge: displayText(badge),
      badgeVariant,
    });
  };

  pushRecommendation(recommendations?.startNow, ENGLISH_COPY.startBadge, "info");
  pushRecommendation(recommendations?.weaknessFocus?.recommendedMissions[0], ENGLISH_COPY.weakSectionBadge, "warning");
  pushRecommendation(recommendations?.nextBadgeGoal?.recommendedMissions[0], ENGLISH_COPY.nextGoalBadge, "success");

  for (const item of recommendations?.interest ?? []) {
    if (cards.length >= 3) break;
    pushRecommendation(item, ENGLISH_COPY.interestBadge, "success");
  }

  for (const item of recommendations?.review ?? []) {
    if (cards.length >= 3) break;
    pushRecommendation(item, ENGLISH_COPY.reviewBadge, "warning");
  }

  for (const mission of missions.slice().sort(compareRoutineFallbackMissions)) {
    if (cards.length >= 3) break;
    if (seen.has(mission.id)) continue;
    seen.add(mission.id);
    cards.push({
      mission,
      reason: displayText(mission.mission_json.scenario, ENGLISH_COPY.scenarioFallback),
      badge: displayText(ENGLISH_COPY.dailyRoutineBadge),
      badgeVariant: "info",
    });
  }

  return cards.slice(0, 3);
}

function RecommendationCard({
  item,
  href,
  badge,
  badgeVariant: variant,
  accentLabel,
  progress,
}: {
  item: EnglishMissionRecommendation;
  href: string;
  badge: string;
  badgeVariant: "info" | "warning" | "success";
  accentLabel: string;
  progress?: MissionProgressSummary;
}) {
  return (
    <Link
      href={href}
      className="group block h-full min-w-0 rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] sm:p-5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant={variant}>{displayText(badge)}</Badge>
        <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
          {displayText(progress ? statusText(progress) : accentLabel)}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-[var(--text)] sm:text-lg">{displayText(item.mission.title)}</h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)] sm:line-clamp-2">{displayText(item.reason)}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="min-w-0 text-xs leading-5 text-[var(--text-muted)]">{metaLine(item.mission)}</p>
        <span className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] sm:w-auto">
          {displayText(accentLabel)}
        </span>
      </div>
    </Link>
  );
}

export default function StudentEnglishPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number>(4);
  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [missions, setMissions] = useState<GeneratedMission[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, MissionProgressSummary>>({});
  const [profile, setProfile] = useState<EnglishProfile | null>(null);
  const [recommendations, setRecommendations] = useState<EnglishRecommendationBundle | null>(null);
  const [todayCompletedCount, setTodayCompletedCount] = useState(0);
  const [weeklyCompletedCount, setWeeklyCompletedCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [xpSummary, setXpSummary] = useState<StudentXpSummary>(EMPTY_XP_SUMMARY);
  const [badgeShowcase, setBadgeShowcase] = useState<BadgeShowcase>(EMPTY_BADGE_SHOWCASE);
  const [growthSummary, setGrowthSummary] = useState<EnglishGrowthSummary>(EMPTY_GROWTH_SUMMARY);
  const [weeklyEnglishPath, setWeeklyEnglishPath] = useState<WeeklyEnglishPathResult | null>(null);
  const [todayRecommendation, setTodayRecommendation] = useState<TodayEnglishRecommendation | null>(null);
  const [weeklyPathError, setWeeklyPathError] = useState<string | null>(null);
  const [weeklyPathNotice, setWeeklyPathNotice] = useState<string | null>(null);

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

        const [unitRows, missionRows] = await Promise.all([
          fetchCurriculumUnitsBySubject("english"),
          fetchPublishedMissions(200, "english"),
        ]);

        let nextProfile: EnglishProfile | null = null;
        let nextRecommendations: EnglishRecommendationBundle | null = null;
        let nextTodayCompletedCount = 0;
        let nextWeeklyCompletedCount = 0;
        let nextStreakDays = 0;
        let nextXpSummary: StudentXpSummary = EMPTY_XP_SUMMARY;
        let nextBadgeShowcase: BadgeShowcase = EMPTY_BADGE_SHOWCASE;
        let nextGrowthSummary: EnglishGrowthSummary = EMPTY_GROWTH_SUMMARY;
        let nextWeeklyEnglishPath: WeeklyEnglishPathResult | null = null;
        let nextTodayRecommendation: TodayEnglishRecommendation | null = null;
        let nextWeeklyPathError: string | null = null;

        if (user?.id) {
          const [profileRes, recommendationRes, statsRes, xpRes, badgeRes, growthRes] = await Promise.allSettled([
            supabase.from("profiles").select("school_level,grade").eq("id", user.id).single<EnglishProfile>(),
            getStudentEnglishRecommendations(user.id),
            getStudentMissionStats("english"),
            getStudentXpSummary("english"),
            getStudentEnglishBadgeShowcase(user.id),
            getEnglishGrowthSummary(user.id),
          ]);

          if (profileRes.status === "fulfilled" && !profileRes.value.error) {
            nextProfile = profileRes.value.data;
          }
          if (recommendationRes.status === "fulfilled") {
            nextRecommendations = recommendationRes.value;
          }
          if (statsRes.status === "fulfilled") {
            nextTodayCompletedCount = statsRes.value.todayCompletedCount;
            nextWeeklyCompletedCount = statsRes.value.weeklyCompletedCount;
            nextStreakDays = calculateStreak(statsRes.value.completedDates);
          }
          if (xpRes.status === "fulfilled") {
            nextXpSummary = xpRes.value;
          }
          if (badgeRes.status === "fulfilled") {
            nextBadgeShowcase = badgeRes.value;
          }
          if (growthRes.status === "fulfilled") {
            nextGrowthSummary = growthRes.value;
          }

          try {
            const [path, recommendation] = await Promise.all([
              getWeeklyPath(user.id, "english"),
              getTodayRecommendation(user.id, "english"),
            ]);
            nextWeeklyEnglishPath = path;
            nextTodayRecommendation = recommendation;
          } catch (weeklyPathLoadError) {
            console.error("student english weekly path load failed", weeklyPathLoadError);
            nextWeeklyPathError = "영어 추천 경로를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.";
          }
        }

        const missionProgress = await fetchMissionProgressMap(
          missionRows.map((mission) => mission.id),
          Object.fromEntries(missionRows.map((mission) => [mission.id, mission.mission_json.steps.length]))
        );

        if (!mounted) return;
        setUnits(unitRows);
        setMissions(missionRows);
        setProgressMap(missionProgress);
        setProfile(nextProfile);
        setRecommendations(nextRecommendations);
        setTodayCompletedCount(nextTodayCompletedCount);
        setWeeklyCompletedCount(nextWeeklyCompletedCount);
        setStreakDays(nextStreakDays);
        setXpSummary(nextXpSummary);
        setBadgeShowcase(nextBadgeShowcase);
        setGrowthSummary(nextGrowthSummary);
        setWeeklyEnglishPath(nextWeeklyEnglishPath);
        setTodayRecommendation(nextTodayRecommendation);
        setWeeklyPathError(nextWeeklyPathError);
      } catch (loadError) {
        console.error("student english load failed", loadError);
        if (!mounted) return;
        setError(ENGLISH_COPY.error);
        setTodayCompletedCount(0);
        setWeeklyCompletedCount(0);
        setStreakDays(0);
        setXpSummary(EMPTY_XP_SUMMARY);
        setBadgeShowcase(EMPTY_BADGE_SHOWCASE);
        setGrowthSummary(EMPTY_GROWTH_SUMMARY);
        setWeeklyEnglishPath(null);
        setTodayRecommendation(null);
        setWeeklyPathError(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveGrade = useMemo(
    () => getEffectiveSchoolGrade(profile?.school_level ?? null, profile?.grade ?? null),
    [profile?.grade, profile?.school_level]
  );

  useEffect(() => {
    const promotedGrade = effectiveGrade ? toCurriculumGradeNumber(effectiveGrade.schoolLevel, effectiveGrade.grade) : null;
    if (!promotedGrade) return;
    if (GRADE_FILTERS.includes(promotedGrade)) setSelectedGrade(promotedGrade);
  }, [effectiveGrade]);

  const filteredUnits = useMemo(() => units.filter((unit) => unit.grade === selectedGrade), [selectedGrade, units]);
  const todayGoalMet = todayCompletedCount >= TODAY_GOAL;
  const weeklyGoalMet = weeklyCompletedCount >= WEEKLY_GOAL;
  const strongestCategoryLabel = categoryLabel(growthSummary.strongestCategory);
  const weakestCategoryLabel = categoryLabel(growthSummary.weakestCategory);
  const dailyRoutineCards = useMemo(() => buildDailyRoutineCards(recommendations, missions), [missions, recommendations]);
  const weeklySteps = weeklyEnglishPath?.steps ?? [];
  const weeklyPathSummary = weeklySteps.length > 0 ? weeklyPathDifficultySummary(weeklySteps) : null;

  const preferredGrade = effectiveGrade ? toCurriculumGradeNumber(effectiveGrade.schoolLevel, effectiveGrade.grade) : selectedGrade;
  const fallbackRecommendationItems = useMemo<EnglishMissionRecommendation[]>(
    () =>
      buildSafeFallbackRecommendations({
        missions,
        units,
        preferredGrade,
        weakestCategory: growthSummary.weakestCategory,
      }),
    [growthSummary.weakestCategory, missions, preferredGrade, units]
  );
  const recommendedStep = todayRecommendation?.step ?? (weeklyEnglishPath && weeklyEnglishPath.recommendedIndex >= 0 ? weeklyEnglishPath.steps[weeklyEnglishPath.recommendedIndex] ?? null : null);
  const nextRouteHref = recommendedStep?.missionId ? buildRecommendationHref("english", recommendedStep.missionId) ?? "/student/english" : "/student/english";
  const todayMission = useMemo(
    () => recommendedStep?.mission ?? recommendations?.startNow?.mission ?? dailyRoutineCards[0]?.mission ?? pickTodayMission(missions),
    [dailyRoutineCards, missions, recommendedStep, recommendations?.startNow?.mission]
  );
  const startNowItem = recommendations?.startNow ?? fallbackRecommendationItems[0] ?? null;
  const reviewItems = recommendations?.review?.length ? recommendations.review : fallbackRecommendationItems.slice(1, 4);
  const interestItems = recommendations?.interest?.length ? recommendations.interest : fallbackRecommendationItems.slice(2, 5);
  const weaknessItems = recommendations?.weaknessFocus?.recommendedMissions?.length
    ? recommendations.weaknessFocus.recommendedMissions
    : fallbackRecommendationItems.slice(0, 3);
  const nextGoalItems = recommendations?.nextBadgeGoal?.recommendedMissions?.length
    ? recommendations.nextBadgeGoal.recommendedMissions
    : fallbackRecommendationItems.slice(1, 3);

  return (
    <PageShell
      title={displayText(ENGLISH_COPY.pageTitle)}
      subtitle={displayText(ENGLISH_COPY.pageSubtitle)}
      maxWidthClassName="max-w-[1180px]"
      contentClassName="space-y-4 sm:space-y-5 lg:space-y-6"
    >
      <SectionCard
        header="오늘의 추천"
        description="지금 바로 시작해야 할 영어 미션을 가장 먼저 보여줘요."
        rightSlot={
          recommendedStep?.missionId ? (
            <Link
              href={nextRouteHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] md:w-auto"
            >
              {weeklyEnglishPath?.completionMessage ? "다음 루트 시작하기" : "바로 시작"}
            </Link>
          ) : null
        }
      >
        {weeklyPathError ? (
          <div className="rounded-3xl border border-[#6A2B2B] bg-[#2A1414] p-5 text-sm text-[#FFB4B4]">{weeklyPathError}</div>
        ) : recommendedStep?.missionId ? (
          <div
            role="link"
            tabIndex={0}
            onClick={() => router.push(nextRouteHref)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              router.push(nextRouteHref);
            }}
            className="cursor-pointer rounded-[30px] border border-[rgba(255,214,117,0.24)] bg-[linear-gradient(135deg,rgba(255,214,117,0.12),rgba(126,214,165,0.08)_52%,rgba(15,23,42,0.98))] p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)] md:p-6"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">{`${recommendedStep.weekdayLabel}요일 추천`}</Badge>
                  <span className="inline-flex items-center rounded-full border border-[rgba(255,214,117,0.35)] bg-[rgba(255,214,117,0.12)] px-3 py-1 text-[11px] font-medium text-[#72243E]">
                    {difficultyLabel(recommendedStep.difficulty)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[rgba(126,214,165,0.35)] bg-[rgba(126,214,165,0.12)] px-3 py-1 text-[11px] font-medium text-[#D8FBE6]">
                    +{recommendedStep.rewardXp} XP
                  </span>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">오늘 할 영어</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl">{displayText(recommendedStep.cleanedTitle)}</h2>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{recommendedStep.weekdayLabel}요일</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{recommendedStep.unitName}</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{`STEP ${recommendedStep.stepOrder}`}</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{`${recommendedStep.estimatedMinutes}${displayText(ENGLISH_COPY.minute)}`}</span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{recommendedStep.status}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{recommendedStep.recommendationReason}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(nextRouteHref);
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95"
                  >
                    {weeklyEnglishPath?.completionMessage ? "다음 루트 시작하기" : "바로 시작"}
                  </button>
                  <p className="text-xs text-[var(--text-muted)]">
                    {todayRecommendation?.selectionReason === "today"
                      ? "오늘 요일에 맞춘 영어 루트예요."
                      : todayRecommendation?.selectionReason === "completed_week"
                        ? weeklyEnglishPath?.rotatedFromPathKey
                          ? "이번 주 영어 루트를 모두 완료해서 다음 루트로 자동 전환했어요."
                          : "이번 주 영어 루트를 모두 완료했어요."
                        : todayRecommendation?.selectionReason === "previous_incomplete"
                          ? "오늘 단계로 가기 전에 먼저 끝내야 할 영어 미션이에요."
                          : "오늘 단계가 없거나 이미 끝나서 이번 주 첫 미완료 영어 미션을 보여줘요."}
                  </p>
                </div>
              </div>
              <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[var(--card-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">추천 포인트</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-[11px] text-[var(--text-muted)]">학습 주제</p>
                    <p className="mt-1 font-semibold text-[var(--text)]">{recommendedStep.unitName}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-[11px] text-[var(--text-muted)]">난이도 흐름</p>
                    <p className="mt-1 text-[var(--text)]">{weeklyPathSummary ?? "easy -> normal -> hard"}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-[11px] text-[var(--text-muted)]">진행 상태</p>
                    <p className="mt-1 text-[var(--text)]">{weeklyEnglishPath ? `${weeklyEnglishPath.completedCount}/${weeklyEnglishPath.steps.length} 완료` : "추천 경로 확인 중"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5 text-sm text-[var(--text-muted)]">
            아직 영어 추천 경로가 준비되지 않았어요. 아래 영어 미션 추천에서 바로 시작할 수 있어요.
          </div>
        )}
      </SectionCard>

      <SectionCard
        header="이번 주 영어 루트"
        description="월요일부터 금요일까지, 회화에서 추론까지 이어지는 영어 루트예요."
      >
        {weeklyPathError ? (
          <div className="rounded-3xl border border-[#6A2B2B] bg-[#2A1414] p-5 text-sm text-[#FFB4B4]">{weeklyPathError}</div>
        ) : weeklySteps.length === 0 ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5 text-sm text-[var(--text-muted)]">
            아직 영어 추천 경로가 준비되지 않았어요.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">난이도 흐름: {weeklyPathSummary ?? "easy -> normal -> hard"}</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1">{weeklyEnglishPath?.completedCount ?? 0}개 완료</span>
              {weeklyEnglishPath?.recommendedIndex !== undefined && weeklyEnglishPath.recommendedIndex >= 0 && weeklySteps[weeklyEnglishPath.recommendedIndex] && (
                <span className="rounded-full border border-[rgba(255,214,117,0.28)] bg-[rgba(255,214,117,0.12)] px-3 py-1 text-[#72243E]">
                  오늘 강조: {weeklySteps[weeklyEnglishPath.recommendedIndex]?.weekdayLabel}요일
                </span>
              )}
            </div>
            {weeklyEnglishPath?.completionMessage && recommendedStep?.missionId && (
              <div className="flex flex-col gap-3 rounded-2xl border border-[#7ED6A5]/30 bg-[#7ED6A5]/10 px-4 py-4 text-sm text-[#D8FBE6] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">이번 주 완료</p>
                  <p className="mt-1 text-xs text-[#D8FBE6]/80">{weeklyEnglishPath.completionMessage}</p>
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
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
              {weeklySteps.map((step) => (
                <WeeklyPathMissionCard
                  key={`${step.stepOrder}:${step.missionId}`}
                  step={step}
                  href={buildRecommendationHref("english", step.missionId)}
                  difficultyLabel={difficultyLabel(step.difficulty)}
                  minuteLabel={displayText(ENGLISH_COPY.minute)}
                  onLockedAttempt={(message) => setWeeklyPathNotice(message)}
                />
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        header="추천 이유"
        description="오늘 영어 미션이 왜 지금 필요한지, 시험과 표현력 연결까지 함께 보여줘요."
      >
        {!recommendedStep ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5 text-sm text-[var(--text-muted)]">
            추천 이유는 영어 루트가 준비되면 함께 보여드릴게요.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">학습 주제</p>
              <p className="mt-3 text-lg font-semibold text-[var(--text)]">{recommendedStep.unitName}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{recommendedStep.recommendationReason}</p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">실생활 연결</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text)]">{recommendedStep.dailyConnection}</p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">시험 연결</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text)]">{recommendedStep.examConnection}</p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">표현력 연결</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text)]">{recommendedStep.thinkingConnection}</p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        header={displayText(ENGLISH_COPY.dailyRoutineTitle)}
        description={displayText(ENGLISH_COPY.dailyRoutineDescription)}
        rightSlot={
          dailyRoutineCards[0] ? (
            <Link
              href={`/student/english/mission/${dailyRoutineCards[0].mission.id}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] md:w-auto"
            >
              {displayText(ENGLISH_COPY.dailyRoutineStart)}
            </Link>
          ) : null
        }
        className="scroll-mt-20"
      >
        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {RESPONSIVE_SKELETON_KEYS.map((key) => (
              <div key={key} className="rounded-[24px] border border-[var(--border)] bg-[var(--card-soft)] p-4 sm:p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-24 rounded-full bg-[var(--card)]" />
                  <div className="h-5 w-3/4 rounded-full bg-[var(--card)]" />
                  <div className="h-16 rounded-2xl bg-[var(--card)]" />
                  <div className="flex gap-3">
                    <div className="h-4 flex-1 rounded-full bg-[var(--card)]" />
                    <div className="h-11 w-28 rounded-full bg-[var(--card)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dailyRoutineCards.map((item, index) => {
              const tone = routineTone(item.badgeVariant);
              const progress = progressMap[item.mission.id];

              return (
                <div key={item.mission.id} className={`flex h-full min-w-0 flex-col rounded-[24px] border p-4 sm:p-5 ${tone.surface}`}>
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--text-muted)]">{`${index + 1}. ${displayText(item.badge)}`}</p>
                      <p className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-[var(--text)]">{displayText(item.mission.title)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${tone.chip}`}>
                      {displayText(progress ? statusText(progress) : ENGLISH_COPY.dailyRoutineBadge)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">{displayText(item.reason)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1">{difficultyLabel(item.mission.difficulty)}</span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1">{displayEstimatedMinutes(item.mission.estimated_minutes)}{displayText(ENGLISH_COPY.minute)}</span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1">{missionXpForDifficulty(item.mission.difficulty)}XP</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-[var(--text-muted)]">{metaLine(item.mission)}</span>
                    <Link
                      href={`/student/english/mission/${item.mission.id}`}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] sm:w-auto"
                    >
                      START
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(145deg,rgba(126,214,165,0.08),rgba(255,255,255,0.02))] p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[#7ED6A5]">{displayText(ENGLISH_COPY.heroEyebrow)}</p>
              <h2 className="mt-2 line-clamp-2 text-xl font-semibold leading-tight text-[var(--text)] sm:text-2xl lg:text-[2rem]">
                {todayMission ? displayText(todayMission.title) : displayText(ENGLISH_COPY.heroEmptyTitle)}
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)] sm:line-clamp-none">
                {todayMission ? displayText(todayMission.mission_json.scenario, ENGLISH_COPY.scenarioFallback) : displayText(ENGLISH_COPY.heroFallbackDescription)}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 text-sm text-[var(--text-muted)] md:w-auto md:items-end">
              {todayMission && <p>{metaLine(todayMission)}</p>}
              <Link
                href={todayMission ? `/student/english/mission/${todayMission.id}` : '/student/english'}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] md:w-auto"
              >
                {displayText(ENGLISH_COPY.startButton)}
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[#7ED6A5]">{displayText(ENGLISH_COPY.growthEyebrow)}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">{displayText(ENGLISH_COPY.todayGoalTitle)}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{displayText(ENGLISH_COPY.growthDescription)}</p>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--text-muted)]">{displayText(ENGLISH_COPY.growthDetail)}</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">{displayText(ENGLISH_COPY.levelLabel)}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{displayText(ENGLISH_COPY.levelPrefix)}{xpSummary.level}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">{displayText(ENGLISH_COPY.totalXpLabel)}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{xpSummary.totalXp}{displayText(ENGLISH_COPY.xpSuffix)}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">{displayText(ENGLISH_COPY.nextLevelLabel)}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{xpSummary.xpToNextLevel}{displayText(ENGLISH_COPY.xpRemainingSuffix)}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">{displayText(ENGLISH_COPY.missionCountLabel)}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{todayCompletedCount}{displayText(ENGLISH_COPY.itemCountSuffix)} / 7일</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--text-muted)]">{displayText(ENGLISH_COPY.todayGoalTarget)}</p>
                <Badge variant={todayGoalMet ? 'success' : 'info'}>
                  {todayGoalMet ? displayText(ENGLISH_COPY.achieved) : `${todayCompletedCount}/${TODAY_GOAL}`}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--text)]">{goalLabel(todayCompletedCount, TODAY_GOAL, displayText(ENGLISH_COPY.todayGoalDone))}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--text-muted)]">{displayText(ENGLISH_COPY.weeklyGoalTarget)}</p>
                <Badge variant={weeklyGoalMet ? 'success' : 'neutral'}>
                  {Math.min(weeklyCompletedCount, WEEKLY_GOAL)}/{WEEKLY_GOAL}
                </Badge>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--card-soft)]">
                <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${Math.min(100, (weeklyCompletedCount / WEEKLY_GOAL) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-[var(--text)]">{goalLabel(weeklyCompletedCount, WEEKLY_GOAL, displayText(ENGLISH_COPY.weeklyGoalDone))}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text)]">
              {displayText(ENGLISH_COPY.todayCompleteCount)} {todayCompletedCount}{displayText(ENGLISH_COPY.itemCountSuffix)}
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text)]">
              {displayText(ENGLISH_COPY.weeklyCompleteCount)} {weeklyCompletedCount}/{WEEKLY_GOAL}
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text)]">
              {streakLabel(streakDays)}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard header={displayText(ENGLISH_COPY.growthMapTitle)} description={displayText(ENGLISH_COPY.growthMapDescription)}>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{displayText(ENGLISH_COPY.growthMapFootnote)}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[var(--text)]">
                {displayText(ENGLISH_COPY.strongestLabel)} / {strongestCategoryLabel}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[var(--text)]">
                {displayText(ENGLISH_COPY.weakestLabel)} / {weakestCategoryLabel}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
            {growthSummary.orderedMetrics.map((metric) => {
              const tone = growthTone(metric.category);
              return (
                <div key={metric.category} className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${tone.surface}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{metric.label}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {displayText(ENGLISH_COPY.missionCountLabel)} {metric.completedMissionCount}{displayText(ENGLISH_COPY.itemCountSuffix)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-[var(--text)]">{metric.score}%</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {metric.level}{displayText(ENGLISH_COPY.growthLevelSuffix)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--card)]">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tone.fill} transition-[width]`} style={{ width: `${metric.score}%` }} />
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)] sm:line-clamp-none">{metric.guidance}</p>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard header={displayText(ENGLISH_COPY.weakSectionTitle)} description={displayText(ENGLISH_COPY.weakSectionDescription)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 sm:p-5">
            <p className="text-sm font-semibold text-[var(--text)]">
              {recommendations?.weaknessFocus
                ? `${recommendations.weaknessFocus.categoryLabel} 영역을 다시 살펴보면 좋아요.`
                : `${weakestCategoryLabel} 영역부터 차근차근 다시 시작해 보세요.`}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {recommendations?.weaknessFocus?.description ?? displayText(ENGLISH_COPY.weakSectionEmpty)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {weaknessItems.map((item) => (
              <RecommendationCard
                key={item.mission.id}
                item={item}
                href={`/student/english/mission/${item.mission.id}`}
                badge={ENGLISH_COPY.weakSectionBadge}
                badgeVariant="info"
                accentLabel={ENGLISH_COPY.weakSectionCta}
                progress={progressMap[item.mission.id]}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard header={displayText(ENGLISH_COPY.nextGoalTitle)} description={displayText(ENGLISH_COPY.nextGoalDescription)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text)]">{recommendations?.nextBadgeGoal?.name ?? "\ub2e4\uc74c \ubc30\uc9c0\ub97c \ud5a5\ud574 \ud55c \uac78\uc74c \ub354"}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {recommendations?.nextBadgeGoal?.description ?? displayText(ENGLISH_COPY.nextGoalEmpty)}
                </p>
              </div>
              <Badge variant="warning">
                {recommendations?.nextBadgeGoal
                  ? `${recommendations.nextBadgeGoal.remainingCount}${displayText(ENGLISH_COPY.nextGoalRemainingSuffix)}`
                  : `2${displayText(ENGLISH_COPY.nextGoalRemainingSuffix)}`}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {nextGoalItems.map((item) => (
              <RecommendationCard
                key={item.mission.id}
                item={item}
                href={`/student/english/mission/${item.mission.id}`}
                badge={ENGLISH_COPY.nextGoalBadge}
                badgeVariant="warning"
                accentLabel={ENGLISH_COPY.nextGoalCta}
                progress={progressMap[item.mission.id]}
              />
            ))}
          </div>
        </div>
      </SectionCard>

            <SectionCard header={displayText(ENGLISH_COPY.badgeSectionTitle)} description={displayText(ENGLISH_COPY.badgeSectionDescription)}>
        <BadgeShowcasePanel
          showcase={badgeShowcase}
          emptyTitle={displayText(ENGLISH_COPY.badgeEmptyTitle)}
          emptyBody={displayText(ENGLISH_COPY.badgeEmptyBody)}
        />
      </SectionCard>

      <SectionCard header={displayText(ENGLISH_COPY.gradeSectionTitle)} description={displayText(ENGLISH_COPY.gradeSectionDescription)}>
        <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-6">
          {GRADE_FILTERS.map((grade) => (
            <button
              key={grade}
              type="button"
              className={`min-h-11 shrink-0 rounded-xl border px-4 py-2 text-sm whitespace-nowrap sm:w-full ${
                selectedGrade === grade
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]'
              }`}
              onClick={() => setSelectedGrade(grade)}
            >
              {gradeLabel(grade)}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {RESPONSIVE_SKELETON_KEYS.map((key) => (
              <div key={key} className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 sm:p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-20 rounded-full bg-[var(--card)]" />
                  <div className="h-5 w-2/3 rounded-full bg-[var(--card)]" />
                  <div className="h-12 rounded-2xl bg-[var(--card)]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{displayText(error)}</div>
        ) : filteredUnits.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            {`${gradeLabel(selectedGrade)} ${displayText(ENGLISH_COPY.gradeSectionEmptySuffix)}`}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredUnits.map((unit) => (
              <Link key={unit.id} href={`/student/english/${unit.id}`} className="block min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)] sm:p-5">
                <p className="text-xs text-[var(--text-muted)]">{`${gradeLabel(unit.grade)} ${displayText(ENGLISH_COPY.gradeUnitLabelSuffix)}`}</p>
                <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-[var(--text)]">{displayText(unit.unit_name)}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-muted)] sm:line-clamp-2">
                  {displayText(unit.description ?? unit.concept_summary, ENGLISH_COPY.unitCardFallback)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard header={displayText(ENGLISH_COPY.startSectionTitle)} description={displayText(ENGLISH_COPY.startSectionDescription)}>
        {startNowItem ? (
          <RecommendationCard
            item={startNowItem}
            href={`/student/english/mission/${startNowItem.mission.id}`}
            badge={ENGLISH_COPY.startBadge}
            badgeVariant="info"
            accentLabel={ENGLISH_COPY.startCta}
            progress={progressMap[startNowItem.mission.id]}
          />
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{displayText(ENGLISH_COPY.startSectionEmpty)}</div>
        )}
      </SectionCard>

      <SectionCard header={displayText(ENGLISH_COPY.reviewSectionTitle)} description={displayText(ENGLISH_COPY.reviewSectionDescription)}>
        {reviewItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reviewItems.map((item) => (
              <RecommendationCard
                key={item.mission.id}
                item={item}
                href={`/student/english/mission/${item.mission.id}`}
                badge={ENGLISH_COPY.reviewBadge}
                badgeVariant="warning"
                accentLabel={ENGLISH_COPY.reviewCta}
                progress={progressMap[item.mission.id]}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{displayText(ENGLISH_COPY.reviewSectionEmpty)}</div>
        )}
      </SectionCard>

      <SectionCard header={displayText(ENGLISH_COPY.interestSectionTitle)} description={displayText(ENGLISH_COPY.interestSectionDescription)}>
        {interestItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {interestItems.map((item) => (
              <RecommendationCard
                key={item.mission.id}
                item={item}
                href={`/student/english/mission/${item.mission.id}`}
                badge={ENGLISH_COPY.interestBadge}
                badgeVariant="success"
                accentLabel={ENGLISH_COPY.interestCta}
                progress={progressMap[item.mission.id]}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{displayText(ENGLISH_COPY.interestSectionEmpty)}</div>
        )}
      </SectionCard>
    </PageShell>
  );
}






