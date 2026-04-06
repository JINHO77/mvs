"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  fetchMyAnnouncements,
  type MyAnnouncementItem,
} from "@/lib/announcements";
import { readAnnouncementStars, writeAnnouncementStars } from "@/lib/announcementStars";
import { NOTICES_TEXT } from "@/constants/notices.ko";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type NoticeFeedProps = {
  maxItems?: number;
  title?: string;
  moreHref?: string;
  enhancedForStudent?: boolean;
  mode?: "default" | "student" | "parent" | "owner";
};

type AnnouncementTarget = {
  announcement_id: string;
  target_type: "all" | "school_level" | "grade" | "class" | "student";
  grade: number | null;
  class_label: string | null;
  student_id: string | null;
};

type FeedTab = "all" | "gradeClass" | "personal";

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

function previewText(body: string): string {
  const text = body.trim();
  if (text.length <= 90) return text;
  return `${text.slice(0, 90)}...`;
}

export default function NoticeFeed({
  maxItems = 5,
  title = NOTICES_TEXT.feedTitle,
  moreHref = "/announcements",
  enhancedForStudent = false,
  mode,
}: NoticeFeedProps) {
  const resolvedMode = mode ?? (enhancedForStudent ? "student" : "default");
  const isStudentMode = resolvedMode === "student";
  const isOwnerMode = resolvedMode === "owner";
  const hasFilterPanel = resolvedMode === "student" || resolvedMode === "parent";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MyAnnouncementItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [attachmentsByAnnouncement, setAttachmentsByAnnouncement] = useState<Record<string, number>>({});
  const [targetsByAnnouncement, setTargetsByAnnouncement] = useState<Record<string, AnnouncementTarget[]>>({});
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [myClassLabel, setMyClassLabel] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState<FeedTab>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [withAttachmentOnly, setWithAttachmentOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [queryText, setQueryText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const loadErrorKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryText);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [queryText]);

  useEffect(() => {
    setStarredIds(readAnnouncementStars());
    let mounted = true;

    const logLoadErrorOnce = (err: unknown) => {
      const pretty = toPrettyErrorString(err);
      if (loadErrorKeysRef.current.has(pretty)) return;
      loadErrorKeysRef.current.add(pretty);
      console.error(`NoticeFeed load failed: ${pretty}`);
    };

    const isApprovalOrPermissionError = async (): Promise<boolean> => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user?.id) return false;
        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("account_status")
          .eq("id", session.user.id)
          .maybeSingle<{ account_status: string | null }>();
        if (profileError) return false;
        const status = (profileRow?.account_status ?? "active").trim();
        return status === "pending" || status === "blocked" || status === "withdrawn";
      } catch {
        return false;
      }
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchMyAnnouncements({
          status: unreadOnly ? "unread" : "all",
          limit: maxItems,
          offset: 0,
          query: debouncedQuery.trim() || null,
          sort: "latest",
          hasAttachments: withAttachmentOnly ? true : null,
        });
        const rows = payload.items;
        if (!mounted) return;
        const ids = rows.map((row) => row.id);
        setReadIds(new Set(rows.filter((row) => row.is_read).map((row) => row.id)));
        setAttachmentsByAnnouncement(
          rows.reduce<Record<string, number>>((acc, row) => {
            acc[row.id] = row.attachment_count ?? 0;
            return acc;
          }, {})
        );

        if (hasFilterPanel || isOwnerMode) {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          if (session) {
            const { data: profileRow, error: profileError } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", session.user.id)
              .single<{ role: string | null }>();
            if (profileError) throw profileError;
            if (!mounted) return;
            setViewerRole(profileRow.role ?? null);

            if (hasFilterPanel) {
              if (isStudentMode) {
                const [targetRows, myProfile] = await Promise.all([
                  ids.length === 0
                    ? Promise.resolve([] as AnnouncementTarget[])
                    : supabase
                        .from("announcement_targets")
                        .select("announcement_id,target_type,grade,class_label,student_id")
                        .in("announcement_id", ids)
                        .returns<AnnouncementTarget[]>()
                        .then(({ data, error }) => {
                          if (error) throw error;
                          return data ?? [];
                        }),
                  supabase
                    .from("profiles")
                    .select("id,grade,class_label")
                    .eq("id", session.user.id)
                    .single<{ id: string; grade: number | null; class_label: string | null }>()
                    .then(({ data, error }) => {
                      if (error) throw error;
                      return data;
                    }),
                ]);
                if (!mounted) return;

                const groupedTargets = targetRows.reduce<Record<string, AnnouncementTarget[]>>((acc, row) => {
                  if (!acc[row.announcement_id]) acc[row.announcement_id] = [];
                  acc[row.announcement_id].push(row);
                  return acc;
                }, {});

                setTargetsByAnnouncement(groupedTargets);
                setMyProfileId(myProfile.id);
                setMyGrade(typeof myProfile.grade === "number" ? myProfile.grade : null);
                setMyClassLabel(myProfile.class_label ?? null);
              }
            }
          }
        }

        setItems(rows);
      } catch (e: unknown) {
        if (!mounted) return;
        logLoadErrorOnce(e);
        setItems([]);
        setReadIds(new Set());
        setAttachmentsByAnnouncement({});
        const isApproval = await isApprovalOrPermissionError();
        setError(isApproval ? "승인 후 이용 가능합니다." : "알리미를 불러오지 못했습니다. 새로고침 해주세요.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [debouncedQuery, hasFilterPanel, isOwnerMode, isStudentMode, maxItems, unreadOnly, withAttachmentOnly]);

  const toggleStar = (announcementId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(announcementId)) {
        next.delete(announcementId);
      } else {
        next.add(announcementId);
      }
      writeAnnouncementStars(next);
      return next;
    });
  };

  const deleteAnnouncement = async (announcementId: string) => {
    if (!(isOwnerMode && viewerRole === "owner")) return;
    if (!window.confirm(NOTICES_TEXT.deleteConfirm)) return;

    try {
      setDeletingId(announcementId);
      const { data, error } = await supabase
        .from("announcements")
        .update({ is_deleted: true })
        .eq("id", announcementId)
        .select("id")
        .single<{ id: string }>();
      if (error) throw new Error(toPrettyErrorString(error));
      if (!data?.id) throw new Error("deleteAnnouncement failed: no row updated");
      setItems((prev) => prev.filter((row) => row.id !== announcementId));
      setReadIds((prev) => {
        const next = new Set(prev);
        next.delete(announcementId);
        return next;
      });
      setStarredIds((prev) => {
        const next = new Set(prev);
        next.delete(announcementId);
        writeAnnouncementStars(next);
        return next;
      });
    } catch (e: unknown) {
      const pretty = toPrettyErrorString(e);
      console.error(`NoticeFeed delete failed: ${pretty}`);
      setError(pretty);
    } finally {
      setDeletingId(null);
    }
  };

  const unreadCount = items.filter((item) => !readIds.has(item.id)).length;

  const filteredItems = items.filter((item) => {
    if (!hasFilterPanel) return true;

    if (isStudentMode) {
      const targets = targetsByAnnouncement[item.id] ?? [];
      const tabMatched =
        tab === "all"
          ? true
          : tab === "personal"
            ? targets.some((target) => target.target_type === "student" && target.student_id === myProfileId)
            : targets.some(
                (target) =>
                  (target.target_type === "grade" && myGrade != null && target.grade === myGrade)
                  || (target.target_type === "class" && myClassLabel != null && target.class_label === myClassLabel)
              );
      if (!tabMatched) return false;
    }
    if (unreadOnly && readIds.has(item.id)) return false;
    if (withAttachmentOnly && (attachmentsByAnnouncement[item.id] ?? 0) === 0) return false;
    if (starredOnly && !starredIds.has(item.id)) return false;
    return true;
  });

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          {hasFilterPanel && (
            <span className="mt-1 inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
              {NOTICES_TEXT.unreadCountLabel}
              {" "}
              {unreadCount}
              {NOTICES_TEXT.unreadCountSuffix}
            </span>
          )}
        </div>
        <Link href={moreHref} className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
          {NOTICES_TEXT.moveToAll}
        </Link>
      </div>

      {hasFilterPanel && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="제목/내용 검색"
            className="min-w-[180px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          {isStudentMode && (
            <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 text-xs">
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 ${tab === "all" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--muted)]"}`}
                onClick={() => setTab("all")}
              >
                {NOTICES_TEXT.tabAll}
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 ${tab === "gradeClass" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--muted)]"}`}
                onClick={() => setTab("gradeClass")}
              >
                {NOTICES_TEXT.tabGroup}
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 ${tab === "personal" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--muted)]"}`}
                onClick={() => setTab("personal")}
              >
                {NOTICES_TEXT.tabPersonal}
              </button>
            </div>
          )}
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            {NOTICES_TEXT.filterUnreadOnly}
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={withAttachmentOnly} onChange={(e) => setWithAttachmentOnly(e.target.checked)} />
            {NOTICES_TEXT.filterWithAttachmentOnly}
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} />
            {NOTICES_TEXT.filterStarredOnly}
          </label>
        </div>
      )}

      {loading && (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">{NOTICES_TEXT.loading}</div>
      )}

      {!loading && error && (
        <div className="mt-3 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">{error}</div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">{NOTICES_TEXT.empty}</div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <div className="mt-3 space-y-2">
          {filteredItems.map((item) => {
            const isStarred = starredIds.has(item.id);
            const canDelete = isOwnerMode && viewerRole === "owner";
            return (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 hover:border-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/announcements/${item.id}`} className="block min-w-0 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!readIds.has(item.id) && (
                          <span className="inline-flex items-center rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                            {NOTICES_TEXT.unreadBadge}
                          </span>
                        )}
                        {(attachmentsByAnnouncement[item.id] ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                            <span aria-hidden="true">📎</span>
                            {NOTICES_TEXT.attachmentMark}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{previewText(item.body)}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                      onClick={() => toggleStar(item.id)}
                      title={isStarred ? NOTICES_TEXT.starRemove : NOTICES_TEXT.starAdd}
                      aria-label={isStarred ? NOTICES_TEXT.starRemove : NOTICES_TEXT.starAdd}
                    >
                      {isStarred ? "★" : "☆"}
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-60"
                        onClick={() => void deleteAnnouncement(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? NOTICES_TEXT.deleting : NOTICES_TEXT.deleteAction}
                      </button>
                    )}
                    <p className="text-[11px] text-[var(--muted)]">{formatCreatedAt(item.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
