"use client";

import { useState } from "react";
import {
  MissionPill,
  MissionSurfaceCard,
  missionActionButtonClassName,
  missionInputClassName,
  missionMutedTextClassName,
  missionOptionClassName,
  missionTextareaClassName,
} from "@/components/student/MissionCards";
import type { ActivityRendererProps } from "./activityShared";
import { countMatchedKeywords } from "./activityShared";

type AnswerStage = "answer" | "explain" | "done";

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

export default function SelfExplainActivity({ step, disabled, onComplete }: ActivityRendererProps) {
  const config = step.selfExplain;
  const [answer, setAnswer] = useState("");
  const [answerAttempts, setAnswerAttempts] = useState(0);
  const [stage, setStage] = useState<AnswerStage>("answer");
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState<{ score: number; matched: string[]; message: string } | null>(null);

  if (!config) {
    return (
      <MissionSurfaceCard variant="error" className="p-4 text-sm">
        활동 데이터가 비어 있어요. 학원에 문의해 주세요.
      </MissionSurfaceCard>
    );
  }

  const expectedKeywordCount = Math.max(config.minKeywords, 1);
  const isAnswerCorrect = normalizeAnswer(answer) === normalizeAnswer(config.answer);

  function checkAnswer() {
    setAnswerAttempts((n) => n + 1);
    if (isAnswerCorrect) {
      setStage("explain");
    }
  }

  function evaluateExplanation() {
    const matched = countMatchedKeywords(explanation, config!.expectedKeywords);
    const longEnough = explanation.trim().length >= config!.minLength;
    let score = 60;
    let message = "❌ 설명을 더 자세히 적어 봐";

    if (matched.length >= config!.expectedKeywords.length && longEnough) {
      score = 100;
      message = "🎉 완벽! 핵심을 다 짚었어";
    } else if (matched.length >= expectedKeywordCount && longEnough) {
      score = 90;
      message = "✅ 잘했어! 정답 + 좋은 설명";
    } else if (matched.length >= expectedKeywordCount) {
      score = 80;
      message = "⚠️ 핵심은 짚었지만 설명이 좀 짧아";
    } else if (longEnough) {
      score = 70;
      message = "⚠️ 길게는 썼지만 핵심 키워드가 부족해";
    }

    setFeedback({ score, matched, message });
    setStage("done");
    onComplete({
      correct: true,
      score,
      studentAnswer: JSON.stringify({ answer, explanation, score, matched }),
    });
  }

  return (
    <div className="space-y-5">
      {config.prompt && (
        <p className={missionMutedTextClassName("whitespace-pre-line break-words text-sm leading-6")}>{config.prompt}</p>
      )}

      <MissionSurfaceCard variant="default" className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-default-muted)]">문제</p>
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-7">{config.question}</p>
      </MissionSurfaceCard>

      {stage === "answer" && (
        <div className="space-y-3">
          {config.answerType === "multiple_choice" && config.choices && config.choices.length > 0 ? (
            <div className="space-y-2">
              {config.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={disabled}
                  onClick={() => setAnswer(choice)}
                  className={`${missionOptionClassName(answer === choice)} whitespace-normal break-words`}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={disabled}
              inputMode={config.answerType === "number" ? "decimal" : "text"}
              placeholder="정답을 입력해 봐"
              className={missionInputClassName()}
            />
          )}
          <button
            type="button"
            disabled={disabled || !answer.trim()}
            onClick={checkAnswer}
            className={missionActionButtonClassName("primary", "w-full sm:w-auto")}
          >
            정답 확인
          </button>

          {answerAttempts > 0 && !isAnswerCorrect && (
            <MissionSurfaceCard variant="error" className="p-4 text-sm">
              <p className="font-semibold">다시 한번 생각해 봐!</p>
              <p className="mt-2 leading-6">정답을 한 번 더 확인하고 입력해 보세요.</p>
            </MissionSurfaceCard>
          )}
        </div>
      )}

      {stage === "explain" && (
        <div className="space-y-3">
          <MissionSurfaceCard variant="success" className="p-4 text-sm">
            <p className="font-semibold">🎯 정답이야! ({config.answer})</p>
            <p className="mt-2 leading-6">이제 너의 설명을 들려줘.</p>
          </MissionSurfaceCard>

          <p className="text-sm font-semibold leading-6">{config.explanationPrompt}</p>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            disabled={disabled}
            rows={5}
            placeholder={`친구에게 설명한다고 생각하고 ${config.minLength}자 이상 적어 봐`}
            className={missionTextareaClassName()}
          />
          <div className={missionMutedTextClassName("flex flex-wrap gap-2 text-xs")}>
            <MissionPill>{`${explanation.trim().length} / ${config.minLength}자`}</MissionPill>
            <MissionPill>{`핵심 키워드 ${expectedKeywordCount}개 이상`}</MissionPill>
          </div>
          <button
            type="button"
            onClick={evaluateExplanation}
            disabled={disabled || explanation.trim().length === 0}
            className={missionActionButtonClassName("primary", "w-full sm:w-auto")}
          >
            설명 제출
          </button>
        </div>
      )}

      {stage === "done" && feedback && (
        <MissionSurfaceCard variant="explanation" className="p-4 text-sm">
          <p className="text-base font-semibold">{feedback.message}</p>
          <p className="mt-2">점수: {feedback.score}점</p>
          {feedback.matched.length > 0 && (
            <p className="mt-2 text-xs">{`찾은 키워드: ${feedback.matched.join(", ")}`}</p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-explanation-text)]/80">
              모범 설명 보기
            </summary>
            <p className="mt-2 whitespace-pre-line break-words leading-6">{config.sampleExplanation}</p>
          </details>
        </MissionSurfaceCard>
      )}
    </div>
  );
}
