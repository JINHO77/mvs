import { supabase } from "@/lib/supabaseClient";
import { normalizeUiText } from "@/lib/uiText";
import type {
  BadgeDefinition,
  BadgeKey,
  BadgeProgress,
  BadgeShowcase,
  BadgeSubject,
  EarnedBadgeSummary,
} from "@/types/badges";
import type { GeneratedMission } from "@/types/missions";

type BadgeSubjectFilter = BadgeSubject | "all";

type StudentBadgeRow = {
  badge_id: string | null;
  badge_key: BadgeKey;
  subject: string;
  related_mission_id: string | null;
  earned_at: string | null;
  progress_value?: number | null;
  is_earned?: boolean | null;
  updated_at?: string | null;
};

type MissionAttemptSummaryRow = {
  mission_id: string;
  completed_at: string;
  subject?: string | null;
  unit_id?: string | null;
};

type CompletedMissionRecord = Pick<GeneratedMission, "id" | "subject" | "unit_id" | "title" | "difficulty" | "interest_tags" | "mission_json"> & {
  completedAt: string;
};

type MissionStepAttemptRow = {
  is_correct: boolean | null;
  answered_at?: string | null;
  created_at?: string | null;
  step_order: number;
};

type BadgeComputationContext = {
  completedMissions: CompletedMissionRecord[];
  longestCorrectStepStreak: number;
  totalCompletedCount: number;
  completedUnitCount: number;
  hardMissionCount: number;
  mathMissionCount: number;
  englishMissionCount: number;
  graphMissionCount: number;
  geometryMissionCount: number;
  logicMissionCount: number;
  readingMissionCount: number;
  speakingMissionCount: number;
  englishStudyDayStreak: number;
};

