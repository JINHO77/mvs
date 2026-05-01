"use client";

import type { ReactNode } from "react";

export type StudentChipVariant =
  | "xp"
  | "start"
  | "continue"
  | "review"
  | "success"
  | "warning"
  | "muted"
  | "today"
  | "info";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const chipVariantClassName: Record<StudentChipVariant, string> = {
  xp: "border-[#D99A18] bg-[#F9E7B8] text-[#6F3A14] dark:border-[rgba(255,214,117,0.42)] dark:bg-[rgba(255,214,117,0.16)] dark:text-[#FFE7A6]",
  start: "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] dark:border-[var(--accent)] dark:bg-[var(--accent)] dark:text-[#0B1220]",
  continue: "border-[#D27A98] bg-[#F8DDE8] text-[#7C2142] dark:border-[rgba(255,214,117,0.35)] dark:bg-[rgba(255,214,117,0.14)] dark:text-[#FFE7A6]",
  review: "border-[#C9A35C] bg-[#F8ECD2] text-[#6F4B12] dark:border-[rgba(243,217,138,0.35)] dark:bg-[rgba(243,217,138,0.14)] dark:text-[#F3D98A]",
  success: "border-[#5DCAA5] bg-[#E1F5EE] text-[#085041] dark:border-[rgba(122,210,164,0.35)] dark:bg-[rgba(122,210,164,0.14)] dark:text-[#A7E8C3]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]",
  muted: "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)] dark:border-[var(--border)] dark:bg-[var(--card-soft)] dark:text-[var(--text-muted)]",
  today: "border-[#D27A98] bg-[#FBEAF0] text-[#7C2142] dark:border-[rgba(255,214,117,0.35)] dark:bg-[rgba(255,214,117,0.12)] dark:text-[#FFE7A6]",
  info: "border-[#85B7EB] bg-[#EAF4FF] text-[#185FA5] dark:border-[rgba(117,191,255,0.34)] dark:bg-[rgba(117,191,255,0.14)] dark:text-[#A9D8FF]",
};

export function StudentChip({
  children,
  variant,
  className,
}: {
  children: ReactNode;
  variant: StudentChipVariant;
  className?: string;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex min-h-6 items-center rounded-full border px-3 py-1 text-[11px] font-semibold leading-none sm:text-xs",
        chipVariantClassName[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function XpBadge({ children, className }: { children: ReactNode; className?: string }) {
  return <StudentChip variant="xp" className={className}>{children}</StudentChip>;
}

export function ActionChip({
  children,
  variant,
  className,
}: {
  children: ReactNode;
  variant: "start" | "continue" | "review";
  className?: string;
}) {
  return <StudentChip variant={variant} className={className}>{children}</StudentChip>;
}

export function StatusChip({
  children,
  variant,
  className,
}: {
  children: ReactNode;
  variant: "success" | "warning" | "muted" | "today" | "info";
  className?: string;
}) {
  return <StudentChip variant={variant} className={className}>{children}</StudentChip>;
}
