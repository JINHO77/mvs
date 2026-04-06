export const ANNOUNCEMENT_STARS_STORAGE_KEY = "mvs:announcement_stars";

export function readAnnouncementStars(): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(ANNOUNCEMENT_STARS_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((v): v is string => typeof v === "string" && v.length > 0));
  } catch {
    return new Set<string>();
  }
}

export function writeAnnouncementStars(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANNOUNCEMENT_STARS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage write failures.
  }
}
