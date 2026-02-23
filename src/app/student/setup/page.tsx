"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SchoolLevel = "elem" | "mid" | "high";
type PageState = "loading" | "ready";

type ProfileRow = {
  id: string;
  role: string;
  name: string | null;
  school_level: SchoolLevel | null;
  grade: number | null;
  class_label: string | null;
};

export default function StudentSetupPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | "">("");
  const [grade, setGrade] = useState<number | "">("");
  const [classLabel, setClassLabel] = useState("");

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setPageError(null);

    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setPageError(`���� Ȯ�� ����: ${sessionError.message}`);
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
      .select("id, role, name, school_level, grade, class_label")
      .eq("id", session.user.id)
      .single<ProfileRow>();

    if (meError) {
      setPageError(`������ ��ȸ ����: ${meError.message}`);
      setPageState("ready");
      return;
    }

    if (me.role !== "student") {
      router.replace("/");
      return;
    }

    setName(me.name ?? "");
    setSchoolLevel(me.school_level ?? "");
    setGrade(typeof me.grade === "number" ? me.grade : "");
    setClassLabel(me.class_label ?? "");

    setPageState("ready");
  };

  const gradeOptions = schoolLevel === "elem" ? [1, 2, 3, 4, 5, 6] : schoolLevel ? [1, 2, 3] : [];

  const handleSchoolLevelChange = (value: SchoolLevel | "") => {
    setSchoolLevel(value);
    if (!value) {
      setGrade("");
      return;
    }

    const nextOptions = value === "elem" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
    if (!nextOptions.includes(Number(grade))) {
      setGrade("");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const trimmedClassLabel = classLabel.trim();

    if (!trimmedName) {
      setSubmitError("�̸��� �Է��� �ּ���.");
      return;
    }

    if (!schoolLevel) {
      setSubmitError("�б����� ������ �ּ���.");
      return;
    }

    if (!gradeOptions.includes(Number(grade))) {
      setSubmitError("�г��� �ùٸ��� ������ �ּ���.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        router.replace(isDevMode ? "/dev-login" : "/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name: trimmedName,
          school_level: schoolLevel,
          grade: Number(grade),
          class_label: trimmedClassLabel || null,
        })
        .eq("id", data.session.user.id);

      if (updateError) {
        setSubmitError(`���� ����: ${updateError.message}`);
        return;
      }

      setSuccessMessage("�������� ����Ǿ����ϴ�. ��� �� Ȩ���� �̵��մϴ�.");
      setTimeout(() => {
        router.replace("/");
      }, 500);
    } finally {
      setSaving(false);
    }
  };

  if (pageState === "loading") {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">�ε� ��...</main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> �л� ������ ����
        </h1>
        <p className="mt-2 text-sm text-[#B8B8C3]">�н� ������ ���� �⺻ ������ �Է��� �ּ���.</p>

        {pageError && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{pageError}</div>
        )}

        {submitError && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{submitError}</div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-xl border border-[#2D5E41] bg-[#14261B] p-3 text-sm text-[#A6F4C5]">{successMessage}</div>
        )}

        {!pageError && (
          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <label className="block space-y-2">
              <span className="text-sm text-[#D5D5DD]">�̸� *</span>
              <input
                className="w-full rounded-xl border border-[#2A2A35] bg-[#0B0B0E] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="�̸�"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[#D5D5DD]">�б��� *</span>
              <select
                className="w-full rounded-xl border border-[#2A2A35] bg-[#0B0B0E] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
                value={schoolLevel}
                onChange={(e) => handleSchoolLevelChange((e.target.value as SchoolLevel) || "")}
                required
              >
                <option value="">����</option>
                <option value="elem">��</option>
                <option value="mid">��</option>
                <option value="high">��</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[#D5D5DD]">�г� *</span>
              <select
                className="w-full rounded-xl border border-[#2A2A35] bg-[#0B0B0E] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37] disabled:opacity-60"
                value={grade}
                onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
                required
                disabled={!schoolLevel}
              >
                <option value="">����</option>
                {gradeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[#D5D5DD]">�� (����)</span>
              <input
                className="w-full rounded-xl border border-[#2A2A35] bg-[#0B0B0E] px-3 py-2 text-[#F5F5F7] outline-none focus:border-[#D4AF37]"
                value={classLabel}
                onChange={(e) => setClassLabel(e.target.value)}
                placeholder="��: 3��"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#D4AF37] px-4 py-2 font-semibold text-black disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "���� ��..." : "�����ϱ�"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
