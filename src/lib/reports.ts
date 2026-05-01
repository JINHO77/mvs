import { safeFileName } from "@/lib/files";
import { supabase } from "@/lib/supabaseClient";
import { isUuid, normalizeMonthKey } from "@/lib/validators";

export type ReportRow = {
  id: string;
  academy_id: string;
  student_id: string;
  month: string; // YYYY-MM-01
  math_pdf_path: string | null;
  math_pdf_name: string | null;
  math_pdf_size: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ReportEnglishMetricsRow = {
  report_id: string;
  vocab: number | null;
  reading: number | null;
  grammar: number | null;
  listening: number | null;
  note: string | null;
  updated_at: string;
};

export type ReportListItem = ReportRow & {
  announcement_id: string | null;
  student_name: string | null;
  is_read: boolean;
  english_metrics: ReportEnglishMetricsRow | null;
  student_read: boolean;
  student_read_at: string | null;
  student_confirmed: boolean | null;
  parent_read_count: number;
  parent_total_count: number;
  parent_all_read: boolean;
  current_parent_linked: boolean;
  last_announced_at: string | null;
};

export type ReportBadgeTone = "success" | "danger" | "accent" | "muted";

export type ReportStatusBadge = {
  label: string;
  tone: ReportBadgeTone;
};

export type ReportWithStudent = ReportRow & {
  student_name: string | null;
};

export type ReportDetail = {
  report: ReportWithStudent;
  english_metrics: ReportEnglishMetricsRow | null;
  is_read: boolean;
};

export type RecentEnglishTrendRow = {
  report_id: string;
  report_month: string;
  vocab: number | null;
  reading: number | null;
  grammar: number | null;
  listening: number | null;
};

export type OwnerReportStats = {
  totalStudents: number;
  monthlyReportsSent: number;
  monthlyReportsRead: number;
  monthlyReadRate: number;
};

export type OwnerMonthlyReportCoverageGroup = {
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
  total: number;
  reported: number;
  missing: number;
};

export type OwnerMonthlyReportCoverage = {
  month: string;
  totalStudents: number;
  reportedStudents: number;
  missingStudents: number;
  byGroup: OwnerMonthlyReportCoverageGroup[];
};

export type OwnerReportMissingRow = {
  student_id: string;
  student_name: string | null;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
  group_label: string;
  this_month_done: boolean;
  last_month_done: boolean;
  prev2_month_done: boolean;
  days_until_deadline: number;
  this_month_str: string;
  school_level_order: number | null;
};

export type OwnerReportMissingStatus =
  | "done"
  | "chronic_3m"
  | "chronic_2m"
  | "missing_this_month";

export function getOwnerReportMissingStatus(row: OwnerReportMissingRow): OwnerReportMissingStatus {
  if (row.this_month_done) return "done";
  if (!row.last_month_done && !row.prev2_month_done) return "chronic_3m";
  if (!row.last_month_done) return "chronic_2m";
  return "missing_this_month";
}

type ProfileMini = {
  id: string;
  role: string | null;
  academy_id: string | null;
  account_status: string | null;
};

type StudentCoverageRow = {
  id: string;
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
};
const MONTHLY_REPORT_SUBJECT = "monthly";

type ReportDbWriteRow = {
  id: string;
  academy_id: string;
  student_id: string;
  month: string | null;
  report_month: string | null;
  math_pdf_path: string | null;
  math_pdf_name: string | null;
  math_pdf_size: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type ReportReadStatusRow = {
  report_id: string;
  student_read: boolean | null;
  parent_total_count: number | null;
  parent_read_count: number | null;
  parent_all_read: boolean | null;
  current_parent_linked: boolean | null;
};

type ReportFetchRow = ReportDbWriteRow & {
  title: string | null;
  announcement_id: string | null;
};

function monthToDate(monthYYYYMM: string): string {
  const month = normalizeMonthKey(monthYYYYMM);
  if (!month) throw new Error("month must be YYYY-MM");
  return `${month}-01`;
}

function toReportRow(row: ReportDbWriteRow): ReportRow {
  const resolvedMonth = row.month ?? (row.report_month ? `${row.report_month}-01` : null);
  if (!resolvedMonth) throw new Error("리포트 월 정보가 올바르지 않습니다.");
  return {
    id: row.id,
    academy_id: row.academy_id,
    student_id: row.student_id,
    month: resolvedMonth,
    math_pdf_path: row.math_pdf_path,
    math_pdf_name: row.math_pdf_name,
    math_pdf_size: row.math_pdf_size,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function monthDir(monthDate: string): string {
  return monthDate.slice(0, 7).replace("-", "");
}

function ensurePdfFile(file: File): void {
  if (file.type !== "application/pdf") throw new Error("PDF 파일만 업로드할 수 있습니다.");
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("PDF 파일만 업로드할 수 있습니다.");
  if (file.size > 5 * 1024 * 1024) throw new Error("파일은 5MB 이하만 첨부할 수 있습니다.");
}

function formatAnnouncementMonth(monthDate: string): string {
  const m = monthDate.match(/^(\d{4})-(\d{2})/);
  if (!m) return monthDate;
  return `${m[1]}년 ${m[2]}월`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function getMe(): Promise<ProfileMini> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,academy_id,account_status")
    .eq("id", user.id)
    .single<ProfileMini>();
  if (error) throw error;
  return data;
}

async function getLinkedStudentIds(guardianId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("student_guardians")
    .select("student_id")
    .eq("guardian_id", guardianId)
    .returns<Array<{ student_id: string | null }>>();
  if (error) throw error;
  const ids = (data ?? [])
    .map((row) => row.student_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return Array.from(new Set(ids));
}

async function fetchMetricsMap(reportIds: string[]): Promise<Map<string, ReportEnglishMetricsRow>> {
  if (reportIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("report_english_metrics")
    .select("report_id,vocab,reading,grammar,listening,note,updated_at")
    .in("report_id", reportIds)
    .returns<ReportEnglishMetricsRow[]>();
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.report_id, row]));
}

async function fetchReadSet(reportIds: string[], userId: string): Promise<Set<string>> {
  if (reportIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("report_reads")
    .select("report_id")
    .eq("user_id", userId)
    .in("report_id", reportIds)
    .returns<Array<{ report_id: string }>>();
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.report_id));
}

async function fetchStudentNameMap(studentIds: string[]): Promise<Map<string, string | null>> {
  if (studentIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name")
    .in("id", studentIds)
    .returns<Array<{ id: string; name: string | null }>>();
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}


async function fetchReadStatusMap(reportIds: string[]): Promise<Map<string, ReportReadStatusRow>> {
  if (reportIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("report_read_status")
    .select("report_id,student_read,parent_total_count,parent_read_count,parent_all_read,current_parent_linked")
    .in("report_id", reportIds)
    .returns<ReportReadStatusRow[]>();
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.report_id, row]));
}

function toneClassName(tone: ReportBadgeTone): string {
  switch (tone) {
    case "success":
      return "border-[var(--success-text)] bg-[var(--success-bg)] text-[var(--success-text)]";
    case "danger":
      return "border-[var(--danger-text)] bg-[var(--danger-bg)] text-[var(--danger-text)]";
    case "accent":
      return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]";
    default:
      return "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]";
  }
}

