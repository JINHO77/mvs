"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import HomeLink from "@/components/common/HomeLink";
import {
  getAnnouncementCategoryBadgeVariant,
  getAnnouncementCategoryLabel,
  getSchoolLevelLabel,
  type AnnouncementAudienceRole,
  type AnnouncementCategory,
} from "@/constants/announcementMeta";
import { OWNER_ANNOUNCEMENTS_TEXT } from "@/constants/ownerAnnouncements.ko";
import { fetchAnnouncementTargets, type AnnouncementTargetRow } from "@/lib/announcements";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { supabase } from "@/lib/supabaseClient";

type Tab = "active" | "trash";
type AudienceRole = AnnouncementAudienceRole;
type AudienceFilter = AnnouncementAudienceRole;
type PeriodFilter = "all" | "today" | "7d" | "30d";

type OwnerAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  audience_role: AudienceRole | null;
  category: AnnouncementCategory | null;
  requires_ack: boolean | null;
  scheduled_at: string | null;
  is_deleted: boolean;
};

type AnnouncementStat = {
  recipients: number;
  read: number;
  unread: number;
  acknowledged: number;
  unacknowledged: number;
};

type AnnouncementReadRow = {
  announcement_id: string;
  user_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
};

function isMissingAnnouncementColumnError(error: unknown): boolean {
  const pretty = toPrettyErrorString(error).toLowerCase();
  return (pretty.includes("category") || pretty.includes("scheduled_at"))
    && (pretty.includes("does not exist") || pretty.includes("column") || pretty.includes("42703"));
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

function formatTargetSummary(targets: AnnouncementTargetRow[]): string {
  if (targets.length === 0) return "-";
  return targets.map((target) => {
    if (target.target_type === "all") return "전체";
    if (target.target_type === "school_level") return getSchoolLevelLabel(target.school_level);
    if (target.target_type === "grade") return `${getSchoolLevelLabel(target.school_level)} ${target.grade ?? "-"}학년`;
    if (target.target_type === "class") {
      return `${getSchoolLevelLabel(target.school_level)} ${target.grade ?? "-"}학년 ${target.class_label ?? "-"}반`;
    }
    return "학생 개별";
  }).join(", ");
}

export default function OwnerAnnouncementsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [withAttachmentOnly, setWithAttachmentOnly] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [rows, setRows] = useState<OwnerAnnouncementRow[]>([]);
  const [attachmentCountMap, setAttachmentCountMap] = useState<Record<string, number>>({});
  const [targetMap, setTargetMap] = useState<Record<string, AnnouncementTargetRow[]>>({});
  const [statMap, setStatMap] = useState<Record<string, AnnouncementStat>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [directRecipientsEnabled, setDirectRecipientsEnabled] = useState(false);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authorized) return;
    void loadRows(tab, audienceFilter, periodFilter);
  }, [authorized, audienceFilter, periodFilter, tab]);

  const initialize = async () => {
    setError(null);
    setSuccess(null);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError("알리미 목록을 불러오는 중 문제가 발생했습니다.");
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
      .single<{ role: string | null }>();

    if (meError) {
      setError("알리미 목록을 불러오는 중 문제가 발생했습니다.");
      setLoading(false);
      return;
    }

    if (me.role !== "owner") {
      setError(OWNER_ANNOUNCEMENTS_TEXT.accessDenied);
      setLoading(false);
      return;
    }

    await detectDirectRecipientsSupport();
    setAuthorized(true);
    await loadRows(tab, audienceFilter, periodFilter);
  };

  const detectDirectRecipientsSupport = async () => {
    const { error: directRecipientsError } = await supabase
      .from("announcement_direct_recipients")
      .select("announcement_id", { head: true, count: "exact" })
      .limit(1);

    if (directRecipientsError) {
      console.warn("announcement_direct_recipients unavailable:", toPrettyErrorString(directRecipientsError), directRecipientsError);
      setDirectRecipientsEnabled(false);
      return;
    }

    setDirectRecipientsEnabled(true);
  };

  const getPeriodRange = (period: PeriodFilter): { gte?: string; lt?: string } => {
    if (period === "all") return {};

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    if (period === "7d") {
      start.setDate(start.getDate() - 6);
    } else if (period === "30d") {
      start.setDate(start.getDate() - 29);
    }

    return {
      gte: start.toISOString(),
      lt: end.toISOString(),
    };
  };

  const loadRows = async (nextTab: Tab, nextAudience: AudienceFilter, nextPeriod: PeriodFilter) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const buildBaseQuery = (selectClause: string) => {
        let nextQuery = supabase
          .from("announcements")
          .select(selectClause)
          .eq("is_deleted", nextTab === "trash")
          .order("created_at", { ascending: false });

        if (nextAudience !== "all") nextQuery = nextQuery.eq("audience_role", nextAudience);
        const { gte, lt } = getPeriodRange(nextPeriod);
        if (gte) nextQuery = nextQuery.gte("created_at", gte);
        if (lt) nextQuery = nextQuery.lt("created_at", lt);
        return nextQuery;
      };

      let data: OwnerAnnouncementRow[] | null = null;
      const primaryResult = await buildBaseQuery(
        "id,title,body,created_at,audience_role,category,requires_ack,scheduled_at,is_deleted"
      ).returns<OwnerAnnouncementRow[]>();

      if (primaryResult.error && isMissingAnnouncementColumnError(primaryResult.error)) {
        const fallbackResult = await buildBaseQuery(
          "id,title,body,created_at,audience_role,requires_ack,is_deleted"
        ).returns<Array<Omit<OwnerAnnouncementRow, "category" | "scheduled_at">>>();
        if (fallbackResult.error) throw fallbackResult.error;
        data = (fallbackResult.data ?? []).map((row) => ({
          ...row,
          category: null,
          scheduled_at: null,
        }));
      } else if (primaryResult.error) {
        throw primaryResult.error;
      } else {
        data = primaryResult.data ?? [];
      }

      const nextRows = data ?? [];
      setRows(nextRows);

      const ids = nextRows.map((row) => row.id);
      if (ids.length === 0) {
        setAttachmentCountMap({});
        setTargetMap({});
        setStatMap({});
      } else {
        const [attachmentResult, targetsByAnnouncement, deliveryResult] = await Promise.all([
          supabase
            .from("announcement_attachments")
            .select("announcement_id")
            .in("announcement_id", ids)
            .returns<Array<{ announcement_id: string }>>(),
          fetchAnnouncementTargets(ids),
          supabase
            .from("announcement_reads")
            .select("announcement_id,user_id,read_at,acknowledged_at")
            .in("announcement_id", ids)
            .returns<AnnouncementReadRow[]>(),
        ]);

        const { data: attachmentRows, error: attachmentError } = attachmentResult;
        if (attachmentError) throw attachmentError;
        if (deliveryResult.error) throw deliveryResult.error;

        const map = (attachmentRows ?? []).reduce<Record<string, number>>((acc, row) => {
          acc[row.announcement_id] = (acc[row.announcement_id] ?? 0) + 1;
          return acc;
        }, {});
        setAttachmentCountMap(map);
        setTargetMap(targetsByAnnouncement);
        const readsByAnnouncement = (deliveryResult.data ?? []).reduce<Record<string, Map<string, AnnouncementReadRow>>>((acc, row) => {
          if (!acc[row.announcement_id]) acc[row.announcement_id] = new Map<string, AnnouncementReadRow>();
          acc[row.announcement_id].set(row.user_id, row);
          return acc;
        }, {});

        setStatMap(
          Object.fromEntries(
            ids.map((id) => {
              const rowsByRecipient = Array.from(readsByAnnouncement[id]?.values() ?? []);
              const recipients = rowsByRecipient.length;
              const read = rowsByRecipient.filter((row) => row.read_at !== null).length;
              const acknowledged = rowsByRecipient.filter((row) => row.acknowledged_at !== null).length;
              const unread = Math.max(recipients - read, 0);
              const unacknowledged = Math.max(recipients - acknowledged, 0);
              return [
                id,
                {
                  recipients,
                  read,
                  unread,
                  acknowledged,
                  unacknowledged,
                } satisfies AnnouncementStat,
              ];
            })
          )
        );
      }
    } catch (e: unknown) {
      console.error("Owner announcements load failed:", toPrettyErrorString(e), e);
      setError("알리미 목록을 불러오는 중 문제가 발생했습니다.");
      setRows([]);
      setAttachmentCountMap({});
      setTargetMap({});
      setStatMap({});
    } finally {
      setLoading(false);
    }
  };

  const mutateDeleted = async (id: string, isDeleted: boolean) => {
    const confirmed = window.confirm(
      isDeleted ? OWNER_ANNOUNCEMENTS_TEXT.confirmDelete : OWNER_ANNOUNCEMENTS_TEXT.confirmRestore
    );
    if (!confirmed) return;

    try {
      setBusyId(id);
      setError(null);
      setSuccess(null);
      const { data, error: updateError } = await supabase
        .from("announcements")
        .update({ is_deleted: isDeleted })
        .eq("id", id)
        .select("id")
        .single<{ id: string }>();

      if (updateError) throw updateError;
      if (!data?.id) throw new Error(OWNER_ANNOUNCEMENTS_TEXT.updateFailed);

      setRows((prev) => prev.filter((row) => row.id !== id));
      setSuccess(OWNER_ANNOUNCEMENTS_TEXT.updateDone);
    } catch (e: unknown) {
      console.error("Owner announcements update failed:", toPrettyErrorString(e), e);
      setError(OWNER_ANNOUNCEMENTS_TEXT.updateFailed);
    } finally {
      setBusyId(null);
    }
  };

  const audienceLabel = (role: AudienceRole | null): string => {
    if (role === "student") return OWNER_ANNOUNCEMENTS_TEXT.audienceStudent;
    if (role === "parent") return OWNER_ANNOUNCEMENTS_TEXT.audienceParent;
    return OWNER_ANNOUNCEMENTS_TEXT.audienceAll;
  };

  const resendUnacknowledged = async (row: OwnerAnnouncementRow) => {
    try {
      setResendingId(row.id);
      setError(null);
      setSuccess(null);
      const { data: me, error: meError } = await supabase.auth.getUser();
      if (meError) throw meError;
      if (!me.user?.id) throw new Error(OWNER_ANNOUNCEMENTS_TEXT.updateFailed);

      if (!directRecipientsEnabled) {
        setError(OWNER_ANNOUNCEMENTS_TEXT.resendUnsupported);
        return;
      }

      const { data: readRows, error: recipientError } = await supabase
        .from("announcement_reads")
        .select("user_id")
        .eq("announcement_id", row.id)
        .is("acknowledged_at", null)
        .returns<Array<{ user_id: string | null }>>();
      if (recipientError) throw recipientError;

      const recipientIds = Array.from(
        new Set(
          (readRows ?? [])
            .map((readRow) => readRow.user_id ?? null)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      );

      if (recipientIds.length === 0) {
        setError(OWNER_ANNOUNCEMENTS_TEXT.resendEmpty);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("announcements")
        .insert({
          title: `${OWNER_ANNOUNCEMENTS_TEXT.templatePrefix}${row.title}`,
          body: row.body,
          category: row.category ?? "general",
          audience_role: row.audience_role ?? "all",
          requires_ack: row.requires_ack ?? false,
          created_by: me.user.id,
        })
        .select("id")
        .single<{ id: string }>();
      if (insertError) throw insertError;

      const { error: directError } = await supabase.from("announcement_direct_recipients").insert(
        recipientIds.map((recipientId) => ({
          announcement_id: inserted.id,
          recipient_id: recipientId,
        }))
      );
      if (directError) {
        const pretty = toPrettyErrorString(directError).toLowerCase();
        if (pretty.includes("announcement_direct_recipients") && (pretty.includes("does not exist") || pretty.includes("column"))) {
          setDirectRecipientsEnabled(false);
          setError(OWNER_ANNOUNCEMENTS_TEXT.resendUnsupported);
          return;
        }
        throw directError;
      }

      await loadRows(tab, audienceFilter, periodFilter);
      setError(null);
      setSuccess(OWNER_ANNOUNCEMENTS_TEXT.resendDone);
    } catch (e: unknown) {
      console.error("Owner announcements resend failed:", toPrettyErrorString(e), e);
      setError(OWNER_ANNOUNCEMENTS_TEXT.loadFailed);
    } finally {
      setResendingId(null);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (withAttachmentOnly && (attachmentCountMap[row.id] ?? 0) === 0) return false;
    if (!normalizedQuery) return true;
    return row.title.toLowerCase().includes(normalizedQuery) || row.body.toLowerCase().includes(normalizedQuery);
  });

  return (
    <PageShell
      title={OWNER_ANNOUNCEMENTS_TEXT.title}
      subtitle={OWNER_ANNOUNCEMENTS_TEXT.subtitle}
      maxWidthClassName="max-w-5xl"
      actions={<HomeLink fallbackHref="/owner" />}
    >
      <SectionCard>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 text-sm">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 ${tab === "active" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
              onClick={() => setTab("active")}
            >
              {OWNER_ANNOUNCEMENTS_TEXT.tabActive}
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 ${tab === "trash" ? "bg-[var(--card-soft)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
              onClick={() => setTab("trash")}
            >
              {OWNER_ANNOUNCEMENTS_TEXT.tabTrash}
            </button>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={OWNER_ANNOUNCEMENTS_TEXT.searchPlaceholder}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] md:max-w-sm"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          <label className="inline-flex w-full items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span>{OWNER_ANNOUNCEMENTS_TEXT.filterAudienceLabel}</span>
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value as AudienceFilter)}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="all">{OWNER_ANNOUNCEMENTS_TEXT.audienceAll}</option>
              <option value="student">{OWNER_ANNOUNCEMENTS_TEXT.audienceStudent}</option>
              <option value="parent">{OWNER_ANNOUNCEMENTS_TEXT.audienceParent}</option>
            </select>
          </label>
          <label className="inline-flex w-full items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span>{OWNER_ANNOUNCEMENTS_TEXT.filterPeriodLabel}</span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)]"
            >
              <option value="all">{OWNER_ANNOUNCEMENTS_TEXT.periodAll}</option>
              <option value="today">{OWNER_ANNOUNCEMENTS_TEXT.periodToday}</option>
              <option value="7d">{OWNER_ANNOUNCEMENTS_TEXT.period7Days}</option>
              <option value="30d">{OWNER_ANNOUNCEMENTS_TEXT.period30Days}</option>
            </select>
          </label>
          <label className="inline-flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <input type="checkbox" checked={withAttachmentOnly} onChange={(e) => setWithAttachmentOnly(e.target.checked)} />
            {OWNER_ANNOUNCEMENTS_TEXT.filterWithAttachmentsOnly}
          </label>
        </div>

        {loading && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
            {OWNER_ANNOUNCEMENTS_TEXT.loading}
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{error}</div>
        )}

        {!loading && success && (
          <div className="mt-4 rounded-xl border border-[#1F6B42] bg-[#12281C] p-4 text-sm text-[#B6F0C9]">{success}</div>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]">
            {tab === "active" ? OWNER_ANNOUNCEMENTS_TEXT.emptyActive : OWNER_ANNOUNCEMENTS_TEXT.emptyTrash}
          </div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="mt-4 space-y-3">
            {filteredRows.map((row) => {
              const isBusy = busyId === row.id;
              const isActiveTab = tab === "active";
              const stat = statMap[row.id] ?? { recipients: 0, read: 0, unread: 0, acknowledged: 0, unacknowledged: 0 };
              const targetSummary = formatTargetSummary(targetMap[row.id] ?? []);
              return (
                <div key={row.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5 lg:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-[var(--text)]">{row.title}</h3>
                        <Badge variant={getAnnouncementCategoryBadgeVariant(row.category)}>{getAnnouncementCategoryLabel(row.category)}</Badge>
                        {row.scheduled_at && <Badge variant="warning">{OWNER_ANNOUNCEMENTS_TEXT.scheduledLabel}</Badge>}
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{formatCreatedAt(row.created_at)}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{row.body}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                        <span>{OWNER_ANNOUNCEMENTS_TEXT.targetLabel}: {targetSummary}</span>
                        <span>{OWNER_ANNOUNCEMENTS_TEXT.attachmentsLabel}: {attachmentCountMap[row.id] ?? 0}</span>
                        <span>{OWNER_ANNOUNCEMENTS_TEXT.recipientsLabel}: {stat.recipients}</span>
                        <span>읽음: {stat.read}</span>
                        <span>미읽음: {stat.unread}</span>
                        <span>{OWNER_ANNOUNCEMENTS_TEXT.ackLabel}: {stat.acknowledged}</span>
                        <span>{OWNER_ANNOUNCEMENTS_TEXT.unacknowledgedLabel}: {stat.unacknowledged}</span>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Badge variant="neutral">{audienceLabel(row.audience_role)}</Badge>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end">
                      {row.requires_ack && isActiveTab && directRecipientsEnabled && (
                        <button
                          type="button"
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-60 md:w-auto"
                          disabled={resendingId === row.id}
                          onClick={() => void resendUnacknowledged(row)}
                        >
                          {resendingId === row.id ? OWNER_ANNOUNCEMENTS_TEXT.resending : OWNER_ANNOUNCEMENTS_TEXT.resendUnacknowledged}
                        </button>
                      )}
                      <button
                        type="button"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-60 md:w-auto"
                        disabled={isBusy}
                        onClick={() => void mutateDeleted(row.id, isActiveTab)}
                      >
                        {isBusy
                          ? OWNER_ANNOUNCEMENTS_TEXT.deleting
                          : isActiveTab
                            ? OWNER_ANNOUNCEMENTS_TEXT.actionDelete
                            : OWNER_ANNOUNCEMENTS_TEXT.actionRestore}
                      </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
