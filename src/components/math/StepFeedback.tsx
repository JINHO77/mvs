"use client";

type StepFeedbackProps = {
  checked: boolean;
  isCorrect: boolean;
  hint?: string | { text: string };
  correctAnswer?: string | null;
  correctMessage?: string;
  retryMessage?: string;
};

export default function StepFeedback({
  checked,
  isCorrect,
  hint,
  correctAnswer,
  correctMessage = "정답입니다. 다음 단계로 이동할 수 있어요.",
  retryMessage = "아직 정답이 아니에요. 풀이 방향을 한 번 더 정리해 보세요.",
}: StepFeedbackProps) {
  if (!checked) return null;

  if (isCorrect) {
    return (
      <div className="rounded-xl border border-[#1F6B42] bg-[#12281C] p-3 text-sm text-[#B6F0C9]">
        {correctMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
      <p>{retryMessage}</p>
      {hint && typeof hint === "string" ? <p>힌트: {hint}</p> : null}
      {hint && typeof hint === "object" && hint.text ? <p>힌트: {hint.text}</p> : null}
      {correctAnswer ? <p>정답: {correctAnswer}</p> : null}
    </div>
  );
}
