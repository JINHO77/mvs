"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import PasswordChangeCard from "@/components/account/PasswordChangeCard";
import { supabase } from "@/lib/supabaseClient";

type PageState = "loading" | "ready";

type ProfileRow = {
  id: string;
  role: string | null;
  name: string | null;
  email: string | null;
};

type LinkedStudent = {
  id: string;
  name: string | null;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
};

const LEVEL_LABELS: Record<string, string> = {
  elementary: "초등",
  middle: "중등",
  high: "고등",
};

function levelLabel(level: string | null): string {
  if (!level) return "";
  return LEVEL_LABELS[level] ?? level;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function formatStudentLine(student: LinkedStudent): string {
  const parts: string[] = [];
  const lvl = levelLabel(student.school_level);
  if (lvl) parts.push(lvl);
  if (typeof student.grade === "number") parts.push(`${student.grade}학년`);
  if (student.class_label) parts.push(student.class_label);
  return parts.join(" · ");
}

export default function ParentAccountPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [students, setStudents] = useState<LinkedStudent[]>([]);

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
      setPageError("내 정보를 불러오지 못했어요.");
      setPageState("ready");
      return;
    }

    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    setAuthEmail(session.user.email ?? null);
    setJoinedAt(session.user.created_at ?? null);

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("id, role, name, email")
      .eq("id", session.user.id)
      .maybeSingle<ProfileRow>();

    if (meError) {
      setPageError("내 정보를 불러오지 못했어요.");
      setPageState("ready");
      return;
    }

    if ((me?.role ?? "") !== "parent") {
      router.replace("/");
      return;
    }

    setProfile(me);

    const { data: links, error: linksError } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_id", session.user.id)
      .returns<Array<{ student_id: string | null }>>();

    if (linksError) {
      setPageError("연결된 자녀 정보를 불러오지 못했어요.");
      setPageState("ready");
      return;
    }

    const linkedIds = Array.from(
      new Set(
        (links ?? [])
          .map((row) => row.student_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    if (linkedIds.length > 0) {
      const { data: studentRows, error: studentsError } = await supabase
        .from("profiles")
        .select("id, name, school_level, grade, class_label")
        .in("id", linkedIds)
        .returns<LinkedStudent[]>();

      if (studentsError) {
        setPageError("연결된 자녀 정보를 불러오지 못했어요.");
        setPageState("ready");
        return;
      }

      setStudents(studentRows ?? []);
    } else {
      setStudents([]);
    }

    setPageState("ready");
  };

  if (pageState === "loading") {
    return <PageShell maxWidthClassName="max-w-3xl">로딩 중...</PageShell>;
  }

  return (
    <PageShell
      title="👤 내 정보"
      subtitle="계정 정보와 비밀번호를 관리해요."
      maxWidthClassName="max-w-3xl"
    >
      {pageError && (
        <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
          {pageError}
        </div>
      )}

      <SectionCard header="기본 정보" description="회원 가입 시 등록한 정보예요.">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
            <dt className="text-xs text-[var(--text-muted)]">이메일</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">
              {authEmail ?? profile?.email ?? "-"}
            </dd>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
            <dt className="text-xs text-[var(--text-muted)]">이름</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">{profile?.name ?? "-"}</dd>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
            <dt className="text-xs text-[var(--text-muted)]">역할</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">학부모</dd>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
            <dt className="text-xs text-[var(--text-muted)]">가입일</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">{formatDate(joinedAt)}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        header="👨‍👩‍👧 연결된 자녀"
        description="자녀 추가 연결은 학부모 홈에서 6자리 코드로 진행해요."
      >
        {students.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">연결된 자녀가 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {students.map((student) => {
              const meta = formatStudentLine(student);
              return (
                <li
                  key={student.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3"
                >
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {student.name ?? "이름 미설정"}
                  </span>
                  {meta && <span className="text-xs text-[var(--text-muted)]">{meta}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <PasswordChangeCard />
    </PageShell>
  );
}
