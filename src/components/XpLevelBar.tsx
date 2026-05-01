"use client"

interface Props {
  level: number
  levelName: string
  levelEmoji: string
  levelColor: string
  totalXp: number
  nextLevelXp: number
  nextLevelName: string
  progressPct: number
  dailyStreak?: number
  totalMissions?: number
  badgeCount?: number
  compact?: boolean
}

function tierStyle(levelName: string, levelColor: string) {
  const n = levelName
  if (n.includes("전설") || n.includes("legend") || n.includes("Legend")) return {
    bar:   "linear-gradient(90deg,#FACC15,#F59E0B,#FB923C)",
    badge: "linear-gradient(135deg,rgba(250,204,21,0.15),rgba(245,158,11,0.06))",
    glow:  "rgba(250,204,21,0.40)",
    border:`rgba(250,204,21,0.40)`,
  }
  if (n.includes("챔피언") || n.includes("champion") || n.includes("Champion")) return {
    bar:   "linear-gradient(90deg,#67E8F9,#38BDF8,#818CF8)",
    badge: "linear-gradient(135deg,rgba(103,232,249,0.14),rgba(56,189,248,0.06))",
    glow:  "rgba(103,232,249,0.35)",
    border:`rgba(103,232,249,0.40)`,
  }
  if (n.includes("마스터") || n.includes("master") || n.includes("Master")) return {
    bar:   "linear-gradient(90deg,#C084FC,#A855F7,#7C3AED)",
    badge: "linear-gradient(135deg,rgba(192,132,252,0.14),rgba(168,85,247,0.06))",
    glow:  "rgba(192,132,252,0.35)",
    border:`rgba(192,132,252,0.40)`,
  }
  return {
    bar:   `linear-gradient(90deg,${levelColor},${levelColor}CC)`,
    badge: `linear-gradient(135deg,${levelColor}18,${levelColor}06)`,
    glow:  `${levelColor}38`,
    border:`${levelColor}44`,
  }
}

export default function XpLevelBar({
  level, levelName, levelEmoji, levelColor,
  totalXp, nextLevelXp, nextLevelName, progressPct,
  dailyStreak, totalMissions, badgeCount,
  compact = false,
}: Props) {
  const tier = tierStyle(levelName, levelColor)

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border p-3 transition-all"
        style={{ borderColor: tier.border, background: tier.badge }}
      >
        {/* 레벨 뱃지 */}
        <div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{
            background: tier.badge,
            border: `1.5px solid ${tier.border}`,
            boxShadow: `0 4px 14px ${tier.glow}`,
          }}
        >
          {levelEmoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="text-sm font-black" style={{ color: levelColor }}>Lv.{level}</span>
            <span className="text-sm font-bold text-[var(--text)]">{levelName}</span>
            <span className="ml-auto text-xs text-[var(--text-muted)] tabular-nums">{totalXp.toLocaleString()} XP</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: tier.bar }}
            />
          </div>
          <div className="mt-0.5 flex justify-between">
            <span className="text-[11px] font-semibold" style={{ color: levelColor }}>{progressPct}%</span>
            <span className="text-[11px] text-[var(--text-muted)]">→ {nextLevelName}</span>
          </div>
        </div>

        {dailyStreak !== undefined && dailyStreak > 0 && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-orange-500/15 px-2 py-1 border border-orange-500/25">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold text-orange-400">{dailyStreak}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{ borderColor: tier.border, background: tier.badge }}
    >
      {/* 빛 효과 */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl"
        style={{ backgroundColor: tier.glow }}
      />

      <div className="relative flex items-center gap-3 mb-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{
            background: tier.badge,
            border: `2px solid ${tier.border}`,
            boxShadow: `0 8px 24px ${tier.glow}`,
          }}
        >
          {levelEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black" style={{ color: levelColor }}>Lv.{level}</span>
            <span className="text-lg font-bold text-[var(--text)]">{levelName}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] tabular-nums">{totalXp.toLocaleString()} XP 보유</p>
        </div>
        {dailyStreak !== undefined && dailyStreak > 0 && (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
            <span>🔥</span>
            <span className="text-sm font-bold text-orange-400">{dailyStreak}일 연속!</span>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="h-3 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.07)]">
          <div
            className="relative h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%`, background: tier.bar }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          </div>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-xs font-bold" style={{ color: levelColor }}>{progressPct}%</span>
          <span className="text-xs text-[var(--text-muted)]">
            다음: <span className="font-semibold">{nextLevelName}</span>{" "}
            <span className="tabular-nums">({nextLevelXp.toLocaleString()} XP)</span>
          </span>
        </div>
      </div>

      {(totalMissions !== undefined || badgeCount !== undefined) && (
        <div className="flex gap-6 mt-3 pt-3 border-t border-[var(--border)]">
          {totalMissions !== undefined && (
            <div>
              <p className="text-lg font-black text-[var(--text)]">{totalMissions}</p>
              <p className="text-xs text-[var(--text-muted)]">완료 미션</p>
            </div>
          )}
          {badgeCount !== undefined && (
            <div>
              <p className="text-lg font-black text-[var(--text)]">{badgeCount}</p>
              <p className="text-xs text-[var(--text-muted)]">획득 배지</p>
            </div>
          )}
          {dailyStreak !== undefined && (
            <div>
              <p className="text-lg font-black text-orange-400">{dailyStreak}일</p>
              <p className="text-xs text-[var(--text-muted)]">연속 학습</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
