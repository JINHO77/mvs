import type { ReactNode } from "react";
import TopBar from "@/components/common/TopBar";
import { ANNOUNCEMENT_TEXT } from "@/constants/announcements.ko";

export default function AnnouncementsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <TopBar title={ANNOUNCEMENT_TEXT.title} />
      {children}
    </div>
  );
}
