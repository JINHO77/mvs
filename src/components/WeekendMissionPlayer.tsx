"use client";

import { useState, useEffect } from "react";
import { completeWeekendMission, type WeekendCompletionResult } from "@/lib/weekendRecommendations";

interface Activity {
  type: string;
  prompt: string;
  options?: string[];
  answer?: number | string | number[];
  answers?: number[];
  hints?: string[];
  explanation?: string;
  acceptedAnswers?: string[];
}

interface Mission {
  id: string;
  title: string;
  scenario: string;
  difficulty: string;
  estimated_minutes: number;
  mission_json: {
    intro?: { text: string };
    activities: Activity[];
  };
}


interface Props {
  mission: Mission;
  onBack: () => void;
  userId?: string;
  isWeekend?: boolean;
  isRecommended?: boolean;
}

const difficultyLabel: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "도전",
};

export default function WeekendMissionPlayer({ mission, onBack, userId, isWeekend = false, isRecommended = false }: Props) {
  const activities = mission.mission_json?.activities ?? [];
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [multiSelected, setMultiSelected] = useState<number[]>([]);
  const [shortAnswer, setShortAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [done, setDone] = useState(false);
  // Tracks per-step correctness to calculate finalScore
  const [stepResults, setStepResults] = useState<boolean[]>([]);
  const [finalScore, setFinalScore] = useState<number>(100);
  const [completionResult, setCompletionResult] = useState<WeekendCompletionResult | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  const activity = activities[step];

  // step 바뀌면 초기화
  useEffect(() => {
    setSelected(null);
    setMultiSelected([]);
    setShortAnswer("");
    setSubmitted(false);
    setIsCorrect(null);
    setShowHint(false);
    setHintIndex(0);
  }, [step]);

  // complete_weekend_mission — 미션 완료 시 호출
  useEffect(() => {
    if (!done || !userId) return;

    const handleComplete = async () => {
      setCompletionLoading(true);
      try {
        const result = await completeWeekendMission(userId, mission.id, finalScore);
        setCompletionResult(result);
      } catch (e) {
        console.error("complete_weekend_mission failed", e);
      } finally {
        setCompletionLoading(false);
      }
    };

    void handleComplete();
  }, [done, userId, mission.id, finalScore]);

  if (done) {
    const isRecommended = completionResult?.is_recommended ?? false;
    const baseXp       = completionResult?.base_xp        ?? 20;
    const bonusXp      = completionResult?.bonus_xp       ?? 0;
    const xpEarned     = baseXp + bonusXp + (completionResult?.perfect_bonus ?? 0) + (completionResult?.streak_bonus ?? 0);
    const totalXp      = completionResult?.total_xp       ?? xpEarned;
    const resultMsg    = completionResult?.message        ?? "미션 완료! 수고했어요 💪";

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-[#D4537E]">미션 완료!</h2>

        {completionLoading ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
            <span className="animate-spin text-lg">⏳</span>
            <span>결과 저장 중...</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-8 py-5 flex flex-col items-center gap-1.5">
            {isRecommended && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-400/20 text-yellow-500 dark:text-yellow-400 border border-yellow-400/40 mb-1">
                ⭐ 이번 주 추천 미션
              </span>
            )}
            <p className={`text-3xl font-bold ${isRecommended ? "text-yellow-500 dark:text-yellow-400" : "text-[#D4537E] dark:text-[#a6f4c5]"}`}>
              +{xpEarned} XP
            </p>
            {/* XP breakdown */}
            <div className="flex flex-col items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span>기본 {baseXp} XP{bonusXp > 0 ? ` + 추천 보너스 ${bonusXp} XP` : ""}</span>
              {(completionResult?.perfect_bonus ?? 0) > 0 && (
                <span>+ 퍼펙트 보너스 {completionResult!.perfect_bonus} XP</span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              이번 주 누적 {totalXp} XP
            </p>
          </div>
        )}

        <p className="text-gray-600 dark:text-[var(--text-muted)] text-sm max-w-xs">{resultMsg}</p>
        <p className="text-gray-400 dark:text-[var(--text-muted)] text-xs">
          &ldquo;{mission.title}&rdquo; 완료했어 💪
        </p>
        <button
          onClick={onBack}
          className="mt-2 px-6 py-3 rounded-full bg-[#D4537E] dark:bg-[var(--accent)] text-white dark:text-[#0b1220] font-medium hover:bg-[#c0466e] transition-colors"
        >
          다른 미션 보기
        </button>
      </div>
    );
  }

  if (!activity) return null;

  const handleSubmit = () => {
    if (submitted) {
      // Accumulate step result, then advance or finish
      const newResults = [...stepResults, isCorrect ?? true];
      setStepResults(newResults);

      if (step < activities.length - 1) {
        setStep((s) => s + 1);
      } else {
        const correctCount = newResults.filter(Boolean).length;
        const score = newResults.length > 0
          ? Math.round((correctCount / newResults.length) * 100)
          : 100;
        setFinalScore(score);
        setDone(true);
      }
      return;
    }

    setSubmitted(true);

    if (activity.type === "multiple_choice") {
      setIsCorrect(selected === activity.answer);
    } else if (activity.type === "multi_select") {
      const correct = [...(activity.answers ?? [])].sort().join(",");
      const user = [...multiSelected].sort().join(",");
      setIsCorrect(correct === user);
    } else if (activity.type === "short_answer") {
      setIsCorrect(true); // 주관식은 항상 통과
    } else if (activity.type === "concept_check") {
      setIsCorrect(true);
    }
  };

  const canSubmit = () => {
    if (submitted) return true;
    if (activity.type === "multiple_choice") return selected !== null;
    if (activity.type === "multi_select") return multiSelected.length > 0;
    if (activity.type === "short_answer") return shortAnswer.trim().length >= 5;
    if (activity.type === "concept_check") return shortAnswer.trim().length >= 5;
    return false;
  };

  const progress = ((step + (submitted ? 1 : 0)) / activities.length) * 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <button onClick={onBack} className="text-sm text-[#D4537E] dark:text-[var(--text-muted)] mb-4 hover:underline">
        ← 목록으로
      </button>

      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#D4537E] dark:text-[#a6f4c5] uppercase mb-1">
            WEEKEND CHALLENGE · {mission.title}
          </p>
        </div>
        <span className={`text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${isRecommended && isWeekend ? "bg-gradient-to-r from-[#7F77DD] to-[#D4537E]" : "bg-[#D4537E] dark:bg-[var(--success-bg)] dark:text-[var(--success-text)] dark:border dark:border-[#a6f4c5]/30"}`}>
          {isRecommended && isWeekend ? "⭐ +150 XP" : "+50 XP"}
        </span>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{mission.scenario}</p>

      {/* 진행 바 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs text-gray-400 whitespace-nowrap">
          활동 {step + 1} / {activities.length}
        </span>
        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#D4537E] dark:bg-gradient-to-r dark:from-[#facc15] dark:to-[#6ee7b7] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {difficultyLabel[mission.difficulty] ?? mission.difficulty}
        </span>
      </div>

      {/* 문제 카드 */}
      <div className="bg-white dark:bg-[#1e2535] rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        {/* 문제 유형 라벨 */}
        <div className="mb-3">
          <span className="text-xs font-medium text-[#D4537E] dark:text-[#a6f4c5] bg-[#FBEAF0] dark:bg-[var(--success-bg)] px-2 py-1 rounded-full">
            {activity.type === "multiple_choice" && "선택형"}
            {activity.type === "multi_select" && "복수 선택"}
            {activity.type === "short_answer" && "짧게 써봐"}
            {activity.type === "concept_check" && "생각해봐"}
          </span>
        </div>

        {/* 질문 */}
        <p className="text-base font-medium text-gray-800 dark:text-gray-100 mb-5 leading-relaxed">
          {activity.prompt}
        </p>

        {/* multiple_choice */}
        {activity.type === "multiple_choice" && (
          <div className="flex flex-col gap-2">
            {(activity.options ?? []).map((opt, i) => {
              let cls = "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ";
              if (!submitted) {
                cls += selected === i
                  ? "border-[#D4537E] dark:border-[var(--accent)] bg-[#FBEAF0] dark:bg-[var(--accent-soft)] text-[#72243E] dark:text-[var(--accent)] font-medium"
                  : "border-gray-200 dark:border-gray-600 hover:border-[#ED93B1] dark:hover:border-[var(--accent)] hover:bg-[#FBEAF0]/50 dark:hover:bg-[var(--accent-soft)] text-gray-700 dark:text-gray-200";
              } else {
                if (i === activity.answer) {
                  cls += "border-green-400 bg-green-50 text-green-800 font-medium";
                } else if (i === selected && selected !== activity.answer) {
                  cls += "border-red-300 bg-red-50 text-red-700";
                } else {
                  cls += "bg-white dark:bg-[#1e2535] border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-600";
                }
              }
              return (
                <button
                  key={i}
                  className={cls}
                  disabled={submitted}
                  onClick={() => setSelected(i)}
                >
                  <span className="mr-2 font-bold text-[#D4537E] dark:text-[var(--text-muted)]">
                    {["①", "②", "③", "④"][i]}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* multi_select */}
        {activity.type === "multi_select" && (
          <div className="flex flex-col gap-2">
            {!submitted && (
              <p className="text-xs text-gray-400 mb-1">해당하는 것을 모두 선택해봐!</p>
            )}
            {(activity.options ?? []).map((opt, i) => {
              const checked = multiSelected.includes(i);
              const isCorrectAnswer = (activity.answers ?? []).includes(i);
              let cls = "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3 ";
              if (!submitted) {
                cls += checked
                  ? "border-[#D4537E] dark:border-[var(--accent)] bg-[#FBEAF0] dark:bg-[var(--accent-soft)] text-[#72243E] dark:text-[var(--accent)] font-medium"
                  : "border-gray-200 dark:border-gray-600 hover:border-[#ED93B1] text-gray-700 dark:text-gray-200";
              } else {
                if (isCorrectAnswer) {
                  cls += "border-green-400 bg-green-50 text-green-800 font-medium";
                } else if (checked && !isCorrectAnswer) {
                  cls += "border-red-300 bg-red-50 text-red-700";
                } else {
                  cls += "bg-white dark:bg-[#1e2535] border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-600";
                }
              }
              return (
                <button
                  key={i}
                  className={cls}
                  disabled={submitted}
                  onClick={() => {
                    setMultiSelected((prev) =>
                      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                    );
                  }}
                >
                  <span
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold
                      ${checked ? "border-[#D4537E] dark:border-[var(--accent)] bg-[#D4537E] dark:bg-[var(--accent)] text-white dark:text-[#0b1220]" : "border-gray-300"}`}
                  >
                    {checked && "✓"}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* short_answer / concept_check */}
        {(activity.type === "short_answer" || activity.type === "concept_check") && (
          <div>
            <p className="text-xs text-gray-400 mb-2">
              ✏️ 짧게 1~2문장으로! 정답 없어요.
            </p>
            <textarea
              rows={2}
              maxLength={150}
              placeholder="여기에 써봐..."
              disabled={submitted}
              value={shortAnswer}
              onChange={(e) => setShortAnswer(e.target.value)}
              className="w-full bg-white dark:bg-[#151c2c] border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm resize-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4537E] dark:focus:ring-[var(--accent)] focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">
              {shortAnswer.length}/150
            </p>
          </div>
        )}

        {/* 힌트 */}
        {!submitted && activity.hints && activity.hints.length > 0 && (
          <div className="mt-4">
            {!showHint ? (
              <button
                onClick={() => setShowHint(true)}
                className="text-xs text-[#D4537E] dark:text-[#a6f4c5] border border-[#ED93B1] dark:border-[#a6f4c5]/50 rounded-full px-3 py-1.5 hover:bg-[#FBEAF0] dark:hover:bg-[var(--success-bg)] transition-colors"
              >
                💡 힌트 보기
              </button>
            ) : (
              <div className="bg-[#FBEAF0] dark:bg-[var(--success-bg)] rounded-xl p-3 border border-[#F4C0D1] dark:border-[#a6f4c5]/20">
                <p className="text-sm text-[#72243E] dark:text-[#a6f4c5]">
                  💡 {activity.hints[hintIndex]}
                </p>
                {hintIndex < activity.hints.length - 1 && (
                  <button
                    onClick={() => setHintIndex((i) => i + 1)}
                    className="text-xs text-[#D4537E] dark:text-[#a6f4c5] mt-2 hover:underline"
                  >
                    다음 힌트 →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 해설 */}
        {submitted && activity.explanation && (
          <div
            className={`mt-4 rounded-xl p-4 border ${
              isCorrect
                ? "bg-green-50 border-green-200"
                : "bg-orange-50 border-orange-200"
            }`}
          >
            <p
              className={`text-xs font-bold mb-1 ${
                isCorrect ? "text-green-700" : "text-orange-700"
              }`}
            >
              {isCorrect ? "✅ 정답!" : "💡 이렇게 생각해봐"}
            </p>
            <p
              className={`text-sm leading-relaxed ${
                isCorrect ? "text-green-800" : "text-orange-800"
              }`}
            >
              {activity.explanation}
            </p>
          </div>
        )}

        {/* 제출/다음 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit()}
          className={`mt-5 w-full py-3 rounded-xl font-medium text-sm transition-all ${
            canSubmit()
              ? "bg-[#D4537E] dark:bg-[var(--accent)] text-white dark:text-[#0b1220] font-medium dark:font-semibold hover:bg-[#c0466e] dark:hover:opacity-90 active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {submitted
            ? step < activities.length - 1
              ? "다음 문제 →"
              : "미션 완료! 🎉"
            : "확인"}
        </button>
      </div>

      {/* 하단 진행 도트 */}
      <div className="flex justify-center gap-2 mt-4">
        {activities.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === step
                ? "w-4 h-2 bg-[#D4537E] dark:bg-[var(--accent)]"
                : i < step
                ? "w-2 h-2 bg-[#ED93B1]"
                : "w-2 h-2 bg-gray-200 dark:bg-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
