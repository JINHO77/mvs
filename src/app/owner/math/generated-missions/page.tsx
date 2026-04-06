"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import HomeLink from "@/components/common/HomeLink";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

type ReviewStatus = "draft" | "approved" | "rejected";

type GeneratedMissionRow = {
  id: string;
  title: string;
  review_status: ReviewStatus;
  created_at: string;
  published_at: string | null;
  is_active: boolean;
  curriculum_units: {
    title: string;
    school_level: string;
    grade: number | null;
  } | null;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

function statusLabel(status: ReviewStatus): string {
  if (status === "approved") return "승인";
  if (status === "rejected") return "반려";
  return "초안";
}

export default function OwnerGeneratedMissionsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GeneratedMissionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadRows(statusFilter);
  }, [statusFilter]);

  const initialize = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      setError("생성 미션을 불러오는 중 문제가 발생했습니다.");
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<{ role: string | null }>();
    if (meError || me.role !== "owner") {
      router.replace("/");
      return;
    }

    await loadRows(statusFilter);
  };

  const loadRows = async (status: ReviewStatus | "all") => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("generated_missions")
        .select("id,title,review_status,created_at,published_at,is_active,curriculum_units(title,school_level,grade)")
        .order("created_at", { ascending: false });

      if (status !== "all") query = query.eq("review_status", status);
      const { data, error: listError } = await query.returns<GeneratedMissionRow[]>();
      if (listError) throw listError;
      setRows(data ?? []);
    } catch (e: unknown) {
      console.error("Owner generated missions load failed:", toPrettyErrorString(e), e);
      setError("생성 미션을 불러오는 중 문제가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="AI 생성 미션 검수"
      subtitle="AI 생성 초안을 검수하고 승인된 미션만 학생에게 공개합니다."
      maxWidthClassName="max-w-6xl"
      actions={<HomeLink fallbackHref="/owner" />}
    >
      <SectionCard>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span>상태</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | "all")}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="all">전체</option>
              <option value="draft">초안</option>
              <option value="approved">승인</option>
              <option value="rejected">반려</option>
            </select>
          </label>
        </div>

        {loading && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            불러오는 중...
          </div>
        )}
        {!loading && error && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            생성된 미션이 없습니다.
          </div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div className="mt-4 space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{row.title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      단원: {row.curriculum_units?.title ?? "-"} / 학년:{" "}
                      {row.curriculum_units?.grade ? `${row.curriculum_units.grade}학년` : "-"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">생성일: {formatDate(row.created_at)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">공개일: {formatDate(row.published_at)}</p>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    상태: {statusLabel(row.review_status)} / 공개: {row.is_active ? "활성" : "비활성"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
