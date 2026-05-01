import { getEffectiveSchoolGrade, toCurriculumGradeNumber } from "@/lib/academicYear";
import {
  fetchCurriculumUnitsBySubject,
  fetchMissionById,
  fetchMissionProgressMap,
  fetchPublishedMissions,
} from "@/lib/missions";
import type { MissionProgressSummary } from "@/lib/missions";
import { supabase } from "@/lib/supabaseClient";
import type { GeneratedMission } from "@/types/missions";

export { buildRecommendationHref } from "@/lib/recommendationNavigation";

type RecommendationRow = Record<string, unknown> & { priority?: number };
type SupportedSubject = "math" | "english";
type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type RecommendationSelectionReason = "today" | "first_incomplete" | "previous_incomplete" | "completed_week";
type RecommendationStatus = "today" | "ready" | "completed" | "locked";

type StudentWeeklyPathRow = {
  id: string;
  student_id: string;
  subject: SupportedSubject;
  week_key: number;
  path_key: string;
  created_at: string | null;
};

const WEEKDAY_ITEMS: Array<{ key: WeekdayKey; labelKo: string; labelEn: string }> = [
  { key: "mon", labelKo: "월", labelEn: "Mon" },
  { key: "tue", labelKo: "화", labelEn: "Tue" },
  { key: "wed", labelKo: "수", labelEn: "Wed" },
  { key: "thu", labelKo: "목", labelEn: "Thu" },
  { key: "fri", labelKo: "금", labelEn: "Fri" },
];

const TARGET_DIFFICULTIES: GeneratedMission["difficulty"][] = ["easy", "easy", "normal", "normal", "hard"];
const TARGET_REWARD_XP = [10, 12, 18, 22, 30];

const ENGLISH_PRIORITY_UNIT_KEYS_BY_GRADE: Record<number, string[]> = {
  4: ["elem-eng-school-locations"],
  5: ["elem-eng-food-ordering"],
  6: ["elem-eng-digital-safety"],
  7: ["mid-eng-careers-interests"],
  8: ["mid-eng-collaboration-problem-solving"],
  9: ["mid-eng-social-issues-opinion"],
};

export type WeeklyLearningPathStep = {
  subject: SupportedSubject;
  missionId: string;
  stepOrder: number;
  weekdayKey: WeekdayKey;
  weekdayLabel: string;
  title: string;
  cleanedTitle: string;
  unitId: string | null;
  unitName: string;
  difficulty: GeneratedMission["difficulty"];
  estimatedMinutes: number;
  rewardXp: number;
  recommendationReason: string;
  dailyConnection: string;
  examConnection: string;
  thinkingConnection: string;
  mission: GeneratedMission | null;
  progress: MissionProgressSummary | null;
  completed: boolean;
  inProgress: boolean;
  isScheduledToday: boolean;
  isRecommendedToday: boolean;
  isLocked: boolean;
  status: RecommendationStatus;
  lockReason: string | null;
};

export type WeeklyLearningPathResult = {
  subject: SupportedSubject;
  pathKey: string | null;
  weekKey: number;
  nextPathKey: string | null;
  rotatedFromPathKey: string | null;
  completionMessage: string | null;
  steps: WeeklyLearningPathStep[];
  todayStepOrder: number | null;
  todayStepIndex: number;
  recommendedIndex: number;
  completedCount: number;
  hasData: boolean;
};

export type TodayLearningRecommendation = {
  step: WeeklyLearningPathStep;
  selectionReason: RecommendationSelectionReason;
};

export type WeeklyMathPathStep = WeeklyLearningPathStep;
export type WeeklyMathPathResult = WeeklyLearningPathResult;
export type TodayMathRecommendation = TodayLearningRecommendation;
export type WeeklyEnglishPathStep = WeeklyLearningPathStep;
export type WeeklyEnglishPathResult = WeeklyLearningPathResult;
export type TodayEnglishRecommendation = TodayLearningRecommendation;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

