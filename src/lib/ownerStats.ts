import { supabase } from "@/lib/supabaseClient";

// PostgreSQL의 numeric/decimal은 PostgREST를 거치며 string으로 직렬화된다.
// JS에서 toFixed()/Math.round() 같은 연산을 하기 전에 number로 강제 변환한다.
function coerceNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceNumberOrZero(value: unknown): number {
  return coerceNumber(value) ?? 0;
}

export type OwnerStatsGroupKpiRow = {
  school_level: string | null;
  school_level_order: number | null;
  grade: number | null;
  student_count: number;
  active_this_month: number;
  group_total_xp: number;
  avg_xp: number | null;
  avg_level: number | null;
  max_xp: number | null;
};

export type StudentXpByPeriodRow = {
  student_id: string;
  student_name: string | null;
  school_level: string | null;
  school_level_order: number | null;
  grade: number | null;
  xp_this_week: number;
  xp_this_month: number;
  xp_last_month: number;
  xp_term1: number;
  xp_term2: number;
  xp_school_year: number;
  xp_total: number;
  xp_math: number;
  xp_english: number;
};

export type StudentXpSummaryRow = {
  student_id: string;
  student_name: string | null;
  total_xp: number;
  current_level: number | null;
  current_level_icon: string | null;
  current_level_title: string | null;
};

export async function getOwnerStatsGroupKpi(): Promise<OwnerStatsGroupKpiRow[]> {
  const { data, error } = await supabase
    .from("v_owner_stats_group_kpi")
    .select("*")
    .order("school_level_order", { ascending: true })
    .order("grade", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row): OwnerStatsGroupKpiRow => ({
    school_level: (row.school_level as string | null) ?? null,
    school_level_order: coerceNumber(row.school_level_order),
    grade: coerceNumber(row.grade),
    student_count: coerceNumberOrZero(row.student_count),
    active_this_month: coerceNumberOrZero(row.active_this_month),
    group_total_xp: coerceNumberOrZero(row.group_total_xp),
    avg_xp: coerceNumber(row.avg_xp),
    avg_level: coerceNumber(row.avg_level),
    max_xp: coerceNumber(row.max_xp),
  }));
}

export async function getStudentXpByPeriod(): Promise<StudentXpByPeriodRow[]> {
  const { data, error } = await supabase
    .from("v_student_xp_by_period")
    .select("*")
    .order("xp_total", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row): StudentXpByPeriodRow => ({
    student_id: String(row.student_id ?? ""),
    student_name: (row.student_name as string | null) ?? null,
    school_level: (row.school_level as string | null) ?? null,
    school_level_order: coerceNumber(row.school_level_order),
    grade: coerceNumber(row.grade),
    xp_this_week: coerceNumberOrZero(row.xp_this_week),
    xp_this_month: coerceNumberOrZero(row.xp_this_month),
    xp_last_month: coerceNumberOrZero(row.xp_last_month),
    xp_term1: coerceNumberOrZero(row.xp_term1),
    xp_term2: coerceNumberOrZero(row.xp_term2),
    xp_school_year: coerceNumberOrZero(row.xp_school_year),
    xp_total: coerceNumberOrZero(row.xp_total),
    xp_math: coerceNumberOrZero(row.xp_math),
    xp_english: coerceNumberOrZero(row.xp_english),
  }));
}

export async function getStudentXpSummary(): Promise<StudentXpSummaryRow[]> {
  const { data, error } = await supabase
    .from("v_student_xp_summary")
    .select("*")
    .order("total_xp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row): StudentXpSummaryRow => ({
    student_id: String(row.student_id ?? ""),
    student_name: (row.student_name as string | null) ?? null,
    total_xp: coerceNumberOrZero(row.total_xp),
    current_level: coerceNumber(row.current_level),
    current_level_icon: (row.current_level_icon as string | null) ?? null,
    current_level_title: (row.current_level_title as string | null) ?? null,
  }));
}

export type OwnerStatsBundle = {
  groupKpi: OwnerStatsGroupKpiRow[];
  byPeriod: StudentXpByPeriodRow[];
  summary: StudentXpSummaryRow[];
};

export async function getOwnerStatsBundle(): Promise<OwnerStatsBundle> {
  const [groupKpi, byPeriod, summary] = await Promise.all([
    getOwnerStatsGroupKpi(),
    getStudentXpByPeriod(),
    getStudentXpSummary(),
  ]);
  return { groupKpi, byPeriod, summary };
}
