"use client";

import type { ReactNode } from "react";

type CardVariant = "default" | "accent" | "hint" | "success" | "error" | "explanation";
type PillVariant = "default" | "accent" | "hint" | "success" | "error";
type ButtonVariant = "primary" | "secondary";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const cardVariantClassName: Record<CardVariant, string> = {
  default: "border-[var(--mission-default-border)] bg-[var(--mission-default-bg)] text-[var(--mission-default-text)]",
  accent: "border-[var(--mission-accent-border)] bg-[var(--mission-accent-bg)] text-[var(--mission-accent-text)]",
  hint: "border-[var(--mission-hint-border)] bg-[var(--mission-hint-bg)] text-[var(--mission-hint-text)]",
  success: "border-[var(--mission-success-border)] bg-[var(--mission-success-bg)] text-[var(--mission-success-text)]",
  error: "border-[var(--mission-error-border)] bg-[var(--mission-error-bg)] text-[var(--mission-error-text)]",
  explanation: "border-[var(--mission-explanation-border)] bg-[var(--mission-explanation-bg)] text-[var(--mission-explanation-text)]",
};

const pillVariantClassName: Record<PillVariant, string> = {
  default: "border-[var(--mission-default-border)] bg-[var(--mission-default-bg)] text-[var(--mission-default-muted)]",
  accent: "border-[var(--mission-accent-border)] bg-[var(--mission-accent-bg)] text-[var(--mission-accent-text)]",
  hint: "border-[var(--mission-hint-border)] bg-[var(--mission-hint-bg)] text-[var(--mission-hint-text)]",
  success: "border-[var(--mission-success-border)] bg-[var(--mission-success-bg)] text-[var(--mission-success-text)]",
  error: "border-[var(--mission-error-border)] bg-[var(--mission-error-bg)] text-[var(--mission-error-text)]",
};

const buttonVariantClassName: Record<ButtonVariant, string> = {
  primary: "border border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] hover:brightness-[1.03] disabled:opacity-50",
  secondary:
    "border border-[var(--mission-default-border)] bg-[var(--mission-default-bg)] text-[var(--mission-default-text)] hover:border-[var(--accent)] disabled:opacity-40",
};

export function MissionSurfaceCard({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
}) {
  return <div className={joinClasses("rounded-2xl border", cardVariantClassName[variant], className)}>{children}</div>;
}

export function MissionPill({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: PillVariant;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-xs font-medium sm:text-sm",
        pillVariantClassName[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function missionOptionClassName(active: boolean) {
  return joinClasses(
    "min-h-11 w-full rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition",
    active
      ? "border-[var(--mission-option-selected-border)] bg-[var(--mission-option-selected-bg)] text-[var(--mission-option-selected-text)]"
      : "border-[var(--mission-option-border)] bg-[var(--mission-option-bg)] text-[var(--mission-option-text)] hover:border-[var(--mission-option-hover-border)]"
  );
}

export function missionCheckClassName(active: boolean) {
  return joinClasses(
    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
    active
      ? "border-[var(--mission-option-selected-border)] bg-[var(--accent)] text-[var(--bg)]"
      : "border-[var(--mission-option-border)] text-transparent"
  );
}

export function missionInputClassName(className?: string) {
  return joinClasses(
    "min-h-11 w-full rounded-2xl border bg-[var(--mission-input-bg)] px-4 py-3 text-[var(--mission-default-text)] outline-none placeholder:text-[var(--mission-input-placeholder)]",
    "border-[var(--mission-input-border)]",
    className
  );
}

export function missionTextareaClassName(className?: string) {
  return missionInputClassName(joinClasses("min-h-[180px] resize-y leading-7", className));
}

export function missionActionButtonClassName(variant: ButtonVariant, className?: string) {
  return joinClasses(
    "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed",
    buttonVariantClassName[variant],
    className
  );
}

export function missionMutedTextClassName(className?: string) {
  return joinClasses("text-[var(--mission-default-muted)]", className);
}
