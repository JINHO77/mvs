"use client"

import { useEffect, useState } from "react"

interface XpGainPopupProps {
  xpEarned: number
  totalXp: number
  leveledUp: boolean
  newLevel?: number
  newLevelName?: string
  newLevelEmoji?: string
  levelColor?: string
  streak?: number
  isRecommended?: boolean
  perfectScore?: boolean
  onClose: () => void
}

export default function XpGainPopup({
  xpEarned, totalXp, leveledUp,
  newLevel, newLevelName, newLevelEmoji,
  levelColor = '#D4537E',
  streak, isRecommended, perfectScore,
  onClose,
}: XpGainPopupProps) {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    setVisible(true)
    const t1 = setTimeout(() => setShowDetails(true), 300)
    const t2 = setTimeout(() => { setVisible(false); setTimeout(onClose, 400) }, 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onClose])

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-400 ${visible ? 'opacity-100' : 'opacity-0'}`}>

      {/* 레벨업이면 배경 오버레이 */}
      {leveledUp && (
        <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
      )}

      <div
        className={`relative pointer-events-auto mx-4 rounded-3xl shadow-2xl p-6 text-center transition-all duration-500 ${
          visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'
        } ${leveledUp
          ? 'bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-purple-400/50 min-w-72'
          : 'bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-gray-600 min-w-56'
        }`}
      >
        {leveledUp ? (
          /* ── 레벨업 팝업 ── */
          <>
            <div className="text-5xl mb-2 animate-bounce">{newLevelEmoji}</div>
            <p className="text-purple-300 text-sm font-bold mb-1">🎊 레벨 업!</p>
            <p className="text-white text-2xl font-black mb-1">
              Lv.{newLevel} {newLevelName}
            </p>
            <p className="text-purple-200 text-sm mb-4">+{xpEarned} XP 획득</p>
            <div className="bg-purple-800/50 rounded-xl px-4 py-2 mb-4">
              <p className="text-white text-xs">누적 XP: <span className="font-bold text-yellow-300">{totalXp.toLocaleString()}</span></p>
            </div>
            <button
              onClick={() => { setVisible(false); setTimeout(onClose, 400) }}
              className="w-full py-2 rounded-xl bg-purple-500 text-white font-bold text-sm hover:bg-purple-400 transition"
            >
              계속 학습하기! 🚀
            </button>
          </>
        ) : (
          /* ── 일반 XP 획득 팝업 ── */
          <>
            <div className="text-3xl mb-2">
              {isRecommended ? '⭐' : perfectScore ? '💯' : '✅'}
            </div>
            <p className="text-2xl font-black mb-1" style={{ color: levelColor }}>
              +{xpEarned} XP
            </p>
            {showDetails && (
              <div className="space-y-1">
                {isRecommended && (
                  <p className="text-xs font-bold text-yellow-500">🌟 추천 미션 보너스!</p>
                )}
                {perfectScore && (
                  <p className="text-xs font-bold text-green-500">💯 퍼펙트 스코어!</p>
                )}
                {streak && streak >= 3 && (
                  <p className="text-xs font-bold text-orange-500">🔥 {streak}일 연속 보너스!</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  누적 {totalXp.toLocaleString()} XP
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
