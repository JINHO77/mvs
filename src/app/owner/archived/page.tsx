"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

type ArchivedUserRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  account_status: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archived_by_name: string | null;
  reason: string | null;
};

type RoleFilter = "all" | "student" | "parent" | "teacher" | "owner";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

function roleLabel(role: string | null): string {
  if (role === "student") return "학생";
  if (role === "parent") return "학부모";
  if (role === "teacher") return "강사";
  if (role === "owner") return "원장";
  return role ?? "-";
}

export default function OwnerArchivedPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rows, setRows] = useState<ArchivedUserRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setError(null);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      setError(toPrettyErrorString(sessionError));
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null; account_status: string | null }>();
    if (meError) {
      setError(toPrettyErrorString(meError));
      setLoading(false);
      return;
    }
    if (me?.role !== "owner" && me?.role !== "teacher") {
      router.replace("/");
      return;
    }

    await refreshList();
    setLoading(false);
  };

  const refreshList = async () => {
    const { data, error: fetchError } = await supabase
      .from("v_archived_users")
      .select("*")
      .order("archived_at", { ascending: false })
      .returns<ArchivedUserRow[]>();
    if (fetchError) {
      console.error("Owner archived load failed:", toPrettyErrorString(fetchError), fetchError);
      setError(toPrettyErrorString(fetchError));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  };

  const restore = async (userId: string) => {
    if (!window.confirm("이 사용자를 복구할까요? 계정 상태가 'active'로 돌아갑니다.")) return;
    setError(null);
    setSuccess(null);
    setBusyId(userId);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ account_status: "active" })
        .eq("id", userId);
      if (updateError) throw updateError;
      setSuccess("복구했습니다. 아카이브 이력은 보존됩니다.");
      await refreshList();
    } catch (e: unknown) {
      console.error("Owner archived restore failed:", toPrettyErrorString(e), e);
      setError(toPrettyErrorString(e));
    } finally {
      setBusyId(null);
    }
  };

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = [
        row.name ?? "",
        row.email ?? "",
        row.reason ?? "",
        row.archived_by_name ?? "",
        row.role ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, keyword, roleFilter]);

  if (loading) {
    return <PageShell maxWidthClassName="max-w-6xl">로딩 중...</PageShell>;
  }

  return (
    <PageShell
      title="📦 아카이브 조회"
      subtitle="탈퇴 처리된 사용자 이력을 확인하고 필요 시 복구합니다."
      maxWidthClassName="max-w-6xl"
    >
      <SectionCard>
        {error && (
          <div className="mb-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">
            {success}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/owner/students"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--text)] hover:border-[var(--accent)]"
          >
            ← 학생 관리로
          </Link>
          <span className="text-xs text-[var(--text-muted)]">
            표시: {filteredRows.length} / 전체: {rows.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            type="text"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            placeholder="이름/이메일/사유/처리자 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">전체 역할</option>
            <option value="student">학생</option>
            <option value="parent">학부모</option>
            <option value="teacher">강사</option>
            <option value="owner">원장</option>
          </select>
        </div>

        <div className="mt-4 space-y-2">
          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3 text-sm text-[var(--text-muted)]">
              아카이브된 사용자가 없습니다.
            </div>
          ) : (
            filteredRows.map((row) => {
              const isCurrentlyArchived = row.account_status === "archived";
              return (
                <div
                  key={`${row.user_id}-${row.archived_at ?? "none"}`}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text)]">
                          {row.name?.trim() || row.user_id.slice(0, 8)}
                        </span>
                        <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                          {roleLabel(row.role)}
                        </span>
                        {!isCurrentlyArchived && (
                          <span className="rounded-full border border-[var(--success-text)] bg-[var(--success-bg)] px-2 py-0.5 text-[11px] text-[var(--success-text)]">
                            복구됨 (현재: {row.account_status ?? "-"})
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{row.email ?? "-"}</div>
                    </div>
                    {isCurrentlyArchived && (
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] px-3 py-2 text-xs font-semibold text-[var(--success-text)] disabled:opacity-60"
                        onClick={() => void restore(row.user_id)}
                        disabled={busyId === row.user_id}
                      >
                        {busyId === row.user_id ? "복구 중..." : "↺ 복구"}
                      </button>
                    )}
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--text-muted)]">처리 시각</dt>
                      <dd className="text-[var(--text)]">{formatDate(row.archived_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-muted)]">처리자</dt>
                      <dd className="text-[var(--text)]">{row.archived_by_name?.trim() || row.archived_by?.slice(0, 8) || "-"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[var(--text-muted)]">사유</dt>
                      <dd className="whitespace-pre-wrap break-words text-[var(--text)]">{row.reason?.trim() || "-"}</dd>
                    </div>
                  </dl>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </PageShell>
  );
}
