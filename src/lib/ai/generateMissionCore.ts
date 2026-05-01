import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { MissionPayload } from "../../types/missions";
import { toMissionPayload, validateMission, type MissionValidationResult } from "./validateMission";

let cachedSupabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (cachedSupabaseAdmin) return cachedSupabaseAdmin;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("SUPABASE_URL missing");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  cachedSupabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedSupabaseAdmin;
}


type DbRecord = Record<string, unknown>;

type UnitTemplateMapRow = {
  id: string;
  unit_id: string;
  template_id: string;
  curriculum_units: DbRecord | null;
  mission_templates: DbRecord | null;
} & DbRecord;

type OpenAIChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type GenerateMissionFromMapResult = {
  mapId: string;
  unitId: string;
  templateId: string;
  unitName: string;
  templateTitle: string;
  validation: MissionValidationResult;
  mission: MissionPayload;
  generatedMissionId: string;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toDifficulty(value: unknown): "easy" | "normal" | "challenge" {
  if (value === "easy" || value === "normal" || value === "challenge") return value;
  return "normal";
}

function resolveUnitName(unit: DbRecord | null): string {
  return asNonEmptyString(unit?.unit_name) ?? asNonEmptyString(unit?.title) ?? "Learning Unit";
}

function resolveTemplateTitle(template: DbRecord | null): string {
  return asNonEmptyString(template?.title) ?? asNonEmptyString(template?.template_key) ?? "default-template";
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
}

function makeMissionKey(unitKey: string | null, templateKey: string | null): string {
  const unitPart = (unitKey ?? "unit").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const templatePart = (templateKey ?? "template").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `ai-${unitPart}-${templatePart}-${ts}`;
}

function buildPrompt(input: {
  unitName: string;
  schoolLevel: string;
  grade: number | null;
  templateType: string;
  templateTitle: string;
  scenarioPattern: string;
  difficulty: "easy" | "normal" | "challenge";
  stepSchema: unknown;
  unitKey: string | null;
  templateKey: string | null;
}): string {
  const gradeText = typeof input.grade === "number" ? `${input.grade} grade` : "grade unknown";
  const schemaText = JSON.stringify(input.stepSchema ?? {}, null, 2);
  const suggestedMissionKey = makeMissionKey(input.unitKey, input.templateKey);

  return [
    "You are creating a middle school math mission in Korean.",
    `Unit: ${input.unitName}`,
    `School level/grade: ${input.schoolLevel} / ${gradeText}`,
    `Template type: ${input.templateType}`,
    `Template title: ${input.templateTitle}`,
    `Scenario pattern: ${input.scenarioPattern || "real-life learning context"}`,
    `Difficulty: ${input.difficulty}`,
    "",
    "Follow all requirements below:",
    "1) Write all text in Korean",
    "2) Follow step_schema structure as closely as possible",
    "3) Include at least 3 steps",
    "4) For input/choice steps, include correctAnswer",
    "5) For input steps, include answerType and add acceptedAnswers/acceptedUnits when alternate valid expressions exist",
    "6) For every gradable step, include three progressive hints in hints[] that move from observation -> pattern/feature -> next action",
    "7) For choice steps, include at least 3 unique choices and do not always place the correct answer first",
    "8) Hints must never reveal the final answer directly and should avoid naming the formula immediately",
    "9) For every step, include solution.summary, solution.steps[], and solution.concept with understanding-focused explanations",
    "10) Output exactly one JSON object with no markdown",
    "",
    "Output JSON schema:",
    "{",
    `  \"missionKey\": \"${suggestedMissionKey}\",`,
    '  "title": "...",',
    '  "scenario": "...",',
    '  "essentialQuestion": "...",',
    '  "conceptSummary": "...",',
    '  "difficulty": "easy|normal|challenge",',
    '  "estimatedMinutes": 5,',
    '  "steps": [',
    "    {",
    '      "stepOrder": 1,',
    '      "stepType": "concept|input|choice|intro",',
    '      "title": "...",',
    '      "question": "...",',
    '      "answerType": "number|text",',
    '      "acceptedAnswers": ["..."],',
    '      "acceptedUnits": ["KRW"],',
    '      "choices": ["...", "...", "..."],',
    '      "correctAnswer": "...",',
    '      "hints": [{"level": 1, "text": "..."}, {"level": 2, "text": "..."}, {"level": 3, "text": "..."}],',
    '      "solution": {"summary": "...", "steps": ["...", "..."], "concept": "..."},',
    '      "explanation": "..."',
    "    }",
    "  ]",
    "}",
    "",
    "step_schema:",
    schemaText,
  ].join("\n");
}

async function fetchMapRow(mapId: string): Promise<UnitTemplateMapRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("unit_template_map")
    .select("*, curriculum_units(*), mission_templates(*)")
    .eq("id", mapId)
    .maybeSingle<UnitTemplateMapRow>();

  if (error) throw new Error(`Failed to load unit_template_map: ${error.message}`);
  if (!data) throw new Error(`unit_template_map not found: ${mapId}`);
  if (!data.curriculum_units) throw new Error(`curriculum_units relation missing for mapId=${mapId}`);
  if (!data.mission_templates) throw new Error(`mission_templates relation missing for mapId=${mapId}`);
  return data;
}

