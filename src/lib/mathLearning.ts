import { supabase } from "@/lib/supabaseClient";
import { isUuid } from "@/lib/validators";
import { type GeneratedMissionPayload } from "@/lib/aiMissionSchema";
import { getVisibleMathMissionsByUnit, fetchPublishedMissions, fetchMissionById } from "@/lib/missions";

export type MissionSource = "static" | "ai";

export type MathUnitRow = {
  id: string;
  school_level: "middle" | "high";
  grade: number | null;
  unit_key: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  source: MissionSource;
};

export type MathMissionRow = {
  id: string;
  unit_id: string;
  mission_key: string;
  title: string;
  scenario: string;
  essential_question: string;
  concept_summary: string;
  difficulty: "easy" | "normal" | "challenge";
  estimated_minutes: number;
  is_active: boolean;
  source: MissionSource;
  created_at?: string;
};

export type MathStepRow = {
  id: string;
  mission_id: string;
  step_order: number;
  title: string;
  question: string | null;
  input_placeholder: string | null;
  correct_answer: string | null;
  hint: string | null;
  feedback_correct: string | null;
  feedback_incorrect: string | null;
  step_type: "input" | "concept";
  concept_title: string | null;
  concept_description: string | null;
  source: MissionSource;
};

export type StudentMissionProgressRow = {
  user_id: string;
  mission_id: string;
  mission_source: MissionSource;
  current_step: number;
  status: "in_progress" | "completed";
  answers_json: Record<string, string> | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
};

type MeMini = { id: string; role: string | null };

async function getMeStudent(): Promise<MeMini> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase.from("profiles").select("id,role").eq("id", user.id).single<MeMini>();
  if (error) throw error;
  if ((data.role ?? "") !== "student") throw new Error("학생 권한이 필요합니다.");
  return data;
}

function mapPayloadMission(id: string, unitId: string, payload: GeneratedMissionPayload, createdAt?: string): MathMissionRow {
  return {
    id,
    unit_id: unitId,
    mission_key: payload.missionKey,
    title: payload.title,
    scenario: payload.scenario,
    essential_question: payload.essentialQuestion,
    concept_summary: payload.conceptSummary,
    difficulty: payload.difficulty,
    estimated_minutes: payload.estimatedMinutes,
    is_active: true,
    source: "ai",
    created_at: createdAt,
  };
}

export async function listMathUnits(): Promise<MathUnitRow[]> {
  const [staticRes, aiRes] = await Promise.all([
    supabase
      .from("math_units")
      .select("id,school_level,grade,unit_key,title,description,sort_order,is_active")
      .eq("is_active", true)
      .returns<Array<Omit<MathUnitRow, "source">>>(),
    supabase
      .from("curriculum_units")
      .select("id,school_level,grade,unit_key,title:unit_name,description,sort_order:display_order,is_active")
      .eq("subject", "math")
      .eq("is_active", true)
      .returns<Array<Omit<MathUnitRow, "source">>>(),
  ]);

  if (staticRes.error) throw staticRes.error;
  if (aiRes.error) throw aiRes.error;

  const merged: MathUnitRow[] = [
    ...(staticRes.data ?? []).map((row) => ({ ...row, source: "static" as const })),
    ...(aiRes.data ?? []).map((row) => ({ ...row, source: "ai" as const })),
  ];

  return merged.sort((a, b) => {
    const aLevel = a.school_level === "middle" ? 0 : 1;
    const bLevel = b.school_level === "middle" ? 0 : 1;
    if (aLevel !== bLevel) return aLevel - bLevel;
    if ((a.grade ?? 0) !== (b.grade ?? 0)) return (a.grade ?? 0) - (b.grade ?? 0);
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.title.localeCompare(b.title, "ko");
  });
}

