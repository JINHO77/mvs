"use client";

import { Character } from "@/components/Character";

interface LevelUpModalProps {
  prevLevel: number;
  newLevel: number;
  newTitle: string;
  /** DB의 character_key (예: 'mv_detective'). 없으면 mv_smile fallback. */
  newCharacterKey: string;
  onClose: () => void;
}

export function LevelUpModal({
  prevLevel,
  newLevel,
  newTitle,
  newCharacterKey,
  onClose,
}: LevelUpModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: "2px solid var(--accent)",
          borderRadius: 24,
          padding: "2rem 1.75rem",
          textAlign: "center",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          color: "var(--text)",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
          🎉 레벨업!
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: "var(--accent)",
            marginBottom: 16,
          }}
        >
          Lv {prevLevel} → Lv {newLevel}
        </div>

        <div style={{ marginBottom: 16 }}>
          <Character characterKey={newCharacterKey} size={160} framed />
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
          {newTitle}
        </h3>
        <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6, fontSize: 14 }}>
          새로운 단계로 성장했어요! 계속 화이팅 💪
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "0.75rem 2rem",
            borderRadius: 12,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}
