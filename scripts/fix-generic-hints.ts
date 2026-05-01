/**
 * fix-generic-hints.ts
 *
 * generated_missions 테이블에서 형식적인 힌트를 가진 활동(activities)을 찾아
 * Claude API로 문제 내용 기반의 구체적인 힌트로 교체합니다.
 *
 * Run:  npx tsx scripts/fix-generic-hints.ts
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// ─── env ─────────────────────────────────────────────────────────────────────

function loadEnvLocal() {
  // Try script-relative path first, then cwd
  let envPath: string;
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    envPath = path.resolve(__dirname, "../.env.local");
  } catch {
    envPath = path.resolve(process.cwd(), ".env.local");
  }
  if (!existsSync(envPath)) {
    envPath = path.resolve(process.cwd(), ".env.local");
  }
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error(
    "❌  필수 환경 변수가 없습니다: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY"
  );
  process.exit(1);
}

// ─── types ───────────────────────────────────────────────────────────────────

type HintObject = { text: string; level: 1 | 2 | 3 };

type Activity = {
  type: string;
  prompt?: string;
  question?: string;
  options?: string[];
  choices?: string[];
  answer?: unknown;
  correctAnswer?: string;
  correctChoiceIndex?: number;
  hints?: unknown;
  explanation?: string;
  [key: string]: unknown;
};

type MissionRow = {
  id: string;
  subject: string;
  title: string;
  difficulty: string;
  mission_json: Record<string, unknown>;
};

// ─── pattern detection ───────────────────────────────────────────────────────

const GENERIC_PATTERNS = [
  "마지막에 알고 싶은",
  "누가 누구에게",
  "한 번만 정해지는",
  "중간 정보에서 마지막",
  "목표에 도달하기 전에",
];

function extractHintText(hint: unknown): string {
  if (typeof hint === "string") return hint;
  if (typeof hint === "object" && hint !== null && "text" in hint) {
    return String((hint as HintObject).text);
  }
  return "";
}

function isGenericHint(hint: unknown): boolean {
  const text = extractHintText(hint);
  return GENERIC_PATTERNS.some((pattern) => text.includes(pattern));
}

function activityHasGenericHints(activity: Activity): boolean {
  const hints = activity.hints;
  if (!hints) return false;
  if (Array.isArray(hints)) {
    return hints.some((h) => isGenericHint(h));
  }
  return false;
}

function missionNeedsFixing(row: MissionRow): boolean {
  const activities = row.mission_json.activities;
  if (!Array.isArray(activities)) return false;
  return (activities as Activity[]).some((a) => activityHasGenericHints(a));
}

// ─── clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── fetch ───────────────────────────────────────────────────────────────────

async function fetchAllMissionsWithActivities(): Promise<MissionRow[]> {
  const { data, error } = await supabase
    .from("generated_missions")
    .select("id, subject, title, difficulty, mission_json")
    .returns<MissionRow[]>();

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);

  return (data ?? []).filter((row) => {
    const activities = row.mission_json?.activities;
    return Array.isArray(activities) && activities.length > 0;
  });
}

// ─── prompt ──────────────────────────────────────────────────────────────────

function buildHintPrompt(mission: MissionRow): string {
  const json = mission.mission_json;
  const subject = mission.subject === "math" ? "수학" : "영어";
  const activities = json.activities as Activity[];

  const activitiesText = activities.map((act, i) => {
    const question = act.prompt ?? act.question ?? "";
    const options = act.options ?? act.choices ?? [];
    const answer =
      typeof act.answer === "number" && options.length > 0
        ? options[act.answer as number] ?? String(act.answer)
        : act.correctAnswer ?? String(act.answer ?? "");

    return `[활동 ${i + 1}] type=${act.type}
질문: ${question}
${options.length > 0 ? `선택지: ${options.join(" / ")}` : ""}
정답: ${answer}`;
  }).join("\n\n");

  return `당신은 ${subject} 교육 콘텐츠 전문가입니다.
아래 미션의 각 활동(activity)에 대해 3단계 힌트를 새로 생성해 주세요.

## 미션 정보
- 제목: ${mission.title}
- 난이도: ${mission.difficulty}
- 시나리오: ${String(json.scenario ?? "")}
- 개념 요약: ${String(json.conceptSummary ?? json.concept_summary ?? "")}

## 활동 목록 (${activities.length}개)
${activitiesText}

## 힌트 생성 규칙
각 활동마다 정확히 3단계 힌트를 생성하세요:
- 힌트1 (level 1): 문제의 핵심 개념/상황 방향 제시 — 어떤 개념으로 접근할지 알려주는 구체적 힌트
- 힌트2 (level 2): 풀이 접근법 — 수식, 단어, 패턴 등 구체적인 방법 명시
- 힌트3 (level 3): 결정적 단서 — 거의 정답에 가까운 핵심 힌트

주의:
- "마지막에 알고 싶은", "누가 누구에게", "한 번만 정해지는" 같은 모호한 표현 사용 금지
- 실제 문제 내용(질문, 정답, 선택지)을 반드시 반영한 구체적 힌트 작성
- 각 힌트는 한국어로 1~2문장

## 출력 형식
반드시 아래 JSON만 출력하세요. 설명이나 마크다운 없이 JSON 배열만.
활동 개수(${activities.length}개)와 정확히 동일한 원소를 가진 배열:

[
  {
    "hints": [
      {"text": "...", "level": 1},
      {"text": "...", "level": 2},
      {"text": "...", "level": 3}
    ]
  }
]`;
}

// ─── call Claude ─────────────────────────────────────────────────────────────

async function generateFixedHints(
  mission: MissionRow
): Promise<HintObject[][]> {
  const prompt = buildHintPrompt(mission);
  const activities = mission.mission_json.activities as Activity[];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`JSON 배열을 파싱할 수 없습니다.\n응답: ${raw.slice(0, 300)}`);
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error(`배열 형식이 아닙니다.`);
  }
  if (parsed.length !== activities.length) {
    throw new Error(
      `활동 개수 불일치: 예상 ${activities.length}개, 받은 ${parsed.length}개`
    );
  }

  return parsed.map((item, i) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !Array.isArray((item as Record<string, unknown>).hints)
    ) {
      throw new Error(`활동 ${i + 1}의 hints 형식이 올바르지 않습니다.`);
    }
    const hints = (item as { hints: unknown[] }).hints;
    if (hints.length !== 3) {
      throw new Error(`활동 ${i + 1}의 hints가 3개가 아닙니다 (${hints.length}개).`);
    }
    return hints as HintObject[];
  });
}

// ─── patch ───────────────────────────────────────────────────────────────────

async function patchHints(
  missionId: string,
  existing: Record<string, unknown>,
  hintsList: HintObject[][]
): Promise<void> {
  const activities = existing.activities as Activity[];
  const updatedActivities = activities.map((act, i) => ({
    ...act,
    hints: hintsList[i],
  }));

  const updatedJson = { ...existing, activities: updatedActivities };

  const { error } = await supabase
    .from("generated_missions")
    .update({ mission_json: updatedJson })
    .eq("id", missionId);

  if (error) throw new Error(`Supabase update error: ${error.message}`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function describeGenericActivities(row: MissionRow): string {
  const activities = row.mission_json.activities as Activity[];
  return activities
    .map((act, i) => {
      if (!activityHasGenericHints(act)) return null;
      const hints = Array.isArray(act.hints) ? act.hints : [];
      const bad = hints
        .map((h) => extractHintText(h))
        .filter((t) => GENERIC_PATTERNS.some((p) => t.includes(p)));
      return `  활동${i + 1}: "${bad[0]?.slice(0, 40)}..."`;
    })
    .filter(Boolean)
    .join("\n");
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍  미션 전체 조회 중...");
  const allMissions = await fetchAllMissionsWithActivities();
  console.log(`   activities 보유 미션: ${allMissions.length}개`);

  const targets = allMissions.filter(missionNeedsFixing);

  if (targets.length === 0) {
    console.log("✅  형식적 힌트를 가진 미션이 없습니다.");
    return;
  }

  console.log(`\n📋  수정 대상: ${targets.length}개 미션\n`);
  targets.forEach((m) => {
    console.log(`  • [${m.subject.toUpperCase()}] ${m.title}`);
    console.log(describeGenericActivities(m));
  });
  console.log();

  let success = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const mission = targets[i]!;
    const prefix = `[${i + 1}/${targets.length}]`;

    console.log(
      `${prefix} ⚙️   ${mission.subject.toUpperCase()} | ${mission.title} (${mission.difficulty})`
    );

    try {
      const hintsList = await generateFixedHints(mission);
      console.log(
        `${prefix} ✔   힌트 생성 완료 (${hintsList.length}개 활동 × 3단계)`
      );

      await patchHints(mission.id, mission.mission_json, hintsList);
      console.log(`${prefix} 💾  저장 완료\n`);
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${prefix} ❌  실패: ${message}\n`);
      failed++;
    }

    if (i < targets.length - 1) {
      await sleep(1500);
    }
  }

  console.log("─────────────────────────────────────");
  console.log(
    `완료: ${success}개 성공 / ${failed}개 실패 / 총 ${targets.length}개`
  );
}

main().catch((err) => {
  console.error("🔥  스크립트 오류:", err);
  process.exit(1);
});
