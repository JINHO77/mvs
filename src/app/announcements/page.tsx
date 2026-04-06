"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { ANNOUNCEMENT_TEXT } from "@/constants/announcements.ko";
import { getAnnouncementCategoryBadgeVariant, getAnnouncementCategoryLabel } from "@/constants/announcementMeta";
import { fetchMyAnnouncements, type MyAnnouncementCounts, type MyAnnouncementItem } from "@/lib/announcements";
import { getLinkedStudentCountForGuardian } from "@/lib/parentGuard";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type FilterMode = "all" | "unread" | "unacknowledged" | "pinned";
type SortMode = "latest" | "oldest";

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

function preview(body: string): string {
  const text = body.trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 120)}...`;
}

function isMissingAccountStatusError(error: unknown): boolean {
  const pretty = toPrettyErrorString(error).toLowerCase();
  return pretty.includes("account_status")
    && (pretty.includes("does not exist") || pretty.includes("column") || pretty.includes("42703"));
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const text = ANNOUNCEMENT_TEXT as Record<string, string>;

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

  const [announcements, setAnnouncements] = useState<MyAnnouncementItem[]>([]);
  const [counts, setCounts] = useState<MyAnnouncementCounts>({
    total: 0,
    unread: 0,
    unacknowledged: 0,
    pinned: 0,
    with_attachments: 0,
  });

  const [queryText, setQueryText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [withAttachmentOnly, setWithAttachmentOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const reqRef = useRef(0);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryText);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [queryText]);

  useEffect(() => {
    if (!isReady) return;
    void loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, debouncedQuery, filterMode, sortMode, withAttachmentOnly, offset]);

  const initialize = async () => {
    setError(null);
    setDevErrorSummary(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

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

    let role = "";
    let status = "active";

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null; account_status: string | null }>();

    if (profileError) {
      if (!isMissingAccountStatusError(profileError)) {
        console.error("Announcements profile load failed:", toPrettyErrorString(profileError), profileError);
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
        console.error("Announcements role fallback failed:", toPrettyErrorString(fallbackError), fallbackError);
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

    if (role === "owner") {
      router.replace("/owner/announcements");
      return;
    }
    if (status === "pending") {
      router.replace("/onboarding/pending");
      return;
    }
    if (status === "blocked" || status === "withdrawn") {
      router.replace("/onboarding/blocked");
      return;
    }

    if (role === "parent") {
      try {
        const linkedCount = await getLinkedStudentCountForGuardian(session.user.id);
        if (linkedCount === 0) {
          router.replace("/parent/onboarding/link");
          return;
        }
      } catch (e: unknown) {
        console.error("Announcements guardian link check failed:", toPrettyErrorString(e), e);
      }
    }

    setIsReady(true);
    setLoading(false);
  };

  const loadAnnouncements = async () => {
    setListLoading(true);
    setError(null);
    setDevErrorSummary(null);
    try {
      const reqId = ++reqRef.current;
      const payload = await fetchMyAnnouncements({
        status: filterMode,
        limit: 200,
        offset,
        query: debouncedQuery.trim() || null,
        sort: sortMode,
        hasAttachments: withAttachmentOnly ? true : null,
      });
      if (reqId !== reqRef.current) return;
      setAnnouncements(payload.items ?? []);
      setCounts({
        total: payload.counts.total ?? 0,
        unread: payload.counts.unread ?? 0,
        unacknowledged: payload.counts.unacknowledged ?? 0,
        pinned: payload.counts.pinned ?? 0,
        with_attachments: payload.counts.with_attachments ?? 0,
      });
    } catch (e: unknown) {
      const pretty = toPrettyErrorString(e).toLowerCase();
      const missingRpc = pretty.includes("pgrst202") || pretty.includes("get_my_announcements");
      console.error("Announcements RPC load failed:", toPrettyErrorString(e), e);
      setAnnouncements([]);
      setCounts({
        total: 0,
        unread: 0,
        unacknowledged: 0,
        pinned: 0,
        with_attachments: 0,
      });
      setError(missingRpc ? "알리미함 기능 준비 중입니다. 관리자에게 문의해 주세요." : `${ANNOUNCEMENT_TEXT.loadErrorFallback} 승인 상태/권한을 확인해 주세요.`);
      setDevErrorSummary(missingRpc ? null : toPrettyErrorString(e));
    } finally {
      setListLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        {ANNOUNCEMENT_TEXT.loading}
      </main>
    );
  }

  return (
    <PageShell
      title={ANNOUNCEMENT_TEXT.title}
      subtitle={ANNOUNCEMENT_TEXT.subtitle}
      maxWidthClassName="max-w-5xl"
      actions={<HomeLink />}
    >
      <SectionCard>

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

        <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-3 md:p-4">
          <input
            type="text"
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value);
              setOffset(0);
            }}
            placeholder={ANNOUNCEMENT_TEXT.searchPlaceholder}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 text-sm">
              <button
                className={`rounded-lg px-3 py-1.5 ${filterMode === "all" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                onClick={() => setFilterMode("all")}
              >
                {tabAllLabel}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 ${filterMode === "unread" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                onClick={() => setFilterMode("unread")}
              >
                {tabUnreadLabel}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 ${filterMode === "unacknowledged" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                onClick={() => setFilterMode("unacknowledged")}
              >
                {tabUnackLabel}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 ${filterMode === "pinned" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                onClick={() => setFilterMode("pinned")}
              >
                {tabPinnedLabel}
              </button>
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

        {error && (
          <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}
        {isDevMode && devErrorSummary && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">{devErrorSummary}</div>
        )}

        <div className="mt-6 space-y-3">
          {listLoading ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow)]">
              {ANNOUNCEMENT_TEXT.loading}
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow)]">
              {queryText.trim()
                ? ANNOUNCEMENT_TEXT.emptySearch
                : filterMode === "unread"
                  ? ANNOUNCEMENT_TEXT.emptyUnread
                  : ANNOUNCEMENT_TEXT.empty}
            </div>
          ) : (
            announcements.map((item) => (
              <Link
                key={item.id}
                href={`/announcements/${item.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)] transition hover:border-[var(--accent)] md:p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-[var(--text)]">{item.title}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{formatCreatedAt(item.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 md:shrink-0 md:justify-end">
                    <span className={`shrink-0 rounded-lg border px-2 py-1 text-xs ${item.is_read ? "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]" : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                      {item.is_read ? ANNOUNCEMENT_TEXT.read : ANNOUNCEMENT_TEXT.unread}
                    </span>
                    {item.requires_ack && (
                      <span className={`shrink-0 rounded-lg border px-2 py-1 text-xs ${item.is_acknowledged ? "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text-muted)]" : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                        {item.is_acknowledged ? ackDoneBadge : tabUnackLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-xs text-[var(--text)]">
                    {ANNOUNCEMENT_TEXT.categoryLabel} {getAnnouncementCategoryLabel(item.category)}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${getAnnouncementCategoryBadgeVariant(item.category) === "info" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--card-soft)] text-[var(--text)]"}`}>
                    {ANNOUNCEMENT_TEXT.audienceLabel}{" "}
                    {item.audience_role === "parent"
                      ? ANNOUNCEMENT_TEXT.audienceParent
                      : item.audience_role === "student"
                        ? ANNOUNCEMENT_TEXT.audienceStudent
                        : ANNOUNCEMENT_TEXT.audienceAll}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-xs text-[var(--text)]">
                    {ANNOUNCEMENT_TEXT.targetLabel} {item.target_summary || ANNOUNCEMENT_TEXT.targetUnknown}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-xs text-[var(--text)]">
                    {ANNOUNCEMENT_TEXT.attachmentIconLabel} {item.attachment_count}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{preview(item.body)}</p>
              </Link>
            ))
          )}
        </div>
      </SectionCard>
    </PageShell>
  );
}
