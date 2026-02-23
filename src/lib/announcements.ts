import { supabase } from "@/lib/supabaseClient";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export type AnnouncementRead = {
  announcement_id: string;
};

export async function fetchAnnouncements(limit?: number): Promise<Announcement[]> {
  let query = supabase
    .from("announcements")
    .select("id,title,body,created_at")
    .order("created_at", { ascending: false });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query.returns<Announcement[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchAnnouncementReads(userId: string): Promise<AnnouncementRead[]> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId)
    .returns<AnnouncementRead[]>();

  if (error) throw error;
  return data ?? [];
}
