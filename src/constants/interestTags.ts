export const interestTagOptions = [
  { key: "game", label: "게임" },
  { key: "sports", label: "스포츠" },
  { key: "travel", label: "여행" },
  { key: "idol", label: "아이돌" },
  { key: "fashion", label: "패션" },
  { key: "animals", label: "동물" },
  { key: "robotics_ai", label: "로봇/AI" },
  { key: "school_life", label: "학교생활" },
] as const;

export type InterestTagKey = (typeof interestTagOptions)[number]["key"];

const interestTagKeySet = new Set<string>(interestTagOptions.map((item) => item.key));
const interestTagLabelMap = new Map<string, string>(interestTagOptions.map((item) => [item.key, item.label]));

export function normalizeInterestTagSelection(tags: string[] | null | undefined): InterestTagKey[] {
  if (!Array.isArray(tags)) return [];

  const seen = new Set<string>();
  const normalized: InterestTagKey[] = [];
  for (const rawTag of tags) {
    const tag = typeof rawTag === "string" ? rawTag.trim().toLowerCase() : "";
    if (!tag || seen.has(tag) || !interestTagKeySet.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag as InterestTagKey);
  }

  return normalized;
}

export function interestTagLabel(tag: string | null | undefined): string {
  const normalized = typeof tag === "string" ? tag.trim().toLowerCase() : "";
  return interestTagLabelMap.get(normalized) ?? normalized;
}

export function formatInterestTagSummary(tags: string[] | null | undefined, fallback = "아직 선택한 관심 주제가 없어요."): string {
  const normalized = normalizeInterestTagSelection(tags);
  if (normalized.length === 0) return fallback;
  return normalized.map((tag) => interestTagLabel(tag)).join(" · ");
}
