import { supabase } from "@/lib/supabaseClient";
import type { GeneratedMission } from "@/types/missions";

export type EnglishGrowthCategory = "conversation" | "grammar" | "reading" | "expression";

export type EnglishGrowthMetric = {
  category: EnglishGrowthCategory;
  label: string;
  score: number;
  level: number;
  completedMissionCount: number;
  guidance: string;
};

export type EnglishGrowthSummary = {
  metrics: Record<EnglishGrowthCategory, EnglishGrowthMetric>;
  orderedMetrics: EnglishGrowthMetric[];
  weakestCategory: EnglishGrowthCategory;
  strongestCategory: EnglishGrowthCategory;
  updatedAt: string;
};

type CompletedEnglishGrowthMission = Pick<GeneratedMission, "id" | "title" | "difficulty" | "interest_tags" | "mission_json"> & {
  completedAt: string;
};

const CATEGORY_ORDER: EnglishGrowthCategory[] = ["conversation", "grammar", "reading", "expression"];

const CATEGORY_LABELS: Record<EnglishGrowthCategory, string> = {
  conversation: "\ud68c\ud654",
  grammar: "\ubb38\ubc95",
  reading: "\uc77d\uae30",
  expression: "\ud45c\ud604",
};

const CATEGORY_GUIDANCE: Record<EnglishGrowthCategory, string[]> = {
  conversation: [
    "\ub300\ud654\ud615 \uc601\uc5b4 \ud45c\ud604\uc758 \uae30\ubcf8 \ud750\ub984\uc774 \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\uc778\uc0ac\uc640 \uc9c8\ubb38 \uc751\ub2f5\uc758 \ud65c\uc6a9 \ud3ed\uc774 \uc810\ucc28 \ud655\uc7a5\ub418\uace0 \uc788\uc5b4\uc694.",
    "\uc77c\uc0c1 \ub300\ud654\ub97c \uc774\ud574\ud558\uace0 \uc774\uc5b4 \uac00\ub294 \uac10\uac01\uc774 \uc548\uc815\uc801\uc73c\ub85c \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\ud68c\ud654 \ud45c\ud604\uc744 \uc120\ud0dd\ud558\uace0 \uc5f0\uacb0\ud558\ub294 \ud798\uc774 \ud55c\uce35 \uac15\ud654\ub418\uace0 \uc788\uc5b4\uc694.",
    "\ud68c\ud654 \ud45c\ud604\uc744 \uc0c1\ud669\uc5d0 \ub9de\uac8c \ud65c\uc6a9\ud558\ub294 \uc5ed\ub7c9\uc774 \ub69c\ub837\ud558\uac8c \uc131\uc7a5\ud588\uc5b4\uc694.",
  ],
  grammar: [
    "\ubb38\uc7a5 \uad6c\uc870\ub97c \uc774\ud574\ud558\ub294 \uae30\ucd08 \uac10\uac01\uc774 \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\uc2dc\uc81c\uc640 \ud45c\ud604 \uaddc\uce59\uc744 \uad6c\ubd84\ud558\ub294 \ud798\uc774 \uc810\ucc28 \uac15\ud654\ub418\uace0 \uc788\uc5b4\uc694.",
    "\ubb38\ubc95 \ud3ec\uc778\ud2b8\ub97c \ubb38\uc7a5\uc5d0 \uc5f0\uacb0\ud558\ub294 \ud65c\uc6a9\ub825\uc774 \uc548\uc815\uc801\uc73c\ub85c \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\ubb38\ubc95 \uac1c\ub150\uc744 \ube44\uad50\ud558\uace0 \uc801\uc6a9\ud558\ub294 \ud310\ub2e8\ub825\uc774 \ubd84\uba85\ud558\uac8c \ud655\uc7a5\ub418\uace0 \uc788\uc5b4\uc694.",
    "\ubb38\uc7a5 \uad6c\uc131\uc744 \uc870\uc808\ud558\ub294 \ubb38\ubc95 \ud65c\uc6a9 \uc5ed\ub7c9\uc774 \ud0c4\ud0c4\ud558\uac8c \uac15\ud654\ub418\uc5c8\uc5b4\uc694.",
  ],
  reading: [
    "\uc9e7\uc740 \uae00\uacfc \uc548\ub0b4\ubb38\uc744 \uc774\ud574\ud558\ub294 \uc77d\uae30 \uac10\uac01\uc774 \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\uc7a5\uc18c, \uc2dc\uac04, \uc815\ubcf4\ub97c \uc77d\uc5b4 \ub0b4\ub294 \uc774\ud574 \ubc94\uc704\uac00 \uc810\ucc28 \ud655\uc7a5\ub418\uace0 \uc788\uc5b4\uc694.",
    "\ud544\uc694\ud55c \uc815\ubcf4\ub97c \ube60\ub974\uac8c \ud30c\uc545\ud558\ub294 \uc77d\uae30 \ud750\ub984\uc774 \uc548\uc815\uc801\uc73c\ub85c \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\uc548\ub0b4\ubb38\uacfc \uc124\uba85\ubb38\uc5d0\uc11c \ud575\uc2ec\uc744 \ucc3e\ub294 \uc774\ud574\ub825\uc774 \ub69c\ub837\ud558\uac8c \uac15\ud654\ub418\uace0 \uc788\uc5b4\uc694.",
    "\uc77d\uae30 \uc774\ud574\ub97c \ubc14\ud0d5\uc73c\ub85c \uc815\ubcf4\ub97c \uc815\ub9ac\ud558\ub294 \uc5ed\ub7c9\uc774 \ud0c4\ud0c4\ud558\uac8c \uc131\uc7a5\ud588\uc5b4\uc694.",
  ],
  expression: [
    "\uc0dd\uac01\uacfc \uc774\uc720\ub97c \uc601\uc5b4\ub85c \uc815\ub9ac\ud558\ub294 \ud45c\ud604 \uac10\uac01\uc774 \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\uc758\uacac\uacfc \uc774\uc720\ub97c \ud568\uaed8 \uc804\ud558\ub294 \ud45c\ud604 \uad6c\uc870\uac00 \uc810\ucc28 \uac15\ud654\ub418\uace0 \uc788\uc5b4\uc694.",
    "\uc790\uae30 \uc0dd\uac01\uc744 \ubb38\uc7a5\uc73c\ub85c \uc5f0\uacb0\ud558\ub294 \ud45c\ud604\ub825\uc774 \uc548\uc815\uc801\uc73c\ub85c \uc131\uc7a5 \uc911\uc774\uc5d0\uc694.",
    "\uc758\uacac \ud45c\ud604\uacfc \ubc1c\ud45c\ud615 \uc601\uc5b4\ub97c \uad6c\uc131\ud558\ub294 \ud798\uc774 \ud55c\uce35 \ud655\uc7a5\ub418\uace0 \uc788\uc5b4\uc694.",
    "\uc0dd\uac01\uc744 \uc601\uc5b4\ub85c \uc124\ub4dd\ub825 \uc788\uac8c \uc804\ud558\ub294 \ud45c\ud604 \uc5ed\ub7c9\uc774 \ub69c\ub837\ud558\uac8c \uac15\ud654\ub418\uc5c8\uc5b4\uc694.",
  ],
};