function isMissingRelationError(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    error?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

function toKstDate(date = new Date()): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function toDbSchoolLevel(profileLevel: string): string {
  const map: Record<string, string> = {
    elem: "elementary",
    mid: "middle",
    high: "high",
  };
  return map[profileLevel] ?? profileLevel;
}

function toDbGrade(_profileLevel: string, profileGrade: number): number {
  // curriculum_units.grade is now school-level relative across the board (elementary 3–6,
  // middle 1–3, high 1–2), so we pass profile grade through. The (school_level, grade)
  // pair is what disambiguates the bucket.
  return profileGrade;
}

function getWeekdayItem(stepOrder: number): { key: WeekdayKey; labelKo: string; labelEn: string } {
  return WEEKDAY_ITEMS[Math.max(0, Math.min(WEEKDAY_ITEMS.length - 1, stepOrder - 1))] ?? WEEKDAY_ITEMS[0]!;
}

function getTodayStepOrder(date = new Date()): number | null {
  const day = toKstDate(date).getDay();
  if (day >= 1 && day <= 5) return day;
  return null;
}

function getWeekKey(date = new Date()): number {
  const kst = toKstDate(date);
  const target = new Date(Date.UTC(kst.getFullYear(), kst.getMonth(), kst.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return target.getUTCFullYear() * 100 + weekNo;
}

function missionXpForDifficulty(value: GeneratedMission["difficulty"]): number {
  return value === "hard" || value === "challenge" ? 15 : 10;
}

function difficultyFallbackForStep(stepOrder: number): GeneratedMission["difficulty"] {
  return TARGET_DIFFICULTIES[Math.max(0, Math.min(TARGET_DIFFICULTIES.length - 1, stepOrder - 1))] ?? "normal";
}

function difficultyOrder(value: GeneratedMission["difficulty"]): number {
  if (value === "easy") return 0;
  if (value === "normal") return 1;
  return 2;
}

function sanitizeRecommendationTitle(title: string): string {
  const patterns = [
    /^\s*[\[(]?\s*(월|화|수|목|금)\s*[\])\-:|]?\s*/i,
    /^\s*[\[(]?\s*(Monday|Tuesday|Wednesday|Thursday|Friday)\s*[\])\-:|]?\s*/i,
    /^\s*[\[(]?\s*(Mon|Tue|Wed|Thu|Fri)\s*[\])\-:|]?\s*/i,
  ];

  let sanitized = title.trim();
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, "").trim();
  }

  return sanitized || title.trim();
}

function difficultyFocusLine(subject: SupportedSubject, difficulty: GeneratedMission["difficulty"]): string {
  if (subject === "english") {
    if (difficulty === "easy") return "기초 표현과 어휘를 익히는";
    if (difficulty === "normal") return "문맥을 파악해 활용하는";
    return "다양한 정보를 조합해 표현하는";
  }

  if (difficulty === "easy") return "기초 개념을 다시 짚어보는";
  if (difficulty === "normal") return "조건을 분석하고 식을 세우는";
  return "다양한 조건을 종합해 판단하는";
}

function buildReasonSummary(subject: SupportedSubject, unitName: string, mission: GeneratedMission | null): string {
  const concept = mission?.mission_json.mainConcept?.trim();
  const difficulty = mission?.difficulty ?? "normal";
  const focus = difficultyFocusLine(subject, difficulty);

  if (concept) return `오늘은 ${unitName}에서 ${concept}을 중심으로 ${focus} 문제예요.`;
  return `오늘은 ${unitName}에서 ${focus} ${subject === "english" ? "영어" : "수학"} 문제예요.`;
}

function buildDailyConnection(subject: SupportedSubject, unitName: string, mission: GeneratedMission | null): string {
  const scenario = mission?.mission_json.scenario?.trim();
  if (scenario) return scenario.length > 90 ? `${scenario.slice(0, 90).trimEnd()}...` : scenario;

  if (subject === "english") {
    return `${unitName}에서 배운 표현을 실제 대화 상황으로 익혀보는 문제예요.`;
  }

  return `${unitName} 개념을 실제 문제 상황과 연결해서 풀어보는 문제예요.`;
}

function buildExamConnection(subject: SupportedSubject, mission: GeneratedMission | null): string {
  const concept = mission?.mission_json.mainConcept?.trim();
  if (subject === "english") {
    if (concept) return `${concept}을 활용한 독해와 표현 문제에서 자주 나오도록 익혀두면 좋아요.`;
    return "시험에서는 실제 표현을 정확히 읽고 맥락에 맞게 쓰는 능력을 평가해요.";
  }

  if (concept) return `${concept}은 시험 문제에서 자주 나오는 유형으로 풀어두면 좋아요.`;
  return "시험에서 자주 나오는 유형과 패턴을 다시 한번 정리해볼게요.";
}

function buildThinkingConnection(subject: SupportedSubject, mission: GeneratedMission | null): string {
  const difficulty = mission?.difficulty ?? "normal";

  if (subject === "english") {
    if (difficulty === "easy") return "짧은 표현도 정확한 문장으로 만들어 가는 연습이 돼요.";
    if (difficulty === "normal") return "문맥을 파악하고 판단하는 능력으로 표현력이 한 단계 올라가요.";
    return "다양한 정보를 조합해서 논리적으로 표현하는 능력을 길러요.";
  }

  if (difficulty === "easy") return "기초 개념을 정확히 이해하고 식을 세우는 능력을 길러요.";
  if (difficulty === "normal") return "조건을 분석하고 식을 세우는 능력을 길러요.";
  return "다양한 조건을 종합해 판단하고 풀어가는 능력을 길러요.";
}

async function resolveCurriculumGrade(studentId: string, grade?: number | null): Promise<number | null> {
  if (typeof grade === "number" && Number.isFinite(grade)) return grade;

  const profileRes = await supabase
    .from("profiles")
    .select("school_level,grade")
    .eq("id", studentId)
    .maybeSingle<{ school_level: "elementary" | "middle" | "high" | null; grade: number | null }>();

  if (profileRes.error) throw profileRes.error;

  const effectiveGrade = getEffectiveSchoolGrade(profileRes.data?.school_level ?? null, profileRes.data?.grade ?? null);
  return effectiveGrade ? toCurriculumGradeNumber(effectiveGrade.schoolLevel, effectiveGrade.grade) : null;
}

function normalizeRecommendationRows(rows: RecommendationRow[], studentId: string, subject: SupportedSubject, grade: number | null): RecommendationRow[] {
  return rows.filter((row) => {
    const isActive = asBoolean(row.is_active);
    if (isActive === false) return false;

    const rowSubject = asString(row.subject);
    if (rowSubject && rowSubject !== subject) return false;

    const rowStudentId = asString(row.student_id) ?? asString(row.user_id);
    if (rowStudentId && rowStudentId !== studentId) return false;

    const rowGrade = asNumber(row.grade) ?? asNumber(row.curriculum_grade) ?? asNumber(row.target_grade);
    if (rowGrade !== null && grade !== null && rowGrade !== grade) return false;

    return true;
  });
}

async function loadLearningPathRows(
  studentId: string,
  subject: SupportedSubject,
  grade?: number | null
): Promise<RecommendationRow[]> {
  // profiles에서 직접 school_level + grade 가져오기
  const profileRes = await supabase
    .from("profiles")
    .select("school_level, grade")
    .eq("id", studentId)
    .maybeSingle<{ school_level: string | null; grade: number | null }>();

  if (profileRes.error) throw profileRes.error;

  const profileLevel = profileRes.data?.school_level ?? null;
  const profileGrade = profileRes.data?.grade ?? null;

  // DB 컨벤션으로 변환
  const dbLevel = profileLevel ? toDbSchoolLevel(profileLevel) : null;
  const dbGrade =
    dbLevel && profileGrade !== null ? toDbGrade(dbLevel, profileGrade) : null;

  // curriculumGrade는 grade prop 우선, 없으면 변환값 사용
  const curriculumGrade = grade ?? dbGrade;

  let query = supabase
    .from("learning_path_recommendations")
    .select("*")
    .eq("subject", subject)
    .eq("is_active", true);

  if (dbLevel !== null) {
    query = query.eq("school_level", dbLevel); // ← 핵심 추가
  }

  if (curriculumGrade !== null) {
    query = query.eq("grade", curriculumGrade);
  }

  const rowsRes = (await query) as {
    data: RecommendationRow[] | null;
    error: { message: string; code?: string } | null;
  };

  if (rowsRes.error) {
    if (isMissingRelationError(rowsRes.error)) return [];
    throw rowsRes.error;
  }

  return normalizeRecommendationRows(rowsRes.data ?? [], studentId, subject, curriculumGrade);
}

function extractMissionId(row: RecommendationRow): string | null {
  return asString(row.mission_id) ?? asString(row.recommended_mission_id) ?? asString(row.generated_mission_id);
}

function extractStepOrder(row: RecommendationRow): number | null {
  return asNumber(row.step_order) ?? asNumber(row.path_step_order) ?? asNumber(row.order_index);
}

function extractPathKey(row: RecommendationRow): string | null {
  return asString(row.path_key) ?? asString(row.path_id) ?? asString(row.week_start_date);
}

function groupRowsByPath(rows: RecommendationRow[]): Map<string, RecommendationRow[]> {
  const groups = new Map<string, RecommendationRow[]>();

  for (const row of rows) {
    const pathKey = extractPathKey(row);
    if (!pathKey) continue;
    const list = groups.get(pathKey) ?? [];
    list.push(row);
    groups.set(pathKey, list);
  }

  return groups;
}

function rankPathKeys(pathGroups: Map<string, RecommendationRow[]>): string[] {
  return Array.from(pathGroups.entries())
    .sort((a, b) => {
      const aRows = a[1];
      const bRows = b[1];
      const aPriority = Math.max(...aRows.map((r) => r.priority ?? 0), 0);
      const bPriority = Math.max(...bRows.map((r) => r.priority ?? 0), 0);
      if (bPriority !== aPriority) return bPriority - aPriority;

      const aCreated = Math.max(...aRows.map((row) => Date.parse(asString(row.created_at) ?? "") || 0), 0);
      const bCreated = Math.max(...bRows.map((row) => Date.parse(asString(row.created_at) ?? "") || 0), 0);
      const aOrder = Math.min(...aRows.map((row) => asNumber(row.step_order) ?? 999));
      const bOrder = Math.min(...bRows.map((row) => asNumber(row.step_order) ?? 999));

      return aCreated - bCreated || aOrder - bOrder || a[0].localeCompare(b[0]);
    })
    .map(([pathKey]) => pathKey);
}

export function getNextPath(currentPathKey: string | null, orderedPathKeys: string[]): string | null {
  if (orderedPathKeys.length === 0) return null;
  if (!currentPathKey) return orderedPathKeys[0] ?? null;

  const currentIndex = orderedPathKeys.indexOf(currentPathKey);
  if (currentIndex < 0) return orderedPathKeys[0] ?? null;

  return orderedPathKeys[currentIndex + 1] ?? null;
}


async function saveStudentWeeklyPath(studentId: string, subject: SupportedSubject, weekKey: number, pathKey: string): Promise<void> {
  const response = await supabase
    .from("student_weekly_paths")
    .upsert(
      {
        student_id: studentId,
        subject,
        week_key: weekKey,
        path_key: pathKey,
      },
      { onConflict: "student_id,subject,week_key" }
    );

  if (response.error) {
    if (isMissingRelationError(response.error)) return;
    throw response.error;
  }
}

function buildLockReason(steps: WeeklyLearningPathStep[], index: number): string | null {
  const previousStep = steps[index - 1] ?? null;
  if (!previousStep) return "이전 미션을 완료하면 열려요.";
  return `${previousStep.weekdayLabel}요일 미션을 완료하면 열려요.`;
}

function createBaseResult(subject: SupportedSubject, weekKey = getWeekKey(), pathKey: string | null = null): WeeklyLearningPathResult {
  return {
    subject,
    pathKey,
    weekKey,
    nextPathKey: null,
    rotatedFromPathKey: null,
    completionMessage: null,
    steps: [],
    todayStepOrder: getTodayStepOrder(),
    todayStepIndex: -1,
    recommendedIndex: -1,
    completedCount: 0,
    hasData: false,
  };
}

function preferredUnitKeysForSubject(subject: SupportedSubject, grade: number | null): string[] {
  if (subject !== "english" || grade === null) return [];
  return ENGLISH_PRIORITY_UNIT_KEYS_BY_GRADE[grade] ?? [];
}

function chooseFallbackMission(args: {
  candidates: GeneratedMission[];
  desiredDifficulty: GeneratedMission["difficulty"];
  usedMissionIds: Set<string>;
  preferredUnitPriority: Map<string, number>;
  unitGradeMap: Map<string, number>;
  targetGrade: number | null;
}): GeneratedMission | null {
  const ranked = args.candidates
    .filter((mission) => !args.usedMissionIds.has(mission.id))
    .map((mission) => {
      const priority = mission.unit_id ? args.preferredUnitPriority.get(mission.unit_id) ?? 999 : 999;
      const gradeDistance =
        args.targetGrade !== null && mission.unit_id
          ? Math.abs((args.unitGradeMap.get(mission.unit_id) ?? args.targetGrade) - args.targetGrade)
          : 0;

      return {
        mission,
        difficultyPenalty: Math.abs(difficultyOrder(args.desiredDifficulty) - difficultyOrder(mission.difficulty)),
        priority,
        gradeDistance,
      };
    })
    .sort((a, b) => {
      return (
        a.difficultyPenalty - b.difficultyPenalty ||
        a.priority - b.priority ||
        a.gradeDistance - b.gradeDistance ||
        Date.parse(b.mission.published_at ?? b.mission.created_at) - Date.parse(a.mission.published_at ?? a.mission.created_at)
      );
    });

  return ranked[0]?.mission ?? null;
}

function finalizeWeeklyPath(
  subject: SupportedSubject,
  baseSteps: WeeklyLearningPathStep[],
  options?: {
    weekKey?: number;
    pathKey?: string | null;
    nextPathKey?: string | null;
    rotatedFromPathKey?: string | null;
    completionMessage?: string | null;
  }
): WeeklyLearningPathResult {
  const weekKey = options?.weekKey ?? getWeekKey();
  const pathKey = options?.pathKey ?? null;
  const nextPathKey = options?.nextPathKey ?? null;
  const rotatedFromPathKey = options?.rotatedFromPathKey ?? null;
  const completionMessage = options?.completionMessage ?? null;

  if (baseSteps.length === 0) return createBaseResult(subject, weekKey, pathKey);

  const todayStepOrder = getTodayStepOrder();
  const completedCount = baseSteps.filter((step) => step.completed).length;
  const firstIncompleteIndex = baseSteps.findIndex((step) => !step.completed);
  const todayStepIndex = todayStepOrder ? baseSteps.findIndex((step) => step.stepOrder === todayStepOrder) : -1;

  let recommendedIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(0, todayStepIndex);
  if (todayStepIndex >= 0 && !baseSteps[todayStepIndex]?.completed) {
    recommendedIndex = todayStepIndex;
  }

  const steps = baseSteps.map((step, index, items) => {
    const isLocked = false;
    const isRecommendedToday = index === recommendedIndex;
    const status: RecommendationStatus = step.completed
      ? "completed"
      : isLocked
        ? "locked"
        : isRecommendedToday
          ? "today"
          : "ready";

    return {
      ...step,
      isRecommendedToday,
      isLocked,
      status,
      lockReason: isLocked ? buildLockReason(items, index) : null,
    };
  });

  return {
    subject,
    pathKey,
    weekKey,
    nextPathKey,
    rotatedFromPathKey,
    completionMessage,
    steps,
    todayStepOrder,
    todayStepIndex,
    recommendedIndex,
    completedCount,
    hasData: true,
  };
}

async function buildFallbackWeeklyPath(studentId: string, subject: SupportedSubject, grade?: number | null): Promise<WeeklyLearningPathResult> {
  const weekKey = getWeekKey();
  const curriculumGrade = await resolveCurriculumGrade(studentId, grade);
  const [units, missions] = await Promise.all([
    fetchCurriculumUnitsBySubject(subject),
    fetchPublishedMissions(300, subject),
  ]);

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const unitGradeMap = new Map(units.map((unit) => [unit.id, unit.grade]));
  const preferredUnitKeys = preferredUnitKeysForSubject(subject, curriculumGrade);
  const preferredUnits = units.filter((unit) => preferredUnitKeys.includes(unit.unit_key));
  const preferredUnitIds = new Set(preferredUnits.map((unit) => unit.id));
  const preferredUnitPriority = new Map(preferredUnits.map((unit, index) => [unit.id, index]));

  // Tier 1: grade-specific candidates with known units
  let candidates = missions.filter((mission) => {
    const unit = mission.unit_id ? unitById.get(mission.unit_id) ?? null : null;
    if (!unit) return false;
    if (curriculumGrade !== null && unit.grade !== curriculumGrade && preferredUnitIds.size === 0) return false;
    return mission.subject === subject;
  });

  // Tier 2: any mission with a known unit (ignore grade filter)
  if (candidates.length < TARGET_DIFFICULTIES.length) {
    candidates = missions.filter((mission) => {
      const unit = mission.unit_id ? unitById.get(mission.unit_id) ?? null : null;
      if (!unit) return false;
      return mission.subject === subject;
    });
  }

  // Tier 3: all published subject missions regardless of unit assignment
  if (candidates.length < TARGET_DIFFICULTIES.length) {
    candidates = missions.filter((mission) => mission.subject === subject);
  }

  const pool =
    preferredUnitIds.size > 0
      ? candidates.filter((mission) => mission.unit_id && preferredUnitIds.has(mission.unit_id))
      : candidates;

  const usedMissionIds = new Set<string>();
  const selectedMissions: GeneratedMission[] = [];

  for (const desiredDifficulty of TARGET_DIFFICULTIES) {
    const mission =
      chooseFallbackMission({
        candidates: pool,
        desiredDifficulty,
        usedMissionIds,
        preferredUnitPriority,
        unitGradeMap,
        targetGrade: curriculumGrade,
      }) ??
      chooseFallbackMission({
        candidates,
        desiredDifficulty,
        usedMissionIds,
        preferredUnitPriority,
        unitGradeMap,
        targetGrade: curriculumGrade,
      });

    if (!mission) continue;
    usedMissionIds.add(mission.id);
    selectedMissions.push(mission);
  }

  if (selectedMissions.length === 0) return createBaseResult(subject, weekKey, `fallback:${subject}:${curriculumGrade ?? "all"}`);

  const progressMap = await fetchMissionProgressMap(
    selectedMissions.map((mission) => mission.id),
    Object.fromEntries(selectedMissions.map((mission) => {
      const json = mission.mission_json as Record<string, unknown> & { activities?: unknown[]; steps?: unknown[] };
      return [mission.id, json.activities?.length ?? json.steps?.length ?? 0];
    }))
  );

  const todayStepOrder = getTodayStepOrder();
  const baseSteps = selectedMissions.map((mission, index) => {
    const stepOrder = index + 1;
    const weekday = getWeekdayItem(stepOrder);
    const unit = mission.unit_id ? unitById.get(mission.unit_id) ?? null : null;
    const unitName = unit?.unit_name ?? (subject === "english" ? "영어 단원" : "수학 단원");
    const progress = progressMap[mission.id] ?? null;

    return {
      subject,
      missionId: mission.id,
      stepOrder,
      weekdayKey: weekday.key,
      weekdayLabel: weekday.labelKo,
      title: mission.title,
      cleanedTitle: sanitizeRecommendationTitle(mission.title),
      unitId: mission.unit_id ?? null,
      unitName,
      difficulty: mission.difficulty,
      estimatedMinutes: mission.estimated_minutes ?? 7,
      rewardXp: TARGET_REWARD_XP[index] ?? missionXpForDifficulty(mission.difficulty),
      recommendationReason: buildReasonSummary(subject, unitName, mission),
      dailyConnection: buildDailyConnection(subject, unitName, mission),
      examConnection: buildExamConnection(subject, mission),
      thinkingConnection: buildThinkingConnection(subject, mission),
      mission,
      progress,
      completed: progress?.status === "completed",
      inProgress: progress?.status === "in_progress",
      isScheduledToday: todayStepOrder === stepOrder,
      isRecommendedToday: false,
      isLocked: false,
      status: "ready",
      lockReason: null,
    } satisfies WeeklyLearningPathStep;
  });

  const result = finalizeWeeklyPath(subject, baseSteps, {
    weekKey,
    pathKey: `fallback:${subject}:${curriculumGrade ?? "all"}`,
  });

  if (result.completedCount >= result.steps.length) {
    return {
      ...result,
      completionMessage: "이번 주 루트를 모두 완료했어요!",
    };
  }

  return result;
}

async function buildWeeklyPathFromRows(args: {
  subject: SupportedSubject;
  rows: RecommendationRow[];
  weekKey: number;
  pathKey: string;
  rotatedFromPathKey?: string | null;
  completionMessage?: string | null;
  nextPathKey?: string | null;
}): Promise<WeeklyLearningPathResult> {
  const normalizedRows = args.rows
    .map((row) => {
      const stepOrder = extractStepOrder(row);
      const missionId = extractMissionId(row);
      if (!stepOrder || !missionId || stepOrder < 1 || stepOrder > 5) return null;
      return { row, stepOrder, missionId };
    })
    .filter((item): item is { row: RecommendationRow; stepOrder: number; missionId: string } => item !== null)
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.stepOrder === item.stepOrder) === index);

  if (normalizedRows.length === 0) return createBaseResult(args.subject, args.weekKey, args.pathKey);

  const [units, missions] = await Promise.all([
    fetchCurriculumUnitsBySubject(args.subject),
    Promise.all(normalizedRows.map(async ({ missionId }) => fetchMissionById(missionId))),
  ]);

  const missionById = new Map(
    missions
      .filter((mission): mission is GeneratedMission => mission !== null && mission.subject === args.subject)
      .map((mission) => [mission.id, mission])
  );
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const rowsWithMission = normalizedRows.filter(({ missionId }) => missionById.has(missionId));

  if (rowsWithMission.length < normalizedRows.length) {
    const droppedSteps = normalizedRows.filter(({ missionId }) => !missionById.has(missionId));
    console.warn(
      "[buildWeeklyPathFromRows] visibility 미달로 step 누락",
      {
        pathKey: args.pathKey,
        subject: args.subject,
        droppedCount: droppedSteps.length,
        droppedSteps: droppedSteps.map(({ stepOrder, missionId }) => ({ stepOrder, missionId })),
        hint: "generated_missions에서 status=published, is_active=true, published_at NOT NULL, subject 일치 확인",
      }
    );
  }

  if (rowsWithMission.length === 0) return createBaseResult(args.subject, args.weekKey, args.pathKey);

  const progressMap = await fetchMissionProgressMap(
    rowsWithMission.map(({ missionId }) => missionId),
    Object.fromEntries(
      rowsWithMission.map(({ missionId }) => {
        const mission = missionById.get(missionId)!;
        const json = mission.mission_json as Record<string, unknown> & { activities?: unknown[]; steps?: unknown[] };
        const stepCount = json.activities?.length ?? json.steps?.length ?? 0;
        return [mission.id, stepCount];
      })
    )
  );

  const todayStepOrder = getTodayStepOrder();
  const baseSteps = rowsWithMission.map(({ row, stepOrder, missionId }) => {
    const mission = missionById.get(missionId) ?? null;
    const unitId = asString(row.unit_id) ?? mission?.unit_id ?? null;
    const unit = unitId ? unitById.get(unitId) ?? null : null;
    const weekday = getWeekdayItem(stepOrder);
    const difficulty =
      (asString(row.difficulty) as GeneratedMission["difficulty"] | null) ??
      mission?.difficulty ??
      difficultyFallbackForStep(stepOrder);
    const estimatedMinutes = asNumber(row.estimated_minutes) ?? mission?.estimated_minutes ?? 7;
    const rewardXp = asNumber(row.reward_xp) ?? TARGET_REWARD_XP[stepOrder - 1] ?? missionXpForDifficulty(difficulty);
    const rawTitle = asString(row.mission_title) ?? mission?.title ?? (args.subject === "english" ? "오늘의 영어 미션" : "오늘의 수학 미션");
    const unitName = asString(row.unit_name) ?? unit?.unit_name ?? (args.subject === "english" ? "영어 단원" : "수학 단원");
    const progress = progressMap[missionId] ?? null;
    const weekdayLabel = asString(row.weekday_label) ?? weekday.labelKo;

    return {
      subject: args.subject,
      missionId,
      stepOrder,
      weekdayKey: weekday.key,
      weekdayLabel,
      title: rawTitle,
      cleanedTitle: sanitizeRecommendationTitle(rawTitle),
      unitId,
      unitName,
      difficulty,
      estimatedMinutes,
      rewardXp,
      recommendationReason: asString(row.recommendation_reason) ?? asString(row.reason) ?? buildReasonSummary(args.subject, unitName, mission),
      dailyConnection: asString(row.daily_connection) ?? buildDailyConnection(args.subject, unitName, mission),
      examConnection: asString(row.exam_connection) ?? buildExamConnection(args.subject, mission),
      thinkingConnection: asString(row.thinking_connection) ?? buildThinkingConnection(args.subject, mission),
      mission,
      progress,
      completed: progress?.status === "completed",
      inProgress: progress?.status === "in_progress",
      isScheduledToday: todayStepOrder === stepOrder,
      isRecommendedToday: false,
      isLocked: false,
      status: "ready",
      lockReason: null,
    } satisfies WeeklyLearningPathStep;
  });

  return finalizeWeeklyPath(args.subject, baseSteps, {
    weekKey: args.weekKey,
    pathKey: args.pathKey,
    nextPathKey: args.nextPathKey ?? null,
    rotatedFromPathKey: args.rotatedFromPathKey ?? null,
    completionMessage: args.completionMessage ?? null,
  });
}

