"use client";

import Link from "next/link";

type Props = {
  href: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { wrap: "px-3 py-1.5", icon: 34, title: "text-base", sub: "text-[11px]" },
  md: { wrap: "px-4 py-2", icon: 40, title: "text-lg", sub: "text-xs" },
  lg: { wrap: "px-5 py-2.5", icon: 46, title: "text-xl md:text-2xl", sub: "text-xs md:text-sm" },
} as const;

function MvsEmblem({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="shrink-0"
      style={{ filter: "drop-shadow(0 2px 10px var(--accent))" }}
    >
      <circle cx="32" cy="32" r="28" fill="currentColor" className="opacity-12" />
      <circle cx="32" cy="32" r="24" fill="var(--card)" />
      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2.2" className="opacity-95" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1.4" className="opacity-60" />
      <text
        x="32"
        y="33.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji"
        fontSize="23"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="-0.6"
        fill="currentColor"
      >
        mvs
      </text>
      <path
        d="M18 41 C 26 46, 38 46, 46 41"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="opacity-80"
      />
    </svg>
  );
}

export default function MvsHeaderLogo({ href, size = "lg", className }: Props) {
  const s = sizeMap[size];

  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]",
        "hover:border-[var(--accent)] transition",
        s.wrap,
        className ?? "",
      ].join(" ")}
      aria-label="MVS Home"
    >
      <span className="text-[var(--accent)]">
        <MvsEmblem px={s.icon} />
      </span>

      <span className="min-w-0 leading-tight">
        <span className={["block font-extrabold tracking-wide text-[var(--text)]", s.title].join(" ")}>
          <span className="text-[var(--accent)]">MVS</span>
        </span>
        <span className={["block text-[var(--text-muted)]", s.sub].join(" ")}>
          Most Valuable Student
        </span>
      </span>
    </Link>
  );
}
