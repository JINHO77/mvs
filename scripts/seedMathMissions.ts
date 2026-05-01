import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  CURRICULUM_UNITS_SEED,
  GENERATED_MISSIONS_SEED,
  MISSION_TEMPLATES_SEED,
  MATH_MISSIONS_SEED_SUMMARY,
} from "../src/data/missions";
import type { MissionStep, MissionStepType } from "../src/types/missions";

type ExistingMissionRow = {
  id: string;
  unit_id: string;
  title: string;
};

function toRuntimeSteps(
  seedSteps: Array<{
    step_type: MissionStepType;
    step_title: string;
    description: string;
    question?: string;
    placeholder?: string;
    choices?: string[];
    correct_answer?: string;
    hint?: string;
  }>
): MissionStep[] {
  if (seedSteps.length === 0) {
    return [
      {
        stepOrder: 1,
        title: "준비 단계",
        stepType: "concept",
        conceptTitle: "상세 단계 준비중",
        conceptDescription: "다음 단계에서 이 미션의 상세 풀이 단계가 추가됩니다.",
      },
    ];
  }

  return seedSteps.map((step, index) => ({
    stepOrder: index + 1,
    title: step.step_title,
    stepType: step.step_type,
    question: step.question ?? undefined,
    explanation: step.description,
    inputPlaceholder: step.placeholder ?? undefined,
    correctAnswer: step.correct_answer ?? undefined,
    choices: step.choices ?? undefined,
    hint: step.hint ?? undefined,
    conceptTitle: step.step_type === "concept" ? step.step_title : undefined,
    conceptDescription: step.step_type === "concept" ? step.description : undefined,
  }));
}

function toRuntimeMissionPayload(mission: (typeof GENERATED_MISSIONS_SEED)[number]) {
  return {
    missionKey: mission.id,
    title: mission.mission_json.mission_title,
    scenario: mission.scenario,
    essentialQuestion: `${mission.mission_json.concept_summary}를 실제 상황에 적용해 볼까요?`,
    conceptSummary: mission.mission_json.concept_summary,
    difficulty: mission.difficulty,
    estimatedMinutes: mission.estimated_minutes,
    steps: toRuntimeSteps(mission.mission_json.steps),
  };
}

function loadEnvLocal() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function run() {
  loadEnvLocal();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL(or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[seed] summary", MATH_MISSIONS_SEED_SUMMARY);

  const { error: unitsError } = await supabase.from("curriculum_units").upsert(
    CURRICULUM_UNITS_SEED.map((unit) => ({
      unit_key: unit.unit_key,
      subject: unit.subject,
      school_level: unit.school_level,
      grade: unit.grade,
      title: unit.unit_name,
      description: unit.description,
      concept_summary: unit.concept_summary,
      sort_order: unit.sort_order,
      is_active: true,
    })),
    { onConflict: "unit_key" }
  );
  if (unitsError) throw unitsError;
  console.log(`[seed] upserted units: ${CURRICULUM_UNITS_SEED.length}`);

  const { data: unitRows, error: unitReadError } = await supabase
    .from("curriculum_units")
    .select("id,unit_key")
    .in(
      "unit_key",
      CURRICULUM_UNITS_SEED.map((u) => u.unit_key)
    )
    .returns<Array<{ id: string; unit_key: string }>>();
  if (unitReadError) throw unitReadError;

  const unitIdByKey = new Map((unitRows ?? []).map((row) => [row.unit_key, row.id]));

  const { error: templatesError } = await supabase.from("mission_templates").upsert(
    MISSION_TEMPLATES_SEED.map((template) => ({
      template_key: template.template_key,
      subject: template.subject,
      source_type: template.source_type,
      title: template.title,
      prompt_template: template.prompt_template,
      output_schema: template.output_schema,
      is_active: template.is_active,
    })),
    { onConflict: "template_key" }
  );
  if (templatesError) throw templatesError;
  console.log(`[seed] upserted templates: ${MISSION_TEMPLATES_SEED.length}`);

  const { data: templateRows, error: templateReadError } = await supabase
    .from("mission_templates")
    .select("id,template_key")
    .in(
      "template_key",
      MISSION_TEMPLATES_SEED.map((t) => t.template_key)
    )
    .returns<Array<{ id: string; template_key: string }>>();
  if (templateReadError) throw templateReadError;

  const templateIdByKey = new Map((templateRows ?? []).map((row) => [row.template_key, row.id]));

  const targetUnitIds = Array.from(new Set(Array.from(unitIdByKey.values())));
  const { data: existingRows, error: existingError } = await supabase
    .from("generated_missions")
    .select("id,unit_id,title")
    .in("unit_id", targetUnitIds)
    .returns<ExistingMissionRow[]>();
  if (existingError) throw existingError;

  const existingByUnitTitle = new Map(
    (existingRows ?? []).map((row) => [`${row.unit_id}::${row.title}`, row.id])
  );

  let inserted = 0;
  let updated = 0;

  for (const mission of GENERATED_MISSIONS_SEED) {
    const unitId = unitIdByKey.get(mission.unit_key);
    if (!unitId) {
      throw new Error(`Missing curriculum unit for unit_key=${mission.unit_key}`);
    }

    const templateId = templateIdByKey.get(mission.template_key) ?? null;
    const dedupeKey = `${unitId}::${mission.title}`;

    const payload = {
      subject: "math",
      unit_id: unitId,
      template_id: templateId,
      title: mission.title,
      difficulty: mission.difficulty,
      estimated_minutes: mission.estimated_minutes,
      source_type: mission.source_type,
      status: mission.status,
      mission_json: toRuntimeMissionPayload(mission),
      quality_notes: mission.quality_notes ?? null,
      is_active: true,
      published_at: mission.status === "published" ? new Date().toISOString() : null,
    };

    const existingId = existingByUnitTitle.get(dedupeKey);
    if (existingId) {
      const { error } = await supabase.from("generated_missions").update(payload).eq("id", existingId);
      if (error) throw error;
      updated += 1;
      continue;
    }

    const { data, error } = await supabase
      .from("generated_missions")
      .insert(payload)
      .select("id")
      .single<{ id: string }>();
    if (error) throw error;
    inserted += 1;
    existingByUnitTitle.set(dedupeKey, data.id);
  }

  console.log(`[seed] missions inserted=${inserted}, updated=${updated}, total=${GENERATED_MISSIONS_SEED.length}`);
  console.log("[seed] done");
}

run().catch((error: unknown) => {
  console.error("[seed] failed", error);
  process.exit(1);
});
