"use client";

import type { ReactNode } from "react";
import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import HomeLink from "@/components/common/HomeLink";
import LogoutButton from "@/components/common/LogoutButton";
import ThemeToggle from "@/components/theme/ThemeToggle";

type TopBarProps = {
  title?: string;
  rightSlot?: ReactNode;
  /** 로고 클릭 시 이동할 대시보드 경로. 미전달 시 HomeLink처럼 역할 기반 동적 해석 */
  logoHref?: "/owner" | "/student" | "/parent" | "/";
};

export default function TopBar({ title, rightSlot, logoHref }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex items-center gap-3">
          {/* logoHref 미전달 시 HomeLink(logo variant)로 역할 기반 대시보드 이동 */}
          {logoHref ? (
            <MvsHeaderLogo href={logoHref} size="lg" />
          ) : (
            <HomeLink variant="logo" />
          )}
          {title ? <h1 className="truncate text-base font-semibold text-[var(--text)]">{title}</h1> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HomeLink />
          <ThemeToggle />
          <LogoutButton />
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
