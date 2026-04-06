import Link from "next/link";
import PublicHeader from "@/components/common/PublicHeader";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { LANDING_TEXT } from "@/constants/landing.ko";

export default function LandingPage() {
  return (
    <>
      <PublicHeader />
      <PageShell maxWidthClassName="max-w-6xl">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-soft)] p-8 shadow-[var(--shadow)] sm:p-10">
          <p className="text-sm text-[var(--text-muted)]">{LANDING_TEXT.heroTagline}</p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {LANDING_TEXT.heroHeadlineLine1}
            <br />
            {LANDING_TEXT.heroHeadlineLine2}
          </h1>

          <p className="mt-5 text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
            {LANDING_TEXT.heroDescLine1}
            <br />
            {LANDING_TEXT.heroDescLine2}
          </p>

          <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Link
              href="/login"
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-center text-sm font-semibold text-[var(--bg)] transition hover:opacity-95"
            >
              {LANDING_TEXT.studentLoginCta}
            </Link>
            <Link
              href="/login?role=parent"
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-center text-sm font-semibold text-[var(--bg)] transition hover:opacity-95"
            >
              {LANDING_TEXT.parentLoginCta}
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Link
              href="/signup"
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-center text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
            >
              {LANDING_TEXT.studentSignupCta}
            </Link>
            <Link
              href="/signup?role=parent"
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-center text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
            >
              {LANDING_TEXT.parentSignupCta}
            </Link>
            <Link
              href="/link-student"
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-center text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
            >
              {LANDING_TEXT.parentLinkCta}
            </Link>
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)]">
            자녀 연결은 학부모 로그인 후 최초 1회만 진행하면 되고, 이후에는 학부모 로그인만으로 대시보드에 들어갈 수 있어요.
          </div>

          <div className="mt-3 text-right">
            <Link href="/announcements" className="text-xs text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]">
              {LANDING_TEXT.featuresLink}
            </Link>
          </div>
        </section>

        <section id="features" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {LANDING_TEXT.featureCards.map((feature) => (
            <SectionCard key={feature.title} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{feature.desc}</p>
            </SectionCard>
          ))}
        </section>
      </PageShell>
    </>
  );
}
