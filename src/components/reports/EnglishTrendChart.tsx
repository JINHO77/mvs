"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EnglishTrendPoint = {
  month: string;
  vocab: number | null;
  reading: number | null;
  grammar: number | null;
  listening: number | null;
};

type EnglishTrendChartProps = {
  data: EnglishTrendPoint[];
};

function toMonthLabel(month: string): string {
  const match = month.match(/^\d{4}-(\d{2})$/);
  if (!match) return month;
  return `${Number(match[1])}월`;
}

export default function EnglishTrendChart({ data }: EnglishTrendChartProps) {
  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)] md:p-5 lg:p-6">
        추이를 보려면 2개월 이상 데이터가 필요합니다.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5 lg:p-6">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={toMonthLabel}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              labelFormatter={(label) => `${toMonthLabel(String(label))}`}
              formatter={(value) => {
                const raw = Array.isArray(value) ? value[0] : value;
                const score = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
                return `${score}점`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="vocab" name="어휘" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="reading" name="독해" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="grammar" name="문법" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="listening" name="듣기" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
