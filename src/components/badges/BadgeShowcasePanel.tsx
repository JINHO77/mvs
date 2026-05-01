import BadgeMedal from "@/components/badges/BadgeMedal";
import CharacterBadgeCard from "@/components/badges/CharacterBadgeCard";
import Badge from "@/components/ui/Badge";
import { BADGE_CATEGORY_LABELS, BADGE_RARITY_COLOR, getBadgeMetadata } from "@/constants/badgeMetadata";
import { normalizeDisplayText } from "@/lib/uiText";
import type { BadgeCategory, BadgeProgressState, BadgeShowcase, BadgeShowcaseItem } from "@/types/badges";

const RARITY_BORDER: Record<string, string> = {
  common:    "rgba(148,163,184,0.35)",
  uncommon:  "rgba(96,165,250,0.45)",
  rare:      "rgba(96,165,250,0.60)",
  epic:      "rgba(167,139,250,0.60)",
  legendary: "rgba(250,204,21,0.70)",
};

const RARITY_GLOW: Record<string, string> = {
  common:    "transparent",
  uncommon:  "rgba(96,165,250,0.06)",
  rare:      "rgba(96,165,250,0.10)",
  epic:      "rgba(167,139,250,0.12)",
  legendary: "rgba(250,204,21,0.14)",
};

const RARITY_LABEL_DISPLAY: Record<string, string> = {
  common:    "COMMON",
  uncommon:  "UNCOMMON",
  rare:      "RARE",
  epic:      "EPIC",
  legendary: "LEGENDARY",
};

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
  if (state === "earned") return "획득 완료";
  if (state === "in_progress") return "진행 중";
  return "잠금";
}

