import Link from "next/link";

const ownerMenus = [
  { href: "/owner/students", title: "Students", description: "View and edit student profiles." },
  { href: "/owner/consult/requests", title: "Consult Requests", description: "Approve and manage requests." },
  { href: "/owner/consult/calendar", title: "Consult Calendar", description: "Track schedule by date and status." },
  { href: "/owner/generate-link-code", title: "Link Codes", description: "Issue parent-student link codes." },
  { href: "/owner/announcements/new", title: "New Announcement", description: "Create and publish notices." },
];

export default function OwnerDashboardPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold">Owner Dashboard</h1>
        <p className="mt-2 text-sm text-[#B8B8C3]">Quick links to core management pages.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ownerMenus.map((menu) => (
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
