export type BadgeCategory =
  | "starter"
  | "streak"
  | "exploration"
  | "challenge"
  | "reading"
  | "speaking"
  | "graph"
  | "geometry"
  | "logic";

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic";

export type BadgeSubject = "common" | "math" | "english";

export type BadgeConditionType =
  | "mission_complete_count"
  | "correct_step_streak"
  | "distinct_unit_complete_count"
  | "difficulty_complete_count"
  | "keyword_mission_complete_count"
  | "study_day_streak";

export type BadgeKey =
  | "first_mission_complete"
  | "three_correct_streak"
  | "five_correct_streak"
  | "explorer_three_units"
  | "hard_challenger"
  | "math_first_step"
  | "graph_explorer"
  | "geometry_starter"
  | "logic_builder"
  | "english_first_step"
  | "reader_starter"
  | "speaker_starter"
  | "streak_reader";

export type EnglishBadgeKey = Extract<
  BadgeKey,
  "english_first_step" | "reader_starter" | "speaker_starter" | "streak_reader"
>;

export type BadgeDefinition = {
  key: BadgeKey;
  subject: BadgeSubject;
  title: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconUrl: string;
  conditionType: BadgeConditionType;
  conditionValue: number;
  isActive: boolean;
};

export type EnglishBadgeDefinition = BadgeDefinition;

export type BadgeProgressState = "earned" | "in_progress" | "locked";

export type BadgeProgress = BadgeDefinition & {
  badgeId: string | null;
  earned: boolean;
  earnedAt: string | null;
  relatedMissionId: string | null;
  progressValue: number;
  targetValue: number;
  progressPercent: number;
  remainingValue: number;
  progressLabel: string;
  remainingLabel: string;
  state: BadgeProgressState;
};

export type EarnedBadgeSummary = BadgeDefinition & {
  badgeId: string | null;
  earnedAt: string;
  relatedMissionId: string | null;
  progressValue: number;
  targetValue: number;
  progressPercent: number;
  state: "earned";
};

export type BadgeShowcaseItem = BadgeProgress;

export type BadgeShowcase = {
  totalEarned: number;
  recentBadges: EarnedBadgeSummary[];
  showcaseBadges: BadgeShowcaseItem[];
  nextBadge: BadgeShowcaseItem | null;
};
