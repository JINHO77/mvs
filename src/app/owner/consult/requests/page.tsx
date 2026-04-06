"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

type ConsultationRequest = {
  id: string;
  student_id: string;
  guardian_id: string;
  requested_start_at: string;
  duration_min: number;
  type: "phone" | "in_person";
  status: "requested" | "confirmed" | "canceled" | "done" | "no_show";
  notes: string | null;
  entry_mode: string | null;
  manual_student_name: string | null;
  manual_school_level: string | null;
  manual_grade: number | null;
  manual_class_label: string | null;
  manual_student_no: string | null;
  manual_guardian_contact: string | null;
  manual_consultation_content: string | null;
  owner_note: string | null;
  created_at: string;
};

type ProfileBasic = {
  id: string;
  name: string | null;
  email: string | null;
};

type StatusFilter = "all" | "requested" | "confirmed" | "canceled" | "done" | "no_show";

function parseDateParts(date: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function kstYmdFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function kstTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

function addDaysYmd(baseYmd: string, days: number): string {
  const parts = parseDateParts(baseYmd);
  if (!parts) return baseYmd;
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getManualSchoolLevelLabel(level: string | null): string {
  if (level === "elem") return "초등";
  if (level === "mid") return "중등";
  if (level === "high") return "고등";
  return "미입력";
}

function fmt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR");
}

function statusBadgeVariant(status: ConsultationRequest["status"]) {
  if (status === "requested") return "warning" as const;
  if (status === "confirmed" || status === "done") return "success" as const;
  if (status === "canceled") return "danger" as const;
  return "neutral" as const;
}

function statusLabel(status: ConsultationRequest["status"]) {
  if (status === "requested") return "요청";
  if (status === "confirmed") return "확정";
  if (status === "canceled") return "취소";
  if (status === "done") return "완료";
  return "노쇼";
}

export default function OwnerConsultRequestsPage() {
  const router = useRouter();
  const [focusId, setFocusId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInboxLink, setShowInboxLink] = useState(false);
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileBasic>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ownerNotes, setOwnerNotes] = useState<Record<string, string>>({});
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const didApplyFocusFilterReset = useRef(false);

  const requestedCount = useMemo(
    () => requests.filter((row) => row.status === "requested").length,
    [requests]
  );

  const filteredRequests = useMemo(() => {
    return requests.filter((row) => {
      const statusMatched = statusFilter === "all" || row.status === statusFilter;
      const dateMatched = !dateFilter || kstYmdFromIso(row.requested_start_at) === dateFilter;
      return statusMatched && dateMatched;
    });
  }, [requests, statusFilter, dateFilter]);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("focus");
    setFocusId(next);
  }, []);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (didApplyFocusFilterReset.current || !focusId) return;
    if (!requests.some((row) => row.id === focusId)) return;
    setStatusFilter("all");
    setDateFilter("");
    didApplyFocusFilterReset.current = true;
  }, [focusId, requests]);

  useEffect(() => {
    if (!focusId || !requests.some((row) => row.id === focusId)) return;

    let timer: number | undefined;
    const rafId = window.requestAnimationFrame(() => {
      document.getElementById(`req-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(focusId);
      timer = window.setTimeout(() => {
        setHighlightId((prev) => (prev === focusId ? null : prev));
      }, 4000);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [focusId, requests]);

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadRequests();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh]);

  const initialize = async () => {
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError("상담 요청 목록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: me, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<{ role: string }>();

    if (roleError) {
      setError("권한을 확인하지 못했습니다.");
      setLoading(false);
      return;
    }

    if (me.role !== "owner" && me.role !== "teacher") {
      router.replace("/");
      return;
    }

    await loadRequests();
    setLoading(false);
  };

  const loadRequests = async () => {
    const { data, error: reqError } = await supabase
      .from("consultation_requests")
      .select("id,student_id,guardian_id,requested_start_at,duration_min,type,status,notes,entry_mode,manual_student_name,manual_school_level,manual_grade,manual_class_label,manual_student_no,manual_guardian_contact,manual_consultation_content,owner_note,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<ConsultationRequest[]>();

    if (reqError) {
      console.error("Consultation request load failed:", toPrettyErrorString(reqError), reqError);
      setError("상담 요청 목록을 불러오지 못했습니다.");
      return;
    }

    const rows = data ?? [];
    setRequests(rows);
    setOwnerNotes(
      rows.reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.owner_note ?? "";
        return acc;
      }, {})
    );

    const ids = Array.from(new Set(rows.flatMap((row) => [row.guardian_id, row.student_id])));
    if (ids.length === 0) {
      setProfileMap({});
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,name,email")
      .in("id", ids)
      .returns<ProfileBasic[]>();

    if (profilesError) {
      console.error("Consultation profile load failed:", toPrettyErrorString(profilesError), profilesError);
      setError("상담 대상 정보를 불러오지 못했습니다.");
      return;
    }

    setProfileMap(
      (profiles ?? []).reduce<Record<string, ProfileBasic>>((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {})
    );
  };

  const applyStatus = async (
    row: ConsultationRequest,
    nextStatus: "confirmed" | "canceled" | "done" | "no_show"
  ) => {
    setError(null);
    setSuccess(null);
    setActionBusyKey(`status:${row.id}:${nextStatus}`);

    const nextOwnerNote = (ownerNotes[row.id] ?? "").trim();

    const { error: updateError } = await supabase
      .from("consultation_requests")
      .update({
        status: nextStatus,
        owner_note: nextOwnerNote || null,
      })
      .eq("id", row.id);

    if (updateError) {
      console.error("Consultation status update failed:", toPrettyErrorString(updateError), updateError);
      const combined = `${updateError.message ?? ""} ${updateError.details ?? ""} ${updateError.hint ?? ""}`.toLowerCase();
      const isConfirmConflict =
        nextStatus === "confirmed"
        && (combined.includes("unique") || combined.includes("duplicate key") || updateError.code === "23505");
      setError(
        isConfirmConflict
          ? "같은 시간에 이미 확정된 상담이 있습니다. 새로고침 후 다시 확인해 주세요."
          : "상담 상태를 변경하지 못했습니다."
      );
      setActionBusyKey(null);
      return;
    }

    await loadRequests();
    setActionBusyKey(null);
    setSuccess("상담 상태를 변경했습니다.");
    setEditingId(null);
  };

  const saveOwnerNote = async (row: ConsultationRequest) => {
    setError(null);
    setSuccess(null);
    setActionBusyKey(`note:${row.id}`);

    const { error: updateError } = await supabase
      .from("consultation_requests")
      .update({ owner_note: (ownerNotes[row.id] ?? "").trim() || null })
      .eq("id", row.id);

    if (updateError) {
      console.error("Consultation note save failed:", toPrettyErrorString(updateError), updateError);
      setError("메모를 저장하지 못했습니다.");
      setActionBusyKey(null);
      return;
    }

    await loadRequests();
    setActionBusyKey(null);
    setSuccess("메모를 저장했습니다.");
  };

  const sendSummaryAnnouncement = async (row: ConsultationRequest) => {
    setError(null);
    setSuccess(null);
    setShowInboxLink(false);
    setActionBusyKey(`summary:${row.id}`);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Missing user");

      const defaultBody = [
        `상담 일시: ${fmt(row.requested_start_at)}`,
        "상담 요약:",
        "- ",
        "다음 안내:",
        "- ",
      ].join("\n");
      const summaryBody = row.notes?.trim() || defaultBody;

      const { data: inserted, error: insertError } = await supabase
        .from("announcements")
        .insert({
          title: "상담 요약 안내",
          body: summaryBody,
          audience_role: "parent",
          requires_ack: true,
          created_by: user.id,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError) throw insertError;
      if (!inserted?.id) throw new Error("Missing announcement id");

      const { error: targetError } = await supabase.from("announcement_targets").insert({
        announcement_id: inserted.id,
        target_type: "student",
        student_id: row.student_id,
      });

      if (targetError) throw targetError;

      setSuccess("상담 요약 알림을 발송했습니다.");
      setShowInboxLink(true);
    } catch (e: unknown) {
      console.error("Consultation summary announcement failed:", toPrettyErrorString(e), e);
      setError("상담 요약 알림을 발송하지 못했습니다.");
    } finally {
      setActionBusyKey(null);
    }
  };

  if (loading) {
    return <PageShell maxWidthClassName="max-w-5xl">로딩 중...</PageShell>;
  }

  return (
    <PageShell
      title="상담 요청 관리"
      subtitle="최신 상담 요청을 상태별로 확인하고 모바일에서도 바로 처리할 수 있습니다."
      maxWidthClassName="max-w-5xl"
      actions={<HomeLink fallbackHref="/owner" />}
    >
      <SectionCard
        header="요청 현황"
        description="상태와 날짜로 빠르게 좁혀 보고, 각 요청 카드에서 승인·반려·완료 처리를 진행하세요."
        rightSlot={(
          <button
            type="button"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] md:w-auto"
            onClick={() => setAutoRefresh((prev) => !prev)}
          >
            자동 갱신: {autoRefresh ? "켜짐" : "꺼짐"}
          </button>
        )}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]">
            요청 대기 {requestedCount}
          </span>
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
            표시 {filteredRequests.length} / 전체 {requests.length}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 text-sm text-[var(--success-text)]">
            {success}
            {showInboxLink ? (
              <>
                {" "}
                <a href="/announcements" className="underline underline-offset-2">
                  알림함 보기
                </a>
              </>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">전체 상태</option>
            <option value="requested">요청</option>
            <option value="confirmed">확정</option>
            <option value="canceled">취소</option>
            <option value="done">완료</option>
            <option value="no_show">노쇼</option>
          </select>
          <input
            type="date"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] sm:w-auto"
            onClick={() => setDateFilter(kstTodayYmd())}
          >
            오늘
          </button>
          <button
            type="button"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] sm:w-auto"
            onClick={() => setDateFilter(addDaysYmd(kstTodayYmd(), 1))}
          >
            내일
          </button>
          <button
            type="button"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] sm:w-auto"
            onClick={() => {
              setDateFilter("");
              setStatusFilter("all");
            }}
          >
            필터 초기화
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
              {requests.length === 0 ? "상담 요청이 없습니다." : "현재 필터에 맞는 상담 요청이 없습니다."}
            </div>
          ) : (
            filteredRequests.map((row) => {
              const student = profileMap[row.student_id];
              const guardian = profileMap[row.guardian_id];
              const hasResolvedStudent = !!student;
              const studentLine = hasResolvedStudent
                ? `${student?.name ?? "이름 없음"}${student?.email ? ` (${student.email})` : ""}`
                : `${getManualSchoolLevelLabel(row.manual_school_level)} ${row.manual_grade ?? "-"}학년 ${row.manual_student_name?.trim() || "이름 없음"}${row.manual_class_label?.trim() ? ` ${row.manual_class_label.trim()}반` : ""}`;
              const guardianLine = guardian?.email || row.manual_guardian_contact?.trim() || "연락처 없음";
              const contentText = row.manual_consultation_content?.trim() || row.notes?.trim() || "-";
              const isRequested = row.status === "requested";
              const isConfirmed = row.status === "confirmed";
              const isConfirmBusy = actionBusyKey === `status:${row.id}:confirmed`;
              const isCancelBusy = actionBusyKey === `status:${row.id}:canceled`;
              const isDoneBusy = actionBusyKey === `status:${row.id}:done`;
              const isNoShowBusy = actionBusyKey === `status:${row.id}:no_show`;
              const isNoteBusy = actionBusyKey === `note:${row.id}`;
              const isSummaryBusy = actionBusyKey === `summary:${row.id}`;

              return (
                <div
                  id={`req-${row.id}`}
                  key={row.id}
                  className={`rounded-2xl border bg-[var(--card)] p-4 md:p-5 lg:p-6 ${
                    highlightId === row.id ? "border-[var(--accent)]" : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text)]">{fmt(row.requested_start_at)}</h3>
                        <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
                        <span className="text-xs text-[var(--text-muted)]">{row.duration_min}분</span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
                        <div>학생: {studentLine}</div>
                        {!hasResolvedStudent && row.manual_student_no?.trim() ? <div>학번: {row.manual_student_no.trim()}</div> : null}
                        <div>학부모: {guardianLine}</div>
                        <div>유형: {row.type === "phone" ? "전화" : row.type === "in_person" ? "대면" : row.type}</div>
                        <div>상담 내용: {contentText}</div>
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[220px]">
                      {isRequested ? (
                        <>
                          <button
                            className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
                            onClick={() => void applyStatus(row, "confirmed")}
                            disabled={isConfirmBusy}
                          >
                            {isConfirmBusy ? "처리 중..." : "확정"}
                          </button>
                          <button
                            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
                            onClick={() => void applyStatus(row, "canceled")}
                            disabled={isCancelBusy}
                          >
                            {isCancelBusy ? "처리 중..." : "취소/반려"}
                          </button>
                        </>
                      ) : null}

                      {row.status !== "done" && row.status !== "canceled" && row.status !== "no_show" ? (
                        <button
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
                          onClick={() => void applyStatus(row, "done")}
                          disabled={isDoneBusy}
                        >
                          {isDoneBusy ? "처리 중..." : "완료 처리"}
                        </button>
                      ) : null}

                      {isConfirmed ? (
                        <button
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
                          onClick={() => void applyStatus(row, "no_show")}
                          disabled={isNoShowBusy}
                        >
                          {isNoShowBusy ? "처리 중..." : "노쇼 처리"}
                        </button>
                      ) : null}

                      <button
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
                        onClick={() => void sendSummaryAnnouncement(row)}
                        disabled={isSummaryBusy}
                      >
                        {isSummaryBusy ? "발송 중..." : "요약 알림 보내기"}
                      </button>

                      <button
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text)]"
                        onClick={() => setEditingId((prev) => (prev === row.id ? null : row.id))}
                      >
                        {editingId === row.id ? "메모 닫기" : "메모/처리 열기"}
                      </button>
                    </div>
                  </div>

                  {editingId === row.id ? (
                    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                      <label className="block text-sm text-[var(--text-muted)]">
                        원장 메모
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          value={ownerNotes[row.id] ?? ""}
                          onChange={(e) =>
                            setOwnerNotes((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60 md:w-auto"
                        onClick={() => void saveOwnerNote(row)}
                        disabled={isNoteBusy}
                      >
                        {isNoteBusy ? "저장 중..." : "메모 저장"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </PageShell>
  );
}
