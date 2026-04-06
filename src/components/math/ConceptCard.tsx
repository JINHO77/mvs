"use client";

type ConceptCardProps = {
  title: string;
  description: string;
};

export default function ConceptCard({ title, description }: ConceptCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 md:p-5">
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}
