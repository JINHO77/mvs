import { supabase } from "@/lib/supabaseClient";

export function computeCurrentWeekKey(date = new Date()): number {
  const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const target = new Date(Date.UTC(kst.getFullYear(), kst.getMonth(), kst.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return target.getUTCFullYear() * 100 + weekNo;
}

export type WeeklyPathWithTheme = {
  path_key: string;
  unit_id: string | null;
  unit_name: string;
  theme_title: string;
  emoji: string;
  theme_description: string | null;
  is_new: boolean;
  path_created_at: string | null;
  total_missions: number;
  total_reward_xp: number;
};

export type WeeklyPathListItem = {
  week_key: number;
  subject: "math" | "english";
  path_key: string;
  unit_name: string;
  theme_title: string;
  emoji: string;
  is_new: boolean;
  is_current_week: boolean;
  assigned_at: string;
};

export async function getWeeklyPathWithTheme(
  studentId: string,
  subject: "math" | "english",
  weekKey: number
): Promise<WeeklyPathWithTheme | null> {
  const { data, error } = await supabase.rpc("get_weekly_path_with_theme", {
    p_student_id: studentId,
    p_subject: subject,
    p_week_key: weekKey,
  });

  if (error) {
    console.warn("get_weekly_path_with_theme failed:", error.message);
    return null;
  }

  if (!data) return null;
  const row = Array.isArray(data) ? data[0] ?? null : data;
  if (!row) return null;

  return row as WeeklyPathWithTheme;
}

export async function listStudentWeeklyPaths(
  studentId: string,
  subject?: "math" | "english",
  limit?: number
): Promise<WeeklyPathListItem[]> {
  const params: Record<string, unknown> = { p_student_id: studentId };
  if (subject !== undefined) params.p_subject = subject;
  if (limit !== undefined) params.p_limit = limit;

  const { data, error } = await supabase.rpc("list_student_weekly_paths", params);

  if (error) {
    console.warn("list_student_weekly_paths failed:", error.message);
    return [];
  }

  return (Array.isArray(data) ? data : []) as WeeklyPathListItem[];
}
