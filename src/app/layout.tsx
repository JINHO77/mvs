import type { Metadata, Viewport } from "next";
import SplashIntro from "@/components/branding/SplashIntro";
import PwaRegister from "@/components/pwa/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVS (Most Valuable Student)",
  description: "AI 기반 학습 플랫폼 — 매일 미션으로 성장하기",
  applicationName: "MVS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MVS",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#D4537E",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(() => { try { const t = localStorage.getItem('theme'); const d = document.documentElement; if (t === 'light') d.classList.remove('dark'); else d.classList.add('dark'); } catch (_) { document.documentElement.classList.add('dark'); } })();",
          }}
        />
      </head>
      <body
        className="antialiased"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <PwaRegister />
        <SplashIntro />
        {children}
      </body>
    </html>
  );
}