function resolveSelectionReason(args: {
  weeklyPath: WeeklyLearningPathResult;
  recommendedStep: WeeklyLearningPathStep;
}): RecommendationSelectionReason {
  if (args.weeklyPath.rotatedFromPathKey || args.weeklyPath.completedCount >= args.weeklyPath.steps.length) {
    return "completed_week";
  }

  if (
    args.weeklyPath.todayStepIndex === args.weeklyPath.recommendedIndex &&
    args.recommendedStep.isScheduledToday
  ) {
    return "today";
  }

  if (args.weeklyPath.todayStepIndex > args.weeklyPath.recommendedIndex) return "previous_incomplete";
  return "first_incomplete";
}

async function buildDbWeeklyPath(studentId: string, subject: SupportedSubject, grade?: number | null): Promise<WeeklyLearningPathResult> {
  const weekKey = getWeekKey();
  const allRows = await loadLearningPathRows(studentId, subject, grade);
  const pathGroups = groupRowsByPath(allRows);
  const orderedPathKeys = rankPathKeys(pathGroups);

  if (orderedPathKeys.length === 0) return createBaseResult(subject, weekKey);

  const { data: weeklyPathRow, error: weeklyPathRpcError } = await supabase.rpc("upsert_student_weekly_path", {
    p_student_id: studentId,
    p_subject: subject,
    p_week_key: weekKey,
  });
  if (weeklyPathRpcError && !isMissingRelationError(weeklyPathRpcError)) throw weeklyPathRpcError;

  const initialPathKey = (weeklyPathRow as StudentWeeklyPathRow | null)?.path_key ?? orderedPathKeys[0] ?? null;
  if (!initialPathKey) return createBaseResult(subject, weekKey);

  const currentRows = pathGroups.get(initialPathKey) ?? [];
  const nextPathKey = getNextPath(initialPathKey, orderedPathKeys);
  const currentPath = await buildWeeklyPathFromRows({
    subject,
    rows: currentRows,
    weekKey,
    pathKey: initialPathKey,
    nextPathKey,
  });

  if (!currentPath.hasData) return currentPath;
  if (currentPath.completedCount < currentPath.steps.length) return currentPath;
  if (!nextPathKey || nextPathKey === initialPathKey) {
    return {
      ...currentPath,
      completionMessage: "이번 주 루트를 모두 완료했어요.",
      nextPathKey: null,
    };
  }

  await saveStudentWeeklyPath(studentId, subject, weekKey, nextPathKey);

  const rotatedRows = pathGroups.get(nextPathKey) ?? [];
  const rotatedNextPathKey = getNextPath(nextPathKey, orderedPathKeys);
  const rotatedPath = await buildWeeklyPathFromRows({
    subject,
    rows: rotatedRows,
    weekKey,
    pathKey: nextPathKey,
    nextPathKey: rotatedNextPathKey,
    rotatedFromPathKey: initialPathKey,
    completionMessage: "이번 주 루트를 완료해서 다음 루트로 넘어갔어요.",
  });

  return rotatedPath.hasData ? rotatedPath : currentPath;
}

