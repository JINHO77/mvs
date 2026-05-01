import type { BadgeVariant } from "@/components/ui/Badge";

export type AnnouncementAudienceRole = "all" | "student" | "parent" | "staff";
export type AnnouncementTargetScope = "all" | "school_level" | "grade" | "class" | "student";
export type AnnouncementCategory = "general" | "report" | "urgent" | "event" | "schedule" | "consultation";
export type AnnouncementPriority = "urgent" | "high" | "normal" | "low";
export type AnnouncementDeliveryMode = "now" | "scheduled";
export type SchoolLevel = "elementary" | "middle" | "high";

export const ANNOUNCEMENT_CATEGORY_OPTIONS: Array<{
  value: AnnouncementCategory;
  label: string;
  badgeVariant: BadgeVariant;
}> = [
  { value: "general", label: "일반", badgeVariant: "neutral" },
  { value: "report", label: "리포트", badgeVariant: "success" },
  { value: "urgent", label: "긴급", badgeVariant: "danger" },
  { value: "event", label: "행사", badgeVariant: "info" },
  { value: "schedule", label: "일정", badgeVariant: "warning" },
  { value: "consultation", label: "상담", badgeVariant: "neutral" },
];

export const ANNOUNCEMENT_AUDIENCE_OPTIONS: Array<{
  value: AnnouncementAudienceRole;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "student", label: "학생" },
  { value: "parent", label: "학부모" },
  { value: "staff", label: "교직원" },
];

export const ANNOUNCEMENT_TARGET_SCOPE_OPTIONS: Array<{
  value: AnnouncementTargetScope;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "school_level", label: "학교급" },
  { value: "grade", label: "학년" },
  { value: "class", label: "반" },
  { value: "student", label: "개별 학생" },
];

export const SCHOOL_LEVEL_OPTIONS: Array<{ value: SchoolLevel; label: string }> = [
  { value: "elementary", label: "초등" },
  { value: "middle", label: "중등" },
  { value: "high", label: "고등" },
];

export function getAnnouncementCategoryLabel(category: string | null | undefined): string {
  return ANNOUNCEMENT_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "일반";
}

export function getAnnouncementCategoryBadgeVariant(category: string | null | undefined): BadgeVariant {
  return ANNOUNCEMENT_CATEGORY_OPTIONS.find((option) => option.value === category)?.badgeVariant ?? "neutral";
}

export function getSchoolLevelLabel(level: string | null | undefined): string {
  return SCHOOL_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? "-";
}

export function getGradeOptions(level: SchoolLevel | ""): number[] {
  if (level === "elementary") return [1, 2, 3, 4, 5, 6];
  if (level === "middle" || level === "high") return [1, 2, 3];
  return [1, 2, 3, 4, 5, 6];
}
