"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import type { ConsultationRequestDisplay, SchoolLevel } from "@/types/consultation";
import { CONSULTATION_TYPE_LABELS, SCHOOL_LEVEL_LABELS } from "@/types/consultation";

type ConsultationRequest = ConsultationRequestDisplay;

type StatusFilter = "all" | "requested" | "confirmed" | "canceled" | "done" | "no_show" | "rescheduled";

type NoteModal = {
  row: ConsultationRequest;
  nextStatus: "done" | "no_show";
};

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

function kstDateTimeToIso(date: string, hhmm: string): string | null {
  const parts = parseDateParts(date);
  if (!parts) return null;
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const utcMs = Date.UTC(parts.y, parts.m - 1, parts.d, hh - 9, mm, 0, 0);
  return new Date(utcMs).toISOString();
}

function fmt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR");
}

function statusBadgeProps(status: ConsultationRequest["status"]): {
  variant: BadgeVariant;
  label: string;
  extraClass?: string;
} {
  switch (status) {
    case "requested":   return { variant: "warning", label: "대기" };
    case "confirmed":   return { variant: "success", label: "확정" };
    case "rescheduled": return { variant: "info",    label: "일정변경" };
    case "canceled":    return { variant: "neutral",  label: "취소" };
    case "done":        return { variant: "neutral",  label: "완료 ✓", extraClass: "!border-[var(--text)]/30 !text-[var(--text)]" };
    case "no_show":     return { variant: "danger",   label: "불참" };
    default:            return { variant: "neutral",  label: status };
  }
}

type SchoolLevelFilter = "" | SchoolLevel;
type LinkStatusFilter = "" | "linked" | "manual_only";

function schoolLevelBadgeProps(level: SchoolLevel | null): {
  variant: BadgeVariant;
  label: string;
  extraClass?: string;
} | null {
  switch (level) {
    case "elementary": return { variant: "warning", label: "초등" };
    case "middle":     return { variant: "info",    label: "중등" };
    case "high":       return { variant: "neutral", label: "고등", extraClass: "!bg-purple-100 !text-purple-700 !border-purple-300 dark:!bg-purple-900/30 dark:!text-purple-300 dark:!border-purple-700" };
    default:           return null;
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text)]">{value}</span>
    </div>
  );
}

const RESCHEDULE_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 9; h < 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

