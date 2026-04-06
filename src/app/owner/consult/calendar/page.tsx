"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { TEXT } from "@/constants/text.ko";
import { buildTimeSlots, isoToKstHm, kstDateTimeToIso } from "@/lib/consultSlots";
import { supabase } from "@/lib/supabaseClient";

type PageState = "loading" | "ready";

type RequestRow = {
  id: string;
  requested_start_at: string;
  status: "requested" | "confirmed" | "done" | "canceled" | "no_show";
  student_id: string | null;
  guardian_id: string | null;
  type: "phone" | "in_person" | string | null;
  manual_consultation_content: string | null;
};

type BlockedRow = {
  id: string;
  start_at: string;
  end_at: string;
};

type ProfileBasic = {
  id: string;
  name: string | null;
  email: string | null;
};

function getTodayKstDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function getStatusBadgeLabel(status: RequestRow["status"]): string {
  if (status === "requested") return TEXT.ownerCalendar.statusRequested;
  if (status === "confirmed") return TEXT.ownerCalendar.statusConfirmed;
  if (status === "done") return "완료";
  if (status === "no_show") return "노쇼";
  return "취소";
}

function getTypeOrSummary(row: RequestRow): string {
  const summary = row.manual_consultation_content?.trim();
  if (summary) return summary.length > 20 ? `${summary.slice(0, 20)}...` : summary;
  if (row.type === "phone") return "전화";
  if (row.type === "in_person") return "대면";
  return row.type ?? "-";
}

function getGuardianDisplay(profile: ProfileBasic | undefined): string {
  const name = profile?.name?.trim();
  if (name) return name;
  const localPart = profile?.email?.split("@")[0]?.trim();
  if (localPart) return localPart;
  return "보호자";
}

function slotStatusTone(status: "empty" | "blocked" | "requested" | "confirmed" | "canceled") {
  if (status === "requested") return "border-[var(--accent)] bg-[var(--accent-soft)]";
  if (status === "confirmed") return "border-[var(--success-text)] bg-[var(--success-bg)]";
  if (status === "blocked") return "border-[var(--border)] bg-[var(--card-soft)]";
  if (status === "canceled") return "border-[var(--border)] bg-[var(--card-soft)]";
  return "border-[var(--border)] bg-[var(--card)]";
}