const CATEGORY_KEYWORDS: Record<EnglishGrowthCategory, string[]> = {
  conversation: ["greeting", "intro", "conversation", "hobby", "question", "self_expression", "dialogue", "talk", "\uc778\uc0ac", "\uc790\uae30\uc18c\uac1c", "\ub300\ud654", "\uc9c8\ubb38"],
  grammar: ["grammar", "comparative", "present_progressive", "past", "should", "must", "can", "sentence", "tense", "be verb", "\ubb38\ubc95", "\ube44\uad50\uae09", "\uc2dc\uc81c"],
  reading: ["reading", "notice", "place", "time", "information", "comprehension", "read", "\uc548\ub0b4\ubb38", "\uc77d\uae30", "\uc815\ubcf4", "\uc7a5\uc18c", "\uc2dc\uac04"],
  expression: ["opinion", "because", "discussion", "presentation", "career", "think", "express", "\uc758\uacac", "\uc774\uc720", "\ud45c\ud604", "\ubc1c\ud45c", "\uc9c4\ub85c"],
};

function getCurrentStudentIdFromAuthUser(): Promise<string> {
  return supabase.auth.getUser().then(({ data, error }) => {
    if (error) throw error;
    if (!data.user) throw new Error("\ub85c\uadf8\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.");
    return data.user.id;
  });
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

function difficultyScore(difficulty: GeneratedMission["difficulty"]): number {
  if (difficulty === "hard" || difficulty === "challenge") return 20;
  if (difficulty === "normal") return 15;
  return 10;
}

function scoreToLevel(score: number): number {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

async function getCompletedEnglishMissions(studentId: string): Promise<CompletedEnglishGrowthMission[]> {
  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("mission_id,completed_at")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .returns<Array<{ mission_id: string; completed_at: string }>>();
  if (attemptsRes.error) throw attemptsRes.error;

  const latestAttemptByMissionId = new Map<string, string>();
  for (const row of attemptsRes.data ?? []) {
    const current = latestAttemptByMissionId.get(row.mission_id);
    if (!current || row.completed_at > current) {
      latestAttemptByMissionId.set(row.mission_id, row.completed_at);
    }
  }

  const missionIds = Array.from(latestAttemptByMissionId.keys());
  if (missionIds.length === 0) return [];

  const missionsRes = await supabase
    .from("generated_missions")
    .select("id,title,difficulty,interest_tags,mission_json")
    .eq("subject", "english")
    .in("id", missionIds)
    .returns<Array<Pick<GeneratedMission, "id" | "title" | "difficulty" | "interest_tags" | "mission_json">>>();
  if (missionsRes.error) throw missionsRes.error;

  return (missionsRes.data ?? []).map((mission) => ({
    ...mission,
    completedAt: latestAttemptByMissionId.get(mission.id) ?? new Date().toISOString(),
  }));
}

export function classifyEnglishMissionCategory(mission: Pick<GeneratedMission, "title" | "interest_tags" | "mission_json">): EnglishGrowthCategory {
  const source = missionKeywordSource(mission);
  let bestCategory: EnglishGrowthCategory = "conversation";
  let bestScore = -1;

  for (const category of CATEGORY_ORDER) {
    const score = CATEGORY_KEYWORDS[category].reduce((count, keyword) => count + (source.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

export function calculateEnglishGrowthSummaryFromMissions(missions: CompletedEnglishGrowthMission[]): EnglishGrowthSummary {
  const metrics = {
    conversation: { category: "conversation", label: CATEGORY_LABELS.conversation, score: 0, level: 1, completedMissionCount: 0, guidance: CATEGORY_GUIDANCE.conversation[0] },
    grammar: { category: "grammar", label: CATEGORY_LABELS.grammar, score: 0, level: 1, completedMissionCount: 0, guidance: CATEGORY_GUIDANCE.grammar[0] },
    reading: { category: "reading", label: CATEGORY_LABELS.reading, score: 0, level: 1, completedMissionCount: 0, guidance: CATEGORY_GUIDANCE.reading[0] },
    expression: { category: "expression", label: CATEGORY_LABELS.expression, score: 0, level: 1, completedMissionCount: 0, guidance: CATEGORY_GUIDANCE.expression[0] },
  } satisfies Record<EnglishGrowthCategory, EnglishGrowthMetric>;

  for (const mission of missions) {
    const category = classifyEnglishMissionCategory(mission);
    metrics[category].score = Math.min(100, metrics[category].score + difficultyScore(mission.difficulty));
    metrics[category].completedMissionCount += 1;
  }

  for (const category of CATEGORY_ORDER) {
    const metric = metrics[category];
    metric.level = scoreToLevel(metric.score);
    const guidanceIndex = Math.max(0, Math.min(CATEGORY_GUIDANCE[category].length - 1, metric.level - 1));
    metric.guidance = CATEGORY_GUIDANCE[category][guidanceIndex] ?? CATEGORY_GUIDANCE[category][0];
  }

  const orderedMetrics = CATEGORY_ORDER.map((category) => metrics[category]);
  const weakestCategory = orderedMetrics.slice().sort((a, b) => a.score - b.score)[0]?.category ?? "conversation";
  const strongestCategory = orderedMetrics.slice().sort((a, b) => b.score - a.score)[0]?.category ?? "conversation";

  return {
    metrics,
    orderedMetrics,
    weakestCategory,
    strongestCategory,
    updatedAt: new Date().toISOString(),
  };
}

export async function getEnglishGrowthSummary(studentId?: string): Promise<EnglishGrowthSummary> {
  const resolvedStudentId = studentId ?? (await getCurrentStudentIdFromAuthUser());
  const missions = await getCompletedEnglishMissions(resolvedStudentId);
  return calculateEnglishGrowthSummaryFromMissions(missions);
}
