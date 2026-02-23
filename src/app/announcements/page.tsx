"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchAnnouncementReads, fetchAnnouncements, type Announcement } from "@/lib/announcements";

type FilterMode = "all" | "unread";

export default function AnnouncementsPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(`���� Ȯ�� ����: ${sessionError.message}`);
      setLoading(false);
      return;
    }

    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const currentUserId = session.user.id;

    try {
      const [rows, readRows] = await Promise.all([fetchAnnouncements(), fetchAnnouncementReads(currentUserId)]);
      setAnnouncements(rows);
      setReadIds(new Set(readRows.map((row) => row.announcement_id)));
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "���� ��ȸ�� �����߽��ϴ�.");
      setLoading(false);
    }
  };

  const formatCreatedAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const preview = (body: string) => {
    const text = body.trim();
    if (text.length <= 120) return text;
    return `${text.slice(0, 120)}...`;
  };

  const unreadCount = announcements.filter((item) => !readIds.has(item.id)).length;
  const visibleAnnouncements =
    filterMode === "unread" ? announcements.filter((item) => !readIds.has(item.id)) : announcements;

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        �ε� ��...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> ��������
        </h1>
        <p className="mt-2 text-xs text-[#6F6F7D]">���� Ŭ�� �� �� ����</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-1 text-sm">
            <button
              className={`rounded-lg px-3 py-1.5 ${
                filterMode === "all" ? "bg-[#1E1E26] text-[#F5F5F7]" : "text-[#B8B8C3]"
              }`}
              onClick={() => setFilterMode("all")}
            >
              ��ü
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 ${
                filterMode === "unread" ? "bg-[#1E1E26] text-[#F5F5F7]" : "text-[#B8B8C3]"
              }`}
              onClick={() => setFilterMode("unread")}
            >
              ��������
            </button>
          </div>
          <div className="text-xs text-[#B8B8C3]">������ {unreadCount}��</div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {visibleAnnouncements.length === 0 ? (
            <div className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">
              {filterMode === "unread" ? "������ ���������� �����ϴ�." : "��ϵ� ���������� �����ϴ�."}
            </div>
          ) : (
            visibleAnnouncements.map((item) => {
              const isRead = readIds.has(item.id);

              return (
                <Link
                  key={item.id}
                  href={`/announcements/${item.id}`}
                  className="block rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 transition hover:border-[#3A3A46]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-[#F5F5F7]">{item.title}</h2>
                    <span
                      className={`shrink-0 rounded-lg border px-2 py-1 text-xs ${
                        isRead
                          ? "border-[#2B6A3A] bg-[#142A1B] text-[#B8F5C6]"
                          : "border-[#6A5B2B] bg-[#2A2414] text-[#F2DE9B]"
                      }`}
                    >
                      {isRead ? "����" : "������"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6F6F7D]">{formatCreatedAt(item.created_at)}</p>
                  <p className="mt-3 text-sm text-[#B8B8C3] whitespace-pre-wrap">{preview(item.body)}</p>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
