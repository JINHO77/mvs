import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVS Work",
  description: "AI 인수인계 프로젝트 생성기 MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-lg font-semibold text-ink">
              MVS Work
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/dashboard" className="hover:text-ink">
                대시보드
              </Link>
              <Link href="/jobs" className="hover:text-ink">
                인수인계 목록
              </Link>
              <Link href="/login" className="hover:text-ink">
                로그인
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
