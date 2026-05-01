import { supabase } from "@/lib/supabaseClient";

export type EffectiveSchoolLevel = "elementary" | "middle" | "high";

export interface EffectiveGradeRow {
  student_id: string;
  name: string | null;
  school_level: EffectiveSchoolLevel | null;
  grade: number | null;
  grade_label: string | null;
  effective_school_level: EffectiveSchoolLevel | null;
  effective_grade: number | null;
  effective_grade_label: string | null;
  is_preview: boolean;
  preview_message: string | null;
}

export async function fetchEffectiveGrade(studentId: string): Promise<EffectiveGradeRow | null> {
  const { data, error } = await supabase
    .from("v_student_effective_grade")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle<EffectiveGradeRow>();

  if (error || !data) return null;
  return data;
}