function badgeDateLabel(value: string | null): string {
  if (!value) return "아직 획득 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금 획득";
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function toneClass(sectionTone: "emerald" | "amber"): string {
  if (sectionTone === "amber") return "border-[rgba(255,214,117,0.24)] bg-[linear-gradient(180deg,rgba(255,214,117,0.08),rgba(255,255,255,0.02))]";
  return "border-[rgba(122,210,164,0.24)] bg-[linear-gradient(180deg,rgba(126,214,165,0.10),rgba(255,255,255,0.02))]";
}

function splitBadges(badges: BadgeShowcaseItem[]): {
  character: BadgeShowcaseItem[];
  achievement: BadgeShowcaseItem[];
} {
  const character: BadgeShowcaseItem[] = [];
  const achievement: BadgeShowcaseItem[] = [];
  for (const badge of badges) {
    // badge.badgeType (from BadgeDefinition) takes priority; fall back to static metadata
    const meta = getBadgeMetadata(badge.key);
    const isCharacter = badge.badgeType === "character" || meta.badgeType === "character";
    if (isCharacter) {
      character.push(badge);
    } else {
      achievement.push(badge);
    }
  }
  return { character, achievement };
}

export default function BadgeShowcasePanel({
  showcase,
  emptyTitle,
  emptyBody,
  sectionTone = "emerald",
}: BadgeShowcasePanelProps) {
  const safeEmptyTitle = normalizeDisplayText(emptyTitle, "첫 배지를 얻으면 여기에 표시돼요.");
  const safeEmptyBody = normalizeDisplayText(emptyBody, "다음 목표를 확인하고 영어와 수학 미션에 도전해 보세요.");

  const { character: characterBadges, achievement: achievementBadges } = splitBadges(showcase.showcaseBadges);
  const earnedCharCount = characterBadges.filter((b) => b.earned).length;
  const earnedAchCount = achievementBadges.filter((b) => b.earned).length;

  return (
    <div className={`rounded-3xl border p-5 ${toneClass(sectionTone)}`}>
      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Badge Collection</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text)]">작은 트로피 컬렉션</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{"획득한 배지 "}{showcase.totalEarned}{"개"}</p>
        </div>
        {showcase.totalEarned > 0 && <Badge variant="success">최근 달성 흐름 좋음</Badge>}
      </div>

      {/* ── 전체 수집 진행도 ── */}
      {showcase.showcaseBadges.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>배지 수집 진행도</span>
            <span className="tabular-nums">{showcase.totalEarned} / {showcase.showcaseBadges.length}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((showcase.totalEarned / showcase.showcaseBadges.length) * 100)}%`,
                background: showcase.totalEarned === showcase.showcaseBadges.length
                  ? "linear-gradient(90deg,#22C55E,#4ADE80)"
                  : "linear-gradient(90deg,#7C83FD,#A78BFA)",
              }}
            />
          </div>
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {showcase.totalEarned === 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">{safeEmptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{safeEmptyBody}</p>
        </div>
      )}

      {/* ── 최근 획득 배지 ── */}
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

      {/* ── 다음 배지 목표 ── */}
      {showcase.nextBadge && (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">다음 배지 목표</p>
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
                      <span>진행도</span>
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

      {/* ════════════════════════════════════════
          인형 컬렉션 섹션
      ════════════════════════════════════════ */}
      {characterBadges.length > 0 && (
        <div className="mt-8">
          {/* 인형 컬렉션 헤더 */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Doll Collection</p>
              <p className="mt-1 text-base font-semibold text-[var(--text)]">인형 컬렉션</p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1 text-xs text-[var(--text-muted)] tabular-nums">
              {earnedCharCount} / {characterBadges.length}
            </span>
          </div>

          {/* 인형 수집 진행도 바 */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${characterBadges.length > 0 ? Math.round((earnedCharCount / characterBadges.length) * 100) : 0}%`,
                background: earnedCharCount === characterBadges.length
                  ? "linear-gradient(90deg,#F59E0B,#FCD34D)"
                  : "linear-gradient(90deg,#FB923C,#FCD34D)",
              }}
            />
          </div>

          {/* 인형 카드 그리드 */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...characterBadges].sort((a, b) => {
              const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
              const ra = getBadgeMetadata(a.key).rarity;
              const rb = getBadgeMetadata(b.key).rarity;
              return (order[ra] ?? 99) - (order[rb] ?? 99);
            }).map((badge) => {
              const meta = getBadgeMetadata(badge.key);
              const rarityColor = BADGE_RARITY_COLOR[meta.rarity] ?? meta.accentColor;
              return (
                <CharacterBadgeCard
                  key={badge.key}
                  title={meta.title}
                  subtitle={meta.subtitle}
                  iconUrl={meta.iconUrl}
                  rarity={meta.rarity}
                  accentColor={rarityColor}
                  state={badge.state}
                  earnedAt={badge.earnedAt}
                />
              );
            })}
          </div>

          {/* 인형 획득 조건 힌트 */}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {"미션 달성 조건을 충족하면 인형이 잠금 해제돼요."}
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════
          어빌리티 배지 섹션
      ════════════════════════════════════════ */}
      {achievementBadges.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Achievements</p>
              <p className="mt-1 text-base font-semibold text-[var(--text)]">달성 배지</p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1 text-xs text-[var(--text-muted)] tabular-nums">
              {earnedAchCount} / {achievementBadges.length}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {achievementBadges.map((badge) => {
              const meta = getBadgeMetadata(badge.key);
              const rarityBorder = RARITY_BORDER[meta.rarity] ?? "rgba(148,163,184,0.35)";
              const rarityGlow   = RARITY_GLOW[meta.rarity]   ?? "transparent";
              const rarityLabel  = RARITY_LABEL_DISPLAY[meta.rarity] ?? meta.rarity.toUpperCase();
              const isLocked     = badge.state === "locked";
              const isInProgress = badge.state === "in_progress";

              return (
                <div
                  key={badge.key}
                  className="min-w-0 overflow-hidden rounded-[28px] border p-4 transition-all duration-300 sm:p-5"
                  style={{
                    borderColor: isLocked ? "rgba(148,163,184,0.18)" : rarityBorder,
                    background: isLocked
                      ? "rgba(255,255,255,0.02)"
                      : isInProgress
                      ? `linear-gradient(180deg,${rarityGlow},rgba(255,255,255,0.01))`
                      : `linear-gradient(180deg,${rarityGlow},rgba(255,255,255,0.02))`,
                    boxShadow: badge.earned
                      ? `0 0 0 1px ${rarityBorder}, 0 20px 40px rgba(0,0,0,0.22)`
                      : "none",
                  }}
                >
                  {/* 희귀도 레이블 + 상태 뱃지 */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest"
                      style={{
                        color: isLocked ? "rgba(148,163,184,0.6)" : rarityBorder,
                        border: `1px solid ${isLocked ? "rgba(148,163,184,0.2)" : rarityBorder}`,
                        background: isLocked ? "transparent" : `${rarityGlow}`,
                      }}
                    >
                      {rarityLabel}
                    </span>
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
                      badge.earned
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : badge.state === "in_progress"
                          ? "border-amber-300/30 bg-amber-400/10 text-amber-300"
                          : "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]"
                    }`}>
                      {badgeStateLabel(badge.state)}
                    </span>
                  </div>

                  <div
                    className="flex items-start gap-3"
                    style={{ filter: isLocked ? "grayscale(1)" : "none", opacity: isLocked ? 0.45 : 1 }}
                  >
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
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <span>{normalizeDisplayText(BADGE_CATEGORY_LABELS[meta.category])}</span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{normalizeDisplayText(meta.description)}</p>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-3 py-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                      <span>진행도</span>
                      <span>{normalizeDisplayText(badge.progressLabel)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${badge.progressPercent}%`,
                          backgroundColor: isLocked ? "rgba(148,163,184,0.35)" : meta.accentColor,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {badge.earned ? "축하해요! 트로피 컬렉션에 추가됐어요." : normalizeDisplayText(badge.remainingLabel)}
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
      )}
    </div>
  );
}
