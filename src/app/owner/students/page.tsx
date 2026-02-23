"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

function buildSearchFields(row: StudentRow): string[] {
  const rawSchoolLevel = row.school_level ?? "";
  const schoolLevelKorean = getSchoolLevelLabel(row.school_level);
  const gradeText = row.grade != null ? String(row.grade) : "";
  const gradeWithLabel = row.grade != null ? `${row.grade}\uD559\uB144` : "";

  return [
    row.name ?? "",
    row.email ?? "",
    rawSchoolLevel,
    schoolLevelKorean,
    row.class_label ?? "",
    row.student_no ?? "",
    gradeText,
    gradeWithLabel,
  ];
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
    if (process.env.NODE_ENV === "production") return;

    const trimmed = keyword.trim();
    const sampleRow = students[0] ?? null;
    const sampleFields = sampleRow ? buildSearchFields(sampleRow) : [];
    const firstFiltered = filteredStudents[0] ?? null;

    console.debug("[owner/students] search debug", {
      keywordRaw: keyword,
      keywordTrimmed: trimmed,
      studentsLength: students.length,
      filteredLength: filteredStudents.length,
      firstFiltered: firstFiltered
        ? {
            name: firstFiltered.name,
            email: firstFiltered.email,
            school_level: firstFiltered.school_level,
            grade: firstFiltered.grade,
            class_label: firstFiltered.class_label,
            student_no: firstFiltered.student_no,
          }
        : null,
      sampleFields,
    });
  }, [keyword, students, filteredStudents]);

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
      <div className="mx-auto w-full max-w-6xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> {"\uD559\uC0DD \uAD00\uB9AC"}
        </h1>
        <p className="mt-2 text-sm text-[#B8B8C3]">{"\uD559\uC0DD \uAE30\uBCF8 \uC815\uBCF4\uB97C \uAC80\uC0C9\uD558\uACE0 \uC218\uC815\uD569\uB2C8\uB2E4."}</p>

        {pageError && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{pageError}</div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <section className="relative z-0 rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4">
            <label className="block text-sm text-[#D5D5DD]" htmlFor="student-search">
              {"\uAC80\uC0C9"}
            </label>
            <input
              id="student-search"
              type="text"
              className="pointer-events-auto mt-2 w-full rounded-xl border border-[#2A2A35] bg-[#121218] px-3 py-2 text-sm text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={"\uC774\uB984/\uC774\uBA54\uC77C/\uD559\uAD50\uAE09/\uD559\uB144/\uBC18/\uD559\uBC88"}
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-[#8D8D98]">
              {"\uD45C\uC2DC: "}
              {filteredStudents.length}
              {" / \uC804\uCCB4: "}
              {students.length}
            </p>
            {process.env.NODE_ENV !== "production" && (
              <div className="mt-1 text-xs text-[#6F6F7D]">
                <div>keyword raw: &quot;{keyword}&quot;</div>
                <div>keyword trimmed: &quot;{keyword.trim()}&quot;</div>
                <div>students.length: {students.length}</div>
                <div>filteredStudents.length: {filteredStudents.length}</div>
                <div>selectedStudentId: {selectedStudentId ?? "(none)"}</div>
              </div>
            )}

            <div className="mt-3 max-h-[55vh] space-y-2 overflow-auto pr-1">
              {filteredStudents.length === 0 ? (
                <div className="rounded-xl border border-[#1E1E26] bg-[#121218] p-3 text-sm text-[#B8B8C3]">
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
                          ? "border-[#D4AF37] bg-[#1A1A22]"
                          : "border-[#1E1E26] bg-[#121218] hover:border-[#2D2D3A]"
                      }`}
                    >
                      <div className="text-sm font-medium text-[#F5F5F7]">{formatStudentLabel(row)}</div>
                      <div className="mt-1 text-xs text-[#B8B8C3]">{row.email || "\uC774\uBA54\uC77C \uC5C6\uC74C"}</div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4">
            {!selectedStudent ? (
              <div className="rounded-xl border border-[#1E1E26] bg-[#121218] p-4 text-sm text-[#B8B8C3]">
                {"\uD559\uC0DD\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."}
              </div>
            ) : (
              <form className="space-y-4" onSubmit={(e) => void handleSave(e)}>
                <h2 className="text-lg font-semibold text-[#F5F5F7]">{"\uD559\uC0DD \uC815\uBCF4 \uC218\uC815"}</h2>

                {actionError && (
                  <div className="rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{actionError}</div>
                )}

                {actionSuccess && (
                  <div className="rounded-xl border border-[#2D5E41] bg-[#14261B] p-3 text-sm text-[#A6F4C5]">{actionSuccess}</div>
                )}

                <label className="block space-y-2">
                  <span className="text-sm text-[#D5D5DD]">{"\uC774\uB984 *"}</span>
                  <input
                    className="w-full rounded-xl border border-[#2A2A35] bg-[#121218] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-[#D5D5DD]">{"\uD559\uAD50\uAE09"}</span>
                  <select
                    className="w-full rounded-xl border border-[#2A2A35] bg-[#121218] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
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
                  <span className="text-sm text-[#D5D5DD]">{"\uD559\uB144"}</span>
                  <select
                    className="w-full rounded-xl border border-[#2A2A35] bg-[#121218] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37] disabled:opacity-60"
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
                  <span className="text-sm text-[#D5D5DD]">{"\uBC18 (\uC120\uD0DD)"}</span>
                  <input
                    className="w-full rounded-xl border border-[#2A2A35] bg-[#121218] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
                    value={classLabel}
                    onChange={(e) => setClassLabel(e.target.value)}
                    placeholder={"\uC608: A\uBC18"}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-[#D5D5DD]">{"\uD559\uBC88 (\uC120\uD0DD)"}</span>
                  <input
                    className="w-full rounded-xl border border-[#2A2A35] bg-[#121218] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
                    value={studentNo}
                    onChange={(e) => setStudentNo(e.target.value)}
                    placeholder={"\uD559\uC0DD \uBC88\uD638"}
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#D4AF37] px-4 py-2 font-semibold text-black disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "\uC800\uC7A5 \uC911..." : "\uC800\uC7A5"}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
