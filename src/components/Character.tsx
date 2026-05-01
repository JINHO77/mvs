"use client";

import Image from "next/image";

export type CharacterCategory = "emotions" | "subjects" | "support" | "situation";

interface CharacterProps {
  /** 캐릭터 키 (예: 'mv_wink', 'mv_detective') */
  characterKey: string;
  /** 카테고리 (생략 시 자동 추론) */
  category?: CharacterCategory;
  /** 크기(px). 기본 80 */
  size?: number;
  /** 라벨/대체 텍스트 */
  alt?: string;
  /** 라이트 모드에서 흰 카드 안에 감싸 표시(배경 튐 방지) */
  framed?: boolean;
  className?: string;
}

// 키 → 카테고리 자동 추론
const CATEGORY_MAP: Record<string, CharacterCategory> = {
  // emotions
  mv_smile: "emotions", mv_excited: "emotions", mv_wink: "emotions",
  mv_surprised: "emotions", mv_thinking: "emotions", mv_focused: "emotions",
  mv_sad: "emotions", mv_worried: "emotions", mv_annoyed: "emotions",
  mv_touched: "emotions", mv_shy: "emotions", mv_crying: "emotions",
  // subjects
  mv_korean: "subjects", mv_math: "subjects", mv_english: "subjects",
  mv_science: "subjects", mv_social: "subjects", mv_coding: "subjects",
  mv_art: "subjects", mv_music: "subjects", mv_pe: "subjects",
  mv_reading: "subjects",
  // support
  mv_counsel: "support", mv_career: "support", mv_friend: "support",
  mv_family: "support", mv_stress: "support", mv_cheer: "support",
  mv_comfort: "support", mv_confidence: "support", mv_habit: "support",
  mv_praise: "support",
  // situation
  mv_exam: "situation", mv_time: "situation", mv_focus_mode: "situation",
  mv_rest: "situation", mv_travel: "situation", mv_weather: "situation",
  mv_manner: "situation", mv_eco: "situation", mv_challenge: "situation",
  mv_dream: "situation",
};

// 레벨 캐릭터 키 → 실제 PNG 파일 키로 치환
const LEVEL_TO_FILE: Record<string, string> = {
  mv_sprout: "mv_smile",
  mv_curious: "mv_wink",
  mv_reader: "mv_reading",
  mv_problem_solver: "mv_math",
  mv_detective: "mv_science",
  mv_logic_master: "mv_coding",
  mv_champion: "mv_cheer",
  mv_strategist: "mv_thinking",
  mv_god: "mv_touched",
  mv_legend_scholar: "mv_art",
  mv_champion_crown: "mv_confidence",
  mv_grand: "mv_music",
  mv_mythic: "mv_challenge",
  mv_immortal: "mv_dream",
  mv_galaxy: "mv_travel",
};

export function Character({
  characterKey,
  category,
  size = 80,
  alt,
  framed = false,
  className = "",
}: CharacterProps) {
  const fileKey = LEVEL_TO_FILE[characterKey] ?? characterKey;
  const cat = category ?? CATEGORY_MAP[fileKey] ?? "emotions";
  const src = `/characters/${cat}/${fileKey}.png`;

  const img = (
    <Image
      src={src}
      alt={alt ?? characterKey}
      width={size}
      height={size}
      className={framed ? "" : className}
      onError={(e) => {
        const target = e.currentTarget as HTMLImageElement;
        if (!target.src.endsWith("/characters/emotions/mv_smile.png")) {
          target.src = "/characters/emotions/mv_smile.png";
        }
      }}
      unoptimized
    />
  );

  if (framed) {
    return (
      <div
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {img}
      </div>
    );
  }
  return img;
}
