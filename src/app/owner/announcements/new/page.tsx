"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import StudentSearchSelect, { type StudentSearchItem } from "@/components/student/StudentSearchSelect";
import {
  ANNOUNCEMENT_AUDIENCE_OPTIONS,
  ANNOUNCEMENT_TARGET_SCOPE_OPTIONS,
  getGradeOptions,
  getSchoolLevelLabel,
  SCHOOL_LEVEL_OPTIONS,
  type AnnouncementAudienceRole,
  type AnnouncementTargetScope,
  type SchoolLevel,
} from "@/constants/announcementMeta";
import { OWNER_ANNOUNCEMENT_NEW_TEXT } from "@/constants/ownerAnnouncementNew.ko";
import { safeFileName } from "@/lib/files";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type StudentOption = StudentSearchItem;

type GuardianLinkRow = {
  student_id: string | null;
  guardian_id: string | null;
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "pptx", "txt"]);

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function prettyUserError(): string {
  return OWNER_ANNOUNCEMENT_NEW_TEXT.submitErrorFallback;
}

function inputClassName() {
  return "mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:ring-2 focus:ring-[var(--accent)]";
}

function getAudienceSummaryLabel(audienceRole: AnnouncementAudienceRole): string {
  return ANNOUNCEMENT_AUDIENCE_OPTIONS.find((option) => option.value === audienceRole)?.label ?? "전체";
}

function formatStudentSummary(student: StudentOption | null): string {
  if (!student) return "-";
  const level = student.school_level ? getSchoolLevelLabel(student.school_level) : "";
  const grade = student.grade != null ? `${student.grade}학년` : "";
  const classLabel = student.class_label?.trim() ? `${student.class_label.trim()}반` : "";
  return [student.name ?? "이름 없음", level, grade, classLabel].filter((value) => value.length > 0).join(" · ");
}

function getTargetSummary(params: {
  targetScope: AnnouncementTargetScope;
  schoolLevel: SchoolLevel | "";
  grade: number | "";
  classLabel: string;
  student: StudentOption | null;
}): string {
  const { targetScope, schoolLevel, grade, classLabel, student } = params;

  if (targetScope === "all") return "전체";
  if (targetScope === "school_level") return schoolLevel ? getSchoolLevelLabel(schoolLevel) : "-";
  if (targetScope === "grade") {
    if (!schoolLevel || grade === "") return "-";
    return `${getSchoolLevelLabel(schoolLevel)} ${grade}학년`;
  }
  if (targetScope === "class") {
    if (!schoolLevel || grade === "" || !classLabel.trim()) return "-";
    return `${getSchoolLevelLabel(schoolLevel)} ${grade}학년 ${classLabel.trim()}반`;
  }
  return formatStudentSummary(student);
}

