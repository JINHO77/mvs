import { supabase } from '@/lib/supabaseClient'

export interface LevelInfo {
  level: number
  level_name: string
  emoji: string
  color: string
  description: string
  current_xp: number
  level_start_xp: number
  next_level_xp: number
  next_level_name: string
  progress_pct: number
}

export interface XpResult {
  success: boolean
  xp_earned: number
  total_xp: number
  old_level: number
  new_level: number
  leveled_up: boolean
  level_info: LevelInfo
  base_xp?: number
  multiplier?: number
  streak?: number
}

export interface StudentXpStatus {
  student_id: string
  name: string
  total_xp: number
  level: number
  daily_streak: number
  weekly_xp: number
  weekly_missions: number
  level_name: string
  level_emoji: string
  level_color: string
  level_description: string
  next_level_xp: number
  next_level_name: string
  progress_pct: number
  total_missions: number
  badge_count: number
}

/** 학생 XP 현황 뷰에서 조회 */
export async function getStudentXpStatus(studentId: string): Promise<StudentXpStatus | null> {
  const { data, error } = await supabase
    .from('v_student_xp_status')
    .select('*')
    .eq('student_id', studentId)
    .single()
  if (error) {
    console.warn('xp status error:', error.message)
    return null
  }
  return data as StudentXpStatus
}

/** profiles에서 직접 XP/레벨 조회 (뷰 실패 시 fallback) */
export async function getProfileXp(studentId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('total_xp, level, daily_streak, weekly_xp')
    .eq('id', studentId)
    .single()
  return data
}

/** 레벨 이름/이모지 반환 */
export function getLevelDisplay(level: number): { name: string; emoji: string; color: string } {
  const levels: Record<number, { name: string; emoji: string; color: string }> = {
    1:  { name: '새싹',         emoji: '🌱', color: '#4CAF50' },
    2:  { name: '탐험가',       emoji: '🔍', color: '#8BC34A' },
    3:  { name: '도전자',       emoji: '⚡', color: '#FFC107' },
    4:  { name: '지식인',       emoji: '📚', color: '#FF9800' },
    5:  { name: '실력자',       emoji: '💪', color: '#FF5722' },
    6:  { name: '전문가',       emoji: '🎯', color: '#E91E63' },
    7:  { name: '마스터',       emoji: '👑', color: '#9C27B0' },
    8:  { name: '천재',         emoji: '🧠', color: '#673AB7' },
    9:  { name: '전설',         emoji: '🌟', color: '#3F51B5' },
    10: { name: '전설★★',      emoji: '🌟', color: '#2196F3' },
    11: { name: '전설★★★',     emoji: '💎', color: '#03A9F4' },
    12: { name: '챔피언',       emoji: '🏆', color: '#00BCD4' },
    13: { name: '그랜드마스터', emoji: '🔱', color: '#009688' },
    14: { name: '신화',         emoji: '⚜️', color: '#4CAF50' },
    15: { name: '불멸자',       emoji: '🔥', color: '#FF6B35' },
  }
  return levels[Math.min(level, 15)] ?? levels[1]!
}

/** XP 기반으로 다음 레벨까지 진행률 계산 */
export function calcProgress(totalXp: number, level: number) {
  const thresholds = [0, 200, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500, 8500, 11000, 14000, 18000, 25000]
  const current = thresholds[Math.min(level - 1, 14)] ?? 0
  const next    = thresholds[Math.min(level, 14)] ?? 99999
  const pct = next === 99999 ? 100 : Math.round((totalXp - current) / (next - current) * 100)
  return { pct: Math.min(Math.max(pct, 0), 100), nextXp: next, remaining: Math.max(next - totalXp, 0) }
}

/** reward_events에서 미확인 이벤트 가져오기 */
export async function getUnseenEvents(studentId: string) {
  const { data } = await supabase
    .from('reward_events')
    .select('*')
    .eq('student_id', studentId)
    .eq('seen', false)
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

export async function markEventsSeen(studentId: string) {
  await supabase
    .from('reward_events')
    .update({ seen: true })
    .eq('student_id', studentId)
    .eq('seen', false)
}
