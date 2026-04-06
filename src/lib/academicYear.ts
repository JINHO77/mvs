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
  if (normalizedLevel === "elementary") return grade;
  if (normalizedLevel === "middle") return grade + 6;
  return grade + 9;
}

export function formatCurriculumGradeLabel(grade: number | null | undefined): string {
  if (!isFiniteGrade(grade)) return "\uBBF8\uC815";
  if (grade <= 6) return `\uCD08${grade}`;
  if (grade <= 9) return `\uC911${grade - 6}`;
  return `\uACE0${grade - 9}`;
}

export function getEffectiveSchoolGrade(
  schoolLevel: AcademicSchoolLevel | null | undefined,
  grade: number | null | undefined,
  now: Date = new Date()
): EffectiveSchoolGrade | null {
  const normalizedLevel = toNormalizedSchoolLevel(schoolLevel);
  if (!normalizedLevel || !isFiniteGrade(grade)) return null;

  const effective = isAfterPromotionDate(now)
    ? getPromotedSchoolGrade(normalizedLevel, grade)
    : { schoolLevel: normalizedLevel, grade };

  if (!effective) return null;

  return {
    schoolLevel: effective.schoolLevel,
    grade: effective.grade,
    label: formatSchoolGrade(effective.schoolLevel, effective.grade),
    promoted: isAfterPromotionDate(now),
  };
}

export function getAcademicContentFallbackMessage(
  schoolLevel: AcademicSchoolLevel | null | undefined,
  grade: number | null | undefined,
  now: Date = new Date()
): string | null {
  const effective = getEffectiveSchoolGrade(schoolLevel, grade, now);
  if (!effective) return null;
  if (effective.schoolLevel !== "high") return null;
  return "\uACE0\uB4F1 \uCF58\uD150\uCE20\uB294 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4. \uD604\uC7AC\uB294 \uC9113 \uC2EC\uD654 \uBBF8\uC158\uC744 \uBA3C\uC800 \uCD94\uCC9C\uD569\uB2C8\uB2E4.";
}
