export function buildRecommendationHref(
  subject: "math" | "english",
  missionId: string | null | undefined
): string | null {
  if (!missionId) return null;
  if (subject === "math") return `/student/math/mission/${missionId}`;
  if (subject === "english") return `/student/english/mission/${missionId}`;
  return null;
}
