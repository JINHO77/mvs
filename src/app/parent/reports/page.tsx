"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import ReportListItem from "@/components/reports/ReportListItem";
import { prettyUserError } from "@/lib/errors";
import { listParentReports, type ReportListItem as ReportListItemType } from "@/lib/reports";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { isUuid, normalizeMonthKey } from "@/lib/validators";

type LinkedStudent = {
  id: string;
  name: string | null;
};

export default function ParentReportsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReportListItemType[]>([]);
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState("");

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      setItems([]);
      return;
    }
    void loadReports(selectedStudentId, monthFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, monthFilter]);

  useEffect(() => {
    const handleFocus = () => {
      if (!selectedStudentId) return;
      void loadReports(selectedStudentId, monthFilter);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, monthFilter]);

  const initialize = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Parent reports session failed:", toPrettyErrorString(sessionError), sessionError);
      setError(prettyUserError(sessionError));
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    try {
      const { data: links, error: linkError } = await supabase
        .from("student_guardians")
        .select("student_id")
        .eq("guardian_id", session.user.id)
        .returns<Array<{ student_id: string | null }>>();
      if (linkError) throw linkError;

      const linkedIds = Array.from(new Set((links ?? []).map((row) => row.student_id).filter((id): id is string => isUuid(id))));
      if (linkedIds.length === 0) {
        setStudents([]);
        setSelectedStudentId(null);
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,name")
        .in("id", linkedIds)
        .returns<Array<{ id: string; name: string | null }>>();
      if (profileError) throw profileError;

      const nextStudents = (profiles ?? []).map((row) => ({ id: row.id, name: row.name }));
      setStudents(nextStudents);
      const firstId = nextStudents[0]?.id ?? null;
      setSelectedStudentId(firstId);
      if (firstId) await loadReports(firstId, monthFilter);
    } catch (e: unknown) {
      console.error("Parent reports initialize failed:", toPrettyErrorString(e), e);
      setError(prettyUserError(e));
      setStudents([]);
      setSelectedStudentId(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async (studentId: string, month: string) => {
    try {
      setError(null);
      const rows = await listParentReports(studentId, normalizeMonthKey(month));
      setItems(rows);
    } catch (e: unknown) {
      console.error("Parent reports load failed:", toPrettyErrorString(e), e);
      setError(prettyUserError(e));
      setItems([]);
    }
  };

  return (
    <PageShell title="월별 리포트" subtitle="연결된 학생의 리포트를 조회하세요." maxWidthClassName="max-w-5xl">
      <SectionCard header="학생 리포트">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={selectedStudentId ?? ""}
            onChange={(e) => setSelectedStudentId(isUuid(e.target.value) ? e.target.value : null)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
          >
            <option value="">학생 선택</option>
            {students.map((row) => (
              <option key={row.id} value={row.id}>{row.name?.trim() || row.id.slice(0, 8)}</option>
            ))}
          </select>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(normalizeMonthKey(e.target.value) ?? "")}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
          />
        </div>

        {loading && <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text-muted)]">로딩 중...</div>}
        {!loading && error && <div className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">{error}</div>}
        {!loading && !error && items.length === 0 && <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text-muted)]">리포트가 없습니다.</div>}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <ReportListItem key={item.id} item={item} href={`/reports/${item.id}`} showStudentName />
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
