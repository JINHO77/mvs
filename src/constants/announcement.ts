import type { AnnouncementCategory, AnnouncementPriority } from "@/constants/announcementMeta";

export type CategoryMeta = {
  ko: string;
  icon: string;
  color: "gray" | "red" | "pink" | "cyan" | "purple" | "blue" | "green" | "amber";
  desc: string;
};

export type PriorityMeta = {
  ko: string;
  icon: string;
  weight: number;
  desc: string;
};

export const CATEGORY_META: Record<AnnouncementCategory, CategoryMeta> = {
  general: { ko: "일반", icon: "📣", color: "gray", desc: "일반 공지사항" },
  urgent: { ko: "긴급", icon: "🚨", color: "red", desc: "즉시 확인 필요" },
  event: { ko: "이벤트", icon: "🎉", color: "pink", desc: "학원 행사·이벤트" },
  schedule: { ko: "일정", icon: "📅", color: "cyan", desc: "학원 일정·휴원 등" },
  report: { ko: "리포트", icon: "📊", color: "purple", desc: "학습 리포트 안내" },
  consultation: { ko: "상담", icon: "💬", color: "blue", desc: "상담 관련 (자동 생성용)" },
};

export const PRIORITY_META: Record<AnnouncementPriority, PriorityMeta> = {
  urgent: { ko: "긴급", icon: "🚨", weight: 1, desc: "즉시 확인! (빨강 강조)" },
  high: { ko: "중요", icon: "⚡", weight: 2, desc: "꼭 확인 필요" },
  normal: { ko: "일반", icon: "", weight: 3, desc: "평소처럼 확인" },
  low: { ko: "참고", icon: "💭", weight: 4, desc: "시간 날 때 확인" },
};

export const CATEGORY_ORDER: AnnouncementCategory[] = [
  "general",
  "urgent",
  "event",
  "schedule",
  "report",
  "consultation",
];

export const PRIORITY_ORDER: AnnouncementPriority[] = ["low", "normal", "high", "urgent"];

export function categoryColorClasses(color: CategoryMeta["color"]): string {
  switch (color) {
    case "red":
      return "bg-red-500/15 text-red-400 border-red-500/40";
    case "pink":
      return "bg-pink-500/15 text-pink-400 border-pink-500/40";
    case "cyan":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/40";
    case "purple":
      return "bg-purple-500/15 text-purple-400 border-purple-500/40";
    case "blue":
      return "bg-blue-500/15 text-blue-400 border-blue-500/40";
    case "green":
      return "bg-green-500/15 text-green-400 border-green-500/40";
    case "amber":
      return "bg-amber-500/15 text-amber-400 border-amber-500/40";
    case "gray":
    default:
      return "bg-gray-500/15 text-gray-400 border-gray-500/40";
  }
}
