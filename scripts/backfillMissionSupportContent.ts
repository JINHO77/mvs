import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normalizeMissionStepContent } from "../src/lib/missionAnswers";
import type { MissionStep } from "../src/types/missions";

type MissionRow = {
  id: string;
  subject: "math" | "english";
  title: string;
  mission_json: unknown;
};

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  return values.length > 0 ? values : undefined;
}

function removeLegacyHintFields<T extends Record<string, unknown>>(value: T): T {
  const next = { ...value };
  delete next.hint;
  delete next.hintLevel1;
  delete next.hintLevel2;
  delete next.hint_level1;
  delete next.hint_level2;
  return next;
}

function toStandardStep(value: unknown, index: number): MissionStep | null {
  if (!isObject(value)) return null;
  const title = asString(value.title);
  const stepType = asString(value.stepType) ?? asString(value.step_type) ?? asString(value.type);
  if (!title) return null;
  if (stepType !== "intro" && stepType !== "input" && stepType !== "choice" && stepType !== "concept") return null;

  return {
    stepOrder: typeof value.stepOrder === "number" ? value.stepOrder : index + 1,
    title,
    stepType,
    question: asString(value.question) ?? asString(value.prompt) ?? undefined,
    explanation: asString(value.explanation) ?? asString(value.description) ?? asString(value.content) ?? undefined,
    inputPlaceholder: asString(value.inputPlaceholder) ?? asString(value.placeholder) ?? undefined,
    answerType:
      value.answerType === "number" || value.answerType === "text" || value.answerType === "equation"
        ? value.answerType
        : (asString(value.answer_type) as MissionStep["answerType"] | null) ?? undefined,
    correctAnswer: asString(value.correctAnswer) ?? asString(value.correct_answer) ?? asString(value.answer) ?? undefined,
    acceptedAnswers: asStringArray(value.acceptedAnswers) ?? asStringArray(value.accepted_answers),
    acceptedUnits: asStringArray(value.acceptedUnits) ?? asStringArray(value.accepted_units),
    choices: asStringArray(value.choices),
    hint: asString(value.hint) ?? undefined,
    hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? undefined,
    hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? undefined,
    conceptTitle: asString(value.conceptTitle) ?? undefined,
    conceptDescription: asString(value.conceptDescription) ?? undefined,
  };
}

function toLegacyActivityStep(value: unknown, index: number): MissionStep | null {
  if (!isObject(value)) return null;
  const rawType = asString(value.type);
  const prompt = asString(value.prompt);
  const explanation = asString(value.explanation);
  const title = asString(value.title) ?? prompt ?? explanation ?? `Step ${index + 1}`;
  const answerType = asString(value.answerType) ?? asString(value.answer_type);
  const acceptedAnswers = asStringArray(value.acceptedAnswers) ?? asStringArray(value.accepted_answers);
  const options = asStringArray(value.options);

  if (rawType === "choice") {
    const answerIndex = typeof value.answer === "number" && Number.isFinite(value.answer) ? value.answer : null;
    const correctAnswer =
      answerIndex !== null && options && options[answerIndex] ? options[answerIndex] : asString(value.answer);

    return {
      stepOrder: index + 1,
      title,
      stepType: "choice",
      question: prompt ?? undefined,
      explanation: explanation ?? undefined,
      choices: options,
      correctAnswer: correctAnswer ?? undefined,
      acceptedAnswers,
      hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? undefined,
      hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? undefined,
    };
  }

  if (rawType === "short_answer" || rawType === "input") {
    return {
      stepOrder: index + 1,
      title,
      stepType: "input",
      question: prompt ?? undefined,
      explanation: explanation ?? undefined,
      answerType: answerType === "number" || answerType === "equation" ? answerType : "text",
      correctAnswer: asString(value.answer) ?? undefined,
      acceptedAnswers,
      inputPlaceholder: asString(value.placeholder) ?? undefined,
      hintLevel1: asString(value.hintLevel1) ?? asString(value.hint_level1) ?? undefined,
      hintLevel2: asString(value.hintLevel2) ?? asString(value.hint_level2) ?? undefined,
    };
  }

  if (rawType === "scenario_response" || rawType === "concept") {
    const guide = asStringArray(value.guide)?.join("\n");
    return {
      stepOrder: index + 1,
      title,
      stepType: "concept",
      question: prompt ?? undefined,
      explanation: [explanation, guide].filter(Boolean).join("\n") || undefined,
      conceptTitle: title,
      conceptDescription: [prompt, guide].filter(Boolean).join("\n") || undefined,
    };
  }

  return {
    stepOrder: index + 1,
    title,
    stepType: "intro",
    question: prompt ?? undefined,
    explanation: explanation ?? undefined,
  };
}

function buildContext(row: MissionRow, raw: Record<string, unknown>) {
  return {
    subject: row.subject,
    missionTitle: row.title,
    scenario: asString(raw.scenario) ?? (isObject(raw.intro) ? asString(raw.intro.text) : null),
    conceptSummary:
      asString(raw.conceptSummary) ??
      asString(raw.concept_summary) ??
      asString(raw.theme) ??
      (isObject(raw.wrapUp) ? asString(raw.wrapUp.prompt) : null),
  } as const;
}

function updateStandardPayload(row: MissionRow, raw: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(raw.steps)) return null;
  const context = buildContext(row, raw);

  const nextSteps = raw.steps.map((rawStep, index) => {
    const runtimeStep = toStandardStep(rawStep, index);
    if (!runtimeStep || !isObject(rawStep)) return rawStep;
    const content = normalizeMissionStepContent(runtimeStep, context);
    return {
      ...removeLegacyHintFields(rawStep),
      hints: content.hints,
      solution: content.solution,
    };
  });

  return {
    ...raw,
    steps: nextSteps,
  };
}

function updateAlternatePayload(row: MissionRow, raw: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(raw.activities)) return null;
  const context = buildContext(row, raw);

  const nextActivities = raw.activities.map((rawActivity, index) => {
    const runtimeStep = toLegacyActivityStep(rawActivity, index);
    if (!runtimeStep || !isObject(rawActivity)) return rawActivity;
    const content = normalizeMissionStepContent(runtimeStep, context);
    return {
      ...removeLegacyHintFields(rawActivity),
      hints: content.hints,
      solution: content.solution,
    };
  });

  return {
    ...raw,
    activities: nextActivities,
  };
}

function updateMissionJson(row: MissionRow): Record<string, unknown> | null {
  if (!isObject(row.mission_json)) return null;
  const raw = row.mission_json;
  return updateStandardPayload(row, raw) ?? updateAlternatePayload(row, raw);
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

  const { data, error } = await supabase
    .from("generated_missions")
    .select("id,subject,title,mission_json")
    .in("subject", ["math", "english"])
    .returns<MissionRow[]>();
  if (error) throw error;

  let updated = 0;
  let skipped = 0;

  for (const row of data ?? []) {
    const nextMissionJson = updateMissionJson(row);
    if (!nextMissionJson) {
      skipped += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("generated_missions")
      .update({ mission_json: nextMissionJson })
      .eq("id", row.id);
    if (updateError) throw updateError;
    updated += 1;
  }

  console.log(`[backfillMissionSupportContent] updated=${updated} skipped=${skipped}`);
}

run().catch((error: unknown) => {
  console.error("[backfillMissionSupportContent] failed", error);
  process.exit(1);
});
