"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(d);
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
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getManualSchoolLevelLabel(level: string | null): string {
  if (level === "elem") return "\uCD08";
  if (level === "mid") return "\uC911";
  if (level === "high") return "\uACE0";
  return "\uBBF8\uC785\uB825";
}

export default function OwnerConsultRequestsPage() {
  const router = useRouter();
  const [focusId, setFocusId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    if (didApplyFocusFilterReset.current) return;
    if (!focusId) return;
    if (!requests.some((row) => row.id === focusId)) return;
    setStatusFilter("all");
    setDateFilter("");
    didApplyFocusFilterReset.current = true;
  }, [focusId, requests]);

  useEffect(() => {
    if (!focusId) return;
    if (!requests.some((row) => row.id === focusId)) return;

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
      router.replace("/login");
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

    if (!me || (me.role !== "owner" && me.role !== "teacher")) {
      router.replace("/");
      return;
    }

    await loadRequests();
    setLoading(false);
  };

  const loadRequests = async () => {
    const { data, error: reqError } = await supabase
      .from("consultation_requests")
      .select(
        "id,student_id,guardian_id,requested_start_at,duration_min,type,status,notes,entry_mode,manual_student_name,manual_school_level,manual_grade,manual_class_label,manual_student_no,manual_guardian_contact,manual_consultation_content,owner_note,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<ConsultationRequest[]>();

    if (reqError) {
      setError(`\uC694\uCCAD \uBAA9\uB85D \uC870\uD68C \uC2E4\uD328: ${reqError.message}`);
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

    const ids = Array.from(
      new Set(
        rows.flatMap((r) => {
          return [r.guardian_id, r.student_id];
        })
      )
    );

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
      setError(`\uD504\uB85C\uD544 \uC870\uD68C \uC2E4\uD328: ${profilesError.message}`);
      return;
    }

    const map = (profiles ?? []).reduce<Record<string, ProfileBasic>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    setProfileMap(map);
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadRequests();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, loadRequests]);

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
        owner_note: nextOwnerNote ? nextOwnerNote : null,
      })
      .eq("id", row.id);

    if (updateError) {
      const msg = updateError.message ?? "";
      const details = updateError.details ?? "";
      const hint = updateError.hint ?? "";
      const combined = `${msg} ${details} ${hint}`.toLowerCase();
      const isConfirmConflict =
        nextStatus === "confirmed" &&
        (combined.includes("consultation_requests_confirmed_unique_start") ||
          combined.includes("duplicate key") ||
          combined.includes("already exists") ||
          combined.includes("unique") ||
          updateError.code === "23505");
      setError(
        isConfirmConflict
          ? "\uC774\uBBF8 \uD574\uB2F9 \uC2DC\uAC04\uC5D0 \uB2E4\uB978 \uC694\uCCAD\uC774 \uD655\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uD655\uC778\uD574 \uC8FC\uC138\uC694."
          : msg
      );
      setActionBusyKey(null);
      return;
    }

    await loadRequests();
    setActionBusyKey(null);
    setSuccess("\uC0C1\uD0DC\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    setEditingId(null);
  };

  const saveOwnerNote = async (row: ConsultationRequest) => {
    setError(null);
    setSuccess(null);
    setActionBusyKey(`note:${row.id}`);

    const nextOwnerNote = (ownerNotes[row.id] ?? "").trim();
    const { error: updateError } = await supabase
      .from("consultation_requests")
      .update({
        owner_note: nextOwnerNote ? nextOwnerNote : null,
      })
      .eq("id", row.id);

    if (updateError) {
      setError(`\uBA54\uBAA8 \uC800\uC7A5 \uC2E4\uD328: ${updateError.message}`);
      setActionBusyKey(null);
      return;
    }

    await loadRequests();
    setActionBusyKey(null);
    setSuccess("\uBA54\uBAA8\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        {"\uB85C\uB529 \uC911..."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            <span className="text-[#D4AF37]">MVS</span> {"\uC0C1\uB2F4 \uC694\uCCAD \uAD00\uB9AC"}
            <span
              className={`ml-3 inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                requestedCount > 0
                  ? "border-[#3F3820] bg-[#1D170A] text-[#E7D7A0]"
                  : "border-[#2A2A35] bg-[#14141A] text-[#6F6F7D]"
              }`}
            >
              {"\uC694\uCCAD"} {requestedCount}
            </span>
          </h1>
          <button
            type="button"
            className="rounded-xl border border-[#1E1E26] px-3 py-2 text-xs text-[#B8B8C3] hover:text-[#F5F5F7]"
            onClick={() => setAutoRefresh((prev) => !prev)}
          >
            {"\uC790\uB3D9 \uAC31\uC2E0:"} {autoRefresh ? "\uCF1C\uC9D0" : "\uAEBC\uC9D0"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-[#2D5E41] bg-[#14261B] p-3 text-sm text-[#A6F4C5]">
            {success}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select
            className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-3 py-2 text-sm text-[#B8B8C3] outline-none focus:ring-2 focus:ring-[#D4AF37]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">{"\uC804\uCCB4"}</option>
            <option value="requested">{"\uC694\uCCAD"}</option>
            <option value="confirmed">{"\uD655\uC815"}</option>
            <option value="canceled">{"\uCDE8\uC18C"}</option>
            <option value="done">{"\uC644\uB8CC"}</option>
            <option value="no_show">{"\uB178\uC1FC"}</option>
          </select>
          <input
            type="date"
            className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-3 py-2 text-sm text-[#B8B8C3] outline-none focus:ring-2 focus:ring-[#D4AF37]"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
              onClick={() => setDateFilter(kstTodayYmd())}
            >
              {"\uC624\uB298"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
              onClick={() => setDateFilter(addDaysYmd(kstTodayYmd(), 1))}
            >
              {"\uB0B4\uC77C"}
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-[#8D8D98]">{"\uD45C\uC2DC"}: {filteredRequests.length} / {"\uC804\uCCB4"}: {requests.length}</div>

        <div className="mt-6 space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">
              {requests.length === 0 ? "\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uD604\uC7AC \uD544\uD130\uC5D0 \uB9DE\uB294 \uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}
            </div>
          ) : (
            filteredRequests.map((row) => {
              const student = profileMap[row.student_id];
              const guardian = profileMap[row.guardian_id];
              const hasResolvedStudent = !!student;
              const manualSchoolLevel = getManualSchoolLevelLabel(row.manual_school_level);
              const manualGradeText = row.manual_grade != null ? `${row.manual_grade}\uD559\uB144` : "\uBBF8\uC785\uB825";
              const manualNameText = row.manual_student_name?.trim() || "\uC774\uB984\uC5C6\uC74C";
              const manualClassText = row.manual_class_label?.trim() ? ` (${row.manual_class_label.trim()})` : "";
              const manualStudentNoText = row.manual_student_no?.trim() || "";
              const studentLine = hasResolvedStudent
                ? (student?.name ?? "\uC774\uB984 \uC5C6\uC74C") + (student?.email ? ` (${student.email})` : "")
                : `${manualSchoolLevel} ${manualGradeText} ${manualNameText}${manualClassText}`;
              const guardianLine = guardian?.email || row.manual_guardian_contact?.trim() || "\uC774\uBA54\uC77C \uC5C6\uC74C";
              const contentText = row.manual_consultation_content?.trim() || row.notes || "-";
              const isRequested = row.status === "requested";
              const isConfirmed = row.status === "confirmed";
              const isConfirmBusy = actionBusyKey === `status:${row.id}:confirmed`;
              const isCancelBusy = actionBusyKey === `status:${row.id}:canceled`;
              const isDoneBusy = actionBusyKey === `status:${row.id}:done`;
              const isNoShowBusy = actionBusyKey === `status:${row.id}:no_show`;
              const isNoteBusy = actionBusyKey === `note:${row.id}`;

              return (
                <div
                  id={`req-${row.id}`}
                  key={row.id}
                  className={`rounded-xl border bg-[#0B0B0E] p-4 transition-colors ${
                    highlightId === row.id
                      ? "border-[#D4AF37] bg-[#17130A]"
                      : "border-[#1E1E26]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-[#F5F5F7]">{fmt(row.requested_start_at)}</div>
                    <span className="rounded-lg border border-[#1E1E26] px-2 py-1 text-xs text-[#B8B8C3]">
                      {row.status}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-[#B8B8C3]">
                    {"\uD559\uC0DD"}: {studentLine}
                    {!hasResolvedStudent && manualStudentNoText && (
                      <span className="ml-2 text-xs text-[#8D8D98]">/ {"\uD559\uBC88"} {manualStudentNoText}</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-[#B8B8C3]">{"\uBCF4\uD638\uC790"}: {guardianLine}</div>
                  <div className="mt-1 text-sm text-[#B8B8C3]">{"\uC720\uD615"}: {row.type}</div>
                  <div className="mt-1 text-sm text-[#B8B8C3]">{"\uB0B4\uC6A9"}: {contentText}</div>

                  <button
                    className="mt-3 rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
                    onClick={() => setEditingId((prev) => (prev === row.id ? null : row.id))}
                  >
                    {editingId === row.id ? "\uB178\uD2B8 \uB2EB\uAE30" : "\uB178\uD2B8/\uCC98\uB9AC"}
                  </button>

                  {editingId === row.id && (
                    <div className="mt-3">
                      <label className="mb-2 block text-xs text-[#B8B8C3]">{"\uC6D0\uC7A5/\uAD50\uC0AC \uBA54\uBAA8"}</label>
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-[#1E1E26] bg-[#121218] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        value={ownerNotes[row.id] ?? ""}
                        onChange={(e) =>
                          setOwnerNotes((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="mt-2 rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7] disabled:opacity-60"
                        onClick={() => void saveOwnerNote(row)}
                        disabled={isNoteBusy}
                      >
                        {isNoteBusy ? "\uC800\uC7A5 \uC911..." : "\uBA54\uBAA8 \uC800\uC7A5"}
                      </button>
                    </div>
                  )}

                  {isRequested && (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-xl bg-[#D4AF37] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
                        onClick={() => void applyStatus(row, "confirmed")}
                        disabled={isConfirmBusy}
                      >
                        {"\uD655\uC815"}
                      </button>
                      <button
                        className="rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7] disabled:opacity-60"
                        onClick={() => void applyStatus(row, "canceled")}
                        disabled={isCancelBusy}
                      >
                        {"\uCDE8\uC18C/\uBC18\uB824"}
                      </button>
                    </div>
                  )}
                  {isConfirmed && (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-xl bg-[#D4AF37] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
                        onClick={() => void applyStatus(row, "done")}
                        disabled={isDoneBusy}
                      >
                        {"\uC644\uB8CC"}
                      </button>
                      <button
                        className="rounded-xl border border-[#1E1E26] px-3 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7] disabled:opacity-60"
                        onClick={() => void applyStatus(row, "no_show")}
                        disabled={isNoShowBusy}
                      >
                        {"\uB178\uC1FC"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
