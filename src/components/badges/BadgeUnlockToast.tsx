import BadgeMedal from "@/components/badges/BadgeMedal";
import { getBadgeMetadata } from "@/constants/badgeMetadata";
import { normalizeDisplayText } from "@/lib/uiText";
import type { EarnedBadgeSummary } from "@/types/badges";

type BadgeUnlockToastProps = {
  badges: EarnedBadgeSummary[];
  onClose: () => void;
};

export default function BadgeUnlockToast({ badges, onClose }: BadgeUnlockToastProps) {
  if (badges.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-[28px] border border-emerald-400/30 bg-[linear-gradient(180deg,rgba(18,52,61,0.96),rgba(2,6,23,0.98))] p-4 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">New Trophy</p>
          <p className="mt-2 text-lg font-semibold">축하해요! 새 배지를 얻었어요.</p>
          <p className="mt-2 text-sm text-emerald-50/80">작은 트로피 컬렉션에 반짝이는 배지가 추가됐어요.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-white/10 px-3 py-1 text-xs text-emerald-50/80 hover:text-white">
          닫기
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {badges.map((badge) => {
          const meta = getBadgeMetadata(badge.key);
          return (
            <div key={`${badge.key}:${badge.earnedAt}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
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
              <p className="mt-3 text-xs leading-5 text-emerald-50/85">{normalizeDisplayText(meta.description)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
