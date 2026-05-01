export type BadgeCategory =
  | "starter"
  | "streak"
  | "exploration"
  | "challenge"
  | "reading"
  | "speaking"
  | "graph"
  | "geometry"
  | "logic"
  | "missions"
  | "xp"
  | "level"
  | "weekend"
  | "bilingual";

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type BadgeSubject = "common" | "math" | "english";

export type BadgeConditionType =
  | "mission_complete_count"
  | "math_complete_count"
  | "english_complete_count"
  | "weekend_complete_count"
  | "difficulty_complete_count"
  | "distinct_unit_complete_count"
  | "daily_streak"
  | "total_xp_threshold"
  | "level_reach"
  | "bilingual_complete_count"
  | "correct_step_streak";

export type BadgeKey =
  // ── COMMON (10) ──────────────────────────────
  | "start_journey"
  | "first_math"
  | "first_english"
  | "first_weekend"
  | "char_white_rabbit"
  | "streak_3"
  | "missions_5"
  | "missions_10"
  | "xp_100"
  | "xp_500"
  // ── UNCOMMON (8) ─────────────────────────────
  | "hard_3"
  | "level_5"
  | "streak_7"
  | "char_english_owl"
  | "char_math_fox"
  | "char_panda"
  | "missions_30"
  | "xp_1000"
  // ── RARE (8) ─────────────────────────────────
  | "weekend_10"
  | "char_explorer_bear"
  | "level_10"
  | "char_fire_cat"
  | "streak_30"
  | "bilingual_30"
  | "missions_100"
  | "xp_3000"
  // ── EPIC (6) ─────────────────────────────────
  | "level_15"
  | "hard_30"
  | "char_lion_king"
  | "streak_60"
  | "missions_300"
  | "xp_10000"
  // ── LEGENDARY (4) ────────────────────────────
  | "streak_365"
  | "missions_1000"
  | "xp_100000"
  | "char_legendary_dragon";

export type BadgeType = "achievement" | "character";

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
  badgeType?: BadgeType;
};

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
