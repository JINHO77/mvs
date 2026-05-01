export type AcademicSchoolLevel = "elem" | "mid" | "high" | "elementary" | "middle";

export type EffectiveSchoolGrade = {
  schoolLevel: "elementary" | "middle" | "high";
  grade: number;
  label: string;
  promoted: boolean;
};

function toNormalizedSchoolLevel(level: AcademicSchoolLevel | null | undefined): "elementary" | "middle" | "high" | null {
  if (level === "elem" || level === "elementary") return "elementary";
  if (level === "mid" || level === "middle") return "middle";
  if (level === "high") return "high";
  return null;
}

function isFiniteGrade(grade: number | null | undefined): grade is number {
  return typeof grade === "number" && Number.isFinite(grade);
}

export function isAfterPromotionDate(now: Date = new Date()): boolean {
  const year = now.getFullYear();
  const promotionDate = new Date(year, 2, 1);
  return now >= promotionDate;
}

export function getPromotedSchoolGrade(
  schoolLevel: AcademicSchoolLevel | null | undefined,
  grade: number | null | undefined
): { schoolLevel: "elementary" | "middle" | "high"; grade: number } | null {
  const normalizedLevel = toNormalizedSchoolLevel(schoolLevel);
  if (!normalizedLevel || !isFiniteGrade(grade)) return null;

  if (normalizedLevel === "elementary") {
    if (grade >= 6) return { schoolLevel: "middle", grade: 1 };
    return { schoolLevel: "elementary", grade: Math.max(1, grade + 1) };
  }

  if (normalizedLevel === "middle") {
    if (grade >= 3) return { schoolLevel: "high", grade: 1 };
    return { schoolLevel: "middle", grade: Math.max(1, grade + 1) };
  }

  if (grade >= 3) return { schoolLevel: "high", grade: 3 };
  return { schoolLevel: "high", grade: Math.max(1, grade + 1) };
}

export function formatSchoolGrade(
  schoolLevel: AcademicSchoolLevel | null | undefined,
  grade: number | null | undefined
): string {
  const normalizedLevel = toNormalizedSchoolLevel(schoolLevel);
  if (!normalizedLevel || !isFiniteGrade(grade)) return "\uBBF8\uC815";
  if (normalizedLevel === "elementary") return `\uCD08${grade}`;
  if (normalizedLevel === "middle") return `\uC911${grade}`;
  return `\uACE0${grade}`;
}

export function toCurriculumGradeNumber(
  schoolLevel: AcademicSchoolLevel | null | undefined,
  grade: number | null | undefined
): number | null {
  const normalizedLevel = toNormalizedSchoolLevel(schoolLevel);
  if (!normalizedLevel || !isFiniteGrade(grade)) return null;
  return grade;
}

export function formatCurriculumGradeLabel(grade: number | null | undefined, schoolLevel?: string): string {
  if (!isFiniteGrade(grade)) return "\uBBF8\uC815";
  if (schoolLevel === "high") return `\uACE0${grade}`;
  if (schoolLevel === "middle") return `\uC911${grade}`;
  if (schoolLevel === "elementary") return `\uCD08${grade}`;
  return String(grade);
}

export function getEffectiveSchoolGrade(
  schoolLevel: AcademicSchoolLevel | null | undefined,
  grade: number | null | undefined,
  _now: Date = new Date()
): EffectiveSchoolGrade | null {
  // Profile is the source of truth — do not auto-promote across the March 1 boundary.
  // Auto-promotion was previously bumping current 중3/고1 students into the next school level
  // and surfacing as wrong grade labels and off-grade recommendations. Profile updates are
  // now expected to happen out-of-band when a student advances.
  const normalizedLevel = toNormalizedSchoolLevel(schoolLevel);
  if (!normalizedLevel || !isFiniteGrade(grade)) return null;

  return {
    schoolLevel: normalizedLevel,
    grade,
    label: formatSchoolGrade(normalizedLevel, grade),
    promoted: false,
  };
}

export function getAcademicContentFallbackMessage(
  _schoolLevel: AcademicSchoolLevel | null | undefined,
  _grade: number | null | undefined,
  _now: Date = new Date()
): string | null {
  // Empty-state copy now lives at the call site so it reflects the actual selected tab and
  // whether the v_student_effective_grade view returned \uC608\uC2B5 \uBAA8\uB4DC. The DB is the single source
  // of truth for which (school_level, grade) buckets have published content.
  return null;
}
