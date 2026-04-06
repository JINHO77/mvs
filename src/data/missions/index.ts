export { CURRICULUM_UNITS_SEED } from "./curriculumUnits";
export { MISSION_TEMPLATES_SEED } from "./missionTemplates";
export type { CurriculumUnitSeed, MissionSeed, MissionTemplateSeed } from "./types";

import { CURRICULUM_UNITS_SEED } from "./curriculumUnits";
import {
  ELEM4_MISSIONS,
  ELEM5_MISSIONS,
  ELEM6_MISSIONS,
  MIDDLE1_MISSIONS,
  MIDDLE2_MISSIONS,
  MIDDLE3_MISSIONS,
  allGeneratedMissionSeeds,
} from "./generatedMissions";
import { MISSION_TEMPLATES_SEED } from "./missionTemplates";

export { ELEM4_MISSIONS, ELEM5_MISSIONS, ELEM6_MISSIONS, MIDDLE1_MISSIONS, MIDDLE2_MISSIONS, MIDDLE3_MISSIONS };
export { allGeneratedMissionSeeds };

export const GENERATED_MISSIONS_SEED = allGeneratedMissionSeeds;

export const MATH_MISSIONS_SEED_SUMMARY = {
  units: CURRICULUM_UNITS_SEED.length,
  templates: MISSION_TEMPLATES_SEED.length,
  missions: GENERATED_MISSIONS_SEED.length,
};
export { QUALITY_MISSIONS_6 } from "./qualityMissions6";
