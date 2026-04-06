"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BadgeShowcasePanel from "@/components/badges/BadgeShowcasePanel";
import PageShell from "@/components/ui/PageShell";
import { formatInterestTagSummary, interestTagLabel, interestTagOptions, normalizeInterestTagSelection, type InterestTagKey } from "@/constants/interestTags";
import { studentHomeCopy } from "@/constants/studentHomeCopy";
import { fetchMyAnnouncements, type MyAnnouncementItem } from '@/lib/announcements';
import { normalizeDisplayText } from '@/lib/uiText';
import { getEffectiveSchoolGrade } from "@/lib/academicYear";
import {
  fetchCurriculumUnits,
  fetchMissionProgressMap,
  fetchPublishedMissions,
  getStudentMissionStats,
} from "@/lib/missions";
import { getStudentBadgeShowcase } from "@/lib/badges";
import { getStudentMissionRecommendations, type MissionRecommendationResult } from "@/lib/recommendations";
import { formatReportMonth, listStudentReports, type ReportListItem } from "@/lib/reports";
import type { ProfileSchoolLevel } from "@/lib/studentProfile";
import { supabase } from "@/lib/supabaseClient";
import type { BadgeShowcase } from "@/types/badges";
import type { CurriculumUnit, StudentMissionStats } from "@/types/missions";

const EMPTY_BADGE_SHOWCASE: BadgeShowcase = {
  totalEarned: 0,
  recentBadges: [],
  showcaseBadges: [],
  nextBadge: null,
};

const EMPTY_STATS: StudentMissionStats = {
  totalCompletedMissions: 0,
  todayCompletedCount: 0,
  weeklyCompletedCount: 0,
  lastCompletedAt: null,
  completedDates: [],
};

const FIELD_CLASS_NAME =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]";

type StudentProfile = {
  id: string;
  academy_id: string | null;
  email: string | null;
  name: string | null;
  role: string | null;
  created_at: string | null;
  updated_at: string | null;
  school_level: ProfileSchoolLevel | null;
  grade: number | null;
  class_label: string | null;
  student_no: string | null;
  approved_at: string | null;
  account_status: string | null;
  interest_tags: string[] | null;
};

function formatAlertDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return studentHomeCopy.emptyValue;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function alertCategoryLabel(category?: string | null): string {
  if (category === "report") return "\uB9AC\uD3EC\uD2B8";
  return "\uC54C\uB9BC";
}

function countRecentStudyDays(completedDates: string[], days = 7): number {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const completedSet = new Set(completedDates);
  let count = 0;

  for (let index = 0; index < days; index += 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
    if (completedSet.has(formatter.format(date))) count += 1;
  }

  return count;
}

function roleLabel(role: string | null): string {
  if (role === "student") return studentHomeCopy.roleStudentLabel;
  if (role === "parent") return studentHomeCopy.roleParentLabel;
  if (role === "guardian") return studentHomeCopy.roleGuardianLabel;
  if (role === "teacher") return studentHomeCopy.roleTeacherLabel;
  if (role === "owner") return studentHomeCopy.roleOwnerLabel;
  return role?.trim() || studentHomeCopy.roleStudentLabel;
}

function accountStatusLabel(status: string | null): string {
  if (status === "approved" || status === "active") return studentHomeCopy.statusApprovedLabel;
  if (status === "pending") return studentHomeCopy.statusPendingLabel;
  if (status === "blocked") return studentHomeCopy.statusBlockedLabel;
  if (status === "withdrawn") return studentHomeCopy.statusWithdrawnLabel;
  return status?.trim() || studentHomeCopy.statusApprovedLabel;
}

function classLabelText(value: string | null): string {
  const text = value?.trim();
  return text ? `${text}${studentHomeCopy.classSuffix}` : studentHomeCopy.classValueFallback;
}

function studentNoText(value: string | null): string {
  const text = value?.trim();
  return text || studentHomeCopy.studentNoFallback;
}

