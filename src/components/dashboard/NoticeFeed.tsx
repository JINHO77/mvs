"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAnnouncements, type Announcement } from "@/lib/announcements";

type NoticeFeedProps = {
  maxItems?: number;
  title?: string;
  moreHref?: string;
};

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
  title = "공지사항",
  moreHref = "/announcements",
}: NoticeFeedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setError(null);
      try {
        const rows = await fetchAnnouncements(maxItems);
        if (!mounted) return;
        setItems(rows);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "공지 로딩에 실패했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [maxItems]);

  return (
    <section className="rounded-2xl border border-[#1E1E26] bg-[#121218] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href={moreHref} className="text-xs text-[#B8B8C3] hover:text-[#F5F5F7]">
          전체 보기
        </Link>
      </div>

      {loading && (
        <div className="mt-3 rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">로딩 중...</div>
      )}

      {!loading && error && (
        <div className="mt-3 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{error}</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-3 rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">등록된 공지가 없습니다.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/announcements/${item.id}`}
              className="block rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-3 hover:border-[#3A3A46]"
            >
              <h3 className="text-sm font-semibold text-[#F5F5F7]">{item.title}</h3>
              <p className="mt-1 text-xs text-[#6F6F7D]">{formatCreatedAt(item.created_at)}</p>
              <p className="mt-2 text-sm text-[#B8B8C3]">{previewText(item.body)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
