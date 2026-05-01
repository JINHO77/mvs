export type SchoolLevel = "elementary" | "middle" | "high";

export const SCHOOL_LEVEL_OPTIONS = [
  { value: "elementary" as SchoolLevel, label: "초등" },
  { value: "middle" as SchoolLevel, label: "중등" },
  { value: "high" as SchoolLevel, label: "고등" },
] as const;

// 초/중/고 (축약)
const SHORT_LABELS: Record<string, string> = {
  elementary: "초",
  middle: "중",
  high: "고",
  // 레거시 호환
  elem: "초",
  mid: "중",
};

// 초등/중등/고등 (전체)
const FULL_LABELS: Record<string, string> = {
  elementary: "초등",
  middle: "중등",
  high: "고등",
  // 레거시 호환
  elem: "초등",
  mid: "중등",
};

export function getSchoolLevelLabel(level: string | null | undefined): string {
  if (!level) return "미입력";
  return SHORT_LABELS[level] ?? "미입력";
}

export function getSchoolLevelFullLabel(level: string | null | undefined): string {
  if (!level) return "미입력";
  return FULL_LABELS[level] ?? "미입력";
}

export function getGradeOptions(level: string | null | undefined): number[] {
  if (level === "elementary" || level === "elem") return [1, 2, 3, 4, 5, 6];
  if (level === "middle" || level === "mid" || level === "high") return [1, 2, 3];
  return [];
}

export function getStudentDisplayLabel(student: {
  school_level?: string | null;
  grade?: number | null;
  name?: string | null;
}): string {
  const level = getSchoolLevelLabel(student.school_level);
  const grade = student.grade != null ? `${student.grade}학년` : "";
  const name = student.name?.trim() || "이름없음";
  return [level !== "미입력" ? level : "", grade, name].filter(Boolean).join(" ");
}