type StudentBadgeUpsertRow = {
  student_id: string;
  badge_id?: string | null;
  badge_key: BadgeKey;
  subject: BadgeSubject;
  related_mission_id: string | null;
  earned_at?: string | null;
  progress_value?: number;
  is_earned?: boolean;
  updated_at?: string;
};

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    key: "first_mission_complete",
    subject: "common",
    title: "첫 미션 완료",
    name: "첫 미션 완료",
    description: "첫 번째 미션을 완료해 학습 여정을 시작했어요.",
    category: "starter",
    iconUrl: "/badges/first-step.svg",
    conditionType: "mission_complete_count",
    conditionValue: 1,
    isActive: true,
  },
  {
    key: "three_correct_streak",
    subject: "common",
    title: "3연속 정답",
    name: "3연속 정답",
    description: "채점 단계에서 3번 연속 정답을 기록해 보세요.",
    category: "streak",
    iconUrl: "/badges/streak-flare.svg",
    conditionType: "correct_step_streak",
    conditionValue: 3,
    isActive: true,
  },
  {
    key: "five_correct_streak",
    subject: "common",
    title: "5연속 정답",
    name: "5연속 정답",
    description: "채점 단계에서 5번 연속 정답을 기록해 보세요.",
    category: "streak",
    iconUrl: "/badges/streak-flare.svg",
    conditionType: "correct_step_streak",
    conditionValue: 5,
    isActive: true,
  },
  {
    key: "explorer_three_units",
    subject: "common",
    title: "단원 탐험가",
    name: "단원 탐험가",
    description: "서로 다른 단원 3개에서 미션을 완료해 보세요.",
    category: "exploration",
    iconUrl: "/badges/unit-explorer.svg",
    conditionType: "distinct_unit_complete_count",
    conditionValue: 3,
    isActive: true,
  },
  {
    key: "hard_challenger",
    subject: "common",
    title: "난이도 도전자",
    name: "난이도 도전자",
    description: "hard 또는 challenge 미션을 3개 완료해 보세요.",
    category: "challenge",
    iconUrl: "/badges/challenge-crest.svg",
    conditionType: "difficulty_complete_count",
    conditionValue: 3,
    isActive: true,
  },
  {
    key: "math_first_step",
    subject: "math",
    title: "수학 첫걸음",
    name: "수학 첫걸음",
    description: "첫 번째 수학 미션을 완료하면 열려요.",
    category: "starter",
    iconUrl: "/badges/first-step.svg",
    conditionType: "mission_complete_count",
    conditionValue: 1,
    isActive: true,
  },
  {
    key: "graph_explorer",
    subject: "math",
    title: "그래프 탐험가",
    name: "그래프 탐험가",
    description: "그래프나 함수와 연결된 수학 미션을 3개 완료해 보세요.",
    category: "graph",
    iconUrl: "/badges/graph-wave.svg",
    conditionType: "keyword_mission_complete_count",
    conditionValue: 3,
    isActive: true,
  },
  {
    key: "geometry_starter",
    subject: "math",
    title: "도형 스타터",
    name: "도형 스타터",
    description: "도형과 공간 감각을 다루는 수학 미션을 2개 완료해 보세요.",
    category: "geometry",
    iconUrl: "/badges/geometry-gem.svg",
    conditionType: "keyword_mission_complete_count",
    conditionValue: 2,
    isActive: true,
  },
  {
    key: "logic_builder",
    subject: "math",
    title: "논리 빌더",
    name: "논리 빌더",
    description: "식, 방정식, 확률 같은 논리형 수학 미션을 3개 완료해 보세요.",
    category: "logic",
    iconUrl: "/badges/logic-circuit.svg",
    conditionType: "keyword_mission_complete_count",
    conditionValue: 3,
    isActive: true,
  },
  {
    key: "english_first_step",
    subject: "english",
    title: "영어 첫걸음",
    name: "영어 첫걸음",
    description: "첫 번째 영어 미션을 완료하면 열려요.",
    category: "starter",
    iconUrl: "/badges/first-step.svg",
    conditionType: "mission_complete_count",
    conditionValue: 1,
    isActive: true,
  },
  {
    key: "reader_starter",
    subject: "english",
    title: "리더 스타터",
    name: "리더 스타터",
    description: "읽기 중심 영어 미션을 2개 완료해 보세요.",
    category: "reading",
    iconUrl: "/badges/reading-bloom.svg",
    conditionType: "keyword_mission_complete_count",
    conditionValue: 2,
    isActive: true,
  },
  {
    key: "speaker_starter",
    subject: "english",
    title: "스피커 스타터",
    name: "스피커 스타터",
    description: "말하기와 표현 중심 영어 미션을 2개 완료해 보세요.",
    category: "speaking",
    iconUrl: "/badges/speaking-spark.svg",
    conditionType: "keyword_mission_complete_count",
    conditionValue: 2,
    isActive: true,
  },
  {
    key: "streak_reader",
    subject: "english",
    title: "꾸준한 리더",
    name: "꾸준한 리더",
    description: "영어 미션을 3일 연속 완료해 보세요.",
    category: "streak",
    iconUrl: "/badges/streak-flare.svg",
    conditionType: "study_day_streak",
    conditionValue: 3,
    isActive: true,
  },
];

const FEATURED_BADGE_KEYS: Record<BadgeSubjectFilter, BadgeKey[]> = {
  all: BADGE_DEFINITIONS.map((badge) => badge.key),
  common: BADGE_DEFINITIONS.filter((badge) => badge.subject === "common").map((badge) => badge.key),
  math: BADGE_DEFINITIONS.filter((badge) => badge.subject === "common" || badge.subject === "math").map((badge) => badge.key),
  english: BADGE_DEFINITIONS.filter((badge) => badge.subject === "common" || badge.subject === "english").map((badge) => badge.key),
};

const GRAPH_KEYWORDS = ["graph", "function", "slope", "coordinate", "linear", "quadratic", "그래프", "함수", "좌표", "기울기", "일차함수", "이차함수"];
const GEOMETRY_KEYWORDS = ["geometry", "triangle", "circle", "angle", "shape", "scale", "pythagorean", "도형", "삼각형", "원", "각", "닮음", "축척", "피타고라스"];
const LOGIC_KEYWORDS = ["expression", "equation", "inequality", "probability", "logic", "ratio", "문자와 식", "식", "방정식", "연립방정식", "부등식", "경우의 수", "확률", "비와 비율"];
const READING_KEYWORDS = ["read", "reading", "reader", "notice", "poster", "story", "article", "announce", "독해", "읽기", "안내문", "포스터", "글"];
const SPEAKING_KEYWORDS = ["speak", "speaking", "speaker", "conversation", "dialogue", "opinion", "presentation", "talk", "say", "말하기", "대화", "표현", "발표", "의견"];

