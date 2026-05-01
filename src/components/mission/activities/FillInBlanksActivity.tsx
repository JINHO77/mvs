"use client";

import { Fragment, useMemo, useState } from "react";
import {
  MissionPill,
  MissionSurfaceCard,
  missionActionButtonClassName,
  missionMutedTextClassName,
} from "@/components/student/MissionCards";
import type { ActivityRendererProps } from "./activityShared";

function tokenizeTemplate(template: string): Array<{ kind: "text"; text: string } | { kind: "blank"; id: number }> {
  const parts = template.split(/(\{\d+\})/);
  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = part.match(/^\{(\d+)\}$/);
      if (match) {
        return { kind: "blank" as const, id: Number.parseInt(match[1], 10) };
      }
      return { kind: "text" as const, text: part };
    });
}

export default function FillInBlanksActivity({ step, disabled, onComplete }: ActivityRendererProps) {
  const config = step.fillInBlanks;
  const tokens = useMemo(() => (config ? tokenizeTemplate(config.template) : []), [config]);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<{
    correctCount: number;
    total: number;
    score: number;
    perBlank: Array<{ id: number; correct: boolean; given: string; expected: string }>;
  } | null>(null);

  if (!config) {
    return (
      <MissionSurfaceCard variant="error" className="p-4 text-sm">
        활동 데이터가 비어 있어요. 학원에 문의해 주세요.
      </MissionSurfaceCard>
    );
  }

  function setInput(id: number, value: string) {
    setInputs((current) => ({ ...current, [id]: value }));
  }

  function evaluate() {
    const perBlank = config!.blanks.map((blank) => {
      const given = (inputs[blank.id] ?? "").trim();
      const candidates = [blank.answer, ...(blank.alternatives ?? [])].map((s) => s.toLowerCase());
      const correct = candidates.includes(given.toLowerCase());
      return { id: blank.id, correct, given, expected: blank.answer };
    });
    const correctCount = perBlank.filter((b) => b.correct).length;
    const score = Math.round((correctCount / config!.blanks.length) * 100);
    setSubmitted({ correctCount, total: config!.blanks.length, score, perBlank });
    onComplete({
      correct: correctCount === config!.blanks.length,
      score,
      studentAnswer: JSON.stringify(inputs),
    });
  }

  const allFilled = config.blanks.every((b) => (inputs[b.id] ?? "").trim().length > 0);

  return (
    <div className="space-y-5">
      {config.prompt && (
        <p className={missionMutedTextClassName("whitespace-pre-line break-words text-sm leading-6")}>{config.prompt}</p>
      )}

      <MissionSurfaceCard variant="default" className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-default-muted)]">빈칸 채우기</p>
        <p className="mt-3 break-words text-base leading-loose">
          {tokens.map((token, idx) => {
            if (token.kind === "text") {
              return <Fragment key={`t:${idx}`}>{token.text}</Fragment>;
            }
            const result = submitted?.perBlank.find((p) => p.id === token.id);
            const borderColor = !result
              ? "var(--accent)"
              : result.correct
                ? "var(--mission-success-text)"
                : "var(--mission-error-text)";
            return (
              <input
                key={`b:${token.id}:${idx}`}
                value={inputs[token.id] ?? ""}
                onChange={(e) => setInput(token.id, e.target.value)}
                disabled={disabled || submitted !== null}
                placeholder={`#${token.id}`}
                className="mx-1 inline-block min-w-[80px] max-w-[180px] rounded-md border-0 border-b-2 bg-transparent px-2 py-1 text-center text-base font-semibold text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                style={{ borderBottomColor: borderColor }}
              />
            );
          })}
        </p>
      </MissionSurfaceCard>

      {!submitted && (
        <button
          type="button"
          onClick={evaluate}
          disabled={disabled || !allFilled}
          className={missionActionButtonClassName("primary", "w-full sm:w-auto")}
        >
          제출하기
        </button>
      )}

      {submitted && (
        <MissionSurfaceCard
          variant={submitted.correctCount === submitted.total ? "success" : "explanation"}
          className="p-4 text-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">
              {submitted.correctCount === submitted.total ? "🎉 모두 맞혔어!" : "📝 채점 결과"}
            </p>
            <MissionPill variant={submitted.correctCount === submitted.total ? "success" : "default"}>
              {`${submitted.correctCount} / ${submitted.total} · ${submitted.score}점`}
            </MissionPill>
          </div>
          <ul className="mt-3 space-y-1 text-xs leading-6">
            {submitted.perBlank.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span aria-hidden>{item.correct ? "✅" : "❌"}</span>
                <span>{`#${item.id}: 입력 "${item.given || "(빈칸)"}"`}</span>
                {!item.correct && <span className="opacity-80">{`정답: ${item.expected}`}</span>}
              </li>
            ))}
          </ul>
        </MissionSurfaceCard>
      )}
    </div>
  );
}
