import type { BadgeRarity } from "@/constants/badgeMetadata";
import type { BadgeProgressState } from "@/types/badges";

type CharacterBadgeCardProps = {
  title: string;
  subtitle: string;
  iconUrl: string;
  rarity: BadgeRarity;
  accentColor: string;
  state: BadgeProgressState;
  earnedAt?: string | null;
};

const RARITY_BG_OPACITY: Record<BadgeRarity, string> = {
  legendary: "66",
  epic:      "55",
  rare:      "40",
  uncommon:  "30",
  common:    "22",
};

const RARITY_LABEL: Record<BadgeRarity, string> = {
  legendary: "LEGENDARY",
  epic:      "EPIC",
  rare:      "RARE",
  uncommon:  "UNCOMMON",
  common:    "COMMON",
};

const RARITY_RIBBON: Record<BadgeRarity, { bg: string; text: string }> = {
  legendary: { bg: "linear-gradient(135deg,#FACC15,#F59E0B)", text: "#1A1200" },
  epic:      { bg: "linear-gradient(135deg,#A78BFA,#7C3AED)", text: "#FFFFFF" },
  rare:      { bg: "linear-gradient(135deg,#60A5FA,#2563EB)", text: "#FFFFFF" },
  uncommon:  { bg: "linear-gradient(135deg,#34D399,#059669)", text: "#FFFFFF" },
  common:    { bg: "rgba(148,163,184,0.55)",                  text: "#FFFFFF" },
};

function buildBg(rarity: BadgeRarity, accentColor: string): string {
  const op = RARITY_BG_OPACITY[rarity];
  return `radial-gradient(ellipse at 50% 0%, ${accentColor}${op}, rgba(15,23,42,0.97) 72%)`;
}

export default function CharacterBadgeCard({
  title,
  subtitle,
  iconUrl,
  rarity,
  accentColor,
  state,
}: CharacterBadgeCardProps) {
  const locked = state === "locked";
  const inProgress = state === "in_progress";
  const earned = state === "earned";
  const ribbon = RARITY_RIBBON[rarity];

  return (
    <div
      className="relative flex flex-col items-center overflow-hidden rounded-[24px] border transition-all duration-300"
      style={{
        borderColor: locked
          ? "rgba(148,163,184,0.16)"
          : inProgress
          ? `${accentColor}44`
          : `${accentColor}80`,
        background: locked
          ? "rgba(15,23,42,0.96)"
          : buildBg(rarity, accentColor),
        boxShadow: earned
          ? `0 8px 32px ${accentColor}30, 0 2px 8px rgba(0,0,0,0.4)`
          : "0 2px 8px rgba(0,0,0,0.3)",
        transform: earned ? "translateY(-2px)" : "none",
      }}
    >
      {/* 희귀도 리본 뱃지 */}
      <div
        className="absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider"
        style={{ background: ribbon.bg, color: ribbon.text }}
      >
        {RARITY_LABEL[rarity]}
      </div>

      {/* 캐릭터 이미지 영역 */}
      <div
        className="relative flex w-full items-end justify-center pt-6"
        style={{
          filter: locked ? "grayscale(1)" : "none",
          opacity: locked ? 0.30 : inProgress ? 0.75 : 1,
        }}
      >
        {/* 획득 시 이미지 아래 빛 */}
        {earned && (
          <div
            className="absolute bottom-0 left-1/2 h-10 w-3/4 -translate-x-1/2 rounded-full blur-2xl"
            style={{ backgroundColor: accentColor, opacity: 0.45 }}
          />
        )}
        <img
          src={iconUrl}
          alt={title}
          className="relative h-28 w-28 object-contain drop-shadow-xl"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      </div>

      {/* 자물쇠 오버레이 */}
      {locked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(15,23,42,0.85)] shadow-xl">
            <svg
              className="h-6 w-6 text-[var(--text-muted)]"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M17 8h-1V6A4 4 0 0 0 8 6v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-5 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3-9h-6V6a3 3 0 0 1 6 0v2z" />
            </svg>
          </div>
        </div>
      )}

      {/* 진행 중 표시 */}
      {inProgress && (
        <div className="absolute left-2 top-2 z-10 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-2 py-0.5 text-[9px] font-bold text-[var(--accent)]">
          진행 중
        </div>
      )}

      {/* 정보 영역 */}
      <div className="flex w-full flex-col items-center gap-1 px-3 pb-4 pt-3">
        <p className="text-center text-sm font-semibold leading-tight text-[var(--text)]">
          {title}
        </p>
        <p className="text-center text-xs text-[var(--text-muted)]">{subtitle}</p>
        {earned && (
          <div
            className="mt-1.5 flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
          >
            <span className="text-[10px]">✦</span>
            <span className="text-[10px] font-semibold" style={{ color: accentColor }}>획득 완료</span>
          </div>
        )}
        {!earned && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: locked ? "rgba(148,163,184,0.4)" : accentColor }}
            />
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {locked ? "잠금" : "진행 중"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
