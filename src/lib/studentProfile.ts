import { formatSchoolGrade, type AcademicSchoolLevel } from "@/lib/academicYear";
import { getSchoolLevelFullLabel } from "@/lib/schoolLevel";

export type ProfileSchoolLevel = Extract<AcademicSchoolLevel, "elem" | "mid" | "high" | "elementary" | "middle">;

export function formatSchoolLevelLabel(level: string | null): string {
  return getSchoolLevelFullLabel(level);
}

export function formatSchoolGradeLabel(level: ProfileSchoolLevel | null, grade: number | null): string {
  return formatSchoolGrade(level, grade);
}