export function getBadgeClassName(tone: ReportBadgeTone): string {
  return toneClassName(tone);
}

export function getParentLinkStatus(isLinked: boolean): ReportStatusBadge {
  return isLinked
    ? { label: "학부모 연결 완료", tone: "success" }
    : { label: "학부모 미연결", tone: "danger" };
}

export function getStudentReadStatus(isRead: boolean): ReportStatusBadge {
  return isRead
    ? { label: "학생 열람 완료", tone: "success" }
    : { label: "학생 미열람", tone: "danger" };
}

export function getStudentConfirmStatus(isConfirmed: boolean | null): ReportStatusBadge | null {
  if (isConfirmed == null) return null;
  return isConfirmed
    ? { label: "학생 확인 완료", tone: "success" }
    : { label: "학생 확인 필요", tone: "accent" };
}


async function fetchLastAnnouncementMap(reportIds: string[], ownerUserId: string): Promise<Map<string, string>> {
  if (reportIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("announcements")
    .select("body,created_at")
    .eq("created_by", ownerUserId)
    .like("body", "%/reports/%")
    .order("created_at", { ascending: false })
    .returns<Array<{ body: string | null; created_at: string }>>();
  if (error) throw error;

  const result = new Map<string, string>();
  for (const row of data ?? []) {
    const body = row.body ?? "";
    for (const reportId of reportIds) {
      if (!result.has(reportId) && body.includes(`/reports/${reportId}`)) {
        result.set(reportId, row.created_at);
      }
    }
  }
  return result;
}



async function enrichStudentRows(rows: ReportRow[], _studentUserId: string): Promise<ReportListItem[]> {
  const reportIds = rows.map((row) => row.id);
  const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  // RLS on report_reads only exposes rows where user_id = auth.uid(), so a direct
  // query from a student session cannot see parent reads. Use the view instead,
  // which aggregates all parties with elevated privileges.
  const [metricsMap, studentMap, statusMap] = await Promise.all([
    fetchMetricsMap(reportIds),
    fetchStudentNameMap(studentIds),
    fetchReadStatusMap(reportIds),
  ]);

  return rows.map((row) => {
    const status = statusMap.get(row.id);
    return {
      ...row,
      announcement_id: null,
      student_name: studentMap.get(row.student_id) ?? null,
      is_read: status?.student_read ?? false,
      english_metrics: metricsMap.get(row.id) ?? null,
      student_read: status?.student_read ?? false,
      student_read_at: null,
      student_confirmed: null,
      parent_read_count: Number(status?.parent_read_count ?? 0),
      parent_total_count: Number(status?.parent_total_count ?? 0),
      parent_all_read: status?.parent_all_read ?? false,
      current_parent_linked: status?.current_parent_linked ?? false,
      last_announced_at: null,
    };
  });
}

async function canAccessReport(me: ProfileMini, report: ReportRow): Promise<boolean> {
  if ((me.account_status ?? "active") !== "active") return false;

  if (me.role === "owner") {
    return isUuid(me.academy_id) && me.academy_id === report.academy_id;
  }
  if (me.role === "student") {
    return me.id === report.student_id;
  }
  if (me.role === "parent") {
    const linkedIds = await getLinkedStudentIds(me.id);
    return linkedIds.includes(report.student_id);
  }
  return false;
}

export async function upsertMonthlyReport(payload: {
  studentId: string;
  month: string; // YYYY-MM
  mathPdfPath?: string | null;
  mathPdfName?: string | null;
  mathPdfSize?: number | null;
}): Promise<ReportRow> {
  const me = await getMe();
  if (me.role !== "owner" || me.account_status !== "active") {
    throw new Error("리포트 저장 권한이 없습니다.");
  }
  if (!isUuid(me.academy_id)) throw new Error("학원 정보가 올바르지 않습니다.");
  if (!isUuid(payload.studentId)) {
    throw new Error("학생 선택이 필요합니다. 학생을 선택한 뒤 저장/발송을 진행해 주세요.");
  }

  const monthKey = normalizeMonthKey(payload.month);
  if (!monthKey) throw new Error("월 정보가 올바르지 않습니다.");
  const reportMonth = monthKey; // text: YYYY-MM
  const monthDate = `${monthKey}-01`; // date string for month column
  const subject = MONTHLY_REPORT_SUBJECT;

  const { data: existing, error: existingError } = await supabase
    .from("reports")
    .select("id,academy_id,student_id,month,report_month,math_pdf_path,math_pdf_name,math_pdf_size,created_by,created_at,updated_at")
    .eq("student_id", payload.studentId)
    .eq("report_month", reportMonth)
    .eq("subject", subject)
    .eq("is_deleted", false)
    .maybeSingle<ReportDbWriteRow>();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from("reports")
      .update({
        academy_id: me.academy_id,
        report_month: reportMonth,
        month: monthDate,
        subject,
        math_pdf_path: payload.mathPdfPath ?? null,
        math_pdf_name: payload.mathPdfName ?? null,
        math_pdf_size: payload.mathPdfSize ?? null,
      })
      .eq("id", existing.id)
      .select("id,academy_id,student_id,month,report_month,math_pdf_path,math_pdf_name,math_pdf_size,created_by,created_at,updated_at")
      .single<ReportDbWriteRow>();
    if (updateError) throw updateError;
    return toReportRow(updated);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("reports")
    .insert({
      academy_id: me.academy_id,
      student_id: payload.studentId,
      report_month: reportMonth,
      month: monthDate,
      subject,
      title: `${reportMonth} 월별 성취도`,
      created_by: me.id,
      math_pdf_path: payload.mathPdfPath ?? null,
      math_pdf_name: payload.mathPdfName ?? null,
      math_pdf_size: payload.mathPdfSize ?? null,
    })
    .select("id,academy_id,student_id,month,report_month,math_pdf_path,math_pdf_name,math_pdf_size,created_by,created_at,updated_at")
    .single<ReportDbWriteRow>();
  if (insertError) throw insertError;
  return toReportRow(inserted);
}

export async function upsertEnglishMetrics(payload: {
  reportId: string;
  vocab: number | null;
  reading: number | null;
  grammar: number | null;
  listening: number | null;
  note?: string | null;
}): Promise<void> {
  const me = await getMe();
  if (me.role !== "owner" || me.account_status !== "active") {
    throw new Error("영어 성취도 저장 권한이 없습니다.");
  }
  if (!isUuid(payload.reportId)) throw new Error("리포트 정보가 올바르지 않습니다.");

  const { error } = await supabase.from("report_english_metrics").upsert(
    {
      report_id: payload.reportId,
      vocab: payload.vocab,
      reading: payload.reading,
      grammar: payload.grammar,
      listening: payload.listening,
      note: payload.note ?? null,
    },
    { onConflict: "report_id" }
  );
  if (error) throw error;
}

export async function uploadReportPdf(params: {
  reportId: string;
  studentId: string;
  monthDate: string; // YYYY-MM-01
  file: File;
}): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const me = await getMe();
  if (me.role !== "owner" || me.account_status !== "active") {
    throw new Error("PDF 업로드 권한이 없습니다.");
  }
  if (!isUuid(params.reportId) || !isUuid(params.studentId)) {
    throw new Error("리포트 정보가 올바르지 않습니다.");
  }

  ensurePdfFile(params.file);
  const safeName = safeFileName(params.file.name, "report");
  const key = `${params.studentId}/${monthDir(params.monthDate)}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage.from("report_attachments").upload(key, params.file, {
    upsert: false,
    contentType: "application/pdf",
  });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("reports")
    .update({
      math_pdf_path: key,
      math_pdf_name: params.file.name,
      math_pdf_size: params.file.size,
    })
    .eq("id", params.reportId);
  if (updateError) throw updateError;

  return { filePath: key, fileName: params.file.name, fileSize: params.file.size };
}

export async function listOwnerReports(filters?: { month?: string; studentId?: string }): Promise<ReportListItem[]> {
  const me = await getMe();
  if (me.role !== "owner") throw new Error("리포트 조회 권한이 없습니다.");
  if (!isUuid(me.academy_id)) return [];

  let query = supabase
    .from("reports")
    .select("id,academy_id,student_id,month,report_month,title,math_pdf_path,math_pdf_name,math_pdf_size,announcement_id,created_by,created_at,updated_at")
    .eq("academy_id", me.academy_id)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .order("month", { ascending: false })
    .order("created_at", { ascending: false });

  const month = normalizeMonthKey(filters?.month);
  if (month) query = query.eq("month", monthToDate(month));
  if (isUuid(filters?.studentId)) query = query.eq("student_id", filters.studentId);

  const { data: reportData, error: reportError } = await query.returns<ReportFetchRow[]>();
  if (reportError) throw reportError;

  const rows = reportData ?? [];
  if (rows.length === 0) return [];

  const reportIds = rows.map((row) => row.id);
  const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  const [metricsMap, studentMap, statusMap, lastAnnouncementMap] = await Promise.all([
    fetchMetricsMap(reportIds),
    fetchStudentNameMap(studentIds),
    fetchReadStatusMap(reportIds),
    fetchLastAnnouncementMap(reportIds, me.id),
  ]);

  return rows.map((row) => {
    const reportRow = toReportRow(row);
    const status = statusMap.get(row.id);
    return {
      ...reportRow,
      announcement_id: row.announcement_id ?? null,
      student_name: studentMap.get(row.student_id) ?? null,
      is_read: (status?.student_read ?? false) || Number(status?.parent_read_count ?? 0) > 0,
      english_metrics: metricsMap.get(row.id) ?? null,
      student_read: status?.student_read ?? false,
      student_read_at: null,
      student_confirmed: null,
      parent_read_count: Number(status?.parent_read_count ?? 0),
      parent_total_count: Number(status?.parent_total_count ?? 0),
      parent_all_read: status?.parent_all_read ?? false,
      current_parent_linked: status?.current_parent_linked ?? false,
      last_announced_at: lastAnnouncementMap.get(row.id) ?? null,
    };
  });
}

export async function getOwnerReportStats(): Promise<OwnerReportStats> {
  const me = await getMe();
  if (me.role !== "owner") throw new Error("리포트 통계 조회 권한이 없습니다.");
  if (!isUuid(me.academy_id)) {
    return {
      totalStudents: 0,
      monthlyReportsSent: 0,
      monthlyReportsRead: 0,
      monthlyReadRate: 0,
    };
  }

  const monthKey = currentMonthKey();

  const { count: totalStudents, error: studentCountError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .eq("academy_id", me.academy_id);
  if (studentCountError) throw studentCountError;

  const { data: reportRows, error: reportsError } = await supabase
    .from("reports")
    .select("id")
    .eq("academy_id", me.academy_id)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .eq("report_month", monthKey)
    .returns<Array<{ id: string }>>();
  if (reportsError) throw reportsError;

  const reportIds = (reportRows ?? []).map((row) => row.id);
  if (reportIds.length === 0) {
    return {
      totalStudents: totalStudents ?? 0,
      monthlyReportsSent: 0,
      monthlyReportsRead: 0,
      monthlyReadRate: 0,
    };
  }

  const { data: readRows, error: readsError } = await supabase
    .from("report_reads")
    .select("report_id")
    .in("report_id", reportIds)
    .returns<Array<{ report_id: string }>>();
  if (readsError) throw readsError;

  const monthlyReportsRead = new Set((readRows ?? []).map((row) => row.report_id)).size;
  const monthlyReportsSent = reportIds.length;

  return {
    totalStudents: totalStudents ?? 0,
    monthlyReportsSent,
    monthlyReportsRead,
    monthlyReadRate: monthlyReportsSent > 0 ? Math.round((monthlyReportsRead / monthlyReportsSent) * 100) : 0,
  };
}

export async function getOwnerMonthlyReportCoverage(): Promise<OwnerMonthlyReportCoverage> {
  const me = await getMe();
  if (me.role !== "owner") throw new Error("리포트 커버리지 조회 권한이 없습니다.");

  const month = currentMonthKey();
  if (!isUuid(me.academy_id)) {
    return {
      month,
      totalStudents: 0,
      reportedStudents: 0,
      missingStudents: 0,
      byGroup: [],
    };
  }

  const { data: studentRows, error: studentsError } = await supabase
    .from("profiles")
    .select("id,school_level,grade,class_label")
    .eq("role", "student")
    .eq("academy_id", me.academy_id)
    .returns<StudentCoverageRow[]>();
  if (studentsError) throw studentsError;

  const { data: reportRows, error: reportsError } = await supabase
    .from("reports")
    .select("student_id")
    .eq("academy_id", me.academy_id)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .eq("report_month", month)
    .returns<Array<{ student_id: string | null }>>();
  if (reportsError) throw reportsError;

  const reportedStudentIds = new Set(
    (reportRows ?? [])
      .map((row) => row.student_id)
      .filter((studentId): studentId is string => typeof studentId === "string" && studentId.length > 0)
  );

  const students = studentRows ?? [];
  const groupMap = new Map<string, OwnerMonthlyReportCoverageGroup>();

  for (const student of students) {
    const classLabel = student.class_label?.trim() || null;
    const key = `${student.school_level ?? ""}::${student.grade ?? ""}::${classLabel ?? ""}`;
    const existing = groupMap.get(key) ?? {
      school_level: student.school_level,
      grade: student.grade,
      class_label: classLabel,
      total: 0,
      reported: 0,
      missing: 0,
    };

    existing.total += 1;
    if (reportedStudentIds.has(student.id)) {
      existing.reported += 1;
    } else {
      existing.missing += 1;
    }
    groupMap.set(key, existing);
  }

  const byGroup = Array.from(groupMap.values()).sort((a, b) => {
    if (b.missing !== a.missing) return b.missing - a.missing;
    const levelOrder = { high: 0, mid: 1, elem: 2, "": 3 } as const;
    const aLevel = levelOrder[(a.school_level ?? "") as keyof typeof levelOrder] ?? 3;
    const bLevel = levelOrder[(b.school_level ?? "") as keyof typeof levelOrder] ?? 3;
    if (aLevel !== bLevel) return aLevel - bLevel;
    if ((a.grade ?? 0) !== (b.grade ?? 0)) return (a.grade ?? 0) - (b.grade ?? 0);
    return (a.class_label ?? "").localeCompare(b.class_label ?? "", "ko");
  });

  return {
    month,
    totalStudents: students.length,
    reportedStudents: reportedStudentIds.size,
    missingStudents: Math.max(students.length - reportedStudentIds.size, 0),
    byGroup,
  };
}

export async function getOwnerReportMissingOverview(): Promise<OwnerReportMissingRow[]> {
  const me = await getMe();
  if (me.role !== "owner") throw new Error("리포트 누락 현황 조회 권한이 없습니다.");
  if (!isUuid(me.academy_id)) return [];

  const { data, error } = await supabase
    .from("v_owner_report_missing_overview")
    .select("*")
    .order("this_month_done", { ascending: true })
    .order("school_level_order", { ascending: true })
    .order("grade", { ascending: true })
    .order("class_label", { ascending: true, nullsFirst: false })
    .order("student_name", { ascending: true })
    .returns<OwnerReportMissingRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listStudentReports(studentId: string, month?: string | null): Promise<ReportListItem[]> {
  const me = await getMe();
  if (me.role !== "student" || (me.account_status ?? "active") !== "active") throw new Error("리포트 조회 권한이 없습니다.");
  if (me.id !== studentId) throw new Error("리포트 조회 권한이 없습니다.");
  if (!isUuid(studentId)) return [];

  let query = supabase
    .from("reports")
    .select("id,academy_id,student_id,month,math_pdf_path,math_pdf_name,math_pdf_size,created_by,created_at,updated_at")
    .eq("student_id", studentId)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .order("month", { ascending: false })
    .order("created_at", { ascending: false });

  const monthKey = normalizeMonthKey(month);
  if (monthKey) query = query.eq("month", monthToDate(monthKey));

  const { data, error } = await query.returns<ReportRow[]>();
  if (error) throw error;
  return enrichStudentRows(data ?? [], me.id);
}

export async function listParentReports(studentId: string, month?: string | null): Promise<ReportListItem[]> {
  const me = await getMe();
  if (me.role !== "parent" || (me.account_status ?? "active") !== "active") {
    throw new Error("리포트 조회 권한이 없습니다.");
  }
  if (!isUuid(studentId)) return [];

  const linkedIds = await getLinkedStudentIds(me.id);
  if (!linkedIds.includes(studentId)) throw new Error("리포트 조회 권한이 없습니다.");

  let query = supabase
    .from("reports")
    .select("id,academy_id,student_id,month,report_month,title,math_pdf_path,math_pdf_name,math_pdf_size,announcement_id,created_by,created_at,updated_at")
    .eq("student_id", studentId)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .order("month", { ascending: false })
    .order("created_at", { ascending: false });

  const monthKey = normalizeMonthKey(month);
  if (monthKey) query = query.eq("month", monthToDate(monthKey));

  const { data: reportData, error: reportError } = await query.returns<ReportFetchRow[]>();
  if (reportError) throw reportError;

  const rows = reportData ?? [];
  if (rows.length === 0) return [];

  const reportIds = rows.map((row) => row.id);
  const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  const [metricsMap, studentMap, statusMap, myReadSet] = await Promise.all([
    fetchMetricsMap(reportIds),
    fetchStudentNameMap(studentIds),
    fetchReadStatusMap(reportIds),
    fetchReadSet(reportIds, me.id),
  ]);

  return rows.map((row) => {
    const reportRow = toReportRow(row);
    const status = statusMap.get(row.id);
    return {
      ...reportRow,
      announcement_id: row.announcement_id ?? null,
      student_name: studentMap.get(row.student_id) ?? null,
      is_read: myReadSet.has(row.id),
      english_metrics: metricsMap.get(row.id) ?? null,
      student_read: status?.student_read ?? false,
      student_read_at: null,
      student_confirmed: null,
      parent_read_count: Number(status?.parent_read_count ?? 0),
      parent_total_count: Number(status?.parent_total_count ?? 0),
      parent_all_read: status?.parent_all_read ?? false,
      current_parent_linked: status?.current_parent_linked ?? false,
      last_announced_at: null,
    };
  });
}

export async function listMyReports(): Promise<ReportListItem[]> {
  const me = await getMe();
  if ((me.account_status ?? "active") !== "active") return [];

  let studentIds: string[] = [];
  if (me.role === "student") studentIds = [me.id];
  if (me.role === "parent") studentIds = await getLinkedStudentIds(me.id);
  if (me.role !== "student" && me.role !== "parent") throw new Error("리포트 조회 권한이 없습니다.");
  if (studentIds.length === 0) return [];

  if (me.role === "student") {
    const { data, error } = await supabase
      .from("reports")
      .select("id,academy_id,student_id,month,math_pdf_path,math_pdf_name,math_pdf_size,created_by,created_at,updated_at")
      .in("student_id", studentIds)
      .eq("subject", MONTHLY_REPORT_SUBJECT)
      .eq("is_deleted", false)
      .order("month", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>();
    if (error) throw error;
    return enrichStudentRows(data ?? [], me.id);
  }

  // parent: use report_read_status view
  const { data: reportData, error: reportError } = await supabase
    .from("reports")
    .select("id,academy_id,student_id,month,report_month,title,math_pdf_path,math_pdf_name,math_pdf_size,announcement_id,created_by,created_at,updated_at")
    .in("student_id", studentIds)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .order("month", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<ReportFetchRow[]>();
  if (reportError) throw reportError;

  const rows = reportData ?? [];
  if (rows.length === 0) return [];

  const reportIds = rows.map((row) => row.id);
  const allStudentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  const [metricsMap, studentMap, statusMap, myReadSet] = await Promise.all([
    fetchMetricsMap(reportIds),
    fetchStudentNameMap(allStudentIds),
    fetchReadStatusMap(reportIds),
    fetchReadSet(reportIds, me.id),
  ]);

  return rows.map((row) => {
    const reportRow = toReportRow(row);
    const status = statusMap.get(row.id);
    return {
      ...reportRow,
      announcement_id: row.announcement_id ?? null,
      student_name: studentMap.get(row.student_id) ?? null,
      is_read: myReadSet.has(row.id),
      english_metrics: metricsMap.get(row.id) ?? null,
      student_read: status?.student_read ?? false,
      student_read_at: null,
      student_confirmed: null,
      parent_read_count: Number(status?.parent_read_count ?? 0),
      parent_total_count: Number(status?.parent_total_count ?? 0),
      parent_all_read: status?.parent_all_read ?? false,
      current_parent_linked: status?.current_parent_linked ?? false,
      last_announced_at: null,
    };
  });
}

export async function getReportById(reportId: string): Promise<ReportWithStudent> {
  if (!isUuid(reportId)) throw new Error("리포트 정보가 올바르지 않습니다.");

  const { data: report, error } = await supabase
    .from("reports")
    .select("id,academy_id,student_id,month,math_pdf_path,math_pdf_name,math_pdf_size,created_by,created_at,updated_at")
    .eq("id", reportId)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .single<ReportRow>();
  if (error) throw error;

  const { data: student } = await supabase
    .from("profiles")
    .select("id,name")
    .eq("id", report.student_id)
    .maybeSingle<{ id: string; name: string | null }>();

  return {
    ...report,
    student_name: student?.name ?? null,
  };
}

export async function getReportDetail(reportId: string): Promise<ReportDetail> {
  const me = await getMe();
  const report = await getReportById(reportId);

  const canAccess = await canAccessReport(me, report);
  if (!canAccess) throw new Error("리포트 조회 권한이 없습니다.");

  const { data: metrics } = await supabase
    .from("report_english_metrics")
    .select("report_id,vocab,reading,grammar,listening,note,updated_at")
    .eq("report_id", report.id)
    .maybeSingle<ReportEnglishMetricsRow>();

  const readSet = await fetchReadSet([report.id], me.id);

  return {
    report,
    english_metrics: metrics ?? null,
    is_read: readSet.has(report.id),
  };
}

export async function getRecentEnglishTrends(reportId: string): Promise<RecentEnglishTrendRow[]> {
  if (!isUuid(reportId)) throw new Error("리포트 정보가 올바르지 않습니다.");

  const me = await getMe();
  const report = await getReportById(reportId);
  const canAccess = await canAccessReport(me, report);
  if (!canAccess) throw new Error("리포트 조회 권한이 없습니다.");

  const currentMonth = normalizeMonthKey(report.month);
  if (!currentMonth) return [];

  const { data: rows, error } = await supabase
    .from("reports")
    .select("id,report_month,month")
    .eq("student_id", report.student_id)
    .eq("subject", MONTHLY_REPORT_SUBJECT)
    .eq("is_deleted", false)
    .lte("report_month", currentMonth)
    .order("report_month", { ascending: false })
    .limit(3)
    .returns<Array<{ id: string; report_month: string | null; month: string | null }>>();
  if (error) throw error;

  const reportRows = rows ?? [];
  if (reportRows.length === 0) return [];

  const metricsMap = await fetchMetricsMap(reportRows.map((row) => row.id));

  return reportRows
    .map((row) => {
      const month = normalizeMonthKey(row.report_month ?? row.month ?? "");
      if (!month) return null;
      const metrics = metricsMap.get(row.id);
      return {
        report_id: row.id,
        report_month: month,
        vocab: metrics?.vocab ?? null,
        reading: metrics?.reading ?? null,
        grammar: metrics?.grammar ?? null,
        listening: metrics?.listening ?? null,
      } satisfies RecentEnglishTrendRow;
    })
    .filter((row): row is RecentEnglishTrendRow => row !== null)
    .sort((a, b) => a.report_month.localeCompare(b.report_month));
}

export async function createReportPublishedAnnouncement(reportId: string): Promise<void> {
  const me = await getMe();
  if (me.role !== "owner" || (me.account_status ?? "active") !== "active") {
    throw new Error("알리미 발송 권한이 없습니다.");
  }

  const report = await getReportById(reportId);
  if (!isUuid(me.academy_id) || me.academy_id !== report.academy_id) {
    throw new Error("알리미 발송 권한이 없습니다.");
  }

  const title = `${report.student_name ?? "학생"} ${formatAnnouncementMonth(report.month)} 성취도 리포트가 등록되었습니다`;
  const body = `수학/영어 성취도 리포트가 등록되었습니다. 아래에서 확인해 주세요.\n/reports/${report.id}`;

  const { data: inserted, error: insertError } = await supabase
    .from("announcements")
    .insert({
      title,
      body,
      category: "report",
      audience_role: "all",
      requires_ack: false,
      created_by: me.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) throw insertError;
  if (!inserted?.id) throw new Error("알리미 생성에 실패했습니다.");

  const { error: targetError } = await supabase
    .from("announcement_targets")
    .insert({
      announcement_id: inserted.id,
      target_type: "student",
      student_id: report.student_id,
    });
  if (targetError) throw targetError;
}

export async function upsertReportRead(reportId: string): Promise<void> {
  if (!isUuid(reportId)) throw new Error("리포트 정보가 올바르지 않습니다.");
  const me = await getMe();
  const { error } = await supabase.from("report_reads").upsert(
    {
      report_id: reportId,
      user_id: me.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: "report_id,user_id" }
  );
  if (error) throw error;
}

export async function getReportSignedUrl(reportId: string, expiresIn = 120): Promise<string> {
  if (!isUuid(reportId)) throw new Error("리포트 정보가 올바르지 않습니다.");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("로그인이 필요합니다.");

  const res = await fetch("/api/reports/signed-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ reportId, expiresIn }),
  });

  const payload = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
  if (!res.ok) throw new Error(payload.error ?? "signed url 생성 실패");
  if (!payload.signedUrl) throw new Error("signed url 생성 실패");
  return payload.signedUrl;
}

export function formatReportMonth(monthDate: string): string {
  if (typeof monthDate !== "string") return "";
  const match = monthDate.match(/^(\d{4})-(\d{2})/);
  if (!match) return monthDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return monthDate;
  return `${year}년 ${month}월`;
}
