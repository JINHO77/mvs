"use client";

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { WeeklyLearningPathStep } from "@/lib/mathRecommendations";

type WeeklyPathMissionCardProps = {
  step: WeeklyLearningPathStep;
  href: string | null;
  difficultyLabel: string;
  minuteLabel: string;
  onLockedAttempt?: (message: string) => void;
  footer?: ReactNode;
};

function difficultyStyle(difficulty: WeeklyLearningPathStep["difficulty"]): CSSProperties {
  if (difficulty === "easy") return {
    border: "1px solid var(--diff-easy-border)",
    background: "var(--diff-easy-bg)",
    color: "var(--diff-easy-text)",
  };
  if (difficulty === "normal") return {
    border: "1px solid var(--diff-normal-border)",
    background: "var(--diff-normal-bg)",
    color: "var(--diff-normal-text)",
  };
  return {
    border: "1px solid var(--diff-hard-border)",
    background: "var(--diff-hard-bg)",
    color: "var(--diff-hard-text)",
  };
}

function statusBadgeStyle(status: WeeklyLearningPathStep["status"]): CSSProperties {
  if (status === "completed") return {
    border: "1px solid var(--status-done-border)",
    background: "var(--status-done-bg)",
    color: "var(--status-done-text)",
  };
  if (status === "today") return {
    border: "1px solid var(--status-today-border)",
    background: "var(--status-today-bg)",
    color: "var(--status-today-text)",
  };
  if (status === "locked") return {
    border: "1px solid var(--border)",
    background: "var(--card-soft)",
    color: "var(--text-muted)",
  };
  return {
    border: "1px solid var(--status-ready-border)",
    background: "var(--status-ready-bg)",
    color: "var(--status-ready-text)",
  };
}

function cardStyle(step: WeeklyLearningPathStep): CSSProperties {
  if (step.status === "completed") return {};
  if (step.status === "today") return {
    border: "2px solid var(--card-today-border)",
    background: "var(--card-today-bg)",
    boxShadow: "var(--card-today-shadow)",
  };
  if (step.status === "locked") return {
    border: "1px solid var(--border)",
    background: "var(--card-soft)",
    opacity: 0.65,
  };
  return {
    border: "1px solid var(--border)",
    background: "var(--card)",
  };
}

function cardExtraClassName(status: WeeklyLearningPathStep["status"]): string {
  if (status === "completed") return "border border-green-500/50 bg-green-500/10";
  return "";
}

function statusLabel(status: WeeklyLearningPathStep["status"]): string {
  if (status === "today") return "today";
  if (status === "completed") return "completed";
  if (status === "locked") return "locked";
  return "ready";
}

function interactiveTone(isLocked: boolean): string {
  if (isLocked) return "cursor-not-allowed";
  return "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]";
}

function handleLockedKeyDown(event: KeyboardEvent<HTMLButtonElement>, onLockedAttempt: (() => void) | null) {
  if (!onLockedAttempt) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onLockedAttempt();
}

function CardBody({
  step,
  difficultyLabel,
  minuteLabel,
  footer,
}: {
  step: WeeklyLearningPathStep;
  difficultyLabel: string;
  minuteLabel: string;
  footer?: ReactNode;
}) {
  return (
    <>
      {/* 요일 라벨 — 크게 상단 */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none text-[var(--text)]">{step.weekdayLabel}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{`STEP ${step.stepOrder}`}</p>
        </div>
        {step.status === "completed" ? (
          <span className="mt-0.5 flex-shrink-0 text-lg font-bold text-green-500">✓</span>
        ) : (
          <span
            className="mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={statusBadgeStyle(step.status)}
          >
            {statusLabel(step.status)}
          </span>
        )}
      </div>

      {/* 단원명 */}
      <p className="mt-2 line-clamp-1 text-[11px] text-[var(--text-muted)]">{step.unitName}</p>

      {/* 미션 제목 */}
      <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text)]">{step.cleanedTitle}</h3>

      {/* 추천 이유 — 줄 제한 */}
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">{step.recommendationReason}</p>

      {/* 난이도 뱃지 + XP + 예상 시간 — 하단 고정 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={difficultyStyle(step.difficulty)}
        >
          {difficultyLabel}
        </span>
        <span className="rounded-full border border-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 text-[10px] font-semibold text-[#27500A] dark:border-[rgba(255,214,117,0.4)] dark:bg-[rgba(255,214,117,0.12)] dark:text-[#FFE7A6]">{`+${step.rewardXp} XP`}</span>
        <span className="rounded-full border border-[#B4B2A9] bg-[#F1EFE8] px-2 py-0.5 text-[10px] text-[#444441] dark:border-[var(--border)] dark:bg-[var(--card-soft)] dark:text-[var(--text-muted)]">{`${step.estimatedMinutes}${minuteLabel}`}</span>
      </div>

      {step.status === "locked" && step.lockReason && (
        <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">{step.lockReason}</p>
      )}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </>
  );
}

export default function WeeklyPathMissionCard({
  step,
  href,
  difficultyLabel,
  minuteLabel,
  onLockedAttempt,
  footer,
}: WeeklyPathMissionCardProps) {
  const baseClass = `relative group block rounded-2xl p-3 transition duration-200 ${interactiveTone(step.status === "locked")} ${cardExtraClassName(step.status)}`;

  if (step.status === "locked" || !href) {
    const handleLockedAttempt = onLockedAttempt && step.lockReason ? () => onLockedAttempt(step.lockReason!) : null;
    return (
      <button
        type="button"
        aria-disabled="true"
        onClick={handleLockedAttempt ?? undefined}
        onKeyDown={(event) => handleLockedKeyDown(event, handleLockedAttempt)}
        className={`${baseClass} w-full text-left`}
        style={cardStyle(step)}
      >
        <CardBody step={step} difficultyLabel={difficultyLabel} minuteLabel={minuteLabel} footer={footer} />
      </button>
    );
  }

  return (
    <Link href={href} className={baseClass} style={cardStyle(step)}>
      <CardBody step={step} difficultyLabel={difficultyLabel} minuteLabel={minuteLabel} footer={footer} />
    </Link>
  );
}