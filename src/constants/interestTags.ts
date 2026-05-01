export const interestTagOptions = [
  { key: "game", label: "게임", emoji: "🎮" },
  { key: "sports", label: "스포츠", emoji: "⚽" },
  { key: "music", label: "음악", emoji: "🎵" },
  { key: "animal", label: "동물", emoji: "🐶" },
  { key: "space", label: "우주", emoji: "🚀" },
  { key: "food", label: "요리·음식", emoji: "🍕" },
  { key: "art", label: "예술·그림", emoji: "🎨" },
  { key: "science", label: "과학·실험", emoji: "🔬" },
  { key: "tech", label: "기술·코딩", emoji: "💻" },
  { key: "movie", label: "영화·드라마", emoji: "🎬" },
  { key: "travel", label: "여행·문화", emoji: "✈️" },
  { key: "build", label: "만들기·건축", emoji: "🏗️" },
  { key: "mystery", label: "미스터리·추리", emoji: "🔍" },
  { key: "fashion", label: "패션·뷰티", emoji: "👗" },
] as const;

export type InterestTagKey = (typeof interestTagOptions)[number]["key"];

const interestTagKeySet = new Set<string>(interestTagOptions.map((item) => item.key));
const interestTagLabelMap = new Map<string, string>(interestTagOptions.map((item) => [item.key, item.label]));
const interestTagEmojiMap = new Map<string, string>(interestTagOptions.map((item) => [item.key, item.emoji]));

const LEGACY_KEY_ALIASES: Record<string, InterestTagKey> = {
  animals: "animal",
  idol: "music",
  robotics_ai: "tech",
  school_life: "build",
};

function aliasOrSelf(tag: string): string {
  return LEGACY_KEY_ALIASES[tag] ?? tag;
}

export function normalizeInterestTagSelection(tags: string[] | null | undefined): InterestTagKey[] {
  if (!Array.isArray(tags)) return [];

  const seen = new Set<string>();
  const normalized: InterestTagKey[] = [];
  for (const rawTag of tags) {
    const tag = typeof rawTag === "string" ? aliasOrSelf(rawTag.trim().toLowerCase()) : "";
    if (!tag || seen.has(tag) || !interestTagKeySet.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag as InterestTagKey);
  }

  return normalized;
}

export function interestTagLabel(tag: string | null | undefined): string {
  const normalized = typeof tag === "string" ? aliasOrSelf(tag.trim().toLowerCase()) : "";
  return interestTagLabelMap.get(normalized) ?? normalized;
}

export function interestTagEmoji(tag: string | null | undefined): string {
  const normalized = typeof tag === "string" ? aliasOrSelf(tag.trim().toLowerCase()) : "";
  return interestTagEmojiMap.get(normalized) ?? "";
}

export function formatInterestTagSummary(tags: string[] | null | undefined, fallback = "아직 선택한 관심 주제가 없어요."): string {
  const normalized = normalizeInterestTagSelection(tags);
  if (normalized.length === 0) return fallback;
  return normalized.map((tag) => `${interestTagEmoji(tag)} ${interestTagLabel(tag)}`.trim()).join(" · ");
}
