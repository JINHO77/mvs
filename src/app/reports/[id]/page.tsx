"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import EnglishMetricsChart from "@/components/reports/EnglishMetricsChart";
import EnglishTrendChart from "@/components/reports/EnglishTrendChart";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { prettyUserError } from "@/lib/errors";
import {
  formatReportMonth,
  getRecentEnglishTrends,
  getReportDetail,
  getReportSignedUrl,
  upsertReportRead,
  type RecentEnglishTrendRow,
  type ReportDetail,
} from "@/lib/reports";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

function summarizeMetrics(metrics: { vocab: number; reading: number; grammar: number; listening: number }): string {
  const entries = [
    ["어휘", metrics.vocab],
    ["독해", metrics.reading],
    ["문법", metrics.grammar],
    ["듣기", metrics.listening],
  ] as const;
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  return `강점: ${sorted[0][0]}(${sorted[0][1]}점), 보완: ${sorted[3][0]}(${sorted[3][1]}점)`;
}

function metricItems(metrics: { vocab: number; reading: number; grammar: number; listening: number }) {
  return [
    { label: "어휘", value: metrics.vocab },
    { label: "독해", value: metrics.reading },
    { label: "문법", value: metrics.grammar },
    { label: "듣기", value: metrics.listening },
  ];
}

function normalizeScore(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return "0";
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function buildTrendDiffItems(rows: RecentEnglishTrendRow[]) {
  if (rows.length < 2) return [];
  const first = rows[0];
  const last = rows[rows.length - 1];
  return [
    { label: "어휘", value: formatDiff(normalizeScore(last.vocab) - normalizeScore(first.vocab)) },
    { label: "독해", value: formatDiff(normalizeScore(last.reading) - normalizeScore(first.reading)) },
    { label: "문법", value: formatDiff(normalizeScore(last.grammar) - normalizeScore(first.grammar)) },
    { label: "듣기", value: formatDiff(normalizeScore(last.listening) - normalizeScore(first.listening)) },
  ];
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [trendRows, setTrendRows] = useState<RecentEnglishTrendRow[]>([]);
  const metrics = detail?.english_metrics ?? null;
  const normalizedScores = {
    vocab: metrics?.vocab ?? 0,
    reading: metrics?.reading ?? 0,
    grammar: metrics?.grammar ?? 0,
    listening: metrics?.listening ?? 0,
  };
  const hasEnglishGraphData = Object.values(normalizedScores).some((score) => score > 0);
  const hasNote = !!metrics?.note?.trim();
  const trendDiffItems = buildTrendDiffItems(trendRows);
  const trendChartData = trendRows.map((row) => ({
    month: row.report_month,
    vocab: normalizeScore(row.vocab),
    reading: normalizeScore(row.reading),
    grammar: normalizeScore(row.grammar),
    listening: normalizeScore(row.listening),
  }));

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const initialize = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Report detail session failed:", toPrettyErrorString(sessionError), sessionError);
      setError(prettyUserError(sessionError));
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    try {
      const [loaded, trends] = await Promise.all([getReportDetail(params.id), getRecentEnglishTrends(params.id)]);
      setDetail(loaded);
      setTrendRows(trends);
      await upsertReportRead(params.id);
      router.refresh();
    } catch (e: unknown) {
      console.error("Report detail load failed:", toPrettyErrorString(e), e);
      setError(prettyUserError(e));
      setDetail(null);
      setTrendRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openPdf = async (reportId: string) => {
    try {
      const url = await getReportSignedUrl(reportId, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      console.error("Report detail download failed:", toPrettyErrorString(e), e);
      setError(prettyUserError(e));
    }
  };

  return (
    <PageShell title="월별 성취도 리포트" subtitle="학생별 월간 학습 성취를 확인합니다." maxWidthClassName="max-w-5xl">
      <SectionCard>
        {loading && <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text-muted)]">로딩 중...</div>}
        {!loading && error && <div className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">{error}</div>}
        {!loading && !error && detail && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 md:p-5 lg:p-6">
              <h2 className="text-base font-semibold text-[var(--text)] md:text-lg">월별 성취도 리포트</h2>
              <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-[var(--text-muted)] md:grid-cols-3">
                <p>학생: {detail.report.student_name ?? "-"}</p>
                <p>월: {formatReportMonth(detail.report.month)}</p>
                <p>등록일: {formatDate(detail.report.created_at)}</p>
              </div>
            </div>

            <SectionCard header="영어 성취도">
              <p className="text-sm text-[var(--text-muted)]">어휘·독해·문법·듣기 점수를 확인하세요.</p>
              <div className="mt-4">
                <EnglishMetricsChart
                  vocab={normalizedScores.vocab}
                  reading={normalizedScores.reading}
                  grammar={normalizedScores.grammar}
                  listening={normalizedScores.listening}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {metricItems(normalizedScores).map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
                    <div className="text-[var(--text-muted)]">{item.label}</div>
                    <div className="mt-1 font-semibold text-[var(--text)]">{item.value}점</div>
                  </div>
                ))}
              </div>
              {hasEnglishGraphData && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
                  {summarizeMetrics(normalizedScores)}
                </div>
              )}
            </SectionCard>

            <SectionCard header="최근 3개월 추이">
              <p className="text-sm text-[var(--text-muted)]">최근 월별 영어 성취도 변화입니다.</p>
              <div className="mt-4">
                <EnglishTrendChart data={trendChartData} />
              </div>
              {trendDiffItems.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {trendDiffItems.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
                      <div className="text-[var(--text-muted)]">{item.label}</div>
                      <div className="mt-1 font-semibold text-[var(--text)]">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5 lg:p-6">
              <h3 className="text-base font-semibold text-[var(--text)]">수학 성취도 자료</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">이번 달 수학 진단/분석 자료입니다.</p>
              {detail.report.math_pdf_path ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text)]">PDF 자료</p>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                        PDF 등록 완료
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[var(--text-muted)] md:grid-cols-2">
                      <p>파일명: {detail.report.math_pdf_name?.trim() || "-"}</p>
                      <p>등록 월: {formatReportMonth(detail.report.month)}</p>
                      <p>파일 크기: {formatFileSize(detail.report.math_pdf_size)}</p>
                      <p>첨부 상태: PDF 등록 완료</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)]"
                      onClick={() => void openPdf(detail.report.id)}
                    >
                      미리보기
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)]"
                      onClick={() => void openPdf(detail.report.id)}
                    >
                      다운로드
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
                  등록된 수학 자료가 없습니다.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 md:p-5 lg:p-6">
              <div className="text-sm font-semibold text-[var(--text)]">원장 메모</div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">{hasNote ? metrics?.note?.trim() : "메모 없음"}</div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)]"
                onClick={() => router.push("/reports")}
              >
                리포트 목록으로
              </button>
              <button
                type="button"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)]"
                onClick={() => router.push("/announcements")}
              >
                알리미로 돌아가기
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