export default function StudentDashboardPage() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<MyAnnouncementItem[]>([]);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [missionStats, setMissionStats] = useState<StudentMissionStats>(EMPTY_STATS);
  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editInterestTags, setEditInterestTags] = useState<InterestTagKey[]>([]);
  const [interestTagsSaving, setInterestTagsSaving] = useState(false);
  const [interestTagsSaveError, setInterestTagsSaveError] = useState<string | null>(null);
  const [interestTagsSaveSuccess, setInterestTagsSaveSuccess] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [startNowRecommendation, setStartNowRecommendation] = useState<MissionRecommendationResult | null>(null);
  const [badgeShowcase, setBadgeShowcase] = useState<BadgeShowcase>(EMPTY_BADGE_SHOWCASE);

  const displayGradeLabel = useMemo(() => {
    const effectiveGrade = getEffectiveSchoolGrade(profile?.school_level ?? null, profile?.grade ?? null);
    return effectiveGrade?.label ?? studentHomeCopy.emptyValue;
  }, [profile?.grade, profile?.school_level]);

  const freshUnitCount = useMemo(() => {
    return [...units]
      .filter((unit) => unit.school_level !== "high")
      .sort((a, b) => b.display_order - a.display_order)
      .slice(0, 4)
      .length;
  }, [units]);

  const recentStudyDays = useMemo(() => countRecentStudyDays(missionStats.completedDates), [missionStats.completedDates]);
  const latestReport = reports[0] ?? null;
  const pendingReportCount = useMemo(() => reports.filter((item) => !item.student_read).length, [reports]);

  const selectedInterestSummary = useMemo(() => {
    return formatInterestTagSummary(profile?.interest_tags, "\uC544\uC9C1 \uC120\uD0DD\uD55C \uAD00\uC2EC \uC8FC\uC81C\uAC00 \uC5C6\uC5B4\uC694.");
  }, [profile?.interest_tags]);

  const toggleInterestTag = (tag: InterestTagKey) => {
    setEditInterestTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) return;

        const [announcementResult, profileResult, statsResult, unitsResult, reportsResult, missionsResult, recommendationResult, badgeResult] = await Promise.allSettled([
          fetchMyAnnouncements({ status: "all", limit: 3, offset: 0, query: null, sort: "latest", hasAttachments: null }),
          supabase
            .from("profiles")
            .select("id,academy_id,email,name,role,created_at,updated_at,school_level,grade,class_label,student_no,approved_at,account_status,interest_tags")
            .eq("id", session.user.id)
            .single<StudentProfile>(),
          getStudentMissionStats(),
          fetchCurriculumUnits(),
          listStudentReports(session.user.id),
          fetchPublishedMissions(48),
          getStudentMissionRecommendations(session.user.id),
          getStudentBadgeShowcase(session.user.id, "all"),
        ]);

        if (!mounted) return;

        if (announcementResult.status === "fulfilled") {
          setUnreadCount(announcementResult.value.counts.unread ?? 0);
          setRecentAlerts(announcementResult.value.items.slice(0, 3));
        }
        if (statsResult.status === "fulfilled") setMissionStats(statsResult.value);
        if (unitsResult.status === "fulfilled") setUnits(unitsResult.value);
        if (reportsResult.status === "fulfilled") setReports(reportsResult.value);
        if (badgeResult.status === "fulfilled") setBadgeShowcase(badgeResult.value);
        if (recommendationResult.status === "fulfilled") setStartNowRecommendation(recommendationResult.value.startNow);

        let progressLoadFailed = false;

        if (missionsResult.status === "fulfilled") {
          try {
            const progressMap = await fetchMissionProgressMap(missionsResult.value.map((mission) => mission.id));
            if (!mounted) return;
            setInProgressCount(Object.values(progressMap).filter((item) => item.status === "in_progress").length);
          } catch (progressError) {
            console.error("student dashboard progress load failed", progressError);
            if (!mounted) return;
            progressLoadFailed = true;
            setInProgressCount(0);
          }
        }

        if (profileResult.status === "fulfilled" && !profileResult.value.error) {
          setProfile(profileResult.value.data);
          setEditName(profileResult.value.data.name ?? "");
          setEditInterestTags(normalizeInterestTagSelection(profileResult.value.data.interest_tags));
          setProfileError(null);
        } else {
          setProfile(null);
          setProfileError(studentHomeCopy.profileLoadFailed);
        }

        const hasCriticalLearningFailure =
          statsResult.status === "rejected"
          || unitsResult.status === "rejected"
          || missionsResult.status === "rejected"
          || progressLoadFailed;
        setDashboardError(hasCriticalLearningFailure ? studentHomeCopy.missionLoadFailed : null);
      } catch (error) {
        console.error("student dashboard load failed", error);
        if (!mounted) return;
        setBadgeShowcase(EMPTY_BADGE_SHOWCASE);
        setDashboardError(studentHomeCopy.missionLoadFailedFallback);
      } finally {
        if (mounted) {
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  const handleInterestTagsSave = async () => {
    setInterestTagsSaveError(null);
    setInterestTagsSaveSuccess(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Login required.");

      setInterestTagsSaving(true);
      const normalizedTags = normalizeInterestTagSelection(editInterestTags);
      const { data, error } = await supabase
        .from("profiles")
        .update({ interest_tags: normalizedTags })
        .eq("id", session.user.id)
        .select("id,academy_id,email,name,role,created_at,updated_at,school_level,grade,class_label,student_no,approved_at,account_status,interest_tags")
        .single<StudentProfile>();

      if (error) throw error;
      setProfile(data);
      setEditInterestTags(normalizeInterestTagSelection(data.interest_tags));
      setInterestTagsSaveSuccess("\uAD00\uC2EC \uC8FC\uC81C\uB97C \uC800\uC7A5\uD588\uC5B4\uC694.");
    } catch (error) {
      console.error("student interest tags update failed", error);
      setInterestTagsSaveError("\uAD00\uC2EC \uC8FC\uC81C\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    } finally {
      setInterestTagsSaving(false);
    }
  };
  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSaveError(null);
    setProfileSaveSuccess(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setProfileSaveError(studentHomeCopy.saveNameRequired);
      return;
    }

    setProfileSaving(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Login required.");

      const { data, error } = await supabase
        .from("profiles")
        .update({ name: trimmedName })
        .eq("id", session.user.id)
        .select("id,academy_id,email,name,role,created_at,updated_at,school_level,grade,class_label,student_no,approved_at,account_status,interest_tags")
        .single<StudentProfile>();

      if (error) throw error;
      setProfile(data);
      setEditName(data.name ?? "");
      setEditInterestTags(normalizeInterestTagSelection(data.interest_tags));
      setProfileEditOpen(false);
      setProfileSaveSuccess(studentHomeCopy.saveNameSuccess);
    } catch (error) {
      console.error("student profile update failed", error);
      setProfileSaveError(studentHomeCopy.saveNameFailed);
    } finally {
      setProfileSaving(false);
    }
  };

  const hasLearningSnapshot =
    Boolean(startNowRecommendation)
    || freshUnitCount > 0
    || inProgressCount > 0
    || missionStats.totalCompletedMissions > 0;
  const learningStatusMessage = loading
    ? studentHomeCopy.missionLoading
    : dashboardError
      ? dashboardError
      : hasLearningSnapshot
        ? "새로 열린 단원 " + freshUnitCount + "개와 진행 중인 학습 흐름을 함께 볼 수 있어요."
        : "아직 학습 기록이 없어요. 첫 미션부터 시작해 보세요.";

  const summaryCards = [
    {
      icon: studentHomeCopy.statusIconRecent,
      label: studentHomeCopy.recentStudyLabel,
      value: `${recentStudyDays}${studentHomeCopy.streakUnit}`,
      description: `${studentHomeCopy.recentStudyDescriptionPrefix} ${recentStudyDays}${studentHomeCopy.recentStudyDescriptionSuffix}`,
    },
    {
      icon: studentHomeCopy.statusIconProgress,
      label: studentHomeCopy.inProgressLabel,
      value: `${inProgressCount}`,
      description: `${studentHomeCopy.inProgressDescriptionPrefix} ${inProgressCount}${studentHomeCopy.inProgressDescriptionSuffix}`,
    },
    {
      icon: studentHomeCopy.statusIconChecks,
      label: studentHomeCopy.checksLabel,
      value: `${pendingReportCount + unreadCount}`,
      description: `${studentHomeCopy.checksReportLabel} ${pendingReportCount} · ${studentHomeCopy.checksAlertLabel} ${unreadCount}`,
    },
  ];

  return (
    <PageShell maxWidthClassName="max-w-6xl" contentClassName="mt-0 space-y-5 md:space-y-6">
      <div className="space-y-5 md:space-y-6">
        <section className="rounded-[26px] border border-[var(--border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5 shadow-[var(--shadow)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)] md:text-[2rem]">{studentHomeCopy.heroTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)] md:max-w-2xl">{studentHomeCopy.heroDescription}</p>
            </div>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] md:w-auto"
              onClick={() => {
                setProfilePanelOpen(true);
                setProfileSaveError(null);
                setProfileSaveSuccess(null);
                setInterestTagsSaveError(null);
                setInterestTagsSaveSuccess(null);
                setProfileEditOpen(false);
                setEditName(profile?.name ?? "");
                setEditInterestTags(normalizeInterestTagSelection(profile?.interest_tags));
              }}
            >
              {studentHomeCopy.profileButtonLabel}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <article className="flex min-h-[320px] flex-col rounded-[24px] border border-[rgba(231,200,115,0.22)] bg-[var(--card)] p-8 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[2px] hover:border-[rgba(231,200,115,0.42)]">
            <div className="flex min-h-[112px] flex-col">
              <h3 className="text-2xl font-semibold text-[var(--text)]">{studentHomeCopy.learningTitle}</h3>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{studentHomeCopy.learningDescription}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{studentHomeCopy.learningDescriptionSecondary}</p>
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-muted)]">
              {startNowRecommendation
                ? normalizeDisplayText(startNowRecommendation.reason, studentHomeCopy.learningSecondary)
                : studentHomeCopy.learningSecondary}
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">{"\uAD00\uC2EC \uC8FC\uC81C: " + selectedInterestSummary}</p>
            <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row">
              <Link href="/student/math" className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95 sm:w-auto">
                {studentHomeCopy.learningPrimaryButton}
              </Link>
              <Link href={studentHomeCopy.learningSecondaryHref} className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-5 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] sm:w-auto">
                {studentHomeCopy.learningSecondaryButton}
              </Link>
            </div>
            {!loading && !dashboardError && hasLearningSnapshot && (
              <p className="mt-4 text-xs text-[var(--text-muted)]">{learningStatusMessage}</p>
            )}
            {loading && <p className="mt-4 text-xs text-[var(--text-muted)]">{learningStatusMessage}</p>}
            {!loading && dashboardError && <p className="mt-4 text-xs text-[#FFB4B4]">{learningStatusMessage}</p>}
            {!loading && !dashboardError && !hasLearningSnapshot && (
              <p className="mt-4 text-xs text-[var(--text-muted)]">{learningStatusMessage}</p>
            )}
          </article>

          <article className="flex min-h-[320px] flex-col rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[2px] hover:border-[var(--accent)]">
            <div className="flex min-h-[112px] flex-col">
              <h3 className="text-2xl font-semibold text-[var(--text)]">{"\uC601\uC5B4 \uD559\uC2B5"}</h3>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{"\uB300\uD654, \uC548\uB0B4\uBB38, \uD559\uAD50\uC0DD\uD65C \uC8FC\uC81C\uB85C \uC601\uC5B4\uB97C \uC774\uD574\uD558\uACE0 \uD45C\uD604\uD574 \uBCF4\uC138\uC694."}</p>
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-[rgba(126,214,165,0.24)] bg-[rgba(126,214,165,0.08)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">{"\uC57D\uC18D \uC7A1\uAE30, \uC548\uB0B4\uBB38 \uC77D\uAE30, \uC758\uACAC \uB9D0\uD558\uAE30 \uAC19\uC740 \uC601\uC5B4 \uACFC\uC5C5\uC744 \uB9CC\uB098 \uBCF4\uC138\uC694."}</div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">{"\uAD00\uC2EC \uC8FC\uC81C\uB97C \uBC18\uC601\uD55C \uC601\uC5B4 \uCD94\uCC9C\uB3C4 \uD568\uAED8 \uBCFC \uC218 \uC788\uC5B4\uC694."}</p>
            <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row">
              <Link href="/student/english" className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95 sm:w-auto">
                {"\uC601\uC5B4 \uC2DC\uC791"}
              </Link>
            </div>
          </article>

          <article className="flex min-h-[320px] flex-col rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[2px] hover:border-[var(--accent)]">
            <div className="flex min-h-[112px] flex-col">
              <h3 className="text-2xl font-semibold text-[var(--text)]">{studentHomeCopy.reportTitle}</h3>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                {studentHomeCopy.reportDescription}
              </p>
            </div>
            {!latestReport ? (
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-5 text-sm text-[var(--text-muted)]">
                {studentHomeCopy.reportEmpty}
              </div>
            ) : (
              <>
                <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                  <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.reportMonthLabel}</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text)]">{formatReportMonth(latestReport.month)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${latestReport.student_read ? "border-[#7DD3A8] bg-[rgba(125,211,168,0.12)] text-[#7DD3A8]" : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                    {latestReport.student_read ? studentHomeCopy.reportStudentDone : studentHomeCopy.reportStudentPending}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${latestReport.parent_total_count === 0 ? "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]" : latestReport.parent_all_read ? "border-[#7DD3A8] bg-[rgba(125,211,168,0.12)] text-[#7DD3A8]" : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                    {latestReport.parent_total_count === 0 ? studentHomeCopy.reportParentNone : latestReport.parent_all_read ? studentHomeCopy.reportParentDone : studentHomeCopy.reportParentPending}
                  </span>
                </div>
                <p className="mt-4 text-sm text-[var(--text-muted)]">{`${studentHomeCopy.reportIssuedLabel} ${formatAlertDate(latestReport.created_at)}`}</p>
              </>
            )}
            <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row">
              <Link href={latestReport ? `/reports/${latestReport.id}` : "/student/reports"} className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95 sm:w-auto">
                {studentHomeCopy.reportViewButton}
              </Link>
              <Link href="/student/reports" className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-5 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] sm:w-auto">
                {studentHomeCopy.reportAllButton}
              </Link>
            </div>
          </article>

          <article className="flex min-h-[320px] flex-col rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[2px] hover:border-[var(--accent)]">
            <div className="flex min-h-[112px] items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-semibold text-[var(--text)]">{studentHomeCopy.alertsTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{studentHomeCopy.alertsDescription}</p>
              </div>
              <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--accent)]">
                {`${studentHomeCopy.unreadCountLabel} ${loading ? studentHomeCopy.emptyValue : unreadCount}`}
              </span>
            </div>
            <div className="mt-6 space-y-3">
              {recentAlerts.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-5 text-sm text-[var(--text-muted)]">
                  {loading ? studentHomeCopy.alertsLoading : studentHomeCopy.alertsEmpty}
                </div>
              ) : (
                recentAlerts.map((item) => (
                  <Link key={item.id} href={`/announcements/${item.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-4 transition-colors hover:border-[var(--accent)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                          {alertCategoryLabel(item.category)}
                        </span>
                        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[var(--text)]">
                          {normalizeDisplayText(item.title, studentHomeCopy.alertFallbackTitle)}
                        </p>
                      </div>
                      <span className="shrink-0 pt-0.5 text-xs text-[var(--text-muted)]/80">{formatAlertDate(item.created_at)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="mt-auto pt-8">
              <Link href="/announcements" className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-5 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] sm:w-auto">
                {studentHomeCopy.allAlertsLabel}
              </Link>
            </div>
          </article>
        </section>

        <section>
          <BadgeShowcasePanel
            showcase={badgeShowcase}
            emptyTitle={"첫 배지가 기다리고 있어요"}
            emptyBody={"영어와 수학 미션을 이어 가면 첫 배지부터 연속 성공 배지까지 차근차근 열려요."}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <article key={card.label} className="min-h-[160px] rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[2px] hover:border-[var(--accent)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] text-[11px] font-semibold text-[var(--text)]">
                  {card.icon}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-muted)]">{card.label}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]/80">{card.description}</p>
                </div>
              </div>
              <p className="mt-8 text-[2rem] font-semibold tracking-tight text-[var(--text)]">{card.value}</p>
            </article>
          ))}
        </section>
      </div>

      {profilePanelOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label={studentHomeCopy.closePanelLabel}
            onClick={() => {
              setProfilePanelOpen(false);
              setProfileEditOpen(false);
              setProfileSaveError(null);
              setProfileSaveSuccess(null);
              setInterestTagsSaveError(null);
              setInterestTagsSaveSuccess(null);
              setEditName(profile?.name ?? "");
              setEditInterestTags(normalizeInterestTagSelection(profile?.interest_tags));
            }}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-[var(--border)] bg-[var(--bg)] p-5 shadow-2xl sm:w-[30rem]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">{studentHomeCopy.profilePanelTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{studentHomeCopy.profilePanelDescription}</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                onClick={() => {
                  setProfilePanelOpen(false);
                  setProfileEditOpen(false);
                  setProfileSaveError(null);
                  setProfileSaveSuccess(null);
                  setInterestTagsSaveError(null);
                  setInterestTagsSaveSuccess(null);
                  setEditName(profile?.name ?? "");
                  setEditInterestTags(normalizeInterestTagSelection(profile?.interest_tags));
                }}
              >
                {studentHomeCopy.closePanelLabel}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
                {studentHomeCopy.profileHelperDescription}
              </div>

              {profileLoading && <p className="text-sm text-[var(--text-muted)]">{studentHomeCopy.profileLoading}</p>}
              {!profileLoading && profileError && <p className="text-sm text-[#FFB4B4]">{profileError}</p>}
              {profileSaveError && <p className="text-sm text-[#FFB4B4]">{profileSaveError}</p>}
              {profileSaveSuccess && <p className="text-sm text-[#7DD3A8]">{profileSaveSuccess}</p>}
              {interestTagsSaveError && <p className="text-sm text-[#FFB4B4]">{interestTagsSaveError}</p>}
              {interestTagsSaveSuccess && <p className="text-sm text-[#7DD3A8]">{interestTagsSaveSuccess}</p>}

              {!profileLoading && profile && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:col-span-2">
                      <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.nameLabel}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{profile.name?.trim() || studentHomeCopy.emptyValue}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:col-span-2">
                      <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.emailLabel}</p>
                      <p className="mt-2 break-all text-sm font-semibold text-[var(--text)]">{profile.email?.trim() || studentHomeCopy.emptyValue}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                      <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.roleLabel}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{roleLabel(profile.role)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                      <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.gradeLabel}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{displayGradeLabel || studentHomeCopy.emptyValue}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                      <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.classLabel}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{classLabelText(profile.class_label)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                      <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.studentNoLabel}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{studentNoText(profile.student_no)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:col-span-2">
                      <p className="text-xs text-[var(--text-muted)]">{studentHomeCopy.accountStatusLabel}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{accountStatusLabel(profile.account_status)}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text)]">{"\uAD00\uC2EC \uC8FC\uC81C"}</h3>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">{"\uC88B\uC544\uD558\uB294 \uC8FC\uC81C\uB97C \uC120\uD0DD\uD558\uBA74 \uCD94\uCC9C \uBBF8\uC158\uC774 \uB354 \uC798 \uB9DE\uC544\uC9D1\uB2C8\uB2E4."}</p>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{"\uC5EC\uB7EC \uAC1C\uB97C \uC120\uD0DD\uD574\uB3C4 \uAD1C\uCC2E\uC544\uC694."}</p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
                      <p className="text-xs text-[var(--text-muted)]">{"\uD604\uC7AC \uC120\uD0DD\uB41C \uAD00\uC2EC \uC8FC\uC81C"}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{selectedInterestSummary}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {interestTagOptions.map((option) => {
                        const selected = editInterestTags.includes(option.key);
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => toggleInterestTag(option.key)}
                            className={`inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm transition ${
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                                : "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)] hover:border-[var(--accent)]/60 hover:text-[var(--text)]"
                            }`}
                            aria-pressed={selected}
                          >
                            {interestTagLabel(option.key)}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                        onClick={() => {
                          setInterestTagsSaveError(null);
                          setInterestTagsSaveSuccess(null);
                          setEditInterestTags(normalizeInterestTagSelection(profile.interest_tags));
                        }}
                        disabled={interestTagsSaving}
                      >
                        {"\uB098\uC911\uC5D0 \uD558\uAE30"}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity disabled:opacity-60"
                        onClick={() => void handleInterestTagsSave()}
                        disabled={interestTagsSaving}
                      >
                        {interestTagsSaving ? "\uC800\uC7A5 \uC911..." : "\uC800\uC7A5"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-[var(--text)]">{studentHomeCopy.editNameLabel}</h3>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                        onClick={() => {
                          setProfileEditOpen((open) => !open);
                          setProfileSaveError(null);
                          setProfileSaveSuccess(null);
                          setEditName(profile.name ?? "");
                        }}
                      >
                        {profileEditOpen ? studentHomeCopy.editNameCloseLabel : studentHomeCopy.editNameLabel}
                      </button>
                    </div>

                    {profileEditOpen && (
                      <form className="mt-4" onSubmit={(event) => void handleProfileSave(event)}>
                        <label className="block space-y-2">
                          <span className="text-sm text-[var(--text-muted)]">{studentHomeCopy.nameLabel}</span>
                          <input
                            className={FIELD_CLASS_NAME}
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            placeholder={studentHomeCopy.nameLabel}
                            maxLength={30}
                          />
                        </label>
                        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-xs text-[var(--text-muted)]">
                          {studentHomeCopy.readonlyDescription}
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                            onClick={() => {
                              setProfileEditOpen(false);
                              setProfileSaveError(null);
                              setProfileSaveSuccess(null);
                              setEditName(profile.name ?? "");
                            }}
                            disabled={profileSaving}
                          >
                            {studentHomeCopy.cancelLabel}
                          </button>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity disabled:opacity-60"
                            disabled={profileSaving}
                          >
                            {profileSaving ? studentHomeCopy.saveInProgress : studentHomeCopy.saveLabel}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  );
}


