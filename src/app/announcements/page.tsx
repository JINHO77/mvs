"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { ANNOUNCEMENT_TEXT } from "@/constants/announcements.ko";
import type { MyAnnouncementCounts, MyAnnouncementItem } from "@/lib/announcements";
import {
  categoryBadgeClass,
  categoryBorderClass,
  daysAgo,
  formatDaysAgo,
  getCategoryDisplay,
  getPriorityDisplay,
} from "@/lib/announcementDisplay";
import { PRIORITY_META } from "@/constants/announcement";
import { getLinkedStudentCountForGuardian } from "@/lib/parentGuard";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type CategoryTabKey = "consultation" | "report" | "urgent" | "event" | "schedule" | "general";

const CATEGORY_TABS: Array<{ key: CategoryTabKey | null; label: string; icon: string }> = [
  { key: null, label: "전체", icon: "📋" },
  { key: "consultation", label: "상담", icon: "💬" },
  { key: "report", label: "리포트", icon: "📊" },
  { key: "urgent", label: "긴급", icon: "🚨" },
  { key: "event", label: "이벤트", icon: "🎉" },
  { key: "schedule", label: "일정", icon: "📅" },
  { key: "general", label: "일반", icon: "📣" },
];

function buildTabHref(key: CategoryTabKey | null): string {
  if (!key) return "/announcements";
  return `/announcements?category=${key}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterMode = "all" | "unread" | "unacknowledged" | "pinned";
type SortMode = "latest" | "oldest";

type AnnouncementWithMeta = MyAnnouncementItem & {
  is_starred: boolean;
  is_hidden: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

function preview(body: string): string {
  const text = body.replace(/<!--\s*character:[a-z0-9_]+\s*-->/gi, "").trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 120)}...`;
}

function isMissingAccountStatusError(error: unknown): boolean {
  const pretty = toPrettyErrorString(error).toLowerCase();
  return pretty.includes("account_status")
    && (pretty.includes("does not exist") || pretty.includes("column") || pretty.includes("42703"));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  // useSearchParams() requires a Suspense boundary during static prerender.
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
          {ANNOUNCEMENT_TEXT.loading}
        </main>
      }
    >
      <AnnouncementsPageInner />
    </Suspense>
  );
}

function AnnouncementsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const excludeCategoryParam = searchParams.get("exclude_category");
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const text = ANNOUNCEMENT_TEXT as Record<string, string>;

  const includeCategories = useMemo(
    () => (categoryFilter ? categoryFilter.split(",").map((c) => c.trim()).filter(Boolean) : null),
    [categoryFilter]
  );
  const excludeCategories = useMemo(
    () => (excludeCategoryParam ? excludeCategoryParam.split(",").map((c) => c.trim()).filter(Boolean) : null),
    [excludeCategoryParam]
  );

  const activeTabKey: CategoryTabKey | null =
    includeCategories && includeCategories.length === 1
      ? (includeCategories[0] as CategoryTabKey)
      : null;

  const tabAllLabel = text.tabAll ?? ANNOUNCEMENT_TEXT.filterAll;
  const tabUnreadLabel = text.tabUnread ?? ANNOUNCEMENT_TEXT.filterUnread;
  const tabUnackLabel = text.tabUnacknowledged ?? "확인 필요";
  const tabPinnedLabel = ANNOUNCEMENT_TEXT.filterStarred;
  const ackDoneBadge = text.ackDoneBadge ?? "확인 완료";

  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devErrorSummary, setDevErrorSummary] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementWithMeta[]>([]);
  const [counts, setCounts] = useState<MyAnnouncementCounts>({
    total: 0,
    unread: 0,
    unacknowledged: 0,
    pinned: 0,
    with_attachments: 0,
  });
  const [undoTarget, setUndoTarget] = useState<string | null>(null);
  const [deletedItems, setDeletedItems] = useState<AnnouncementWithMeta[]>([]);

  const [queryText, setQueryText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [withAttachmentOnly, setWithAttachmentOnly] = useState(false);
  const [bulkMarking, setBulkMarking] = useState(false);
  const [offset, setOffset] = useState(0);
  const reqRef = useRef(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(queryText), 400);
    return () => window.clearTimeout(timer);
  }, [queryText]);

  useEffect(() => {
    if (!isReady) return;
    void loadAnnouncements();
  }, [isReady, debouncedQuery, filterMode, sortMode, withAttachmentOnly, offset]);

  // ── Init ─────────────────────────────────────────────────────────────────

  const initialize = async () => {
    setError(null);
    setDevErrorSummary(null);

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      setError(`${ANNOUNCEMENT_TEXT.loadErrorFallback} 승인 상태/권한을 확인해 주세요.`);
      setDevErrorSummary(toPrettyErrorString(sessionError));
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    setUserId(session.user.id);

    let role = "";
    let status = "active";

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null; account_status: string | null }>();

    if (profileError) {
      if (!isMissingAccountStatusError(profileError)) {
        setError(`${ANNOUNCEMENT_TEXT.loadErrorFallback} 승인 상태/권한을 확인해 주세요.`);
        setDevErrorSummary(toPrettyErrorString(profileError));
        setLoading(false);
        return;
      }
      const { data: fallbackProfile, error: fallbackError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null }>();
      if (fallbackError) {
        setError(`${ANNOUNCEMENT_TEXT.loadErrorFallback} 승인 상태/권한을 확인해 주세요.`);
        setDevErrorSummary(toPrettyErrorString(fallbackError));
        setLoading(false);
        return;
      }
      role = (fallbackProfile?.role ?? "").trim();
      status = "active";
    } else {
      role = (profileRow?.role ?? "").trim();
      status = (profileRow?.account_status ?? "active").trim();
    }

    if (role === "owner") { router.replace("/owner/announcements"); return; }
    if (status === "pending") { router.replace("/onboarding/pending"); return; }
    if (status === "blocked" || status === "withdrawn") { router.replace("/onboarding/blocked"); return; }

    if (role === "parent") {
      try {
        const linkedCount = await getLinkedStudentCountForGuardian(session.user.id);
        if (linkedCount === 0) { router.replace("/parent/onboarding/link"); return; }
      } catch (e: unknown) {
        console.error("Announcements guardian link check failed:", toPrettyErrorString(e), e);
      }
    }

    setIsReady(true);
    setLoading(false);
  };

  // ── Load ─────────────────────────────────────────────────────────────────
  // RLS on `announcements` is the single source of truth for visibility.
  // We do NOT use the RPC `get_my_announcements` (its own audience_role filter
  // masks rows the post-fix RLS would otherwise expose) and we do NOT use the
  // `v_announcements_display` view (Postgres views run with the view-owner's
  // privileges by default and BYPASS RLS unless created
  // `WITH (security_invoker = on)`). Read state and attachment counts are
  // composed client-side.

  const loadAnnouncements = async () => {
    setListLoading(true);
    setError(null);
    setDevErrorSummary(null);
    try {
      const reqId = ++reqRef.current;

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      // SECURITY: read from the base table — RLS policy
      // `announcements_select_visible_targets` enforces visibility per user.
      // The `v_announcements_display` view bypasses RLS unless created
      // WITH (security_invoker = on), so we don't trust it for reads.
      // Priority ordering is handled client-side via PRIORITY_META.weight.
      const rowsRes = await supabase
        .from("announcements")
        .select("id,title,body,category,priority,requires_ack,scheduled_at,published_at,audience_role,notification_channels,created_at")
        .eq("is_deleted", false)
        .lte("published_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (reqId !== reqRef.current) return;
      if (rowsRes.error) throw rowsRes.error;

      const rawRows = (rowsRes.data ?? []) as Array<Record<string, unknown>>;
      const ids = rawRows
        .map((r) => (typeof r.id === "string" ? r.id : null))
        .filter((id): id is string => id !== null);

      const [readsRes, attachmentsRes] = await Promise.all([
        currentUser && ids.length > 0
          ? supabase
              .from("announcement_reads")
              .select("announcement_id,read_at,acknowledged_at,is_starred,is_hidden")
              .eq("user_id", currentUser.id)
              .in("announcement_id", ids)
          : Promise.resolve({ data: [], error: null } as const),
        ids.length > 0
          ? supabase
              .from("announcement_attachments")
              .select("announcement_id")
              .in("announcement_id", ids)
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (reqId !== reqRef.current) return;

      type ReadRow = {
        announcement_id: string;
        read_at: string | null;
        acknowledged_at: string | null;
        is_starred: boolean | null;
        is_hidden: boolean | null;
      };
      const reads = (readsRes.data ?? []) as ReadRow[];
      const readsByAnn = new Map<string, ReadRow>();
      for (const r of reads) readsByAnn.set(r.announcement_id, r);

      const attachmentCounts = new Map<string, number>();
      for (const att of (attachmentsRes.data ?? []) as Array<{ announcement_id: string }>) {
        attachmentCounts.set(att.announcement_id, (attachmentCounts.get(att.announcement_id) ?? 0) + 1);
      }

      const items: AnnouncementWithMeta[] = rawRows.map((row) => {
        const id = typeof row.id === "string" ? row.id : "";
        const r = readsByAnn.get(id);
        const isRead = r?.read_at != null;
        const isAcknowledged = r?.acknowledged_at != null;
        const isPinned = !!r?.is_starred;
        const viewAttachmentCount =
          typeof row.attachment_count === "number" ? row.attachment_count : null;
        return {
          id,
          title: typeof row.title === "string" ? row.title : "",
          body: typeof row.body === "string" ? row.body : "",
          created_at:
            typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
          requires_ack: typeof row.requires_ack === "boolean" ? row.requires_ack : false,
          scheduled_at: typeof row.scheduled_at === "string" ? row.scheduled_at : null,
          category:
            typeof row.category === "string"
              ? (row.category as MyAnnouncementItem["category"])
              : "general",
          audience_role:
            typeof row.audience_role === "string"
              ? (row.audience_role as MyAnnouncementItem["audience_role"])
              : "all",
          priority:
            typeof row.priority === "string"
              ? (row.priority as MyAnnouncementItem["priority"])
              : "normal",
          published_at: typeof row.published_at === "string" ? row.published_at : null,
          notification_channels: Array.isArray(row.notification_channels)
            ? (row.notification_channels as string[])
            : ["in_app"],
          is_read: isRead,
          is_acknowledged: isAcknowledged,
          is_pinned: isPinned,
          attachment_count: viewAttachmentCount ?? attachmentCounts.get(id) ?? 0,
          target_summary: typeof row.target_summary === "string" ? row.target_summary : "-",
          is_starred: isPinned,
          is_hidden: !!r?.is_hidden,
        };
      });

      // Priority-weight + recency sort, since the base-table query can only
      // ORDER BY columns it has (no priority_weight without the view).
      const visibleItems = items
        .filter((it) => !it.is_hidden)
        .sort((a, b) => {
          const wa = PRIORITY_META[a.priority]?.weight ?? 99;
          const wb = PRIORITY_META[b.priority]?.weight ?? 99;
          if (wa !== wb) return wa - wb;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      setAnnouncements(visibleItems);
      setCounts({
        total: visibleItems.length,
        unread: visibleItems.filter((i) => !i.is_read).length,
        unacknowledged: visibleItems.filter((i) => i.requires_ack && !i.is_acknowledged).length,
        pinned: visibleItems.filter((i) => i.is_pinned).length,
        with_attachments: visibleItems.filter((i) => i.attachment_count > 0).length,
      });
    } catch (e: unknown) {
      const pretty = toPrettyErrorString(e).toLowerCase();
      const missingView = pretty.includes("v_announcements_display") || pretty.includes("42p01");
      console.error("Announcements load failed:", toPrettyErrorString(e), e);
      setAnnouncements([]);
      setCounts({ total: 0, unread: 0, unacknowledged: 0, pinned: 0, with_attachments: 0 });
      setError(missingView
        ? "알리미함 기능 준비 중입니다. 관리자에게 문의해 주세요."
        : `${ANNOUNCEMENT_TEXT.loadErrorFallback} 승인 상태/권한을 확인해 주세요.`);
      setDevErrorSummary(missingView ? null : toPrettyErrorString(e));
    } finally {
      setListLoading(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleMarkAllRead = async () => {
    if (!userId || bulkMarking) return;
    const unreadIds = announcements.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length === 0) return;

    setBulkMarking(true);
    const nowIso = new Date().toISOString();
    // Optimistic update
    setAnnouncements((prev) => prev.map((a) => (a.is_read ? a : { ...a, is_read: true })));
    try {
      const { error } = await supabase.from("announcement_reads").upsert(
        unreadIds.map((id) => ({
          announcement_id: id,
          user_id: userId,
          read_at: nowIso,
        })),
        { onConflict: "announcement_id,user_id" }
      );
      if (error) throw error;
      setCounts((prev) => ({ ...prev, unread: 0 }));
    } catch (e) {
      console.error("handleMarkAllRead failed:", e);
      void loadAnnouncements();
    } finally {
      setBulkMarking(false);
    }
  };

  const handleStar = async (annoId: string) => {
    if (!userId) return;
    const current = announcements.find((a) => a.id === annoId);
    const newVal = !current?.is_starred;
    setAnnouncements((prev) => prev.map((a) => a.id === annoId ? { ...a, is_starred: newVal } : a));
    try {
      await supabase.from("announcement_reads").upsert(
        { announcement_id: annoId, user_id: userId, is_starred: newVal, read_at: new Date().toISOString() },
        { onConflict: "announcement_id,user_id" }
      );
    } catch (e) {
      console.error("handleStar failed:", e);
      // 실패 시 롤백
      setAnnouncements((prev) => prev.map((a) => a.id === annoId ? { ...a, is_starred: !newVal } : a));
    }
  };

  const handleToggleRead = async (annoId: string, isRead: boolean) => {
    if (!userId) return;
    setAnnouncements((prev) => prev.map((a) => a.id === annoId ? { ...a, is_read: !isRead } : a));
    try {
      if (!isRead) {
        await supabase.from("announcement_reads").upsert(
          { announcement_id: annoId, user_id: userId, read_at: new Date().toISOString() },
          { onConflict: "announcement_id,user_id" }
        );
      } else {
        await supabase.from("announcement_reads")
          .update({ read_at: null })
          .eq("announcement_id", annoId)
          .eq("user_id", userId);
      }
    } catch (e) {
      console.error("handleToggleRead failed:", e);
      setAnnouncements((prev) => prev.map((a) => a.id === annoId ? { ...a, is_read: isRead } : a));
    }
  };

  const handleDelete = async (annoId: string) => {
    if (!userId) return;
    const item = announcements.find((a) => a.id === annoId);
    if (!item) return;

    setAnnouncements((prev) => prev.filter((a) => a.id !== annoId));
    setDeletedItems((prev) => [...prev, item]);

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoTarget(annoId);
    undoTimerRef.current = setTimeout(() => {
      setUndoTarget(null);
      setDeletedItems((prev) => prev.filter((a) => a.id !== annoId));
    }, 3000);

    try {
      await supabase.from("announcement_reads").upsert(
        { announcement_id: annoId, user_id: userId, is_hidden: true, read_at: new Date().toISOString() },
        { onConflict: "announcement_id,user_id" }
      );
    } catch (e) {
      console.error("handleDelete failed:", e);
    }
  };

  const handleUndo = async (annoId: string) => {
    if (!userId) return;
    const item = deletedItems.find((a) => a.id === annoId);
    if (!item) return;

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoTarget(null);
    setDeletedItems((prev) => prev.filter((a) => a.id !== annoId));
    setAnnouncements((prev) => {
      if (prev.some((a) => a.id === annoId)) return prev;
      return [item, ...prev];
    });

    try {
      await supabase.from("announcement_reads")
        .update({ is_hidden: false })
        .eq("announcement_id", annoId)
        .eq("user_id", userId);
    } catch (e) {
      console.error("handleUndo failed:", e);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  // "starred" 탭은 RPC의 "pinned" 필터를 사용하므로 서버에서 이미 필터링됨.
  // 클라이언트에서 낙관적으로 is_starred를 반영해 표시.
  const filterByCategory = (rows: AnnouncementWithMeta[]): AnnouncementWithMeta[] => {
    if (includeCategories && includeCategories.length > 0) {
      const set = new Set(includeCategories);
      return rows.filter((row) => row.category != null && set.has(row.category));
    }
    if (excludeCategories && excludeCategories.length > 0) {
      const set = new Set(excludeCategories);
      return rows.filter((row) => !(row.category != null && set.has(row.category)));
    }
    return rows;
  };

  const displayedAnnouncements = useMemo(() => {
    let base: AnnouncementWithMeta[];
    if (filterMode === "pinned") {
      base = announcements.filter((a) => a.is_starred);
    } else if (filterMode === "unread") {
      base = announcements.filter((a) => !a.is_read);
    } else if (filterMode === "unacknowledged") {
      base = announcements.filter((a) => a.requires_ack && !a.is_acknowledged);
    } else {
      base = announcements;
    }

    if (withAttachmentOnly) {
      base = base.filter((a) => a.attachment_count > 0);
    }

    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((a) =>
        a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
      );
    }

    base = filterByCategory(base);

    if (sortMode === "oldest") {
      base = [...base].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    announcements,
    filterMode,
    withAttachmentOnly,
    debouncedQuery,
    sortMode,
    includeCategories,
    excludeCategories,
  ]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: announcements.length };
    for (const tab of CATEGORY_TABS) {
      if (!tab.key) continue;
      counts[tab.key] = announcements.filter((row) => row.category === tab.key).length;
    }
    return counts;
  }, [announcements]);

  const pageTitle =
    activeTabKey === "consultation"
      ? "💬 상담 알림함"
      : activeTabKey === "urgent"
        ? "🚨 긴급 알림함"
        : activeTabKey === "report"
          ? "📊 리포트 알림함"
          : activeTabKey === "event"
            ? "🎉 이벤트 알림함"
            : activeTabKey === "schedule"
              ? "📅 일정 알림함"
              : activeTabKey === "general"
                ? "📣 일반 알리미"
                : ANNOUNCEMENT_TEXT.title;

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        {ANNOUNCEMENT_TEXT.loading}
      </main>
    );
  }

  return (
    <PageShell
      title={pageTitle}
      subtitle={ANNOUNCEMENT_TEXT.subtitle}
      maxWidthClassName="max-w-5xl"
      actions={<HomeLink />}
    >
      <SectionCard>
        {/* 카테고리 탭 */}
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => {
            const isActive = (tab.key === null && activeTabKey === null && !excludeCategories)
              || (tab.key !== null && activeTabKey === tab.key);
            const count = tabCounts[tab.key ?? "all"];
            return (
              <Link
                key={tab.key ?? "all"}
                href={buildTabHref(tab.key)}
                className={
                  isActive
                    ? "rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-1.5 text-sm font-bold text-[var(--accent)]"
                    : "rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-1.5 text-sm text-[var(--text-muted)] transition hover:border-[var(--accent)]"
                }
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
                {typeof count === "number" && count > 0 && (
                  <span className="ml-1 text-xs opacity-70">({count})</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* 요약 뱃지 + 빠른 액션 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-xs text-[var(--text)]">
              {ANNOUNCEMENT_TEXT.summaryUnread} {counts.unread}
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-xs text-[var(--text)]">
              {tabUnackLabel} {counts.unacknowledged}
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-xs text-[var(--text)]">
              {ANNOUNCEMENT_TEXT.summaryStarred} {counts.pinned}
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-xs text-[var(--text)]">
              {ANNOUNCEMENT_TEXT.summaryWithAttachments} {counts.with_attachments}
            </span>
          </div>
          {counts.unread > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={bulkMarking}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              {bulkMarking ? "처리 중..." : `✓ 모두 읽음 (${counts.unread})`}
            </button>
          )}
        </div>

        {/* 검색 + 필터 */}
        <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-3 md:p-4">
          <input
            type="text"
            value={queryText}
            onChange={(e) => { setQueryText(e.target.value); setOffset(0); }}
            placeholder={ANNOUNCEMENT_TEXT.searchPlaceholder}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 text-sm">
              {(
                [
                  { mode: "all" as FilterMode, label: tabAllLabel },
                  { mode: "unread" as FilterMode, label: tabUnreadLabel },
                  { mode: "unacknowledged" as FilterMode, label: tabUnackLabel },
                  { mode: "pinned" as FilterMode, label: tabPinnedLabel },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  className={`rounded-lg px-3 py-1.5 ${filterMode === mode ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                  onClick={() => setFilterMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="inline-flex w-full items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)] sm:w-auto">
              <input type="checkbox" checked={withAttachmentOnly} onChange={(e) => setWithAttachmentOnly(e.target.checked)} />
              {ANNOUNCEMENT_TEXT.filterWithAttachmentsOnly}
            </label>
            <label className="inline-flex w-full items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)] sm:w-auto">
              {ANNOUNCEMENT_TEXT.sortLabel}
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
              >
                <option value="latest">{ANNOUNCEMENT_TEXT.sortLatest}</option>
                <option value="oldest">오래된순</option>
              </select>
            </label>
          </div>
        </div>

        {/* 오류 */}
        {error && (
          <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}
        {isDevMode && devErrorSummary && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">{devErrorSummary}</div>
        )}

        {/* 알리미 목록 */}
        <div className="mt-6 space-y-3">
          {listLoading ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
              {ANNOUNCEMENT_TEXT.loading}
            </div>
          ) : displayedAnnouncements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <p className="mb-2 text-2xl">
                {activeTabKey === "consultation" ? "💬" : activeTabKey === "urgent" ? "🚨" : "📭"}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {queryText.trim()
                  ? ANNOUNCEMENT_TEXT.emptySearch
                  : activeTabKey === "consultation"
                    ? "아직 상담 관련 알림이 없어요"
                    : activeTabKey === "urgent"
                      ? "긴급 알림이 없어요"
                      : activeTabKey
                        ? `${getCategoryDisplay(activeTabKey).ko} 알림이 없어요`
                        : filterMode === "unread"
                          ? ANNOUNCEMENT_TEXT.emptyUnread
                          : ANNOUNCEMENT_TEXT.empty}
              </p>
            </div>
          ) : (
            displayedAnnouncements.map((item) => {
              const cat = getCategoryDisplay(item.category);
              const pri = getPriorityDisplay(item.priority);
              const showPriorityChip = item.priority === "urgent" || item.priority === "high";
              const ago = daysAgo(item.created_at);
              return (
                <div
                  key={item.id}
                  onClick={() => router.push(`/announcements/${item.id}`)}
                  className={`relative block cursor-pointer rounded-2xl border p-4 shadow-[var(--shadow)] transition-all hover:border-[var(--accent)] md:p-5 ${categoryBorderClass(item.category, item.priority)} ${
                    item.is_read
                      ? "opacity-60 hover:opacity-100"
                      : "shadow-md before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-r-full before:bg-[var(--accent)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-2xl leading-none">{cat.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${categoryBadgeClass(item.category)}`}>
                          {cat.ko}
                        </span>
                        {showPriorityChip && (
                          <span
                            className={
                              item.priority === "urgent"
                                ? "inline-flex items-center gap-0.5 rounded-full bg-red-500/20 px-2 py-0.5 font-medium text-red-300"
                                : "inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-2 py-0.5 font-medium text-orange-300"
                            }
                          >
                            {pri.icon} {pri.ko}
                          </span>
                        )}
                        {item.attachment_count > 0 && (
                          <span className="text-[var(--text-muted)]">📎 {item.attachment_count}</span>
                        )}
                        {item.requires_ack && (
                          <span
                            className={
                              item.is_acknowledged
                                ? "rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-[var(--text-muted)]"
                                : "rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]"
                            }
                          >
                            {item.is_acknowledged ? ackDoneBadge : tabUnackLabel}
                          </span>
                        )}
                        {!item.is_read && (
                          <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">
                            {ANNOUNCEMENT_TEXT.unread}
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <h2
                          className={`min-w-0 truncate text-lg ${
                            item.is_read
                              ? "font-medium text-[var(--text-muted)]"
                              : "font-bold text-[var(--text)]"
                          }`}
                        >
                          {item.title}
                        </h2>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleStar(item.id); }}
                            className={`rounded-lg p-1.5 transition-colors ${item.is_starred ? "text-yellow-400 hover:text-yellow-500" : "text-[var(--text-muted)] hover:text-yellow-400"}`}
                            title={item.is_starred ? "별표 해제" : "별표"}
                          >
                            {item.is_starred ? "★" : "☆"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleToggleRead(item.id, item.is_read); }}
                            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                            title={item.is_read ? "읽지 않음으로 표시" : "읽음으로 표시"}
                          >
                            {item.is_read ? "✓" : "○"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleDelete(item.id); }}
                            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-red-400"
                            title="내 목록에서 삭제"
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{preview(item.body)}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        <span>{formatDaysAgo(ago)}</span>
                        <span>·</span>
                        <span>{formatCreatedAt(item.created_at)}</span>
                        <span>·</span>
                        <span>
                          {ANNOUNCEMENT_TEXT.audienceLabel}{" "}
                          {item.audience_role === "parent"
                            ? ANNOUNCEMENT_TEXT.audienceParent
                            : item.audience_role === "student"
                              ? ANNOUNCEMENT_TEXT.audienceStudent
                              : ANNOUNCEMENT_TEXT.audienceAll}
                        </span>
                        {item.target_summary && (
                          <>
                            <span>·</span>
                            <span>{ANNOUNCEMENT_TEXT.targetLabel} {item.target_summary}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>

      {/* Undo 토스트 */}
      {undoTarget && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-gray-800 px-4 py-3 text-white shadow-xl dark:bg-gray-700">
          <span className="text-sm">알리미가 삭제됐어요</span>
          <button
            type="button"
            onClick={() => void handleUndo(undoTarget)}
            className="text-sm font-bold text-[var(--accent)] hover:underline"
          >
            실행 취소
          </button>
        </div>
      )}
    </PageShell>
  );
}
