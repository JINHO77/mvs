import type { BadgeCategory, BadgeKey, BadgeSubject } from "@/types/badges";

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type BadgeType = "icon" | "character";

export type BadgeVisualMetadata = {
  key: BadgeKey;
  title: string;
  subtitle: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  iconUrl: string;
  accentColor: string;
  subject: BadgeSubject;
  badgeType?: BadgeType;
};

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  starter:     "첫 도전",
  streak:      "꾸준함",
  exploration: "탐험",
  challenge:   "도전",
  reading:     "읽기",
  speaking:    "회화",
  graph:       "그래프",
  geometry:    "도형",
  logic:       "논리",
  missions:    "미션",
  xp:          "경험치",
  level:       "레벨",
  weekend:     "주말 챌린지",
  bilingual:   "이중 언어",
};

export const BADGE_RARITY_LABELS: Record<BadgeRarity, string> = {
  common:    "Common",
  uncommon:  "Uncommon",
  rare:      "Rare",
  epic:      "Epic",
  legendary: "Legendary",
};

export const BADGE_RARITY_COLOR: Record<BadgeRarity, string> = {
  common:    "#94A3B8",
  uncommon:  "#60A5FA",
  rare:      "#A78BFA",
  epic:      "#F472B6",
  legendary: "#FACC15",
};

export const BADGE_SUBJECT_LABELS: Record<BadgeSubject, string> = {
  common:  "공통",
  math:    "수학",
  english: "영어",
};

