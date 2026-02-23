"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Student = { id: string; name: string | null; email: string | null };
type PageState = "loading" | "ready";

type IssueResult =
  | { ok: true; code: string; expires_at: string }
  | { ok: false; reason?: string };

export default function GenerateLinkCodePage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [generatedCodes, setGeneratedCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setPageError(null);

    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setPageError(`\uC138\uC158 \uD655\uC778 \uC2E4\uD328: ${sessionError.message}`);
      setPageState("ready");
      return;
    }

    const session = data.session;
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
      setPageError(`\uAD8C\uD55C \uD655\uC778 \uC2E4\uD328: ${meError.message}`);
      setPageState("ready");
      return;
    }

    if (me?.role !== "owner" && me?.role !== "teacher") {
      router.replace("/");
      return;
    }

    const { data: studentRows, error: studentsError } = await supabase.rpc("list_students");

    if (studentsError) {
      setPageError(`\uD559\uC0DD \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${studentsError.message}`);
      setPageState("ready");
      return;
    }

    if (!Array.isArray(studentRows)) {
      setPageError("\uD559\uC0DD \uBAA9\uB85D \uC751\uB2F5 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBC30\uC5F4 \uB370\uC774\uD130\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      setStudents([]);
      setPageState("ready");
      return;
    }

    setStudents(studentRows as Student[]);
    setPageState("ready");
  };

  const handleIssueCode = async (studentId: string) => {
    setActionError(null);
    setBusyStudentId(studentId);

    try {
      const { data, error } = await supabase.rpc("issue_student_link_code", {
        p_student_id: studentId,
        p_days: 7,
      });

      if (error) {
        throw new Error(error.message);
      }

      const res = data as IssueResult;
      if (!res || (res as any).ok !== true || !(res as any).code) {
        throw new Error("\uCF54\uB4DC \uBC1C\uAE09 \uACB0\uACFC\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      }

      setGeneratedCodes((prev) => ({ ...prev, [studentId]: (res as any).code }));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "\uCF54\uB4DC \uBC1C\uAE09 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setBusyStudentId(null);
    }
  };

  if (pageState === "loading") {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        {"\uB85C\uB529 \uC911..."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> {"\uD559\uC0DD \uB9C1\uD06C \uCF54\uB4DC \uBC1C\uAE09"}
        </h1>
        <p className="mt-2 text-sm text-[#B8B8C3]">{"\uC6D0\uC7A5/\uAD50\uC0AC \uACC4\uC815\uC5D0\uC11C \uD559\uC0DD\uC744 \uBCF4\uD638\uC790\uC640 \uC5F0\uACB0\uD560 \uC218 \uC788\uB294 \uCF54\uB4DC\uB97C \uBC1C\uAE09\uD569\uB2C8\uB2E4."}</p>

        {pageError && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
            {pageError}
          </div>
        )}

        {actionError && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
            {actionError}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {students.length === 0 ? (
            <div className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">
              {"\uD559\uC0DD \uD504\uB85C\uD544(role=student)\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}
            </div>
          ) : (
            students.map((student) => {
              const isBusy = busyStudentId === student.id;
              const issuedCode = generatedCodes[student.id];

              return (
                <div
                  key={student.id}
                  className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[#F5F5F7]">{student.name || "\uC774\uB984 \uC5C6\uC74C"}</div>
                    <div className="text-sm text-[#B8B8C3] truncate">{student.email || "\uC774\uBA54\uC77C \uC5C6\uC74C"}</div>
                    {issuedCode && <div className="mt-2 text-sm text-[#D4AF37]">{"\uBC1C\uAE09 \uCF54\uB4DC"}: {issuedCode}</div>}
                  </div>

                  <button
                    className="rounded-xl bg-[#D4AF37] px-4 py-2 font-semibold text-black disabled:opacity-60"
                    onClick={() => void handleIssueCode(student.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? "\uBC1C\uAE09 \uC911..." : "\uCF54\uB4DC \uBC1C\uAE09"}
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