export default function OwnerConsultCalendarPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const showDebugIds = useMemo(() => process.env.NODE_ENV === "development", []);
  const timeSlots = useMemo(() => buildTimeSlots(), []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [canAccess, setCanAccess] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKstDate);
  const [slotLoading, setSlotLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [requestsByTime, setRequestsByTime] = useState<Record<string, RequestRow>>({});
  const [requestedInboxRows, setRequestedInboxRows] = useState<RequestRow[]>([]);
  const [blockedByTime, setBlockedByTime] = useState<Record<string, BlockedRow>>({});
  const [profileMap, setProfileMap] = useState<Record<string, ProfileBasic>>({});

  const totalRequestedCount = useMemo(
    () => Object.values(requestsByTime).filter((row) => row.status === "requested").length,
    [requestsByTime]
  );
  const totalConfirmedCount = useMemo(
    () => Object.values(requestsByTime).filter((row) => row.status === "confirmed" || row.status === "done").length,
    [requestsByTime]
  );
  const totalBlockedCount = useMemo(() => Object.keys(blockedByTime).length, [blockedByTime]);
  const operatingHours = useMemo(() => {
    if (timeSlots.length === 0) return "-";
    return `${timeSlots[0]} ~ ${timeSlots[timeSlots.length - 1]}`;
  }, [timeSlots]);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevMode]);

  useEffect(() => {
    if (!canAccess) return;
    setSelectedSlot(null);
    setActionMessage(null);
    void loadSlotsByDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, selectedDate]);

  const selectedRequest = selectedSlot ? requestsByTime[selectedSlot] : null;
  const selectedBlocked = selectedSlot ? blockedByTime[selectedSlot] : null;
  const selectedStudentProfile = selectedRequest?.student_id ? profileMap[selectedRequest.student_id] : undefined;
  const selectedGuardianProfile = selectedRequest?.guardian_id ? profileMap[selectedRequest.guardian_id] : undefined;
  const selectedStudentName = selectedStudentProfile?.name?.trim() || "학생";
  const selectedGuardianName = getGuardianDisplay(selectedGuardianProfile);
  const selectedSummary = selectedRequest ? getTypeOrSummary(selectedRequest) : null;
  const selectedBadgeLabel = selectedRequest
    ? getStatusBadgeLabel(selectedRequest.status)
    : selectedBlocked
      ? TEXT.ownerCalendar.statusBlocked
      : TEXT.common.empty;

  const selectedStatus: "blocked" | "requested" | "confirmed" | "canceled" | "empty" | null = selectedSlot
    ? selectedBlocked
      ? "blocked"
      : selectedRequest?.status === "requested"
        ? "requested"
        : selectedRequest?.status === "confirmed" || selectedRequest?.status === "done"
          ? "confirmed"
          : selectedRequest?.status === "canceled" || selectedRequest?.status === "no_show"
            ? "canceled"
            : "empty"
    : null;

  const initialize = async () => {
    setError(null);
    setAccessDenied(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setError("상담 일정을 불러오지 못했습니다.");
      setPageState("ready");
      return;
    }

    if (!user) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>();

    if (roleError) {
      setError("권한을 확인하지 못했습니다.");
      setPageState("ready");
      return;
    }

    if (!me) {
      setAccessDenied("프로필을 찾을 수 없습니다.");
      setPageState("ready");
      return;
    }

    if (me.role !== "owner" && me.role !== "teacher") {
      setAccessDenied("접근 권한이 없습니다.");
      setPageState("ready");
      return;
    }

    setCanAccess(true);
    setPageState("ready");
  };

  const loadSlotsByDate = async (date: string) => {
    setSlotLoading(true);
    setError(null);

    try {
      const nextDate = shiftDate(date, 1);
      const startIso = kstDateTimeToIso(date, "00:00");
      const endIso = kstDateTimeToIso(nextDate, "00:00");

      if (!startIso || !endIso) throw new Error("invalid date");

      const [requestsRes, blockedRes] = await Promise.all([
        supabase
          .from("consultation_requests")
          .select("id,requested_start_at,status,student_id,guardian_id,type,manual_consultation_content")
          .in("status", ["requested", "confirmed", "done", "canceled", "no_show"])
          .gte("requested_start_at", startIso)
          .lt("requested_start_at", endIso)
          .returns<RequestRow[]>(),
        supabase
          .from("consultation_blocked_slots")
          .select("id,start_at,end_at")
          .gte("start_at", startIso)
          .lt("start_at", endIso)
          .returns<BlockedRow[]>(),
      ]);

      if (requestsRes.error) throw requestsRes.error;
      if (blockedRes.error) throw blockedRes.error;

      const requestRows = requestsRes.data ?? [];
      const requestProfileIds = Array.from(
        new Set(
          requestRows.flatMap((row) => {
            const ids: string[] = [];
            if (row.student_id) ids.push(row.student_id);
            if (row.guardian_id) ids.push(row.guardian_id);
            return ids;
          })
        )
      );

      let nextProfileMap: Record<string, ProfileBasic> = {};
      if (requestProfileIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id,name,email")
          .in("id", requestProfileIds)
          .returns<ProfileBasic[]>();

        if (profilesError) throw profilesError;

        nextProfileMap = (profiles ?? []).reduce<Record<string, ProfileBasic>>((acc, row) => {
          acc[row.id] = row;
          return acc;
        }, {});
      }

      const nextRequestsByTime: Record<string, RequestRow> = {};
      const nextRequestedInboxRows = requestRows
        .filter((row) => row.status === "requested")
        .sort((a, b) => new Date(a.requested_start_at).getTime() - new Date(b.requested_start_at).getTime());

      for (const row of requestRows) {
        const slot = isoToKstHm(row.requested_start_at);
        const existing = nextRequestsByTime[slot];
        if (!existing) {
          nextRequestsByTime[slot] = row;
          continue;
        }

        const priority: Record<RequestRow["status"], number> = {
          requested: 0,
          confirmed: 1,
          done: 2,
          canceled: 3,
          no_show: 4,
        };

        if (priority[row.status] < priority[existing.status]) nextRequestsByTime[slot] = row;
      }

      const nextBlockedByTime: Record<string, BlockedRow> = {};
      for (const row of blockedRes.data ?? []) {
        nextBlockedByTime[isoToKstHm(row.start_at)] = row;
      }

      setRequestsByTime(nextRequestsByTime);
      setRequestedInboxRows(nextRequestedInboxRows);
      setBlockedByTime(nextBlockedByTime);
      setProfileMap(nextProfileMap);
    } catch {
      setError("해당 날짜의 상담 일정을 불러오지 못했습니다.");
      setRequestsByTime({});
      setRequestedInboxRows([]);
      setBlockedByTime({});
      setProfileMap({});
    } finally {
      setSlotLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: "confirmed" | "canceled" | "done" | "no_show") => {
    setActionMessage(null);
    setError(null);
    setActionBusyKey(`request:${requestId}:${status}`);

    const { error: updateError } = await supabase
      .from("consultation_requests")
      .update({ status })
      .eq("id", requestId);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "같은 시간에 이미 확정된 상담이 있습니다. 새로고침 후 다시 시도해 주세요."
          : "상담 상태를 변경하지 못했습니다."
      );
      setActionBusyKey(null);
      return;
    }

    await loadSlotsByDate(selectedDate);
    setActionBusyKey(null);
    setActionMessage("상담 상태를 변경했습니다.");
  };

  const blockSlot = async (slot: string) => {
    const startIso = kstDateTimeToIso(selectedDate, slot);
    if (!startIso) {
      setError("시간을 처리하지 못했습니다.");
      return;
    }

    const endIso = new Date(new Date(startIso).getTime() + 30 * 60 * 1000).toISOString();
    setActionMessage(null);
    setError(null);
    setActionBusyKey(`block:${slot}`);

    const { error: insertError } = await supabase.from("consultation_blocked_slots").insert({
      start_at: startIso,
      end_at: endIso,
    });

    if (insertError) {
      setError("해당 시간을 잠그지 못했습니다.");
      setActionBusyKey(null);
      return;
    }

    await loadSlotsByDate(selectedDate);
    setActionBusyKey(null);
    setActionMessage("시간을 잠금 처리했습니다.");
  };

  const unblockSlot = async (blockedId: string, slot: string) => {
    setActionMessage(null);
    setError(null);
    setActionBusyKey(`unblock:${slot}`);

    const { error: deleteError } = await supabase
      .from("consultation_blocked_slots")
      .delete()
      .eq("id", blockedId);

    if (deleteError) {
      setError("잠금 상태를 해제하지 못했습니다.");
      setActionBusyKey(null);
      return;
    }

    await loadSlotsByDate(selectedDate);
    setActionBusyKey(null);
    setActionMessage("잠금을 해제했습니다.");
  };

  if (pageState === "loading") {
    return <PageShell maxWidthClassName="max-w-6xl">Loading...</PageShell>;
  }

  return (
    <PageShell
      title={
        <>
          <span className="text-[var(--accent)]">{TEXT.ownerCalendar.label}</span> {TEXT.ownerCalendar.title}
        </>
      }
      subtitle={TEXT.ownerCalendar.subtitle}
      actions={(
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card-muted)] px-3 py-2 text-sm text-[var(--text-muted)]">
            {TEXT.ownerCalendar.hours} {operatingHours}
          </div>
          <HomeLink fallbackHref="/owner" />
        </div>
      )}
      maxWidthClassName="max-w-6xl"
    >
      {accessDenied ? (
        <SectionCard className="border-[var(--danger-text)] bg-[var(--danger-bg)] text-sm text-[var(--danger-text)] shadow-none">
          {accessDenied}
        </SectionCard>
      ) : null}

      {error ? (
        <SectionCard className="border-[var(--danger-text)] bg-[var(--danger-bg)] text-sm text-[var(--danger-text)] shadow-none">
          {error}
        </SectionCard>
      ) : null}

      {actionMessage ? (
        <SectionCard className="border-[var(--success-text)] bg-[var(--success-bg)] text-sm text-[var(--success-text)] shadow-none">
          {actionMessage}
        </SectionCard>
      ) : null}

      {canAccess ? (
        <>
          <SectionCard
            header="일정 필터"
            description="모바일에서는 날짜 이동과 요청 요약을 먼저 확인하고, 슬롯별 상세는 아래 카드에서 처리합니다."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3 text-sm font-medium sm:w-auto"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              >
                이전 날짜
              </button>
              <button
                type="button"
                className="w-full rounded-2xl border border-[var(--accent)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] sm:w-auto"
                onClick={() => setSelectedDate(getTodayKstDate())}
              >
                오늘
              </button>
              <button
                type="button"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3 text-sm font-medium sm:w-auto"
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              >
                다음 날짜
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-4 md:p-5">
                <p className="text-xs font-medium text-[var(--text-muted)]">{TEXT.ownerCalendar.kpiPending}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{totalRequestedCount}</p>
              </div>
              <div className="rounded-2xl border border-[var(--accent)] bg-[var(--card-muted)] p-4 md:p-5">
                <p className="text-xs font-medium text-[var(--text-muted)]">{TEXT.ownerCalendar.kpiConfirmed}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{totalConfirmedCount}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-4 md:p-5">
                <p className="text-xs font-medium text-[var(--text-muted)]">{TEXT.ownerCalendar.kpiBlocked}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{totalBlockedCount}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-4 md:p-5">
                <p className="text-xs font-medium text-[var(--text-muted)]">{TEXT.ownerCalendar.selectedDate}</p>
                <p className="mt-2 text-lg font-semibold tracking-tight">{selectedDate}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {TEXT.ownerCalendar.hours} {operatingHours}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard header={TEXT.ownerCalendar.inboxTitle} description={TEXT.ownerCalendar.inboxDesc}>
            {requestedInboxRows.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">{TEXT.ownerCalendar.inboxEmpty}</div>
            ) : (
              <div className="space-y-3">
                {requestedInboxRows.map((row) => {
                  const student = row.student_id ? profileMap[row.student_id] : undefined;
                  const studentName = student?.name?.trim() || "학생";
                  const slotTime = isoToKstHm(row.requested_start_at);
                  const typeLabel = row.type === "phone" ? "전화" : row.type === "in_person" ? "대면" : row.type ?? "-";
                  const summary = row.manual_consultation_content?.trim() || "-";
                  const isConfirmBusy = actionBusyKey === `request:${row.id}:confirmed`;
                  const isCancelBusy = actionBusyKey === `request:${row.id}:canceled`;

                  return (
                    <div key={row.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-4">
                      <div className="space-y-2 text-sm text-[var(--text)]">
                        <div>{studentName}</div>
                        <div className="text-[var(--text-muted)]">{slotTime} / {typeLabel}</div>
                        <div className="text-[var(--text-muted)]">요약: {summary}</div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60 sm:w-auto"
                          onClick={() => void updateRequestStatus(row.id, "confirmed")}
                          disabled={isConfirmBusy}
                        >
                          {isConfirmBusy ? "처리 중..." : TEXT.ownerCalendar.actionApprove}
                        </button>
                        <button
                          type="button"
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60 sm:w-auto"
                          onClick={() => void updateRequestStatus(row.id, "canceled")}
                          disabled={isCancelBusy}
                        >
                          {isCancelBusy ? "처리 중..." : TEXT.ownerCalendar.actionCancel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {slotLoading ? (
            <SectionCard className="bg-[var(--card-muted)] text-sm text-[var(--text-muted)]">Loading slots...</SectionCard>
          ) : null}

          <SectionCard header="시간대 목록" description="캘린더를 카드형으로 풀어 모바일에서 터치하기 쉽게 구성했습니다.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {timeSlots.map((slot) => {
                const blocked = blockedByTime[slot];
                const request = requestsByTime[slot];
                const studentProfile = request?.student_id ? profileMap[request.student_id] : undefined;
                const guardianProfile = request?.guardian_id ? profileMap[request.guardian_id] : undefined;
                const studentName = studentProfile?.name?.trim() || "학생";
                const guardianName = getGuardianDisplay(guardianProfile);
                const typeOrSummary = request ? getTypeOrSummary(request) : null;

                const status: "empty" | "blocked" | "requested" | "confirmed" | "canceled" = blocked
                  ? "blocked"
                  : request?.status === "requested"
                    ? "requested"
                    : request?.status === "confirmed" || request?.status === "done"
                      ? "confirmed"
                      : request?.status === "canceled" || request?.status === "no_show"
                        ? "canceled"
                        : "empty";

                return (
                  <div
                    key={slot}
                    className={`rounded-2xl border p-4 md:p-5 ${slotStatusTone(status)} ${selectedSlot === slot ? "ring-1 ring-[var(--accent)]" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-[var(--text-muted)]">시간</p>
                        <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">{slot}</p>
                      </div>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                        {status === "empty"
                          ? TEXT.common.empty
                          : status === "blocked"
                            ? TEXT.ownerCalendar.statusBlocked
                            : status === "requested"
                              ? TEXT.ownerCalendar.statusRequested
                              : status === "confirmed"
                                ? TEXT.ownerCalendar.statusConfirmed
                                : "취소"}
                      </span>
                    </div>

                    {request && !blocked ? (
                      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--text-muted)]">
                        <div>학생: {studentName}</div>
                        <div>보호자: {guardianName}</div>
                        <div>요약: {typeOrSummary}</div>
                        {showDebugIds ? <div>Request ID: {request.id}</div> : null}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-[var(--text-muted)]">
                        {blocked ? "잠금된 시간입니다." : "예약 또는 잠금이 없는 시간입니다."}
                      </div>
                    )}

                    <button
                      type="button"
                      className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)]"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      이 시간 보기
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {selectedSlot ? (
            <SectionCard
              header={`선택한 시간: ${selectedDate} ${selectedSlot}`}
              description="학생, 보호자, 상태를 확인하고 여기서 바로 승인·취소·잠금 처리를 진행합니다."
            >
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
                <div>학생: {selectedStudentName}</div>
                <div>보호자: {selectedGuardianName}</div>
                <div>요약: {selectedSummary ?? "-"}</div>
                <div className="mt-2">
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card-muted)] px-2.5 py-1 text-xs">
                    상태: {selectedBadgeLabel}
                  </span>
                </div>
                {showDebugIds && selectedRequest ? <div className="mt-2">Request ID: {selectedRequest.id}</div> : null}
              </div>

              {selectedStatus === "requested" && selectedRequest ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60 sm:w-auto"
                    onClick={() => void updateRequestStatus(selectedRequest.id, "confirmed")}
                    disabled={actionBusyKey === `request:${selectedRequest.id}:confirmed`}
                  >
                    {actionBusyKey === `request:${selectedRequest.id}:confirmed` ? "처리 중..." : TEXT.ownerCalendar.actionApprove}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60 sm:w-auto"
                    onClick={() => void updateRequestStatus(selectedRequest.id, "canceled")}
                    disabled={actionBusyKey === `request:${selectedRequest.id}:canceled`}
                  >
                    {actionBusyKey === `request:${selectedRequest.id}:canceled` ? "처리 중..." : TEXT.ownerCalendar.actionCancel}
                  </button>
                </div>
              ) : null}

              {selectedStatus === "confirmed" && selectedRequest ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60 sm:w-auto"
                    onClick={() => void updateRequestStatus(selectedRequest.id, "done")}
                    disabled={actionBusyKey === `request:${selectedRequest.id}:done`}
                  >
                    {actionBusyKey === `request:${selectedRequest.id}:done` ? "처리 중..." : "완료 처리"}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60 sm:w-auto"
                    onClick={() => void updateRequestStatus(selectedRequest.id, "no_show")}
                    disabled={actionBusyKey === `request:${selectedRequest.id}:no_show`}
                  >
                    {actionBusyKey === `request:${selectedRequest.id}:no_show` ? "처리 중..." : "노쇼 처리"}
                  </button>
                </div>
              ) : null}

              {selectedStatus === "blocked" && selectedBlocked ? (
                <div className="mt-4">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60 md:w-auto"
                    onClick={() => void unblockSlot(selectedBlocked.id, selectedSlot)}
                    disabled={actionBusyKey === `unblock:${selectedSlot}`}
                  >
                    {actionBusyKey === `unblock:${selectedSlot}` ? "처리 중..." : TEXT.ownerCalendar.actionUnblock}
                  </button>
                </div>
              ) : null}

              {selectedStatus === "empty" ? (
                <div className="mt-4">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] disabled:opacity-60 md:w-auto"
                    onClick={() => void blockSlot(selectedSlot)}
                    disabled={actionBusyKey === `block:${selectedSlot}`}
                  >
                    {actionBusyKey === `block:${selectedSlot}` ? "처리 중..." : TEXT.ownerCalendar.actionBlock}
                  </button>
                </div>
              ) : null}
            </SectionCard>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