export async function getWeeklyPath(
  studentId: string,
  subject: SupportedSubject,
  grade?: number | null
): Promise<WeeklyLearningPathResult> {
  const dbPath = await buildDbWeeklyPath(studentId, subject, grade);
  if (dbPath.hasData) return dbPath;
  return buildFallbackWeeklyPath(studentId, subject, grade);
}

export async function getTodayRecommendation(
  studentId: string,
  subject: SupportedSubject,
  grade?: number | null
): Promise<TodayLearningRecommendation | null> {
  const weeklyPath = await getWeeklyPath(studentId, subject, grade);
  if (!weeklyPath.hasData || weeklyPath.recommendedIndex < 0) return null;

  const step = weeklyPath.steps[weeklyPath.recommendedIndex] ?? null;
  if (!step) return null;

  return {
    step,
    selectionReason: resolveSelectionReason({
      weeklyPath,
      recommendedStep: step,
    }),
  };
}

export async function getWeeklyLearningPath(studentId: string, subject: SupportedSubject, grade?: number | null): Promise<WeeklyLearningPathResult> {
  return getWeeklyPath(studentId, subject, grade);
}

export async function getTodayLearningRecommendation(studentId: string, subject: SupportedSubject, grade?: number | null): Promise<TodayLearningRecommendation | null> {
  return getTodayRecommendation(studentId, subject, grade);
}

