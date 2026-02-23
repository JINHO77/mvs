import Link from "next/link";
import NoticeFeed from "@/components/dashboard/NoticeFeed";

const placeholders = [
  { title: "Learning", description: "Progress summary and learning status." },
  { title: "Mission", description: "Task and review checklist." },
  { title: "Attendance", description: "Recent attendance records." },
];

const studentMenus = [
  { href: "/student/setup", label: "Profile Setup" },
  { href: "/announcements", label: "All Announcements" },
];

export default function StudentDashboardPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section>
          <h1 className="text-2xl font-semibold">Student Dashboard</h1>
          <p className="mt-2 text-sm text-[#B8B8C3]">Check status cards and announcements.</p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {placeholders.map((card) => (
            <article key={card.title} className="rounded-2xl border border-[#1E1E26] bg-[#121218] p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{card.title}</h2>
                <span className="rounded-full border border-[#3F3820] bg-[#1D170A] px-2 py-0.5 text-xs text-[#E7D7A0]">
                  Coming Soon
                </span>
              </div>
              <p className="mt-2 text-sm text-[#B8B8C3]">{card.description}</p>
            </article>
          ))}
        </section>

        <NoticeFeed />

        <section className="rounded-2xl border border-[#1E1E26] bg-[#121218] p-5">
          <h2 className="text-lg font-semibold">Quick Links</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {studentMenus.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
              >
                {menu.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
