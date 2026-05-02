"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import GuardianInvitationCard from "@/components/student/GuardianInvitationCard";
import PasswordChangeCard from "@/components/account/PasswordChangeCard";
import { supabase } from "@/lib/supabaseClient";

type SchoolLevel = "elementary" | "middle" | "high";
type PageState = "loading" | "ready";

type ProfileRow = {
  id: string;
  role: string;
  name: string | null;
  school_level: SchoolLevel | null;
  grade: number | null;
  class_label: string | null;
};

const FIELD_CLASS_NAME =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]";

export default function StudentSetupPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);

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

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setPageError("학생 정보를 불러오지 못했습니다.");
      setPageState("ready");
      return;
    }

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
      setPageError("학생 정보를 불러오지 못했습니다.");
      setPageState("ready");
      return;
    }

    if (me.role !== "student") {
      router.replace("/");
      return;
    }

    setStudentId(me.id);
    setName(me.name ?? "");
    setSchoolLevel(me.school_level ?? "");
    setGrade(typeof me.grade === "number" ? me.grade : "");
    setClassLabel(me.class_label ?? "");
    setPageState("ready");
  };

  const gradeOptions = schoolLevel === "elementary" ? [1, 2, 3, 4, 5, 6] : schoolLevel ? [1, 2, 3] : [];

  const handleSchoolLevelChange = (value: SchoolLevel | "") => {
    setSchoolLevel(value);
    if (!value) {
      setGrade("");
      return;
    }

    const nextOptions = value === "elementary" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
    if (!nextOptions.includes(Number(grade))) setGrade("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const trimmedClassLabel = classLabel.trim();

    if (!trimmedName) {
      setSubmitError("이름을 입력해 주세요.");
      return;
    }

    if (!schoolLevel) {
      setSubmitError("학교급을 선택해 주세요.");
      return;
    }

    if (!gradeOptions.includes(Number(grade))) {
      setSubmitError("학년을 올바르게 선택해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
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
        .eq("id", session.user.id);

      if (updateError) {
        setSubmitError("학생 정보를 저장하지 못했습니다.");
        return;
      }

      setSuccessMessage("학생 정보가 저장되었습니다. 잠시 후 홈으로 이동합니다.");
      window.setTimeout(() => router.replace("/student"), 600);
    } finally {
      setSaving(false);
    }
  };

  if (pageState === "loading") {
    return <PageShell maxWidthClassName="max-w-4xl">로딩 중...</PageShell>;
  }

  return (
    <PageShell
      title="학생 프로필 설정"
      subtitle="학습 화면에서 사용할 기본 정보를 입력해 주세요."
      maxWidthClassName="max-w-4xl"
    >
      <SectionCard
        header="기본 정보"
        description="모바일에서는 한 줄씩 입력하고, 학교급과 학년은 화면이 넓을 때 나란히 볼 수 있습니다."
      >
        {pageError && (
          <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            {pageError}
          </div>
        )}

        {submitError && (
          <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            {submitError}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 text-sm text-[var(--success-text)]">
            {successMessage}
          </div>
        )}

        {!pageError && (
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <label className="block space-y-2">
              <span className="text-sm text-[var(--text-muted)]">이름</span>
              <input
                className={FIELD_CLASS_NAME}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="이름"
                required
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-[var(--text-muted)]">학교급</span>
                <select
                  className={FIELD_CLASS_NAME}
                  value={schoolLevel}
                  onChange={(event) => handleSchoolLevelChange((event.target.value as SchoolLevel) || "")}
                  required
                >
                  <option value="">선택</option>
                  <option value="elementary">초등</option>
                  <option value="middle">중등</option>
                  <option value="high">고등</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-[var(--text-muted)]">학년</span>
                <select
                  className={`${FIELD_CLASS_NAME} disabled:opacity-60`}
                  value={grade}
                  onChange={(event) => setGrade(event.target.value ? Number(event.target.value) : "")}
                  required
                  disabled={!schoolLevel}
                >
                  <option value="">선택</option>
                  {gradeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}학년
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-[var(--text-muted)]">반</span>
              <input
                className={FIELD_CLASS_NAME}
                value={classLabel}
                onChange={(event) => setClassLabel(event.target.value)}
                placeholder="예: 3반"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </form>
        )}
      </SectionCard>

      {studentId && (
        <SectionCard
          header="👨‍👩‍👧 보호자 연결"
          description="6자리 초대 코드를 발급받아 부모님께 알려드리면 자동으로 연결돼요. 코드는 7일간 유효해요."
        >
          <GuardianInvitationCard studentId={studentId} />
        </SectionCard>
      )}

      <PasswordChangeCard />
    </PageShell>
  );
}
