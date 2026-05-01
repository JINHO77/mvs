/**
 * upgrade-missions.ts
 *
 * Fetches published + active missions that have no activities, generates
 * 4 activities per mission via Claude, and patches them back into Supabase.
 *
 * Run:  npx tsx scripts/upgrade-missions.ts
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// ─── env ─────────────────────────────────────────────────────────────────────

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
  console.error("❌  필수 환경 변수가 없습니다: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY");
  process.exit(1);
}

// ─── types ───────────────────────────────────────────────────────────────────

type Activity = {
  type: "concept_check" | "multiple_choice" | "short_answer";
  question: string;
  choices?: string[];
  correctAnswer: string;
  correctChoiceIndex?: number;
  hints: [string, string, string]; // [방향, 접근, 핵심]
  explanation: string;
};

type MissionRow = {
  id: string;
  subject: string;
  title: string;
  difficulty: string;
  mission_json: Record<string, unknown>;
};

// ─── clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── fetch missions ──────────────────────────────────────────────────────────

async function fetchMissionsNeedingUpgrade(): Promise<MissionRow[]> {
  const { data, error } = await supabase
    .from("generated_missions")
    .select("id, subject, title, difficulty, mission_json")
    .eq("status", "published")
    .eq("is_active", true)
    .returns<MissionRow[]>();

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);

  return (data ?? []).filter((row) => {
    const activities = (row.mission_json as Record<string, unknown>)?.activities;
    return !activities || (Array.isArray(activities) && activities.length === 0);
  });
}

// ─── prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(mission: MissionRow): string {
  const json = mission.mission_json as Record<string, unknown>;
  const subject = mission.subject === "math" ? "수학" : "영어";
  const focusNote =
    mission.subject === "math"
      ? "수학 계산 과정 중심으로, 각 단계의 계산 근거와 공식을 명확히 설명하세요."
      : "실제 영어 표현과 문법 포인트 중심으로, 자연스러운 사용 맥락을 포함하세요.";

  return `당신은 ${subject} 교육 콘텐츠 전문가입니다.
아래 미션 정보를 바탕으로 학습 활동(activities) 4개를 생성해 주세요.

## 미션 정보
- 제목: ${mission.title}
- 난이도: ${mission.difficulty}
- 시나리오: ${json.scenario ?? ""}
- 핵심 질문: ${json.essentialQuestion ?? ""}
- 개념 요약: ${json.conceptSummary ?? ""}

## 생성 규칙
${focusNote}

4개의 activity를 다음 순서로 생성하세요:
1. concept_check (개념 확인 — 1개)
2. multiple_choice (객관식 — 2개)
3. short_answer (단답형 — 1개)

## 각 activity 필드
- type: "concept_check" | "multiple_choice" | "short_answer"
- question: 질문 (구체적이고 명확하게)
- choices: string[] — multiple_choice일 때만, 4개 선택지
- correctAnswer: 정답 텍스트 (multiple_choice는 정답 선택지 텍스트)
- correctChoiceIndex: number — multiple_choice일 때만 (0~3)
- hints: 3개 문자열 배열 [방향 힌트, 접근 힌트, 핵심 힌트]
  - 방향 힌트: 어떤 개념이나 방향으로 접근할지 알려주는 힌트
  - 접근 힌트: 구체적인 풀이 접근법
  - 핵심 힌트: 거의 정답에 근접한 결정적 힌트
- explanation: 정답인 이유 + 오답을 고르기 쉬운 이유 + 실생활 의미 (한국어, 3~4문장)

## 출력 형식
반드시 아래 JSON만 출력하세요. 설명이나 마크다운 없이 JSON 배열만:

[
  {
    "type": "concept_check",
    "question": "...",
    "correctAnswer": "...",
    "hints": ["...", "...", "..."],
    "explanation": "..."
  },
  {
    "type": "multiple_choice",
    "question": "...",
    "choices": ["A", "B", "C", "D"],
    "correctAnswer": "B",
    "correctChoiceIndex": 1,
    "hints": ["...", "...", "..."],
    "explanation": "..."
  },
  {
    "type": "multiple_choice",
    "question": "...",
    "choices": ["A", "B", "C", "D"],
    "correctAnswer": "C",
    "correctChoiceIndex": 2,
    "hints": ["...", "...", "..."],
    "explanation": "..."
  },
  {
    "type": "short_answer",
    "question": "...",
    "correctAnswer": "...",
    "hints": ["...", "...", "..."],
    "explanation": "..."
  }
]`;
}

// ─── call Claude ─────────────────────────────────────────────────────────────

async function generateActivities(mission: MissionRow): Promise<Activity[]> {
  const prompt = buildPrompt(mission);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  // Extract JSON array from response (handle any accidental markdown)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`JSON 배열을 파싱할 수 없습니다.\n응답: ${raw.slice(0, 300)}`);
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length !== 4) {
    throw new Error(`activity 4개가 아닙니다 (받은 개수: ${Array.isArray(parsed) ? parsed.length : "?"}).`);
  }

  return parsed as Activity[];
}

// ─── save to Supabase ─────────────────────────────────────────────────────────

async function patchActivities(missionId: string, existing: Record<string, unknown>, activities: Activity[]): Promise<void> {
  const updatedJson = { ...existing, activities };

  const { error } = await supabase
    .from("generated_missions")
    .update({ mission_json: updatedJson })
    .eq("id", missionId);

  if (error) throw new Error(`Supabase update error: ${error.message}`);
}

// ─── delay ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍  업그레이드 대상 미션 조회 중...");
  const missions = await fetchMissionsNeedingUpgrade();

  if (missions.length === 0) {
    console.log("✅  업그레이드할 미션이 없습니다. (모두 activities 보유)");
    return;
  }

  console.log(`📋  대상: ${missions.length}개 미션\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < missions.length; i++) {
    const mission = missions[i]!;
    const prefix = `[${i + 1}/${missions.length}]`;

    console.log(`${prefix} ⚙️   ${mission.subject.toUpperCase()} | ${mission.title} (${mission.difficulty})`);

    try {
      const activities = await generateActivities(mission);

      const typeSummary = activities.map((a) => a.type).join(", ");
      console.log(`${prefix} ✔   생성 완료 → [${typeSummary}]`);

      await patchActivities(mission.id, mission.mission_json, activities);
      console.log(`${prefix} 💾  저장 완료\n`);
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${prefix} ❌  실패: ${message}\n`);
      failed++;
    }

    if (i < missions.length - 1) {
      await sleep(1500);
    }
  }

  console.log("─────────────────────────────────────");
  console.log(`완료: ${success}개 성공 / ${failed}개 실패 / 총 ${missions.length}개`);
}

main().catch((err) => {
  console.error("🔥  스크립트 오류:", err);
  process.exit(1);
});
