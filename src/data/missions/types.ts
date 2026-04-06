import type { MissionSeed as BaseMissionSeed } from "@/types/missions";

export type MissionMetaStep = BaseMissionSeed["mission_json"]["steps"][number];
export type MissionMetaJson = BaseMissionSeed["mission_json"];

export type CurriculumUnitSeed = {
  unit_key: string;
  subject: "math";
  school_level: "elementary" | "middle";
  grade: number;
  unit_name: string;
  description: string;
  concept_summary: string;
  sort_order: number;
};

export type MissionTemplateSeed = {
  template_key: string;
  subject: "math";
  source_type: "manual" | "ai";
  title: string;
  prompt_template: string;
  output_schema: Record<string, unknown>;
  is_active: boolean;
};

export type MissionSeed = BaseMissionSeed;
