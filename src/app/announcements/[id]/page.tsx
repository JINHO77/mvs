"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import HomeLink from "@/components/common/HomeLink";
import Badge from "@/components/ui/Badge";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import {
  createAnnouncementAttachmentSignedUrl,
  fetchAnnouncementAttachments,
  type AnnouncementAttachment,
} from "@/lib/announcements";
import { ANNOUNCEMENT_TEXT } from "@/constants/announcements.ko";
import { getAnnouncementCategoryBadgeVariant, getAnnouncementCategoryLabel, type AnnouncementCategory } from "@/constants/announcementMeta";
import { getLinkedStudentCountForGuardian } from "@/lib/parentGuard";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_deleted: boolean;
  requires_ack: boolean;
  category: AnnouncementCategory | null;
};

const REPORT_PATH_REGEX = /\/reports\/([0-9a-f-]{36})/i;

function isMissingAnnouncementCategoryError(error: unknown): boolean {
  const pretty = toPrettyErrorString(error).toLowerCase();
  return pretty.includes("category")
    && (pretty.includes("does not exist") || pretty.includes("column") || pretty.includes("42703"));
}

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const text = ANNOUNCEMENT_TEXT as Record<string, string>;
  const ackButtonLabel = text.ackButton ?? "확인";
  const ackDoneBadge = text.ackDoneBadge ?? "확인 완료";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [ackBusy, setAckBusy] = useState(false);
  const reportIdFromBody = announcement?.body?.match(REPORT_PATH_REGEX)?.[1] ?? null;
  const sanitizedBody = useMemo(() => {
    if (!announcement) return "";
    const withoutReportPath = announcement.body.replace(REPORT_PATH_REGEX, "").trim();
    return withoutReportPath.replace(/\n{3,}/g, "\n\n");
  }, [announcement]);

  useEffect(() => {
    void initialize();
  }, [params.id]);

  const upsertReadState = async (
    announcementId: string,
    acknowledge: boolean
  ): Promise<{ readAt: string | null; acknowledgedAt: string | null }> => {
    const nowIso = new Date().toISOString();
    const userId = (await supabase.auth.getUser()).data.user?.id ?? "";
    if (!userId) return { readAt: null, acknowledgedAt: null };

    const { data: existingRow, error: existingError } = await supabase
      .from("announcement_reads")
      .select("read_at,acknowledged_at")
      .eq("announcement_id", announcementId)
      .eq("user_id", userId)
      .maybeSingle<{ read_at: string | null; acknowledged_at: string | null }>();
    if (existingError) throw existingError;

    const preservedReadAt = existingRow?.read_at ?? nowIso;
    const preservedAckAt = acknowledge ? (existingRow?.acknowledged_at ?? nowIso) : (existingRow?.acknowledged_at ?? null);

    const payload = {
      announcement_id: announcementId,
      user_id: userId,
      read_at: preservedReadAt,
      acknowledged_at: preservedAckAt,
    };

    const { error: upsertError } = await supabase.from("announcement_reads").upsert(payload, {
      onConflict: "announcement_id,user_id",
    });
    if (upsertError) throw upsertError;

    return {
      readAt: preservedReadAt,
      acknowledgedAt: preservedAckAt,
    };
  };

  const initialize = async () => {
    setError(null);
    setLoading(true);

    const announcementId = params.id;
    if (!announcementId) {
      setError(ANNOUNCEMENT_TEXT.detailInvalidPath);
      setLoading(false);
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(`${ANNOUNCEMENT_TEXT.sessionCheckFailed}: ${sessionError.message}`);
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null }>();
    if (profileError) {
      setError(`${ANNOUNCEMENT_TEXT.detailLoadFailedPrefix}: ${profileError.message}`);
      setLoading(false);
      return;
    }
    if (profileRow?.role === "owner") {
      router.replace("/owner/announcements");
      return;
    }
    if (profileRow?.role === "parent") {
      try {
        const linkedCount = await getLinkedStudentCountForGuardian(session.user.id);
        if (linkedCount === 0) {
          router.replace("/parent/onboarding/link");
          return;
        }
      } catch {
        setError(ANNOUNCEMENT_TEXT.detailLoadFailedPrefix);
        setLoading(false);
        return;
      }
    }

    let data: Announcement | null = null;
    const primaryFetch = await supabase
      .from("announcements")
      .select("id,title,body,created_at,is_deleted,requires_ack,category")
      .eq("id", announcementId)
      .maybeSingle<Announcement>();
    if (primaryFetch.error && isMissingAnnouncementCategoryError(primaryFetch.error)) {
      const fallbackFetch = await supabase
        .from("announcements")
        .select("id,title,body,created_at,is_deleted,requires_ack")
        .eq("id", announcementId)
        .maybeSingle<Omit<Announcement, "category">>();
      if (fallbackFetch.error) {
        setError(ANNOUNCEMENT_TEXT.detailLoadFailedPrefix);
        setLoading(false);
        return;
      }
      data = fallbackFetch.data ? { ...fallbackFetch.data, category: null } : null;
    } else if (primaryFetch.error) {
      setError(ANNOUNCEMENT_TEXT.detailLoadFailedPrefix);
      setLoading(false);
      return;
    } else {
      data = primaryFetch.data ?? null;
    }
    if (!data) {
      setAnnouncement(null);
      setAttachments([]);
      setLoading(false);
      return;
    }

    try {
      const next = await upsertReadState(data.id, false);
      setAcknowledgedAt(next.acknowledgedAt);
      router.refresh();
    } catch (e: unknown) {
      console.error("Announcement read/ack upsert failed:", toPrettyErrorString(e), e);
    }

    setAnnouncement(data);
    if (!data.is_deleted) {
      try {
        const attachmentMap = await fetchAnnouncementAttachments([data.id]);
        setAttachments(attachmentMap[data.id] ?? []);
      } catch {
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }
    setLoading(false);
  };

  const handleAcknowledge = async () => {
    if (!announcement || !announcement.requires_ack || acknowledgedAt) return;
    setAckBusy(true);
    setError(null);
    try {
      const next = await upsertReadState(announcement.id, true);
      setAcknowledgedAt(next.acknowledgedAt ?? new Date().toISOString());
      router.refresh();
    } catch (e: unknown) {
      console.error("Announcement acknowledge failed:", toPrettyErrorString(e), e);
      setError(ANNOUNCEMENT_TEXT.detailLoadFailedPrefix);
    } finally {
      setAckBusy(false);
    }
  };

  const formatCreatedAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR");
  };

  const downloadAttachment = async (filePath: string) => {
    try {
      const signedUrl = await createAnnouncementAttachmentSignedUrl(filePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError(ANNOUNCEMENT_TEXT.attachmentDownloadFail);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">{ANNOUNCEMENT_TEXT.loading}</main>;
  }

  return (
    <PageShell
      title={announcement?.title ?? "알림 상세"}
      subtitle={announcement ? formatCreatedAt(announcement.created_at) : ANNOUNCEMENT_TEXT.detailNotFound}
      maxWidthClassName="max-w-4xl"
      actions={<HomeLink />}
    >
      <SectionCard>
        {!announcement ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow)]">
            {ANNOUNCEMENT_TEXT.detailNotFound}
          </div>
        ) : announcement.is_deleted ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow)]">
            {ANNOUNCEMENT_TEXT.deletedNotice}
          </div>
        ) : (
          <article className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text)] md:text-2xl">{announcement.title}</h1>
              <Badge variant={getAnnouncementCategoryBadgeVariant(announcement.category)}>{getAnnouncementCategoryLabel(announcement.category)}</Badge>
            </div>

            <div className="whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow)] md:p-5">
              {sanitizedBody || announcement.body}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)] md:p-5">
              <div className="text-sm font-medium text-[var(--text)]">{ANNOUNCEMENT_TEXT.attachments}</div>
              {attachments.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {reportIdFromBody
                    ? "이 알림에는 별도 첨부가 없습니다. 아래 리포트 보기에서 자료를 확인해 주세요."
                    : ANNOUNCEMENT_TEXT.attachmentNone}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {attachments.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                      onClick={() => void downloadAttachment(file.file_path)}
                    >
                      {file.file_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {reportIdFromBody && (
              <Link
                href={`/reports/${reportIdFromBody}`}
              className="inline-flex w-full justify-center rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)]"
              >
                리포트 보기
              </Link>
            )}
          </article>
        )}

        {announcement?.requires_ack && (
          <div className="mt-4">
            {acknowledgedAt ? (
              <span className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
                {ackDoneBadge}
              </span>
            ) : (
              <button
                type="button"
                className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
                onClick={() => void handleAcknowledge()}
                disabled={ackBusy}
              >
                {ackBusy ? ANNOUNCEMENT_TEXT.processing : ackButtonLabel}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            {error}
          </div>
        )}

        <button
          className="mt-5 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          onClick={() => {
            router.refresh();
            router.push("/announcements");
          }}
        >
          {ANNOUNCEMENT_TEXT.moveToList}
        </button>
      </SectionCard>
    </PageShell>
  );
}
