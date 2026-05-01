"use client";

import { useState } from "react";
import {
  MissionPill,
  MissionSurfaceCard,
  missionActionButtonClassName,
  missionMutedTextClassName,
  missionOptionClassName,
  missionTextareaClassName,
} from "@/components/student/MissionCards";
import type { ActivityRendererProps } from "./activityShared";
import { countMatchedKeywords } from "./activityShared";

type SelectAnswers = Record<number, number | null>;
type ExplainAnswers = Record<number, string>;

export default function CompareActivity({ step, disabled, onComplete }: ActivityRendererProps) {
  const config = step.compare;
  const [selectAnswers, setSelectAnswers] = useState<SelectAnswers>({});
  const [explainAnswers, setExplainAnswers] = useState<ExplainAnswers>({});
  const [submitted, setSubmitted] = useState<null | {
    score: number;
    breakdown: Array<{ index: number; type: string; correct?: boolean; matched?: string[]; subScore: number }>;
  }>(null);

  if (!config) {
    return (
      <MissionSurfaceCard variant="error" className="p-4 text-sm">
        활동 데이터가 비어 있어요. 학원에 문의해 주세요.
      </MissionSurfaceCard>
    );
  }

  const allAnswered = config.questions.every((q, idx) => {
    if (q.type === "select_better") return selectAnswers[idx] !== undefined && selectAnswers[idx] !== null;
    return (explainAnswers[idx] ?? "").trim().length > 0;
  });

  function evaluate() {
    const breakdown = config!.questions.map((q, idx) => {
      if (q.type === "select_better") {
        const chosen = selectAnswers[idx];
        const correct = chosen === q.answer;
        return { index: idx, type: q.type, correct, subScore: correct ? 100 : 0 };
      }
      const text = explainAnswers[idx] ?? "";
      const matched = countMatchedKeywords(text, q.expectedKeywords);
      const longEnough = text.trim().length >= q.minLength;
      let subScore = 60;
      if (matched.length >= q.expectedKeywords.length && longEnough) subScore = 100;
      else if (matched.length >= q.minKeywords && longEnough) subScore = 85;
      else if (matched.length >= q.minKeywords) subScore = 75;
      else if (longEnough) subScore = 65;
      return { index: idx, type: q.type, matched, subScore };
    });
    const total = breakdown.reduce((sum, b) => sum + b.subScore, 0);
    const score = Math.round(total / Math.max(1, breakdown.length));
    setSubmitted({ score, breakdown });
    onComplete({
      correct: score >= 70,
      score,
      studentAnswer: JSON.stringify({ selectAnswers, explainAnswers, breakdown }),
    });
  }

  return (
    <div className="space-y-5">
      {config.prompt && (
        <p className={missionMutedTextClassName("whitespace-pre-line break-words text-sm leading-6")}>{config.prompt}</p>
      )}

      {config.passage && (
        <MissionSurfaceCard variant="default" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-default-muted)]">지문</p>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-7">{config.passage}</p>
        </MissionSurfaceCard>
      )}

      <MissionSurfaceCard variant="accent" className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-accent-text)]/80">문제</p>
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-7">{config.question}</p>
      </MissionSurfaceCard>

      <div className="grid gap-3 md:grid-cols-2">
        {config.answers.map((candidate) => (
          <MissionSurfaceCard key={candidate.id} variant="default" className="p-4">
            <p className="text-sm font-semibold">{candidate.label}</p>
            {candidate.answer && (
              <p className="mt-2 break-words text-sm leading-6">
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--mission-default-muted)]">답</span>
                <br />
                {candidate.answer}
              </p>
            )}
            {candidate.work && (
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-6">
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--mission-default-muted)]">풀이</span>
                <br />
                {candidate.work}
              </p>
            )}
            {candidate.reasoning && (
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-6">
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--mission-default-muted)]">이유</span>
                <br />
                {candidate.reasoning}
              </p>
            )}
          </MissionSurfaceCard>
        ))}
      </div>

      <div className="space-y-4">
        {config.questions.map((q, idx) => {
          if (q.type === "select_better") {
            return (
              <MissionSurfaceCard key={`q:${idx}`} variant="default" className="p-4">
                <p className="text-sm font-semibold">{q.prompt}</p>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <button
                      key={`${idx}:${optIdx}`}
                      type="button"
                      disabled={disabled || submitted !== null}
                      onClick={() => setSelectAnswers((cur) => ({ ...cur, [idx]: optIdx }))}
                      className={`${missionOptionClassName(selectAnswers[idx] === optIdx)} whitespace-normal break-words`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </MissionSurfaceCard>
            );
          }
          return (
            <MissionSurfaceCard key={`q:${idx}`} variant="default" className="p-4">
              <p className="text-sm font-semibold">{q.prompt}</p>
              <textarea
                value={explainAnswers[idx] ?? ""}
                onChange={(e) => setExplainAnswers((cur) => ({ ...cur, [idx]: e.target.value }))}
                disabled={disabled || submitted !== null}
                rows={5}
                placeholder={`${q.minLength}자 이상으로 너의 판단 이유를 적어 봐`}
                className={missionTextareaClassName("mt-3")}
              />
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <MissionPill>{`${(explainAnswers[idx] ?? "").trim().length} / ${q.minLength}자`}</MissionPill>
                <MissionPill>{`핵심 키워드 ${q.minKeywords}개 이상`}</MissionPill>
              </div>
            </MissionSurfaceCard>
          );
        })}
      </div>

      {!submitted && (
        <button
          type="button"
          onClick={evaluate}
          disabled={disabled || !allAnswered}
          className={missionActionButtonClassName("primary", "w-full sm:w-auto")}
        >
          제출하기
        </button>
      )}

      {submitted && (
        <MissionSurfaceCard variant={submitted.score >= 80 ? "success" : "explanation"} className="p-4 text-sm">
          <p className="text-base font-semibold">{submitted.score >= 80 ? "🎉 잘 비교했어!" : "📝 채점 결과"}</p>
          <p className="mt-2">총점 {submitted.score}점</p>
          <ul className="mt-3 space-y-1 text-xs leading-6">
            {submitted.breakdown.map((b) => (
              <li key={b.index} className="flex items-center gap-2">
                <span aria-hidden>{b.subScore >= 80 ? "✅" : b.subScore >= 60 ? "⚠️" : "❌"}</span>
                <span>{`Q${b.index + 1} (${b.type === "select_better" ? "선택" : "설명"}) — ${b.subScore}점`}</span>
                {b.matched && b.matched.length > 0 && (
                  <span className="opacity-80">{`키워드: ${b.matched.join(", ")}`}</span>
                )}
              </li>
            ))}
          </ul>
        </MissionSurfaceCard>
      )}
    </div>
  );
}