export async function getMathUnitById(unitId: string): Promise<MathUnitRow | null> {
  if (!isUuid(unitId)) return null;
  const [staticRes, aiRes] = await Promise.all([
    supabase
      .from("math_units")
      .select("id,school_level,grade,unit_key,title,description,sort_order,is_active")
      .eq("id", unitId)
      .eq("is_active", true)
      .maybeSingle<Omit<MathUnitRow, "source">>(),
    supabase
      .from("curriculum_units")
      .select("id,school_level,grade,unit_key,title:unit_name,description,sort_order:display_order,is_active")
      .eq("subject", "math")
      .eq("id", unitId)
      .eq("is_active", true)
      .maybeSingle<Omit<MathUnitRow, "source">>(),
  ]);
  if (staticRes.error) throw staticRes.error;
  if (aiRes.error) throw aiRes.error;
  if (staticRes.data) return { ...staticRes.data, source: "static" };
  if (aiRes.data) return { ...aiRes.data, source: "ai" };
  return null;
}

export async function listMathMissionsByUnit(unitId: string): Promise<MathMissionRow[]> {
  if (!isUuid(unitId)) return [];

  const [staticRes, aiMissions] = await Promise.all([
    supabase
      .from("math_missions")
      .select("id,unit_id,mission_key,title,scenario,essential_question,concept_summary,difficulty,estimated_minutes,is_active,created_at")
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .returns<Array<Omit<MathMissionRow, "source">>>(),
    getVisibleMathMissionsByUnit(unitId),
  ]);
  if (staticRes.error) throw staticRes.error;

  const staticMissions = (staticRes.data ?? []).map((row) => ({ ...row, source: "static" as const }));
  const normalizedAiMissions = aiMissions.map((mission) => mapPayloadMission(mission.id, mission.unit_id, mission.mission_json, mission.created_at));

  return [...staticMissions, ...normalizedAiMissions].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}

export async function listMathMissions(limit = 24): Promise<MathMissionRow[]> {
  const [staticRes, aiMissions] = await Promise.all([
    supabase
      .from("math_missions")
      .select("id,unit_id,mission_key,title,scenario,essential_question,concept_summary,difficulty,estimated_minutes,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Array<Omit<MathMissionRow, "source">>>(),
    fetchPublishedMissions(limit, "math"),
  ]);
  if (staticRes.error) throw staticRes.error;

  const staticMissions = (staticRes.data ?? []).map((row) => ({ ...row, source: "static" as const }));
  const normalizedAiMissions = aiMissions.map((mission) => mapPayloadMission(mission.id, mission.unit_id, mission.mission_json, mission.created_at));

  return [...staticMissions, ...normalizedAiMissions]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);
}

export async function getMathMissionById(missionId: string): Promise<MathMissionRow | null> {
  if (!isUuid(missionId)) return null;

  const staticRes = await supabase
    .from("math_missions")
    .select("id,unit_id,mission_key,title,scenario,essential_question,concept_summary,difficulty,estimated_minutes,is_active,created_at")
    .eq("id", missionId)
    .eq("is_active", true)
    .maybeSingle<Omit<MathMissionRow, "source">>();
  if (staticRes.error) throw staticRes.error;
  if (staticRes.data) return { ...staticRes.data, source: "static" };

  const aiMission = await fetchMissionById(missionId);
  if (!aiMission || aiMission.subject !== "math") return null;
  return mapPayloadMission(aiMission.id, aiMission.unit_id, aiMission.mission_json, aiMission.created_at);
}