export const BADGE_METADATA: Record<BadgeKey, BadgeVisualMetadata> = {
  // ════════════════════════════════════
  // COMMON (10)
  // ════════════════════════════════════
  start_journey: {
    key: "start_journey",
    title: "첫 걸음의 설렘",
    subtitle: "Journey Begins",
    description: "첫 미션을 완료해 학습 여정을 시작했어요. 모든 위대한 여정은 한 걸음에서 시작돼요.",
    category: "starter",
    rarity: "common",
    iconUrl: "/badges/first_step.svg",
    accentColor: "#94A3B8",
    subject: "common",
  },
  first_math: {
    key: "first_math",
    title: "숫자와의 첫 만남",
    subtitle: "Math Start",
    description: "첫 번째 수학 미션을 완료했어요. 숫자와 친해지는 첫 번째 발걸음이에요.",
    category: "starter",
    rarity: "common",
    iconUrl: "/badges/math_lover.svg",
    accentColor: "#60A5FA",
    subject: "math",
  },
  first_english: {
    key: "first_english",
    title: "영어와의 첫 대화",
    subtitle: "English Start",
    description: "첫 번째 영어 미션을 완료했어요. 세계와 소통하는 첫 번째 대화예요.",
    category: "starter",
    rarity: "common",
    iconUrl: "/badges/eng_lover.svg",
    accentColor: "#34D399",
    subject: "english",
  },
  first_weekend: {
    key: "first_weekend",
    title: "첫 주말 탐험",
    subtitle: "Weekend Explorer",
    description: "첫 주말 챌린지를 완료했어요. 쉬는 날에도 성장하는 당신은 특별해요.",
    category: "weekend",
    rarity: "common",
    iconUrl: "/badges/explorer.svg",
    accentColor: "#FB923C",
    subject: "common",
  },
  char_white_rabbit: {
    key: "char_white_rabbit",
    title: "하얀 토끼",
    subtitle: "First Friend",
    description: "첫 미션 완료 — 항상 당신 옆에서 응원하는 첫 번째 친구예요.",
    category: "starter",
    rarity: "common",
    iconUrl: "/badges/char_bunny.svg",
    accentColor: "#FFB7C5",
    subject: "common",
    badgeType: "character",
  },
  streak_3: {
    key: "streak_3",
    title: "3일의 약속",
    subtitle: "Three Day Streak",
    description: "3일 연속 미션을 완료했어요. 꾸준함의 씨앗이 싹트기 시작했어요.",
    category: "streak",
    rarity: "common",
    iconUrl: "/badges/streak_3.svg",
    accentColor: "#FBBF24",
    subject: "common",
  },
  missions_5: {
    key: "missions_5",
    title: "귀여운 새싹",
    subtitle: "Growing Learner",
    description: "미션 5개를 완료했어요. 작은 새싹이 조금씩 자라고 있어요.",
    category: "missions",
    rarity: "common",
    iconUrl: "/badges/first_step.svg",
    accentColor: "#86EFAC",
    subject: "common",
  },
  missions_10: {
    key: "missions_10",
    title: "꾸준한 배움이",
    subtitle: "Steady Learner",
    description: "미션 10개를 완료했어요. 꾸준함이 실력으로 쌓이고 있어요.",
    category: "missions",
    rarity: "common",
    iconUrl: "/badges/first_step.svg",
    accentColor: "#6EE7B7",
    subject: "common",
  },
  xp_100: {
    key: "xp_100",
    title: "반짝이는 시작",
    subtitle: "First Spark",
    description: "누적 XP 100을 달성했어요. 첫 번째 반짝임이 시작됐어요.",
    category: "xp",
    rarity: "common",
    iconUrl: "/badges/first_step.svg",
    accentColor: "#FDE68A",
    subject: "common",
  },
  xp_500: {
    key: "xp_500",
    title: "빛나는 성장",
    subtitle: "Shining Growth",
    description: "누적 XP 500을 달성했어요. 노력이 빛으로 변하고 있어요.",
    category: "xp",
    rarity: "common",
    iconUrl: "/badges/first_step.svg",
    accentColor: "#FCD34D",
    subject: "common",
  },

  // ════════════════════════════════════
  // UNCOMMON (8)
  // ════════════════════════════════════
  hard_3: {
    key: "hard_3",
    title: "도전의 첫 관문",
    subtitle: "First Challenge",
    description: "Hard 미션 3개를 완료했어요. 어려운 길을 선택한 용기가 빛나요.",
    category: "challenge",
    rarity: "uncommon",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#F87171",
    subject: "common",
  },
  level_5: {
    key: "level_5",
    title: "5레벨 각성",
    subtitle: "Level 5 Awakening",
    description: "레벨 5에 도달했어요. 학습의 새로운 눈이 뜨이고 있어요.",
    category: "level",
    rarity: "uncommon",
    iconUrl: "/badges/first_step.svg",
    accentColor: "#60A5FA",
    subject: "common",
  },
  streak_7: {
    key: "streak_7",
    title: "일주일의 전사",
    subtitle: "One Week Warrior",
    description: "7일 연속 미션을 완료했어요. 일주일을 지켜낸 진정한 전사예요.",
    category: "streak",
    rarity: "uncommon",
    iconUrl: "/badges/streak_7.svg",
    accentColor: "#F59E0B",
    subject: "common",
  },
  char_english_owl: {
    key: "char_english_owl",
    title: "영어 올빼미",
    subtitle: "Word Sage",
    description: "영어 미션 20개 완료 — 졸업 모자를 쓴 학식 높은 올빼미예요.",
    category: "reading",
    rarity: "uncommon",
    iconUrl: "/badges/char_owl.svg",
    accentColor: "#5B9BD5",
    subject: "english",
    badgeType: "character",
  },
  char_math_fox: {
    key: "char_math_fox",
    title: "수학 여우",
    subtitle: "Math Genius",
    description: "수학 미션 20개 완료 — Σ 기호가 자랑인 영리한 여우예요.",
    category: "exploration",
    rarity: "uncommon",
    iconUrl: "/badges/char_fox.svg",
    accentColor: "#F97316",
    subject: "math",
    badgeType: "character",
  },
  char_panda: {
    key: "char_panda",
    title: "판다",
    subtitle: "Steady Panda",
    description: "미션 30개 완료 — 꾸준함이 최고라는 걸 아는 느긋한 판다예요.",
    category: "missions",
    rarity: "uncommon",
    iconUrl: "/badges/char_panda.svg",
    accentColor: "#6B7280",
    subject: "common",
    badgeType: "character",
  },
  missions_30: {
    key: "missions_30",
    title: "열정의 학습자",
    subtitle: "Passionate Learner",
    description: "미션 30개를 완료했어요. 열정이 습관으로 자리잡고 있어요.",
    category: "missions",
    rarity: "uncommon",
    iconUrl: "/badges/explorer.svg",
    accentColor: "#A3E635",
    subject: "common",
  },
  xp_1000: {
    key: "xp_1000",
    title: "은빛 학자",
    subtitle: "Silver Scholar",
    description: "누적 XP 1000을 달성했어요. 은빛 지식의 탑이 쌓이고 있어요.",
    category: "xp",
    rarity: "uncommon",
    iconUrl: "/badges/first_step.svg",
    accentColor: "#94A3B8",
    subject: "common",
  },

  // ════════════════════════════════════
  // RARE (8)
  // ════════════════════════════════════
  weekend_10: {
    key: "weekend_10",
    title: "주말의 모험가",
    subtitle: "Weekend Adventurer",
    description: "주말 챌린지 10개를 완료했어요. 쉬지 않고 성장하는 모험가예요.",
    category: "weekend",
    rarity: "rare",
    iconUrl: "/badges/explorer.svg",
    accentColor: "#818CF8",
    subject: "common",
  },
  char_explorer_bear: {
    key: "char_explorer_bear",
    title: "탐험 곰",
    subtitle: "Unit Explorer",
    description: "단원 10개 탐험 — 나침반을 들고 새로운 단원을 탐험하는 모험가예요.",
    category: "exploration",
    rarity: "rare",
    iconUrl: "/badges/char_bear.svg",
    accentColor: "#9C59D1",
    subject: "common",
    badgeType: "character",
  },
  level_10: {
    key: "level_10",
    title: "10레벨 베테랑",
    subtitle: "Level 10 Veteran",
    description: "레벨 10에 도달했어요. 이제 진정한 베테랑의 길을 걷고 있어요.",
    category: "level",
    rarity: "rare",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#A78BFA",
    subject: "common",
  },
  char_fire_cat: {
    key: "char_fire_cat",
    title: "불꽃 고양이",
    subtitle: "Streak Blaze",
    description: "30일 연속 학습 — 털 끝에서 스파크가 튀는 에너지 넘치는 고양이예요.",
    category: "streak",
    rarity: "rare",
    iconUrl: "/badges/char_cat.svg",
    accentColor: "#FF7043",
    subject: "common",
    badgeType: "character",
  },
  streak_30: {
    key: "streak_30",
    title: "한 달의 기적",
    subtitle: "One Month Miracle",
    description: "30일 연속 미션을 완료했어요. 한 달을 지켜낸 기적 같은 의지예요.",
    category: "streak",
    rarity: "rare",
    iconUrl: "/badges/streak_7.svg",
    accentColor: "#FB923C",
    subject: "common",
  },
  bilingual_30: {
    key: "bilingual_30",
    title: "양손잡이 학자",
    subtitle: "Bilingual Scholar",
    description: "수학과 영어 미션 각각 30개 이상 완료 — 두 과목을 자유롭게 오가는 학자예요.",
    category: "bilingual",
    rarity: "rare",
    iconUrl: "/badges/bilingual.svg",
    accentColor: "#2DD4BF",
    subject: "common",
  },
  missions_100: {
    key: "missions_100",
    title: "100개의 증거",
    subtitle: "Century Proof",
    description: "미션 100개를 완료했어요. 100번의 노력이 당신의 실력을 증명해요.",
    category: "missions",
    rarity: "rare",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#C084FC",
    subject: "common",
  },
  xp_3000: {
    key: "xp_3000",
    title: "다이아의 광채",
    subtitle: "Diamond Radiance",
    description: "누적 XP 3000을 달성했어요. 다이아몬드처럼 단단해진 실력이에요.",
    category: "xp",
    rarity: "rare",
    iconUrl: "/badges/streak_7.svg",
    accentColor: "#67E8F9",
    subject: "common",
  },

  // ════════════════════════════════════
  // EPIC (6)
  // ════════════════════════════════════
  level_15: {
    key: "level_15",
    title: "15레벨 엘리트",
    subtitle: "Level 15 Elite",
    description: "레벨 15에 도달했어요. 엘리트 학습자로 인정받는 순간이에요.",
    category: "level",
    rarity: "epic",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#F472B6",
    subject: "common",
  },
  hard_30: {
    key: "hard_30",
    title: "역경의 정복자",
    subtitle: "Hardship Conqueror",
    description: "Hard 미션 30개를 완료했어요. 역경 앞에서도 굴하지 않는 정복자예요.",
    category: "challenge",
    rarity: "epic",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#EF4444",
    subject: "common",
  },
  char_lion_king: {
    key: "char_lion_king",
    title: "사자왕",
    subtitle: "Lion King",
    description: "Hard 미션 30개 완료 — 어려운 도전을 정복한 자만이 얻는 왕의 칭호예요.",
    category: "challenge",
    rarity: "epic",
    iconUrl: "/badges/char_lion.svg",
    accentColor: "#F59E0B",
    subject: "common",
    badgeType: "character",
  },
  streak_60: {
    key: "streak_60",
    title: "60일의 결의",
    subtitle: "Sixty Day Resolve",
    description: "60일 연속 미션을 완료했어요. 두 달을 꿋꿋하게 이어온 결의예요.",
    category: "streak",
    rarity: "epic",
    iconUrl: "/badges/streak_7.svg",
    accentColor: "#D946EF",
    subject: "common",
  },
  missions_300: {
    key: "missions_300",
    title: "300개의 왕관",
    subtitle: "Three Hundred Crown",
    description: "미션 300개를 완료했어요. 왕관을 쓸 자격이 충분해요.",
    category: "missions",
    rarity: "epic",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#C084FC",
    subject: "common",
  },
  xp_10000: {
    key: "xp_10000",
    title: "만 년의 학자",
    subtitle: "Ten Thousand Scholar",
    description: "누적 XP 10000을 달성했어요. 만 년의 지혜를 품은 학자예요.",
    category: "xp",
    rarity: "epic",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#E879F9",
    subject: "common",
  },

  // ════════════════════════════════════
  // LEGENDARY (4)
  // ════════════════════════════════════
  streak_365: {
    key: "streak_365",
    title: "1년 개근의 신화",
    subtitle: "Year of Dedication",
    description: "365일 연속 미션을 완료했어요. 1년을 하루도 빠짐없이 해낸 신화예요.",
    category: "streak",
    rarity: "legendary",
    iconUrl: "/badges/streak_7.svg",
    accentColor: "#FACC15",
    subject: "common",
  },
  missions_1000: {
    key: "missions_1000",
    title: "천 개의 발자국",
    subtitle: "Thousand Steps",
    description: "미션 1000개를 완료했어요. 천 번의 발자국이 전설을 만들었어요.",
    category: "missions",
    rarity: "legendary",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#FDE047",
    subject: "common",
  },
  xp_100000: {
    key: "xp_100000",
    title: "불멸의 학자",
    subtitle: "Immortal Scholar",
    description: "누적 XP 100000을 달성했어요. 불멸의 지식을 쌓은 전설적인 학자예요.",
    category: "xp",
    rarity: "legendary",
    iconUrl: "/badges/hard_master.svg",
    accentColor: "#FACC15",
    subject: "common",
  },
  char_legendary_dragon: {
    key: "char_legendary_dragon",
    title: "전설의 드래곤",
    subtitle: "Legendary Dragon",
    description: "누적 XP 100000 달성 — 가장 높은 곳에 올라선 자만이 만나는 전설이에요.",
    category: "challenge",
    rarity: "legendary",
    iconUrl: "/badges/char_dragon.svg",
    accentColor: "#FACC15",
    subject: "common",
    badgeType: "character",
  },
};

export function getBadgeMetadata(
  key: string,
  fallback?: {
    title?: string;
    description?: string;
    iconUrl?: string;
    subject?: string;
    badgeType?: string;
    accentColor?: string;
    rarity?: string;
  }
): BadgeVisualMetadata {
  const found = BADGE_METADATA[key as BadgeKey];
  if (found) return found;

  return {
    key: key as BadgeKey,
    title: fallback?.title ?? key,
    subtitle: "",
    description: fallback?.description ?? "",
    category: "starter" as BadgeCategory,
    rarity: (fallback?.rarity as BadgeRarity) ?? "common",
    iconUrl: fallback?.iconUrl ?? "/badges/first_step.svg",
    accentColor: fallback?.accentColor ?? "#94A3B8",
    subject: (fallback?.subject ?? "common") as BadgeSubject,
    badgeType: (fallback?.badgeType as BadgeType) ?? undefined,
  };
}