const BADGE_DEFINITION_MAP = new Map(BADGE_DEFINITIONS.map((badge) => [badge.key, badge]));

function isMissingColumnError(error: { message?: string | null; details?: string | null; hint?: string | null; code?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "42P01" ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("does not exist")
  );
}

function normalizeText(value: unknown): string {
  return normalizeUiText(value).toLowerCase();
}

function missionKeywordSource(mission: Pick<GeneratedMission, "title" | "interest_tags" | "mission_json">): string {
  return [
    mission.title,
    mission.mission_json.title,
    mission.mission_json.scenario,
    mission.mission_json.essentialQuestion,
    mission.mission_json.conceptSummary,
    mission.mission_json.learningGoal,
    mission.mission_json.mainConcept,
    ...(mission.interest_tags ?? []),
    ...(mission.mission_json.conceptTags ?? []),
    ...(mission.mission_json.supportConcepts ?? []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
}

function missionMatchesAny(mission: Pick<GeneratedMission, "title" | "interest_tags" | "mission_json">, keywords: string[]): boolean {
  const source = missionKeywordSource(mission);
  return keywords.some((keyword) => source.includes(keyword.toLowerCase()));
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

function calculateDayStreak(values: string[]): number {
  const uniqueSorted = Array.from(new Set(values.map(toKstDateKey).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))).sort((a, b) => b.localeCompare(a));
  if (uniqueSorted.length === 0) return 0;

  let cursor = uniqueSorted[0] ?? "";
  let streak = 0;
  while (uniqueSorted.includes(cursor)) {
    streak += 1;
    const base = new Date(`${cursor}T00:00:00+09:00`);
    base.setUTCDate(base.getUTCDate() - 1);
    cursor = toKstDateKey(base.toISOString());
  }
  return streak;
}

function calculateCorrectStepStreak(rows: MissionStepAttemptRow[]): number {
  const sorted = [...rows].sort((a, b) => {
    const aTime = Date.parse(a.answered_at ?? a.created_at ?? "");
    const bTime = Date.parse(b.answered_at ?? b.created_at ?? "");
    const timeDelta = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    if (timeDelta !== 0) return timeDelta;
    return a.step_order - b.step_order;
  });

  let streak = 0;
  let best = 0;
  for (const row of sorted) {
    if (row.is_correct === true) {
      streak += 1;
      best = Math.max(best, streak);
    } else if (row.is_correct === false) {
      streak = 0;
    }
  }
  return best;
}

function progressUnitLabel(badge: BadgeDefinition): string {
  if (badge.conditionType === "correct_step_streak") return "연속 정답";
  if (badge.conditionType === "distinct_unit_complete_count") return "단원";
  if (badge.conditionType === "study_day_streak") return "일";
  return "개";
}

function buildProgressLabel(badge: BadgeDefinition, progressValue: number): string {
  const capped = Math.min(progressValue, badge.conditionValue);
  return `${capped}/${badge.conditionValue}`;
}

function buildRemainingLabel(badge: BadgeDefinition, remainingValue: number): string {
  if (remainingValue <= 0) return "조건을 달성했어요.";
  return `${remainingValue}${progressUnitLabel(badge)} 남았어요`;
}

async function getResolvedStudentId(studentId?: string): Promise<string> {
  if (studentId) return studentId;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("로그인이 필요합니다.");
  return user.id;
}

async function fetchBadgeIdMap(): Promise<Map<BadgeKey, string>> {
  const { data, error } = await supabase
    .from("badges")
    .select("id,badge_key")
    .eq("is_active", true)
    .returns<Array<{ id: string; badge_key: BadgeKey }>>();

  if (error) {
    if (isMissingColumnError(error)) return new Map();
    throw error;
  }

  return new Map((data ?? []).map((row) => [row.badge_key, row.id]));
}

async function fetchStudentBadgeRows(studentId: string): Promise<StudentBadgeRow[]> {
  const modernRes = await supabase
    .from("student_badges")
    .select("badge_id,badge_key,subject,related_mission_id,earned_at,progress_value,is_earned,updated_at")
    .eq("student_id", studentId)
    .returns<StudentBadgeRow[]>();

  if (!modernRes.error) return modernRes.data ?? [];
  if (!isMissingColumnError(modernRes.error)) throw modernRes.error;

  const legacyRes = await supabase
    .from("student_badges")
    .select("badge_key,subject,related_mission_id,earned_at")
    .eq("student_id", studentId)
    .returns<Array<Pick<StudentBadgeRow, "badge_key" | "subject" | "related_mission_id" | "earned_at">>>();
  if (legacyRes.error) throw legacyRes.error;

  return (legacyRes.data ?? []).map((row) => ({
    badge_id: null,
    badge_key: row.badge_key,
    subject: row.subject,
    related_mission_id: row.related_mission_id,
    earned_at: row.earned_at,
    progress_value: row.earned_at ? 1 : 0,
    is_earned: Boolean(row.earned_at),
    updated_at: row.earned_at,
  }));
}

async function fetchCompletedMissions(studentId: string): Promise<CompletedMissionRecord[]> {
  const modernAttemptsRes = await supabase
    .from("mission_attempts")
    .select("mission_id,completed_at,subject,unit_id")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .returns<MissionAttemptSummaryRow[]>();

  let attempts: MissionAttemptSummaryRow[] = [];
  if (!modernAttemptsRes.error) {
    attempts = modernAttemptsRes.data ?? [];
  } else if (isMissingColumnError(modernAttemptsRes.error)) {
    const legacyAttemptsRes = await supabase
      .from("mission_attempts")
      .select("mission_id,completed_at")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .returns<Array<Pick<MissionAttemptSummaryRow, "mission_id" | "completed_at">>>();
    if (legacyAttemptsRes.error) throw legacyAttemptsRes.error;
    attempts = (legacyAttemptsRes.data ?? []).map((row) => ({ ...row, subject: null, unit_id: null }));
  } else {
    throw modernAttemptsRes.error;
  }

  const latestAttemptByMissionId = new Map<string, MissionAttemptSummaryRow>();
  for (const row of attempts) {
    const current = latestAttemptByMissionId.get(row.mission_id);
    if (!current || row.completed_at > current.completed_at) {
      latestAttemptByMissionId.set(row.mission_id, row);
    }
  }

  const missionIds = Array.from(latestAttemptByMissionId.keys());
  if (missionIds.length === 0) return [];

  const missionsRes = await supabase
    .from("generated_missions")
    .select("id,subject,unit_id,title,difficulty,interest_tags,mission_json")
    .in("id", missionIds)
    .returns<Array<Pick<GeneratedMission, "id" | "subject" | "unit_id" | "title" | "difficulty" | "interest_tags" | "mission_json">>>();
  if (missionsRes.error) throw missionsRes.error;

  const missionMap = new Map((missionsRes.data ?? []).map((row) => [row.id, row]));
  return missionIds
    .map((missionId) => {
      const mission = missionMap.get(missionId);
      const attempt = latestAttemptByMissionId.get(missionId);
      if (!mission || !attempt) return null;
      return {
        ...mission,
        subject: attempt.subject ?? mission.subject,
        unit_id: attempt.unit_id ?? mission.unit_id,
        completedAt: attempt.completed_at,
      } satisfies CompletedMissionRecord;
    })
    .filter((row): row is CompletedMissionRecord => row !== null);
}

async function fetchCorrectStepAttempts(studentId: string): Promise<MissionStepAttemptRow[]> {
  const withStudentRes = await supabase
    .from("mission_step_attempts")
    .select("is_correct,answered_at,created_at,step_order")
    .eq("student_id", studentId)
    .returns<MissionStepAttemptRow[]>();

  if (!withStudentRes.error) return withStudentRes.data ?? [];
  if (!isMissingColumnError(withStudentRes.error)) throw withStudentRes.error;

  const attemptsRes = await supabase
    .from("mission_attempts")
    .select("id")
    .eq("student_id", studentId)
    .returns<Array<{ id: string }>>();
  if (attemptsRes.error) throw attemptsRes.error;

  const attemptIds = (attemptsRes.data ?? []).map((row) => row.id);
  if (attemptIds.length === 0) return [];

  const legacyStepRes = await supabase
    .from("mission_step_attempts")
    .select("is_correct,created_at,step_order")
    .in("attempt_id", attemptIds)
    .returns<Array<Pick<MissionStepAttemptRow, "is_correct" | "created_at" | "step_order">>>();
  if (legacyStepRes.error) throw legacyStepRes.error;

  return (legacyStepRes.data ?? []).map((row) => ({
    is_correct: row.is_correct,
    created_at: row.created_at,
    step_order: row.step_order,
    answered_at: row.created_at,
  }));
}

async function buildBadgeComputationContext(studentId: string): Promise<BadgeComputationContext> {
  const [completedMissions, stepAttempts] = await Promise.all([
    fetchCompletedMissions(studentId),
    fetchCorrectStepAttempts(studentId),
  ]);

  const mathMissions = completedMissions.filter((mission) => mission.subject === "math");
  const englishMissions = completedMissions.filter((mission) => mission.subject === "english");

  return {
    completedMissions,
    longestCorrectStepStreak: calculateCorrectStepStreak(stepAttempts),
    totalCompletedCount: completedMissions.length,
    completedUnitCount: new Set(completedMissions.map((mission) => mission.unit_id).filter(Boolean)).size,
    hardMissionCount: completedMissions.filter((mission) => mission.difficulty === "hard" || mission.difficulty === "challenge").length,
    mathMissionCount: mathMissions.length,
    englishMissionCount: englishMissions.length,
    graphMissionCount: mathMissions.filter((mission) => missionMatchesAny(mission, GRAPH_KEYWORDS)).length,
    geometryMissionCount: mathMissions.filter((mission) => missionMatchesAny(mission, GEOMETRY_KEYWORDS)).length,
    logicMissionCount: mathMissions.filter((mission) => missionMatchesAny(mission, LOGIC_KEYWORDS)).length,
    readingMissionCount: englishMissions.filter((mission) => missionMatchesAny(mission, READING_KEYWORDS)).length,
    speakingMissionCount: englishMissions.filter((mission) => missionMatchesAny(mission, SPEAKING_KEYWORDS)).length,
    englishStudyDayStreak: calculateDayStreak(englishMissions.map((mission) => mission.completedAt)),
  };
}

function computeProgressValue(badge: BadgeDefinition, context: BadgeComputationContext): number {
  switch (badge.key) {
    case "first_mission_complete":
      return context.totalCompletedCount;
    case "three_correct_streak":
    case "five_correct_streak":
      return context.longestCorrectStepStreak;
    case "explorer_three_units":
      return context.completedUnitCount;
    case "hard_challenger":
      return context.hardMissionCount;
    case "math_first_step":
      return context.mathMissionCount;
    case "graph_explorer":
      return context.graphMissionCount;
    case "geometry_starter":
      return context.geometryMissionCount;
    case "logic_builder":
      return context.logicMissionCount;
    case "english_first_step":
      return context.englishMissionCount;
    case "reader_starter":
      return context.readingMissionCount;
    case "speaker_starter":
      return context.speakingMissionCount;
    case "streak_reader":
      return context.englishStudyDayStreak;
    default:
      return 0;
  }
}

function buildBadgeProgress(badge: BadgeDefinition, row: StudentBadgeRow | undefined, badgeId: string | null, progressValue: number): BadgeProgress {
  const earned = Boolean(row?.is_earned ?? row?.earned_at ?? progressValue >= badge.conditionValue);
  const earnedAt = row?.earned_at ?? (earned ? new Date().toISOString() : null);
  const relatedMissionId = row?.related_mission_id ?? null;
  const progressPercent = Math.min(100, Math.round((Math.min(progressValue, badge.conditionValue) / badge.conditionValue) * 100));
  const remainingValue = Math.max(0, badge.conditionValue - progressValue);
  const state = earned ? "earned" : progressValue > 0 ? "in_progress" : "locked";

  return {
    ...badge,
    badgeId,
    earned,
    earnedAt,
    relatedMissionId,
    progressValue,
    targetValue: badge.conditionValue,
    progressPercent,
    remainingValue,
    progressLabel: buildProgressLabel(badge, progressValue),
    remainingLabel: buildRemainingLabel(badge, remainingValue),
    state,
  } satisfies BadgeProgress;
}

function toEarnedBadgeSummary(badge: BadgeProgress): EarnedBadgeSummary {
  return {
    key: badge.key,
    subject: badge.subject,
    title: badge.title,
    name: badge.name,
    description: badge.description,
    category: badge.category,
    iconUrl: badge.iconUrl,
    conditionType: badge.conditionType,
    conditionValue: badge.conditionValue,
    isActive: badge.isActive,
    badgeId: badge.badgeId,
    earnedAt: badge.earnedAt ?? new Date().toISOString(),
    relatedMissionId: badge.relatedMissionId,
    progressValue: badge.progressValue,
    targetValue: badge.targetValue,
    progressPercent: badge.progressPercent,
    state: "earned",
  };
}

function filterBadgeDefinitions(subject: BadgeSubjectFilter): BadgeDefinition[] {
  const allowed = new Set(FEATURED_BADGE_KEYS[subject]);
  return BADGE_DEFINITIONS.filter((badge) => allowed.has(badge.key));
}

async function upsertStudentBadgeRows(args: {
  studentId: string;
  relatedMissionId?: string | null;
  badges: BadgeProgress[];
  existingRows: Map<BadgeKey, StudentBadgeRow>;
  badgeIds: Map<BadgeKey, string>;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const rows: StudentBadgeUpsertRow[] = args.badges.map((badge) => {
    const existing = args.existingRows.get(badge.key);
    const nextEarned = badge.earned;
    const wasEarned = Boolean(existing?.is_earned ?? existing?.earned_at);
    const newlyEarned = nextEarned && !wasEarned;
    return {
      student_id: args.studentId,
      badge_id: args.badgeIds.get(badge.key) ?? existing?.badge_id ?? null,
      badge_key: badge.key,
      subject: badge.subject,
      related_mission_id: newlyEarned ? (args.relatedMissionId ?? existing?.related_mission_id ?? null) : (existing?.related_mission_id ?? badge.relatedMissionId ?? null),
      earned_at: nextEarned ? existing?.earned_at ?? (newlyEarned ? nowIso : badge.earnedAt) ?? nowIso : null,
      progress_value: badge.progressValue,
      is_earned: nextEarned,
      updated_at: nowIso,
    };
  });

  const modernRes = await supabase.from("student_badges").upsert(rows, {
    onConflict: "student_id,badge_key,subject",
  });
  if (!modernRes.error) return;
  if (!isMissingColumnError(modernRes.error)) throw modernRes.error;

  const earnedRows = rows
    .filter((row) => row.is_earned)
    .map((row) => ({
      student_id: row.student_id,
      badge_key: row.badge_key,
      subject: row.subject,
      related_mission_id: row.related_mission_id,
      earned_at: row.earned_at ?? nowIso,
    }));

  if (earnedRows.length === 0) return;

  const legacyRes = await supabase.from("student_badges").upsert(earnedRows, {
    onConflict: "student_id,badge_key,subject",
    ignoreDuplicates: true,
  });
  if (legacyRes.error) throw legacyRes.error;
}

export function getBadgeDefinitions(subject: BadgeSubjectFilter = "all"): BadgeDefinition[] {
  return filterBadgeDefinitions(subject);
}

export async function getBadgeProgress(studentId?: string, subject: BadgeSubjectFilter = "all"): Promise<BadgeProgress[]> {
  const resolvedStudentId = await getResolvedStudentId(studentId);
  const [context, existingRows, badgeIds] = await Promise.all([
    buildBadgeComputationContext(resolvedStudentId),
    fetchStudentBadgeRows(resolvedStudentId),
    fetchBadgeIdMap(),
  ]);

  const existingMap = new Map(existingRows.map((row) => [row.badge_key, row]));
  const progress = filterBadgeDefinitions(subject).map((badge) => {
    const computedValue = computeProgressValue(badge, context);
    return buildBadgeProgress(badge, existingMap.get(badge.key), badgeIds.get(badge.key) ?? existingMap.get(badge.key)?.badge_id ?? null, computedValue);
  });

  await upsertStudentBadgeRows({
    studentId: resolvedStudentId,
    badges: progress,
    existingRows: existingMap,
    badgeIds,
  });

  return progress;
}

export async function evaluateBadgesForStudent(args: {
  studentId: string;
  relatedMissionId?: string | null;
  subject?: BadgeSubjectFilter;
}): Promise<EarnedBadgeSummary[]> {
  const subject = args.subject ?? "all";
  const resolvedStudentId = await getResolvedStudentId(args.studentId);
  const [context, existingRows, badgeIds] = await Promise.all([
    buildBadgeComputationContext(resolvedStudentId),
    fetchStudentBadgeRows(resolvedStudentId),
    fetchBadgeIdMap(),
  ]);

  const existingMap = new Map(existingRows.map((row) => [row.badge_key, row]));
  const progress = filterBadgeDefinitions(subject).map((badge) => {
    const computedValue = computeProgressValue(badge, context);
    return buildBadgeProgress(badge, existingMap.get(badge.key), badgeIds.get(badge.key) ?? existingMap.get(badge.key)?.badge_id ?? null, computedValue);
  });

  await upsertStudentBadgeRows({
    studentId: resolvedStudentId,
    relatedMissionId: args.relatedMissionId,
    badges: progress,
    existingRows: existingMap,
    badgeIds,
  });

  return progress
    .filter((badge) => {
      const existing = existingMap.get(badge.key);
      const wasEarned = Boolean(existing?.is_earned ?? existing?.earned_at);
      return badge.earned && !wasEarned;
    })
    .map(toEarnedBadgeSummary)
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
}

export async function awardBadgeIfEligible(studentId: string, badgeKey: BadgeKey, relatedMissionId?: string | null): Promise<EarnedBadgeSummary | null> {
  const result = await evaluateBadgesForStudent({ studentId, relatedMissionId });
  return result.find((badge) => badge.key === badgeKey) ?? null;
}

export async function getStudentBadgeShowcase(studentId?: string, subject: BadgeSubjectFilter = "all"): Promise<BadgeShowcase> {
  const progress = await getBadgeProgress(studentId, subject);
  const earnedBadges = progress
    .filter((badge) => badge.earned && badge.earnedAt)
    .map(toEarnedBadgeSummary)
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));

  const nextBadge = progress
    .filter((badge) => !badge.earned)
    .sort((a, b) => b.progressPercent - a.progressPercent || a.remainingValue - b.remainingValue || a.title.localeCompare(b.title, "ko"))[0] ?? null;

  const showcaseBadges = [...progress]
    .sort((a, b) => {
      if (a.earned !== b.earned) return Number(b.earned) - Number(a.earned);
      if (a.progressPercent !== b.progressPercent) return b.progressPercent - a.progressPercent;
      return a.title.localeCompare(b.title, "ko");
    })
    .slice(0, Math.max(6, progress.length));

  return {
    totalEarned: earnedBadges.length,
    recentBadges: earnedBadges.slice(0, 3),
    showcaseBadges,
    nextBadge,
  };
}

export function getBadgeDefinitionByKey(key: BadgeKey): BadgeDefinition | null {
  return BADGE_DEFINITION_MAP.get(key) ?? null;
}
