import Image from "next/image";
import { BADGE_CATEGORY_LABELS, BADGE_RARITY_LABELS, BADGE_SUBJECT_LABELS, type BadgeRarity } from "@/constants/badgeMetadata";
import { normalizeDisplayText } from "@/lib/uiText";
import type { BadgeCategory, BadgeProgressState, BadgeSubject } from "@/types/badges";

type BadgeMedalProps = {
  title: string;
  subtitle: string;
  iconUrl: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  subject: BadgeSubject;
  accentColor: string;
  state: BadgeProgressState;
  size?: "sm" | "md";
};

function rarityHalo(rarity: BadgeRarity): string {
  if (rarity === "epic") return "0 0 38px rgba(245,158,11,0.36)";
  if (rarity === "rare") return "0 0 30px rgba(124,131,253,0.30)";
  if (rarity === "uncommon") return "0 0 24px rgba(56,189,248,0.24)";
  return "0 0 18px rgba(255,209,102,0.18)";
}

function sizeClasses(size: "sm" | "md"): { shell: string; icon: number; pad: string } {
  if (size === "sm") return { shell: "h-14 w-14 rounded-[18px]", icon: 34, pad: "p-3" };
  return { shell: "h-20 w-20 rounded-[24px]", icon: 52, pad: "p-4" };
}

export default function BadgeMedal({
  title,
  subtitle,
  iconUrl,
  category,
  rarity,
  subject,
  accentColor,
  state,
  size = "md",
}: BadgeMedalProps) {
  const sizing = sizeClasses(size);
  const dimmed = state === "locked";
  const activeOpacity = dimmed ? 0.42 : state === "in_progress" ? 0.82 : 1;
  const borderColor = dimmed ? "rgba(148,163,184,0.28)" : `${accentColor}66`;
  const backgroundGlow = dimmed
    ? "radial-gradient(circle at 30% 25%, rgba(148,163,184,0.18), rgba(15,23,42,0.96) 68%)"
    : `radial-gradient(circle at 30% 25%, ${accentColor}55, rgba(15,23,42,0.96) 68%)`;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative shrink-0 overflow-hidden border ${sizing.shell}`}
        style={{
          borderColor,
          background: backgroundGlow,
          boxShadow: rarityHalo(rarity),
          opacity: activeOpacity,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))]" />
        <div className="absolute -right-3 -top-3 h-10 w-10 rounded-full blur-2xl" style={{ backgroundColor: accentColor, opacity: dimmed ? 0.15 : 0.35 }} />
        <div className={`relative flex h-full w-full items-center justify-center ${sizing.pad}`}>
          <Image src={iconUrl} alt="" width={sizing.icon} height={sizing.icon} className="object-contain" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {normalizeDisplayText(BADGE_RARITY_LABELS[rarity])} · {normalizeDisplayText(BADGE_SUBJECT_LABELS[subject])}
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--text)]">{normalizeDisplayText(title)}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {normalizeDisplayText(subtitle)} · {normalizeDisplayText(BADGE_CATEGORY_LABELS[category])}
        </p>
      </div>
    </div>
  );
}

