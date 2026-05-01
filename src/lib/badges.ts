import { supabase } from "@/lib/supabaseClient";
import { normalizeUiText } from "@/lib/uiText";
import { getBadgeMetadata } from "@/constants/badgeMetadata";
import type {
  BadgeDefinition,
  BadgeKey,
  BadgeProgress,
  BadgeShowcase,
  BadgeSubject,
  BadgeType,
  EarnedBadgeSummary,
} from "@/types/badges";
import type { GeneratedMission } from "@/types/missions";

type BadgeSubjectFilter = BadgeSubject | "all";

type StudentBadgeRow = {
  badge_id: string | null;
  badge_key: BadgeKey;
  title?: string | null;
  icon_url?: string | null;
  description?: string | null;
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
  weekendMissionCount: number;
  dailyStreak: number;
  totalXp: number;
  currentLevel: number;
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
  // ── COMMON (10) ──────────────────────────────
  {
    key: "start_journey",
    subject: "common",
    title: "첫 걸음의 설렘",
    name: "첫 걸음의 설렘",
    description: "첫 미션을 완료해 학습 여정을 시작했어요.",
    category: "starter",
    iconUrl: "/badges/first_step.svg",
    conditionType: "mission_complete_count",
    conditionValue: 1,
    isActive: true,
  },
  {
    key: "first_math",
    subject: "math",
    title: "숫자와의 첫 만남",
    name: "숫자와의 첫 만남",
    description: "첫 번째 수학 미션을 완료했어요.",
    category: "starter",
    iconUrl: "/badges/math_lover.svg",
    conditionType: "math_complete_count",
    conditionValue: 1,
    isActive: true,
  },
  {
    key: "first_english",
    subject: "english",
    title: "영어와의 첫 대화",
    name: "영어와의 첫 대화",
    description: "첫 번째 영어 미션을 완료했어요.",
    category: "starter",
    iconUrl: "/badges/eng_lover.svg",
    conditionType: "english_complete_count",
    conditionValue: 1,
    isActive: true,
  },
  {
    key: "first_weekend",
    subject: "common",
    title: "첫 주말 탐험",
    name: "첫 주말 탐험",
    description: "첫 주말 챌린지를 완료했어요.",
    category: "weekend",
    iconUrl: "/badges/explorer.svg",
    conditionType: "weekend_complete_count",
    conditionValue: 1,
    isActive: true,
  },
  {
    key: "char_white_rabbit",
    subject: "common",
    title: "하얀 토끼",
    name: "하얀 토끼",
    description: "첫 미션 완료 — 항상 당신 옆에서 응원하는 첫 번째 친구예요.",
    category: "starter",
    iconUrl: "/badges/char_bunny.svg",
    conditionType: "mission_complete_count",
    conditionValue: 1,
    isActive: true,
    badgeType: "character",
  },
  {
    key: "streak_3",
    subject: "common",
    title: "3일의 약속",
    name: "3일의 약속",
    description: "3일 연속 미션을 완료했어요.",
    category: "streak",
    iconUrl: "/badges/streak_3.svg",
    conditionType: "daily_streak",
    conditionValue: 3,
    isActive: true,
  },
  {
    key: "missions_5",
    subject: "common",
    title: "귀여운 새싹",
    name: "귀여운 새싹",
    description: "미션 5개를 완료했어요.",
    category: "missions",
    iconUrl: "/badges/first_step.svg",
    conditionType: "mission_complete_count",
    conditionValue: 5,
    isActive: true,
  },
  {
    key: "missions_10",
    subject: "common",
    title: "꾸준한 배움이",
    name: "꾸준한 배움이",
    description: "미션 10개를 완료했어요.",
    category: "missions",
    iconUrl: "/badges/first_step.svg",
    conditionType: "mission_complete_count",
    conditionValue: 10,
    isActive: true,
  },
  {
    key: "xp_100",
    subject: "common",
    title: "반짝이는 시작",
    name: "반짝이는 시작",
    description: "누적 XP 100을 달성했어요.",
    category: "xp",
    iconUrl: "/badges/first_step.svg",
    conditionType: "total_xp_threshold",
    conditionValue: 100,
    isActive: true,
  },
  {
    key: "xp_500",
    subject: "common",
    title: "빛나는 성장",
    name: "빛나는 성장",
    description: "누적 XP 500을 달성했어요.",
    category: "xp",
    iconUrl: "/badges/first_step.svg",
    conditionType: "total_xp_threshold",
    conditionValue: 500,
    isActive: true,
  },
  // ── UNCOMMON (8) ─────────────────────────────
  {
    key: "hard_3",
    subject: "common",
    title: "도전의 첫 관문",
    name: "도전의 첫 관문",
    description: "Hard 미션 3개를 완료했어요.",
    category: "challenge",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "difficulty_complete_count",
    conditionValue: 3,
    isActive: true,
  },
  {
    key: "level_5",
    subject: "common",
    title: "5레벨 각성",
    name: "5레벨 각성",
    description: "레벨 5에 도달했어요.",
    category: "level",
    iconUrl: "/badges/first_step.svg",
    conditionType: "level_reach",
    conditionValue: 5,
    isActive: true,
  },
  {
    key: "streak_7",
    subject: "common",
    title: "일주일의 전사",
    name: "일주일의 전사",
    description: "7일 연속 미션을 완료했어요.",
    category: "streak",
    iconUrl: "/badges/streak_7.svg",
    conditionType: "daily_streak",
    conditionValue: 7,
    isActive: true,
  },
  {
    key: "char_english_owl",
    subject: "english",
    title: "영어 올빼미",
    name: "영어 올빼미",
    description: "영어 미션 20개 완료 — 졸업 모자를 쓴 학식 높은 올빼미예요.",
    category: "reading",
    iconUrl: "/badges/char_owl.svg",
    conditionType: "english_complete_count",
    conditionValue: 20,
    isActive: true,
    badgeType: "character",
  },
  {
    key: "char_math_fox",
    subject: "math",
    title: "수학 여우",
    name: "수학 여우",
    description: "수학 미션 20개 완료 — Σ 기호가 자랑인 영리한 여우예요.",
    category: "exploration",
    iconUrl: "/badges/char_fox.svg",
    conditionType: "math_complete_count",
    conditionValue: 20,
    isActive: true,
    badgeType: "character",
  },
  {
    key: "char_panda",
    subject: "common",
    title: "판다",
    name: "판다",
    description: "미션 30개 완료 — 꾸준함이 최고라는 걸 아는 느긋한 판다예요.",
    category: "missions",
    iconUrl: "/badges/char_panda.svg",
    conditionType: "mission_complete_count",
    conditionValue: 30,
    isActive: true,
    badgeType: "character",
  },
  {
    key: "missions_30",
    subject: "common",
    title: "열정의 학습자",
    name: "열정의 학습자",
    description: "미션 30개를 완료했어요.",
    category: "missions",
    iconUrl: "/badges/explorer.svg",
    conditionType: "mission_complete_count",
    conditionValue: 30,
    isActive: true,
  },
  {
    key: "xp_1000",
    subject: "common",
    title: "은빛 학자",
    name: "은빛 학자",
    description: "누적 XP 1000을 달성했어요.",
    category: "xp",
    iconUrl: "/badges/first_step.svg",
    conditionType: "total_xp_threshold",
    conditionValue: 1000,
    isActive: true,
  },
  // ── RARE (8) ─────────────────────────────────
  {
    key: "weekend_10",
    subject: "common",
    title: "주말의 모험가",
    name: "주말의 모험가",
    description: "주말 챌린지 10개를 완료했어요.",
    category: "weekend",
    iconUrl: "/badges/explorer.svg",
    conditionType: "weekend_complete_count",
    conditionValue: 10,
    isActive: true,
  },
  {
    key: "char_explorer_bear",
    subject: "common",
    title: "탐험 곰",
    name: "탐험 곰",
    description: "단원 10개 탐험 — 나침반을 들고 새로운 단원을 탐험하는 모험가예요.",
    category: "exploration",
    iconUrl: "/badges/char_bear.svg",
    conditionType: "distinct_unit_complete_count",
    conditionValue: 10,
    isActive: true,
    badgeType: "character",
  },
  {
    key: "level_10",
    subject: "common",
    title: "10레벨 베테랑",
    name: "10레벨 베테랑",
    description: "레벨 10에 도달했어요.",
    category: "level",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "level_reach",
    conditionValue: 10,
    isActive: true,
  },
  {
    key: "char_fire_cat",
    subject: "common",
    title: "불꽃 고양이",
    name: "불꽃 고양이",
    description: "30일 연속 학습 — 털 끝에서 스파크가 튀는 에너지 넘치는 고양이예요.",
    category: "streak",
    iconUrl: "/badges/char_cat.svg",
    conditionType: "daily_streak",
    conditionValue: 30,
    isActive: true,
    badgeType: "character",
  },
  {
    key: "streak_30",
    subject: "common",
    title: "한 달의 기적",
    name: "한 달의 기적",
    description: "30일 연속 미션을 완료했어요.",
    category: "streak",
    iconUrl: "/badges/streak_7.svg",
    conditionType: "daily_streak",
    conditionValue: 30,
    isActive: true,
  },
  {
    key: "bilingual_30",
    subject: "common",
    title: "양손잡이 학자",
    name: "양손잡이 학자",
    description: "수학과 영어 미션 각각 30개 이상 완료 — 두 과목을 자유롭게 오가는 학자예요.",
    category: "bilingual",
    iconUrl: "/badges/bilingual.svg",
    conditionType: "bilingual_complete_count",
    conditionValue: 30,
    isActive: true,
  },
  {
    key: "missions_100",
    subject: "common",
    title: "100개의 증거",
    name: "100개의 증거",
    description: "미션 100개를 완료했어요.",
    category: "missions",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "mission_complete_count",
    conditionValue: 100,
    isActive: true,
  },
  {
    key: "xp_3000",
    subject: "common",
    title: "다이아의 광채",
    name: "다이아의 광채",
    description: "누적 XP 3000을 달성했어요.",
    category: "xp",
    iconUrl: "/badges/streak_7.svg",
    conditionType: "total_xp_threshold",
    conditionValue: 3000,
    isActive: true,
  },
  // ── EPIC (6) ─────────────────────────────────
  {
    key: "level_15",
    subject: "common",
    title: "15레벨 엘리트",
    name: "15레벨 엘리트",
    description: "레벨 15에 도달했어요.",
    category: "level",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "level_reach",
    conditionValue: 15,
    isActive: true,
  },
  {
    key: "hard_30",
    subject: "common",
    title: "역경의 정복자",
    name: "역경의 정복자",
    description: "Hard 미션 30개를 완료했어요.",
    category: "challenge",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "difficulty_complete_count",
    conditionValue: 30,
    isActive: true,
  },
  {
    key: "char_lion_king",
    subject: "common",
    title: "사자왕",
    name: "사자왕",
    description: "Hard 미션 30개 완료 — 어려운 도전을 정복한 자만이 얻는 왕의 칭호예요.",
    category: "challenge",
    iconUrl: "/badges/char_lion.svg",
    conditionType: "difficulty_complete_count",
    conditionValue: 30,
    isActive: true,
    badgeType: "character",
  },
  {
    key: "streak_60",
    subject: "common",
    title: "60일의 결의",
    name: "60일의 결의",
    description: "60일 연속 미션을 완료했어요.",
    category: "streak",
    iconUrl: "/badges/streak_7.svg",
    conditionType: "daily_streak",
    conditionValue: 60,
    isActive: true,
  },
  {
    key: "missions_300",
    subject: "common",
    title: "300개의 왕관",
    name: "300개의 왕관",
    description: "미션 300개를 완료했어요.",
    category: "missions",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "mission_complete_count",
    conditionValue: 300,
    isActive: true,
  },
  {
    key: "xp_10000",
    subject: "common",
    title: "만 년의 학자",
    name: "만 년의 학자",
    description: "누적 XP 10000을 달성했어요.",
    category: "xp",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "total_xp_threshold",
    conditionValue: 10000,
    isActive: true,
  },
  // ── LEGENDARY (4) ────────────────────────────
  {
    key: "streak_365",
    subject: "common",
    title: "1년 개근의 신화",
    name: "1년 개근의 신화",
    description: "365일 연속 미션을 완료했어요.",
    category: "streak",
    iconUrl: "/badges/streak_7.svg",
    conditionType: "daily_streak",
    conditionValue: 365,
    isActive: true,
  },
  {
    key: "missions_1000",
    subject: "common",
    title: "천 개의 발자국",
    name: "천 개의 발자국",
    description: "미션 1000개를 완료했어요.",
    category: "missions",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "mission_complete_count",
    conditionValue: 1000,
    isActive: true,
  },
  {
    key: "xp_100000",
    subject: "common",
    title: "불멸의 학자",
    name: "불멸의 학자",
    description: "누적 XP 100000을 달성했어요.",
    category: "xp",
    iconUrl: "/badges/hard_master.svg",
    conditionType: "total_xp_threshold",
    conditionValue: 100000,
    isActive: true,
  },
  {
    key: "char_legendary_dragon",
    subject: "common",
    title: "전설의 드래곤",
    name: "전설의 드래곤",
    description: "누적 XP 100000 달성 — 가장 높은 곳에 올라선 자만이 만나는 전설이에요.",
    category: "challenge",
    iconUrl: "/badges/char_dragon.svg",
    conditionType: "total_xp_threshold",
    conditionValue: 100000,
    isActive: true,
    badgeType: "character",
  },
];

