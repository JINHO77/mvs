"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SchoolLevel = "elem" | "mid" | "high";
type PageState = "loading" | "ready";

type MyStudentRow = {
  student_id: string;
  name: string | null;
  email: string | null;
  school_level: SchoolLevel | null;
  grade: number | null;
  class_label: string | null;
  student_no: string | null;
  relation: string | null;
  linked_at: string | null;
};

function levelLabel(level: SchoolLevel | null) {
  if (level === "elem") return "Elementary";
  if (level === "mid") return "Middle";
  if (level === "high") return "High";
  return "Unknown";
}

function fmtKst(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function ParentStudentsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<MyStudentRow[]>([]);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMyStudents = async () => {
    const { data, error: listError } = await supabase.rpc("list_my_students");
    if (listError) {
      setError(`Failed to load students: ${listError.message}`);
      setStudents([]);
      return;
    }
    setStudents((Array.isArray(data) ? data : []) as MyStudentRow[]);
  };

  const initialize = async () => {
    setError(null);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      setError(`Session error: ${sessionError.message}`);
      setPageState("ready");
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
      .single<{ role: string }>();
    if (meError) {
      setError(`Role check failed: ${meError.message}`);
      setPageState("ready");
      return;
    }
    if (me.role !== "parent") {
      router.replace("/");
      return;
    }

    await loadMyStudents();
    setPageState("ready");
  };

  const handleUnlink = async (student: MyStudentRow) => {
    if (busyStudentId) return;
    const ok = window.confirm(`Unlink ${student.name ?? "student"}?`);
    if (!ok) return;

    setError(null);
    setBusyStudentId(student.student_id);
    try {
      const { error: unlinkError } = await supabase.rpc("unlink_student", { p_student_id: student.student_id });
      if (unlinkError) {
        setError(`Unlink failed: ${unlinkError.message}`);
        return;
      }
      await loadMyStudents();
    } finally {
      setBusyStudentId(null);
    }
  };

  if (pageState === "loading") {
    return <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            <span className="text-[#D4AF37]">MVS</span> My Students
          </h1>
          <button
            type="button"
            className="rounded-xl bg-[#D4AF37] px-4 py-2 font-semibold text-black"
            onClick={() => router.push("/link-student")}
          >
            Link Student
          </button>
        </div>

        {error && <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{error}</div>}

        <div className="mt-6 space-y-3">
          {students.length === 0 ? (
            <div className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">
              No linked students yet.
            </div>
          ) : (
            students.map((row) => {
              const title = `${levelLabel(row.school_level)} ${row.grade ?? "-"} ${row.name ?? "Unknown"}`;
              const isBusy = busyStudentId === row.student_id;
              return (
                <div key={row.student_id} className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4">
                  <div className="text-sm text-[#F5F5F7]">{title}</div>
                  <div className="mt-1 text-sm text-[#B8B8C3]">{row.email ?? "-"}</div>
                  <div className="mt-1 text-sm text-[#8D8D98]">
                    Relation: {row.relation ?? "-"} / Linked: {fmtKst(row.linked_at)}
                  </div>
                  <button
                    type="button"
                    className="mt-3 rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7] disabled:opacity-60"
                    onClick={() => void handleUnlink(row)}
                    disabled={isBusy}
                  >
                    {isBusy ? "Unlinking..." : "Unlink"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
