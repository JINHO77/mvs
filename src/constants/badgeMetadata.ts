import type { BadgeCategory, BadgeKey, BadgeSubject } from "@/types/badges";

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic";

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
};

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  starter: "첫 도전",
  streak: "꾸준함",
  exploration: "탐험",
  challenge: "도전",
  reading: "읽기",
  speaking: "회화",
  graph: "그래프",
  geometry: "도형",
  logic: "논리",
};

export const BADGE_RARITY_LABELS: Record<BadgeRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
};

export const BADGE_SUBJECT_LABELS: Record<BadgeSubject, string> = {
  common: "공통",
  math: "수학",
  english: "영어",
};

export const BADGE_METADATA: Record<BadgeKey, BadgeVisualMetadata> = {
  first_mission_complete: {
    key: "first_mission_complete",
    title: "첫 미션 완료",
    subtitle: "Adventure Begins",
    description: "첫 번째 미션을 완료해 학습 여정을 시작했어요.",
    category: "starter",
    rarity: "common",
    iconUrl: "/badges/first-step.svg",
    accentColor: "#FFD166",
    subject: "common",
  },
  three_correct_streak: {
    key: "three_correct_streak",
    title: "3연속 정답",
    subtitle: "Hot Streak",
    description: "채점 단계에서 3번 연속 정답을 기록해 보세요.",
    category: "streak",
    rarity: "uncommon",
    iconUrl: "/badges/streak-flare.svg",
    accentColor: "#FF8A5B",
    subject: "common",
  },
  five_correct_streak: {
    key: "five_correct_streak",
    title: "5연속 정답",
    subtitle: "Blaze Combo",
    description: "채점 단계에서 5번 연속 정답을 기록해 보세요.",
    category: "streak",
    rarity: "rare",
    iconUrl: "/badges/streak-flare.svg",
    accentColor: "#FF6B57",
    subject: "common",
  },
  explorer_three_units: {
    key: "explorer_three_units",
    title: "단원 탐험가",
    subtitle: "Map Opener",
    description: "서로 다른 단원 3개에서 미션을 완료해 보세요.",
    category: "exploration",
    rarity: "rare",
    iconUrl: "/badges/unit-explorer.svg",
    accentColor: "#52D1DC",
    subject: "common",
  },
  hard_challenger: {
    key: "hard_challenger",
    title: "난이도 도전자",
    subtitle: "Fearless Mode",
    description: "hard 또는 challenge 미션을 3개 완료해 보세요.",
    category: "challenge",
    rarity: "epic",
    iconUrl: "/badges/challenge-crest.svg",
    accentColor: "#F59E0B",
    subject: "common",
  },
  math_first_step: {
    key: "math_first_step",
    title: "수학 첫걸음",
    subtitle: "Number Start",
    description: "첫 번째 수학 미션을 완료하면 열려요.",
    category: "starter",
    rarity: "common",
    iconUrl: "/badges/first-step.svg",
    accentColor: "#60A5FA",
    subject: "math",
  },
  graph_explorer: {
    key: "graph_explorer",
    title: "그래프 탐험가",
    subtitle: "Axis Runner",
    description: "그래프나 함수와 연결된 수학 미션을 3개 완료해 보세요.",
    category: "graph",
    rarity: "rare",
    iconUrl: "/badges/graph-wave.svg",
    accentColor: "#7C83FD",
    subject: "math",
  },
  geometry_starter: {
    key: "geometry_starter",
    title: "도형 스타터",
    subtitle: "Shape Spark",
    description: "도형과 공간 감각을 다루는 수학 미션을 2개 완료해 보세요.",
    category: "geometry",
    rarity: "uncommon",
    iconUrl: "/badges/geometry-gem.svg",
    accentColor: "#34D399",
    subject: "math",
  },
  logic_builder: {
    key: "logic_builder",
    title: "논리 빌더",
    subtitle: "Mind Forge",
    description: "식, 방정식, 확률 같은 논리형 수학 미션을 3개 완료해 보세요.",
    category: "logic",
    rarity: "rare",
    iconUrl: "/badges/logic-circuit.svg",
    accentColor: "#A78BFA",
    subject: "math",
  },
  english_first_step: {
    key: "english_first_step",
    title: "영어 첫걸음",
    subtitle: "Word Start",
    description: "첫 번째 영어 미션을 완료하면 열려요.",
    category: "starter",
    rarity: "common",
    iconUrl: "/badges/first-step.svg",
    accentColor: "#22C55E",
    subject: "english",
  },
  reader_starter: {
    key: "reader_starter",
    title: "리더 스타터",
    subtitle: "Reading Bloom",
    description: "읽기 중심 영어 미션을 2개 완료해 보세요.",
    category: "reading",
    rarity: "uncommon",
    iconUrl: "/badges/reading-bloom.svg",
    accentColor: "#38BDF8",
    subject: "english",
  },
  speaker_starter: {
    key: "speaker_starter",
    title: "스피커 스타터",
    subtitle: "Voice Spark",
    description: "말하기와 표현 중심 영어 미션을 2개 완료해 보세요.",
    category: "speaking",
    rarity: "uncommon",
    iconUrl: "/badges/speaking-spark.svg",
    accentColor: "#FB7185",
    subject: "english",
  },
  streak_reader: {
    key: "streak_reader",
    title: "꾸준한 리더",
    subtitle: "Daily Reader",
    description: "영어 미션을 3일 연속 완료해 보세요.",
    category: "streak",
    rarity: "rare",
    iconUrl: "/badges/streak-flare.svg",
    accentColor: "#F97316",
    subject: "english",
  },
};

export function getBadgeMetadata(key: BadgeKey): BadgeVisualMetadata {
  return BADGE_METADATA[key];
}
