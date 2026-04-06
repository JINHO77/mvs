import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  actions?: ReactNode;
  maxWidthClassName?: string;
  className?: string;
  contentClassName?: string;
};

export default function PageShell({
  children,
  title,
  subtitle,
  rightSlot,
  actions,
  maxWidthClassName = "max-w-5xl",
  className = "",
  contentClassName = "",
}: PageShellProps) {
  const resolvedRightSlot = rightSlot ?? actions;
  const wrapperClassName = `min-h-screen overflow-x-clip bg-[var(--bg)] px-4 py-4 text-[var(--text)] sm:px-5 sm:py-5 md:px-6 md:py-7 xl:px-8 ${className}`.trim();
  const innerClassName = `mx-auto w-full ${maxWidthClassName}`.trim();
  const bodyClassName = `mt-5 space-y-4 sm:space-y-5 lg:mt-6 lg:space-y-6 ${contentClassName}`.trim();

  return (
    <main className={wrapperClassName}>
      <div className={innerClassName}>
        {(title || subtitle || resolvedRightSlot) && (
          <header className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              {title && (
                <>
                  <p className="text-xs uppercase tracking-widest text-[var(--accent)] opacity-70">MVS PLATFORM</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl xl:text-[2.15rem]">{title}</h1>
                </>
              )}
              {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)] sm:text-base sm:leading-7">{subtitle}</p>}
            </div>
            {resolvedRightSlot && <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center md:justify-end">{resolvedRightSlot}</div>}
          </header>
        )}

        <div className={bodyClassName}>{children}</div>
      </div>
    </main>
  );
}