const FEATURED_BADGE_KEYS: Record<BadgeSubjectFilter, BadgeKey[]> = {
  all: BADGE_DEFINITIONS.map((badge) => badge.key),
  common: BADGE_DEFINITIONS.filter((badge) => badge.subject === "common").map((badge) => badge.key),
  math: BADGE_DEFINITIONS.filter((badge) => badge.subject === "common" || badge.subject === "math").map((badge) => badge.key),
  english: BADGE_DEFINITIONS.filter((badge) => badge.subject === "common" || badge.subject === "english").map((badge) => badge.key),
};

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

// kept for potential future keyword-based logic
function _missionKeywordSource(mission: Parameters<typeof missionKeywordSource>[0]): string {
  return missionKeywordSource(mission);
}
void _missionKeywordSource;

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

function isWeekendDate(dateStr: string): boolean {
  const kst = toKstDateKey(dateStr);
  if (!kst) return false;
  const d = new Date(`${kst}T00:00:00+09:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
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
  switch (badge.conditionType) {
    case "correct_step_streak": return "연속 정답";
    case "distinct_unit_complete_count": return "단원";
    case "daily_streak": return "일";
    case "level_reach": return "레벨";
    case "total_xp_threshold": return "XP";
    default: return "개";
  }
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

type BadgeDbMetaRow = {
  badge_key: string;
  title: string | null;
  description: string | null;
  badge_type: string | null;
  icon_url: string | null;
  subject: string | null;
  rarity: string | null;
  character_name: string | null;
  character_emoji: string | null;
  character_story: string | null;
  badge_color: string | null;
};

async function fetchBadgesMetaForKeys(keys: string[]): Promise<Map<string, BadgeDbMetaRow>> {
  if (keys.length === 0) return new Map();
  const { data, error } = await supabase
    .from("badges")
    .select("badge_key,title,description,badge_type,icon_url,subject,rarity,character_name,character_emoji,character_story,badge_color")
    .in("badge_key", keys)
    .returns<BadgeDbMetaRow[]>();
  if (error) return new Map();
  return new Map((data ?? []).map((row) => [row.badge_key, row]));
}

async function fetchStudentBadgeRows(studentId: string): Promise<StudentBadgeRow[]> {
  const modernRes = await supabase
    .from("student_badges")
    .select("badge_id,badge_key,title,icon_url,description,subject,related_mission_id,earned_at,progress_value,is_earned,updated_at")
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

async function fetchStudentXpData(studentId: string): Promise<{ totalXp: number; currentLevel: number }> {
  const { data, error } = await supabase
    .from("student_xp_summary")
    .select("total_xp,current_level")
    .eq("student_id", studentId)
    .single();
  if (error || !data) return { totalXp: 0, currentLevel: 0 };
  return {
    totalXp: (data as { total_xp?: number | null }).total_xp ?? 0,
    currentLevel: (data as { current_level?: number | null }).current_level ?? 0,
  };
}

async function buildBadgeComputationContext(studentId: string): Promise<BadgeComputationContext> {
  const [completedMissions, stepAttempts, xpData] = await Promise.all([
    fetchCompletedMissions(studentId),
    fetchCorrectStepAttempts(studentId),
    fetchStudentXpData(studentId).catch(() => ({ totalXp: 0, currentLevel: 0 })),
  ]);

  const mathMissions = completedMissions.filter((mission) => mission.subject === "math");
  const englishMissions = completedMissions.filter((mission) => mission.subject === "english");
  const weekendMissions = completedMissions.filter((mission) => isWeekendDate(mission.completedAt));

  return {
    completedMissions,
    longestCorrectStepStreak: calculateCorrectStepStreak(stepAttempts),
    totalCompletedCount: completedMissions.length,
    completedUnitCount: new Set(completedMissions.map((mission) => mission.unit_id).filter(Boolean)).size,
    hardMissionCount: completedMissions.filter((mission) => mission.difficulty === "hard" || mission.difficulty === "challenge").length,
    mathMissionCount: mathMissions.length,
    englishMissionCount: englishMissions.length,
    weekendMissionCount: weekendMissions.length,
    dailyStreak: calculateDayStreak(completedMissions.map((mission) => mission.completedAt)),
    totalXp: xpData.totalXp,
    currentLevel: xpData.currentLevel,
  };
}

function computeProgressValue(badge: BadgeDefinition, context: BadgeComputationContext): number {
  switch (badge.conditionType) {
    case "mission_complete_count":
      return context.totalCompletedCount;
    case "math_complete_count":
      return context.mathMissionCount;
    case "english_complete_count":
      return context.englishMissionCount;
    case "weekend_complete_count":
      return context.weekendMissionCount;
    case "difficulty_complete_count":
      return context.hardMissionCount;
    case "distinct_unit_complete_count":
      return context.completedUnitCount;
    case "daily_streak":
      return context.dailyStreak;
    case "total_xp_threshold":
      return context.totalXp;
    case "level_reach":
      return context.currentLevel;
    case "bilingual_complete_count":
      return Math.min(context.mathMissionCount, context.englishMissionCount);
    case "correct_step_streak":
      return context.longestCorrectStepStreak;
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
  const resolvedStudentId = await getResolvedStudentId(studentId);
  const dbRows = await fetchStudentBadgeRows(resolvedStudentId);

  if (dbRows.length > 0) {
    const rowMap = new Map(dbRows.map((row) => [row.badge_key, row]));
    const definitions = filterBadgeDefinitions(subject);

    const knownProgress = definitions.map((badge) => {
      const row = rowMap.get(badge.key);
      return buildBadgeProgress(badge, row, row?.badge_id ?? null, row?.progress_value ?? 0);
    });

    // Include DB rows for badge keys not in BADGE_DEFINITIONS
    const knownKeys = new Set(definitions.map((d) => d.key));
    const unknownKeys = [...rowMap.keys()].filter((key) => !knownKeys.has(key as BadgeKey));
    const dbMetaMap = await fetchBadgesMetaForKeys(unknownKeys);

    const extraProgress = unknownKeys.map((key) => {
      const row = rowMap.get(key as BadgeKey)!;
      const dbMeta = dbMetaMap.get(key);
      const meta = getBadgeMetadata(key, {
        title: dbMeta?.title ?? row.title ?? undefined,
        description: dbMeta?.description ?? row.description ?? undefined,
        iconUrl: dbMeta?.icon_url ?? row.icon_url ?? undefined,
        subject: dbMeta?.subject ?? undefined,
        badgeType: dbMeta?.badge_type ?? undefined,
        accentColor: dbMeta?.badge_color ?? undefined,
        rarity: dbMeta?.rarity ?? undefined,
      });
      const syntheticDef: BadgeDefinition = {
        key: key as BadgeKey,
        subject: (dbMeta?.subject as BadgeSubject) ?? (row.subject as BadgeSubject) ?? "common",
        title: meta.title,
        name: meta.title,
        description: meta.description,
        category: meta.category,
        iconUrl: meta.iconUrl,
        conditionType: "mission_complete_count",
        conditionValue: Math.max(1, row.progress_value ?? 1),
        isActive: true,
        badgeType: (dbMeta?.badge_type as BadgeType) ?? undefined,
      };
      return buildBadgeProgress(syntheticDef, row, row.badge_id ?? null, row.progress_value ?? 0);
    });

    const progress = [...knownProgress, ...extraProgress];

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

  // Fallback: full computation (no DB rows yet)
  const progress = await getBadgeProgress(resolvedStudentId, subject);
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