export async function listMathStepsByMission(missionId: string): Promise<MathStepRow[]> {
  if (!isUuid(missionId)) return [];

  const staticRes = await supabase
    .from("math_steps")
    .select(
      "id,mission_id,step_order,title,question,input_placeholder,correct_answer,hint,feedback_correct,feedback_incorrect,step_type,concept_title,concept_description"
    )
    .eq("mission_id", missionId)
    .order("step_order", { ascending: true })
    .returns<Array<Omit<MathStepRow, "source">>>();
  if (staticRes.error) throw staticRes.error;
  if ((staticRes.data ?? []).length > 0) {
    return (staticRes.data ?? []).map((row) => ({ ...row, source: "static" as const }));
  }

  const aiMission = await fetchMissionById(missionId);
  if (!aiMission || aiMission.subject !== "math") return [];

  return aiMission.mission_json.steps.map((step, index) => ({
    id: `${missionId}:${index + 1}`,
    mission_id: missionId,
    step_order: step.stepOrder,
    title: step.title,
    question: step.question ?? null,
    input_placeholder: step.inputPlaceholder ?? null,
    correct_answer: step.correctAnswer ?? null,
    hint: step.hint ?? null,
    feedback_correct: step.feedbackCorrect ?? null,
    feedback_incorrect: step.feedbackIncorrect ?? null,
    step_type: step.stepType,
    concept_title: step.conceptTitle ?? null,
    concept_description: step.conceptDescription ?? null,
    source: "ai",
  }));
}

export async function getStudentMissionProgress(
  missionId: string,
  missionSource: MissionSource
): Promise<StudentMissionProgressRow | null> {
  if (!isUuid(missionId)) return null;
  const me = await getMeStudent();
  const { data, error } = await supabase
    .from("student_mission_progress")
    .select("user_id,mission_id,mission_source,current_step,status,answers_json,started_at,completed_at,updated_at")
    .eq("user_id", me.id)
    .eq("mission_id", missionId)
    .eq("mission_source", missionSource)
    .maybeSingle<StudentMissionProgressRow>();
  if (error) throw error;
  return data ?? null;
}

export async function upsertStudentMissionProgress(payload: {
  missionId: string;
  missionSource: MissionSource;
  currentStep: number;
  status: "in_progress" | "completed";
  answers: Record<string, string>;
}): Promise<void> {
  if (!isUuid(payload.missionId)) throw new Error("미션 정보가 올바르지 않습니다.");
  const me = await getMeStudent();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("student_mission_progress")
    .select("started_at")
    .eq("user_id", me.id)
    .eq("mission_id", payload.missionId)
    .eq("mission_source", payload.missionSource)
    .maybeSingle<{ started_at: string | null }>();
  if (existingError) throw existingError;

  const row: {
    user_id: string;
    mission_id: string;
    mission_source: MissionSource;
    current_step: number;
    status: "in_progress" | "completed";
    answers_json: Record<string, string>;
    started_at?: string;
    completed_at?: string | null;
  } = {
    user_id: me.id,
    mission_id: payload.missionId,
    mission_source: payload.missionSource,
    current_step: payload.currentStep,
    status: payload.status,
    answers_json: payload.answers,
  };

  if (!existing?.started_at) row.started_at = now;
  if (payload.status === "completed") row.completed_at = now;
  if (payload.status === "in_progress") row.completed_at = null;

  const { error } = await supabase.from("student_mission_progress").upsert(row, {
    onConflict: "user_id,mission_id,mission_source",
  });
  if (error) throw error;
}

export async function startMissionAttempt(payload: {
  missionId: string;
  missionSource: MissionSource;
}): Promise<string> {
  const me = await getMeStudent();
  const { data, error } = await supabase
    .from("mission_attempts")
    .insert({
      user_id: me.id,
      mission_id: payload.missionId,
      mission_source: payload.missionSource,
      status: "started",
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function recordMissionStepAttempt(payload: {
  attemptId: string;
  stepOrder: number;
  answerText: string;
  isCorrect: boolean;
}): Promise<void> {
  const { error } = await supabase.from("mission_step_attempts").insert({
    attempt_id: payload.attemptId,
    step_order: payload.stepOrder,
    answer_text: payload.answerText,
    is_correct: payload.isCorrect,
  });
  if (error) throw error;
}

export async function completeMissionAttempt(attemptId: string): Promise<void> {
  const { error } = await supabase
    .from("mission_attempts")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (error) throw error;
}
