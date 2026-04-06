import { classifyEnglishMissionCategory, getEnglishGrowthSummary, type EnglishGrowthCategory } from "@/lib/englishGrowth";
import { getNextBadgeGoal } from "@/lib/englishRecommendations";
import { fetchPublishedMissions } from "@/lib/missions";
import { supabase } from "@/lib/supabaseClient";
import type { GeneratedMission } from "@/types/missions";

type DailyLearningAttempt = {
  mission_id: string;
  status: "started" | "completed" | "abandoned";
  updated_at: string;
  completed_at?: string | null;
};

type DailyLearningLogRow = {
  id: string;
  student_id: string;
  subject: string;
  log_date: string;
  pack_payload: DailyLearningPackPayload;
  completed_steps: number;
  total_steps: number;
  created_at: string;
  updated_at: string;
};

type DailyLearningPackPayload = {
  warmupMissionId: string | null;
  coreMissionId: string | null;
  challengeMissionId: string | null;
};

export type DailyLearningStepType = "warmup" | "core" | "challenge";

export type DailyLearningPackStep = {
  type: DailyLearningStepType;
  label: string;
  description: string;
  xpReward: number;
  mission: GeneratedMission | null;
  completed: boolean;
};

export type DailyLearningPack = {
  date: string;
  warmup: DailyLearningPackStep;
  core: DailyLearningPackStep;
  challenge: DailyLearningPackStep;
  completedSteps: number;
  totalSteps: number;
  totalXp: number;
  estimatedTime: number;
  nextMissionId: string | null;
};

const TOTAL_STEPS = 3;
const TOTAL_XP = 30;
const STEP_XP: Record<DailyLearningStepType, number> = {
  warmup: 5,
  core: 10,
  challenge: 15,
};

const STEP_LABELS: Record<DailyLearningStepType, string> = {
  warmup: "\uc6cc\ubc0d\uc5c5",
  core: "\ud575\uc2ec \uc131\uc7a5",
  challenge: "\ub3c4\uc804",
};

const STEP_DESCRIPTIONS: Record<DailyLearningStepType, string> = {
  warmup: "\ubd80\ub2f4 \uc5c6\uc774 \ud750\ub984\uc744 \uc5ec\ub294 \uc2dc\uc791 \ubbf8\uc158\uc774\uc5d0\uc694.",
  core: "\uc9c0\uae08 \uc131\uc7a5\uc5d0 \uac00\uc7a5 \uc911\uc694\ud55c \uc601\uc5b4 \ud559\uc2b5\uc774\uc5d0\uc694.",
  challenge: "\ub2e4\uc74c \ub2e8\uacc4 \uc131\uc7a5\uacfc \ubc30\uc9c0 \ubaa9\ud45c\ub97c \uc5f0\uacb0\ud558\ub294 \ub3c4\uc804 \ubbf8\uc158\uc774\uc5d0\uc694.",
};

function toKstDateKey(value = new Date().toISOString()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function difficultyRank(difficulty: GeneratedMission["difficulty"]): number {
  if (difficulty === "easy") return 0;
  if (difficulty === "normal") return 1;
  if (difficulty === "hard") return 2;
  return 3;
}

function sortByDifficultyThenRecent(a: GeneratedMission, b: GeneratedMission): number {
  return difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || Date.parse(b.created_at) - Date.parse(a.created_at);
}

function isMissingDailyLearningTable(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  return code === "42P01" || message.includes("daily_learning_logs");
}

function pickFirstMission(
  missions: GeneratedMission[],
  usedMissionIds: Set<string>,
  predicate: (mission: GeneratedMission) => boolean
): GeneratedMission | null {
  return missions.find((mission) => !usedMissionIds.has(mission.id) && predicate(mission)) ?? null;
}

async function getAttemptRows(studentId: string): Promise<DailyLearningAttempt[]> {
  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("mission_id,status,updated_at,completed_at")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false })
    .returns<DailyLearningAttempt[]>();

  if (attemptsRes.error) throw attemptsRes.error;
  return attemptsRes.data ?? [];
}

function getRecentCategoryOrder(missions: GeneratedMission[], attempts: DailyLearningAttempt[]): EnglishGrowthCategory[] {
  const missionMap = new Map(missions.map((mission) => [mission.id, mission] as const));
  const lastPlayedAt = new Map<EnglishGrowthCategory, string>();

  for (const attempt of attempts) {
    const mission = missionMap.get(attempt.mission_id);
    if (!mission) continue;
    const category = classifyEnglishMissionCategory(mission);
    if (!lastPlayedAt.has(category)) {
      lastPlayedAt.set(category, attempt.updated_at);
    }
  }

  return (["conversation", "grammar", "reading", "expression"] as EnglishGrowthCategory[]).sort((a, b) => {
    const timeA = lastPlayedAt.get(a);
    const timeB = lastPlayedAt.get(b);
    if (!timeA && !timeB) return 0;
    if (!timeA) return -1;
    if (!timeB) return 1;
    return timeA.localeCompare(timeB);
  });
}

