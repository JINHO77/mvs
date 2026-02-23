import Link from "next/link";

const features = [
  {
    title: "Consult Scheduling",
    description: "Parents request slots while staff approves and tracks progress in one flow.",
  },
  {
    title: "Student Linking",
    description: "Parents can safely connect to students with link-code based onboarding.",
  },
  {
    title: "Announcements",
    description: "Important academy notices are delivered through a shared feed.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-6 py-10">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-[#1E1E26] bg-[#121218] p-8 sm:p-10">
        <p className="text-xs tracking-[0.2em] text-[#B8B8C3]">MVS</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">
          Unified Dashboard
          <br />
          for Academy Operations
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[#B8B8C3] sm:text-base">
          Owners, teachers, parents, and students work in role-specific views over one shared data model.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black hover:opacity-90"
          >
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-[#1E1E26] px-5 py-3 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
          >
            Get Started
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-8 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-[#1E1E26] bg-[#121218] p-5">
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-[#B8B8C3]">{feature.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
