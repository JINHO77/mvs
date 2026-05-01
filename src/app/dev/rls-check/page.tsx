"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ActionResult = {
  action: string;
  ok: boolean;
  error: { message: string } | null;
  data: unknown;
};

export default function DevRlsCheckPage() {
  const isDev = process.env.NODE_ENV === "development";
  const [uid, setUid] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [running, setRunning] = useState<"list" | "insert" | null>(null);
  const [candidateStudentId, setCandidateStudentId] = useState("3e36e361-fd57-4a7b-b197-1a41ae73555b");
  const [logs, setLogs] = useState<ActionResult[]>([]);

  const appendLog = (entry: ActionResult) => {
    setLogs((prev) => [...prev, entry]);
  };

  useEffect(() => {
    if (!isDev) {
      setLoadingUser(false);
      return;
    }

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUid(session?.user?.id ?? null);
      setLoadingUser(false);
    })();
  }, [isDev]);

  const runListMyStudents = async () => {
    setRunning("list");

    const { data, error } = await supabase.rpc("list_my_students");
    if (error) {
      appendLog({
        action: "list_my_students",
        ok: false,
        error: { message: error.message },
        data: null,
      });
      setRunning(null);
      return;
    }

      appendLog({
        action: "list_my_students",
        ok: true,
        error: null,
      data: Array.isArray(data) ? data : [],
    });
    setRunning(null);
  };

  const runUnsafeInsertTest = async () => {
    if (!uid) return;

    setRunning("insert");

    const tryInsert = async (
      action: "insert_test_fk" | "insert_test_rls",
      studentId: string,
      extraData?: Record<string, unknown>
    ) => {
      const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("consultation_requests")
        .insert({
          guardian_id: uid,
          student_id: studentId,
          requested_start_at: startAt,
          duration_min: 30,
          type: "phone",
          status: "requested",
          entry_mode: "manual",
          manual_student_name: "RLS TEST",
          manual_school_level: "elementary",
          manual_grade: 1,
          manual_guardian_contact: "000-0000-0000",
          manual_consultation_content: action === "insert_test_fk" ? "RLS FK check" : "RLS ownership check",
        })
        .select("id")
        .maybeSingle();

      if (error) {
        appendLog({
          action,
          ok: false,
          error: { message: error.message },
          data: { used_student_id: studentId, ...(extraData ?? {}) },
        });
        return;
      }

      appendLog({
        action,
        ok: true,
        error: null,
        data: { inserted_id: data?.id ?? null, used_student_id: studentId, ...(extraData ?? {}) },
      });

      if (!data?.id) return;

      const { error: rollbackError } = await supabase
        .from("consultation_requests")
        .delete()
        .eq("id", data.id)
        .eq("guardian_id", uid);

      appendLog({
        action: `${action}_rollback`,
        ok: !rollbackError,
        error: rollbackError ? { message: rollbackError.message } : null,
        data: { id: data.id, rolled_back: !rollbackError },
      });
    };

    const fkMissingStudentId = crypto.randomUUID();
    await tryInsert("insert_test_fk", fkMissingStudentId);

    const manualCandidateId = candidateStudentId.trim();
    if (manualCandidateId) {
      await tryInsert("insert_test_rls", manualCandidateId, {
        stage: "manual_candidate",
        candidates: 1,
        candidate_id: manualCandidateId,
      });
      setRunning(null);
      return;
    }

    const { data: mine, error: mineError } = await supabase.rpc("list_my_students");
    if (mineError) {
      appendLog({
        action: "insert_test_rls",
        ok: false,
        error: { message: mineError.message },
        data: { stage: "list_my_students", used_student_id: null },
      });
      setRunning(null);
      return;
    }
    const myStudentIds = (
      (Array.isArray(mine) ? mine : [])
        .map((row) => (typeof row === "object" && row && "student_id" in row ? row.student_id : null))
        .filter((v): v is string => typeof v === "string")
    );

    let candidateQuery = supabase.from("profiles").select("id").eq("role", "student");
    if (myStudentIds.length > 0) {
      const notInFilter = `(${myStudentIds.map((id) => `"${id}"`).join(",")})`;
      candidateQuery = candidateQuery.not("id", "in", notInFilter);
    }

    const { data: candidates, error: candidateError } = await candidateQuery.limit(1);

    if (candidateError) {
      appendLog({
        action: "insert_test_rls",
        ok: false,
        error: { message: candidateError.message },
        data: { stage: "find_candidate_student", candidates: 0, candidate_id: null, used_student_id: null },
      });
      setRunning(null);
      return;
    }

    const candidateId = (candidates ?? [])
      .map((row) => row.id)
      .find((id): id is string => typeof id === "string") ?? null;

    if (!candidateId) {
      appendLog({
        action: "insert_test_rls",
        ok: false,
        error: { message: "No candidate student_id found for RLS test" },
        data: { stage: "pick_candidate", candidates: (candidates ?? []).length, candidate_id: null, used_student_id: null },
      });
      setRunning(null);
      return;
    }

    await tryInsert("insert_test_rls", candidateId, {
      candidates: (candidates ?? []).length,
      candidate_id: candidateId,
    });

    setRunning(null);
  };

  if (!isDev) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
        <div className="rounded-xl border border-[#1E1E26] bg-[#121218] p-4 text-sm text-[#B8B8C3]">Not available</div>
      </main>
    );
  }

  if (loadingUser) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
        <div className="rounded-xl border border-[#1E1E26] bg-[#121218] p-4 text-sm text-[#B8B8C3]">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> DEV RLS Check
        </h1>

        {!uid ? (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
            No logged-in user. Please log in and retry.
          </div>
        ) : (
          <>
            <div className="mt-4 text-sm text-[#B8B8C3]">auth.uid: {uid}</div>
            <div className="mt-3">
              <label htmlFor="candidate-student-id" className="mb-1 block text-xs text-[#B8B8C3]">
                RLS candidate student_id (optional)
              </label>
              <input
                id="candidate-student-id"
                type="text"
                className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-3 py-2 text-sm text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
                value={candidateStudentId}
                onChange={(e) => setCandidateStudentId(e.target.value)}
                placeholder="student uuid"
                disabled={running !== null}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7] disabled:opacity-60"
                onClick={() => void runListMyStudents()}
                disabled={running !== null}
              >
                {"\uB0B4 \uC790\uB140 \uC870\uD68C(list_my_students)"}
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#D4AF37] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
                onClick={() => void runUnsafeInsertTest()}
                disabled={running !== null}
              >
                {"FK/RLS insert \uD14C\uC2A4\uD2B8 \uC2E4\uD589"}
              </button>
            </div>
          </>
        )}
        <pre className="mt-4 overflow-auto rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-3 text-xs text-[#B8B8C3]">
          {JSON.stringify(logs, null, 2)}
        </pre>
      </div>
    </main>
  );
}
