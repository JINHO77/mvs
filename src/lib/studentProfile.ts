import { formatSchoolGrade, type AcademicSchoolLevel } from "@/lib/academicYear";

export type ProfileSchoolLevel = Extract<AcademicSchoolLevel, "elem" | "mid" | "high">;

export function formatSchoolLevelLabel(level: ProfileSchoolLevel | null): string {
  if (level === "elem") return "\uCD08\uB4F1";
  if (level === "mid") return "\uC911\uB4F1";
  if (level === "high") return "\uACE0\uB4F1";
  return "\uBBF8\uC815";
}

export function formatSchoolGradeLabel(level: ProfileSchoolLevel | null, grade: number | null): string {
  return formatSchoolGrade(level, grade);
}
