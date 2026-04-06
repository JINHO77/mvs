import { normalizeInterestTagSelection } from "@/constants/interestTags";
import { classifyEnglishMissionCategory, getEnglishGrowthSummary, type EnglishGrowthCategory } from "@/lib/englishGrowth";
import { fetchPublishedMissions } from "@/lib/missions";
import { supabase } from "@/lib/supabaseClient";
import { normalizeUiText } from "@/lib/uiText";
import type { GeneratedMission } from "@/types/missions";

type EnglishRecommendationProfile = {
  interest_tags: string[] | null;
};

type EnglishRecommendationAttempt = {
  mission_id: string;
  status: "started" | "completed" | "abandoned";
  updated_at: string;
};

type BadgeGoalRule = {
  key: string;
  name: string;
  description: string;
  category: EnglishGrowthCategory | "streak";
  targetCount: number;
  keywords?: string[];
  type: "mission_count" | "streak";
};

export type EnglishMissionRecommendation = {
  mission: GeneratedMission;
  reason: string;
  matchedTags: string[];
};

export type WeakEnglishRecommendation = {
  weakestCategory: EnglishGrowthCategory;
  categoryLabel: string;
  description: string;
  recommendedMissions: EnglishMissionRecommendation[];
};

export type EnglishBadgeGoalRecommendation = {
  key: string;
  name: string;
  description: string;
  category: EnglishGrowthCategory | "streak";
  remainingCount: number;
  recommendedMissions: EnglishMissionRecommendation[];
};

export type EnglishRecommendationBundle = {
  startNow: EnglishMissionRecommendation | null;
  review: EnglishMissionRecommendation[];
  interest: EnglishMissionRecommendation[];
  weaknessFocus: WeakEnglishRecommendation | null;
  nextBadgeGoal: EnglishBadgeGoalRecommendation | null;
};

const BADGE_GOAL_RULES: BadgeGoalRule[] = [
  {
    key: "english_first_step",
    name: "\uc601\uc5b4 \uccab\uac78\uc74c",
    description: "\uccab \ubc88\uc9f8 \uc601\uc5b4 \ubbf8\uc158\uc744 \uc644\ub8cc\ud558\uba74 \uc5f4\ub824\uc694.",
    category: "conversation",
    targetCount: 1,
    keywords: ["english", "conversation", "\uc778\uc0ac", "\uc790\uae30\uc18c\uac1c", "\ub300\ud654"],
    type: "mission_count",
  },
  {
    key: "reader_starter",
    name: "\ub9ac\ub354 \uc2a4\ud0c0\ud130",
    description: "\uc77d\uae30 \uc911\uc2ec \uc601\uc5b4 \ubbf8\uc158\uc744 2\uac1c \uc644\ub8cc\ud574 \ubcf4\uc138\uc694.",
    category: "reading",
    targetCount: 2,
    keywords: ["read", "reading", "reader", "notice", "poster", "story", "article", "\ub3c5\ud574", "\uc77d\uae30", "\uc548\ub0b4\ubb38"],
    type: "mission_count",
  },
  {
    key: "speaker_starter",
    name: "\uc2a4\ud53c\ucee4 \uc2a4\ud0c0\ud130",
    description: "\ub9d0\ud558\uae30\uc640 \ud45c\ud604 \uc911\uc2ec \uc601\uc5b4 \ubbf8\uc158\uc744 2\uac1c \uc644\ub8cc\ud574 \ubcf4\uc138\uc694.",
    category: "expression",
    targetCount: 2,
    keywords: ["speak", "speaking", "speaker", "conversation", "dialogue", "opinion", "presentation", "\ub9d0\ud558\uae30", "\ub300\ud654", "\ud45c\ud604", "\uc758\uacac"],
    type: "mission_count",
  },
  {
    key: "streak_reader",
    name: "\uafb8\uc900\ud55c \ub9ac\ub354",
    description: "\uc601\uc5b4 \ubbf8\uc158\uc744 3\uc77c \uc5f0\uc18d \uc644\ub8cc\ud574 \ubcf4\uc138\uc694.",
    category: "streak",
    targetCount: 3,
    type: "streak",
  },
];

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function missionTags(mission: GeneratedMission): string[] {
  return (mission.mission_json.conceptTags ?? []).map((tag) => normalizeTag(tag)).filter(Boolean);
}

