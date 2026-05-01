import type { AnnouncementCategory, AnnouncementPriority } from "@/constants/announcementMeta";
import { CATEGORY_META, PRIORITY_META } from "@/constants/announcement";

export type CategoryDisplay = {
  ko: string;
  icon: string;
  color: string;
};

export type PriorityDisplay = {
  ko: string;
  icon: string;
  weight: number;
};

export function getCategoryDisplay(category: string | null | undefined): CategoryDisplay {
  if (category && category in CATEGORY_META) {
    const meta = CATEGORY_META[category as AnnouncementCategory];
    return { ko: meta.ko, icon: meta.icon, color: meta.color };
  }
  const fallback = CATEGORY_META.general;
  return { ko: fallback.ko, icon: fallback.icon, color: fallback.color };
}

export function getPriorityDisplay(priority: string | null | undefined): PriorityDisplay {
  if (priority && priority in PRIORITY_META) {
    const meta = PRIORITY_META[priority as AnnouncementPriority];
    return { ko: meta.ko, icon: meta.icon, weight: meta.weight };
  }
  const fallback = PRIORITY_META.normal;
  return { ko: fallback.ko, icon: fallback.icon, weight: fallback.weight };
}

export function daysAgo(iso: string): number {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 0;
  const diffMs = Date.now() - created;
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export function formatDaysAgo(value: number): string {
  if (value <= 0) return "오늘";
  if (value === 1) return "어제";
  return `${value}일 전`;
}

export function categoryBorderClass(category: string | null | undefined, priority: string | null | undefined): string {
  if (priority === "urgent") return "border-red-500 bg-red-500/10";
  if (priority === "high") return "border-yellow-500/50 bg-yellow-500/5";
  if (category === "consultation") return "border-blue-500/40 bg-blue-500/5";
  if (category === "urgent") return "border-red-500/40 bg-red-500/5";
  return "border-[var(--border)] bg-[var(--card-soft)]";
}

export function categoryBadgeClass(category: string | null | undefined): string {
  const color = getCategoryDisplay(category).color;
  switch (color) {
    case "blue":
      return "border-blue-500/40 bg-blue-500/10 text-blue-400";
    case "red":
      return "border-red-500/40 bg-red-500/10 text-red-400";
    case "green":
      return "border-green-500/40 bg-green-500/10 text-green-400";
    case "amber":
      return "border-amber-500/40 bg-amber-500/10 text-amber-400";
    case "purple":
      return "border-purple-500/40 bg-purple-500/10 text-purple-400";
    case "pink":
      return "border-pink-500/40 bg-pink-500/10 text-pink-400";
    case "cyan":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-400";
    default:
      return "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]";
  }
}
