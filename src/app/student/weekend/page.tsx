"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const CATEGORIES = [
  { key: "all",              label: "전체",       emoji: "✨" },
  { key: "🔬 과학기술",     label: "과학기술",   emoji: "🔬" },
  { key: "💰 경제경영",     label: "경제경영",   emoji: "💰" },
  { key: "🌍 사회환경",     label: "사회환경",   emoji: "🌍" },
  { key: "🎨 예술창의",     label: "예술창의",   emoji: "🎨" },
  { key: "🧠 철학윤리",     label: "철학윤리",   emoji: "🧠" },
  { key: "🎮 게임·엔터",    label: "게임·엔터",  emoji: "🎮" },
  { key: "🍕 음식·문화",    label: "음식·문화",  emoji: "🍕" },
  { key: "🐾 동물·자연",    label: "동물·자연",  emoji: "🐾" },
  { key: "🏃 스포츠·건강",  label: "스포츠건강", emoji: "🏃" },
  { key: "🎵 음악·창작",    label: "음악·창작",  emoji: "🎵" },
  { key: "🌙 미래·우주",    label: "미래·우주",  emoji: "🌙" },
  { key: "💻 디지털 창작",  label: "디지털창작", emoji: "💻" },
  { key: "👨‍👩‍👧 가족·관계",   label: "가족·관계",  emoji: "👨‍👩‍👧" },
  { key: "🤝 리더십·변화",  label: "리더십",     emoji: "🤝" },
];

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움", normal: "보통", hard: "도전"
};
const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  normal: "bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400",
  hard:   "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function WeekendPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const weekendType = searchParams?.get("type")  ?? "creative";
  const level       = searchParams?.get("level") ?? "all";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [missions, setMissions]               = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [recommendedIds, setRecommendedIds]   = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recs, setRecs]                       = useState<any[]>([]);

  const isCreative = weekendType === "creative";
  // KST 기준 오늘 요일 (0=일, 6=토)
  const kstDay    = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay();
  const isWeekend = kstDay === 0 || kstDay === 6;
  const dayLabel   = isCreative ? "토요일" : "일요일";
  const typeLabel  = isCreative ? "창의·융합" : "인성·협력";
  const typeDesc   = isCreative
    ? "다른 분야를 연결해 새로운 것을 만드는 능력 — PBL·PhBL로 탐구해요"
    : "철학적 사고와 협력으로 복잡한 세상을 함께 풀어가는 힘을 키워요";

  /* ── 추천 미션 → 일반 미션 순서로 순차 로드 ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        /* 1) 이번 주 추천 없으면 생성 */
        await supabase.rpc("generate_weekly_weekend_recommendations");

        /* 3) 이번 주 추천 미션 전체 조회 (토+일, day_of_week 필터 없음) */
        const { data: recData, error: recError } = await supabase
          .from("v_this_week_recommendations")
          .select("*");

        if (recError) {
          console.warn("recommendations query error:", recError.message);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recRows: any[] = recData ?? [];
        const recIds: string[] = recRows.map((r: { mission_id: string }) => r.mission_id);

        setRecommendedIds(new Set(recIds));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRecs(recRows.map((r: any) => ({ ...r, id: r.mission_id })));
        console.log(`✅ 추천 미션 ${recRows.length}개 로드됨`);

        /* 4) 일반 주말 미션 조회 (subject IS NULL, 추천 제외) */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query: any = supabase
          .from("generated_missions")
          .select("id, title, scenario, difficulty, estimated_minutes, mission_json, interest_tags, subject")
          .is("subject", null)
          .eq("status", "published")
          .eq("is_active", true)
          .limit(50);

        if (recIds.length > 0) {
          query = query.not("id", "in", `(${recIds.join(",")})`);
        }

        const { data: missionData, error: missionError } = await query;
        if (missionError) {
          console.error("missions fetch error:", missionError.message);
        } else {
          setMissions(missionData ?? []);
          console.log(`📋 일반 미션 ${missionData?.length ?? 0}개 로드됨`);
        }
      } catch (e) {
        console.warn("load exception:", e);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [weekendType]); // weekendType 변경 시 재로드

  /* ── 추천 + 일반 미션 합산 (항상 recs 먼저, 그 다음 비추천 미션) ── */
  const allDisplayMissions = [
    ...recs,
    ...missions.filter(m => !recommendedIds.has(m.id)),
  ];

  const filtered = selectedCategory === "all"
    ? allDisplayMissions
    : allDisplayMissions.filter(m => {
        const category: string = m.mission_json?.category ?? "";
        return category.includes(selectedCategory);
      });

  /* ── 추천 미션 먼저, 그 다음 일반 정렬 ── */
  const sorted = [...filtered].sort((a, b) => {
    const aRec = recommendedIds.has(a.id) ? 0 : 1;
    const bRec = recommendedIds.has(b.id) ? 0 : 1;
    return aRec - bRec;
  });

  // 추천 배너/뱃지는 주말에만 표시
  const hasRecommended = isWeekend && recommendedIds.size > 0;

  // 활성 타입(창의/인성)에 해당하는 추천만 — view는 두 subject를 모두 반환함
  const activeSubject = isCreative ? "weekend_creative" : "weekend_character";
  const relevantRecs = recs.filter((r) => r?.subject === activeSubject);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* 뒤로 가기 */}
      <button
        onClick={() => router.push("/student")}
        className="text-sm text-[#D4537E] dark:text-[var(--text-muted)] mb-6 hover:underline"
      >
        ← 홈으로
      </button>

      {/* 헤더 */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#D4537E] dark:text-[#a6f4c5] uppercase mb-1">
            WEEKEND CHALLENGE · {dayLabel}
          </p>
          <h1 className="text-2xl font-bold text-[#534AB7] dark:text-[var(--text)]">
            주말 챌린지 — {typeLabel}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{typeDesc}</p>
        </div>

        {/* 오른쪽 XP 뱃지 */}
        <div className="text-right flex-shrink-0 ml-4">
          {!loading && hasRecommended ? (
            <>
              <span className="inline-block bg-gradient-to-r from-[#7F77DD] to-[#D4537E] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
                {isWeekend ? "⭐ +150 XP" : "⭐ +50 XP"}
              </span>
              <p className="text-xs text-[#7F77DD] dark:text-[#a6f4c5] mt-1">
                {isWeekend ? "추천 미션 완료 시" : "주말엔 +150 XP!"}
              </p>
            </>
          ) : (
            <>
              <span className="bg-[#D4537E] dark:bg-[var(--success-bg)] text-white dark:text-[var(--success-text)] text-xs font-bold px-3 py-1.5 rounded-full dark:border dark:border-[#a6f4c5]/30">
                +50 XP
              </span>
              <p className="text-xs text-[#7F77DD] dark:text-[#a6f4c5] mt-1">
                {isWeekend ? "주말 보너스 적용" : "주말 추천은 +150 XP"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* 추천 미션 안내 배너 */}
      {!loading && hasRecommended && (
        <div className="mt-4 mb-2 px-4 py-3 rounded-xl border border-yellow-300/50 dark:border-yellow-500/30 bg-yellow-50/80 dark:bg-yellow-900/10 flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <div>
            <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400">이번 주 추천 미션</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              {isWeekend
                ? <>추천 미션 완료 시 <strong>150 XP</strong> 지급 (일반 미션의 3배!)</>
                : <>지금 풀면 <strong>50 XP</strong> — 토·일요일에 풀면 <strong>150 XP</strong>!</>
              }
            </p>
          </div>
        </div>
      )}

      {/* 평일 미리보기 안내 배너 */}
      {!loading && !isWeekend && (
        <div className="mt-2 mb-2 px-4 py-3 rounded-xl border border-blue-200/50 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-900/10 flex items-center gap-2">
          <span className="text-lg">📅</span>
          <div>
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">주말 미션 미리보기</p>
            <p className="text-xs text-blue-600 dark:text-blue-500">
              지금도 풀 수 있어요! 단, 토·일요일에 완료해야 <strong>보너스 XP</strong>를 받아요 🎉
            </p>
          </div>
        </div>
      )}

      {/* ⭐ 이번 주 추천 미션 — 활성 타입 기준 */}
      {!loading && relevantRecs.length > 0 && (
        <section className="mt-6 mb-6 rounded-2xl border-2 border-[var(--accent)] bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">⭐</span>
            <h2 className="text-lg font-bold text-[var(--text)]">
              이번 주 추천 미션
            </h2>
            <span className="ml-auto rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-[#0b1220]">
              +{relevantRecs[0]?.bonus_xp ?? 130} XP 보너스
            </span>
          </div>

          <p className="text-xs text-[var(--text-muted)] mb-3">
            매주 새롭게 추천되는 특별 미션 — 완료하면 추가 보너스 XP!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relevantRecs.map((rec) => {
              const isSaturday = rec.day_of_week === "saturday";
              const isToday = (isSaturday && kstDay === 6) || (!isSaturday && kstDay === 0);
              const baseXp = rec.base_xp ?? 20;
              const bonusXp = rec.bonus_xp ?? 130;
              const category = rec.mission_json?.category ?? "";
              const difficultyLabel =
                rec.difficulty === "easy"
                  ? "쉬움"
                  : rec.difficulty === "normal"
                    ? "보통"
                    : rec.difficulty === "hard"
                      ? "어려움"
                      : rec.difficulty;

              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => router.push(`/student/weekend/mission/${rec.mission_id}?recommended=true`)}
                  className={`block w-full rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${
                    isToday
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 shadow-md"
                      : "border-[var(--border)] bg-[var(--card)]"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-xs">
                    <span>{isSaturday ? "🟢 토요일" : "🔵 일요일"}</span>
                    {isToday && (
                      <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 font-bold text-white">
                        오늘!
                      </span>
                    )}
                    <span className="ml-auto text-[var(--text-muted)]">{difficultyLabel}</span>
                  </div>

                  <h3 className="line-clamp-2 font-bold text-[var(--text)]">
                    {rec.title}
                  </h3>

                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    {category && <span>{category}</span>}
                    {category && <span>·</span>}
                    <span>약 {rec.estimated_minutes}분</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-400">
                      +{baseXp} XP
                    </span>
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-400">
                      ⭐ +{bonusXp} 보너스
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 분야별 필터 탭 */}
      <div className="flex flex-wrap gap-2 mt-5 mb-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
              selectedCategory === cat.key
                ? "bg-[#534AB7] dark:bg-[var(--accent)] dark:text-[#0b1220] text-white border-[#534AB7] dark:border-[var(--accent)]"
                : "bg-white dark:bg-[#1e2535] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#7F77DD]"
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* 미션 카드 목록 */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🌱</p>
          <p className="font-medium">이 분야 미션을 준비 중이에요!</p>
          <button
            onClick={() => setSelectedCategory("all")}
            className="mt-3 text-sm text-[#D4537E] dark:text-[var(--accent)] underline"
          >
            전체 보기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map((mission) => {
            const isRec = recommendedIds.has(mission.id);
            return (
              <div
                key={mission.id}
                className={`rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all ${
                  isWeekend && isRec
                    ? "bg-white dark:bg-[#111827] border-yellow-300/60 dark:border-yellow-500/30 shadow-yellow-100/50 dark:shadow-yellow-900/20"
                    : "bg-white dark:bg-[#111827] border-gray-100 dark:border-gray-700"
                }`}
              >
                {/* 카드 상단 메타 */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">

                  {/* 추천 배지 — 주말에만 표시 */}
                  {isWeekend && isRec && (
                    <span
                      className="flex items-center gap-0.5 text-xs font-bold text-white px-2 py-0.5 rounded-full"
                      style={{ background: "linear-gradient(135deg,#7F77DD,#D4537E)" }}
                    >
                      ⭐ 이번 주 추천
                    </span>
                  )}

                  {/* 카테고리 */}
                  {mission.mission_json?.category && (
                    <span className="text-xs font-medium text-[#534AB7] dark:text-[var(--text-muted)] bg-[#EEEDFE] dark:bg-[#1e293b] px-2 py-0.5 rounded-full">
                      {mission.mission_json.category}
                    </span>
                  )}

                  {/* 난이도 */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[mission.difficulty] || "bg-gray-100 text-gray-600"}`}>
                    {DIFFICULTY_LABEL[mission.difficulty] || mission.difficulty}
                  </span>

                  {/* XP + 시간 (오른쪽 정렬) — 평일은 모두 기본 50 XP */}
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto flex items-center gap-1.5">
                    {isWeekend && isRec ? (
                      <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#7F77DD] to-[#D4537E]">
                        ⭐ +150 XP
                      </span>
                    ) : (
                      <span className="font-semibold text-gray-400 dark:text-gray-500">
                        기본 50 XP
                      </span>
                    )}
                    <span>· 약 {mission.estimated_minutes}분</span>
                  </span>
                </div>

                {/* 제목 */}
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1.5 leading-snug">
                  {mission.title}
                </h3>

                {/* 시나리오 미리보기 */}
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-4">
                  {mission.scenario}
                </p>

                {/* 역량 태그 */}
                {mission.mission_json?.competency && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {mission.mission_json.competency.map((c: any) => (
                      <span key={c} className="text-xs text-[#7F77DD] dark:text-[#a6f4c5] bg-[#EEEDFE] dark:bg-[var(--success-bg)] px-2 py-0.5 rounded-full">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* 시작 버튼 */}
                <button
                  onClick={() => router.push(`/student/weekend/mission/${mission.id}`)}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium active:scale-[0.98] transition-all ${
                    isWeekend && isRec
                      ? "bg-gradient-to-r from-[#7F77DD] to-[#D4537E] text-white hover:opacity-90 font-semibold shadow-sm"
                      : "bg-[#D4537E] dark:bg-[var(--accent)] text-white dark:text-[#0b1220] hover:bg-[#c0466e] dark:hover:opacity-90"
                  }`}
                >
                  {isWeekend && isRec ? "⭐ 추천 미션 시작 →" : "미션 시작 →"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 타입 전환 버튼 */}
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-center gap-3">
        <button
          onClick={() => router.push(`/student/weekend?type=creative&level=${level}`)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            isCreative
              ? "bg-[#534AB7] dark:bg-[var(--accent)] dark:text-[#0b1220] text-white"
              : "border border-gray-200 dark:border-[var(--border)] text-gray-600 dark:text-[var(--text-muted)] hover:border-[#534AB7]"
          }`}
        >
          🔭 창의·융합 (토)
        </button>
        <button
          onClick={() => router.push(`/student/weekend?type=character&level=${level}`)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            !isCreative
              ? "bg-[#D4537E] dark:bg-[var(--accent)] dark:text-[#0b1220] text-white"
              : "border border-gray-200 dark:border-[var(--border)] text-gray-600 dark:text-[var(--text-muted)] hover:border-[#D4537E]"
          }`}
        >
          🤝 인성·협력 (일)
        </button>
      </div>
    </div>
  );
}
