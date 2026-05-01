"use client";

import type { WeeklyPathWithTheme } from "@/lib/weeklyPathTheme";

type Props = {
  theme: WeeklyPathWithTheme | null;
  loading?: boolean;
};

export default function WeeklyPathHeader({ theme, loading }: Props) {
  if (loading) {
    return <div className="h-16 animate-pulse rounded-2xl bg-[var(--card-soft)]" />;
  }
  if (!theme) return null;

  const hasCustomTheme = theme.theme_title !== theme.unit_name;
  if (!hasCustomTheme) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,var(--card-soft)_0%,var(--card)_100%)] p-4 shadow-[var(--shadow)]">
      {/* NEW badge */}
      {theme.is_new && (
        <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold bg-[#D4537E] text-white dark:bg-[rgba(250,204,21,0.9)] dark:text-[#0b1220]">
          🆕 NEW
        </span>
      )}

      {/* 이모지 + 제목 */}
      <div className={`flex flex-wrap items-center gap-2 ${theme.is_new ? "pr-20" : ""}`}>
        <span className="text-2xl leading-none" aria-hidden="true">
          {theme.emoji}
        </span>
        <h2 className="text-xl font-bold text-[var(--text)]">
          {theme.theme_title}
        </h2>
      </div>

      {theme.theme_description && (
        <p className="mt-1.5 text-sm leading-5 text-[var(--text-muted)]">
          {theme.theme_description}
        </p>
      )}

      {/* 메타: 단원명 · N일 · XP */}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {theme.unit_name}
        {" · "}
        {theme.total_missions}일
        {" · "}
        {theme.total_reward_xp} XP
      </p>
    </div>
  );
}