export async function getWeeklyMathPath(studentId: string, grade?: number | null): Promise<WeeklyMathPathResult> {
  return getWeeklyPath(studentId, "math", grade);
}

export async function getTodayMathRecommendation(studentId: string, grade?: number | null): Promise<TodayMathRecommendation | null> {
  return getTodayRecommendation(studentId, "math", grade);
}

export async function getWeeklyEnglishPath(studentId: string, grade?: number | null): Promise<WeeklyEnglishPathResult> {
  return getWeeklyPath(studentId, "english", grade);
}

export async function getTodayEnglishRecommendation(studentId: string, grade?: number | null): Promise<TodayEnglishRecommendation | null> {
  return getTodayRecommendation(studentId, "english", grade);
}

export async function getNextRecommendedMission(
  studentId: string,
  subject: SupportedSubject,
  grade?: number | null
): Promise<GeneratedMission | null> {
  const recommendation = await getTodayRecommendation(studentId, subject, grade);
  return recommendation?.step.mission ?? null;
}

export function sortWeeklyPathByDifficultyTrend(steps: WeeklyLearningPathStep[]): WeeklyLearningPathStep[] {
  return [...steps].sort((a, b) => {
    if (a.stepOrder !== b.stepOrder) return a.stepOrder - b.stepOrder;
    return difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty);
  });
}

export function weeklyPathDifficultySummary(steps: WeeklyLearningPathStep[]): string {
  const ordered = sortWeeklyPathByDifficultyTrend(steps);
  const labels = ordered.map((step) => {
    if (step.difficulty === "easy") return "easy";
    if (step.difficulty === "normal") return "normal";
    return "hard";
  });
  return labels.join(" -> ");
}
