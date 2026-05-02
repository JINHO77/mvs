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
  academy_id: string | null;
};

type AcademyRow = {
  id: string;
  name: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "원장",
  teacher: "선생님",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function OwnerAccountPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [academy, setAcademy] = useState<AcademyRow | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);

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
      .select("id, role, name, email, academy_id")
      .eq("id", session.user.id)
      .maybeSingle<ProfileRow>();

    if (meError) {
      setPageError("내 정보를 불러오지 못했어요.");
      setPageState("ready");
      return;
    }

    const role = (me?.role ?? "").trim();
    if (role !== "owner" && role !== "teacher") {
      router.replace("/");
      return;
    }

    setProfile(me);

    if (me?.academy_id) {
      const { data: academyRow, error: academyError } = await supabase
        .from("academies")
        .select("id, name")
        .eq("id", me.academy_id)
        .maybeSingle<AcademyRow>();

      if (!academyError) {
        setAcademy(academyRow ?? null);
      }
    }

    setPageState("ready");
  };

  if (pageState === "loading") {
    return <PageShell maxWidthClassName="max-w-3xl">로딩 중...</PageShell>;
  }

  const roleLabel = ROLE_LABELS[(profile?.role ?? "").trim()] ?? profile?.role ?? "-";

  return (
    <PageShell
      title="👤 내 정보"
      subtitle="계정 정보와 비밀번호를 관리합니다."
      maxWidthClassName="max-w-3xl"
    >
      {pageError && (
        <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
          {pageError}
        </div>
      )}

      <SectionCard header="기본 정보" description="계정에 등록된 정보입니다.">
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
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">{roleLabel}</dd>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
            <dt className="text-xs text-[var(--text-muted)]">학원</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">{academy?.name ?? "-"}</dd>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 sm:col-span-2">
            <dt className="text-xs text-[var(--text-muted)]">가입일</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">{formatDate(joinedAt)}</dd>
          </div>
        </dl>
      </SectionCard>

      <PasswordChangeCard />
    </PageShell>
  );
}