async function callOpenAI(prompt: string): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You generate structured Korean math missions. Output valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const json = (await response.json()) as OpenAIChatCompletionsResponse;
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${json.error?.message ?? "unknown error"}`);
  }

  const content = json.choices?.[0]?.message?.content;
  const cleanText = content ? stripCodeFence(content) : "";
  if (!cleanText) throw new Error("OpenAI returned empty content");

  try {
    return JSON.parse(cleanText);
  } catch {
    throw new Error("OpenAI returned non-JSON content");
  }
}

async function getGeneratedMissionColumns(): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "generated_missions")
    .returns<Array<{ column_name: string }>>();

  if (error || !data) return new Set<string>();
  return new Set(data.map((row) => row.column_name));
}

async function insertGeneratedMission(args: {
  unitId: string;
  templateId: string;
  mission: MissionPayload;
}): Promise<string> {
  const supabase = getSupabaseAdmin();
  const columns = await getGeneratedMissionColumns();

  const payload: Record<string, unknown> = {
    subject: "math",
    unit_id: args.unitId,
    template_id: args.templateId,
    title: args.mission.title,
    difficulty: args.mission.difficulty,
    estimated_minutes: args.mission.estimatedMinutes,
    source_type: "ai",
    status: "draft",
    is_active: true,
    mission_json: args.mission,
  };

  if (columns.has("scenario")) payload.scenario = args.mission.scenario;
  if (columns.has("essential_question")) payload.essential_question = args.mission.essentialQuestion;
  if (columns.has("concept_summary")) payload.concept_summary = args.mission.conceptSummary;

  const { data, error } = await supabase
    .from("generated_missions")
    .insert(payload as never)
    .select("id")
    .single<{ id: string }>();

  if (error) throw new Error(`Failed to insert generated_missions: ${error.message}`);
  return data.id;
}

export async function generateMissionFromMap(mapId: string): Promise<GenerateMissionFromMapResult> {
  const mapRow = await fetchMapRow(mapId);
  const unit = mapRow.curriculum_units as DbRecord;
  const template = mapRow.mission_templates as DbRecord;

  const unitName = resolveUnitName(unit);
  const templateTitle = resolveTemplateTitle(template);
  const schoolLevel = asNonEmptyString(unit.school_level) ?? "middle";
  const grade = typeof unit.grade === "number" ? unit.grade : null;
  const templateType =
    asNonEmptyString(template.template_type) ??
    asNonEmptyString(template.template_key) ??
    asNonEmptyString(template.source_type) ??
    "general";
  const scenarioPattern = asNonEmptyString(template.scenario_pattern) ?? asNonEmptyString(template.prompt_template) ?? "";
  const difficulty = toDifficulty(mapRow.difficulty ?? template.difficulty);
  const stepSchema = template.step_schema ?? template.output_schema ?? {};
  const unitKey = asNonEmptyString(unit.unit_key);
  const templateKey = asNonEmptyString(template.template_key);

  const prompt = buildPrompt({
    unitName,
    schoolLevel,
    grade,
    templateType,
    templateTitle,
    scenarioPattern,
    difficulty,
    stepSchema,
    unitKey,
    templateKey,
  });

  const raw = await callOpenAI(prompt);
  const validation = validateMission(raw);
  if (!validation.ok) {
    throw new Error(`Mission validation failed: ${validation.reason}`);
  }

  const mission = toMissionPayload(raw);
  if (!mission) {
    throw new Error("Mission payload normalization failed");
  }

  const generatedMissionId = await insertGeneratedMission({
    unitId: mapRow.unit_id,
    templateId: mapRow.template_id,
    mission,
  });

  return {
    mapId: mapRow.id,
    unitId: mapRow.unit_id,
    templateId: mapRow.template_id,
    unitName,
    templateTitle,
    validation,
    mission,
    generatedMissionId,
  };
}
