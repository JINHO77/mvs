import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { QUALITY_MISSIONS_6 } from "../src/data/missions/qualityMissions6";

type CurriculumUnitRow = {
  id: string;
  unit_key: string;
  school_level: "elementary" | "middle" | "high";
  grade: number;
  unit_name: string;
  is_active: boolean;
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

async function run() {
  loadEnvLocal();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("SUPABASE_URL missing");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const grades = Array.from(new Set(QUALITY_MISSIONS_6.map((m) => m.unit_lookup.grade)));

  const { data, error } = await supabase
    .from("curriculum_units")
    .select("id,unit_key,school_level,grade,unit_name,is_active")
    .in("grade", grades)
    .eq("is_active", true)
    .returns<CurriculumUnitRow[]>();

  if (error) throw error;

  const rows = data ?? [];
  const resolved = QUALITY_MISSIONS_6.map((mission) => {
    const found = rows.filter(
      (row) =>
        row.school_level === mission.unit_lookup.school_level &&
        row.grade === mission.unit_lookup.grade &&
        row.unit_name === mission.unit_lookup.unit_name
    );

    if (found.length !== 1) {
      const candidates = rows
        .filter((row) => row.school_level === mission.unit_lookup.school_level && row.grade === mission.unit_lookup.grade)
        .map((row) => ({ id: row.id, unit_name: row.unit_name, unit_key: row.unit_key }));
      throw new Error(
        `Unit match failed for ${mission.slug}. expected=${mission.unit_lookup.school_level}/${mission.unit_lookup.grade}/${mission.unit_lookup.unit_name} candidates=${JSON.stringify(candidates)}`
      );
    }

    return {
      slug: mission.slug,
      title: mission.title,
      subject: mission.subject,
      difficulty: mission.difficulty,
      estimated_minutes: mission.estimated_minutes,
      unit_id: found[0].id,
      unit_key: found[0].unit_key,
      unit_name: found[0].unit_name,
      school_level: found[0].school_level,
      grade: found[0].grade,
      mission_json: mission.mission_json,
    };
  });

  const outPath = path.resolve(process.cwd(), "docs/quality-missions-6.resolved.json");
  writeFileSync(outPath, JSON.stringify(resolved, null, 2), "utf8");

  console.log("[resolve] resolved count:", resolved.length);
  for (const row of resolved) {
    console.log(`[resolve] ${row.slug} -> unit_id=${row.unit_id} (${row.unit_name})`);
  }
  console.log("[resolve] wrote:", outPath);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[resolve] failed:", message);
  process.exit(1);
});
