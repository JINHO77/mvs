import BadgeMedal from "@/components/badges/BadgeMedal";
import Badge from "@/components/ui/Badge";
import { BADGE_CATEGORY_LABELS, getBadgeMetadata } from "@/constants/badgeMetadata";
import { normalizeDisplayText } from "@/lib/uiText";
import type { BadgeCategory, BadgeProgressState, BadgeShowcase } from "@/types/badges";

type BadgeShowcasePanelProps = {
  showcase: BadgeShowcase;
  emptyTitle: string;
  emptyBody: string;
  sectionTone?: "emerald" | "amber";
};

function badgeVariant(category: BadgeCategory): "neutral" | "info" | "warning" | "success" {
  if (category === "streak") return "success";
  if (category === "challenge" || category === "logic") return "warning";
  if (category === "reading" || category === "speaking" || category === "graph") return "info";
  return "neutral";
}

function badgeStateLabel(state: BadgeProgressState): string {
  if (state === "earned") return "\uD68D\uB4DD \uC644\uB8CC";
  if (state === "in_progress") return "\uC9C4\uD589 \uC911";
  return "\uC7A0\uAE08";
}

function badgeDateLabel(value: string | null): string {
  if (!value) return "\uC544\uC9C1 \uD68D\uB4DD \uC804";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\uBC29\uAE08 \uD68D\uB4DD";
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function toneClass(sectionTone: "emerald" | "amber"): string {
  if (sectionTone === "amber") return "border-[rgba(255,214,117,0.24)] bg-[linear-gradient(180deg,rgba(255,214,117,0.08),rgba(255,255,255,0.02))]";
  return "border-[rgba(122,210,164,0.24)] bg-[linear-gradient(180deg,rgba(126,214,165,0.10),rgba(255,255,255,0.02))]";
}

export default function BadgeShowcasePanel({
  showcase,
  emptyTitle,
  emptyBody,
  sectionTone = "emerald",
}: BadgeShowcasePanelProps) {
  const safeEmptyTitle = normalizeDisplayText(emptyTitle, "\uCCAB \uBC30\uC9C0\uB97C \uC5BB\uC73C\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB3FC\uC694.");
  const safeEmptyBody = normalizeDisplayText(emptyBody, "\uB2E4\uC74C \uBAA9\uD45C\uB97C \uD655\uC778\uD558\uACE0 \uC601\uC5B4\uC640 \uC218\uD559 \uBBF8\uC158\uC5D0 \uB3C4\uC804\uD574 \uBCF4\uC138\uC694.");

  return (
    <div className={`rounded-3xl border p-5 ${toneClass(sectionTone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Badge Collection</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text)]">{"\uC791\uC740 \uD2B8\uB85C\uD53C \uCF5C\uB809\uC158"}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{"\uD68D\uB4DD\uD55C \uBC30\uC9C0 "}{showcase.totalEarned}{"\uAC1C"}</p>
        </div>
        {showcase.totalEarned > 0 && <Badge variant="success">{"\uCD5C\uADFC \uB2EC\uC131 \uD750\uB984 \uC88B\uC74C"}</Badge>}
      </div>

      {showcase.totalEarned === 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">{safeEmptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{safeEmptyBody}</p>
        </div>
      )}

      {showcase.recentBadges.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {showcase.recentBadges.map((badge) => {
            const meta = getBadgeMetadata(badge.key);
            return (
              <div key={`${badge.key}:${badge.earnedAt}`} className="rounded-2xl border border-[rgba(122,210,164,0.26)] bg-[rgba(122,210,164,0.08)] p-4">
                <BadgeMedal
                  title={meta.title}
                  subtitle={meta.subtitle}
                  iconUrl={meta.iconUrl}
                  category={meta.category}
                  rarity={meta.rarity}
                  subject={meta.subject}
                  accentColor={meta.accentColor}
                  state="earned"
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      )}

      {showcase.nextBadge && (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{"\uB2E4\uC74C \uBC30\uC9C0 \uBAA9\uD45C"}</p>
            <Badge variant={badgeVariant(showcase.nextBadge.category)}>{normalizeDisplayText(BADGE_CATEGORY_LABELS[showcase.nextBadge.category])}</Badge>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
            {(() => {
              const meta = getBadgeMetadata(showcase.nextBadge.key);
              return (
                <>
                  <BadgeMedal
                    title={meta.title}
                    subtitle={meta.subtitle}
                    iconUrl={meta.iconUrl}
                    category={meta.category}
                    rarity={meta.rarity}
                    subject={meta.subject}
                    accentColor={meta.accentColor}
                    state={showcase.nextBadge.state}
                  />
                  <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{normalizeDisplayText(meta.description)}</p>
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                      <span>{"\uC9C4\uD589\uB3C4"}</span>
                      <span>{normalizeDisplayText(showcase.nextBadge.progressLabel)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                      <div className="h-full rounded-full" style={{ width: `${showcase.nextBadge.progressPercent}%`, backgroundColor: meta.accentColor }} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{normalizeDisplayText(showcase.nextBadge.remainingLabel)}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {showcase.showcaseBadges.map((badge) => {
          const meta = getBadgeMetadata(badge.key);
          return (
            <div
              key={badge.key}
              className={`min-w-0 overflow-hidden rounded-[28px] border p-4 transition sm:p-5 ${
                badge.earned
                  ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_20px_50px_rgba(0,0,0,0.22)]"
                  : badge.state === "in_progress"
                    ? "border-[rgba(255,214,117,0.20)] bg-[rgba(255,214,117,0.06)]"
                    : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <BadgeMedal
                  title={meta.title}
                  subtitle={meta.subtitle}
                  iconUrl={meta.iconUrl}
                  category={meta.category}
                  rarity={meta.rarity}
                  subject={meta.subject}
                  accentColor={meta.accentColor}
                  state={badge.state}
                />
                <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
                  badge.earned
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : badge.state === "in_progress"
                      ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
                      : "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]"
                }`}>
                  {badgeStateLabel(badge.state)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <span>{normalizeDisplayText(meta.rarity)}</span>
                <span>/</span>
                <span>{normalizeDisplayText(BADGE_CATEGORY_LABELS[meta.category])}</span>
              </div>

              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{normalizeDisplayText(meta.description)}</p>

              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-3 py-3">
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <span>{"\uC9C4\uD589\uB3C4"}</span>
                  <span>{normalizeDisplayText(badge.progressLabel)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${badge.progressPercent}%`, backgroundColor: badge.state === "locked" ? "rgba(148,163,184,0.35)" : meta.accentColor }} />
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {badge.earned ? "\uCD95\uD558\uD574\uC694! \uD2B8\uB85C\uD53C \uCF5C\uB809\uC158\uC5D0 \uCD94\uAC00\uB410\uC5B4\uC694." : normalizeDisplayText(badge.remainingLabel)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <span>{badgeDateLabel(badge.earnedAt)}</span>
                <Badge variant={badgeVariant(meta.category)}>{normalizeDisplayText(meta.subtitle)}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