export default function OwnerConsultRequestsPage() {
  const router = useRouter();
  const [focusId, setFocusId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInboxLink, setShowInboxLink] = useState(false);
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [ownerNotes, setOwnerNotes] = useState<Record<string, string>>({});
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [schoolLevelFilter, setSchoolLevelFilter] = useState<SchoolLevelFilter>("");
  const [gradeFilter, setGradeFilter] = useState<number | "">("");
  const [linkStatusFilter, setLinkStatusFilter] = useState<LinkStatusFilter>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const didApplyFocusFilterReset = useRef(false);

  // Note required modal state
  const [noteModal, setNoteModal] = useState<NoteModal | null>(null);
  const [noteModalText, setNoteModalText] = useState("");
  const [noteFollowupNeeded, setNoteFollowupNeeded] = useState(false);

  // Reschedule state
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isRescheduleBusy, setIsRescheduleBusy] = useState(false);

  const requestedCount = useMemo(
    () => requests.filter((row) => row.status === "requested").length,
    [requests]
  );

  const availableGrades = useMemo(() => {
    const gradeSet = new Set<number>();
    requests.forEach((row) => {
      if (schoolLevelFilter && row.school_level !== schoolLevelFilter) return;
      if (row.grade !== null) gradeSet.add(row.grade);
    });
    return Array.from(gradeSet).sort((a, b) => a - b);
  }, [requests, schoolLevelFilter]);

  const filteredRequests = useMemo(() => {
    return requests.filter((row) => {
      const statusMatched = statusFilter === "all" || row.status === statusFilter;
      const dateMatched = !dateFilter || kstYmdFromIso(row.requested_start_at) === dateFilter;
      const schoolMatched = !schoolLevelFilter || row.school_level === schoolLevelFilter;
      const gradeMatched = gradeFilter === "" || row.grade === gradeFilter;
      const linkMatched = !linkStatusFilter || row.link_status === linkStatusFilter;
      return statusMatched && dateMatched && schoolMatched && gradeMatched && linkMatched;
    });
  }, [requests, statusFilter, dateFilter, schoolLevelFilter, gradeFilter, linkStatusFilter]);

  const detailRow = useMemo(
    () => (detailModalId ? requests.find((r) => r.id === detailModalId) ?? null : null),
    [detailModalId, requests]
  );

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
      .from("v_consultation_requests_display")
      .select("*")
      .order("requested_start_at", { ascending: false })
      .limit(50);

    if (reqError) {
      console.error("Consultation request load failed:", toPrettyErrorString(reqError), reqError);
      setError("상담 요청 목록을 불러오지 못했습니다.");
      return;
    }

    const rows = (data ?? []) as ConsultationRequest[];
    setRequests(rows);
    setOwnerNotes(
      rows.reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.owner_note ?? "";
        return acc;
      }, {})
    );
  };

  const applyStatus = async (
    row: ConsultationRequest,
    nextStatus: "confirmed" | "canceled" | "done" | "no_show" | "rescheduled",
    noteOverride?: string
  ) => {
    setError(null);
    setSuccess(null);
    setActionBusyKey(`status:${row.id}:${nextStatus}`);

    const nextOwnerNote = (noteOverride ?? ownerNotes[row.id] ?? "").trim();

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
      const isNoteRequired = combined.includes("owner_note_required");
      setError(
        isConfirmConflict
          ? "같은 시간에 이미 확정된 상담이 있습니다. 새로고침 후 다시 확인해 주세요."
          : isNoteRequired
            ? "완료/불참 처리 시에는 상담 내용 메모를 10자 이상 입력해야 합니다."
            : "상담 상태를 변경하지 못했습니다."
      );
      setActionBusyKey(null);
      return;
    }

    await loadRequests();
    setActionBusyKey(null);
    setSuccess("상담 상태를 변경했습니다.");
  };

  const handleDoneOrNoShow = (row: ConsultationRequest, nextStatus: "done" | "no_show") => {
    setNoteModalText((ownerNotes[row.id] ?? "").trim());
    setNoteFollowupNeeded(false);
    setNoteModal({ row, nextStatus });
  };

  const confirmNoteModal = () => {
    if (!noteModal) return;
    const text = noteModalText.trim();
    if (text.length < 10) return;
    const { row, nextStatus } = noteModal;
    setNoteModal(null);
    void applyStatus(row, nextStatus, text);
  };

  const applyReschedule = async (row: ConsultationRequest) => {
    if (!rescheduleDate || !rescheduleTime) {
      setError("날짜와 시간을 모두 선택해 주세요.");
      return;
    }
    const newIso = kstDateTimeToIso(rescheduleDate, rescheduleTime);
    if (!newIso) {
      setError("일시 처리에 실패했습니다.");
      return;
    }
    setError(null);
    setSuccess(null);
    setIsRescheduleBusy(true);

    const { error: updateError } = await supabase
      .from("consultation_requests")
      .update({ status: "rescheduled", requested_start_at: newIso })
      .eq("id", row.id);

    setIsRescheduleBusy(false);

    if (updateError) {
      console.error("Reschedule failed:", toPrettyErrorString(updateError), updateError);
      setError("일정 변경에 실패했습니다.");
      return;
    }

    setRescheduleId(null);
    setRescheduleDate("");
    setRescheduleTime("");
    await loadRequests();
    setSuccess("일정이 변경됐습니다. 학부모에게 알림이 발송됩니다.");
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

      if (row.student_id) {
        const { error: targetError } = await supabase.from("announcement_targets").insert({
          announcement_id: inserted.id,
          target_type: "student",
          student_id: row.student_id,
        });
        if (targetError) throw targetError;
      }

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
      subtitle="최신 상담 요청을 상태별로 확인하고 처리합니다."
      maxWidthClassName="max-w-5xl"
      actions={<HomeLink fallbackHref="/owner" />}
    >
      {/* ── Note required modal overlay ── */}
      {noteModal && (() => {
        const trimmedLength = noteModalText.trim().length;
        const isValid = trimmedLength >= 10;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
              <h2 className="text-base font-semibold text-[var(--text)]">
                상담 {noteModal.nextStatus === "done" ? "완료" : "불참"} 처리
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                상담 내용과 후속조치를 간단히 기록해주세요. (필수, 10자 이상)
              </p>
              <textarea
                className="mt-4 min-h-32 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="예: 학습 진도 점검 / 다음 달 추가 수업 안내 / 학부모 추가 문의 응대 완료"
                value={noteModalText}
                onChange={(e) => setNoteModalText(e.target.value)}
                rows={5}
                minLength={10}
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <div className="mt-1 flex justify-end text-[11px] text-[var(--text-muted)]">
                {isValid ? (
                  <span className="text-green-500">✓ 입력 완료 ({trimmedLength}자)</span>
                ) : (
                  <span>최소 10자 / 현재 {trimmedLength}자</span>
                )}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)]"
                  checked={noteFollowupNeeded}
                  onChange={(e) => setNoteFollowupNeeded(e.target.checked)}
                />
                <span>📋 후속 조치 필요 (다음 상담 / 추가 안내 등)</span>
              </label>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                  onClick={() => setNoteModal(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
                  onClick={confirmNoteModal}
                  disabled={!isValid}
                >
                  {noteModal.nextStatus === "done" ? "완료 처리하기" : "불참 처리하기"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Detail modal overlay ── */}
      {detailRow && (() => {
        const dbadge = statusBadgeProps(detailRow.status);
        const name = detailRow.student_name ?? "-";
        const schoolLevel = detailRow.school_level ? SCHOOL_LEVEL_LABELS[detailRow.school_level] : "-";
        const grade = detailRow.grade !== null ? `${detailRow.grade}학년` : "-";
        const classLabel = detailRow.class_label?.trim() ? `${detailRow.class_label.trim()}반` : "-";
        const isNoteBusy = actionBusyKey === `note:${detailRow.id}`;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-base font-semibold text-[var(--text)]">상담 요청 상세</h2>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--card-soft)] hover:text-[var(--text)]"
                  onClick={() => setDetailModalId(null)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Datetime + status */}
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    📅 {fmt(detailRow.requested_start_at)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant={dbadge.variant} className={dbadge.extraClass ?? ""}>{dbadge.label}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">{detailRow.duration_min}분</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {CONSULTATION_TYPE_LABELS[detailRow.type]} 상담
                    </span>
                  </div>
                </div>

                {/* 학생 정보 */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">학생 정보</p>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 space-y-1.5 text-sm">
                    <DetailRow label="이름" value={name} />
                    <DetailRow label="학교급" value={schoolLevel} />
                    <DetailRow label="학년" value={grade} />
                    <DetailRow label="반" value={classLabel} />
                    <DetailRow label="학번" value={detailRow.student_no?.trim() || "-"} />
                  </div>
                </div>

                {/* 학부모 정보 */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">학부모 정보</p>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm">
                    <DetailRow label="연락처" value={detailRow.guardian_contact ?? "-"} />
                  </div>
                </div>

                {/* 상담 내용 */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">상담 내용</p>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text-muted)] whitespace-pre-wrap">
                    {detailRow.consultation_content?.trim() || "(비어있음)"}
                  </div>
                </div>

                {/* 원장 메모 */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">원장 메모</p>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="상담 후기, 다음 안내 사항 등을 기록하세요."
                    value={ownerNotes[detailRow.id] ?? ""}
                    onChange={(e) =>
                      setOwnerNotes((prev) => ({ ...prev, [detailRow.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text-muted)] disabled:opacity-60 hover:text-[var(--text)]"
                    onClick={() => void saveOwnerNote(detailRow)}
                    disabled={isNoteBusy}
                  >
                    {isNoteBusy ? "저장 중..." : "메모 저장"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Main card ── */}
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
        {requestedCount > 0 && (
          <div className="mb-4 flex items-center gap-4 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-4">
            <span className="text-4xl font-bold tracking-tight text-[var(--accent)]">{requestedCount}</span>
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">건의 상담 요청이 대기 중입니다.</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">아직 처리되지 않은 요청을 확인하고 확정 또는 취소해 주세요.</p>
            </div>
          </div>
        )}

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

        {/* Filters — row 1: status + date */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">전체 상태</option>
            <option value="requested">대기</option>
            <option value="confirmed">확정</option>
            <option value="rescheduled">일정변경</option>
            <option value="done">완료</option>
            <option value="no_show">불참</option>
            <option value="canceled">취소</option>
          </select>
          <input
            type="date"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {/* Filters — row 2: school level + grade + link status */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            value={schoolLevelFilter}
            onChange={(e) => {
              setSchoolLevelFilter(e.target.value as SchoolLevelFilter);
              setGradeFilter("");
            }}
          >
            <option value="">전체 학교급</option>
            <option value="elementary">초등</option>
            <option value="middle">중등</option>
            <option value="high">고등</option>
          </select>
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
          >
            <option value="">전체 학년</option>
            {availableGrades.map((g) => (
              <option key={g} value={g}>{g}학년</option>
            ))}
          </select>
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            value={linkStatusFilter}
            onChange={(e) => setLinkStatusFilter(e.target.value as LinkStatusFilter)}
          >
            <option value="">전체 연결 상태</option>
            <option value="linked">프로필 연결</option>
            <option value="manual_only">수동 등록</option>
          </select>
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
              setSchoolLevelFilter("");
              setGradeFilter("");
              setLinkStatusFilter("");
            }}
          >
            필터 초기화
          </button>
        </div>

        {/* Request list */}
        <div className="mt-6 space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
              {requests.length === 0 ? "상담 요청이 없습니다." : "현재 필터에 맞는 상담 요청이 없습니다."}
            </div>
          ) : (
            filteredRequests.map((row) => {
              const badge = statusBadgeProps(row.status);
              const schoolBadge = schoolLevelBadgeProps(row.school_level);
              const typeLabel = CONSULTATION_TYPE_LABELS[row.type];

              const isRequested = row.status === "requested";
              const isConfirmed = row.status === "confirmed";
              const isRescheduled = row.status === "rescheduled";
              const isTerminal = row.status === "done" || row.status === "canceled" || row.status === "no_show";
              const isRescheduling = rescheduleId === row.id;

              const isConfirmBusy = actionBusyKey === `status:${row.id}:confirmed`;
              const isCancelBusy = actionBusyKey === `status:${row.id}:canceled`;
              const isDoneBusy = actionBusyKey === `status:${row.id}:done`;
              const isNoShowBusy = actionBusyKey === `status:${row.id}:no_show`;
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
                    {/* Left: info */}
                    <div className="min-w-0 flex-1">
                      {/* Header row: datetime + status + duration */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text)]">{fmt(row.requested_start_at)}</h3>
                        <Badge variant={badge.variant} className={badge.extraClass ?? ""}>{badge.label}</Badge>
                        <span className="text-xs text-[var(--text-muted)]">{row.duration_min}분</span>
                      </div>

                      {/* School level + link status badges */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {schoolBadge && (
                          <Badge variant={schoolBadge.variant} className={schoolBadge.extraClass ?? ""}>
                            {schoolBadge.label}
                          </Badge>
                        )}
                        {row.link_status === "linked" ? (
                          <Badge variant="success">프로필 연결됨</Badge>
                        ) : row.link_status === "manual_only" ? (
                          <Badge variant="neutral">수동 등록</Badge>
                        ) : null}
                      </div>

                      {/* Detail lines */}
                      <div className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
                        <div className="flex items-baseline gap-1">
                          <span>👤</span>
                          <span className="font-semibold text-[var(--text)]">{row.student_name ?? "이름 미상"}</span>
                          {row.student_info_display ? (
                            <span className="text-xs">· {row.student_info_display}</span>
                          ) : null}
                        </div>
                        <div>📞 학부모: {row.guardian_contact ?? "연락처 없음"}</div>
                        <div>💬 {typeLabel} 상담 · {row.duration_min}분</div>
                        {row.consultation_content?.trim() ? (
                          <div>📝 {row.consultation_content}</div>
                        ) : null}
                      </div>
                    </div>

                    {/* Right: action buttons */}
                    <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[220px]">
                      {/* 확정 / 취소 — requested only */}
                      {isRequested && (
                        <>
                          <button
                            className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
                            onClick={() => void applyStatus(row, "confirmed")}
                            disabled={isConfirmBusy}
                          >
                            {isConfirmBusy ? "처리 중..." : "확정"}
                          </button>
                          <button
                            className="w-full rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)] disabled:opacity-60"
                            onClick={() => void applyStatus(row, "canceled")}
                            disabled={isCancelBusy}
                          >
                            {isCancelBusy ? "처리 중..." : "취소/반려"}
                          </button>
                        </>
                      )}

                      {/* 일정 변경 — confirmed or rescheduled */}
                      {(isConfirmed || isRescheduled) && (
                        <button
                          className="w-full rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent)] disabled:opacity-60"
                          onClick={() => {
                            if (isRescheduling) {
                              setRescheduleId(null);
                            } else {
                              setRescheduleId(row.id);
                              setRescheduleDate("");
                              setRescheduleTime("");
                            }
                          }}
                        >
                          {isRescheduling ? "일정 변경 닫기" : "일정 변경"}
                        </button>
                      )}

                      {/* 완료 처리 — non-terminal */}
                      {!isTerminal && (
                        <button
                          className="w-full rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)] disabled:opacity-60"
                          onClick={() => handleDoneOrNoShow(row, "done")}
                          disabled={isDoneBusy}
                        >
                          {isDoneBusy ? "처리 중..." : "완료 처리"}
                        </button>
                      )}

                      {/* 노쇼 처리 — confirmed only */}
                      {isConfirmed && (
                        <button
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
                          onClick={() => handleDoneOrNoShow(row, "no_show")}
                          disabled={isNoShowBusy}
                        >
                          {isNoShowBusy ? "처리 중..." : "노쇼 처리"}
                        </button>
                      )}

                      {/* 요약 알림 */}
                      <button
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60"
                        onClick={() => void sendSummaryAnnouncement(row)}
                        disabled={isSummaryBusy}
                      >
                        {isSummaryBusy ? "발송 중..." : "요약 알림 보내기"}
                      </button>

                      {/* 상세/메모 열기 */}
                      <button
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm text-[var(--text)]"
                        onClick={() => setDetailModalId(row.id)}
                      >
                        메모/처리 열기
                      </button>
                    </div>
                  </div>

                  {/* ── Reschedule panel ── */}
                  {isRescheduling && (
                    <div className="mt-4 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
                      <p className="mb-3 text-sm font-medium text-[var(--text)]">새 상담 일정 선택</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-[var(--text-muted)]">날짜</label>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-[var(--text-muted)]">시간 (KST)</label>
                          <select
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            value={rescheduleTime}
                            onChange={(e) => setRescheduleTime(e.target.value)}
                          >
                            <option value="">시간 선택</option>
                            {RESCHEDULE_TIME_SLOTS.map((slot) => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
                          onClick={() => void applyReschedule(row)}
                          disabled={isRescheduleBusy || !rescheduleDate || !rescheduleTime}
                        >
                          {isRescheduleBusy ? "처리 중..." : "일정 변경 확정"}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                          onClick={() => setRescheduleId(null)}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </PageShell>
  );
}
