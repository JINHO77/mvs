"use client";

import { useEffect, useMemo, useState } from "react";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { OWNER_APPROVALS_TEXT } from "@/constants/ownerApprovals.ko";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { isUuid } from "@/lib/validators";

type PendingStudentRow = {
  id: string;
  name: string | null;
  email: string | null;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
  created_at: string;
  account_status: "pending" | "active" | "blocked" | "withdrawn" | null;
};

const LEVEL_MAP: Record<string, string> = { elementary: "초등", middle: "중등", high: "고등", elem: "초등", mid: "중등" };
function levelToLabel(level: string | null): string {
  return LEVEL_MAP[level ?? ""] ?? "-";
}

function formatCreatedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

export default function OwnerApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PendingStudentRow[]>([]);
  const [missingStatusColumn, setMissingStatusColumn] = useState(false);
  const [ownerAcademyId, setOwnerAcademyId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
  }, []);

  const initialize = async () => {
    setError(null);
    setSuccess(null);
    setMissingStatusColumn(false);
    setLoading(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        window.location.replace(process.env.NEXT_PUBLIC_DEV_MODE === "true" ? "/dev-login" : "/login");
        return;
      }

      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("role,academy_id")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null; academy_id: string | null }>();
      if (meError) throw meError;
      if (me?.role !== "owner" && me?.role !== "teacher") {
        window.location.replace("/");
        return;
      }
      setOwnerAcademyId(isUuid(me?.academy_id) ? me.academy_id : null);

      await loadPendingRows();
    } catch (e: unknown) {
      console.error("Owner approvals init failed:", toPrettyErrorString(e), e);
      setError(toPrettyErrorString(e));
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRows = async () => {
    const { data, error: listError } = await supabase
      .from("profiles")
      .select("id,name,email,school_level,grade,class_label,created_at,account_status")
      .eq("role", "student")
      .eq("account_status", "pending")
      .order("created_at", { ascending: false })
      .returns<PendingStudentRow[]>();
    if (listError) {
      const pretty = toPrettyErrorString(listError).toLowerCase();
      const isMissing = pretty.includes("account_status") && (
        pretty.includes("does not exist")
        || pretty.includes("column")
        || pretty.includes("42703")
      );
      if (isMissing) {
        setMissingStatusColumn(true);
        setRows([]);
        return;
      }
      throw listError;
    }
    setMissingStatusColumn(false);
    setRows(Array.isArray(data) ? data : []);
  };

  const updateStatus = async (id: string, status: "active" | "blocked") => {
    setError(null);
    setSuccess(null);
    setBusyId(id);
    try {
      const nextUpdate: Record<string, unknown> = {
        account_status: status,
        ...(status === "active" ? { approved_at: new Date().toISOString() } : {}),
      };
      if (status === "active" && isUuid(ownerAcademyId)) {
        const { data: studentRow, error: studentError } = await supabase
          .from("profiles")
          .select("academy_id")
          .eq("id", id)
          .eq("role", "student")
          .maybeSingle<{ academy_id: string | null }>();
        if (studentError) throw studentError;
        if (studentRow && !isUuid(studentRow.academy_id)) {
          nextUpdate.academy_id = ownerAcademyId;
        }
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(nextUpdate)
        .eq("id", id)
        .eq("role", "student");
      if (updateError) throw updateError;

      await loadPendingRows();
      setSuccess(status === "active" ? OWNER_APPROVALS_TEXT.successApprove : OWNER_APPROVALS_TEXT.successBlock);
    } catch (e: unknown) {
      console.error("Owner approvals status update failed:", toPrettyErrorString(e), e);
      setError(toPrettyErrorString(e));
    } finally {
      setBusyId(null);
    }
  };

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => {
      const haystack = `${row.name ?? ""} ${row.email ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, rows]);

  return (
    <PageShell
      title={OWNER_APPROVALS_TEXT.pageTitle}
      subtitle={OWNER_APPROVALS_TEXT.pageSubtitle}
      actions={<HomeLink fallbackHref="/owner" />}
      maxWidthClassName="max-w-4xl"
    >
      <SectionCard>
        {missingStatusColumn && (
          <div className="mb-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">
            <div className="font-semibold">{OWNER_APPROVALS_TEXT.missingStatusColumnTitle}</div>
            <div className="mt-1">{OWNER_APPROVALS_TEXT.missingStatusColumnHelp}</div>
            <div className="mt-1 underline underline-offset-4">{OWNER_APPROVALS_TEXT.missingStatusColumnLinkText}: docs/db-migrations-apply.md</div>
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">
            {success}
          </div>
        )}

        <input
          type="text"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={OWNER_APPROVALS_TEXT.searchPlaceholder}
        />

        {loading ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">로딩 중...</div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            {OWNER_APPROVALS_TEXT.empty}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-[var(--text)]">{row.name?.trim() || row.id.slice(0, 8)}</div>
                    <div className="text-xs text-[var(--text-muted)]">{row.email ?? "-"}</div>
                  </div>
                  <span className="inline-flex rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
                    pending
                  </span>
                </div>
                <div className="mt-2 text-xs text-[var(--text-muted)]">
                  {`${levelToLabel(row.school_level)} / ${row.grade ?? "-"}학년 / ${row.class_label?.trim() || "-"}`}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">가입: {formatCreatedAt(row.created_at)}</div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    className="w-full rounded-lg border border-[var(--success-text)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success-text)] disabled:opacity-60 sm:w-auto"
                    disabled={busyId === row.id}
                    onClick={() => void updateStatus(row.id, "active")}
                  >
                    {busyId === row.id ? OWNER_APPROVALS_TEXT.processing : OWNER_APPROVALS_TEXT.approve}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-[var(--danger-text)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)] disabled:opacity-60 sm:w-auto"
                    disabled={busyId === row.id}
                    onClick={() => void updateStatus(row.id, "blocked")}
                  >
                    {busyId === row.id ? OWNER_APPROVALS_TEXT.processing : OWNER_APPROVALS_TEXT.block}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
