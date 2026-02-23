import Link from "next/link";

const parentMenus = [
  { href: "/consult/request", title: "Request Consult", description: "Pick a slot and submit a request." },
  { href: "/parent/students", title: "My Students", description: "Manage linked students." },
  { href: "/link-student", title: "Link Student", description: "Connect a student using a link code." },
  { href: "/announcements", title: "Announcements", description: "Check academy notices." },
];

export default function ParentDashboardPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold">Parent Dashboard</h1>
        <p className="mt-2 text-sm text-[#B8B8C3]">Access consult and student-link features.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {parentMenus.map((menu) => (
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
