import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateMissionFromMap } from "../src/lib/ai/generateMissionCore";

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

  const mapId = process.argv[2];
  if (!mapId) {
    throw new Error("Usage: npx tsx scripts/testGenerateMission.ts <mapId>");
  }

  const result = await generateMissionFromMap(mapId);

  console.log("[generate] unit:", result.unitName);
  console.log("[generate] template:", result.templateTitle);
  console.log("[generate] validation:", result.validation.ok ? "ok" : result.validation.reason);
  console.log("[generate] generated_missions.id:", result.generatedMissionId);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[generate] failed:", message);
  process.exit(1);
});

