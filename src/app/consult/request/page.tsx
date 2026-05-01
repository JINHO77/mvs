"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildTimeSlots as buildTimeSlotsShared,
  isoToKstHm as isoToKstHmShared,
  kstDateTimeToIso as kstDateTimeToIsoShared,
  loadConfirmedSlots as loadConfirmedSlotsShared,
  loadOwnerBlockedSlots as loadOwnerBlockedSlotsShared,
} from "@/lib/consultSlots";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import { getLinkedStudentCountForGuardian } from "@/lib/parentGuard";
import { supabase } from "@/lib/supabaseClient";
import SectionCard from "@/components/ui/SectionCard";

type SchoolLevel = "elementary" | "middle" | "high";
type RequestStatus = "requested" | "confirmed" | "canceled" | "cancelled" | "done" | "no_show" | "rescheduled";

type ConsultationRequest = {
  id: string;
  requested_start_at: string;
  duration_min: number;
  type: "phone" | "in_person" | "video";
  status: RequestStatus;
  priority: "urgent" | "normal" | "low" | null;
  notes: string | null;
  manual_consultation_content: string | null;
  video_link: string | null;
  reminder_sent_at: string | null;
  created_at: string;
};

type MyStudent = {
  student_id: string;
  name: string | null;
  email: string | null;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
  student_no: string | null;
};

function buildTimeSlots(): string[] {
  return buildTimeSlotsShared();
}

