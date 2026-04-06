"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type EnglishMetricsChartProps = {
  vocab: number | null;
  reading: number | null;
  grammar: number | null;
  listening: number | null;
};

function normalizeScore(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function EnglishMetricsChart({ vocab, reading, grammar, listening }: EnglishMetricsChartProps) {
  const data = [
    { label: "\uC5B4\uD718", value: normalizeScore(vocab) },
    { label: "\uB3C5\uD574", value: normalizeScore(reading) },
    { label: "\uBB38\uBC95", value: normalizeScore(grammar) },
    { label: "\uB4E3\uAE30", value: normalizeScore(listening) },
  ];

  const hasData = data.some((item) => item.value > 0);

  if (!hasData) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
        {"\uC601\uC5B4 \uC131\uCDE8\uB3C4 \uB370\uC774\uD130\uAC00 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--card-soft)" }} />
            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
              {data.map((item) => (
                <Cell key={item.label} fill="var(--accent)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
