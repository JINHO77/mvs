"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BadgeShowcasePanel from "@/components/badges/BadgeShowcasePanel";
import PushSubscribeButton from "@/components/pwa/PushSubscribeButton";
import PasswordChangeCard from "@/components/account/PasswordChangeCard";
import PageShell from "@/components/ui/PageShell";
import { formatInterestTagSummary, interestTagLabel, interestTagOptions, normalizeInterestTagSelection, type InterestTagKey } from "@/constants/interestTags";
import { studentHomeCopy } from "@/constants/studentHomeCopy";
import { fetchMyAnnouncements, type MyAnnouncementItem } from '@/lib/announcements';
import { normalizeDisplayText } from '@/lib/uiText';
import { formatSchoolGrade } from "@/lib/academicYear";
import { fetchEffectiveGrade, type EffectiveGradeRow } from "@/lib/effectiveGrade";
import {
  fetchCurriculumUnits,
  fetchMissionProgressMap,
  fetchPublishedMissions,
  getStudentMissionStats,
} from "@/lib/missions";
import { getStudentBadgeShowcase } from "@/lib/badges";
import { getStudentMissionRecommendations, type MissionRecommendationResult } from "@/lib/recommendations";
import { getThisWeekRecommendations, type WeekendRecommendation } from "@/lib/weekendRecommendations";
import XpLevelBar from "@/components/XpLevelBar";
import { getStudentXpStatus, type StudentXpStatus } from "@/lib/xpSystem";
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
  const router = useRouter();
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
  const [weekendRecs, setWeekendRecs] = useState<WeekendRecommendation[]>([]);
  const [xpStatus, setXpStatus] = useState<StudentXpStatus | null>(null);
  const [effectiveGrade, setEffectiveGrade] = useState<EffectiveGradeRow | null>(null);

  const displayGradeLabel = useMemo(() => {
    if (!profile?.school_level || profile?.grade == null) return studentHomeCopy.emptyValue;
    return formatSchoolGrade(profile.school_level, profile.grade);
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

        // XP 현황 조회 (비차단 — 실패해도 대시보드 영향 없음)
        getStudentXpStatus(session.user.id).then((status) => {
          if (mounted && status) setXpStatus(status);
        }).catch(() => {});

        // effective grade (1~2월 예습 모드 신호) — 비차단
        fetchEffectiveGrade(session.user.id).then((row) => {
          if (mounted && row) setEffectiveGrade(row);
        }).catch(() => {});

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

  // 이번 주 주말 챌린지 추천 미션 로드
  useEffect(() => {
    getThisWeekRecommendations()
      .then((recs) => {
        if (recs.length > 0) setWeekendRecs(recs);
      })
      .catch((e) => console.error("weekend recs load failed on dashboard", e));
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

        {effectiveGrade?.is_preview && effectiveGrade.preview_message && (
          <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
            {effectiveGrade.preview_message}
          </div>
        )}

        {!profileLoading && profile && normalizeInterestTagSelection(profile.interest_tags).length === 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">🎯 관심 분야를 설정해보세요!</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)] sm:text-sm">
                좋아하는 주제를 알려주면 더 재미있는 미션을 추천해드려요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/student/onboarding/interests")}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
            >
              설정하기
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          {/* ── 오늘의 학습 미션 (수학 + 영어 통합) ── */}
          <article className="relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[2px]">
            {/* 배경 그라데이션 장식 */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />

            {/* 헤더 */}
            <div className="relative flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">TODAY</p>
                <h3 className="text-xl font-black text-[var(--text)]">오늘의 학습 미션</h3>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                {new Date().toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
              </span>
            </div>

            {/* 본문 문구 */}
            <p className="relative mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
              🎯 <span className="font-medium text-[var(--text)]">오늘 도전할 준비 됐어?</span><br />
              수학과 영어, 각자의 페이스로 오늘 한 걸음씩 나아가보자!
            </p>

            {/* 이번 주 진행 현황 — 학습 데이터 있을 때 */}
            {!loading && !dashboardError && hasLearningSnapshot && (
              <div className="relative mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-3">
                <p className="mb-1 text-xs text-[var(--text-muted)]">이번 주 완료 미션</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${Math.min((missionStats.weeklyCompletedCount / 5) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[var(--accent)]">
                    {missionStats.weeklyCompletedCount}/5
                  </span>
                </div>
              </div>
            )}

            {/* 빈 상태 / 에러 — 에러 문구 대신 부드럽게 */}
            {!loading && (dashboardError || !hasLearningSnapshot) && (
              <div className="relative mt-3 rounded-2xl border border-dashed border-[var(--border)] p-3 text-center">
                <p className="text-xs text-[var(--text-muted)]">
                  📚 학습 경로를 준비하는 중이에요.<br />
                  <span className="font-medium text-[var(--accent)]">아래에서 바로 시작할 수 있어요!</span>
                </p>
              </div>
            )}

            {/* 로딩 중 스켈레톤 */}
            {loading && (
              <div className="relative mt-3 h-10 animate-pulse rounded-2xl bg-[var(--card-soft)]" />
            )}

            {/* 수학 / 영어 버튼 */}
            <div className="relative mt-auto flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push("/student/math")}
                className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-sm font-bold text-[var(--bg)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:opacity-90 active:scale-95"
              >
                <span className="text-base">📐</span>
                <span>수학 시작</span>
                <span className="ml-auto opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/student/english")}
                className="group flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--accent)] px-4 py-3.5 text-sm font-bold text-[var(--accent)] transition-all hover:bg-[var(--accent-soft)] active:scale-95"
              >
                <span className="text-base">📖</span>
                <span>영어 시작</span>
                <span className="ml-auto opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
              </button>
            </div>
          </article>

          {/* ── 주말 챌린지 ── */}
          <article className="flex min-h-[320px] flex-col rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[2px] hover:border-[var(--accent)]">
            <div className="flex min-h-[112px] flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-2xl font-semibold text-[#534AB7] dark:text-[#AFA9EC]">주말 챌린지</h3>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #7F77DD, #D4537E)" }}
                  >
                    +100 XP
                  </span>
                  <p className="text-[10px] text-[#7F77DD]">평일보다 2배 XP</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">창의·융합·논리·협력 — AI 시대 필수 역량</p>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-sm font-bold text-[#7F77DD]">●</span>
                <span className="text-sm text-[var(--text-muted)]">
                  <strong className="text-[var(--text)]">창의·융합 (토)</strong>
                  {" 다른 분야를 연결해 새로운 것을 만드는 능력 — PBL·PhBL로 탐구해요"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-sm font-bold text-[#D4537E]">●</span>
                <span className="text-sm text-[var(--text-muted)]">
                  <strong className="text-[var(--text)]">인성·협력 (일)</strong>
                  {" 철학적 사고와 협력으로 복잡한 세상을 함께 풀어가는 힘을 키워요"}
                </span>
              </div>
            </div>
            {/* ── XP 레벨 현황 ── */}
            {xpStatus && (
              <div className="mt-5">
                <XpLevelBar
                  level={xpStatus.level}
                  levelName={xpStatus.level_name}
                  levelEmoji={xpStatus.level_emoji}
                  levelColor={xpStatus.level_color}
                  totalXp={xpStatus.total_xp}
                  nextLevelXp={xpStatus.next_level_xp}
                  nextLevelName={xpStatus.next_level_name}
                  progressPct={xpStatus.progress_pct}
                  dailyStreak={xpStatus.daily_streak}
                  compact={true}
                />
              </div>
            )}

            {/* ── 이번 주 추천 미션 (토/일 표시) ── */}
            {weekendRecs.length > 0 && (() => {
              const kstDay = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay();
              const dayType = kstDay === 6 ? "saturday" : kstDay === 0 ? "sunday" : null;
              const todayRecs = dayType
                ? weekendRecs.filter((r) => r.day_of_week === dayType)
                : weekendRecs.slice(0, 3);
              if (todayRecs.length === 0) return null;
              const sectionLabel = kstDay === 6
                ? "오늘 (토) 추천 미션"
                : kstDay === 0
                  ? "오늘 (일) 추천 미션"
                  : "이번 주 추천 미션";
              return (
                <div className="mt-5 rounded-2xl border border-[#7F77DD]/30 bg-[#EEEDFE] dark:bg-[#1e1a3a] p-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#7F77DD] dark:text-[#AFA9EC]">
                    ⭐ {sectionLabel}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {todayRecs.map((rec) => (
                      <li key={rec.mission_id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-[var(--text)]">{rec.title}</span>
                        <span className="shrink-0 rounded-full bg-[linear-gradient(135deg,#7F77DD,#D4537E)] px-2 py-0.5 text-[10px] font-semibold text-white">
                          보너스 +100 XP
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            <div className="mt-auto flex flex-col gap-3 pt-5 sm:flex-row">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-95 sm:w-auto"
                onClick={() => {
                  const level = profile?.school_level === "elementary" ? "elementary" : profile?.school_level === "middle" ? "middle" : "all";
                  router.push(`/student/weekend?type=creative&level=${level}`);
                }}
              >
                창의·융합 도전
              </button>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-5 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] sm:w-auto"
                onClick={() => {
                  const level = profile?.school_level === "elementary" ? "elementary" : profile?.school_level === "middle" ? "middle" : "all";
                  router.push(`/student/weekend?type=character&level=${level}`);
                }}
              >
                인성·협력 도전
              </button>
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
                      {effectiveGrade?.is_preview && effectiveGrade.preview_message && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                          {effectiveGrade.preview_message}
                        </p>
                      )}
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
                            className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                                : "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)] hover:border-[var(--accent)]/60 hover:text-[var(--text)]"
                            }`}
                            aria-pressed={selected}
                          >
                            <span aria-hidden>{option.emoji}</span>
                            <span>{interestTagLabel(option.key)}</span>
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

                  <PasswordChangeCard />

                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text)]">{"\uD83D\uDD14 \uC54C\uB9BC \uC124\uC815"}</h3>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {"\uC0C8 \uBBF8\uC158\u00B7\uB9AC\uD3EC\uD2B8\u00B7\uC911\uC694 \uACF5\uC9C0\uB97C \uD478\uC2DC\uB85C \uBC1B\uC544\uBCF4\uC138\uC694."}
                          <br />
                          {"iPhone\uC740 \u2018\uD648 \uD654\uBA74\uC5D0 \uCD94\uAC00\u2019 \uD6C4\uC5D0\uB9CC \uC791\uB3D9\uD574\uC694."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <PushSubscribeButton />
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


