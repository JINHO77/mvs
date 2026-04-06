import type { Metadata, Viewport } from "next";
import SplashIntro from "@/components/branding/SplashIntro";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVS (Most Valuable Student)",
  description: "MVS (Most Valuable Student) app",
  applicationName: "MVS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "MVS",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark light",
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
        <SplashIntro />
        {children}
      </body>
    </html>
  );
}