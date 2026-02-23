import Link from "next/link";

const teacherMenus = [
  { href: "/owner/students", title: "Students", description: "Check student profile and class info." },
  { href: "/owner/consult/requests", title: "Consult Requests", description: "Handle parent consult requests." },
  { href: "/owner/consult/calendar", title: "Consult Calendar", description: "See confirmed schedule by date." },
  { href: "/announcements", title: "Announcements", description: "Read latest academy notices." },
];

export default function TeacherDashboardPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold">Teacher Dashboard</h1>
        <p className="mt-2 text-sm text-[#B8B8C3]">Quick access to teaching operations.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {teacherMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="rounded-2xl border border-[#1E1E26] bg-[#121218] p-5 transition hover:border-[#3A3A46]"
            >
              <h2 className="text-lg font-semibold">{menu.title}</h2>
              <p className="mt-2 text-sm text-[#B8B8C3]">{menu.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
