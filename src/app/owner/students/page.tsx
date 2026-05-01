"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ArchiveProfileRpcResult = {
  ok: boolean;
  reason?: string | null;
};

type PageState = "loading" | "ready";
type SchoolLevel = "elem" | "mid" | "high";

type StudentRow = {
  id: string;
  email: string | null;
  name: string | null;
  school_level: SchoolLevel | null;
  grade: number | null;
  class_label: string | null;
  student_no: string | null;
};

const schoolLevelLabel: Record<SchoolLevel, string> = {
  elem: "\uCD08",
  mid: "\uC911",
  high: "\uACE0",
};

function getSchoolLevelLabel(level: SchoolLevel | null): string {
  if (!level) return "\uBBF8\uC785\uB825";
  return schoolLevelLabel[level];
}

function getGradeOptions(level: SchoolLevel | ""): number[] {
  if (level === "elem") return [1, 2, 3, 4, 5, 6];
  if (level === "mid" || level === "high") return [1, 2, 3];
  return [];
}

function formatStudentLabel(row: StudentRow): string {
  const level = getSchoolLevelLabel(row.school_level);
  const grade = row.grade != null ? `${row.grade}\uD559\uB144` : "";
  const name = row.name?.trim() || "\uC774\uB984\uC5C6\uC74C";
  const classText = row.class_label?.trim() ? ` (${row.class_label.trim()})` : "";

  return [level, grade, name].filter(Boolean).join(" ") + classText;
}

