"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const initialize = async () => {
    setError(null);

    const announcementId = params.id;
    if (!announcementId) {
      setError("잘못된 공지 경로입니다.");
      setLoading(false);
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(`세션 확인 실패: ${sessionError.message}`);
      setLoading(false);
      return;
    }

    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("announcements")
      .select("id,title,body,created_at")
      .eq("id", announcementId)
      .maybeSingle<Announcement>();

    if (fetchError) {
      setError(`공지 조회 실패: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    if (!data) {
      setAnnouncement(null);
      setLoading(false);
      return;
    }

    setAnnouncement(data);

    await supabase.from("announcement_reads").upsert(
      {
        announcement_id: data.id,
        user_id: session.user.id,
      },
      {
        onConflict: "announcement_id,user_id",
      }
    );

    setLoading(false);
  };

  const formatCreatedAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        로딩 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        {!announcement ? (
          <div className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">
            요청하신 공지사항을 찾을 수 없습니다.
          </div>
        ) : (
          <article>
            <h1 className="text-2xl font-semibold text-[#F5F5F7]">{announcement.title}</h1>
            <p className="mt-2 text-xs text-[#6F6F7D]">{formatCreatedAt(announcement.created_at)}</p>
            <div className="mt-5 rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3] whitespace-pre-wrap">
              {announcement.body}
            </div>
          </article>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
            {error}
          </div>
        )}

        <button
          className="mt-5 rounded-xl border border-[#1E1E26] bg-transparent px-4 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
          onClick={() => router.push("/announcements")}
        >
          뒤로
        </button>
      </div>
    </main>
  );
}
