"use client";

import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ScoreSet = {
  vocab: number;
  reading: number;
  grammar: number;
  listening: number;
};

type ReportChartsProps = {
  scores: ScoreSet;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function ReportCharts({ scores }: ReportChartsProps) {
  const radarData = [
    { subject: "어휘", value: clampScore(scores.vocab) },
    { subject: "독해", value: clampScore(scores.reading) },
    { subject: "문법", value: clampScore(scores.grammar) },
    { subject: "듣기", value: clampScore(scores.listening) },
  ];

  const lineData = [
    { order: "어휘", value: clampScore(scores.vocab) },
    { order: "독해", value: clampScore(scores.reading) },
    { order: "문법", value: clampScore(scores.grammar) },
    { order: "듣기", value: clampScore(scores.listening) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="mb-2 text-sm font-semibold text-[var(--text)]">영역별 레이더</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Radar name="점수" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} isAnimationActive={false} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="mb-2 text-sm font-semibold text-[var(--text)]">점수 라인</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <XAxis dataKey="order" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
