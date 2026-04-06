"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import ReportListItem from "@/components/reports/ReportListItem";
import {
  createReportPublishedAnnouncement,
  formatReportMonth,
  getOwnerMonthlyReportCoverage,
  listOwnerReports,
  upsertEnglishMetrics,
  upsertMonthlyReport,
  uploadReportPdf,
  type OwnerMonthlyReportCoverage,
  type ReportListItem as ReportListItemType,
} from "@/lib/reports";
import { ensureOwnerAcademy } from "@/lib/academy";
import { prettyUserError } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { isUuid, normalizeMonthKey } from "@/lib/validators";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const STUDENT_SELECTION_REQUIRED_MESSAGE = "학생 선택이 필요합니다. 학생을 선택한 뒤 저장/발송을 진행해 주세요.";
const ACADEMY_ID_REQUIRED_MESSAGE = "학원 정보가 아직 설정되지 않았습니다. 원장 계정에 학원 소속(academy_id)을 먼저 설정해 주세요.";
const STUDENTS_ACADEMY_LINK_REQUIRED_MESSAGE = "학생이 학원에 연결되어 있지 않습니다. /owner/students에서 '학원 소속 연결'을 진행해 주세요.";

type StudentOption = {
  id: string;
  name: string | null;
  school_level: "elem" | "mid" | "high" | null;
  grade: number | null;
  class_label: string | null;
  student_no: string | null;
};

function defaultMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function schoolLevelLabel(level: StudentOption["school_level"]): string {
  if (level === "elem") return "초등";
  if (level === "mid") return "중등";
  if (level === "high") return "고등";
  return "";
}

function formatStudentOptionLabel(student: StudentOption): string {
  const name = student.name?.trim() || student.id.slice(0, 8);
  const level = schoolLevelLabel(student.school_level);
  const grade = student.grade != null ? `${student.grade}학년` : "학년 미정";
  const classLabel = student.class_label?.trim() ? ` ${student.class_label.trim()}반` : "";
  return `${level ? `${level} ` : ""}${grade}${classLabel} ${name}`.trim();
}

function formatCoverageGroupLabel(group: {
  school_level: string | null;
  grade: number | null;
  class_label: string | null;
}): string {
  const level = schoolLevelLabel((group.school_level as StudentOption["school_level"]) ?? null);
  const grade = group.grade != null ? `${group.grade}학년` : "학년 미정";
  const classLabel = group.class_label?.trim() ? ` ${group.class_label.trim()}반` : "";
  return `${level ? `${level} ` : ""}${grade}${classLabel}`.trim();
}

function gradeOptionsForSchoolLevel(level: "" | "elem" | "mid" | "high"): string[] {
  if (level === "elem") return ["1", "2", "3", "4", "5", "6"];
  if (level === "mid" || level === "high") return ["1", "2", "3"];
  return ["1", "2", "3", "4", "5", "6"];
}

function parseQueryStatus(value: string | null): "missing" | "parent-unread" | "student-unread" | "all-read" | "all" | null {
  if (value === "missing") return "missing";
  if (value === "parent-unread") return "parent-unread";
  if (value === "student-unread") return "student-unread";
  if (value === "all-read") return "all-read";
  if (value === "all") return "all";
  return null;
}

