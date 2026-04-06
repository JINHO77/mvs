"use client";
import StepFeedback from "@/components/math/StepFeedback";
import { buildInputStepRetryMessage, buildMissionStepHint, isEquivalentAnswer } from "@/lib/missionAnswers";
import type { MissionStep } from "@/types/missions";

type MathInputStepProps = {
  question: string;
  placeholder: string;
  correctAnswer: string;
  acceptedAnswers?: string[];
  acceptedUnits?: string[];
  hint?: string;
  explanation?: string;
  value: string;
  checked: boolean;
  isCorrect: boolean;
  onChange: (value: string) => void;
  onCheck: () => void;
};

export default function MathInputStep({
  question,
  placeholder,
  correctAnswer,
  acceptedAnswers,
  acceptedUnits,
  hint,
  explanation,
  value,
  checked,
  isCorrect,
  onChange,
  onCheck,
}: MathInputStepProps) {
  const step: MissionStep = {
    stepOrder: 1,
    title: question,
    stepType: "input",
    question,
    correctAnswer,
    acceptedAnswers,
    acceptedUnits,
    hint,
    explanation,
  };

  const fallbackHint = buildMissionStepHint(step, { subject: "math" });
  const resolvedHint = hint ?? fallbackHint;
  const correctMessage = isEquivalentAnswer(value, correctAnswer, step)
    ? "정답입니다. 다음 단계로 이동할 수 있어요."
    : "정답입니다.";

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text)]">{question}</p>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
      />
      <button
        type="button"
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text)]"
        onClick={onCheck}
      >
        정답 확인
      </button>
      <StepFeedback
        checked={checked}
        isCorrect={isCorrect}
        hint={resolvedHint}
        correctAnswer={correctAnswer}
        correctMessage={correctMessage}
        retryMessage={buildInputStepRetryMessage(step, value, correctAnswer, { subject: "math" })}
      />
    </div>
  );
}
