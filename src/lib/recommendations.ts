import { normalizeInterestTagSelection } from "@/constants/interestTags";
import { getEffectiveSchoolGrade, toCurriculumGradeNumber } from "@/lib/academicYear";
import { getConcept } from "@/lib/concepts";
import { getConceptNode } from "@/lib/conceptMap";
import { fetchCurriculumUnits, fetchPublishedMissions } from "@/lib/missions";
import type { ProfileSchoolLevel } from "@/lib/studentProfile";
import { supabase } from "@/lib/supabaseClient";
import type { CurriculumUnit, GeneratedMission } from "@/types/missions";

type RecommendationProfile = {
  school_level: ProfileSchoolLevel | null;
  grade: number | null;
  interest_tags: string[] | null;
};

type RecommendationAttemptRow = {
  id: string;
  mission_id: string;
  status: "started" | "completed" | "abandoned";
  updated_at: string;
  completed_at?: string | null;
};

type RecommendationStepAttemptRow = {
  attempt_id: string;
  hint_used?: boolean | null;
  is_correct?: boolean | null;
};

type StudentMasteryRow = {
  unit_id: string;
  mastery_score: number | null;
  recent_accuracy: number | null;
  recent_speed: number | null;
  confidence_level: string | null;
  updated_at: string;
};

type StudentProgressRow = {
  unit_id: string;
  mastery_score: number | null;
  recent_accuracy: number | null;
  recent_speed: number | null;
  confidence_level: string | null;
  updated_at: string;
};

export type StudentWeakConcept = {
  conceptId: string;
  label: string;
  score: number;
};

export type StudentRecentLearningContext = {
  recentMissionIds: string[];
  recentUnitIds: string[];
  recentConceptIds: string[];
  recentConceptCounts: Record<string, number>;
  attemptedMissionIds: string[];
  attemptedUnitIds: string[];
  completedMissionIds: string[];
  struggledMissionIds: string[];
  struggledConceptIds: string[];
  latestMissionId: string | null;
};

export type MissionRecommendationFactorBreakdown = {
  sameGrade: boolean;
  nearbyGrade: boolean;
  weakConcept: boolean;
  weakUnit: boolean;
  recentConcept: boolean;
  recentUnit: boolean;
  interestTag: boolean;
  newContent: boolean;
  completedMission: boolean;
};

export type StudentRecommendationContext = {
  studentId: string;
  schoolLevel: ProfileSchoolLevel | null;
  grade: number | null;
  curriculumGrade: number | null;
  weakConcepts: StudentWeakConcept[];
  weakConceptIds: string[];
  weakUnitIds: string[];
  normalUnitIds: string[];
  strongUnitIds: string[];
  recentLearning: StudentRecentLearningContext;
  interestTags: string[];
  missionUnitMap: Map<string, CurriculumUnit>;
};

export type MissionRecommendationResult = {
  mission: GeneratedMission;
  score: number;
  reason: string;
  conceptId: string | null;
  conceptLabel: string;
  matchedTags: string[];
  factors: MissionRecommendationFactorBreakdown;
};

export type StudentMissionRecommendationBundle = {
  context: StudentRecommendationContext;
  startNow: MissionRecommendationResult | null;
  weakConceptRecommendations: MissionRecommendationResult[];
  interestRecommendations: MissionRecommendationResult[];
  masteryRecommendations: {
    weak: MissionRecommendationResult[];
    normal: MissionRecommendationResult[];
    strong: MissionRecommendationResult[];
  };
  allRanked: MissionRecommendationResult[];
};

type RecommendationSeedData = {
  profile: RecommendationProfile | null;
  units: CurriculumUnit[];
  missions: GeneratedMission[];
  allAttempts: RecommendationAttemptRow[];
  recentAttempts: RecommendationAttemptRow[];
  recentStepAttempts: RecommendationStepAttemptRow[];
  masteryRows: StudentMasteryRow[];
};

