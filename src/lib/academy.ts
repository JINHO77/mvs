import { supabase } from "@/lib/supabaseClient";
import { isUuid } from "@/lib/validators";

export async function ensureOwnerAcademy(name?: string | null): Promise<string> {
  const candidate = typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
  const { data, error } = await supabase.rpc("ensure_owner_academy", { p_name: candidate });
  if (error) throw error;
  if (!isUuid(data)) throw new Error("학원 생성 결과가 올바르지 않습니다.");
  return data;
}
