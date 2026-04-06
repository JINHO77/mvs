"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

type MissionStatus = "draft" | "review" | "published" | "archived";
type SourceType = "manual" | "ai";

type Row = {
  id: string;
  title: string;
  difficulty: "easy" | "normal" | "challenge";
  source_type: SourceType;
  status: MissionStatus;
  created_at: string;
  curriculum_units: {
    id: string;
    title: string;
    grade: number;
  } | null;
};

type UnitOption = {
  id: string;
  title: string;
  grade: number;
};

function statusVariant(status: MissionStatus): "neutral" | "warning" | "success" | "danger" {
  if (status === "published") return "success";
  if (status === "review") return "warning";
  if (status === "archived") return "danger";
  return "neutral";
}

export default function OwnerMissionsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<MissionStatus | "all">("all");

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeFilter, unitFilter, statusFilter]);

  const initialize = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      setError("미션 목록을 불러오는 중 문제가 발생했습니다.");
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

    const { data: unitRows, error: unitError } = await supabase
      .from("curriculum_units")
      .select("id,title,grade")
      .eq("subject", "math")
      .eq("is_active", true)
      .order("grade", { ascending: true })
      .order("sort_order", { ascending: true })
      .returns<UnitOption[]>();

    if (unitError) {
      setError("단원 목록을 불러오는 중 문제가 발생했습니다.");
      setLoading(false);
      return;
    }

    setUnits(unitRows ?? []);
    await loadRows();
  };

  const loadRows = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("generated_missions")
        .select("id,title,difficulty,source_type,status,created_at,curriculum_units(id,title,grade)")
        .eq("subject", "math")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (unitFilter !== "all") query = query.eq("unit_id", unitFilter);
      if (gradeFilter !== "all") {
        const unitIds = units.filter((unit) => String(unit.grade) === gradeFilter).map((unit) => unit.id);
        if (unitIds.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }
        query = query.in("unit_id", unitIds);
      }

      const { data, error: listError } = await query.returns<Row[]>();
      if (listError) throw listError;
      setRows(data ?? []);
    } catch (e: unknown) {
      console.error("Owner missions load failed:", toPrettyErrorString(e), e);
      setError("미션 목록을 불러오지 못했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const unitOptionsByGrade =
    gradeFilter === "all" ? units : units.filter((unit) => String(unit.grade) === gradeFilter);

  return (
    <PageShell
      title="미션 검수"
      subtitle="수학 미션을 검수하고 게시 상태를 관리합니다."
      maxWidthClassName="max-w-6xl"
      actions={<HomeLink fallbackHref="/owner" />}
    >
      <SectionCard>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span>학년</span>
            <select
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setUnitFilter("all");
              }}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="all">전체</option>
              <option value="4">초4</option>
              <option value="5">초5</option>
              <option value="6">초6</option>
              <option value="7">중1</option>
              <option value="8">중2</option>
              <option value="9">중3</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span>단원</span>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="all">전체</option>
              {unitOptionsByGrade.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.title}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span>상태</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MissionStatus | "all")}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="all">전체</option>
              <option value="draft">draft</option>
              <option value="review">review</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
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
            조건에 맞는 미션이 없습니다.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/owner/missions/${row.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text)]">{row.title}</h3>
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  단원: {row.curriculum_units?.title ?? "-"} · 난이도: {row.difficulty} · source: {row.source_type}
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}