function parseDateParts(date: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function kstDateTimeToIso(date: string, hhmm: string): string | null {
  return kstDateTimeToIsoShared(date, hhmm);
}

function isoToKstHm(iso: string): string {
  return isoToKstHmShared(iso);
}

function nextDate(date: string): string {
  const parts = parseDateParts(date);
  if (!parts) return date;
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getDayMode(date: string): "weekday" | "sunday" | "closed" | "none" {
  const parts = parseDateParts(date);
  if (!parts) return "none";
  const weekday = new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
  if (weekday >= 1 && weekday <= 5) return "weekday";
  if (weekday === 0) return "sunday";
  return "closed";
}

function getStatusLabel(status: RequestStatus): string {
  if (status === "requested") return "\uC694\uCCAD";
  if (status === "confirmed") return "\uD655\uC815";
  if (status === "cancelled") return "\uCDE8\uC18C";
  if (status === "canceled") return "\uCDE8\uC18C";
  if (status === "done") return "\uC644\uB8CC";
  return "\uC54C \uC218 \uC5C6\uC74C";
}

function getStatusTone(status: RequestStatus): { cardClass: string; badgeClass: string } {
  if (status === "confirmed") {
    return {
      cardClass: "border-[var(--success-text)] bg-[var(--success-bg)]",
      badgeClass: "border-[var(--success-text)] bg-[var(--success-bg)] text-[var(--success-text)]",
    };
  }
  if (status === "canceled") {
    return {
      cardClass: "border-[var(--danger-text)] bg-[var(--danger-bg)]",
      badgeClass: "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
    };
  }
  if (status === "cancelled") {
    return {
      cardClass: "border-[var(--danger-text)] bg-[var(--danger-bg)]",
      badgeClass: "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
    };
  }
  if (status === "done") {
    return {
      cardClass: "border-[var(--border)] bg-[var(--card-soft)] opacity-70",
      badgeClass: "border-[var(--border)] bg-[var(--card)] text-[var(--text)]",
    };
  }
  if (status === "no_show") {
    return {
      cardClass: "border-[var(--border)] bg-[var(--card-soft)] opacity-70",
      badgeClass: "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]",
    };
  }
  if (status === "rescheduled") {
    return {
      cardClass: "border-[var(--accent)] bg-[var(--accent-soft)]",
      badgeClass: "border-[var(--accent)] bg-[var(--card)] text-[var(--accent)]",
    };
  }
  return {
    cardClass: "border-[var(--accent)] bg-[var(--accent-soft)]",
    badgeClass: "border-[var(--accent)] bg-[var(--card)] text-[var(--accent)]",
  };
}

function getTypeLabel(type: "phone" | "in_person" | "video"): string {
  if (type === "phone") return "\uC804\uD654";
  if (type === "video") return "\uD654\uC0C1";
  return "\uB300\uBA74";
}

function schoolLevelKo(level: string | null | undefined): string {
  if (level === "elementary" || level === "elem") return "초등";
  if (level === "middle" || level === "mid") return "중등";
  if (level === "high") return "고등";
  return "";
}

const STATUS_BADGE_MAP: Record<RequestStatus, { label: string; cls: string }> = {
  requested: {
    label: "요청",
    cls: "border-yellow-500/30 bg-yellow-500/20 text-yellow-300",
  },
  confirmed: {
    label: "확정",
    cls: "border-green-500/30 bg-green-500/20 text-green-300",
  },
  rescheduled: {
    label: "일정 변경",
    cls: "border-blue-500/30 bg-blue-500/20 text-blue-300",
  },
  canceled: {
    label: "취소",
    cls: "border-gray-500/30 bg-gray-500/20 text-gray-400",
  },
  cancelled: {
    label: "취소",
    cls: "border-gray-500/30 bg-gray-500/20 text-gray-400",
  },
  done: {
    label: "완료",
    cls: "border-purple-500/30 bg-purple-500/20 text-purple-300",
  },
  no_show: {
    label: "불참",
    cls: "border-red-500/30 bg-red-500/20 text-red-300",
  },
};

const IN_PROGRESS_STATUSES: RequestStatus[] = ["requested", "confirmed", "rescheduled"];

export default function ConsultRequestPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [myStudents, setMyStudents] = useState<MyStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const prevRequestsRef = useRef<ConsultationRequest[]>([]);
  const highlightTimerRef = useRef<number | null>(null);

  const [studentName, setStudentName] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | "">("");
  const [grade, setGrade] = useState<number | "">("");
  const [classLabel, setClassLabel] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [consultationContent, setConsultationContent] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [type, setType] = useState<"phone" | "in_person">("phone");
  const [confirmedSlots, setConfirmedSlots] = useState<Set<string>>(new Set());
  const [ownerBlockedSlots, setOwnerBlockedSlots] = useState<Set<string>>(new Set());

  const tomorrowStr = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }, []);

  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const dayMode = useMemo(() => getDayMode(selectedDate), [selectedDate]);
  const typeDisabled = dayMode !== "sunday";
  const showGrid = dayMode === "weekday" || dayMode === "sunday";
  const dayHint =
    dayMode === "weekday"
      ? "\uC6D4~\uAE08\uC740 10:00\u201314:00, 22:00\u201324:00 \uC804\uD654 \uC0C1\uB2F4\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      : dayMode === "sunday"
        ? "\uC77C\uC694\uC77C\uC740 \uB3D9\uC77C \uC2DC\uAC04\uB300\uC5D0 \uC804\uD654/\uB300\uBA74 \uBAA8\uB450 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
        : "";
  const bannerRequest = useMemo(() => {
    if (requests.length === 0) return null;
    const priority: Record<RequestStatus, number> = {
      confirmed: 0,
      requested: 1,
      canceled: 2,
      cancelled: 2,
      done: 3,
      no_show: 4,
      rescheduled: 1,
    };
    return [...requests].sort((a, b) => {
      const pa = priority[a.status];
      const pb = priority[b.status];
      if (pa !== pb) return pa - pb;
      return new Date(b.requested_start_at).getTime() - new Date(a.requested_start_at).getTime();
    })[0];
  }, [requests]);
  const bannerTone = useMemo(() => {
    if (!bannerRequest) return null;
    if (bannerRequest.status === "confirmed") {
      return {
        className: "border-[var(--success-text)] bg-[var(--success-bg)] text-[var(--success-text)]",
        message: "\uC0C1\uB2F4 \uC77C\uC815\uC774 \uD655\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
      };
    }
    if (bannerRequest.status === "requested") {
      return {
        className: "border-[var(--accent)] bg-[var(--card)] text-[var(--text)]",
        message: "\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4(\uB300\uAE30)",
      };
    }
    if (bannerRequest.status === "canceled") {
      return {
        className: "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
        message: "\uC0C1\uB2F4 \uC77C\uC815\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
      };
    }
    if (bannerRequest.status === "done") {
      return {
        className: "border-[var(--border)] bg-[var(--card)] text-[var(--text)]",
        message: "\uC0C1\uB2F4\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
      };
    }
    return {
      className: "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]",
      message: "\uC0C1\uD0DC \uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    };
  }, [bannerRequest]);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dayMode === "weekday" && type !== "phone") {
      setType("phone");
    }
    if (dayMode === "closed") {
      setSelectedTime("");
      setType("phone");
    }
  }, [dayMode, type]);

  useEffect(() => {
    void Promise.all([loadConfirmedSlots(selectedDate), loadOwnerBlockedSlots(selectedDate)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTime && (confirmedSlots.has(selectedTime) || ownerBlockedSlots.has(selectedTime))) setSelectedTime("");
  }, [confirmedSlots, ownerBlockedSlots, selectedTime]);

  useEffect(() => {
    if (!selectedStudentId) return;

    if (selectedStudentId === "manual") {
      setStudentName("");
      setSchoolLevel("");
      setGrade("");
      setClassLabel("");
      setStudentNo("");
      setEditMode(true);
      return;
    }

    if (myStudents.length === 0) return;
    const selected = myStudents.find((student) => student.student_id === selectedStudentId);
    if (!selected) return;

    setStudentName(selected.name ?? "");
    setSchoolLevel((selected.school_level as SchoolLevel | "") || "");
    setGrade(selected.grade ?? "");
    setClassLabel(selected.class_label ?? "");
    setStudentNo(selected.student_no ?? "");
    setEditMode(false);
  }, [selectedStudentId, myStudents]);

  const selectedChild = useMemo(
    () => myStudents.find((s) => s.student_id === selectedStudentId) ?? null,
    [myStudents, selectedStudentId]
  );

  const filteredRequests = useMemo(
    () =>
      showAllRequests
        ? requests
        : requests.filter((r) => IN_PROGRESS_STATUSES.includes(r.status)),
    [requests, showAllRequests]
  );

  const inProgressCount = useMemo(
    () => requests.filter((r) => IN_PROGRESS_STATUSES.includes(r.status)).length,
    [requests]
  );

  useEffect(() => {
    const prevMap = new Map(prevRequestsRef.current.map((row) => [row.id, row]));
    const changed = requests
      .filter((row) => {
        const prev = prevMap.get(row.id);
        return !!prev && prev.status !== row.status;
      })
      .sort(
        (a, b) =>
          new Date(b.requested_start_at).getTime() - new Date(a.requested_start_at).getTime()
      );

    if (changed.length > 0) {
      const nextId = changed[0].id;
      setHighlightRequestId(nextId);
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightRequestId((prev) => (prev === nextId ? null : prev));
      }, 4000);
    }

    prevRequestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const initialize = async () => {
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(`\uC138\uC158 \uD655\uC778 \uC2E4\uD328: ${sessionError.message}`);
      setLoading(false);
      return;
    }

    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const uid = session.user.id;

    const { data: me, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single<{ role: string }>();

    if (roleError) {
      setError(`\uAD8C\uD55C \uD655\uC778 \uC2E4\uD328: ${roleError.message}`);
      setLoading(false);
      return;
    }

    if (me.role !== "parent") {
      setError("\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      router.replace("/");
      return;
    }

    try {
      const linkedCount = await getLinkedStudentCountForGuardian(uid);
      if (linkedCount === 0) {
        router.replace("/parent/onboarding/link");
        return;
      }
    } catch (e: unknown) {
      setError(`\uC790\uB140 \uC5F0\uACB0 \uD655\uC778 \uC2E4\uD328: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
      return;
    }

    setGuardianId(uid);
    await loadMyStudents();
    await loadMyRequests(uid);
    setLoading(false);
  };

  const loadMyStudents = async () => {
    const { data, error: studentsError } = await supabase.rpc("list_my_students");
    if (studentsError) {
      setError(`\uC790\uB140 \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${studentsError.message}`);
      setMyStudents([]);
      setSelectedStudentId("");
      return;
    }

    const rows = (Array.isArray(data) ? data : []) as MyStudent[];
    setMyStudents(rows);
    if (rows.length > 0) {
      setSelectedStudentId((prev) => (prev && rows.some((row) => row.student_id === prev) ? prev : rows[0].student_id));
    } else {
      setSelectedStudentId("");
    }
  };

  const loadMyRequests = async (uid: string) => {
    const { data, error: reqError } = await supabase
      .from("consultation_requests")
      .select("id,requested_start_at,duration_min,type,status,notes,manual_consultation_content,created_at")
      .eq("guardian_id", uid)
      .order("requested_start_at", { ascending: false })
      .limit(20)
      .returns<ConsultationRequest[]>();

    if (reqError) {
      setError(`\uC694\uCCAD \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${reqError.message}`);
      return;
    }

    setRequests(data ?? []);
  };

  const loadConfirmedSlots = async (date: string): Promise<void> => {
    try {
      const next = await loadConfirmedSlotsShared(supabase, date);
      setConfirmedSlots(next);
    } catch (e: unknown) {
      setError(`\uD655\uC815 \uC2DC\uAC04 \uC870\uD68C \uC2E4\uD328: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loadOwnerBlockedSlots = async (date: string): Promise<void> => {
    try {
      const next = await loadOwnerBlockedSlotsShared(supabase, date);
      setOwnerBlockedSlots(next);
    } catch (e: unknown) {
      setError(`\uC6D0\uC7A5 \uCC28\uB2E8 \uC2DC\uAC04 \uC870\uD68C \uC2E4\uD328: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (!guardianId) {
      setError("\uB85C\uADF8\uC778 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (myStudents.length === 0) {
      setError("\uC5F0\uACB0\uB41C \uC790\uB140\uAC00 \uC5C6\uC5B4 \uC608\uC57D\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (!selectedStudentId) {
      setError("\uC608\uC57D\uD560 \uC790\uB140\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    const resolvedStudentId =
      selectedStudentId === "manual" ? myStudents[0]?.student_id ?? "" : selectedStudentId;
    if (!resolvedStudentId) {
      setError("예약할 자녀를 선택해 주세요.");
      return;
    }

    const trimmedName = studentName.trim();
    const trimmedGuardianContact = guardianContact.trim();
    const trimmedContent = consultationContent.trim();
    const normalizedGrade = Number(grade);

    if (!trimmedName) {
      setError("\uD559\uC0DD \uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    if (!schoolLevel) {
      setError("\uD559\uAD50\uAE09\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    if (!Number.isInteger(normalizedGrade) || normalizedGrade <= 0) {
      setError("\uD559\uB144\uC744 \uC62C\uBC14\uB978 \uC22B\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    if (!trimmedGuardianContact) {
      setError("\uBCF4\uD638\uC790 \uC5F0\uB77D\uCC98\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    if (!trimmedContent) {
      setError("\uC0C1\uB2F4 \uB0B4\uC6A9\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    if (!selectedDate || !selectedTime) {
      setError("\uB0A0\uC9DC\uC640 \uC2DC\uAC04\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (selectedDate <= todayStr) {
      setError("당일 예약은 불가합니다. 내일 이후 날짜를 선택해 주세요.");
      return;
    }

    if (dayMode === "closed") {
      setError("\uD604\uC7AC \uD1A0\uC694\uC77C\uC740 \uC0C1\uB2F4\uC744 \uC6B4\uC601\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      return;
    }

    const requestedStartIso = kstDateTimeToIso(selectedDate, selectedTime);
    if (!requestedStartIso) {
      setError("\uC77C\uC2DC \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("consultation_requests").insert({
        guardian_id: guardianId,
        student_id: resolvedStudentId,
        requested_start_at: requestedStartIso,
        duration_min: 30,
        type,
        status: "requested",
        entry_mode: "guardian_portal",
        manual_student_name: trimmedName,
        manual_school_level: schoolLevel,
        manual_grade: normalizedGrade,
        manual_class_label: classLabel.trim() || null,
        manual_student_no: studentNo.trim() || null,
        manual_guardian_contact: trimmedGuardianContact,
        manual_consultation_content: trimmedContent,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setStudentName("");
      setSchoolLevel("");
      setGrade("");
      setClassLabel("");
      setStudentNo("");
      setGuardianContact("");
      setConsultationContent("");
      setSelectedDate("");
      setSelectedTime("");
      setType("phone");
      setSuccess("\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");

      await loadMyRequests(guardianId);
      await loadConfirmedSlots(selectedDate);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "\uC0C1\uB2F4 \uC694\uCCAD \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelMyRequest = async (requestId: string) => {
    if (!guardianId) return;
    setError(null);
    setSuccess(null);
    setCancelingRequestId(requestId);
    try {
      const { error: updateError } = await supabase
        .from("consultation_requests")
        .update({ status: "canceled" })
        .eq("id", requestId);
      if (updateError) throw new Error(updateError.message);
      await loadMyRequests(guardianId);
      setSuccess("\uC694\uCCAD\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "\uC694\uCCAD \uCDE8\uC18C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setCancelingRequestId(null);
    }
  };

  const fmtKst = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  };

  if (loading) {
    return <PageShell maxWidthClassName="max-w-3xl">{"\uB85C\uB529 \uC911..."}</PageShell>;
  }

  return (
    <PageShell
      title={"\uC0C1\uB2F4 \uC608\uC57D \uC694\uCCAD"}
      subtitle={"\uD76C\uB9DD \uC77C\uC815\uACFC \uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uBA74 \uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC811\uC218\uB429\uB2C8\uB2E4."}
      maxWidthClassName="max-w-3xl"
      actions={<HomeLink fallbackHref="/parent" />}
    >
      <SectionCard className="mx-auto w-full max-w-3xl p-6">
        {error && (
          <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">
            {success}
          </div>
        )}

        {myStudents.length === 0 && (
          <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            <div>{"\uC5F0\uACB0\uB41C \uC790\uB140\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uC790\uB140\uB97C \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694."}</div>
            <Link
              href="/parent/students"
              className="mt-2 inline-block rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              {"\uC790\uB140 \uAD00\uB9AC\uB85C \uC774\uB3D9"}
            </Link>
          </div>
        )}

        {bannerRequest && bannerTone && (
          <div className={`mt-4 rounded-xl border p-3 text-sm ${bannerTone.className}`}>
            <div className="font-semibold">{bannerTone.message}</div>
            <div className="mt-1 text-xs opacity-90">
              {fmtKst(bannerRequest.requested_start_at)} / {getTypeLabel(bannerRequest.type)}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4">
          {myStudents.length > 0 && (
            <label className="block text-sm text-[var(--muted)]">
              {"\uC790\uB140 \uC120\uD0DD *"}
              <select
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {myStudents.map((student) => {
                  const schoolMap: Record<string, string> = { elementary: "초", middle: "중", high: "고", elem: "초", mid: "중" };
                  const school = schoolMap[student.school_level ?? ""] ?? "미입력";
                  const gradeText = student.grade != null ? `${student.grade}\uD559\uB144` : "\uBBF8\uC785\uB825";
                  const nameText = student.name?.trim() || "\uC774\uB984\uC5C6\uC74C";
                  const classText = student.class_label?.trim() ? ` (${student.class_label.trim()})` : "";
                  return (
                    <option key={student.student_id} value={student.student_id}>
                      {`${school} ${gradeText} ${nameText}${classText}`}
                    </option>
                  );
                })}
                <option value="manual">{"직접 입력하기"}</option>
              </select>
            </label>
          )}

          {selectedStudentId && selectedStudentId !== "manual" && selectedChild && !editMode && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">{"👤"}</span>
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  {"선택된 자녀 정보"}
                </p>
              </div>
              <p className="text-base font-bold text-[var(--text)]">
                {selectedChild.name?.trim() || "이름없음"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {schoolLevelKo(selectedChild.school_level)}
                {selectedChild.grade != null ? ` ${selectedChild.grade}학년` : ""}
                {selectedChild.class_label?.trim() ? ` · ${selectedChild.class_label.trim()}` : ""}
                {selectedChild.student_no?.trim() ? ` · 학번 ${selectedChild.student_no.trim()}` : ""}
              </p>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="mt-2 text-xs text-[var(--accent)] hover:underline"
              >
                {"✏️ 정보 직접 수정하기"}
              </button>
            </div>
          )}

          {(selectedStudentId === "manual" || editMode) && (<>


          <label className="block text-sm text-[var(--muted)]">
            {"\uD559\uC0DD \uC774\uB984 *"}
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </label>

          <label className="block text-sm text-[var(--muted)]">
            {"\uD559\uAD50\uAE09 *"}
            <select
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={schoolLevel}
              onChange={(e) => setSchoolLevel((e.target.value as SchoolLevel) || "")}
            >
              <option value="">{"\uC120\uD0DD"}</option>
              <option value="elementary">{"\uCD08"}</option>
              <option value="middle">{"\uC911"}</option>
              <option value="high">{"\uACE0"}</option>
            </select>
          </label>

          <label className="block text-sm text-[var(--muted)]">
            {"\uD559\uB144 *"}
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={grade}
              onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
            />
          </label>

          <label className="block text-sm text-[var(--muted)]">
            {"\uBC18 (\uC120\uD0DD)"}
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
            />
          </label>

          <label className="block text-sm text-[var(--muted)]">
            {"\uD559\uBC88 (\uC120\uD0DD)"}
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
            />
          </label>

          {selectedStudentId && selectedStudentId !== "manual" && editMode && (
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="self-start text-xs text-[var(--muted)] hover:text-[var(--text)] hover:underline"
            >
              {"수정 취소 (자녀 기본 정보 사용)"}
            </button>
          )}
          </>)}

          <label className="block text-sm text-[var(--muted)]">
            {"\uBCF4\uD638\uC790 \uC5F0\uB77D\uCC98 *"}
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
            />
          </label>

          <label className="block text-sm text-[var(--muted)]">
            {"\uC0C1\uB2F4 \uB0B4\uC6A9 *"}
            <textarea
              className="mt-2 min-h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={consultationContent}
              onChange={(e) => setConsultationContent(e.target.value)}
            />
          </label>

          <div>
            <label className="mb-2 block text-sm text-[var(--text-muted)]">
              날짜 *
            </label>
            <input
              type="date"
              className="w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
              value={selectedDate}
              min={tomorrowStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              오늘 포함 당일 예약은 불가하며, 내일부터 예약 가능합니다.
            </p>
            {dayHint && (
              <p className="mt-1 text-xs text-[var(--accent)]">{dayHint}</p>
            )}
            {dayMode === "closed" && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                토요일은 상담을 운영하지 않습니다.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-[var(--muted)]">{"\uC0C1\uB2F4 \uC720\uD615"}</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={type}
              onChange={(e) => setType(e.target.value as "phone" | "in_person")}
              disabled={typeDisabled}
            >
              <option value="phone">{"\uC804\uD654"}</option>
              <option value="in_person">{"\uB300\uBA74"}</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-[var(--muted)]">{"\uC2DC\uAC04 *"}</label>
            {!selectedDate ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-center">
                <div className="mb-2 text-2xl">{"📅"}</div>
                <p className="text-sm font-medium text-[var(--text)]">
                  {"먼저 날짜를 선택해 주세요"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {"날짜를 고르면 예약 가능한 시간대가 표시됩니다"}
                </p>
              </div>
            ) : !showGrid ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
                <div className="mb-2 text-2xl">{"😔"}</div>
                <p className="text-sm font-medium text-[var(--text)]">
                  {"이 날짜에는 예약 가능한 시간대가 없어요"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {"다른 날짜를 선택하거나 원장님께 문의해 주세요"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {timeSlots.map((slot) => {
                  const isConfirmed = confirmedSlots.has(slot);
                  const isOwnerBlocked = ownerBlockedSlots.has(slot);
                  const selected = selectedTime === slot;
                  const disabled = !selectedDate || isConfirmed || isOwnerBlocked;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      disabled={disabled}
                      className={`rounded-lg border px-2 py-2 text-sm transition ${
                        isConfirmed
                          ? "border-[var(--success-text)] bg-[var(--success-bg)] text-[var(--success-text)]"
                          : isOwnerBlocked
                            ? "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]"
                          : selected
                            ? "border-[var(--accent)] bg-[var(--card-muted)] text-[var(--text)]"
                          : disabled
                            ? "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] opacity-50"
                            : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {slot}
                      {!isConfirmed && isOwnerBlocked ? " (\uCC28\uB2E8)" : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
            onClick={() => void submit()}
            disabled={submitting || myStudents.length === 0}
          >
            {submitting ? "\uC694\uCCAD \uC911..." : "\uC608\uC57D \uC694\uCCAD"}
          </button>
        </div>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[var(--text)]">{"내 요청"}</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {showAllRequests
                  ? `전체 ${requests.length}건`
                  : `진행 중 ${inProgressCount}건 / 전체 ${requests.length}건`}
              </p>
            </div>
            {requests.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllRequests((prev) => !prev)}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)]"
              >
                {showAllRequests ? "진행 중만 보기" : `전체 보기 (${requests.length})`}
              </button>
            )}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                {showAllRequests
                  ? "아직 요청한 상담이 없어요"
                  : "진행 중인 상담 요청이 없어요"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map((row) => {
                const tone = getStatusTone(row.status);
                const badge = STATUS_BADGE_MAP[row.status] ?? {
                  label: getStatusLabel(row.status),
                  cls: "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]",
                };
                const preview = row.manual_consultation_content?.trim() || row.notes || "-";
                const cancelDisabled =
                  row.status !== "requested" || cancelingRequestId === row.id;
                return (
                  <SectionCard
                    key={row.id}
                    className={`p-4 ${
                      highlightRequestId === row.id
                        ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : tone.cardClass
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-[var(--text)]">
                        {fmtKst(row.requested_start_at)} / {getTypeLabel(row.type)}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p
                      className="mt-2 text-sm text-[var(--muted)] overflow-hidden"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {preview}
                    </p>
                    {row.status === "requested" && (
                      <button
                        type="button"
                        className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-60"
                        onClick={() => void cancelMyRequest(row.id)}
                        disabled={cancelDisabled}
                      >
                        {cancelingRequestId === row.id ? "취소 처리 중..." : "취소"}
                      </button>
                    )}
                  </SectionCard>
                );
              })}
            </div>
          )}
        </section>

      </SectionCard>
    </PageShell>
  );
}
