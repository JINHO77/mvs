import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SectionCardProps = {
  children?: ReactNode;
  header?: ReactNode;
  description?: ReactNode;
  rightSlot?: ReactNode;
  variant?: "default" | "soft";
  className?: string;
} & ComponentPropsWithoutRef<"section">;

export default function SectionCard({
  children,
  header,
  description,
  rightSlot,
  variant = "default",
  className = "",
  ...props
}: SectionCardProps) {
  const backgroundClassName =
    variant === "soft" ? "bg-[var(--card-soft)] border border-[var(--border)]" : "bg-[var(--card)]";
  const mergedClassName = [
    "section-card min-w-0 overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--text)] shadow-[var(--shadow)] backdrop-blur-[1px] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg sm:p-5 lg:p-6",
    backgroundClassName,
    className,
  ]
    .join(" ")
    .trim();

  return (
    <section className={mergedClassName} {...props}>
      {(header || description || rightSlot) && (
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            {header && <h2 className="text-base font-semibold tracking-tight text-[var(--text)] sm:text-lg">{header}</h2>}
            {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)] sm:text-[15px]">{description}</p>}
          </div>
          {rightSlot && <div className="w-full md:w-auto md:shrink-0">{rightSlot}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

