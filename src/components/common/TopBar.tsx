"use client";

import type { ReactNode } from "react";
import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import HomeLink from "@/components/common/HomeLink";
import ThemeToggle from "@/components/theme/ThemeToggle";

type TopBarProps = {
  title?: string;
  rightSlot?: ReactNode;
  logoHref?: "/owner" | "/student" | "/parent" | "/";
};

export default function TopBar({ title, rightSlot, logoHref = "/" }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex items-center gap-3">
          <MvsHeaderLogo href={logoHref} size="lg" />
          {title ? <h1 className="truncate text-base font-semibold text-[var(--text)]">{title}</h1> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HomeLink />
          <ThemeToggle />
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