const TAG_LABEL_MAP: Record<string, string> = {
  career: "\uC9C4\uB85C",
  game: "\uAC8C\uC784",
  cafe: "\uCE74\uD398",
  drone: "\uB4DC\uB860",
  robot: "\uB85C\uBD07",
  creator: "\uD06C\uB9AC\uC5D0\uC774\uD130",
  youtube: "\uC720\uD29C\uBE0C",
  app: "\uC571",
  animal: "\uB3D9\uBB3C",
  sports: "\uC2A4\uD3EC\uCE20",
  shopping: "\uC1FC\uD551",
  travel: "\uC5EC\uD589",
};

function isProgressSchemaFallbackError(error: { message?: string | null; details?: string | null; hint?: string | null; code?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("column")
  );
}

function normalizeConceptLabel(conceptId: string | null | undefined): string {
  const normalized = typeof conceptId === "string" ? conceptId.trim() : "";
  if (!normalized) return "\uAC1C\uB150";
  return getConcept(normalized)?.label ?? getConceptNode(normalized)?.displayName ?? "\uD575\uC2EC \uAC1C\uB150";
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function displayTagLabel(tag: string): string {
  const normalized = normalizeTag(tag);
  return TAG_LABEL_MAP[normalized] ?? normalized;
}

function missionMainConcept(mission: GeneratedMission): string | null {
  return typeof mission.mission_json.mainConcept === "string" && mission.mission_json.mainConcept.trim().length > 0
    ? mission.mission_json.mainConcept.trim()
    : null;
}

function missionTags(mission: GeneratedMission): string[] {
  return (mission.mission_json.conceptTags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function normalizeMasteryScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

function getWeaknessWeight(row: StudentMasteryRow): number {
  const mastery = normalizeMasteryScore(Number(row.mastery_score ?? 0));
  const accuracy = normalizeMasteryScore(Number(row.recent_accuracy ?? 0));
  const confidence = String(row.confidence_level ?? "").trim().toLowerCase();

  let score = 0;
  if (mastery > 0 && mastery < 0.5) score += 20;
  if (accuracy > 0 && accuracy < 0.6) score += 15;
  if (confidence === "low") score += 10;

  return score;
}

async function fetchRecommendationSeedData(studentId: string): Promise<RecommendationSeedData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[fetchRecommendationSeedData] Supabase 환경변수 누락!", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    return { profile: null, units: [], missions: [], allAttempts: [], recentAttempts: [], recentStepAttempts: [], masteryRows: [] };
  }

  const [profileRes, unitsRes, missionsRes, allAttemptsRes, recentAttemptsRes, masteryRes, progressRes] = await Promise.allSettled([
    supabase.from("profiles").select("school_level,grade,interest_tags").eq("id", studentId).maybeSingle<RecommendationProfile>(),
    fetchCurriculumUnits(),
    fetchPublishedMissions(200),
    supabase
      .from("mission_attempts")
      .select("id,mission_id,status,updated_at,completed_at")
      .eq("student_id", studentId)
      .returns<RecommendationAttemptRow[]>(),
    supabase
      .from("mission_attempts")
      .select("id,mission_id,status,updated_at,completed_at")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(12)
      .returns<RecommendationAttemptRow[]>(),
    supabase
      .from("student_mastery")
      .select("unit_id,mastery_score,recent_accuracy,recent_speed,confidence_level,updated_at")
      .eq("student_id", studentId)
      .order("mastery_score", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(8)
      .returns<StudentMasteryRow[]>(),
    supabase
      .from("student_progress")
      .select("unit_id,mastery_score,recent_accuracy,recent_speed,confidence_level,updated_at")
      .eq("student_id", studentId)
      .order("mastery_score", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(8)
      .returns<StudentProgressRow[]>(),
  ]);

  const profileData = profileRes.status === "fulfilled" && !profileRes.value.error ? profileRes.value.data : null;
  if (profileRes.status === "fulfilled" && profileRes.value.error) throw profileRes.value.error;

  const units = unitsRes.status === "fulfilled" ? unitsRes.value : [];
  const missions = missionsRes.status === "fulfilled" ? missionsRes.value : [];

  const allAttemptsData = allAttemptsRes.status === "fulfilled" && !allAttemptsRes.value.error ? allAttemptsRes.value.data ?? [] : [];
  if (allAttemptsRes.status === "fulfilled" && allAttemptsRes.value.error) throw allAttemptsRes.value.error;

  const recentAttempts = recentAttemptsRes.status === "fulfilled" && !recentAttemptsRes.value.error ? recentAttemptsRes.value.data ?? [] : [];
  if (recentAttemptsRes.status === "fulfilled" && recentAttemptsRes.value.error) throw recentAttemptsRes.value.error;

  const masteryData = masteryRes.status === "fulfilled" && !masteryRes.value.error ? masteryRes.value.data ?? [] : [];
  if (masteryRes.status === "fulfilled" && masteryRes.value.error) throw masteryRes.value.error;

  const progressData = progressRes.status === "fulfilled" && !progressRes.value.error ? progressRes.value.data ?? [] :
    progressRes.status === "fulfilled" && isProgressSchemaFallbackError(progressRes.value.error) ? [] : null;
  if (progressData === null && progressRes.status === "fulfilled") throw progressRes.value.error;

  const attemptIds = recentAttempts.map((attempt) => attempt.id);
  let recentStepAttempts: RecommendationStepAttemptRow[] = [];

  if (attemptIds.length > 0) {
    const recentStepAttemptsRes = await supabase
      .from("mission_step_attempts")
      .select("attempt_id,hint_used,is_correct")
      .in("attempt_id", attemptIds)
      .returns<RecommendationStepAttemptRow[]>();
    if (recentStepAttemptsRes.error) throw recentStepAttemptsRes.error;
    recentStepAttempts = recentStepAttemptsRes.data ?? [];
  }

  return {
    profile: profileData ?? null,
    units,
    missions,
    allAttempts: allAttemptsData,
    recentAttempts,
    recentStepAttempts,
    masteryRows: (progressData?.length ? progressData : masteryData) ?? [],
  };
}

function buildRecentLearningContext(seed: RecommendationSeedData): StudentRecentLearningContext {
  const missionById = new Map(seed.missions.map((mission) => [mission.id, mission]));
  const uniqueRecentMissions: string[] = [];
  const seenRecentMissions = new Set<string>();
  const recentConceptCounts = new Map<string, number>();
  const recentUnitIds = new Set<string>();
  const completedMissionIds = new Set<string>();
  const attemptedMissionIds = new Set<string>();
  const attemptedUnitIds = new Set<string>();
  const struggledMissionIds = new Set<string>();
  const struggledConceptIds = new Set<string>();
  const recentConceptIds: string[] = [];
  const attemptToMissionId = new Map(seed.recentAttempts.map((attempt) => [attempt.id, attempt.mission_id]));

  for (const attempt of seed.allAttempts) {
    attemptedMissionIds.add(attempt.mission_id);
    if (attempt.status === "completed") completedMissionIds.add(attempt.mission_id);
    const mission = missionById.get(attempt.mission_id);
    if (mission) attemptedUnitIds.add(mission.unit_id);
  }

  for (const attempt of seed.recentAttempts) {
    if (!seenRecentMissions.has(attempt.mission_id)) {
      uniqueRecentMissions.push(attempt.mission_id);
      seenRecentMissions.add(attempt.mission_id);
    }

    const mission = missionById.get(attempt.mission_id);
    if (!mission) continue;
    recentUnitIds.add(mission.unit_id);
    const conceptId = missionMainConcept(mission);
    if (!conceptId) continue;
    recentConceptCounts.set(conceptId, (recentConceptCounts.get(conceptId) ?? 0) + 1);
  }

  for (const conceptId of recentConceptCounts.keys()) {
    recentConceptIds.push(conceptId);
  }

  for (const stepAttempt of seed.recentStepAttempts) {
    const missionId = attemptToMissionId.get(stepAttempt.attempt_id);
    if (!missionId) continue;
    const mission = missionById.get(missionId);
    const conceptId = mission ? missionMainConcept(mission) : null;
    const struggled = stepAttempt.hint_used === true || stepAttempt.is_correct === false;
    if (!struggled) continue;
    struggledMissionIds.add(missionId);
    if (conceptId) struggledConceptIds.add(conceptId);
  }

  return {
    recentMissionIds: uniqueRecentMissions,
    recentUnitIds: Array.from(recentUnitIds),
    recentConceptIds,
    recentConceptCounts: Object.fromEntries(recentConceptCounts.entries()),
    attemptedMissionIds: Array.from(attemptedMissionIds),
    attemptedUnitIds: Array.from(attemptedUnitIds),
    completedMissionIds: Array.from(completedMissionIds),
    struggledMissionIds: Array.from(struggledMissionIds),
    struggledConceptIds: Array.from(struggledConceptIds),
    latestMissionId: uniqueRecentMissions[0] ?? null,
  };
}

function buildWeakConcepts(seed: RecommendationSeedData, recentLearning: StudentRecentLearningContext): StudentWeakConcept[] {
  const missionsByUnitId = new Map<string, GeneratedMission[]>();
  for (const mission of seed.missions) {
    const list = missionsByUnitId.get(mission.unit_id) ?? [];
    list.push(mission);
    missionsByUnitId.set(mission.unit_id, list);
  }

  const conceptScores = new Map<string, number>();
  for (const row of seed.masteryRows) {
    const weaknessWeight = getWeaknessWeight(row);
    if (weaknessWeight <= 0) continue;

    const missions = missionsByUnitId.get(row.unit_id) ?? [];
    for (const mission of missions) {
      const conceptId = missionMainConcept(mission);
      if (!conceptId) continue;
      conceptScores.set(conceptId, (conceptScores.get(conceptId) ?? 0) + weaknessWeight);
    }
  }

  for (const conceptId of recentLearning.struggledConceptIds) {
    conceptScores.set(conceptId, (conceptScores.get(conceptId) ?? 0) + 18);
  }

  for (const [conceptId, count] of Object.entries(recentLearning.recentConceptCounts)) {
    if (!recentLearning.struggledConceptIds.includes(conceptId)) continue;
    conceptScores.set(conceptId, (conceptScores.get(conceptId) ?? 0) + count * 4);
  }

  return Array.from(conceptScores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, 3)
    .map(([conceptId, score]) => ({
      conceptId,
      label: normalizeConceptLabel(conceptId),
      score,
    }));
}

function buildInterestTags(seed: RecommendationSeedData): string[] {
  const selectedTags = normalizeInterestTagSelection(seed.profile?.interest_tags);
  if (selectedTags.length > 0) return selectedTags;

  const missionById = new Map(seed.missions.map((mission) => [mission.id, mission]));
  const tagScores = new Map<string, number>();

  for (const [index, attempt] of seed.recentAttempts.entries()) {
    const mission = missionById.get(attempt.mission_id);
    if (!mission) continue;
    const recencyWeight = Math.max(1, 6 - index);
    const completionWeight = attempt.status === "completed" ? 2 : 1;

    for (const tag of missionTags(mission)) {
      const normalized = normalizeTag(tag);
      tagScores.set(normalized, (tagScores.get(normalized) ?? 0) + recencyWeight * completionWeight);
    }
  }

  return Array.from(tagScores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, 3)
    .map(([tag]) => tag);
}

function buildMasteryUnitBuckets(seed: RecommendationSeedData): { weak: string[]; normal: string[]; strong: string[] } {
  const buckets = {
    weak: [] as string[],
    normal: [] as string[],
    strong: [] as string[],
  };
  const seen = new Set<string>();

  for (const row of seed.masteryRows) {
    if (seen.has(row.unit_id)) continue;
    seen.add(row.unit_id);
    const mastery = normalizeMasteryScore(Number(row.mastery_score ?? 0));
    if (mastery < 0.4) {
      buckets.weak.push(row.unit_id);
    } else if (mastery < 0.75) {
      buckets.normal.push(row.unit_id);
    } else {
      buckets.strong.push(row.unit_id);
    }
  }

  return buckets;
}

function buildRecommendationContext(
  studentId: string,
  seed: RecommendationSeedData,
  weakConcepts: StudentWeakConcept[],
  recentLearning: StudentRecentLearningContext,
  interestTags: string[]
): StudentRecommendationContext {
  const effectiveGrade = getEffectiveSchoolGrade(seed.profile?.school_level ?? null, seed.profile?.grade ?? null);
  const curriculumGrade = effectiveGrade
    ? toCurriculumGradeNumber(effectiveGrade.schoolLevel, effectiveGrade.grade)
    : null;
  const masteryBuckets = buildMasteryUnitBuckets(seed);

  return {
    studentId,
    schoolLevel: seed.profile?.school_level ?? null,
    grade: seed.profile?.grade ?? null,
    curriculumGrade,
    weakConcepts,
    weakConceptIds: weakConcepts.map((item) => item.conceptId),
    weakUnitIds: masteryBuckets.weak,
    normalUnitIds: masteryBuckets.normal,
    strongUnitIds: masteryBuckets.strong,
    recentLearning,
    interestTags,
    missionUnitMap: new Map(seed.units.map((unit) => [unit.id, unit])),
  };
}

function compareRecommendationResults(a: MissionRecommendationResult, b: MissionRecommendationResult): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.factors.completedMission !== b.factors.completedMission) {
    return Number(a.factors.completedMission) - Number(b.factors.completedMission);
  }
  const createdAtDelta = Date.parse(b.mission.created_at) - Date.parse(a.mission.created_at);
  if (Number.isFinite(createdAtDelta) && createdAtDelta !== 0) return createdAtDelta;
  return a.mission.title.localeCompare(b.mission.title, "ko");
}

function shuffleMissions<T>(items: T[], seedText: string): T[] {
  let seed = Array.from(seedText).reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

function pickRandomFallbackRecommendations(args: {
  ranked: MissionRecommendationResult[];
  excludedIds: Set<string>;
  recentMissionIds: Set<string>;
  limit: number;
  seedText: string;
}): MissionRecommendationResult[] {
  return shuffleMissions(
    args.ranked.filter((item) => !args.excludedIds.has(item.mission.id) && !args.recentMissionIds.has(item.mission.id)),
    args.seedText
  ).slice(0, args.limit);
}

export async function getStudentWeakConcepts(
  studentId: string,
  seed?: RecommendationSeedData
): Promise<StudentWeakConcept[]> {
  const resolvedSeed = seed ?? await fetchRecommendationSeedData(studentId);
  const recentLearning = buildRecentLearningContext(resolvedSeed);
  return buildWeakConcepts(resolvedSeed, recentLearning);
}

export async function getStudentRecentLearningContext(
  studentId: string,
  seed?: RecommendationSeedData
): Promise<StudentRecentLearningContext> {
  const resolvedSeed = seed ?? await fetchRecommendationSeedData(studentId);
  return buildRecentLearningContext(resolvedSeed);
}

export async function inferStudentInterestTags(studentId: string, seed?: RecommendationSeedData): Promise<string[]> {
  const resolvedSeed = seed ?? await fetchRecommendationSeedData(studentId);
  return buildInterestTags(resolvedSeed);
}

export function calculateMissionRecommendationScore(
  mission: GeneratedMission,
  studentContext: StudentRecommendationContext
): Omit<MissionRecommendationResult, "reason"> {
  const unit = studentContext.missionUnitMap.get(mission.unit_id);
  const mainConcept = missionMainConcept(mission);
  const tags = missionTags(mission);
  const completedMissionIds = new Set(studentContext.recentLearning.completedMissionIds);
  const attemptedMissionIds = new Set(studentContext.recentLearning.attemptedMissionIds);
  const attemptedUnitIds = new Set(studentContext.recentLearning.attemptedUnitIds);
  const recentConceptIds = new Set(studentContext.recentLearning.recentConceptIds);
  const recentUnitIds = new Set(studentContext.recentLearning.recentUnitIds);
  const interestTags = new Set(studentContext.interestTags.map(normalizeTag));
  const weakUnitIds = new Set(studentContext.weakUnitIds);

  let score = 0;
  const gradeDelta =
    studentContext.curriculumGrade !== null && unit
      ? Math.abs(unit.grade - studentContext.curriculumGrade)
      : null;

  const matchedTags = tags.filter((tag) => interestTags.has(normalizeTag(tag)));
  const factors: MissionRecommendationFactorBreakdown = {
    sameGrade: gradeDelta === 0,
    nearbyGrade: gradeDelta === 1,
    weakConcept: !!mainConcept && studentContext.weakConceptIds.includes(mainConcept),
    weakUnit: weakUnitIds.has(mission.unit_id),
    recentConcept: !!mainConcept && recentConceptIds.has(mainConcept),
    recentUnit: recentUnitIds.has(mission.unit_id),
    interestTag: matchedTags.length > 0,
    newContent: !attemptedMissionIds.has(mission.id) || !attemptedUnitIds.has(mission.unit_id),
    completedMission: completedMissionIds.has(mission.id),
  };

  if (factors.sameGrade) score += 40;
  else if (factors.nearbyGrade) score += 20;
  if (factors.weakConcept) score += 30;
  if (factors.weakUnit) score += 30;
  if (factors.recentConcept) score += 20;
  if (factors.recentUnit) score += 15;
  if (factors.interestTag) score += 15;
  if (factors.newContent) score += 10;
  if (factors.completedMission) score -= 50;

  return {
    mission,
    score,
    conceptId: mainConcept,
    conceptLabel: normalizeConceptLabel(mainConcept ?? undefined),
    matchedTags: matchedTags.map(displayTagLabel),
    factors,
  };
}

export function buildRecommendationReason(result: Omit<MissionRecommendationResult, "reason">): string {
  if (result.factors.weakConcept) return `${result.conceptLabel} \uC601\uC5ED\uC744 \uAC15\uD654\uD558\uBA74 \uC88B\uC544\uC694.`;
  if (result.factors.weakUnit) {
    const areaLabel = result.conceptLabel && result.conceptLabel !== "\uD575\uC2EC \uAC1C\uB150" ? result.conceptLabel : "\uC774 \uB2E8\uC6D0";
    return `${areaLabel} \uC601\uC5ED\uC744 \uBCF4\uC644\uD558\uBA74 \uC88B\uC544\uC694.`;
  }
  if (result.factors.recentConcept || result.factors.recentUnit) return "\uCD5C\uADFC \uD559\uC2B5 \uD750\uB984\uACFC \uC774\uC5B4\uC9C0\uB294 \uBBF8\uC158\uC774\uB77C \uBC14\uB85C \uC774\uC5B4\uC11C \uD480\uAE30 \uC88B\uC544\uC694.";
  if (result.factors.interestTag) {
    const tag = result.matchedTags[0];
    return tag
      ? `${tag} \uC8FC\uC81C\uC640 \uC5F0\uACB0\uB41C \uBBF8\uC158\uC774\uB77C \uB354 \uC26C\uAC8C \uBAB0\uC785\uD560 \uC218 \uC788\uC5B4\uC694.`
      : "\uAD00\uC2EC \uC8FC\uC81C\uC640 \uC5F0\uACB0\uB41C \uBBF8\uC158\uC774\uB77C \uB354 \uC26C\uAC8C \uBAB0\uC785\uD560 \uC218 \uC788\uC5B4\uC694.";
  }
  if (result.factors.newContent) return "\uC0C8\uB85C \uC5F4\uB9B0 \uB2E8\uC6D0\uC774\uB77C \uBA3C\uC800 \uD0D0\uC0C9\uD574 \uBCF4\uAE30 \uC88B\uC544\uC694.";
  if (result.factors.sameGrade || result.factors.nearbyGrade) return "\uD604\uC7AC \uD559\uB144\uC5D0 \uC798 \uB9DE\uB294 \uB09C\uC774\uB3C4\uC758 \uBBF8\uC158\uC774\uC5D0\uC694.";
  return "\uB2E4\uC74C \uD559\uC2B5 \uD750\uB984\uC73C\uB85C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC774\uC5B4\uC9C8 \uC218 \uC788\uB294 \uBBF8\uC158\uC774\uC5D0\uC694.";
}

export async function getStudentMissionRecommendations(studentId: string): Promise<StudentMissionRecommendationBundle> {
  const seed = await fetchRecommendationSeedData(studentId);
  const recentLearning = buildRecentLearningContext(seed);
  const weakConcepts = buildWeakConcepts(seed, recentLearning);
  const interestTags = buildInterestTags(seed);
  const context = buildRecommendationContext(studentId, seed, weakConcepts, recentLearning, interestTags);
  const recentMissionIds = new Set(recentLearning.recentMissionIds);
  const weakUnitIds = new Set(context.weakUnitIds);
  const normalUnitIds = new Set(context.normalUnitIds);
  const strongUnitIds = new Set(context.strongUnitIds);

  const ranked = seed.missions
    .map((mission) => {
      const partial = calculateMissionRecommendationScore(mission, context);
      return {
        ...partial,
        reason: buildRecommendationReason(partial),
      } satisfies MissionRecommendationResult;
    })
    .sort(compareRecommendationResults);

  const pickUnique = (
    items: MissionRecommendationResult[],
    predicate: (item: MissionRecommendationResult) => boolean,
    limit: number,
    excludedIds: Set<string>
  ): MissionRecommendationResult[] => {
    const result: MissionRecommendationResult[] = [];
    for (const item of items) {
      if (excludedIds.has(item.mission.id)) continue;
      if (recentMissionIds.has(item.mission.id)) continue;
      if (!predicate(item)) continue;
      result.push(item);
      excludedIds.add(item.mission.id);
      if (result.length >= limit) break;
    }
    return result;
  };

  const excludedIds = new Set<string>();
  const weakRecommendations = pickUnique(
    ranked,
    (item) => weakUnitIds.has(item.mission.unit_id) || item.factors.weakConcept,
    3,
    excludedIds
  );
  if (weakRecommendations.length < 3) {
    const fallbackItems = pickRandomFallbackRecommendations({
      ranked,
      excludedIds,
      recentMissionIds,
      limit: 3 - weakRecommendations.length,
      seedText: `${studentId}:weak`,
    });
    for (const item of fallbackItems) {
      weakRecommendations.push(item);
      excludedIds.add(item.mission.id);
    }
  }

  const masteryRecommendations = {
    weak: weakRecommendations,
    normal: pickUnique(ranked, (item) => normalUnitIds.has(item.mission.unit_id), 3, excludedIds),
    strong: pickUnique(ranked, (item) => strongUnitIds.has(item.mission.unit_id), 3, excludedIds),
  };

  const startNow =
    masteryRecommendations.weak[0] ??
    masteryRecommendations.normal[0] ??
    masteryRecommendations.strong[0] ??
    ranked.find((item) => !recentMissionIds.has(item.mission.id) && !item.factors.completedMission) ??
    ranked.find((item) => !recentMissionIds.has(item.mission.id)) ??
    null;

  const legacyExcludedIds = new Set<string>();
  if (startNow) legacyExcludedIds.add(startNow.mission.id);
  masteryRecommendations.weak.forEach((item) => legacyExcludedIds.add(item.mission.id));

  const weakConceptRecommendations = pickUnique(
    ranked,
    (item) => weakUnitIds.has(item.mission.unit_id) || item.factors.weakConcept,
    3,
    legacyExcludedIds
  );

  const interestRecommendations = pickUnique(
    ranked,
    (item) => item.factors.interestTag,
    3,
    legacyExcludedIds
  );

  return {
    context,
    startNow,
    weakConceptRecommendations,
    interestRecommendations,
    masteryRecommendations,
    allRanked: ranked,
  };
}