function missionKeywordSource(mission: Pick<GeneratedMission, "title" | "interest_tags" | "mission_json">): string {
  return [
    mission.title,
    mission.mission_json.title,
    mission.mission_json.scenario,
    mission.mission_json.essentialQuestion,
    mission.mission_json.mainConcept,
    ...(mission.interest_tags ?? []),
    ...(mission.mission_json.conceptTags ?? []),
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function missionMatchesAny(mission: Pick<GeneratedMission, "title" | "interest_tags" | "mission_json">, keywords: string[]): boolean {
  const source = missionKeywordSource(mission);
  return keywords.some((keyword) => source.includes(keyword));
}

function uniqueRecentMissionIds(attempts: EnglishRecommendationAttempt[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const attempt of attempts) {
    if (seen.has(attempt.mission_id)) continue;
    seen.add(attempt.mission_id);
    result.push(attempt.mission_id);
  }

  return result;
}

function categoryLabel(category: EnglishGrowthCategory): string {
  if (category === "conversation") return "\ud68c\ud654";
  if (category === "grammar") return "\ubb38\ubc95";
  if (category === "reading") return "\uc77d\uae30";
  return "\ud45c\ud604";
}

function difficultyRank(difficulty: GeneratedMission["difficulty"]): number {
  if (difficulty === "easy") return 0;
  if (difficulty === "normal") return 1;
  if (difficulty === "hard") return 2;
  return 3;
}

function sortRecommendedMissions(a: GeneratedMission, b: GeneratedMission): number {
  return difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || Date.parse(b.created_at) - Date.parse(a.created_at);
}

function buildReason(kind: "start" | "review" | "interest" | "weakness" | "badge", mission: GeneratedMission, extra?: string): string {
  if (kind === "review") {
    return normalizeUiText("\uc774\uc804\uc5d0 \ub2e4\ub8ec \ud45c\ud604\uacfc \uc0c1\ud669\uc744 \ub2e4\uc2dc \uc815\ub9ac\ud558\ub294 \ub370 \ub3c4\uc6c0\uc774 \ub418\ub294 \ubbf8\uc158\uc774\uc5d0\uc694.");
  }

  if (kind === "interest") {
    return normalizeUiText("\uad00\uc2ec \uc8fc\uc81c\uc640 \uc5f0\uacb0\ub41c \uc601\uc5b4 \ubbf8\uc158\uc774\ub77c \ud750\ub984\uc744 \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc774\uc5b4 \uac08 \uc218 \uc788\uc5b4\uc694.");
  }

  if (kind === "weakness") {
    return normalizeUiText(extra ? `${extra} \uc601\uc5ed\uc758 \uc131\uc7a5\uc744 \ubcf4\uc644\ud558\ub294 \ub370 \ub3c4\uc6c0\uc774 \ub418\ub294 \ubbf8\uc158\uc774\uc5d0\uc694.` : "\ud604\uc7ac \uc131\uc7a5\uc5d0 \uac00\uc7a5 \ub3c4\uc6c0\uc774 \ub418\ub294 \uc601\uc5b4 \ubbf8\uc158\uc774\uc5d0\uc694.");
  }

  if (kind === "badge") {
    return normalizeUiText(extra ? `${extra} \ubc30\uc9c0 \ubaa9\ud45c\uc5d0 \uac00\uae4c\uc6cc\uc9c0\ub294 \ub370 \ub3c4\uc6c0\uc774 \ub418\ub294 \ubbf8\uc158\uc774\uc5d0\uc694.` : "\ub2e4\uc74c \ubc30\uc9c0 \ubaa9\ud45c\uc640 \uc5f0\uacb0\ub418\ub294 \ubbf8\uc158\uc774\uc5d0\uc694.");
  }

  const scenario = normalizeUiText(mission.mission_json.scenario);
  return scenario
    ? normalizeUiText(`${scenario} \uc0c1\ud669\uc5d0\uc11c \uc601\uc5b4\ub97c \uc774\ud574\ud558\uace0 \ud45c\ud604\ud558\ub294 \ub370 \ub3c4\uc6c0\uc774 \ub418\ub294 \ubbf8\uc158\uc774\uc5d0\uc694.`)
    : normalizeUiText("\uc77c\uc0c1 \ub9e5\ub77d\uc5d0\uc11c \uc601\uc5b4\ub97c \uc774\ud574\ud558\uace0 \ud45c\ud604\ud558\ub294 \ub370 \ub3c4\uc6c0\uc774 \ub418\ub294 \ubbf8\uc158\uc774\uc5d0\uc694.");
}

function toRecommendation(mission: GeneratedMission, matchedTags: string[], reason: string): EnglishMissionRecommendation {
  return {
    mission,
    reason,
    matchedTags,
  };
}

function toKstDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function calculateCompletionStreak(attempts: EnglishRecommendationAttempt[]): number {
  const completedDates = Array.from(
    new Set(
      attempts
        .filter((attempt) => attempt.status === "completed")
        .map((attempt) => toKstDateKey(attempt.updated_at))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    )
  ).sort((a, b) => b.localeCompare(a));

  if (completedDates.length === 0) return 0;

  let streak = 0;
  let cursor = completedDates[0] ?? "";
  while (completedDates.includes(cursor)) {
    streak += 1;
    const base = new Date(`${cursor}T00:00:00+09:00`);
    base.setUTCDate(base.getUTCDate() - 1);
    cursor = toKstDateKey(base.toISOString());
  }

  return streak;
}

export async function getWeakestEnglishCategory(studentId: string): Promise<EnglishGrowthCategory> {
  const summary = await getEnglishGrowthSummary(studentId);
  return summary.weakestCategory;
}

function buildWeaknessRecommendations(args: {
  missions: GeneratedMission[];
  completedMissionIds: Set<string>;
  weakestCategory: EnglishGrowthCategory;
}): WeakEnglishRecommendation | null {
  const categoryLabelText = categoryLabel(args.weakestCategory);
  const recommendedMissions = args.missions
    .filter((mission) => !args.completedMissionIds.has(mission.id))
    .filter((mission) => classifyEnglishMissionCategory(mission) === args.weakestCategory)
    .sort(sortRecommendedMissions)
    .slice(0, 3)
    .map((mission) => toRecommendation(mission, missionTags(mission), buildReason("weakness", mission, categoryLabelText)));

  if (recommendedMissions.length === 0) return null;

  return {
    weakestCategory: args.weakestCategory,
    categoryLabel: categoryLabelText,
    description: normalizeUiText(`${categoryLabelText} \uc601\uc5ed\uc758 \uc131\uc7a5\uc744 \ub354 \ud655\uc7a5\ud558\ub294 \ub370 \ub3c4\uc6c0\uc774 \ub418\ub294 \ubbf8\uc158\uc744 \ubaa8\uc544 \ub4dc\ub824\uc694.`),
    recommendedMissions,
  };
}

function buildNextBadgeGoal(args: {
  missions: GeneratedMission[];
  completedMissionIds: Set<string>;
  attempts: EnglishRecommendationAttempt[];
  earnedBadgeKeys: Set<string>;
}): EnglishBadgeGoalRecommendation | null {
  const completedMissions = args.missions.filter((mission) => args.completedMissionIds.has(mission.id));
  const streakCount = calculateCompletionStreak(args.attempts);

  const candidates = BADGE_GOAL_RULES.filter((rule) => !args.earnedBadgeKeys.has(rule.key))
    .map((rule) => {
      const completedCount =
        rule.type === "streak"
          ? streakCount
          : completedMissions.filter((mission) => missionMatchesAny(mission, rule.keywords ?? [])).length;
      const remainingCount = Math.max(0, rule.targetCount - completedCount);
      const recommendedMissions = args.missions
        .filter((mission) => !args.completedMissionIds.has(mission.id))
        .filter((mission) => {
          if (rule.type === "streak") return true;
          return missionMatchesAny(mission, rule.keywords ?? []);
        })
        .sort(sortRecommendedMissions)
        .slice(0, 2)
        .map((mission) => toRecommendation(mission, missionTags(mission), buildReason("badge", mission, rule.name)));

      return {
        rule,
        completedCount,
        remainingCount,
        recommendedMissions,
      };
    })
    .filter((item) => item.remainingCount > 0)
    .sort((a, b) => a.remainingCount - b.remainingCount || b.completedCount - a.completedCount);

  const nearest = candidates[0];
  if (!nearest) return null;

  return {
    key: nearest.rule.key,
    name: nearest.rule.name,
    description: nearest.rule.description,
    category: nearest.rule.category,
    remainingCount: nearest.remainingCount,
    recommendedMissions: nearest.recommendedMissions,
  };
}

export async function getNextBadgeGoal(studentId: string): Promise<EnglishBadgeGoalRecommendation | null> {
  const [missions, attemptsRes, badgesRes] = await Promise.all([
    fetchPublishedMissions(200, "english"),
    supabase
      .from("mission_attempts")
      .select("mission_id,status,updated_at")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .returns<EnglishRecommendationAttempt[]>(),
    supabase.from("student_badges").select("badge_key").eq("student_id", studentId).eq("subject", "english").returns<Array<{ badge_key: string }>>(),
  ]);

  if (attemptsRes.error) throw attemptsRes.error;
  if (badgesRes.error) throw badgesRes.error;

  const completedMissionIds = new Set((attemptsRes.data ?? []).filter((attempt) => attempt.status === "completed").map((attempt) => attempt.mission_id));
  const earnedBadgeKeys = new Set((badgesRes.data ?? []).map((row) => row.badge_key));

  return buildNextBadgeGoal({
    missions,
    completedMissionIds,
    attempts: attemptsRes.data ?? [],
    earnedBadgeKeys,
  });
}

export async function getRecommendedEnglishMissions(studentId: string): Promise<WeakEnglishRecommendation | null> {
  const [missions, attemptsRes, weakestCategory] = await Promise.all([
    fetchPublishedMissions(200, "english"),
    supabase
      .from("mission_attempts")
      .select("mission_id,status,updated_at")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .returns<EnglishRecommendationAttempt[]>(),
    getWeakestEnglishCategory(studentId),
  ]);

  if (attemptsRes.error) throw attemptsRes.error;
  const completedMissionIds = new Set((attemptsRes.data ?? []).filter((attempt) => attempt.status === "completed").map((attempt) => attempt.mission_id));

  return buildWeaknessRecommendations({
    missions,
    completedMissionIds,
    weakestCategory,
  });
}

export async function getStudentEnglishRecommendations(studentId: string): Promise<EnglishRecommendationBundle> {
  const [profileRes, missions, attemptsRes, growthSummaryRes, badgesRes] = await Promise.all([
    supabase.from("profiles").select("interest_tags").eq("id", studentId).maybeSingle<EnglishRecommendationProfile>(),
    fetchPublishedMissions(200, "english"),
    supabase
      .from("mission_attempts")
      .select("mission_id,status,updated_at")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .returns<EnglishRecommendationAttempt[]>(),
    getEnglishGrowthSummary(studentId),
    supabase.from("student_badges").select("badge_key").eq("student_id", studentId).eq("subject", "english").returns<Array<{ badge_key: string }>>(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (attemptsRes.error) throw attemptsRes.error;
  if (badgesRes.error) throw badgesRes.error;

  const interestTags = normalizeInterestTagSelection(profileRes.data?.interest_tags);
  const interestTagSet = new Set(interestTags.map(normalizeTag));
  const englishMissionIds = new Set(missions.map((mission) => mission.id));
  const attempts = (attemptsRes.data ?? []).filter((attempt) => englishMissionIds.has(attempt.mission_id));
  const recentMissionIds = new Set(uniqueRecentMissionIds(attempts).slice(0, 6));
  const completedMissionIds = new Set(attempts.filter((attempt) => attempt.status === "completed").map((attempt) => attempt.mission_id));
  const inProgressMissionIds = new Set(attempts.filter((attempt) => attempt.status === "started").map((attempt) => attempt.mission_id));
  const earnedBadgeKeys = new Set((badgesRes.data ?? []).map((row) => row.badge_key));

  const ranked = missions
    .filter((mission) => !recentMissionIds.has(mission.id))
    .map((mission) => {
      const matchedTags = missionTags(mission).filter((tag) => interestTagSet.has(normalizeTag(tag)));
      let score = 0;
      if (matchedTags.length > 0) score += 20;
      if (!completedMissionIds.has(mission.id)) score += 10;
      if (inProgressMissionIds.has(mission.id)) score += 8;
      if (mission.difficulty === "easy") score += 4;
      return { mission, matchedTags, score };
    })
    .sort((a, b) => b.score - a.score || Date.parse(b.mission.created_at) - Date.parse(a.mission.created_at));

  const startNowBase = ranked.find((item) => !completedMissionIds.has(item.mission.id)) ?? ranked[0] ?? null;
  const review = ranked
    .filter((item) => completedMissionIds.has(item.mission.id))
    .slice(0, 3)
    .map((item) => toRecommendation(item.mission, item.matchedTags, buildReason("review", item.mission)));
  const interest = ranked
    .filter((item) => item.matchedTags.length > 0)
    .slice(0, 3)
    .map((item) => toRecommendation(item.mission, item.matchedTags, buildReason("interest", item.mission)));

  return {
    startNow: startNowBase ? toRecommendation(startNowBase.mission, startNowBase.matchedTags, buildReason("start", startNowBase.mission)) : null,
    review,
    interest,
    weaknessFocus: buildWeaknessRecommendations({
      missions,
      completedMissionIds,
      weakestCategory: growthSummaryRes.weakestCategory,
    }),
    nextBadgeGoal: buildNextBadgeGoal({
      missions,
      completedMissionIds,
      attempts,
      earnedBadgeKeys,
    }),
  };
}
