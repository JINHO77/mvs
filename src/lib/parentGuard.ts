import { supabase } from "@/lib/supabaseClient";

type LinkedStudentRow = {
  student_id?: string | null;
};

export async function getLinkedStudentCountForGuardian(_userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("list_my_students");
  if (error) throw error;
  const rows = Array.isArray(data) ? (data as LinkedStudentRow[]) : [];
  return rows.filter((row) => typeof row?.student_id === "string" && row.student_id.length > 0).length;
}