function buildPackFromPayload(args: {
  payload: DailyLearningPackPayload;
  missions: GeneratedMission[];
  completedMissionIds: Set<string>;
}): DailyLearningPack {
  const missionMap = new Map(args.missions.map((mission) => [mission.id, mission] as const));
  const createStep = (type: DailyLearningStepType, missionId: string | null): DailyLearningPackStep => {
    const mission = missionId ? missionMap.get(missionId) ?? null : null;
    return {
      type,
      label: STEP_LABELS[type],
      description: STEP_DESCRIPTIONS[type],
      xpReward: STEP_XP[type],
      mission,
      completed: mission ? args.completedMissionIds.has(mission.id) : false,
    };
  };

  const warmup = createStep("warmup", args.payload.warmupMissionId);
  const core = createStep("core", args.payload.coreMissionId);
  const challenge = createStep("challenge", args.payload.challengeMissionId);
  const steps = [warmup, core, challenge];
  const completedSteps = steps.filter((step) => step.completed).length;
  const estimatedTime = steps.reduce((sum, step) => sum + (step.mission?.estimated_minutes ?? 0), 0);
  const nextMissionId = steps.find((step) => step.mission && !step.completed)?.mission?.id ?? null;

  return {
    date: toKstDateKey(),
    warmup,
    core,
    challenge,
    completedSteps,
    totalSteps: TOTAL_STEPS,
    totalXp: TOTAL_XP,
    estimatedTime: Math.max(5, Math.min(18, estimatedTime || 8)),
    nextMissionId,
  };
}

async function generatePackPayload(studentId: string): Promise<DailyLearningPackPayload> {
  const [missions, attempts, growthSummary, nextBadgeGoal] = await Promise.all([
    fetchPublishedMissions(200, "english"),
    getAttemptRows(studentId),
    getEnglishGrowthSummary(studentId),
    getNextBadgeGoal(studentId),
  ]);

  const completedMissionIds = new Set(attempts.filter((attempt) => attempt.status === "completed").map((attempt) => attempt.mission_id));
  const usedMissionIds = new Set<string>();
  const categoryOrder = getRecentCategoryOrder(missions, attempts);
  const weakestCategory = growthSummary.weakestCategory;

  const sortedMissions = missions.slice().sort(sortByDifficultyThenRecent);

  const warmup =
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => mission.difficulty === "easy" && categoryOrder.some((category) => category === classifyEnglishMissionCategory(mission)) && !completedMissionIds.has(mission.id) && classifyEnglishMissionCategory(mission) === categoryOrder[0]) ??
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => mission.difficulty === "easy" && !completedMissionIds.has(mission.id)) ??
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id));
  if (warmup) usedMissionIds.add(warmup.id);

  const core =
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id) && classifyEnglishMissionCategory(mission) === weakestCategory) ??
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id) && mission.difficulty !== "challenge") ??
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id));
  if (core) usedMissionIds.add(core.id);

  const badgeMissionIds = new Set((nextBadgeGoal?.recommendedMissions ?? []).map((item) => item.mission.id));
  const challenge =
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id) && badgeMissionIds.has(mission.id) && difficultyRank(mission.difficulty) >= 1) ??
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id) && classifyEnglishMissionCategory(mission) === weakestCategory && difficultyRank(mission.difficulty) >= 1) ??
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id) && difficultyRank(mission.difficulty) >= 1) ??
    pickFirstMission(sortedMissions, usedMissionIds, (mission) => !completedMissionIds.has(mission.id));

  return {
    warmupMissionId: warmup?.id ?? null,
    coreMissionId: core?.id ?? null,
    challengeMissionId: challenge?.id ?? null,
  };
}

async function readTodayLog(studentId: string, todayKey: string): Promise<DailyLearningLogRow | null> {
  const logRes = await supabase
    .from("daily_learning_logs")
    .select("id,student_id,subject,log_date,pack_payload,completed_steps,total_steps,created_at,updated_at")
    .eq("student_id", studentId)
    .eq("subject", "english")
    .eq("log_date", todayKey)
    .maybeSingle<DailyLearningLogRow>();

  if (logRes.error) {
    if (isMissingDailyLearningTable(logRes.error)) return null;
    throw logRes.error;
  }

  return logRes.data ?? null;
}

async function saveTodayLog(args: { studentId: string; todayKey: string; payload: DailyLearningPackPayload; completedSteps: number }): Promise<void> {
  const upsertRes = await supabase.from("daily_learning_logs").upsert(
    {
      student_id: args.studentId,
      subject: "english",
      log_date: args.todayKey,
      pack_payload: args.payload,
      completed_steps: args.completedSteps,
      total_steps: TOTAL_STEPS,
    },
    {
      onConflict: "student_id,subject,log_date",
    }
  );

  if (upsertRes.error && !isMissingDailyLearningTable(upsertRes.error)) {
    throw upsertRes.error;
  }
}

export async function createDailyLearningPack(studentId: string): Promise<DailyLearningPack> {
  const todayKey = toKstDateKey();
  const [missions, attempts, existingLog] = await Promise.all([
    fetchPublishedMissions(200, "english"),
    getAttemptRows(studentId),
    readTodayLog(studentId, todayKey),
  ]);

  const completedMissionIds = new Set(attempts.filter((attempt) => attempt.status === "completed").map((attempt) => attempt.mission_id));

  if (existingLog?.pack_payload) {
    const pack = buildPackFromPayload({
      payload: existingLog.pack_payload,
      missions,
      completedMissionIds,
    });

    if (existingLog.completed_steps !== pack.completedSteps) {
      await saveTodayLog({
        studentId,
        todayKey,
        payload: existingLog.pack_payload,
        completedSteps: pack.completedSteps,
      });
    }

    return pack;
  }

  const payload = await generatePackPayload(studentId);
  const pack = buildPackFromPayload({
    payload,
    missions,
    completedMissionIds,
  });

  await saveTodayLog({
    studentId,
    todayKey,
    payload,
    completedSteps: pack.completedSteps,
  });

  return pack;
}
