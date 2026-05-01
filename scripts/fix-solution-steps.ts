/**
 * fix-solution-steps.ts
 *
 * mission_json에 '한 번만 정해지는 값과' 패턴이 포함된 published 미션의
 * activities[0-3].solution.steps를 일괄 정리합니다.
 *
 * Run:  npx tsx scripts/fix-solution-steps.ts
 * Dry:  npx tsx scripts/fix-solution-steps.ts --dry
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ─── env ──────────────────────────────────────────────────────────────────────

function loadEnvLocal() {
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  필수 환경 변수가 없습니다: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const isDry = process.argv.includes("--dry");

// ─── 각 활동 위치별 고정 steps ───────────────────────────────────────────────

const FIXED_STEPS: Record<number, string[]> = {
  0: ["주어진 조건과 값을 파악해요", "공식 또는 개념을 적용해요", "계산 후 검산해요"],
  1: ["앞 단계 결과를 활용해요", "조건에 대입하거나 비교해요", "결론을 도출해요"],
  2: ["조건을 수식으로 나타내요", "풀이 과정을 단계별로 계산해요", "결과를 해석해요"],
  3: ["최종 조건을 확인해요", "계산 결과를 검산해요", "실생활 상황과 연결해요"],
};

const TARGET_PATTERN = "한 번만 정해지는 값과";

// ─── types ────────────────────────────────────────────────────────────────────

type Activity = {
  solution?: { steps?: string[] };
  [key: string]: unknown;
};

type MissionRow = {
  id: string;
  title: string;
  subject: string;
  difficulty: string;
  mission_json: { activities?: Activity[]; [key: string]: unknown };
};

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log("🔍  대상 미션 조회 중 (status=published, is_active=true)...");

  const { data, error } = await supabase
    .from("generated_missions")
    .select("id, title, subject, difficulty, mission_json")
    .eq("status", "published")
    .eq("is_active", true)
    .returns<MissionRow[]>();

  if (error) {
    console.error("❌  조회 실패:", error.message);
    process.exit(1);
  }

  const targets = (data ?? []).filter((row) => {
    const text = JSON.stringify(row.mission_json);
    return text.includes(TARGET_PATTERN);
  });

  if (targets.length === 0) {
    console.log(`✅  "${TARGET_PATTERN}" 패턴을 가진 미션이 없습니다.`);
    return;
  }

  console.log(`\n📋  수정 대상: ${targets.length}개 미션`);
  for (const m of targets) {
    const acts = m.mission_json.activities ?? [];
    console.log(`  • [${m.subject.toUpperCase()}][${m.difficulty}] ${m.title}  (activities: ${acts.length}개)`);
  }

  if (isDry) {
    console.log("\n🛑  --dry 모드: 실제 수정하지 않음. --dry 없이 다시 실행하면 적용됩니다.");
    return;
  }

  console.log("\n💾  수정 시작...\n");
  let success = 0;
  let failed = 0;

  for (const mission of targets) {
    const activities = (mission.mission_json.activities ?? []) as Activity[];

    const updatedActivities = activities.map((act, i) => {
      const fixedSteps = FIXED_STEPS[i];
      if (!fixedSteps) return act; // 인덱스 4 이상은 그대로
      return {
        ...act,
        solution: {
          ...(act.solution ?? {}),
          steps: fixedSteps,
        },
      };
    });

    const updatedJson = { ...mission.mission_json, activities: updatedActivities };

    const { error: updateError } = await supabase
      .from("generated_missions")
      .update({ mission_json: updatedJson })
      .eq("id", mission.id);

    if (updateError) {
      console.error(`  ❌  [${mission.id}] ${mission.title}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✅  [${mission.subject.toUpperCase()}] ${mission.title}`);
      success++;
    }
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`완료: ${success}개 성공 / ${failed}개 실패 / 총 ${targets.length}개`);
}

main().catch((err) => {
  console.error("🔥  스크립트 오류:", err);
  process.exit(1);
});