export default function OwnerStudentsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | "">("");
  const [grade, setGrade] = useState<number | "">("");
  const [classLabel, setClassLabel] = useState("");
  const [studentNo, setStudentNo] = useState("");

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);

  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{ email: string; name: string | null; actionLink: string } | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredStudents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return students;

    return students.filter((row) => {
      const fields = [
        row.name ?? "",
        row.email ?? "",
        row.class_label ?? "",
        row.student_no ?? "",
        getSchoolLevelLabel(row.school_level),
        row.school_level ?? "",
        row.grade != null ? String(row.grade) : "",
        row.grade != null ? `${row.grade}\uD559\uB144` : "",
      ];
      return fields.some((value) => value.toLowerCase().includes(q));
    });
  }, [keyword, students]);

  useEffect(() => {
    if (!selectedStudentId) return;
    const exists = students.some((row) => row.id === selectedStudentId);
    if (!exists) {
      clearSelectionForm();
    }
  }, [students, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((row) => row.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const gradeOptions = useMemo(() => getGradeOptions(schoolLevel), [schoolLevel]);

  const clearSelectionForm = () => {
    setSelectedStudentId(null);
    setName("");
    setSchoolLevel("");
    setGrade("");
    setClassLabel("");
    setStudentNo("");
  };

  const applyForm = (row: StudentRow) => {
    setSelectedStudentId(row.id);
    setName(row.name ?? "");
    setSchoolLevel(row.school_level ?? "");
    setGrade(typeof row.grade === "number" ? row.grade : "");
    setClassLabel(row.class_label ?? "");
    setStudentNo(row.student_no ?? "");
    setActionError(null);
    setActionSuccess(null);
  };

  const fetchStudents = async (): Promise<StudentRow[] | null> => {
    const query = supabase
      .from("profiles")
      .select("id, email, name, school_level, grade, class_label, student_no")
      .eq("role", "student");

    const { data, error } = await query
      .order("school_level", { ascending: true, nullsFirst: false })
      .order("grade", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true, nullsFirst: false })
      .order("email", { ascending: true })
      .range(0, 499);

    if (error) {
      setPageError(`\uD559\uC0DD \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${error.message}`);
      return null;
    }

    const rows = (data ?? []) as StudentRow[];
    setStudents(rows);
    return rows;
  };

  const refreshStudents = async () => {
    const rows = await fetchStudents();
    if (!rows) return;

    if (rows.length === 0) {
      clearSelectionForm();
      return;
    }

    if (!selectedStudentId) return;

    const selected = rows.find((row) => row.id === selectedStudentId);
    if (selected) {
      applyForm(selected);
      return;
    }

    clearSelectionForm();
  };

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

    if (me.role !== "owner" && me.role !== "teacher") {
      router.replace("/");
      return;
    }

    const rows = await fetchStudents();
    if (!rows) {
      setPageState("ready");
      return;
    }

    if (rows.length > 0) {
      applyForm(rows[0]);
    }

    setPageState("ready");
  };

  const archiveTarget = useMemo(
    () => (archiveTargetId ? students.find((row) => row.id === archiveTargetId) ?? null : null),
    [students, archiveTargetId]
  );

  const openArchiveModal = (studentId: string) => {
    setArchiveTargetId(studentId);
    setArchiveReason("");
    setActionError(null);
    setActionSuccess(null);
  };

  const closeArchiveModal = () => {
    if (archiving) return;
    setArchiveTargetId(null);
    setArchiveReason("");
  };

  const submitArchive = async () => {
    if (!archiveTargetId) return;
    const reason = archiveReason.trim();
    if (!reason) {
      setActionError("탈퇴 사유를 입력해 주세요.");
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setArchiving(true);
    try {
      const { data, error: rpcError } = await supabase
        .rpc("archive_profile", { p_user_id: archiveTargetId, p_reason: reason })
        .single<ArchiveProfileRpcResult>();
      if (rpcError) throw rpcError;
      if (data?.ok) {
        setActionSuccess("처리 완료");
        setArchiveTargetId(null);
        setArchiveReason("");
        if (selectedStudentId === archiveTargetId) clearSelectionForm();
        await refreshStudents();
        return;
      }
      const code = data?.reason ?? "UNKNOWN";
      if (code === "CANNOT_ARCHIVE_SELF") setActionError("본인은 처리할 수 없어요.");
      else if (code === "CANNOT_ARCHIVE_OWNER") setActionError("원장은 처리할 수 없어요.");
      else setActionError(`처리하지 못했어요 (${code}).`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("archive_profile failed:", message, e);
      setActionError(`처리 실패: ${message}`);
    } finally {
      setArchiving(false);
    }
  };

  const sendRecoveryLink = async (studentId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setRecoveryBusy(true);
    setRecoveryCopied(false);
    try {
      const res = await fetch("/api/owner/students/recovery-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        actionLink?: string;
        email?: string;
        name?: string | null;
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.actionLink || !payload.email) {
        setActionError(payload.error ?? "재설정 링크 생성에 실패했어요.");
        return;
      }
      setRecoveryResult({
        email: payload.email,
        name: payload.name ?? null,
        actionLink: payload.actionLink,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "재설정 링크 생성에 실패했어요.";
      setActionError(message);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const closeRecoveryModal = () => {
    setRecoveryResult(null);
    setRecoveryCopied(false);
  };

  const copyRecoveryLink = async () => {
    if (!recoveryResult) return;
    try {
      await navigator.clipboard.writeText(recoveryResult.actionLink);
      setRecoveryCopied(true);
    } catch {
      setRecoveryCopied(false);
    }
  };

  const handleSchoolLevelChange = (value: SchoolLevel | "") => {
    setSchoolLevel(value);

    const nextOptions = getGradeOptions(value);
    if (!nextOptions.includes(Number(grade))) {
      setGrade("");
    }
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!selectedStudentId) {
      setActionError("\uC218\uC815\uD560 \uD559\uC0DD\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedClassLabel = classLabel.trim();
    const trimmedStudentNo = studentNo.trim();

    if (!trimmedName) {
      setActionError("\uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.");
      return;
    }

    const validGradeOptions = getGradeOptions(schoolLevel);
    const normalizedGrade = validGradeOptions.includes(Number(grade)) ? Number(grade) : null;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        name: trimmedName,
        school_level: schoolLevel || null,
        grade: normalizedGrade,
        class_label: trimmedClassLabel || null,
        student_no: trimmedStudentNo || null,
      })
      .eq("id", selectedStudentId);

    if (error) {
      setActionError(`\uC800\uC7A5 \uC2E4\uD328: ${error.message}`);
      setSaving(false);
      return;
    }

    await refreshStudents();

    setActionSuccess("\uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    setSaving(false);
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
      <div className="mx-auto w-full max-w-6xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[var(--accent)]">MVS</span> {"\uD559\uC0DD \uAD00\uB9AC"}
        </h1>
        <Link
          href="/owner/archived"
          className="mt-3 inline-block rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] hover:border-[var(--accent)]"
        >
          {"📦 아카이브 조회"}
        </Link>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{"\uD559\uC0DD \uAE30\uBCF8 \uC815\uBCF4\uB97C \uAC80\uC0C9\uD558\uACE0 \uC218\uC815\uD569\uB2C8\uB2E4."}</p>

        {pageError && (
          <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">{pageError}</div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <section className="relative z-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <label className="block text-sm text-[var(--text-muted)]" htmlFor="student-search">
              {"\uAC80\uC0C9"}
            </label>
            <input
              id="student-search"
              type="text"
              className="pointer-events-auto mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={"\uC774\uB984/\uC774\uBA54\uC77C/\uD559\uAD50\uAE09/\uD559\uB144/\uBC18/\uD559\uBC88"}
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {"\uD45C\uC2DC: "}
              {filteredStudents.length}
              {" / \uC804\uCCB4: "}
              {students.length}
            </p>
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-auto pr-1">
              {filteredStudents.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text-muted)]">
                  {"\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}
                </div>
              ) : (
                filteredStudents.map((row) => {
                  const selected = row.id === selectedStudentId;

                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => applyForm(row)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <div className="text-sm font-medium text-[var(--text)]">{formatStudentLabel(row)}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{row.email || "\uC774\uBA54\uC77C \uC5C6\uC74C"}</div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            {!selectedStudent ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
                {"\uD559\uC0DD\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."}
              </div>
            ) : (
              <form className="space-y-4" onSubmit={(e) => void handleSave(e)}>
                <h2 className="text-lg font-semibold text-[var(--text)]">{"\uD559\uC0DD \uC815\uBCF4 \uC218\uC815"}</h2>

                {actionError && (
                  <div className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">{actionError}</div>
                )}

                {actionSuccess && (
                  <div className="rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">{actionSuccess}</div>
                )}

                <label className="block space-y-2">
                  <span className="text-sm text-[var(--text-muted)]">{"\uC774\uB984 *"}</span>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-[var(--text-muted)]">{"\uD559\uAD50\uAE09"}</span>
                  <select
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    value={schoolLevel}
                    onChange={(e) => handleSchoolLevelChange((e.target.value as SchoolLevel) || "")}
                  >
                    <option value="">{"\uC120\uD0DD \uC548 \uD568"}</option>
                    <option value="elem">{"\uCD08"}</option>
                    <option value="mid">{"\uC911"}</option>
                    <option value="high">{"\uACE0"}</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-[var(--text-muted)]">{"\uD559\uB144"}</span>
                  <select
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
                    disabled={!schoolLevel}
                  >
                    <option value="">{"\uC120\uD0DD \uC548 \uD568"}</option>
                    {gradeOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-[var(--text-muted)]">{"\uBC18 (\uC120\uD0DD)"}</span>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    value={classLabel}
                    onChange={(e) => setClassLabel(e.target.value)}
                    placeholder={"\uC608: A\uBC18"}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-[var(--text-muted)]">{"\uD559\uBC88 (\uC120\uD0DD)"}</span>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    value={studentNo}
                    onChange={(e) => setStudentNo(e.target.value)}
                    placeholder={"\uD559\uC0DD \uBC88\uD638"}
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--bg)] disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "\uC800\uC7A5 \uC911..." : "\uC800\uC7A5"}
                </button>
                <button
                  type="button"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-60"
                  onClick={() => void sendRecoveryLink(selectedStudent.id)}
                  disabled={saving || recoveryBusy}
                >
                  {recoveryBusy ? "처리 중..." : "🔑 비번 재설정 메일 보내기"}
                </button>
                <button
                  type="button"
                  className="mt-2 w-full rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger-text)] hover:border-[var(--danger-text)] disabled:opacity-60"
                  onClick={() => openArchiveModal(selectedStudent.id)}
                  disabled={saving}
                >
                  📦 탈퇴 처리
                </button>
              </form>
            )}
          </section>
        </div>
      </div>

      {archiveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeArchiveModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">📦 학생 탈퇴 처리</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text)]">{archiveTarget.name?.trim() || archiveTarget.id.slice(0, 8)}</span>
              {" 학생을 탈퇴 처리할까요? 이력은 아카이브에 보존됩니다."}
            </p>
            <label className="mt-4 block text-sm text-[var(--text-muted)]">
              {"탈퇴 사유"}
              <textarea
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                rows={3}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder={"예: 학원 그만둠, 학부모 요청 등"}
                disabled={archiving}
              />
            </label>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm text-[var(--text)] disabled:opacity-60"
                onClick={closeArchiveModal}
                disabled={archiving}
              >
                {"취소"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger-text)] disabled:opacity-60"
                onClick={() => void submitArchive()}
                disabled={archiving || archiveReason.trim().length === 0}
              >
                {archiving ? "처리 중..." : "탈퇴 처리"}
              </button>
            </div>
          </div>
        </div>
      )}

      {recoveryResult && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeRecoveryModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">{"🔑 비번 재설정 링크"}</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text)]">{recoveryResult.name?.trim() || recoveryResult.email}</span>
              {" 학생에게 이 링크를 카톡/문자로 전달해 주세요. 링크는 일정 시간 후 만료돼요."}
            </p>
            <div className="mt-4 break-all rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)]">
              {recoveryResult.actionLink}
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm text-[var(--text)]"
                onClick={closeRecoveryModal}
              >
                {"닫기"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)]"
                onClick={() => void copyRecoveryLink()}
              >
                {recoveryCopied ? "✓ 복사됨" : "📋 링크 복사"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
