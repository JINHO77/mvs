import type { ReactNode } from "react";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClassNameMap: Record<BadgeVariant, string> = {
  neutral: "border-[var(--border)] text-[var(--muted)] bg-[var(--card)]",
  info: "border-[var(--accent)] text-[var(--accent)] bg-[var(--card-muted)]",
  success: "border-[var(--success-text)] text-[var(--success-text)] bg-[var(--success-bg)]",
  warning: "border-[var(--warning-border)] text-[var(--warning-text)] bg-[var(--warning-bg)]",
  danger: "border-[var(--danger-text)] text-[var(--danger-text)] bg-[var(--danger-bg)]",
};

export default function Badge({ children, variant = "neutral", className = "" }: BadgeProps) {
  const mergedClassName = [
    "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium leading-none",
    variantClassNameMap[variant],
    className,
  ]
    .join(" ")
    .trim();

  return <span className={mergedClassName}>{children}</span>;
}
