import { supabase } from "@/lib/supabaseClient";
import type {
  AnnouncementAudienceRole,
  AnnouncementCategory,
  AnnouncementTargetScope,
  SchoolLevel,
} from "@/constants/announcementMeta";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  requires_ack: boolean;
  scheduled_at: string | null;
  category: AnnouncementCategory;
};

export type AnnouncementTargetRow = {
  announcement_id: string;
  target_type: AnnouncementTargetScope;
  school_level: SchoolLevel | null;
  grade: number | null;
  class_label: string | null;
  student_id: string | null;
};

export type MyAnnouncementItem = Announcement & {
  audience_role: AnnouncementAudienceRole;
  is_read: boolean;
  is_acknowledged: boolean;
  is_pinned: boolean;
  attachment_count: number;
  target_summary: string;
};

export type MyAnnouncementCounts = {
  total: number;
  unread: number;
  unacknowledged: number;
  pinned: number;
  with_attachments: number;
};

export type MyAnnouncementsPayload = {
  items: MyAnnouncementItem[];
  counts: MyAnnouncementCounts;
};

export type AnnouncementRead = {
  announcement_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
};

export type AnnouncementAttachment = {
  id: string;
  announcement_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
};

export type RecentAnnouncementTemplate = {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  audience_role: AnnouncementAudienceRole;
  requires_ack: boolean;
  scheduled_at: string | null;
  targets: AnnouncementTargetRow[];
};

export async function fetchAnnouncements(limit?: number): Promise<Announcement[]> {
  const { data, error } = await supabase
    .rpc("get_visible_announcements", { p_limit: typeof limit === "number" ? limit : null })
    .returns<Announcement[]>();
  if (error) {
    const parts = [
      typeof error.message === "string" ? error.message : "",
      typeof error.details === "string" ? error.details : "",
      typeof error.hint === "string" ? error.hint : "",
    ].filter((value) => value.length > 0);
    throw new Error(parts.length > 0 ? parts.join(" | ") : "fetchAnnouncements failed");
  }
  return Array.isArray(data) ? data : [];
}

export async function fetchAnnouncementReads(userId: string): Promise<AnnouncementRead[]> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id,read_at,acknowledged_at")
    .eq("user_id", userId)
    .returns<AnnouncementRead[]>();

  if (error) throw error;
  return data ?? [];
}

export async function fetchUnreadAnnouncementCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_announcement_count");
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

export async function fetchMyAnnouncements(params: {
  status: "all" | "unread" | "unacknowledged" | "pinned";
  query?: string | null;
  hasAttachments?: boolean | null;
  sort?: "latest" | "oldest";
  limit?: number;
  offset?: number;
  includeBeforeApproval?: boolean;
}): Promise<MyAnnouncementsPayload> {
  const rpcParams = {
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
    p_query: params.query ?? null,
    p_sort: params.sort ?? "latest",
    p_status: params.status,
    p_has_attachments: params.hasAttachments ?? null,
    ...(typeof params.includeBeforeApproval === "boolean"
      ? { p_include_before_approval: params.includeBeforeApproval }
      : {}),
  };

  const { data, error } = await supabase.rpc("get_my_announcements", rpcParams);
  if (error) throw error;

  const payload = (typeof data === "object" && data !== null ? data : {}) as {
    items?: unknown;
    counts?: Partial<MyAnnouncementCounts>;
  };

  const normalizedItems = (Array.isArray(payload.items) ? payload.items : []).map((raw) => {
    const row = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const readAt = typeof row.read_at === "string" ? row.read_at : null;
    const acknowledgedAt = typeof row.acknowledged_at === "string" ? row.acknowledged_at : null;
    const hasAttachments = typeof row.has_attachments === "boolean" ? row.has_attachments : null;
    const attachmentCount = typeof row.attachment_count === "number"
      ? row.attachment_count
      : hasAttachments === true
        ? 1
        : 0;
    return {
      id: typeof row.id === "string" ? row.id : "",
      title: typeof row.title === "string" ? row.title : "",
      body: typeof row.body === "string" ? row.body : "",
      created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
      requires_ack: typeof row.requires_ack === "boolean" ? row.requires_ack : false,
      scheduled_at: typeof row.scheduled_at === "string" ? row.scheduled_at : null,
      category: typeof row.category === "string" ? row.category as AnnouncementCategory : "general",
      audience_role: typeof row.audience_role === "string" ? row.audience_role as AnnouncementAudienceRole : "all",
      is_read: typeof row.is_read === "boolean" ? row.is_read : readAt !== null,
      is_acknowledged: typeof row.is_acknowledged === "boolean" ? row.is_acknowledged : acknowledgedAt !== null,
      is_pinned: typeof row.is_pinned === "boolean" ? row.is_pinned : false,
      attachment_count: attachmentCount,
      target_summary: typeof row.target_summary === "string" ? row.target_summary : "-",
    } satisfies MyAnnouncementItem;
  });

  return {
    items: normalizedItems,
    counts: {
      total: typeof payload.counts?.total === "number" ? payload.counts.total : 0,
      unread: typeof payload.counts?.unread === "number" ? payload.counts.unread : 0,
      unacknowledged: typeof payload.counts?.unacknowledged === "number" ? payload.counts.unacknowledged : 0,
      pinned: typeof payload.counts?.pinned === "number" ? payload.counts.pinned : 0,
      with_attachments: typeof payload.counts?.with_attachments === "number" ? payload.counts.with_attachments : 0,
    },
  };
}