export default function OwnerReportsPage() {
  type ReadStatusFilter = "all" | "student-unread" | "parent-unread" | "all-unread" | "all-read";
  type ReportSortOption = "latest" | "unread-first";
  type QueryStatus = "missing" | "parent-unread" | "student-unread" | "all-read" | "all";

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [items, setItems] = useState<ReportListItemType[]>([]);
  const [coverage, setCoverage] = useState<OwnerMonthlyReportCoverage | null>(null);

  const [studentId, setStudentId] = useState<string | null>(null);
  const [month, setMonth] = useState(defaultMonth());
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [scores, setScores] = useState({ vocab: 0, reading: 0, grammar: 0, listening: 0, note: "" });
  const [moveToNextAfterSave, setMoveToNextAfterSave] = useState(true);
  const [schoolLevelFilter, setSchoolLevelFilter] = useState<"" | "elem" | "mid" | "high">("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStudentId, setFilterStudentId] = useState<string | null>(null);
  const [readStatusFilter, setReadStatusFilter] = useState<ReadStatusFilter>("all");
  const [reportSort, setReportSort] = useState<ReportSortOption>("latest");
  const [activeQueryStatus, setActiveQueryStatus] = useState<QueryStatus | null>(null);
  const [resendBusyReportId, setResendBusyReportId] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [needsAcademySetup, setNeedsAcademySetup] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [ownerAcademyId, setOwnerAcademyId] = useState<string | null>(null);
  const loggedKeysRef = useRef<Set<string>>(new Set());
  const numericGrade = gradeFilter ? Number(gradeFilter) : null;
  const gradeOptions = useMemo(() => gradeOptionsForSchoolLevel(schoolLevelFilter), [schoolLevelFilter]);
  const availableClasses = useMemo(() => {
    if (!schoolLevelFilter || !numericGrade) return [];
    return Array.from(
      new Set(
        students
          .filter((row) => row.school_level === schoolLevelFilter && row.grade === numericGrade)
          .map((row) => row.class_label?.trim() ?? "")
          .filter((value) => value.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, "ko"));
  }, [students, schoolLevelFilter, numericGrade]);
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return students.filter((row) => {
      const matchesSchool = !schoolLevelFilter || row.school_level === schoolLevelFilter;
      const matchesGrade = !numericGrade || row.grade === numericGrade;
      const matchesClass = !classFilter || (row.class_label ?? "").trim() === classFilter;
      const matchesQuery =
        !q
        || (row.name ?? "").toLowerCase().includes(q)
        || String(row.student_no ?? "").toLowerCase().includes(q)
        || String(row.grade ?? "").includes(q)
        || String(row.class_label ?? "").toLowerCase().includes(q);
      return matchesSchool && matchesGrade && matchesClass && matchesQuery;
    });
  }, [students, schoolLevelFilter, numericGrade, classFilter, studentQuery]);
  const selectedStudent = useMemo(() => students.find((row) => row.id === studentId) ?? null, [students, studentId]);
  const currentIndex = useMemo(
    () => filteredStudents.findIndex((row) => row.id === studentId),
    [filteredStudents, studentId]
  );
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (schoolLevelFilter) parts.push(schoolLevelLabel(schoolLevelFilter));
    if (gradeFilter) parts.push(`${gradeFilter}학년`);
    if (classFilter) parts.push(`${classFilter}반`);
    if (studentQuery.trim()) parts.push(`'${studentQuery.trim()}'`);
    if (parts.length === 0) return "학교급/학년/반 또는 이름으로 학생을 찾으세요.";
    return `${parts.join(" / ")} 검색 결과 ${filteredStudents.length}명`;
  }, [schoolLevelFilter, gradeFilter, classFilter, studentQuery, filteredStudents.length]);
  const filteredItems = useMemo(() => {
    const nextItems = items.filter((item) => {
      const parentUnread = item.parent_total_count > 0 && item.parent_read_count < item.parent_total_count;
      const allRead = item.student_read && item.parent_total_count > 0 && item.parent_all_read;
      const allUnread = !item.student_read && (item.parent_total_count === 0 || item.parent_read_count === 0);

      if (readStatusFilter === "student-unread") return !item.student_read;
      if (readStatusFilter === "parent-unread") return parentUnread;
      if (readStatusFilter === "all-unread") return allUnread;
      if (readStatusFilter === "all-read") return allRead;
      return true;
    });

    if (reportSort === "unread-first") {
      return [...nextItems].sort((a, b) => {
        const aUnreadScore = (!a.student_read ? 2 : 0) + (a.parent_total_count > 0 && a.parent_read_count < a.parent_total_count ? 1 : 0);
        const bUnreadScore = (!b.student_read ? 2 : 0) + (b.parent_total_count > 0 && b.parent_read_count < b.parent_total_count ? 1 : 0);
        if (aUnreadScore !== bUnreadScore) return bUnreadScore - aUnreadScore;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return nextItems;
  }, [items, readStatusFilter, reportSort]);
  const unreadSummary = useMemo(() => {
    const studentUnread = items.filter((item) => !item.student_read).length;
    const parentUnread = items.filter((item) => item.parent_total_count > 0 && item.parent_read_count < item.parent_total_count).length;
    return { studentUnread, parentUnread };
  }, [items]);
  const statusBannerText = useMemo(() => {
    if (activeQueryStatus === "missing") return "이번 달 리포트 누락 학생을 확인하세요.";
    if (activeQueryStatus === "parent-unread") return "학부모 미열람 리포트를 확인하고 재알림할 수 있습니다.";
    if (activeQueryStatus === "student-unread") return "학생 미열람 리포트를 우선 확인하세요.";
    if (activeQueryStatus === "all-read") return "모두 열람된 리포트만 보고 있습니다.";
    if (activeQueryStatus === "all") return "전체 리포트를 보고 있습니다.";
    return null;
  }, [activeQueryStatus]);
  const isMissingFocused = activeQueryStatus === "missing";

  const logErrorOnce = (key: string, message: string, cause: unknown, extra?: Record<string, unknown>) => {
    const pretty = toPrettyErrorString(cause);
    const dedupeKey = `${key}:${pretty}`;
    if (loggedKeysRef.current.has(dedupeKey)) return;
    loggedKeysRef.current.add(dedupeKey);
    console.error(message, pretty, cause, extra ?? {});
  };

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterStudentId]);

  useEffect(() => {
    const parsed = parseQueryStatus(searchParams.get("status"));
    setActiveQueryStatus(parsed);
    if (!parsed) return;

    if (parsed === "missing") {
      setReadStatusFilter("all");
      setReportSort("latest");
      return;
    }
    if (parsed === "parent-unread") {
      setReadStatusFilter("parent-unread");
      setReportSort("unread-first");
      return;
    }
    if (parsed === "student-unread") {
      setReadStatusFilter("student-unread");
      setReportSort("unread-first");
      return;
    }
    if (parsed === "all-read") {
      setReadStatusFilter("all-read");
      setReportSort("latest");
      return;
    }
    if (parsed === "all") {
      setReadStatusFilter("all");
      setReportSort("latest");
    }
  }, [searchParams]);

  const initialize = async () => {
    setError(null);
    setNeedsAcademySetup(false);
    setOwnerUserId(null);
    setOwnerAcademyId(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      logErrorOnce("owner-reports-session", "Owner reports session load failed:", sessionError, {
        userId: null,
        academyId: null,
      });
      setError(prettyUserError(sessionError));
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role,academy_id,account_status")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null; academy_id: string | null; account_status: string | null }>();
    if (meError) {
      logErrorOnce("owner-reports-profile", "Owner reports profile load failed:", meError, {
        userId: session.user.id,
        academyId: null,
      });
      setError(prettyUserError(meError));
      setLoading(false);
      return;
    }

    if (me?.role !== "owner") {
      router.replace("/");
      return;
    }
    if ((me?.account_status ?? "active") !== "active") {
      router.replace("/onboarding/pending");
      return;
    }

    setOwnerUserId(session.user.id);
    setOwnerAcademyId(me?.academy_id ?? null);

    if (!isUuid(me?.academy_id)) {
      const academyValidationError = new Error("owner academy_id is missing or invalid");
      logErrorOnce("owner-reports-academy", "Owner reports academy validation failed:", academyValidationError, {
        userId: session.user.id,
        academyId: me?.academy_id ?? null,
      });
      setNeedsAcademySetup(true);
      setError(ACADEMY_ID_REQUIRED_MESSAGE);
      setLoading(false);
      return;
    }

    const { data: studentRows, error: studentError } = await supabase
      .from("profiles")
      .select("id,name,school_level,grade,class_label,student_no")
      .eq("role", "student")
      .eq("academy_id", me.academy_id)
      .order("name", { ascending: true })
      .returns<StudentOption[]>();
    if (studentError) {
      logErrorOnce("owner-reports-students", "Owner reports students load failed:", studentError, {
        userId: session.user.id,
        academyId: me.academy_id,
      });
      setError(prettyUserError(studentError));
      setLoading(false);
      return;
    }

    setStudents(studentRows ?? []);
    // 기본 선택값: 첫 학생이 있으면 그대로 세팅(검증은 저장 시점에만)
    if ((studentRows ?? []).length > 0) {
      setStudentId(studentRows?.[0]?.id ?? null);
    } else {
      setStudentId(null);
      setError(STUDENTS_ACADEMY_LINK_REQUIRED_MESSAGE);
    }

    await Promise.all([refreshList(), refreshCoverage()]);
    setLoading(false);
  };

  const refreshList = async () => {
    if (needsAcademySetup) {
      setItems([]);
      return;
    }
    try {
      const month = normalizeMonthKey(filterMonth) ?? undefined;
      const studentId = isUuid(filterStudentId) ? filterStudentId : undefined;
      const rows = await listOwnerReports({
        month,
        studentId,
      });
      setItems(rows);
    } catch (e: unknown) {
      logErrorOnce("owner-reports-list", "Owner reports load failed:", e, { userId: ownerUserId, academyId: ownerAcademyId });
      setError(prettyUserError(e));
    }
  };

  const refreshCoverage = async () => {
    if (needsAcademySetup) {
      setCoverage(null);
      return;
    }
    try {
      const nextCoverage = await getOwnerMonthlyReportCoverage();
      setCoverage(nextCoverage);
    } catch (e: unknown) {
      logErrorOnce("owner-reports-coverage", "Owner reports coverage load failed:", e, {
        userId: ownerUserId,
        academyId: ownerAcademyId,
      });
      setError(prettyUserError(e));
    }
  };

  const selectStudent = (student: StudentOption) => {
    setStudentId(student.id);
    setStudentQuery(student.name?.trim() ?? "");
    setPdfFile(null);
    setScores({ vocab: 0, reading: 0, grammar: 0, listening: 0, note: "" });
    setError(null);
    setSuccess(null);
  };

  const saveReport = async () => {
    setError(null);
    setSuccess(null);

    // 저장/발송 시점에서만 엄격 검증
    if (!isUuid(studentId)) return setError(STUDENT_SELECTION_REQUIRED_MESSAGE);
    const monthKey = normalizeMonthKey(month);
    if (!monthKey) return setError("월을 선택해 주세요.");

    if (pdfFile) {
      if (pdfFile.type !== "application/pdf") return setError("첨부 파일 형식이 올바르지 않습니다.");
      if (pdfFile.size > MAX_PDF_BYTES) return setError("파일은 5MB 이하만 첨부할 수 있습니다.");
    }

    const nextStudent = moveToNextAfterSave && currentIndex >= 0 && currentIndex < filteredStudents.length - 1
      ? filteredStudents[currentIndex + 1]
      : null;
    const reachedEndOfFilteredStudents =
      moveToNextAfterSave && filteredStudents.length > 0 && currentIndex === filteredStudents.length - 1;

    setSaving(true);
    try {
      const report = await upsertMonthlyReport({ studentId, month: monthKey });

      if (pdfFile) {
        await uploadReportPdf({
          reportId: report.id,
          studentId: report.student_id,
          monthDate: report.month,
          file: pdfFile,
        });
      }

      await upsertEnglishMetrics({
        reportId: report.id,
        vocab: clampScore(scores.vocab),
        reading: clampScore(scores.reading),
        grammar: clampScore(scores.grammar),
        listening: clampScore(scores.listening),
        note: scores.note.trim() || null,
      });

      let publishFailed = false;
      try {
        await createReportPublishedAnnouncement(report.id);
      } catch (publishError: unknown) {
        publishFailed = true;
        logErrorOnce("owner-reports-publish", "Owner report publish announcement failed:", publishError, {
          userId: ownerUserId,
          academyId: ownerAcademyId,
          reportId: report.id,
        });
      }

      const successMessage = publishFailed
        ? "리포트를 저장했습니다. 알리미 발송에 실패했습니다."
        : reachedEndOfFilteredStudents
          ? "현재 필터의 마지막 학생까지 저장했습니다."
          : "리포트를 저장/발송했습니다.";
      if (nextStudent) {
        selectStudent(nextStudent);
        setSuccess(successMessage);
      } else {
        setScores({ vocab: 0, reading: 0, grammar: 0, listening: 0, note: "" });
        setPdfFile(null);
        setSuccess(successMessage);
      }
      await Promise.all([refreshList(), refreshCoverage()]);
    } catch (e: unknown) {
      logErrorOnce("owner-reports-save", "Owner report save failed:", e, { userId: ownerUserId, academyId: ownerAcademyId });
      setError(prettyUserError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSetupAcademy = async () => {
    if (!isDevMode || setupBusy) return;
    setSetupBusy(true);
    setError(null);
    try {
      await ensureOwnerAcademy("MVS (Most Valuable Student)");
      await initialize();
    } catch (e: unknown) {
      logErrorOnce("owner-reports-auto-academy", "Owner reports academy auto setup failed:", e, {
        userId: ownerUserId,
        academyId: ownerAcademyId,
      });
      setError(prettyUserError(e));
    } finally {
      setSetupBusy(false);
    }
  };

  const moveToPreviousStudent = () => {
    if (currentIndex <= 0) return;
    const previousStudent = filteredStudents[currentIndex - 1];
    if (!previousStudent) return;
    selectStudent(previousStudent);
  };

  const moveToNextStudent = () => {
    if (currentIndex < 0 || currentIndex >= filteredStudents.length - 1) return;
    const nextStudent = filteredStudents[currentIndex + 1];
    if (!nextStudent) return;
    selectStudent(nextStudent);
  };

  const handleResend = async (reportId: string) => {
    if (resendBusyReportId) return;
    if (!window.confirm("이 리포트 알림을 학생/학부모에게 다시 발송할까요?")) return;

    setResendBusyReportId(reportId);
    setError(null);
    setSuccess(null);
    try {
      await createReportPublishedAnnouncement(reportId);
      setSuccess("리포트 알림을 다시 발송했습니다.");
      await Promise.all([refreshList(), refreshCoverage()]);
    } catch (e: unknown) {
      logErrorOnce("owner-reports-resend", "Owner report resend failed:", e, { userId: ownerUserId, academyId: ownerAcademyId, reportId });
      setError(prettyUserError(e));
    } finally {
      setResendBusyReportId(null);
    }
  };

  const handleWorkOnGroup = (group: {
    school_level: string | null;
    grade: number | null;
    class_label: string | null;
  }) => {
    const nextSchoolLevel = (group.school_level as "" | "elem" | "mid" | "high" | null) ?? "";
    const nextGrade = group.grade != null ? String(group.grade) : "";
    const nextClass = group.class_label?.trim() ?? "";
    setSchoolLevelFilter(nextSchoolLevel);
    setGradeFilter(nextGrade);
    setClassFilter(nextClass);
    setStudentQuery("");
    setError(null);
    setSuccess(null);

    const firstStudent = students.find((student) => {
      const sameSchoolLevel = !nextSchoolLevel || student.school_level === nextSchoolLevel;
      const sameGrade = !group.grade || student.grade === group.grade;
      const sameClass = !nextClass || (student.class_label?.trim() ?? "") === nextClass;
      return sameSchoolLevel && sameGrade && sameClass;
    });
    if (firstStudent) selectStudent(firstStudent);
  };

  const resetStatusFocus = () => {
    setReadStatusFilter("all");
    setReportSort("latest");
    setActiveQueryStatus(null);
    router.replace(pathname);
  };

  if (loading) {
    return <PageShell title="리포트 관리">로딩 중...</PageShell>;
  }

  return (
    <PageShell title="리포트 관리" subtitle="월별 수학/영어 성취도를 저장/발송합니다." maxWidthClassName="max-w-6xl">
      {statusBannerText && (
        <SectionCard className="mb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[var(--text-muted)]">{statusBannerText}</div>
            <button
              type="button"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] md:w-auto"
              onClick={resetStatusFocus}
            >
              전체 보기로 돌아가기
            </button>
          </div>
        </SectionCard>
      )}

      {needsAcademySetup && (
        <SectionCard header="학원 설정 필요" className="mb-4">
          <div className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {ACADEMY_ID_REQUIRED_MESSAGE}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href="/onboarding/academy" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)]">
              학원 설정하기
            </Link>
            {isDevMode && (
              <button
                type="button"
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--text)] disabled:opacity-60"
                onClick={() => void handleAutoSetupAcademy()}
                disabled={setupBusy}
              >
                {setupBusy ? "자동 생성 중..." : "자동 생성"}
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {isMissingFocused && (
        <SectionCard header="이번 달 리포트 누락 현황">
          <div className="mb-3 inline-flex rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]">
            현재: 리포트 누락 보기
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
              <div className="text-xs text-[var(--text-muted)]">이번 달 대상 학생</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{coverage?.totalStudents ?? 0}명</div>
            </div>
            <div className="rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 md:p-5">
              <div className="text-xs text-[var(--success-text)]">리포트 작성 완료</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--success-text)]">{coverage?.reportedStudents ?? 0}명</div>
            </div>
            <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 md:p-5">
              <div className="text-xs text-[var(--accent)]">누락</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--accent)]">{coverage?.missingStudents ?? 0}명</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {(coverage?.byGroup ?? []).map((group) => {
              const hasMissing = group.missing > 0;
              return (
                <div
                  key={`focus-${group.school_level ?? "none"}-${group.grade ?? "none"}-${group.class_label ?? "none"}`}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between ${
                    hasMissing
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--card-soft)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{formatCoverageGroupLabel(group)}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {group.total}명 중 {group.reported}명 완료 / {group.missing}명 누락
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${
                        hasMissing
                          ? "border-[var(--accent)] bg-[var(--card)] text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]"
                      }`}
                    >
                      누락 {group.missing}명
                    </span>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] md:w-auto"
                      onClick={() => handleWorkOnGroup(group)}
                    >
                      이 반 작업하기
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard header="리포트 입력">
        {error && <div className="mb-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">{error}</div>}
        {success && <div className="mb-4 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">{success}</div>}
        {students.length === 0 && !needsAcademySetup && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Link href="/owner/students" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)]">
              학생 관리로 이동
            </Link>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-[var(--text-muted)] xl:col-span-2">
              학생 이름 검색
              <input
                type="text"
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="학생 이름 검색"
                disabled={needsAcademySetup || students.length === 0}
              />
            </label>
            <label className="text-sm text-[var(--text-muted)]">
              학교급 필터
              <select
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
                value={schoolLevelFilter}
                onChange={(e) => {
                  setSchoolLevelFilter((e.target.value as "" | "elem" | "mid" | "high") || "");
                  setGradeFilter("");
                  setClassFilter("");
                }}
                disabled={needsAcademySetup || students.length === 0}
              >
                <option value="">전체</option>
                <option value="elem">초등</option>
                <option value="mid">중등</option>
                <option value="high">고등</option>
              </select>
            </label>
            <label className="text-sm text-[var(--text-muted)]">
              학년 필터
              <select
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setClassFilter("");
                }}
                disabled={needsAcademySetup || students.length === 0}
              >
                <option value="">전체</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}학년
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--text-muted)]">
              반 필터
              <select
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm disabled:opacity-60"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                disabled={needsAcademySetup || students.length === 0 || !schoolLevelFilter || !gradeFilter}
              >
                <option value="">전체</option>
                {availableClasses.map((classLabel) => (
                  <option key={classLabel} value={classLabel}>
                    {classLabel}반
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
              {filterSummary}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="px-3 py-3 text-sm text-[var(--text-muted)]">검색 결과가 없습니다.</div>
              ) : (
                filteredStudents.map((student) => {
                  const active = student.id === studentId;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      className={`block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--card-strong)]"
                      }`}
                      onClick={() => selectStudent(student)}
                      disabled={needsAcademySetup || students.length === 0}
                    >
                      {formatStudentOptionLabel(student)}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            선택됨: {selectedStudent ? formatStudentOptionLabel(selectedStudent) : "선택된 학생 없음"}
          </div>
          {filteredStudents.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-[var(--text-muted)]">
                {currentIndex >= 0 ? `현재 ${currentIndex + 1} / ${filteredStudents.length}명` : ""}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--text)] disabled:opacity-60 sm:w-auto"
                  onClick={moveToPreviousStudent}
                  disabled={currentIndex <= 0}
                >
                  이전 학생
                </button>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--text)] disabled:opacity-60 sm:w-auto"
                  onClick={moveToNextStudent}
                  disabled={currentIndex < 0 || currentIndex >= filteredStudents.length - 1}
                >
                  다음 학생
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--text-muted)]">
            월
            <input type="month" className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm" value={month} onChange={(e) => setMonth(normalizeMonthKey(e.target.value) ?? "")} />
          </label>
          <label className="text-sm text-[var(--text-muted)]">
            수학 첨부 (5MB)
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                if (next && next.type !== "application/pdf") return setError("첨부 파일 형식이 올바르지 않습니다.");
                if (next && next.size > MAX_PDF_BYTES) return setError("파일은 5MB 이하만 첨부할 수 있습니다.");
                setPdfFile(next);
              }}
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(["vocab", "reading", "grammar", "listening"] as const).map((key) => (
            <label key={key} className="text-sm text-[var(--text-muted)]">
              {key}
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
                value={scores[key]}
                onChange={(e) => setScores((prev) => ({ ...prev, [key]: clampScore(Number(e.target.value)) }))}
              />
            </label>
          ))}
        </div>

        <label className="mt-3 block text-sm text-[var(--text-muted)]">
          메모
          <textarea className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm" value={scores.note} onChange={(e) => setScores((prev) => ({ ...prev, note: e.target.value }))} />
        </label>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={moveToNextAfterSave}
            onChange={(e) => setMoveToNextAfterSave(e.target.checked)}
          />
          저장 후 다음 학생으로 이동
        </label>

        <button type="button" className="mt-4 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60 md:w-auto" onClick={() => void saveReport()} disabled={!isUuid(studentId) || saving || needsAcademySetup}>
          {saving ? "저장 중..." : "저장/발송"}
        </button>
      </SectionCard>

      {!isMissingFocused && <SectionCard header="이번 달 리포트 누락 현황">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
            <div className="text-xs text-[var(--text-muted)]">이번 달 대상 학생</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{coverage?.totalStudents ?? 0}명</div>
          </div>
          <div className="rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 md:p-5">
            <div className="text-xs text-[var(--success-text)]">리포트 작성 완료</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--success-text)]">{coverage?.reportedStudents ?? 0}명</div>
          </div>
          <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 md:p-5">
            <div className="text-xs text-[var(--accent)]">누락</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--accent)]">{coverage?.missingStudents ?? 0}명</div>
          </div>
        </div>

        {coverage?.missingStudents === 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">
            이번 달 리포트가 모든 학생에게 작성되었습니다.
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {(coverage?.byGroup ?? []).map((group) => {
            const hasMissing = group.missing > 0;
            return (
              <div
                key={`${group.school_level ?? "none"}-${group.grade ?? "none"}-${group.class_label ?? "none"}`}
                className={`flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between ${
                  hasMissing
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--card-soft)]"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">{formatCoverageGroupLabel(group)}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {group.total}명 중 {group.reported}명 완료 / {group.missing}명 누락
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-xs ${
                      hasMissing
                        ? "border-[var(--accent)] bg-[var(--card)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]"
                    }`}
                  >
                    누락 {group.missing}명
                  </span>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] md:w-auto"
                    onClick={() => handleWorkOnGroup(group)}
                  >
                    이 반 작업하기
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>}

      <SectionCard
        header={(
          <div className="flex flex-wrap items-center gap-2">
            <span>월별 리포트 목록</span>
            {activeQueryStatus && (
              <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-normal text-[var(--accent)]">
                현재: {activeQueryStatus}
              </span>
            )}
          </div>
        )}
      >
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
          <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-1">
            학생 미열람 {unreadSummary.studentUnread}건
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-1">
            학부모 미열람 {unreadSummary.parentUnread}건
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(normalizeMonthKey(e.target.value) ?? "")} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm" />
          <select value={filterStudentId ?? ""} onChange={(e) => setFilterStudentId(isUuid(e.target.value) ? e.target.value : null)} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
            <option value="">전체 학생</option>
            {students.map((row) => <option key={row.id} value={row.id}>{formatStudentOptionLabel(row)}</option>)}
          </select>
          <select
            value={readStatusFilter}
            onChange={(e) => setReadStatusFilter(e.target.value as ReadStatusFilter)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
          >
            <option value="all">전체</option>
            <option value="student-unread">학생 미열람</option>
            <option value="parent-unread">학부모 미열람</option>
            <option value="all-unread">모두 미열람</option>
            <option value="all-read">모두 열람</option>
          </select>
          <select
            value={reportSort}
            onChange={(e) => setReportSort(e.target.value as ReportSortOption)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
          >
            <option value="latest">최신순</option>
            <option value="unread-first">미열람 우선</option>
          </select>
          <button type="button" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm disabled:opacity-60 xl:col-span-4 xl:w-auto" onClick={() => void Promise.all([refreshList(), refreshCoverage()])} disabled={needsAcademySetup}>새로고침</button>
        </div>

        <div className="mt-4 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text-muted)]">리포트가 없습니다.</div>
          ) : (
            filteredItems.map((item) => {
              const canResendParent = item.parent_total_count > 0 && item.parent_read_count < item.parent_total_count;
              return (
                <ReportListItem
                  key={item.id}
                  item={item}
                  href={`/reports/${item.id}`}
                  showStudentName
                  action={
                    canResendParent ? (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-60 md:w-auto"
                        onClick={() => void handleResend(item.id)}
                        disabled={resendBusyReportId === item.id || saving}
                      >
                        {resendBusyReportId === item.id ? "재알림 중..." : "학부모 재알림"}
                      </button>
                    ) : undefined
                  }
                />
              );
            })
          )}
        </div>

        <div className="mt-4 text-xs text-[var(--text-muted)]">선택 월: {filterMonth ? formatReportMonth(`${filterMonth}-01`) : "전체"}</div>
      </SectionCard>
    </PageShell>
  );
}
