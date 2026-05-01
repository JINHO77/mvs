import { supabase } from "@/lib/supabaseClient";

export interface WeekendRecommendation {
  mission_id: string;
  day_of_week: "saturday" | "sunday";
  subject: string;
  title: string;
  bonus_xp: number;
  base_xp: number;
}

export interface WeekendCompletionResult {
  success: boolean;
  is_recommended: boolean;
  total_xp: number;
  base_xp: number;
  bonus_xp: number;
  perfect_bonus: number;
  streak_bonus: number;
  message: string;
}

/**
 * 이번 주 추천 미션 목록 조회.
 * 추천이 없으면 먼저 generate 후 재조회.
 * 오늘이 토요일 → saturday 필터, 일요일 → sunday 필터, 평일 → 전체 반환.
 */
export async function getThisWeekRecommendations(): Promise<WeekendRecommendation[]> {
  // 추천 없으면 먼저 생성 (no-op if already exists)
  await supabase.rpc("generate_weekly_weekend_recommendations");

  const { data, error } = await supabase
    .from("v_this_week_recommendations")
    .select("mission_id, day_of_week, subject, title, bonus_xp, base_xp");

  if (error || !data) return [];

  const kstDay = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay();
  const dayFilter: "saturday" | "sunday" | null =
    kstDay === 6 ? "saturday" : kstDay === 0 ? "sunday" : null;

  const recs = data as WeekendRecommendation[];
  return dayFilter ? recs.filter((r) => r.day_of_week === dayFilter) : recs;
}

/**
 * 주말 미션 완료 처리 + XP 지급.
 * 추천 미션: base 20 + bonus 130 = 150 XP
 * 비추천 미션: base 20 XP
 */
export async function completeWeekendMission(
  studentId: string,
  missionId: string,
  score = 100,
): Promise<WeekendCompletionResult> {
  const { data, error } = await supabase.rpc("complete_weekend_mission", {
    p_student_id: studentId,
    p_mission_id: missionId,
    p_score: score,
  });

  if (error) throw error;
  return data as WeekendCompletionResult;
}