export default function NewAnnouncementPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<GuardianLinkRow[] | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceRole, setAudienceRole] = useState<AnnouncementAudienceRole>("all");
  const [targetScope, setTargetScope] = useState<AnnouncementTargetScope>("all");
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | "">("");
  const [grade, setGrade] = useState<number | "">("");
  const [classLabel, setClassLabel] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [requiresAck, setRequiresAck] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
  }, []);

  const initialize = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      setError(OWNER_ANNOUNCEMENT_NEW_TEXT.loadFailed);
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<{ role: string }>();
    if (meError) {
      setError(OWNER_ANNOUNCEMENT_NEW_TEXT.loadFailed);
      setLoading(false);
      return;
    }
    if (!me || (me.role !== "owner" && me.role !== "teacher")) {
      router.replace("/");
      return;
    }

    const [studentResult, guardianResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,name,school_level,grade,class_label,student_no")
        .eq("role", "student")
        .order("name")
        .returns<StudentOption[]>(),
      supabase.from("student_guardians").select("student_id,guardian_id").returns<GuardianLinkRow[]>(),
    ]);

    if (studentResult.error) {
      setError(OWNER_ANNOUNCEMENT_NEW_TEXT.loadStudentsFailed);
      setLoading(false);
      return;
    }

    if (guardianResult.error) {
      console.warn("Guardian links load failed:", toPrettyErrorString(guardianResult.error), guardianResult.error);
      setGuardianLinks(null);
    } else {
      setGuardianLinks(guardianResult.data ?? []);
    }

    setStudents(studentResult.data ?? []);
    setLoading(false);
  };

  const gradeOptions = useMemo(() => getGradeOptions(schoolLevel), [schoolLevel]);
  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId) ?? null, [studentId, students]);

  const matchingStudentIds = useMemo(() => {
    if (targetScope === "all") return students.map((student) => student.id);
    if (targetScope === "school_level") {
      return students.filter((student) => student.school_level === schoolLevel).map((student) => student.id);
    }
    if (targetScope === "grade") {
      return students
        .filter((student) => student.school_level === schoolLevel && student.grade === grade)
        .map((student) => student.id);
    }
    if (targetScope === "class") {
      const normalizedClassLabel = classLabel.trim();
      return students
        .filter(
          (student) =>
            student.school_level === schoolLevel
            && student.grade === grade
            && (student.class_label ?? "").trim() === normalizedClassLabel
        )
        .map((student) => student.id);
    }
    return studentId ? [studentId] : [];
  }, [classLabel, grade, schoolLevel, studentId, students, targetScope]);

  const estimatedRecipientCount = useMemo(() => {
    const studentCount = matchingStudentIds.length;
    if (audienceRole === "student") return studentCount;
    if (guardianLinks === null) return null;

    const parentCount = new Set(
      guardianLinks
        .filter((link) => link.student_id && matchingStudentIds.includes(link.student_id))
        .map((link) => link.guardian_id)
        .filter((guardianId): guardianId is string => typeof guardianId === "string" && guardianId.length > 0)
    ).size;

    if (audienceRole === "parent") return parentCount;
    return studentCount + parentCount;
  }, [audienceRole, guardianLinks, matchingStudentIds]);

  const targetSummary = useMemo(
    () => getTargetSummary({ targetScope, schoolLevel, grade, classLabel, student: selectedStudent }),
    [classLabel, grade, schoolLevel, selectedStudent, targetScope]
  );

  const resetTargetInputs = (nextScope: AnnouncementTargetScope) => {
    setTargetScope(nextScope);
    setSchoolLevel("");
    setGrade("");
    setClassLabel("");
    setStudentId(null);
  };

  const handleAttachmentSelection = (files: FileList | null) => {
    if (!files) {
      setAttachments([]);
      return;
    }

    const nextFiles: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext) || file.size > MAX_ATTACHMENT_BYTES) {
        rejected.push(file.name);
        continue;
      }
      nextFiles.push(file);
    }

    setAttachments(nextFiles);
    if (rejected.length > 0) setError(OWNER_ANNOUNCEMENT_NEW_TEXT.attachmentInvalid);
  };

  const removeAttachmentAt = (index: number) => {
    setAttachments((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const validate = (): string | null => {
    if (!title.trim() || !body.trim()) return OWNER_ANNOUNCEMENT_NEW_TEXT.validationTitleBody;
    if (targetScope === "school_level" && !schoolLevel) return OWNER_ANNOUNCEMENT_NEW_TEXT.validationTarget;
    if (targetScope === "grade" && (!schoolLevel || grade === "")) return OWNER_ANNOUNCEMENT_NEW_TEXT.validationTarget;
    if (targetScope === "class" && (!schoolLevel || grade === "" || !classLabel.trim())) return OWNER_ANNOUNCEMENT_NEW_TEXT.validationTarget;
    if (targetScope === "student" && !studentId) return OWNER_ANNOUNCEMENT_NEW_TEXT.validationTarget;
    return null;
  };

  const buildTargetRow = (announcementId: string) => {
    if (targetScope === "all") {
      return {
        announcement_id: announcementId,
        target_type: "all" as const,
        school_level: null,
        grade: null,
        class_label: null,
        student_id: null,
      };
    }

    if (targetScope === "school_level") {
      return {
        announcement_id: announcementId,
        target_type: "school_level" as const,
        school_level: schoolLevel,
        grade: null,
        class_label: null,
        student_id: null,
      };
    }

    if (targetScope === "grade") {
      return {
        announcement_id: announcementId,
        target_type: "grade" as const,
        school_level: schoolLevel,
        grade: Number(grade),
        class_label: null,
        student_id: null,
      };
    }

    if (targetScope === "class") {
      return {
        announcement_id: announcementId,
        target_type: "class" as const,
        school_level: schoolLevel,
        grade: Number(grade),
        class_label: classLabel.trim(),
        student_id: null,
      };
    }

    return {
      announcement_id: announcementId,
      target_type: "student" as const,
      school_level: null,
      grade: null,
      class_label: null,
      student_id: studentId,
    };
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Missing user");

      const { data: inserted, error: insertError } = await supabase
        .from("announcements")
        .insert({
          title: title.trim(),
          body: body.trim(),
          audience_role: audienceRole,
          requires_ack: requiresAck,
          created_by: user.id,
        })
        .select("id")
        .single<{ id: string }>();
      if (insertError) throw insertError;
      if (!inserted?.id) throw new Error("Missing announcement id");

      const { error: targetError } = await supabase.from("announcement_targets").insert(buildTargetRow(inserted.id));
      if (targetError) throw targetError;

      if (attachments.length > 0) {
        setAttachmentUploading(true);
        const rows: Array<{
          announcement_id: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
        }> = [];

        for (const file of attachments) {
          const filePath = `${user.id}/${Date.now()}_${safeFileName(file.name, "file")}`;
          const contentType = file.type && file.type.length > 0 ? file.type : undefined;
          const { error: uploadError } = await supabase.storage
            .from("announcement_attachments")
            .upload(filePath, file, { upsert: false, contentType });
          if (uploadError) throw uploadError;

          rows.push({
            announcement_id: inserted.id,
            file_name: file.name,
            file_path: filePath,
            file_size: Number.isFinite(file.size) ? file.size : null,
          });
        }

        if (rows.length > 0) {
          const { error: attachmentError } = await supabase.from("announcement_attachments").insert(rows);
          if (attachmentError) throw attachmentError;
        }
      }

      setTitle("");
      setBody("");
      setAudienceRole("all");
      resetTargetInputs("all");
      setRequiresAck(false);
      setAttachments([]);
      setSuccess(OWNER_ANNOUNCEMENT_NEW_TEXT.successRegistered);
      window.setTimeout(() => router.replace("/owner/announcements"), 600);
    } catch (e: unknown) {
      console.error("Announcement create failed:", toPrettyErrorString(e), e);
      setError(prettyUserError());
    } finally {
      setAttachmentUploading(false);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">로딩 중...</main>;
  }

  return (
    <PageShell
      title={OWNER_ANNOUNCEMENT_NEW_TEXT.pageTitle}
      subtitle={OWNER_ANNOUNCEMENT_NEW_TEXT.pageDescription}
      maxWidthClassName="max-w-5xl"
      actions={
        <Link
          href="/owner/announcements"
          className="inline-flex w-full justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] transition hover:bg-[var(--card-soft)] md:w-auto"
        >
          {OWNER_ANNOUNCEMENT_NEW_TEXT.goToList}
        </Link>
      }
      contentClassName="space-y-5 md:space-y-6"
    >
      {error && (
        <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 text-sm text-[var(--success-text)]">
          {success}{" "}
          <Link href="/owner/announcements" className="underline underline-offset-2">
            {OWNER_ANNOUNCEMENT_NEW_TEXT.goToList}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard
          header={OWNER_ANNOUNCEMENT_NEW_TEXT.contentCardTitle}
          description={OWNER_ANNOUNCEMENT_NEW_TEXT.contentCardDescription}
          className="h-full"
        >
          <div className="space-y-5">
            <label className="block text-sm text-[var(--text-muted)]">
              <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.titleLabel}</span>
              <input
                className={inputClassName()}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={OWNER_ANNOUNCEMENT_NEW_TEXT.titlePlaceholder}
              />
            </label>

            <label className="block text-sm text-[var(--text-muted)]">
              <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.bodyLabel}</span>
              <textarea
                className={`${inputClassName()} min-h-48 resize-y`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={OWNER_ANNOUNCEMENT_NEW_TEXT.bodyPlaceholder}
              />
            </label>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
              <label className="inline-flex items-start gap-3 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={requiresAck}
                  onChange={(event) => setRequiresAck(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--border)]"
                />
                <span>
                  <span className="block font-medium">{OWNER_ANNOUNCEMENT_NEW_TEXT.requiresAckLabel}</span>
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">{OWNER_ANNOUNCEMENT_NEW_TEXT.requiresAckHelp}</span>
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm text-[var(--text-muted)]">
                <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.attachmentLabel}</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx,.txt"
                  className={`${inputClassName()} file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--card-soft)] file:px-3 file:py-2 file:text-sm file:text-[var(--text)]`}
                  onChange={(event) => handleAttachmentSelection(event.target.files)}
                />
              </label>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{OWNER_ANNOUNCEMENT_NEW_TEXT.attachmentHelp}</p>

              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-3">
                {attachments.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)]">{OWNER_ANNOUNCEMENT_NEW_TEXT.attachmentSelectedEmpty}</div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={`${file.name}:${file.size}:${index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 truncate text-[var(--text-muted)]">
                          {file.name} ({formatBytes(file.size)})
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[var(--text)]"
                          onClick={() => removeAttachmentAt(index)}
                        >
                          {OWNER_ANNOUNCEMENT_NEW_TEXT.attachmentRemove}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          header={OWNER_ANNOUNCEMENT_NEW_TEXT.targetCardTitle}
          description={OWNER_ANNOUNCEMENT_NEW_TEXT.targetCardDescription}
          className="h-full"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-sm text-[var(--text-muted)]">
                <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.audienceRoleLabel}</span>
                <select
                  className={inputClassName()}
                  value={audienceRole}
                  onChange={(event) => setAudienceRole(event.target.value as AnnouncementAudienceRole)}
                >
                  {ANNOUNCEMENT_AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-[var(--text-muted)]">
                <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.targetScopeLabel}</span>
                <select
                  className={inputClassName()}
                  value={targetScope}
                  onChange={(event) => resetTargetInputs(event.target.value as AnnouncementTargetScope)}
                >
                  {ANNOUNCEMENT_TARGET_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {targetScope === "school_level" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-sm text-[var(--text-muted)]">
                  <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.schoolLevelLabel}</span>
                  <select className={inputClassName()} value={schoolLevel} onChange={(event) => setSchoolLevel(event.target.value as SchoolLevel)}>
                    <option value="">{OWNER_ANNOUNCEMENT_NEW_TEXT.schoolLevelPlaceholder}</option>
                    {SCHOOL_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {targetScope === "grade" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-sm text-[var(--text-muted)]">
                  <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.schoolLevelLabel}</span>
                  <select
                    className={inputClassName()}
                    value={schoolLevel}
                    onChange={(event) => {
                      setSchoolLevel(event.target.value as SchoolLevel);
                      setGrade("");
                    }}
                  >
                    <option value="">{OWNER_ANNOUNCEMENT_NEW_TEXT.schoolLevelPlaceholder}</option>
                    {SCHOOL_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-[var(--text-muted)]">
                  <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.gradeLabel}</span>
                  <select
                    className={inputClassName()}
                    value={grade}
                    onChange={(event) => setGrade(event.target.value ? Number(event.target.value) : "")}
                  >
                    <option value="">{OWNER_ANNOUNCEMENT_NEW_TEXT.gradePlaceholder}</option>
                    {gradeOptions.map((gradeOption) => (
                      <option key={gradeOption} value={gradeOption}>
                        {gradeOption}학년
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {targetScope === "class" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-sm text-[var(--text-muted)]">
                  <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.schoolLevelLabel}</span>
                  <select
                    className={inputClassName()}
                    value={schoolLevel}
                    onChange={(event) => {
                      setSchoolLevel(event.target.value as SchoolLevel);
                      setGrade("");
                      setClassLabel("");
                    }}
                  >
                    <option value="">{OWNER_ANNOUNCEMENT_NEW_TEXT.schoolLevelPlaceholder}</option>
                    {SCHOOL_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-[var(--text-muted)]">
                  <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.gradeLabel}</span>
                  <select
                    className={inputClassName()}
                    value={grade}
                    onChange={(event) => {
                      setGrade(event.target.value ? Number(event.target.value) : "");
                      setClassLabel("");
                    }}
                  >
                    <option value="">{OWNER_ANNOUNCEMENT_NEW_TEXT.gradePlaceholder}</option>
                    {gradeOptions.map((gradeOption) => (
                      <option key={gradeOption} value={gradeOption}>
                        {gradeOption}학년
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-[var(--text-muted)] md:col-span-2">
                  <span>{OWNER_ANNOUNCEMENT_NEW_TEXT.classLabel}</span>
                  <input
                    className={inputClassName()}
                    value={classLabel}
                    onChange={(event) => setClassLabel(event.target.value)}
                    placeholder={OWNER_ANNOUNCEMENT_NEW_TEXT.classPlaceholder}
                  />
                </label>
              </div>
            )}

            {targetScope === "student" && (
              <div className="space-y-2">
                <div className="text-sm text-[var(--text-muted)]">{OWNER_ANNOUNCEMENT_NEW_TEXT.studentLabel}</div>
                <StudentSearchSelect
                  students={students}
                  selectedStudentId={studentId}
                  onSelect={(nextStudentId) => setStudentId(nextStudentId)}
                />
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        header={OWNER_ANNOUNCEMENT_NEW_TEXT.summaryCardTitle}
        description={OWNER_ANNOUNCEMENT_NEW_TEXT.summaryCardDescription}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
            <div className="text-xs text-[var(--text-muted)]">{OWNER_ANNOUNCEMENT_NEW_TEXT.summaryAudienceLabel}</div>
            <div className="mt-2 text-base font-semibold text-[var(--text)]">{getAudienceSummaryLabel(audienceRole)}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
            <div className="text-xs text-[var(--text-muted)]">{OWNER_ANNOUNCEMENT_NEW_TEXT.summaryScopeLabel}</div>
            <div className="mt-2 break-keep text-base font-semibold text-[var(--text)]">{targetSummary}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
            <div className="text-xs text-[var(--text-muted)]">{OWNER_ANNOUNCEMENT_NEW_TEXT.summaryRecipientCountLabel}</div>
            <div className="mt-2 text-base font-semibold text-[var(--text)]">
              {estimatedRecipientCount == null
                ? OWNER_ANNOUNCEMENT_NEW_TEXT.summaryUnknown
                : `${estimatedRecipientCount}${OWNER_ANNOUNCEMENT_NEW_TEXT.summaryStudentCountSuffix}`}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-[var(--text-muted)]">
            {requiresAck ? OWNER_ANNOUNCEMENT_NEW_TEXT.requiresAckHelp : OWNER_ANNOUNCEMENT_NEW_TEXT.pageDescription}
          </div>
          <button
            className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition hover:opacity-95 disabled:opacity-60"
            onClick={() => void submit()}
            disabled={submitting || attachmentUploading}
          >
            {submitting || attachmentUploading ? OWNER_ANNOUNCEMENT_NEW_TEXT.submitting : OWNER_ANNOUNCEMENT_NEW_TEXT.submit}
          </button>
        </div>
      </SectionCard>
    </PageShell>
  );
}