export async function fetchAnnouncementAttachments(
  announcementIds: string[]
): Promise<Record<string, AnnouncementAttachment[]>> {
  if (announcementIds.length === 0) return {};

  const { data, error } = await supabase
    .from("announcement_attachments")
    .select("id,announcement_id,file_name,file_path,file_size,created_at")
    .in("announcement_id", announcementIds)
    .order("created_at", { ascending: true })
    .returns<AnnouncementAttachment[]>();

  if (error) throw error;

  return (data ?? []).reduce<Record<string, AnnouncementAttachment[]>>((acc, row) => {
    if (!acc[row.announcement_id]) acc[row.announcement_id] = [];
    acc[row.announcement_id].push(row);
    return acc;
  }, {});
}

export async function fetchAnnouncementTargets(
  announcementIds: string[]
): Promise<Record<string, AnnouncementTargetRow[]>> {
  if (announcementIds.length === 0) return {};

  const { data, error } = await supabase
    .from("announcement_targets")
    .select("announcement_id,target_type,school_level,grade,class_label,student_id")
    .in("announcement_id", announcementIds)
    .returns<AnnouncementTargetRow[]>();

  if (error) throw error;

  return (data ?? []).reduce<Record<string, AnnouncementTargetRow[]>>((acc, row) => {
    if (!acc[row.announcement_id]) acc[row.announcement_id] = [];
    acc[row.announcement_id].push(row);
    return acc;
  }, {});
}

export async function fetchRecentAnnouncementTemplates(
  ownerId: string,
  limit = 8
): Promise<RecentAnnouncementTemplate[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,category,audience_role,requires_ack,scheduled_at")
    .eq("created_by", ownerId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Array<{
      id: string;
      title: string;
      body: string;
      category: AnnouncementCategory | null;
      audience_role: AnnouncementAudienceRole | null;
      requires_ack: boolean | null;
      scheduled_at: string | null;
    }>>();

  if (error) throw error;

  const ids = (data ?? []).map((row) => row.id);
  const targetsByAnnouncement = await fetchAnnouncementTargets(ids);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category ?? "general",
    audience_role: row.audience_role ?? "all",
    requires_ack: row.requires_ack ?? false,
    scheduled_at: row.scheduled_at,
    targets: targetsByAnnouncement[row.id] ?? [],
  }));
}

export async function createAnnouncementAttachmentSignedUrl(
  filePath: string,
  expiresInSec = 120
): Promise<string> {
  const { data, error } = await supabase
    .storage
    .from("announcement_attachments")
    .createSignedUrl(filePath, expiresInSec);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}

export async function softDeleteAnnouncement(announcementId: string): Promise<void> {
  const { error } = await supabase
    .from("announcements")
    .update({ is_deleted: true })
    .eq("id", announcementId);
  if (error) throw error;
}
