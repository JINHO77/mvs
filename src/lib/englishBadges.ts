import { evaluateBadgesForStudent, getBadgeDefinitions, getBadgeProgress, getStudentBadgeShowcase } from "@/lib/badges";
import type { BadgeDefinition, BadgeKey, BadgeShowcase, EarnedBadgeSummary } from "@/types/badges";

export type EnglishBadgeKey = BadgeKey;
export type EnglishBadgeDefinition = BadgeDefinition;

export const ENGLISH_BADGE_DEFINITIONS: EnglishBadgeDefinition[] = getBadgeDefinitions("english").filter(
  (badge): badge is EnglishBadgeDefinition => badge.subject === "english"
);

export async function getStudentEnglishBadges(studentId?: string): Promise<EarnedBadgeSummary[]> {
  const badges = await getBadgeProgress(studentId, "english");
  return badges
    .filter((badge) => badge.earned && Boolean(badge.earnedAt))
    .map((badge) => ({
      key: badge.key,
      subject: badge.subject,
      title: badge.title,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      iconUrl: badge.iconUrl,
      conditionType: badge.conditionType,
      conditionValue: badge.conditionValue,
      isActive: badge.isActive,
      badgeId: badge.badgeId,
      earnedAt: badge.earnedAt ?? new Date().toISOString(),
      relatedMissionId: badge.relatedMissionId,
      progressValue: badge.progressValue,
      targetValue: badge.targetValue,
      progressPercent: badge.progressPercent,
      state: "earned" as const,
    }))
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

export async function getStudentEnglishBadgeShowcase(studentId?: string): Promise<BadgeShowcase> {
  return getStudentBadgeShowcase(studentId, "english");
}

export async function evaluateEnglishBadges(args: {
  studentId: string;
  relatedMissionId?: string | null;
}): Promise<EarnedBadgeSummary[]> {
  return evaluateBadgesForStudent({
    studentId: args.studentId,
    relatedMissionId: args.relatedMissionId,
    subject: "english",
  });
}

